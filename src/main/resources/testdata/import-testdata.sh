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
#   - Host:     127.0.0.1
#   - Port:     3306
#   - Username: root
#   - Password: (empty)
#   - Database: docapply
#
# 🐳 Assumes that you are using the local Docker MySQL container
#     from your docker-compose file under src/main/docker/mysql.yml
#
# ❗ Ensure that:
#   - MySQL is running (check with `docker ps`)
#   - The database "docapply" exists
#   - mysql CLI is installed and the command is available in your PATH (test via "mysql --version")
###############################################################################

# Configuration variables
DB_NAME="docapply"
DB_USER="root"
DB_PASS=""
DB_HOST="127.0.0.1"
DB_PORT="3306"

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
STORAGE_ROOT="${AET_STORAGE_ROOT:-$PROJECT_ROOT/storage/docs}"
SAMPLE_PDF_DEST="$STORAGE_ROOT/$SAMPLE_PDF_SHA256.pdf"

echo "Importing SQL test data into MySQL database '$DB_NAME'..."
echo "Searching for SQL files in: $SQL_PATH"

# Check for mysql CLI
if ! command -v mysql &> /dev/null
then
  echo "mysql CLI not found. Please install MySQL client."
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
      mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" "$DB_NAME" < "$DROP_FILE"
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
find "$SQL_PATH" -type f -name "*.sql" ! -name "00_drop_all_tables.sql" ! -path "*/combined/*" | sort | while IFS= read -r file; do
  echo "Attempting to run: $file"
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" --password="$DB_PASS" "$DB_NAME" < "$file"

  if [ ! -s "$file" ]; then
    echo "WARNING: File is empty - $file"
  fi

  if [ $? -ne 0 ]; then
    echo "ERROR while importing $file"
    exit 1
  fi
done

echo "Success: All test data imported successfully."
