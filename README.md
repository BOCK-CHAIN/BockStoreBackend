# BockStore Backend

Simple Node.js backend for the BockStore app. This repo contains the API, database migrations, and helper scripts used to run the service locally and in production.

I wrote this README as a quick guide for other devs to get the project running. If something is missing or out of date, please open an issue or update the file.

## Tech stack

- Node.js (CommonJS)
- Express
- PostgreSQL (pg)
- AWS S3 (for file uploads)

## Repo layout (important folders)

- `src/` - application source code (server, controllers, routes, utils)
- `migrations/` - SQL files to create/update DB schema
- `rds/` - example env files for RDS / DB
- `scripts/` - helper scripts for backup, migrate, deploy
- `uploads/` - stored uploads (icons, apks, screenshots)

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL database (remote or local)
- AWS account with S3 access (bucket + credentials) if you want file uploads

## Environment variables

Create a `.env` in the project root (you can copy `rds/config-example.env` as a starting point). The main variables this app expects:

- `DATABASE_URL` - full Postgres connection string (example: `postgres://user:pass@host:5432/dbname`)
- `PORT` - optional, defaults to `3000`
- `JWT_SECRET` - secret used to sign JWT tokens
- `AWS_REGION` - region for S3 (e.g. `us-east-1`)
- `AWS_ACCESS_KEY_ID` - S3 access key id
- `AWS_SECRET_ACCESS_KEY` - S3 secret access key
- `S3_BUCKET_NAME` - name of the S3 bucket used for uploads

Keep secrets out of git. Do not commit real credentials.

## Install & run locally

1. Clone the repo:

```
git clone <your-repo-url>
cd BockStoreBackend
```

2. Install dependencies:

```
npm install
```

3. Add your `.env` file and fill the variables.

4. Run the app in development:

```
npm run dev
```

The server listens on the value of `PORT` or `3000`.

## Database migrations

This repo includes SQL migration files in `migrations/`. You can apply them with `psql` or a DB tool. Example (replace with your DB connection string):

```
psql "<your_database_url>" -f migrations/003_create_ratings_table.sql
```

Run the migrations in order (000... -> newest). If you have a migration runner, use that instead.

## Docker / Compose

There is a `docker-compose.yml` that can help when containerizing. Example run (local Docker required):

```
docker-compose up --build
```

## Scripts

- `scripts/migrate-data.sh` - helper for migrating data (read the script before running)
- `scripts/deploy-rds.sh` - deploy helpers for RDS

## Useful notes

- File uploads use AWS S3. If you don't want uploads, stub or mock the S3 parts in `src/utils`.
- The API routes are defined under `src/routes/` and implemented in `src/controllers/`.

## How to push changes to GitHub (steps)

1. Make sure you have a remote set up. If you don't, create a repo on GitHub and add the remote:

```
git remote add origin git@github.com:yourusername/your-repo.git
```

2. Stage, commit, and push:

```
git add .
git commit -m "Add README and basic project docs"
git push origin main
```

If your default branch is `master` replace `main` with `master`.

## Want me to commit & push this for you?

I can give the exact commands to run or walk you through adding a remote and pushing if you want. If you want me to run git commands here, tell me which remote name and branch to use.

## Contributing

Open an issue or PR for non-trivial changes. For small fixes, fork and send a PR.

---

_Thanks — junior dev vibes: I tried to keep steps simple and explicit._
