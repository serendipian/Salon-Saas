CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  service_id UUID REFERENCES services(id),
  service_variant_id UUID REFERENCES service_variants(id),
  staff_id UUID REFERENCES staff_members(id),
  date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Immutable helper for exclusion constraint (Postgres requires IMMUTABLE in index expressions)
CREATE OR REPLACE FUNCTION appointment_range(start_at TIMESTAMPTZ, dur_min INTEGER)
RETURNS tstzrange
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT tstzrange(start_at, start_at + make_interval(mins => dur_min));
$$;

ALTER TABLE appointments
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    staff_id WITH =,
    appointment_range(date, duration_minutes) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED'));
