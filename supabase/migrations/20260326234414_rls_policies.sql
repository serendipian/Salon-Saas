-- Enable RLS on every table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY profiles_select ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());

-- PLANS
CREATE POLICY plans_select ON plans FOR SELECT USING (auth.uid() IS NOT NULL);

-- SALONS
CREATE POLICY salons_select ON salons FOR SELECT USING (
  id IN (SELECT salon_id FROM salon_memberships WHERE profile_id = auth.uid() AND deleted_at IS NULL AND status = 'active')
);
CREATE POLICY salons_insert ON salons FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY salons_update ON salons FOR UPDATE USING (id = get_active_salon() AND get_user_role() = 'owner');

-- SALON_MEMBERSHIPS
CREATE POLICY memberships_select ON salon_memberships FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL);
CREATE POLICY memberships_own ON salon_memberships FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY memberships_modify ON salon_memberships FOR ALL USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- INVITATIONS
CREATE POLICY invitations_manage ON invitations FOR ALL USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY invitations_by_token ON invitations FOR SELECT USING (auth.uid() IS NOT NULL AND accepted_at IS NULL);

-- SERVICE_CATEGORIES (Pattern 1: all read, owner/manager write)
CREATE POLICY service_categories_select ON service_categories FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL);
CREATE POLICY service_categories_insert ON service_categories FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY service_categories_update ON service_categories FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY service_categories_delete ON service_categories FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- SERVICES
CREATE POLICY services_select ON services FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL);
CREATE POLICY services_insert ON services FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY services_update ON services FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY services_delete ON services FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- SERVICE_VARIANTS
CREATE POLICY service_variants_select ON service_variants FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL);
CREATE POLICY service_variants_insert ON service_variants FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY service_variants_update ON service_variants FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY service_variants_delete ON service_variants FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- PRODUCT_CATEGORIES
CREATE POLICY product_categories_select ON product_categories FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL);
CREATE POLICY product_categories_insert ON product_categories FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY product_categories_update ON product_categories FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY product_categories_delete ON product_categories FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- PRODUCTS
CREATE POLICY products_select ON products FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL);
CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY products_update ON products FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY products_delete ON products FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- SUPPLIERS (Pattern 2: owner/manager only)
CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY suppliers_insert ON suppliers FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY suppliers_update ON suppliers FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY suppliers_delete ON suppliers FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- EXPENSE_CATEGORIES (Pattern 2)
CREATE POLICY expense_categories_select ON expense_categories FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY expense_categories_insert ON expense_categories FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY expense_categories_update ON expense_categories FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY expense_categories_delete ON expense_categories FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- EXPENSES (Pattern 2)
CREATE POLICY expenses_select ON expenses FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY expenses_insert ON expenses FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY expenses_update ON expenses FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY expenses_delete ON expenses FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- RECURRING_EXPENSES (Pattern 2)
CREATE POLICY recurring_expenses_select ON recurring_expenses FOR SELECT USING (salon_id = get_active_salon() AND deleted_at IS NULL AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY recurring_expenses_insert ON recurring_expenses FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY recurring_expenses_update ON recurring_expenses FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY recurring_expenses_delete ON recurring_expenses FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- APPOINTMENTS (Pattern 3: stylist sees own only)
CREATE POLICY appointments_select ON appointments FOR SELECT USING (
  salon_id = get_active_salon() AND deleted_at IS NULL AND (
    get_user_role() IN ('owner', 'manager', 'receptionist')
    OR (get_user_role() = 'stylist' AND staff_id = (
      SELECT sm.id FROM staff_members sm
      INNER JOIN salon_memberships m ON m.id = sm.membership_id
      WHERE m.profile_id = auth.uid() AND m.salon_id = get_active_salon()
      LIMIT 1
    ))
  )
);
CREATE POLICY appointments_insert ON appointments FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager', 'receptionist'));
CREATE POLICY appointments_update ON appointments FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager', 'receptionist'));
CREATE POLICY appointments_delete ON appointments FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- CLIENTS (Pattern 3: stylist sees linked clients)
CREATE POLICY clients_select ON clients FOR SELECT USING (
  salon_id = get_active_salon() AND deleted_at IS NULL AND (
    get_user_role() IN ('owner', 'manager', 'receptionist')
    OR (get_user_role() = 'stylist' AND id IN (
      SELECT DISTINCT a.client_id FROM appointments a
      WHERE a.staff_id = (
        SELECT sm.id FROM staff_members sm
        INNER JOIN salon_memberships m ON m.id = sm.membership_id
        WHERE m.profile_id = auth.uid() AND m.salon_id = get_active_salon()
        LIMIT 1
      )
    ))
  )
);
CREATE POLICY clients_insert ON clients FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager', 'receptionist'));
CREATE POLICY clients_update ON clients FOR UPDATE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager', 'receptionist'));
CREATE POLICY clients_delete ON clients FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- STAFF_MEMBERS (Pattern 4: own profile)
CREATE POLICY staff_members_select ON staff_members FOR SELECT USING (
  salon_id = get_active_salon() AND deleted_at IS NULL AND (
    get_user_role() IN ('owner', 'manager')
    OR membership_id = (
      SELECT id FROM salon_memberships
      WHERE profile_id = auth.uid() AND salon_id = get_active_salon()
      LIMIT 1
    )
  )
);
CREATE POLICY staff_members_insert ON staff_members FOR INSERT WITH CHECK (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
CREATE POLICY staff_members_update ON staff_members FOR UPDATE USING (
  salon_id = get_active_salon() AND (
    get_user_role() IN ('owner', 'manager')
    OR membership_id = (
      SELECT id FROM salon_memberships
      WHERE profile_id = auth.uid() AND salon_id = get_active_salon()
      LIMIT 1
    )
  )
);
CREATE POLICY staff_members_delete ON staff_members FOR DELETE USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));

-- TRANSACTIONS (immutable, stylist sees own)
CREATE POLICY transactions_select ON transactions FOR SELECT USING (
  salon_id = get_active_salon() AND (
    get_user_role() IN ('owner', 'manager', 'receptionist')
    OR (get_user_role() = 'stylist' AND created_by = auth.uid())
  )
);
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (salon_id = get_active_salon());

-- TRANSACTION_ITEMS
CREATE POLICY transaction_items_select ON transaction_items FOR SELECT USING (
  salon_id = get_active_salon() AND transaction_id IN (
    SELECT id FROM transactions WHERE salon_id = get_active_salon() AND (
      get_user_role() IN ('owner', 'manager', 'receptionist')
      OR (get_user_role() = 'stylist' AND created_by = auth.uid())
    )
  )
);
CREATE POLICY transaction_items_insert ON transaction_items FOR INSERT WITH CHECK (salon_id = get_active_salon());

-- TRANSACTION_PAYMENTS
CREATE POLICY transaction_payments_select ON transaction_payments FOR SELECT USING (
  salon_id = get_active_salon() AND transaction_id IN (
    SELECT id FROM transactions WHERE salon_id = get_active_salon() AND (
      get_user_role() IN ('owner', 'manager', 'receptionist')
      OR (get_user_role() = 'stylist' AND created_by = auth.uid())
    )
  )
);
CREATE POLICY transaction_payments_insert ON transaction_payments FOR INSERT WITH CHECK (salon_id = get_active_salon());

-- AUDIT_LOG (owner/manager read-only)
CREATE POLICY audit_log_select ON audit_log FOR SELECT USING (salon_id = get_active_salon() AND get_user_role() IN ('owner', 'manager'));
