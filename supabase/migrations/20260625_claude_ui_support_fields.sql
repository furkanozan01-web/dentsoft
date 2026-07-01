-- Migration: Claude UI support fields
-- Date: 2026-06-25
-- Additive only. No existing rows are deleted or rewritten.

-- Doctors: payment model, diploma and working-hours fields used by Settings/Finance UI.
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS diploma_no TEXT,
  ADD COLUMN IF NOT EXISTS payment_model TEXT,
  ADD COLUMN IF NOT EXISTS monthly_salary INTEGER,
  ADD COLUMN IF NOT EXISTS commission_rate_bps INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_hours_json JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Transactions: expense metadata and doctor-payment bookkeeping.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS recurring TEXT,
  ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES doctors(id),
  ADD COLUMN IF NOT EXISTS payment_type TEXT;

-- Treatments: optional cost field for net hakediş calculations.
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 0;
