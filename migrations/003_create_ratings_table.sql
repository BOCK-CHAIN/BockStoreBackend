BEGIN;

CREATE TABLE IF NOT EXISTS ratings (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id      INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_app_rating UNIQUE (user_id, app_id)
);


CREATE INDEX IF NOT EXISTS idx_ratings_app_id  ON ratings(app_id);

CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);


CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ratings_updated_at ON ratings;
CREATE TRIGGER set_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

COMMIT;