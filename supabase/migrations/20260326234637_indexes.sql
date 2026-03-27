-- Salon-scoped partial indexes (excluding soft-deleted)
CREATE INDEX idx_clients_salon ON clients(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_service_categories_salon ON service_categories(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_salon ON services(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_service_variants_salon ON service_variants(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_categories_salon ON product_categories(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_salon ON products(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_salon ON suppliers(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_members_salon ON staff_members(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_salon ON appointments(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_salon ON transactions(salon_id);
CREATE INDEX idx_expense_categories_salon ON expense_categories(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_salon ON expenses(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_recurring_expenses_salon ON recurring_expenses(salon_id) WHERE deleted_at IS NULL;

-- Date-based queries
CREATE INDEX idx_transactions_salon_date ON transactions(salon_id, date DESC);
CREATE INDEX idx_appointments_salon_date ON appointments(salon_id, date);
CREATE INDEX idx_expenses_salon_date ON expenses(salon_id, date);

-- GiST for appointment range queries (uses immutable helper from scheduling migration)
CREATE INDEX idx_appointments_staff_date ON appointments
  USING gist(staff_id, appointment_range(date, duration_minutes));

-- Lookup patterns
CREATE INDEX idx_clients_salon_name ON clients(salon_id, last_name, first_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_profile ON salon_memberships(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_salon ON salon_memberships(salon_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invitations_token ON invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_transaction_items_txn ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_payments_txn ON transaction_payments(transaction_id);

-- Audit log
CREATE INDEX idx_audit_log_salon_time ON audit_log(salon_id, performed_at DESC);

-- Staff membership link (for RLS subqueries)
CREATE INDEX idx_staff_members_membership ON staff_members(membership_id) WHERE deleted_at IS NULL;
