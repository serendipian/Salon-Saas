-- Add CHECK constraints on appointments for data integrity
-- Status CHECK already exists from the original table definition

ALTER TABLE appointments
  ADD CONSTRAINT appointments_price_non_negative CHECK (price >= 0);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_duration_range CHECK (duration_minutes BETWEEN 5 AND 480);
