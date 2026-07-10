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
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  phone_number VARCHAR(32) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION ensure_user_role(
  target_user_id UUID,
  expected_role user_role,
  column_name TEXT
)
RETURNS VOID AS $$
DECLARE
  actual_role user_role;
BEGIN
  SELECT role INTO actual_role
  FROM users
  WHERE id = target_user_id;

  IF actual_role IS NULL THEN
    RAISE EXCEPTION '% references an unknown user id: %', column_name, target_user_id;
  END IF;

  IF actual_role <> expected_role THEN
    RAISE EXCEPTION '% must reference a % user, but referenced user is %',
      column_name, expected_role, actual_role;
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

CREATE TABLE IF NOT EXISTS technician_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  last_location GEOMETRY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  appliance_type VARCHAR(100) NOT NULL,
  customer_location GEOMETRY(Point, 4326) NOT NULL,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency currency_code NOT NULL DEFAULT 'ZAR',
  status booking_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT bookings_customer_technician_distinct_check
    CHECK (technician_id IS NULL OR technician_id <> customer_id)
);

DROP TRIGGER IF EXISTS trg_validate_technician_profile_user_role ON technician_profiles;
CREATE TRIGGER trg_validate_technician_profile_user_role
  BEFORE INSERT OR UPDATE OF user_id
  ON technician_profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_technician_profile_user_role();

DROP TRIGGER IF EXISTS trg_validate_booking_user_roles ON bookings;
CREATE TRIGGER trg_validate_booking_user_roles
  BEFORE INSERT OR UPDATE OF customer_id, technician_id
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_user_roles();

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_is_online ON technician_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_last_location
  ON technician_profiles USING GIST (last_location);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_technician_id ON bookings(technician_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_location
  ON bookings USING GIST (customer_location);
