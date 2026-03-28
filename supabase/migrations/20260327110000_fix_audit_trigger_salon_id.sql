-- Fix: audit_trigger() crashes on tables without salon_id column (e.g. salons)
-- Use TG_TABLE_NAME to determine how to extract salon_id.

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS trigger AS $$
DECLARE
  v_salon_id UUID;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
  v_row JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_old := v_row;
    v_new := NULL;
  ELSE
    v_row := to_jsonb(NEW);
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    v_new := v_row;
  END IF;

  v_record_id := (v_row->>'id')::UUID;

  -- salons table uses its own id as the salon_id
  IF TG_TABLE_NAME = 'salons' THEN
    v_salon_id := v_record_id;
  ELSE
    v_salon_id := (v_row->>'salon_id')::UUID;
  END IF;

  INSERT INTO audit_log (salon_id, table_name, record_id, action, old_data, new_data, performed_by)
  VALUES (v_salon_id, TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, auth.uid());

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
