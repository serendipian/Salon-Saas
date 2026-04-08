-- Add payment_method column to expenses table
ALTER TABLE expenses ADD COLUMN payment_method text;

-- Add comment for clarity
COMMENT ON COLUMN expenses.payment_method IS 'Payment method used: especes, carte, virement, cheque, prelevement';
