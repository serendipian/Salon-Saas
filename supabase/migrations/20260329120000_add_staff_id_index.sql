-- Add index on staff_id for transaction_items (FK scan performance)
CREATE INDEX IF NOT EXISTS idx_transaction_items_staff_id ON transaction_items(staff_id);
