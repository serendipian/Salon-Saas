CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_salon_id UUID;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_salon_id := OLD.salon_id;
    v_record_id := OLD.id;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_salon_id := NEW.salon_id;
    v_record_id := NEW.id;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_salon_id := NEW.salon_id;
    v_record_id := NEW.id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (salon_id, table_name, record_id, action, old_data, new_data, performed_by)
  VALUES (v_salon_id, TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, auth.uid());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to all business tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'salons',
    'salon_memberships',
    'clients',
    'service_categories',
    'services',
    'service_variants',
    'product_categories',
    'products',
    'suppliers',
    'staff_members',
    'appointments',
    'transactions',
    'transaction_items',
    'transaction_payments',
    'expense_categories',
    'expenses',
    'recurring_expenses'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger();',
      tbl, tbl
    );
  END LOOP;
END;
$$;
