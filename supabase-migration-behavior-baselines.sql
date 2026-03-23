-- ─────────────────────────────────────────────────────────────────────────────
-- BankGuard AI: Behavioral Baseline ML Tables — Full Migration
-- Run this entire script in your Supabase SQL Editor (safe to re-run)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. behavior_baselines ─────────────────────────────────────────────────────
--    One row per employee — stores their statistical behavioral baseline.
--    Re-computed from activity_logs on demand; cached here for fast reads.

CREATE TABLE IF NOT EXISTS behavior_baselines (
  user_id                    TEXT        PRIMARY KEY,
  login_hour_mean            NUMERIC     NOT NULL DEFAULT 9,
  login_hour_std             NUMERIC     NOT NULL DEFAULT 2,
  customers_per_session_mean NUMERIC     NOT NULL DEFAULT 3,
  customers_per_session_std  NUMERIC     NOT NULL DEFAULT 2,
  txn_per_session_mean       NUMERIC     NOT NULL DEFAULT 2,
  txn_per_session_std        NUMERIC     NOT NULL DEFAULT 1.5,
  reports_per_session_mean   NUMERIC     NOT NULL DEFAULT 0.5,
  reports_per_session_std    NUMERIC     NOT NULL DEFAULT 0.5,
  contact_mods_mean          NUMERIC     NOT NULL DEFAULT 0,
  contact_mods_std           NUMERIC     NOT NULL DEFAULT 0.1,
  off_hours_rate             NUMERIC     NOT NULL DEFAULT 0.02,
  known_ip_rate              NUMERIC     NOT NULL DEFAULT 0.95,
  bulk_download_mean         NUMERIC     NOT NULL DEFAULT 50,
  bulk_download_std          NUMERIC     NOT NULL DEFAULT 30,
  sample_count               INTEGER     NOT NULL DEFAULT 0,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE behavior_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for behavior_baselines" ON behavior_baselines;
CREATE POLICY "Allow all for behavior_baselines"
  ON behavior_baselines FOR ALL USING (true) WITH CHECK (true);


-- ── 2. behavior_snapshots ─────────────────────────────────────────────────────
--    Time-series anomaly scores captured each time a user session is analysed.
--    Used to render deviation charts and identify escalating patterns.

CREATE TABLE IF NOT EXISTS behavior_snapshots (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           TEXT        NOT NULL,
  anomaly_score     NUMERIC     NOT NULL DEFAULT 0,
  risk_tier         TEXT        NOT NULL DEFAULT 'Normal',
  triggered_rules   TEXT[]      NOT NULL DEFAULT '{}',
  deviation_details JSONB       NOT NULL DEFAULT '[]',
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bs_user_id     ON behavior_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_bs_captured_at ON behavior_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_bs_score       ON behavior_snapshots(anomaly_score DESC);

ALTER TABLE behavior_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for behavior_snapshots" ON behavior_snapshots;
CREATE POLICY "Allow all for behavior_snapshots"
  ON behavior_snapshots FOR ALL USING (true) WITH CHECK (true);


-- ── 3. behavior_alerts ────────────────────────────────────────────────────────
--    Fires when a session's anomaly score breaches a configured threshold.
--    Separate table to avoid cluttering the main alerts feed with ML signals
--    (they are also injected into the main alerts table via the app).

CREATE TABLE IF NOT EXISTS behavior_alerts (
  id              TEXT        PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  user_name       TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT '',
  anomaly_score   NUMERIC     NOT NULL DEFAULT 0,
  risk_tier       TEXT        NOT NULL DEFAULT 'Normal',
  triggered_rules TEXT[]      NOT NULL DEFAULT '{}',
  summary         TEXT        NOT NULL DEFAULT '',
  status          TEXT        NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ba_user_id   ON behavior_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_ba_score     ON behavior_alerts(anomaly_score DESC);
CREATE INDEX IF NOT EXISTS idx_ba_status    ON behavior_alerts(status);

ALTER TABLE behavior_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for behavior_alerts" ON behavior_alerts;
CREATE POLICY "Allow all for behavior_alerts"
  ON behavior_alerts FOR ALL USING (true) WITH CHECK (true);


-- ── 4. View: escalating users (3+ consecutive anomalous snapshots) ────────────

CREATE OR REPLACE VIEW escalating_behavior_users AS
WITH recent AS (
  SELECT
    user_id,
    anomaly_score,
    risk_tier,
    captured_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY captured_at DESC) AS rn
  FROM behavior_snapshots
),
last3 AS (
  SELECT user_id, COUNT(*) AS anomalous_sessions, MAX(anomaly_score) AS peak_score
  FROM recent
  WHERE rn <= 3 AND risk_tier IN ('Anomalous', 'Severe')
  GROUP BY user_id
)
SELECT l.*, b.login_hour_mean, b.customers_per_session_mean, b.sample_count
FROM last3 l
LEFT JOIN behavior_baselines b ON b.user_id = l.user_id
WHERE l.anomalous_sessions >= 2
ORDER BY l.peak_score DESC;


-- ── 5. Seed realistic baselines for all employees ─────────────────────────────
--    These represent "normal" historical behaviour. The app will refine them
--    from real activity_logs when enough sessions accumulate (≥ 5 sessions).

INSERT INTO behavior_baselines (
  user_id,
  login_hour_mean, login_hour_std,
  customers_per_session_mean, customers_per_session_std,
  txn_per_session_mean, txn_per_session_std,
  reports_per_session_mean, reports_per_session_std,
  contact_mods_mean, contact_mods_std,
  off_hours_rate, known_ip_rate,
  bulk_download_mean, bulk_download_std,
  sample_count, updated_at
) VALUES
  -- Admin: logs in at ~9:00, touches many customers, runs frequent reports
  ('ADMIN001', 9.2, 0.8, 12.5, 3.2, 0.5, 0.5, 2.1, 0.7, 0.1, 0.1, 0.01, 0.99, 320, 80, 45, NOW()),

  -- Sneha Patel (Teller): regular 9–5, touches 6–10 customers per session
  ('USR001',   9.1, 0.7,  7.3, 2.1, 3.5, 1.2, 0.2, 0.4, 0.9, 0.3, 0.00, 0.97, 30, 15, 38, NOW()),

  -- Rohit Mehta (Loan Officer): typically 9–6, 5 customers/session, 1–2 reports
  ('USR002',   9.5, 1.0,  5.1, 1.8, 1.2, 0.8, 1.1, 0.5, 0.1, 0.1, 0.02, 0.96, 80, 25, 52, NOW()),

  -- Rajiv Sharma (Branch Manager): starts earlier ~8:30, more customers, approves loans
  ('USR006',   8.4, 0.9, 14.2, 4.0, 2.1, 1.0, 0.8, 0.4, 0.2, 0.2, 0.03, 0.98, 120, 40, 61, NOW()),

  -- Priya Iyer (Treasury): 9–5, few customers (treasury focus), bigger report exports
  ('USR003',   9.3, 0.6,  2.2, 1.0, 4.1, 1.5, 1.5, 0.6, 0.0, 0.1, 0.01, 0.98, 450, 90, 44, NOW()),

  -- Arjun Sharma (DB Admin): sometimes works off-hours, bulk downloads common
  ('USR004',   9.8, 1.8,  8.0, 2.5, 0.1, 0.3, 3.2, 1.0, 0.0, 0.1, 0.12, 0.90, 800, 200, 33, NOW()),

  -- Kavita Nair (Compliance): standard hours, reviews many customers, no transactions
  ('USR005',  10.1, 0.8, 18.5, 5.2, 0.0, 0.2, 2.8, 0.8, 0.3, 0.3, 0.00, 0.99, 180, 50, 27, NOW())

ON CONFLICT (user_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Done.
-- Tables : behavior_baselines · behavior_snapshots · behavior_alerts
-- View   : escalating_behavior_users
-- Seeds  : realistic baselines for all 7 employees
-- ─────────────────────────────────────────────────────────────────────────────
