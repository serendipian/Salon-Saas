-- Staff payouts table for tracking salary, commission, and bonus payments
CREATE TABLE staff_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SALARY', 'COMMISSION', 'BONUS', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  amount NUMERIC(10,2) NOT NULL,
  reference_amount NUMERIC(10,2),
  rate_snapshot NUMERIC(5,2),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_staff_payouts_salon_staff ON staff_payouts(salon_id, staff_id);
CREATE INDEX idx_staff_payouts_period ON staff_payouts(salon_id, staff_id, period_start, period_end);

-- Auto-update updated_at trigger
CREATE TRIGGER staff_payouts_updated_at
  BEFORE UPDATE ON staff_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE staff_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_payouts_select" ON staff_payouts
  FOR SELECT USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );

CREATE POLICY "staff_payouts_insert" ON staff_payouts
  FOR INSERT WITH CHECK (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );

CREATE POLICY "staff_payouts_update" ON staff_payouts
  FOR UPDATE USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
  );
