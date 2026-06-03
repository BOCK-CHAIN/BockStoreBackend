BEGIN;

CREATE TABLE IF NOT EXISTS app_logs (
    id SERIAL PRIMARY KEY,
    app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    version VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_logs_app_id ON app_logs(app_id);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON app_logs(user_id);

COMMIT;