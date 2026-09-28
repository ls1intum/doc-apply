#!/bin/bash
export MSYS_NO_PATHCONV=1

###############################################################################
# 🧪 DocApply Test Data Import Script
#
# This script imports all SQL files located in:
#   src/main/resources/testdata/ and its subdirectories, sorted alphabetically.
#
# ✅ Platform-independent:
#   - Works on macOS, Linux, and Windows (via Git Bash).
#
# ⚙️ Usage:
#   1. Add your test SQL files inside src/main/resources/testdata/
#      → Example: src/main/resources/testdata/usermanagement/01_users.sql
#
#   2. Run this script via terminal or Git Bash:
#      ./import-testdata.sh
#
# 🔐 DB Connection:
#   - Compose service: postgres (docker/local-setup/services.yml)
#   - Username: docapply
#   - Database: docapply
#
# 🐳 Runs psql inside the local Docker PostgreSQL container, so no database
#     client needs to be installed on the host.
#
# ❗ Ensure that:
#   - The Docker services are running (docker compose -f docker/local-setup/services.yml up -d)
#   - The server has been started once so Liquibase has created the schema
###############################################################################

# Configuration variables
DB_NAME="docapply"
DB_USER="docapply"

# Path to testdata SQL files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_PATH="$SCRIPT_DIR"

# Sample document for the documents seed (08a_documents.sql).
# DocumentService stores files at "{aet.storage.root}/{sha256}.{ext}".
# We copy the bundled sample-document.pdf to that hash-named location so the seeded
# rows resolve to a real, readable file when downloaded through the UI.
SAMPLE_PDF_SRC="$SCRIPT_DIR/sample-document.pdf"
SAMPLE_PDF_SHA256="ab0fdaa9227be587287f3b3880eed317d795fd8727f3bc55fa6f949d8c54c2f2"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/local-setup/services.yml"
STORAGE_ROOT="${AET_STORAGE_ROOT:-$PROJECT_ROOT/storage/docs}"
SAMPLE_PDF_DEST="$STORAGE_ROOT/$SAMPLE_PDF_SHA256.pdf"

echo "Importing SQL test data into PostgreSQL database '$DB_NAME'..."
echo "Searching for SQL files in: $SQL_PATH"

# Run psql inside the postgres compose service; ON_ERROR_STOP makes a failing statement fail the file
run_psql() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -q -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
}

# Check that the postgres container is running
if [ -z "$(docker compose -f "$COMPOSE_FILE" ps -q postgres 2>/dev/null)" ]; then
  echo "PostgreSQL container is not running. Start it with: docker compose -f docker/local-setup/services.yml up -d"
  exit 1
fi

# Ask user if they want to reset the DB (run drop script)
while true; do
  echo "Do you want to reset the database (run 00_drop_all_tables.sql)? (y/n)"
  read -p "Do you want to reset the database? (y/n): " RESET_DB
  if [[ "$RESET_DB" == "y" || "$RESET_DB" == "Y" ]]; then
    DROP_FILE="$SQL_PATH/00_drop_all_tables.sql"
    if [ -f "$DROP_FILE" ]; then
      echo "Resetting database..."
      if ! run_psql < "$DROP_FILE"; then
        echo "ERROR while resetting the database"
        exit 1
      fi
    else
      echo "Reset script not found at: $DROP_FILE"
      exit 1
    fi
    break
  elif [[ "$RESET_DB" == "n" || "$RESET_DB" == "N" ]]; then
    echo "Skipping database reset."
    break
  else
    echo "Invalid input. Please enter y or n."
  fi
done

# Copy the sample document into the configured storage root under its SHA-256 filename
# so 08a_documents.sql can reference a real, readable file on disk.
if [ -f "$SAMPLE_PDF_SRC" ]; then
  mkdir -p "$STORAGE_ROOT"
  cp "$SAMPLE_PDF_SRC" "$SAMPLE_PDF_DEST"
  echo "Copied sample document to: $SAMPLE_PDF_DEST"
else
  echo "WARNING: Sample document not found at $SAMPLE_PDF_SRC. Seeded documents will not be downloadable."
fi

# Find and run only SQL files under testdata folder (and subfolders)
# Find and run all SQL files except the reset script
# The combined/ subfolder holds a single concatenated dump for one-shot execution
# on deployed environments — skip it locally so we don't double-run every statement.
while IFS= read -r file; do
  echo "Attempting to run: $file"

  if [ ! -s "$file" ]; then
    echo "WARNING: File is empty - $file"
  fi

  if ! run_psql < "$file"; then
    echo "ERROR while importing $file"
    exit 1
  fi
done < <(find "$SQL_PATH" -type f -name "*.sql" ! -name "00_drop_all_tables.sql" ! -path "*/combined/*" | sort)

echo "Success: All test data imported successfully."
