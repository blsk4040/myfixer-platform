CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE booking_status AS ENUM ('PENDING', 'SCHEDULED', 'ACCEPTED', 'IN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'currency_code') THEN
    CREATE TYPE currency_code AS ENUM ('ZAR', 'GHS');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('UNPAID', 'PAID', 'REFUNDED');
  END IF;
END $$;

-- 👤 USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  phone_number VARCHAR(32) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE, -- Added for automated invoice mailings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 🛠️ TECHNICIAN PROFILES TABLE
CREATE TABLE IF NOT EXISTS technician_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  last_location GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 📅 MULTI-VERTICAL FLEXIBLE BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Flexible Service Matrix Mapping matching frontend parameters
  category_id VARCHAR(50) NOT NULL,       -- e.g., 'cleaning', 'mechanic', 'appliances'
  sub_category_name VARCHAR(150) NOT NULL, -- e.g., 'Solar Panel Cleaning'
  description TEXT NOT NULL,               -- Detailed customer fault input
  
  customer_location GEOMETRY(Point, 4326) NOT NULL,
  address_text TEXT NOT NULL,              -- Human readable printed address
  
  base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
  currency currency_code NOT NULL DEFAULT 'ZAR',
  status booking_status NOT NULL DEFAULT 'PENDING',
  
  -- Structured schemaless attributes placeholder (Captures brand, vehicle model, voltage layout seamlessly)
  metadata JSONB DEFAULT '{}'::jsonb,      
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT bookings_customer_technician_distinct_check
    CHECK (technician_id IS NULL OR technician_id <> customer_id)
);

-- 🧾 INVOICES MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number SERIAL UNIQUE,            -- Sequential number required for SA tax compliance
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  technician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  base_amount NUMERIC(12, 2) NOT NULL CHECK (base_amount >= 0),
  additional_labor NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (additional_labor >= 0),
  parts_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (parts_amount >= 0),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  
  status invoice_status NOT NULL DEFAULT 'UNPAID',
  pdf_url TEXT,                            -- Cloud storage path reference if generated
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- 💳 DIGITAL WALLET BALANCES (For Outbound Payout Settlements)
CREATE TABLE IF NOT EXISTS technician_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  available_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== PROCEDURAL RIGID SAFETY TRIGGERS ====================

CREATE OR REPLACE FUNCTION ensure_user_role(
  target_user_id UUID,
  expected_role user_role,
  column_name TEXT
)
RETURNS VOID AS $$
DECLARE
  actual_role user_role;
BEGIN
  SELECT role INTO actual_role FROM users WHERE id = target_user_id;
  IF actual_role IS NULL THEN
    RAISE EXCEPTION '% references an unknown user id: %', column_name, target_user_id;
  END IF;
  IF actual_role <> expected_role THEN
    RAISE EXCEPTION '% must reference a % user, but referenced user is %', column_name, expected_role, actual_role;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_technician_profile_user_role()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_user_role(NEW.user_id, 'TECHNICIAN', 'technician_profiles.user_id');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_booking_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_user_role(NEW.customer_id, 'CUSTOMER', 'bookings.customer_id');
  IF NEW.technician_id IS NOT NULL THEN
    PERFORM ensure_user_role(NEW.technician_id, 'TECHNICIAN', 'bookings.technician_id');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_technician_profile_user_role ON technician_profiles;
CREATE TRIGGER trg_validate_technician_profile_user_role
  BEFORE INSERT OR UPDATE OF user_id ON technician_profiles
  FOR EACH ROW EXECUTE FUNCTION validate_technician_profile_user_role();

DROP TRIGGER IF EXISTS trg_validate_booking_user_roles ON bookings;
CREATE TRIGGER trg_validate_booking_user_roles
  BEFORE INSERT OR UPDATE OF customer_id, technician_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking_user_roles();

-- SPEED OPTIMIZATION PERFORMANCE INDEX MATRIX
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_is_online ON technician_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_last_location ON technician_profiles USING GIST (last_location);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_technician_id ON bookings(technician_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_location ON bookings USING GIST (customer_location);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_technician_id ON invoices(technician_id);
