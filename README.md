# BockStore Backend

Production-ready Node.js backend for the BockStore application. This document explains how to set up, run, and maintain the service. The instructions are written at a junior developer level but use professional formatting and conventions.

## Summary

- Purpose: REST API for app distribution and metadata (ratings, uploads, versions).
- Main features: authentication, file uploads (S3), database migrations, basic admin endpoints.

## Tech stack

- Node.js (CommonJS)
- Express
- PostgreSQL (`pg`)
- AWS S3 (optional, used for file storage)

## Repository layout

- `src/` — application source (server, controllers, routes, middleware, utils)
- `migrations/` — SQL migration files (apply in ascending order)
- `rds/` — example env files for RDS / DB
- `scripts/` — helper shell scripts (migrate, backup, deploy)
- `uploads/` — local uploads (development only)

## Prerequisites

- Node.js v16+ and npm
- PostgreSQL instance (local, Docker, or cloud)
- (Optional) AWS account and S3 bucket for file uploads

## Environment configuration

Create a `.env` file in the project root. You can use `rds/config-example.env` as a template. Required variables used by the app:

- `DATABASE_URL` — Postgres connection string (e.g. `postgres://user:pass@host:5432/db`)
- `PORT` — port to run the server (default: `3000`)
- `JWT_SECRET` — secret key for signing JWTs
- `AWS_REGION` — S3 region (if using uploads)
- `AWS_ACCESS_KEY_ID` — S3 access key id
- `AWS_SECRET_ACCESS_KEY` — S3 secret access key
- `S3_BUCKET_NAME` — S3 bucket name used for uploads

Security: never commit `.env` or real credentials to version control. Use secrets management in production (AWS Secrets Manager, environment variables on the host, etc.).

## Install and run

1. Clone the repo and change directory:

```bash
git clone <your-repo-url>
cd BockStoreBackend
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env` with the required variables.

4. Start in development mode:

```bash
npm run dev
```

The app listens on `PORT` or `3000` by default.

## Database migrations

Migration files are in `migrations/`. They are plain SQL and should be applied in order. Example using `psql`:

```bash
psql "<your_database_url>" -f migrations/00000000000001_initial_schema.sql
psql "<your_database_url>" -f migrations/001_initial_schema.sql
# ...continue with later files
```

For production, use a proper migration runner (Flyway, Liquibase, or a Node-based migration tool).

## File uploads

- The project supports uploads to S3. Configuration is via the `AWS_*` env variables above.
- Local development may use `uploads/` for temporary storage.
- Public object URLs follow the pattern: `https://<S3_BUCKET_NAME>.s3.<AWS_REGION>.amazonaws.com/<key>`.

See `src/utils/uploadToS3.js` and `src/utils/getPresignedUrl.js` for implementation details.

## Docker

There is a `docker-compose.yml` provided for containerized development. Basic usage:

```bash
docker-compose up --build
```

Adjust the compose file and environment variables for your environment.

## Scripts and helpful commands

- `npm run dev` — start server (development)
- `scripts/migrate-data.sh` — data migration helper (review before running)
- `scripts/deploy-rds.sh` — RDS deployment helper

Inspect scripts before use and run them with appropriate DB credentials.

## Testing

There are no automated tests included. Add unit and integration tests (Jest, Supertest) before production use.

## Deployment notes

- Use environment variables for secrets in production.
- For relational DB, prefer managed services (RDS) and run migrations as part of deployment pipeline.
- Store uploaded files in S3 and serve via CDN if needed.

## Security and operational considerations

- Rotate `JWT_SECRET` and AWS keys periodically.
- Limit S3 bucket public access and use least-privilege IAM roles.
- Add rate limiting and logging for production.

## Contributing

1. Fork the repository.
2. Create a branch named `feature/<short-description>` or `fix/<short-description>`.
3. Make changes and keep commits small and focused.
4. Open a pull request with a clear description and testing notes.

## License

This project uses the ISC license (see `package.json`).

## Contact / Support

If you need help, open an issue or contact the project owner listed in `package.json`.

---

If you'd like, I can also:

- add a short API reference section (endpoints and example requests), or
- create a `docs/` folder with more details for maintainers.
