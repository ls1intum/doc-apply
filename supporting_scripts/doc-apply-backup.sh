#!/usr/bin/env bash
set -euo pipefail

# ----------- CONFIG (override via env vars if you like) -----------------------
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"   # your deploy compose file
ENV_FILE="${ENV_FILE:-.env}"                           # holds DB creds
BACKUP_DIR="${BACKUP_DIR:-./backups}"                  # where to store backups
DB_SERVICE="${DB_SERVICE:-mysql}"                      # service name in compose
APP_SERVICE="${APP_SERVICE:-docapply}"                 # service name in compose
DOCS_PATH_IN_APP="${DOCS_PATH_IN_APP:-/data/docs}"     # where docs live in app container
RETENTION_DAYS="${RETENTION_DAYS:-7}"                  # rotate old backups
# ------------------------------------------------------------------------------

sanitize() {
  # trim CR, surrounding quotes and whitespace
  v="$(echo -n "$1" | tr -d '\r')"
  v="${v#\"}"; v="${v%\"}"
  v="${v#\'}"; v="${v%\'}"
  # shellcheck disable=SC2001
  echo "$(echo "$v" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
}

get_env () {
  # read VAR from $ENV_FILE and sanitize
  val="$(grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | sed -E "s/^${1}=//" || true)"
  sanitize "$val"
}

DATE="$(date +'%Y%m%d_%H%M%S')"
mkdir -p "$BACKUP_DIR"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# Remove old backups
find "$BACKUP_DIR" -type f -mtime +"$RETENTION_DAYS" -name 'backup_*.tgz' -delete || true

# --- figure out DB creds (prefer MYSQL_*; fallback to SPRING_* or URL)
DB_NAME="${MYSQL_DATABASE:-$(get_env MYSQL_DATABASE)}"
DB_USER="${MYSQL_USER:-$(get_env MYSQL_USER)}"
DB_PASSWORD="${MYSQL_PASSWORD:-$(get_env MYSQL_PASSWORD)}"
DB_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-$(get_env MYSQL_ROOT_PASSWORD)}"

if [ -z "${DB_USER}" ]; then
  DB_USER="$(get_env SPRING_DATASOURCE_USERNAME)"
fi
if [ -z "${DB_PASSWORD}" ]; then
  # if user is root (very common), take root password
  if [ "${DB_USER}" = "root" ] || [ -z "${DB_USER}" ]; then
    DB_PASSWORD="$DB_ROOT_PASSWORD"
    DB_USER="${DB_USER:-root}"
  else
    DB_PASSWORD="$(get_env SPRING_DATASOURCE_PASSWORD)"
  fi
fi
if [ -z "${DB_NAME}" ]; then
  DS_URL="$(get_env SPRING_DATASOURCE_URL)"
  if [ -n "$DS_URL" ]; then
    # parse jdbc:mysql://host:3306/dbname?params
    DB_NAME="$(echo "$DS_URL" | sed -E 's#.*jdbc:[a-z]+://[^/]+/([^?]+).*#\1#')"
  fi
fi

DB_NAME="$(sanitize "$DB_NAME")"
DB_USER="$(sanitize "$DB_USER")"
DB_PASSWORD="$(sanitize "$DB_PASSWORD")"

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: Could not determine DB credentials from $ENV_FILE."
  echo "Need DB name, user and password (MYSQL_* or SPRING_*)."
  exit 1
fi

# --- ensure services are up
db_cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$DB_SERVICE" || true)"
app_cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$APP_SERVICE" || true)"
[ -n "$db_cid" ] || { echo "ERROR: DB service '$DB_SERVICE' not running"; exit 1; }
[ -n "$app_cid" ] || { echo "ERROR: App service '$APP_SERVICE' not running"; exit 1; }

# --- choose dump tool (MySQL vs MariaDB)
if docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" sh -lc 'command -v mysqldump >/dev/null'; then
  DUMP_CMD="mysqldump --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --default-character-set=utf8mb4"
else
  DUMP_CMD="mariadb-dump --single-transaction --quick --routines --triggers --events --default-character-set=utf8mb4"
fi

echo "Dumping database '${DB_NAME}' from service '${DB_SERVICE}' as user '${DB_USER}'..."
# pass password via env to avoid CLI warning
docker compose -f "$COMPOSE_FILE" exec -T -e MYSQL_PWD="$DB_PASSWORD" "$DB_SERVICE" sh -lc \
  "$DUMP_CMD -u'$DB_USER' '$DB_NAME'" \
  | gzip -c > "$TMPDIR/db.sql.gz"

echo "Archiving docs from '$DOCS_PATH_IN_APP' in service '$APP_SERVICE'..."
docker compose -f "$COMPOSE_FILE" exec -T "$APP_SERVICE" sh -lc \
  "tar -C \"$(dirname "$DOCS_PATH_IN_APP")\" -czf - \"$(basename "$DOCS_PATH_IN_APP")\"" \
  > "$TMPDIR/docs.tar.gz"

# Add a tiny manifest
cat > "$TMPDIR/manifest.txt" <<EOF
date=$DATE
db_service=$DB_SERVICE
app_service=$APP_SERVICE
db_name=$DB_NAME
docs_path=$DOCS_PATH_IN_APP
compose_file=$COMPOSE_FILE
git_sha=$(git rev-parse --short HEAD 2>/dev/null || echo "N/A")
EOF

tar -C "$TMPDIR" -czf "$BACKUP_DIR/backup_${DATE}.tgz" db.sql.gz docs.tar.gz manifest.txt
echo "Backup done: $BACKUP_DIR/backup_${DATE}.tgz"
