-- ============================================================
-- MIGRATION: Replace session-variable RLS with membership-based RLS
-- ============================================================
-- Problem: get_active_salon() / get_user_role() use set_config() session
-- variables that don't persist across Supabase's pooled connections.
-- Fix: Query salon_memberships directly using auth.uid() (from JWT, always available).
-- ============================================================

-- ============================================================
-- STEP 1: Helper functions
-- ============================================================

-- Returns all salon IDs where the current user is an active member
CREATE OR REPLACE FUNCTION user_salon_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT salon_id FROM salon_memberships
  WHERE profile_id = auth.uid()
    AND deleted_at IS NULL
    AND status = 'active';
$$;

-- Returns salon IDs where user has one of the specified roles
CREATE OR REPLACE FUNCTION user_salon_ids_with_role(allowed_roles text[])
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT salon_id FROM salon_memberships
  WHERE profile_id = auth.uid()
    AND deleted_at IS NULL
    AND status = 'active'
    AND role = ANY(allowed_roles);
$$;

-- Returns the user's role in a specific salon (or NULL)
CREATE OR REPLACE FUNCTION user_role_in_salon(p_salon_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM salon_memberships
  WHERE profile_id = auth.uid()
    AND salon_id = p_salon_id
    AND deleted_at IS NULL
    AND status = 'active'
  LIMIT 1;
$$;

-- Returns the user's staff_members.id in a specific salon (or NULL)
CREATE OR REPLACE FUNCTION user_staff_id_in_salon(p_salon_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT sm.id FROM staff_members sm
  INNER JOIN salon_memberships m ON m.id = sm.membership_id
  WHERE m.profile_id = auth.uid()
    AND m.salon_id = p_salon_id
    AND m.deleted_at IS NULL
    AND m.status = 'active'
    AND sm.deleted_at IS NULL
  LIMIT 1;
$$;

-- ============================================================
-- STEP 2: Drop ALL existing RLS policies
-- ============================================================

-- profiles
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;

-- plans
DROP POLICY IF EXISTS plans_select ON plans;

-- salons
DROP POLICY IF EXISTS salons_select ON salons;
DROP POLICY IF EXISTS salons_insert ON salons;
DROP POLICY IF EXISTS salons_update ON salons;

-- salon_memberships
DROP POLICY IF EXISTS memberships_select ON salon_memberships;
DROP POLICY IF EXISTS memberships_own ON salon_memberships;
DROP POLICY IF EXISTS memberships_modify ON salon_memberships;

-- invitations
DROP POLICY IF EXISTS invitations_manage ON invitations;
DROP POLICY IF EXISTS invitations_by_token ON invitations;

-- service_categories
DROP POLICY IF EXISTS service_categories_select ON service_categories;
DROP POLICY IF EXISTS service_categories_insert ON service_categories;
DROP POLICY IF EXISTS service_categories_update ON service_categories;
DROP POLICY IF EXISTS service_categories_delete ON service_categories;

-- services
DROP POLICY IF EXISTS services_select ON services;
DROP POLICY IF EXISTS services_insert ON services;
DROP POLICY IF EXISTS services_update ON services;
DROP POLICY IF EXISTS services_delete ON services;

-- service_variants
DROP POLICY IF EXISTS service_variants_select ON service_variants;
DROP POLICY IF EXISTS service_variants_insert ON service_variants;
DROP POLICY IF EXISTS service_variants_update ON service_variants;
DROP POLICY IF EXISTS service_variants_delete ON service_variants;

-- product_categories
DROP POLICY IF EXISTS product_categories_select ON product_categories;
DROP POLICY IF EXISTS product_categories_insert ON product_categories;
DROP POLICY IF EXISTS product_categories_update ON product_categories;
DROP POLICY IF EXISTS product_categories_delete ON product_categories;

-- products
DROP POLICY IF EXISTS products_select ON products;
DROP POLICY IF EXISTS products_insert ON products;
DROP POLICY IF EXISTS products_update ON products;
DROP POLICY IF EXISTS products_delete ON products;

-- suppliers
DROP POLICY IF EXISTS suppliers_select ON suppliers;
DROP POLICY IF EXISTS suppliers_insert ON suppliers;
DROP POLICY IF EXISTS suppliers_update ON suppliers;
DROP POLICY IF EXISTS suppliers_delete ON suppliers;

-- staff_members
DROP POLICY IF EXISTS staff_members_select ON staff_members;
DROP POLICY IF EXISTS staff_members_insert ON staff_members;
DROP POLICY IF EXISTS staff_members_update ON staff_members;
DROP POLICY IF EXISTS staff_members_delete ON staff_members;

-- appointments
DROP POLICY IF EXISTS appointments_select ON appointments;
DROP POLICY IF EXISTS appointments_insert ON appointments;
DROP POLICY IF EXISTS appointments_update ON appointments;
DROP POLICY IF EXISTS appointments_delete ON appointments;

-- clients
DROP POLICY IF EXISTS clients_select ON clients;
DROP POLICY IF EXISTS clients_insert ON clients;
DROP POLICY IF EXISTS clients_update ON clients;
DROP POLICY IF EXISTS clients_delete ON clients;

-- transactions
DROP POLICY IF EXISTS transactions_select ON transactions;
DROP POLICY IF EXISTS transactions_insert ON transactions;

-- transaction_items
DROP POLICY IF EXISTS transaction_items_select ON transaction_items;
DROP POLICY IF EXISTS transaction_items_insert ON transaction_items;

-- transaction_payments
DROP POLICY IF EXISTS transaction_payments_select ON transaction_payments;
DROP POLICY IF EXISTS transaction_payments_insert ON transaction_payments;

-- expense_categories
DROP POLICY IF EXISTS expense_categories_select ON expense_categories;
DROP POLICY IF EXISTS expense_categories_insert ON expense_categories;
DROP POLICY IF EXISTS expense_categories_update ON expense_categories;
DROP POLICY IF EXISTS expense_categories_delete ON expense_categories;

-- expenses
DROP POLICY IF EXISTS expenses_select ON expenses;
DROP POLICY IF EXISTS expenses_insert ON expenses;
DROP POLICY IF EXISTS expenses_update ON expenses;
DROP POLICY IF EXISTS expenses_delete ON expenses;

-- recurring_expenses
DROP POLICY IF EXISTS recurring_expenses_select ON recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_insert ON recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_update ON recurring_expenses;
DROP POLICY IF EXISTS recurring_expenses_delete ON recurring_expenses;

-- audit_log
DROP POLICY IF EXISTS audit_log_select ON audit_log;

-- ============================================================
-- STEP 3: Recreate ALL policies using membership-based checks
-- ============================================================

-- PROFILES (unchanged — uses auth.uid() directly)
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (id = auth.uid());

-- PLANS (unchanged — any authenticated user)
CREATE POLICY plans_select ON plans FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- SALONS
CREATE POLICY salons_select ON salons FOR SELECT
  USING (id IN (SELECT user_salon_ids()));
CREATE POLICY salons_insert ON salons FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY salons_update ON salons FOR UPDATE
  USING (id IN (SELECT user_salon_ids_with_role(ARRAY['owner'])));

-- SALON_MEMBERSHIPS
-- Any member can see other members of their salons
CREATE POLICY memberships_select ON salon_memberships FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      salon_id IN (SELECT user_salon_ids())
      OR profile_id = auth.uid()
    )
  );
-- Own memberships always visible (needed for auth bootstrapping)
CREATE POLICY memberships_own ON salon_memberships FOR SELECT
  USING (profile_id = auth.uid());
-- Only owner/manager can modify memberships
CREATE POLICY memberships_modify ON salon_memberships FOR ALL
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- INVITATIONS
CREATE POLICY invitations_manage ON invitations FOR ALL
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY invitations_by_token ON invitations FOR SELECT
  USING (auth.uid() IS NOT NULL AND accepted_at IS NULL);

-- SERVICE_CATEGORIES (Pattern 1: all members read, owner/manager write)
CREATE POLICY service_categories_select ON service_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY service_categories_insert ON service_categories FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY service_categories_update ON service_categories FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY service_categories_delete ON service_categories FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- SERVICES
CREATE POLICY services_select ON services FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY services_insert ON services FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY services_update ON services FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY services_delete ON services FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- SERVICE_VARIANTS
CREATE POLICY service_variants_select ON service_variants FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY service_variants_insert ON service_variants FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY service_variants_update ON service_variants FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY service_variants_delete ON service_variants FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- PRODUCT_CATEGORIES
CREATE POLICY product_categories_select ON product_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY product_categories_insert ON product_categories FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY product_categories_update ON product_categories FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY product_categories_delete ON product_categories FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- PRODUCTS
CREATE POLICY products_select ON products FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids()) AND deleted_at IS NULL);
CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY products_update ON products FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY products_delete ON products FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- SUPPLIERS (Pattern 2: owner/manager only for everything)
CREATE POLICY suppliers_select ON suppliers FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) AND deleted_at IS NULL);
CREATE POLICY suppliers_insert ON suppliers FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY suppliers_update ON suppliers FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY suppliers_delete ON suppliers FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- STAFF_MEMBERS (Pattern 4: owner/manager sees all, others see own profile)
CREATE POLICY staff_members_select ON staff_members FOR SELECT
  USING (
    deleted_at IS NULL AND (
      salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
      OR id = user_staff_id_in_salon(salon_id)
    )
  );
CREATE POLICY staff_members_insert ON staff_members FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY staff_members_update ON staff_members FOR UPDATE
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager']))
    OR id = user_staff_id_in_salon(salon_id)
  );
CREATE POLICY staff_members_delete ON staff_members FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- APPOINTMENTS (Pattern 3: stylist sees own only)
CREATE POLICY appointments_select ON appointments FOR SELECT
  USING (
    deleted_at IS NULL AND (
      salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
      OR (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['stylist']))
          AND staff_id = user_staff_id_in_salon(salon_id))
    )
  );
CREATE POLICY appointments_insert ON appointments FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])));
CREATE POLICY appointments_update ON appointments FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])));
CREATE POLICY appointments_delete ON appointments FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- CLIENTS (Pattern 3: stylist sees linked clients)
CREATE POLICY clients_select ON clients FOR SELECT
  USING (
    deleted_at IS NULL AND (
      salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
      OR (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['stylist']))
          AND id IN (
            SELECT DISTINCT a.client_id FROM appointments a
            WHERE a.staff_id = user_staff_id_in_salon(a.salon_id)
              AND a.salon_id = clients.salon_id
              AND a.deleted_at IS NULL
          ))
    )
  );
CREATE POLICY clients_insert ON clients FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])));
CREATE POLICY clients_update ON clients FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist'])));
CREATE POLICY clients_delete ON clients FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- TRANSACTIONS (immutable, stylist sees own)
CREATE POLICY transactions_select ON transactions FOR SELECT
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
    OR (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['stylist']))
        AND created_by = auth.uid())
  );
CREATE POLICY transactions_insert ON transactions FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids()));

-- TRANSACTION_ITEMS
CREATE POLICY transaction_items_select ON transaction_items FOR SELECT
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
    OR (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['stylist']))
        AND transaction_id IN (
          SELECT id FROM transactions
          WHERE created_by = auth.uid() AND salon_id = transaction_items.salon_id
        ))
  );
CREATE POLICY transaction_items_insert ON transaction_items FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids()));

-- TRANSACTION_PAYMENTS
CREATE POLICY transaction_payments_select ON transaction_payments FOR SELECT
  USING (
    salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager', 'receptionist']))
    OR (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['stylist']))
        AND transaction_id IN (
          SELECT id FROM transactions
          WHERE created_by = auth.uid() AND salon_id = transaction_payments.salon_id
        ))
  );
CREATE POLICY transaction_payments_insert ON transaction_payments FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids()));

-- EXPENSE_CATEGORIES (Pattern 2: owner/manager only)
CREATE POLICY expense_categories_select ON expense_categories FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) AND deleted_at IS NULL);
CREATE POLICY expense_categories_insert ON expense_categories FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY expense_categories_update ON expense_categories FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY expense_categories_delete ON expense_categories FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- EXPENSES (Pattern 2)
CREATE POLICY expenses_select ON expenses FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) AND deleted_at IS NULL);
CREATE POLICY expenses_insert ON expenses FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY expenses_update ON expenses FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY expenses_delete ON expenses FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- RECURRING_EXPENSES (Pattern 2)
CREATE POLICY recurring_expenses_select ON recurring_expenses FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])) AND deleted_at IS NULL);
CREATE POLICY recurring_expenses_insert ON recurring_expenses FOR INSERT
  WITH CHECK (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY recurring_expenses_update ON recurring_expenses FOR UPDATE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));
CREATE POLICY recurring_expenses_delete ON recurring_expenses FOR DELETE
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- AUDIT_LOG (owner/manager read-only)
CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (salon_id IN (SELECT user_salon_ids_with_role(ARRAY['owner', 'manager'])));

-- ============================================================
-- STEP 4: Clean up debug function (if exists)
-- ============================================================
DROP FUNCTION IF EXISTS debug_auth(UUID, JSONB, JSONB);
