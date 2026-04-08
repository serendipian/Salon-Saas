-- Seed default supplier/beneficiary categories for existing salons that have none.
-- These cover the typical payee types for a beauty salon.
DO $$
DECLARE
  v_salon RECORD;
  v_defaults JSONB := '[
    {"name": "Produits & Fournitures", "color": "bg-blue-100 text-blue-800 border-blue-200"},
    {"name": "Charges fixes",          "color": "bg-amber-100 text-amber-800 border-amber-200"},
    {"name": "Prestataires",           "color": "bg-purple-100 text-purple-800 border-purple-200"},
    {"name": "Équipements",            "color": "bg-emerald-100 text-emerald-800 border-emerald-200"},
    {"name": "Services généraux",      "color": "bg-slate-100 text-slate-800 border-slate-200"},
    {"name": "Administration",         "color": "bg-rose-100 text-rose-800 border-rose-200"}
  ]';
  v_cat JSONB;
  v_sort INT;
BEGIN
  FOR v_salon IN
    SELECT s.id FROM salons s
    WHERE NOT EXISTS (
      SELECT 1 FROM supplier_categories sc
      WHERE sc.salon_id = s.id AND sc.deleted_at IS NULL
    )
  LOOP
    v_sort := 0;
    FOR v_cat IN SELECT * FROM jsonb_array_elements(v_defaults)
    LOOP
      INSERT INTO supplier_categories (id, salon_id, name, color, sort_order)
      VALUES (gen_random_uuid(), v_salon.id, v_cat->>'name', v_cat->>'color', v_sort);
      v_sort := v_sort + 1;
    END LOOP;
  END LOOP;
END;
$$;
