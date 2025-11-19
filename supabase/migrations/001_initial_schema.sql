
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Roles (simple text enum)
CREATE TABLE IF NOT EXISTS roles (
  role text PRIMARY KEY CHECK (role IN ('user','developer','admin'))
);

INSERT INTO roles(role) VALUES ('user'),('developer'),('admin') ON CONFLICT DO NOTHING;

-- 2. Profiles (Central User Table)
-- The 'id' column is the external user ID (UUID) provided by the auth system.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' REFERENCES roles(role),
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT DEFAULT '',
  website_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Developers (Metadata linked to a Profile)
CREATE TABLE IF NOT EXISTS developers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  org_name TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  website_url TEXT,
  contact_email TEXT,
  location TEXT,
  established_on DATE
);

-- 4. Custom ENUM for Platforms
-- This is wrapped in a DO block to prevent errors if the type already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform') THEN
    CREATE TYPE platform AS ENUM ('android','windows','macos','linux','web','ios');
  END IF;
END$$;

-- 5. Apps (The main catalog)
CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  video_url TEXT,                -- Added from user's original snippet
  video_thumbnail TEXT,          -- Added from user's original snippet
  publisher_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to automatically update 'updated_at' column
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END$$;

-- Trigger for 'apps' table
DROP TRIGGER IF EXISTS trg_apps_updated ON apps;
CREATE TRIGGER trg_apps_updated
BEFORE UPDATE ON apps
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Categories & App Categories
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS app_categories (
  app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (app_id, category_id)
);

-- 7. App Versions/Builds
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  platform platform NOT NULL,
  min_os_version TEXT,
  architecture TEXT,
  changelog TEXT,
  size_bytes BIGINT,
  sha256 TEXT,
  storage_key TEXT NOT NULL,
  is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (app_id, platform, version)
);

-- 8. Screenshots
CREATE TABLE IF NOT EXISTS screenshots (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Reviews & Ratings
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  -- References the local profiles table instead of an external auth table
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (app_id, user_id)
);

-- 10. Installs (for analytics)
CREATE TABLE IF NOT EXISTS installs (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version_id UUID REFERENCES app_versions(id) ON DELETE SET NULL,
  -- References the local profiles table instead of an external auth table
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  platform platform,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful Indexes
CREATE INDEX IF NOT EXISTS idx_apps_name_trgm ON apps USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_versions_app_platform ON app_versions(app_id, platform);
CREATE INDEX IF NOT EXISTS idx_reviews_app ON reviews(app_id);