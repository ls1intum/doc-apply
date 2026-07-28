#!/usr/bin/env bash
#
# 🚀 Description:
# This script uploads predefined users to a Keycloak realm using the /partialImport API endpoint.
# Each user receives a password based on their role (e.g., "ADMIN" → "admin").
#
# Workflow:
# 1. Prompt for Keycloak connection info
# 2. Obtain admin token
# 3. Load users (from hardcoded list)
# 4. Submit each user via /partialImport
# 5. Print success/failure and summary
#
# Output:
# - Writes created user info to generated-user-ids.json
#
# This script is compatible with macOS and Windows Git Bash / WSL environments.
#
# ---
# 🔧 System Requirements:
# This script requires:
#   - bash (installed by default on macOS, Git Bash/WSL on Windows)
#   - curl (installed by default)
#   - jq (for parsing JSON response from Keycloak's token endpoint)
#
# Why is jq needed?
#   jq extracts the access_token from Keycloak's JSON response. While sed/awk alternatives exist,
#   jq is safer and more robust for JSON parsing.
#
# ✅ macOS: Install jq via Homebrew:
#     brew install jq
#
# ✅ Windows:
#   - If using Git Bash: install jq from https://github.com/stedolan/jq/releases
#     and add it to your PATH, or use a package manager like Chocolatey:
#     choco install jq
#   - If using WSL: run `sudo apt install jq`
# ---

if ! command -v jq &> /dev/null; then
  echo "❌ Error: 'jq' is required but not installed. Please install jq first." >&2
  exit 1
fi

# Prompt for Keycloak credentials and connection details
read -p "Keycloak URL [http://localhost:9080]: " KEYCLOAK_URL
KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:9080}
read -p "Realm [external_login]: " REALM
REALM=${REALM:-external_login}
read -p "Client ID: " CLIENT_ID
read -p "Admin Username: " USERNAME
echo -n "Admin Password: "
read -s PASSWORD
echo
USERS_SQL="01_users.sql"
ROLES_SQL="03_user_roles.sql"

# Request access token for the Keycloak Admin API
TOKEN=$(curl -s "${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token" \
  -d "username=${USERNAME}" \
  -d "password=${PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=${CLIENT_ID}" \
  -H "Content-Type: application/x-www-form-urlencoded" | jq -r .access_token)

# Define users for import
users=(
  "00000000-0000-0000-0000-000000000101;admin1@docapply.local;System;Admin;ADMIN"
  "00000000-0000-0000-0000-000000000102;professor1@docapply.local;Anna;Professorin;PROFESSOR"
  "00000000-0000-0000-0000-000000000103;applicant1@docapply.local;Max;Applicant;APPLICANT"
  "00000000-0000-0000-0000-000000000104;external@uni.de;Sara;Extern;APPLICANT"
  "00000000-0000-0000-0000-000000000105;professor2@tum.de;Professor2;TUM;PROFESSOR"
  "00000000-0000-0000-0000-000000000106;longnameperson@intl.edu;Jean-Pierre-Étienne;Van Der Straaten-Sánchez;APPLICANT"
  "11111111-0000-0000-0000-000000000001;amelie.bauer@docapply.local;Amelie;Bauer;APPLICANT"
  "11111111-0000-0000-0000-000000000002;daniel.kim@docapply.local;Daniel;Kim;PROFESSOR"
  "11111111-0000-0000-0000-000000000003;linazhang@docapply.local;Lina;Zhang;PROFESSOR"
  "11111111-0000-0000-0000-000000000004;thomas.miller@docapply.local;Thomas;Miller;PROFESSOR"
  "11111111-0000-0000-0000-000000000005;sofia.ricci@docapply.local;Sofia;Ricci;PROFESSOR"
  "11111111-0000-0000-0000-000000000006;khalid.hassan@docapply.local;Khalid;Hassan;APPLICANT"
  "11111111-0000-0000-0000-000000000007;ines.fernandez@docapply.local;Ines;Fernández;APPLICANT"
  "11111111-0000-0000-0000-000000000008;adam.nowak@docapply.local;Adam;Nowak;PROFESSOR"
  "11111111-0000-0000-0000-000000000009;elena.kovalenko@docapply.local;Elena;Kovalenko;PROFESSOR"
  "11111111-0000-0000-0000-000000000010;jamal.abdi@docapply.local;Jamal;Abdi;PROFESSOR"
  "11111111-0000-0000-0000-000000000011;sophie.lee@docapply.local;Sophie;Lee;APPLICANT"
  "11111111-0000-0000-0000-000000000012;hassan.mohammed@docapply.local;Hassan;Mohammed;APPLICANT"
  "11111111-0000-0000-0000-000000000013;tatiana.ivanova@docapply.local;Tatiana;Ivanova;APPLICANT"
  "11111111-0000-0000-0000-000000000014;jacob.green@docapply.local;Jacob;Green;APPLICANT"
  "11111111-0000-0000-0000-000000000015;li.hua@docapply.local;Li;Hua;APPLICANT"
  "11111111-0000-0000-0000-000000000016;julia.martin@docapply.local;Julia;Martin;APPLICANT"
  "11111111-0000-0000-0000-000000000017;ahmad.rahman@docapply.local;Ahmad;Rahman;APPLICANT"
  "11111111-0000-0000-0000-000000000018;lucy.taylor@docapply.local;Lucy;Taylor;APPLICANT"
  "11111111-0000-0000-0000-000000000019;leon.schmidt@docapply.local;Leon;Schmidt;APPLICANT"
  "11111111-0000-0000-0000-000000000020;nina.petrova@docapply.local;Nina;Petrova;APPLICANT"
  "11111111-0000-0000-0000-000000000021;george.mensah@docapply.local;George;Mensah;APPLICANT"
  "11111111-0000-0000-0000-000000000022;eva.fischer@docapply.local;Eva;Fischer;APPLICANT"
  "11111111-0000-0000-0000-000000000023;jay.patel@docapply.local;Jay;Patel;APPLICANT"
  "11111111-0000-0000-0000-000000000024;olga.smirnova@docapply.local;Olga;Smirnova;APPLICANT"
  "11111111-0000-0000-0000-000000000025;karim.saad@docapply.local;Karim;Saad;APPLICANT"
  "11111111-0000-0000-0000-000000000026;meera.iyer@docapply.local;Meera;Iyer;APPLICANT"
  "11111111-0000-0000-0000-000000000027;erik.olsen@docapply.local;Erik;Olsen;APPLICANT"
  "11111111-0000-0000-0000-000000000028;claire.lambert@docapply.local;Claire;Lambert;APPLICANT"
  "11111111-0000-0000-0000-000000000029;matteo.rinaldi@docapply.local;Matteo;Rinaldi;APPLICANT"
  "11111111-0000-0000-0000-000000000030;noor.ahmed@docapply.local;Noor;Ahmed;APPLICANT"
)

echo
echo "You are about to upload ${#users[@]} user(s) to Keycloak."
read -p "Do you want to proceed? (y/n): " confirm
if [[ "$confirm" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

echo
echo "If a user with the same ID already exists in Keycloak, choose the conflict strategy:"
echo "  SKIP      → Skip creation if user exists"
echo "  OVERWRITE → Overwrite existing user"
echo "  FAIL      → Fail if user already exists (default)"
read -p "Conflict handling strategy [FAIL]: " conflictStrategy
conflictStrategy=$(echo "$conflictStrategy" | tr '[:lower:]' '[:upper:]')
conflictStrategy=${conflictStrategy:-FAIL}

echo "Using conflict strategy: $conflictStrategy"
echo

echo "[" > generated-user-ids.json

created=0
skipped=0
overwritten=0
failed=0

for index in "${!users[@]}"
do
  IFS=";" read -r id email first last role <<< "${users[$index]}"
  password=$(echo "$role" | tr '[:upper:]' '[:lower:]')

  # Prepare user JSON
  user_json=$(cat <<EOF
{
  "users": [
    {
      "id": "$id",
      "username": "$email",
      "email": "$email",
      "emailVerified": true,
      "enabled": true,
      "firstName": "$first",
      "lastName": "$last",
      "credentials": [
        {
          "type": "password",
          "value": "$password",
          "temporary": false
        }
      ]
    }
  ],
  "ifResourceExists": "$conflictStrategy"
}
EOF
)

  # Submit partial import and check response
  response=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM}/partialImport" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$user_json")

  if echo "$response" | grep -q '"added"'; then
    echo "✅ User $email successfully imported."
    ((created++))
  elif echo "$response" | grep -q '"ignored"'; then
    echo "⚠️  User $email was ignored (probably already exists)."
    ((skipped++))
  elif echo "$response" | grep -q '"overwritten"'; then
    echo "🔁 User $email was overwritten."
    ((overwritten++))
  else
    echo "❌ Failed to import user $email. Response:"
    echo "$response"
    ((failed++))
  fi

  # Append to generated-user-ids.json
  echo -n "  { \"id\": \"$id\", \"email\": \"$email\" }" >> generated-user-ids.json
  if [[ $index -lt $((${#users[@]} - 1)) ]]; then
    echo "," >> generated-user-ids.json
  else
    echo >> generated-user-ids.json
  fi
done

echo "]" >> generated-user-ids.json
echo "All users processed. IDs written to generated-user-ids.json"

echo
echo "📊 Import Summary:"
echo "  ✅ Created:     $created"
echo "  ⚠️  Skipped:     $skipped"
echo "  🔁 Overwritten: $overwritten"
echo "  ❌ Failed:      $failed"