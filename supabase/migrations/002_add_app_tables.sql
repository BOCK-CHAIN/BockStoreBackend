CREATE TYPE platform AS ENUM ('android','windows','macos','linux','web','ios');

CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  publisher_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  video_url TEXT,
  video_thumbnail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at() 
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  NEW.updated_at = NOW(); 
  RETURN NEW;
END$$;

CREATE TRIGGER trg_apps_updated 
BEFORE UPDATE ON apps
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for performance
CREATE INDEX idx_apps_slug ON apps(slug);
CREATE INDEX idx_apps_publisher ON apps(publisher_id);