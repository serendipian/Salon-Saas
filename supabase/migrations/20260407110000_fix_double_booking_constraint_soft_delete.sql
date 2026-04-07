-- Fix: exclusion constraint must ignore soft-deleted appointments.
-- Without this, editing an appointment (delete-then-recreate) fails when the
-- new time range overlaps the old soft-deleted record.

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS no_double_booking;

ALTER TABLE appointments
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    staff_id WITH =,
    appointment_range(date, duration_minutes) WITH &&
  )
  WHERE (status NOT IN ('CANCELLED') AND deleted_at IS NULL);
