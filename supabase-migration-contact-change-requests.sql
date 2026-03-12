-- Migration: Create contact_change_requests table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.contact_change_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  requested_mobile TEXT,
  requested_email TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES public.app_users(id),
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by customer and status
CREATE INDEX IF NOT EXISTS idx_ccr_customer_status ON public.contact_change_requests(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_ccr_requested_at ON public.contact_change_requests(requested_at DESC);

-- RLS: allow all operations (adjust as needed for your security model)
ALTER TABLE public.contact_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.contact_change_requests FOR ALL USING (true) WITH CHECK (true);
