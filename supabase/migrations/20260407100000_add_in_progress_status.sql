-- Add IN_PROGRESS to appointment status CHECK constraints
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'));

ALTER TABLE appointment_groups DROP CONSTRAINT IF EXISTS appointment_groups_status_check;
ALTER TABLE appointment_groups ADD CONSTRAINT appointment_groups_status_check
  CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'));
