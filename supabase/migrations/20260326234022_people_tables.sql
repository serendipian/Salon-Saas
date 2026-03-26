-- staff_members
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES salon_memberships(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  color TEXT,
  photo_url TEXT,
  bio TEXT,
  skills UUID[],
  active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  contract_type TEXT CHECK (contract_type IS NULL OR contract_type IN ('CDI', 'CDD', 'Freelance', 'Apprentissage', 'Stage')),
  weekly_hours NUMERIC(4,1),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  base_salary NUMERIC(10,2),
  bonus_tiers JSONB,
  iban TEXT,
  social_security_number TEXT,
  birth_date DATE,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone TEXT,
  schedule JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER staff_members_updated_at
  BEFORE UPDATE ON staff_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IS NULL OR gender IN ('Homme', 'Femme')),
  age_group TEXT,
  city TEXT,
  profession TEXT,
  company TEXT,
  notes TEXT,
  photo_url TEXT,
  allergies TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIF'
    CHECK (status IN ('ACTIF', 'VIP', 'INACTIF')),
  preferred_staff_id UUID REFERENCES staff_members(id),
  email TEXT,
  phone TEXT,
  instagram TEXT,
  whatsapp TEXT,
  social_network TEXT,
  social_username TEXT,
  preferred_channel TEXT,
  other_channel_detail TEXT,
  preferred_language TEXT,
  contact_date DATE,
  contact_method TEXT,
  message_channel TEXT,
  acquisition_source TEXT,
  acquisition_detail TEXT,
  permissions_social_media BOOLEAN NOT NULL DEFAULT false,
  permissions_marketing BOOLEAN NOT NULL DEFAULT false,
  permissions_other BOOLEAN NOT NULL DEFAULT false,
  permissions_other_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
