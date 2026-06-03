# BockStore Backend — Quick Notes

Hey — I'm a dev working on this backend. This README is just quick notes to get you started. It might be missing things, but it should be enough to run the app locally.

## What this is

This repo is a small Node/Express backend for the BockStore app. It has API routes, SQL migrations, and scripts for backups/migrations.

## Quick tech list

- Node.js + Express
- PostgreSQL (`pg`)
- AWS S3 for file uploads (optional)

## Important folders

- `src/` — server code, routes, controllers, utils
- `migrations/` — SQL files to update DB schema
- `rds/` — example env files (copy these to start)
- `scripts/` — helper shell scripts
- `uploads/` — where uploaded files are kept (local)

## Setup (what I did locally)

1. Copy example env: `cp rds/config-example.env .env` (or create `.env` manually)
2. Fill these env vars:

- `DATABASE_URL` e.g. `postgres://user:pass@host:5432/db`
- `PORT` (optional, default 3000)
- `JWT_SECRET`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` (only if using S3 uploads)

Don't commit real secrets.

3. Install dependencies:

```
npm install
```

4. Start server:

```
npm run dev
```

Server runs on `PORT` or `3000`.

## Database / migrations

I run migrations manually with `psql` for now. Example:

```
psql "<your_database_url>" -f migrations/003_create_ratings_table.sql
```

Apply migrations in order. If you use a tool, use that instead.

## Docker (optional)

If you want to use Docker:

```
docker-compose up --build
```

## Notes about uploads

- Uploads use S3. If you don't have S3 set up, you can skip that part or mock the functions in `src/utils`.
- Public URLs are generated like: `https://<bucket>.s3.<region>.amazonaws.com/<key>`

## Scripts

- `scripts/migrate-data.sh` — migration helper (read before running)
- `scripts/deploy-rds.sh` — deploy helper for RDS

## Git push (simple)

If you already have a GitHub repo set up, do:

```
git add README.md
git commit -m "docs: update README"
git push origin main
```

Replace `main` with `master` if needed.

## If something breaks

- Check the `.env` values first.
- Check `src/config/db.js` for DB connection details.
- Open an issue or ping me — I probably missed something.

---
