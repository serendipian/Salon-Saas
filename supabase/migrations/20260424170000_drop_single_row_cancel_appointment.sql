-- Drop the single-row cancel_appointment RPC.
--
-- Superseded by cancel_appointments_bulk(UUID[], TEXT, TEXT) in 20260424160000.
-- No client path calls the single-row variant anymore; it was kept around as
-- a safety net across the bulk-RPC switchover. Dropping now to keep the
-- surface area minimal — any future caller would misleadingly skip the
-- idempotency + atomicity guarantees that only the bulk RPC provides.

DROP FUNCTION IF EXISTS cancel_appointment(UUID, TEXT, TEXT);
