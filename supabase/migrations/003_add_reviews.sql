CREATE TABLE reviews (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(app_id, user_id)
);

CREATE TABLE installs (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  platform platform,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_app ON reviews(app_id);
CREATE INDEX idx_installs_app ON installs(app_id);