-- ============================================================
-- Plan 6: Appointment Groups (multi-service bookings)
-- ============================================================

-- 1. Create appointment_groups table
CREATE TABLE appointment_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  notes TEXT,
  reminder_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);

-- 2. Auto-update timestamp trigger
CREATE TRIGGER appointment_groups_updated_at
  BEFORE UPDATE ON appointment_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Audit log trigger (same pattern as other business tables)
CREATE TRIGGER appointment_groups_audit
  AFTER INSERT OR UPDATE OR DELETE ON appointment_groups
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- 4. Add group_id to appointments
ALTER TABLE appointments
  ADD COLUMN group_id UUID REFERENCES appointment_groups(id);

-- 5. RLS policies for appointment_groups
ALTER TABLE appointment_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointment_groups_select ON appointment_groups
  FOR SELECT USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
  );

CREATE POLICY appointment_groups_insert ON appointment_groups
  FOR INSERT WITH CHECK (
    salon_id = get_active_salon()
  );

CREATE POLICY appointment_groups_update ON appointment_groups
  FOR UPDATE USING (
    salon_id = get_active_salon()
    AND deleted_at IS NULL
  );

-- 6. Index for fast group lookups
CREATE INDEX idx_appointments_group_id ON appointments(group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX idx_appointment_groups_salon_id ON appointment_groups(salon_id)
  WHERE deleted_at IS NULL;
