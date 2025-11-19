set -euo pipefail
RDS_HOST=$1
RDS_USER=$2
RDS_DB=$3
echo "Restoring schema to RDS..."
psql "host=$RDS_HOST port=5432 dbname=$RDS_DB user=$RDS_USER" -f supabase/migrations/00000000000001_initial_schema.sql
echo "Done."
