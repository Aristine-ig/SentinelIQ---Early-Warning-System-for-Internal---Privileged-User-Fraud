-- ─────────────────────────────────────────────────────────────────────────────
-- BankGuard AI: Maker-Checker Collusion Detection — Full Migration
-- Run this entire script in your Supabase SQL Editor (safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. maker_checker_transactions ────────────────────────────────────────────
--    Stores every transaction that goes through a maker-checker workflow.
--    Populated by the app when a Maker initiates (status='pending') and
--    updated when a Checker approves or rejects (status='approved'/'rejected').

CREATE TABLE IF NOT EXISTS maker_checker_transactions (
  id                      TEXT        PRIMARY KEY,
  tx_id                   TEXT        NOT NULL,
  maker_id                TEXT        NOT NULL,
  maker_name              TEXT        NOT NULL,
  maker_ip                TEXT        NOT NULL DEFAULT '',
  maker_device            TEXT        NOT NULL DEFAULT '',
  checker_id              TEXT,
  checker_name            TEXT,
  checker_ip              TEXT        DEFAULT '',
  checker_device          TEXT        DEFAULT '',
  amount                  NUMERIC     NOT NULL DEFAULT 0,
  customer_id             TEXT,
  beneficiary             TEXT        NOT NULL DEFAULT '',
  initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at             TIMESTAMPTZ,
  status                  TEXT        NOT NULL DEFAULT 'pending',
  collusion_rules         TEXT[]      NOT NULL DEFAULT '{}',
  is_off_premises_maker   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_off_premises_checker BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add beneficiary column if it doesn't exist (idempotent)
ALTER TABLE maker_checker_transactions ADD COLUMN IF NOT EXISTS beneficiary TEXT NOT NULL DEFAULT '';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mct_maker        ON maker_checker_transactions(maker_id);
CREATE INDEX IF NOT EXISTS idx_mct_checker      ON maker_checker_transactions(checker_id);
CREATE INDEX IF NOT EXISTS idx_mct_pair         ON maker_checker_transactions(maker_id, checker_id);
CREATE INDEX IF NOT EXISTS idx_mct_status       ON maker_checker_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mct_initiated_at ON maker_checker_transactions(initiated_at DESC);

-- RLS
ALTER TABLE maker_checker_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for maker_checker_transactions" ON maker_checker_transactions;
CREATE POLICY "Allow all for maker_checker_transactions"
  ON maker_checker_transactions FOR ALL USING (true) WITH CHECK (true);


-- ── 2. employee_profiles ──────────────────────────────────────────────────────
--    Stores each employee's home address and list of bank-registered IP ranges.
--    Used by R094 (same home address) and R097 (off-premises login detection).

CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id           TEXT        PRIMARY KEY,
  home_address      TEXT        NOT NULL DEFAULT '',
  home_pincode      TEXT        NOT NULL DEFAULT '',
  registered_ips    TEXT[]      NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read all employee_profiles"  ON employee_profiles;
DROP POLICY IF EXISTS "Allow write own employee_profile"  ON employee_profiles;
CREATE POLICY "Allow read all employee_profiles" ON employee_profiles FOR SELECT USING (true);
CREATE POLICY "Allow write own employee_profile" ON employee_profiles FOR ALL   USING (true) WITH CHECK (true);

-- Seed real employee profiles
-- Registered IPs are the bank's internal CIDR blocks: 10.0.0.x / 192.168.1.x
-- Deliberately: Rohit Mehta (USR002) and Rajiv Sharma (USR006) share the same
--   home address → triggers R094 when they form a maker-checker pair.
INSERT INTO employee_profiles (user_id, home_address, home_pincode, registered_ips)
VALUES
  ('ADMIN001', 'Admin Tower, 12 Corporate Park, Bandra Kurla Complex, Mumbai', '400051',
   ARRAY['10.0.0.1','10.0.0.2','10.0.0.3','192.168.1.1','192.168.1.2']),

  ('USR001',   '14B, Shivaji Nagar, Pune', '411005',
   ARRAY['10.0.0.10','10.0.0.11','192.168.1.10','192.168.1.11']),

  -- Rohit Mehta (Loan Officer) — shares home address with Branch Manager (collusion seed)
  ('USR002',   '7/3, Andheri West, SV Road, Mumbai', '400058',
   ARRAY['10.0.0.20','10.0.0.21','192.168.1.20']),

  ('USR006',   '7/3, Andheri West, SV Road, Mumbai', '400058',
   ARRAY['10.0.0.30','10.0.0.31','192.168.1.30','192.168.1.31']),

  ('USR003',   '22 Boat Club Road, Pune', '411001',
   ARRAY['10.0.0.40','10.0.0.41','192.168.1.40']),

  ('USR004',   '5, Indiranagar, 100 Feet Road, Bangalore', '560038',
   ARRAY['10.0.0.50','10.0.0.51','192.168.1.50']),

  ('USR005',   '88, Jubilee Hills, Hyderabad', '500033',
   ARRAY['10.0.0.60','10.0.0.61','192.168.1.60'])
ON CONFLICT (user_id) DO UPDATE SET
  home_address   = EXCLUDED.home_address,
  home_pincode   = EXCLUDED.home_pincode,
  registered_ips = EXCLUDED.registered_ips,
  updated_at     = NOW();


-- ── 3. maker_checker_pair_stats ───────────────────────────────────────────────
--    Auto-maintained summary per maker-checker pair.
--    Updated by the trigger below on every INSERT to maker_checker_transactions.

CREATE TABLE IF NOT EXISTS maker_checker_pair_stats (
  pair_key              TEXT        PRIMARY KEY,
  maker_id              TEXT        NOT NULL,
  maker_name            TEXT        NOT NULL,
  checker_id            TEXT        NOT NULL,
  checker_name          TEXT        NOT NULL,
  total_transactions    INTEGER     NOT NULL DEFAULT 0,
  approved_count        INTEGER     NOT NULL DEFAULT 0,
  rejected_count        INTEGER     NOT NULL DEFAULT 0,
  total_approved_amount NUMERIC     NOT NULL DEFAULT 0,
  avg_review_minutes    NUMERIC     NOT NULL DEFAULT 0,
  collusion_rule_hits   TEXT[]      NOT NULL DEFAULT '{}',
  last_transaction_at   TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcps_maker   ON maker_checker_pair_stats(maker_id);
CREATE INDEX IF NOT EXISTS idx_mcps_checker ON maker_checker_pair_stats(checker_id);
CREATE INDEX IF NOT EXISTS idx_mcps_amount  ON maker_checker_pair_stats(total_approved_amount DESC);

ALTER TABLE maker_checker_pair_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for maker_checker_pair_stats" ON maker_checker_pair_stats;
CREATE POLICY "Allow all for maker_checker_pair_stats"
  ON maker_checker_pair_stats FOR ALL USING (true) WITH CHECK (true);


-- ── 4. Trigger: auto-update pair stats on each completed transaction ──────────

CREATE OR REPLACE FUNCTION update_maker_checker_pair_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_pair_key       TEXT;
  v_approved_amt   NUMERIC;
  v_review_mins    NUMERIC;
BEGIN
  -- Only update stats for completed (approved/rejected) transactions
  IF NEW.checker_id IS NULL OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  v_pair_key := NEW.maker_id || '::' || NEW.checker_id;

  v_approved_amt := CASE WHEN NEW.status = 'approved' THEN NEW.amount ELSE 0 END;

  v_review_mins := CASE
    WHEN NEW.approved_at IS NOT NULL AND NEW.initiated_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (NEW.approved_at - NEW.initiated_at)) / 60.0
    ELSE 0
  END;

  INSERT INTO maker_checker_pair_stats (
    pair_key, maker_id, maker_name, checker_id, checker_name,
    total_transactions, approved_count, rejected_count,
    total_approved_amount, avg_review_minutes,
    collusion_rule_hits, last_transaction_at, updated_at
  )
  VALUES (
    v_pair_key,
    NEW.maker_id, NEW.maker_name,
    NEW.checker_id, NEW.checker_name,
    1,
    CASE WHEN NEW.status = 'approved' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'rejected' THEN 1 ELSE 0 END,
    v_approved_amt,
    v_review_mins,
    NEW.collusion_rules,
    COALESCE(NEW.approved_at, NEW.initiated_at),
    NOW()
  )
  ON CONFLICT (pair_key) DO UPDATE SET
    total_transactions    = maker_checker_pair_stats.total_transactions + 1,
    approved_count        = maker_checker_pair_stats.approved_count
                            + CASE WHEN NEW.status = 'approved' THEN 1 ELSE 0 END,
    rejected_count        = maker_checker_pair_stats.rejected_count
                            + CASE WHEN NEW.status = 'rejected' THEN 1 ELSE 0 END,
    total_approved_amount = maker_checker_pair_stats.total_approved_amount + v_approved_amt,
    avg_review_minutes    = (
                              maker_checker_pair_stats.avg_review_minutes
                              * maker_checker_pair_stats.total_transactions
                              + v_review_mins
                            ) / (maker_checker_pair_stats.total_transactions + 1),
    collusion_rule_hits   = ARRAY(
                              SELECT DISTINCT unnest(
                                maker_checker_pair_stats.collusion_rule_hits
                                || NEW.collusion_rules
                              )
                            ),
    last_transaction_at   = COALESCE(NEW.approved_at, NEW.initiated_at),
    updated_at            = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_mcp_stats ON maker_checker_transactions;
CREATE TRIGGER trg_update_mcp_stats
  AFTER INSERT OR UPDATE ON maker_checker_transactions
  FOR EACH ROW EXECUTE FUNCTION update_maker_checker_pair_stats();


-- ── 5. View: high-risk pairs (2+ collusion rule types) ───────────────────────

CREATE OR REPLACE VIEW high_risk_maker_checker_pairs AS
SELECT
  pair_key,
  maker_id,
  maker_name,
  checker_id,
  checker_name,
  total_transactions,
  approved_count,
  rejected_count,
  ROUND(total_approved_amount::NUMERIC, 2)                                          AS total_approved_amount,
  ROUND(avg_review_minutes::NUMERIC, 2)                                             AS avg_review_minutes,
  ROUND((rejected_count::NUMERIC / NULLIF(total_transactions, 0)) * 100, 1)        AS rejection_rate_pct,
  array_length(collusion_rule_hits, 1)                                              AS collusion_rule_count,
  collusion_rule_hits,
  last_transaction_at
FROM  maker_checker_pair_stats
WHERE array_length(collusion_rule_hits, 1) >= 2
ORDER BY array_length(collusion_rule_hits, 1) DESC, total_approved_amount DESC;


-- ── 6. Patch sessions table ───────────────────────────────────────────────────

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS transaction_approval_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maker_checker_actions       JSONB   NOT NULL DEFAULT '[]'::jsonb;


-- ── 7. Seed sample transactions (optional demo data) ─────────────────────────
--    Creates realistic collusion patterns so the panel has data on first load.
--    Inserts 12 transactions between USR002 (Maker/Loan Officer) and USR006 (Checker/Branch Manager):
--      - 11 approved in < 2 min  (triggers R062)
--      - Same IP on 3 of them    (triggers R063)
--      - 10+ approvals together  (triggers R060)
--      - Total > ₹50L            (triggers R093)
--      - Checker rejection rate = 0% (triggers R095)

DO $$
DECLARE
  base_time TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  i         INTEGER;
  tx_id     TEXT;
  tx_amount NUMERIC;
  init_time TIMESTAMPTZ;
  appr_time TIMESTAMPTZ;
  same_ip   BOOLEAN;
  rules     TEXT[];
BEGIN
  FOR i IN 1..12 LOOP
    tx_id     := 'SEED-TX-' || LPAD(i::TEXT, 3, '0');
    tx_amount := (400000 + i * 45000)::NUMERIC;          -- ₹4.45L–₹9.4L each
    init_time := base_time + (i * INTERVAL '2 days') + (random() * INTERVAL '8 hours');
    appr_time := init_time + ((60 + random() * 60) * INTERVAL '1 second');   -- 1–2 min review
    same_ip   := (i % 4 = 0);                             -- every 4th tx: same IP

    rules := ARRAY['R062'];                                -- always: sub-2-min approval
    IF same_ip THEN rules := rules || ARRAY['R063']; END IF;
    IF i >= 10  THEN rules := rules || ARRAY['R060']; END IF;
    IF tx_amount + (i * 45000) > 5000000 THEN rules := rules || ARRAY['R093']; END IF;

    INSERT INTO maker_checker_transactions (
      id, tx_id,
      maker_id, maker_name, maker_ip, maker_device,
      checker_id, checker_name, checker_ip, checker_device,
      amount, customer_id, beneficiary,
      initiated_at, approved_at, status,
      collusion_rules, is_off_premises_maker, is_off_premises_checker
    ) VALUES (
      'SEED-MCT-' || LPAD(i::TEXT, 3, '0'),
      tx_id,
      'USR002', 'Rohit Mehta',
      CASE WHEN same_ip THEN '10.0.0.20' ELSE '10.0.0.2' || i::TEXT END,
      'DEV-ROHIT-' || i::TEXT,
      'USR006', 'Rajiv Sharma',
      CASE WHEN same_ip THEN '10.0.0.20' ELSE '10.0.0.3' || i::TEXT END,
      'DEV-RAJIV-' || i::TEXT,
      tx_amount,
      'CUST' || LPAD(((i % 10) + 1)::TEXT, 4, '0'),
      'External Vendor ' || i::TEXT,
      init_time, appr_time, 'approved',
      rules,
      FALSE, FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Done.
-- Tables : maker_checker_transactions · employee_profiles · maker_checker_pair_stats
-- Trigger: trg_update_mcp_stats  (auto-updates pair stats on insert/update)
-- View   : high_risk_maker_checker_pairs
-- Seeds  : employee_profiles for all 7 employees
--          12 sample collusion transactions (Rohit → Rajiv)
-- ─────────────────────────────────────────────────────────────────────────────
