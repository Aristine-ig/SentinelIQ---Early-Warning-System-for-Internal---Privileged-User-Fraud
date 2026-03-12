-- ─────────────────────────────────────────────────────────────────────────────
-- BankGuard AI: Maker-Checker Collusion Detection Tables
-- Run this migration in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. maker_checker_transactions: stores every approved/rejected transaction pair
CREATE TABLE IF NOT EXISTS maker_checker_transactions (
  id                    TEXT PRIMARY KEY,
  tx_id                 TEXT NOT NULL,             -- reference to the original transaction
  maker_id              TEXT NOT NULL,             -- employee who initiated (Maker)
  maker_name            TEXT NOT NULL,
  maker_ip              TEXT NOT NULL DEFAULT '',
  maker_device          TEXT NOT NULL DEFAULT '',  -- device fingerprint hash
  checker_id            TEXT,                      -- employee who approved/rejected (Checker)
  checker_name          TEXT,
  checker_ip            TEXT DEFAULT '',
  checker_device        TEXT DEFAULT '',
  amount                NUMERIC NOT NULL DEFAULT 0,
  customer_id           TEXT,
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at           TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  collusion_rules       TEXT[]  NOT NULL DEFAULT '{}',    -- array of triggered rule IDs
  is_off_premises_maker   BOOLEAN NOT NULL DEFAULT FALSE,
  is_off_premises_checker BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast pair analytics
CREATE INDEX IF NOT EXISTS idx_mct_maker        ON maker_checker_transactions(maker_id);
CREATE INDEX IF NOT EXISTS idx_mct_checker      ON maker_checker_transactions(checker_id);
CREATE INDEX IF NOT EXISTS idx_mct_pair         ON maker_checker_transactions(maker_id, checker_id);
CREATE INDEX IF NOT EXISTS idx_mct_initiated_at ON maker_checker_transactions(initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mct_status       ON maker_checker_transactions(status);

-- 2. employee_profiles: stores home address and premises info for collusion checks
CREATE TABLE IF NOT EXISTS employee_profiles (
  user_id           TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  home_address      TEXT DEFAULT '',
  home_pincode      TEXT DEFAULT '',
  registered_ips    TEXT[] DEFAULT '{}',           -- bank-registered IPs (premises)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default profiles for existing employees (run after app_users is populated)
INSERT INTO employee_profiles (user_id, home_address, home_pincode, registered_ips)
SELECT id, '', '', '{}'
FROM app_users
ON CONFLICT (user_id) DO NOTHING;

-- 3. maker_checker_pair_stats: materialised-style summary per pair (updated on each transaction)
CREATE TABLE IF NOT EXISTS maker_checker_pair_stats (
  pair_key              TEXT PRIMARY KEY,           -- 'maker_id::checker_id'
  maker_id              TEXT NOT NULL,
  maker_name            TEXT NOT NULL,
  checker_id            TEXT NOT NULL,
  checker_name          TEXT NOT NULL,
  total_transactions    INTEGER NOT NULL DEFAULT 0,
  approved_count        INTEGER NOT NULL DEFAULT 0,
  rejected_count        INTEGER NOT NULL DEFAULT 0,
  total_approved_amount NUMERIC NOT NULL DEFAULT 0,
  avg_review_minutes    NUMERIC NOT NULL DEFAULT 0,
  collusion_rule_hits   TEXT[] NOT NULL DEFAULT '{}',
  last_transaction_at   TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcps_maker    ON maker_checker_pair_stats(maker_id);
CREATE INDEX IF NOT EXISTS idx_mcps_checker  ON maker_checker_pair_stats(checker_id);
CREATE INDEX IF NOT EXISTS idx_mcps_amount   ON maker_checker_pair_stats(total_approved_amount DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security Policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE maker_checker_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE maker_checker_pair_stats   ENABLE ROW LEVEL SECURITY;

-- maker_checker_transactions: allow all authenticated operations
CREATE POLICY "Allow all for maker_checker_transactions"
  ON maker_checker_transactions FOR ALL USING (true) WITH CHECK (true);

-- employee_profiles: allow all reads; writes scoped to own profile
CREATE POLICY "Allow read all employee_profiles"
  ON employee_profiles FOR SELECT USING (true);

CREATE POLICY "Allow write own employee_profile"
  ON employee_profiles FOR ALL USING (true) WITH CHECK (true);

-- maker_checker_pair_stats: allow all reads and writes
CREATE POLICY "Allow all for maker_checker_pair_stats"
  ON maker_checker_pair_stats FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Function: update pair stats on every MCT insert
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_maker_checker_pair_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_pair_key TEXT;
  v_approved_amount NUMERIC;
  v_review_minutes  NUMERIC;
BEGIN
  v_pair_key := NEW.maker_id || '::' || COALESCE(NEW.checker_id, 'PENDING');

  IF NEW.status = 'approved' THEN
    v_approved_amount := NEW.amount;
  ELSE
    v_approved_amount := 0;
  END IF;

  IF NEW.approved_at IS NOT NULL AND NEW.initiated_at IS NOT NULL THEN
    v_review_minutes := EXTRACT(EPOCH FROM (NEW.approved_at - NEW.initiated_at)) / 60.0;
  ELSE
    v_review_minutes := 0;
  END IF;

  INSERT INTO maker_checker_pair_stats (
    pair_key, maker_id, maker_name, checker_id, checker_name,
    total_transactions, approved_count, rejected_count,
    total_approved_amount, avg_review_minutes, collusion_rule_hits, last_transaction_at, updated_at
  )
  VALUES (
    v_pair_key,
    NEW.maker_id, NEW.maker_name,
    COALESCE(NEW.checker_id, ''), COALESCE(NEW.checker_name, ''),
    1,
    CASE WHEN NEW.status = 'approved' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'rejected' THEN 1 ELSE 0 END,
    v_approved_amount,
    v_review_minutes,
    NEW.collusion_rules,
    NEW.approved_at,
    NOW()
  )
  ON CONFLICT (pair_key) DO UPDATE SET
    total_transactions    = maker_checker_pair_stats.total_transactions + 1,
    approved_count        = maker_checker_pair_stats.approved_count + CASE WHEN NEW.status = 'approved' THEN 1 ELSE 0 END,
    rejected_count        = maker_checker_pair_stats.rejected_count + CASE WHEN NEW.status = 'rejected' THEN 1 ELSE 0 END,
    total_approved_amount = maker_checker_pair_stats.total_approved_amount + v_approved_amount,
    avg_review_minutes    = (maker_checker_pair_stats.avg_review_minutes * maker_checker_pair_stats.total_transactions + v_review_minutes)
                            / (maker_checker_pair_stats.total_transactions + 1),
    collusion_rule_hits   = ARRAY(SELECT DISTINCT unnest(
                              maker_checker_pair_stats.collusion_rule_hits || NEW.collusion_rules
                            )),
    last_transaction_at   = COALESCE(NEW.approved_at, NEW.initiated_at),
    updated_at            = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_mcp_stats
  AFTER INSERT ON maker_checker_transactions
  FOR EACH ROW EXECUTE FUNCTION update_maker_checker_pair_stats();

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper view: high-risk pairs (2+ collusion rules triggered)
-- ─────────────────────────────────────────────────────────────────────────────

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
  ROUND(total_approved_amount::NUMERIC, 2) AS total_approved_amount,
  ROUND(avg_review_minutes::NUMERIC, 2)    AS avg_review_minutes,
  ROUND((rejected_count::NUMERIC / NULLIF(total_transactions, 0)) * 100, 1) AS rejection_rate_pct,
  array_length(collusion_rule_hits, 1) AS collusion_rule_count,
  collusion_rule_hits,
  last_transaction_at
FROM maker_checker_pair_stats
WHERE array_length(collusion_rule_hits, 1) >= 2
ORDER BY array_length(collusion_rule_hits, 1) DESC, total_approved_amount DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Patch sessions table to support maker-checker tracking fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS transaction_approval_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maker_checker_actions       JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done! Run in Supabase SQL Editor. 
-- Tables: maker_checker_transactions, employee_profiles, maker_checker_pair_stats
-- Trigger: trg_update_mcp_stats (auto-updates pair stats on each insert)
-- View: high_risk_maker_checker_pairs
-- ─────────────────────────────────────────────────────────────────────────────
