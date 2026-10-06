---
name: local-setup
description: Use when setting up, starting, or troubleshooting DocApply locally (PostgreSQL, Keycloak, Spring Boot server, Angular client, test data), or when regenerating the OpenAPI spec and generated client code.
---

# Local setup

The full guide is [development-environment.mdx](../../../docs/docs/developer/getting-started/development-environment.mdx). Keycloak details are under [keycloak/](../../../docs/docs/developer/authentication-and-authorization/keycloak/).

## Prerequisites

Java 25, Node 24 with pnpm (`corepack enable`) and Docker. No database client is needed: the test data import runs `psql` inside the PostgreSQL container.

## Before you start anything

Check what is already running. Another session or a teammate's script may own these ports.

```bash
docker compose -f docker/local-setup/services.yml ps
lsof -iTCP:5432 -iTCP:9080 -iTCP:8080 -iTCP:4200 -sTCP:LISTEN
```

Reuse running services. Do not stop containers or processes you did not start.

## Start

```bash
docker compose -f docker/local-setup/services.yml up -d    # PostgreSQL :5432, Keycloak :9080 (or: pnpm run services:up)
./gradlew -x webapp                                         # server :8080, applies Liquibase on start
pnpm install && pnpm start                                  # client :4200, runs prebuild first
bash ./src/main/resources/testdata/import-testdata.sh       # optional example data
```

The first Keycloak start can take up to a minute while it imports the realms from `docker/local-setup/realm-config/`.

## Accounts

- Keycloak admin console: `http://localhost:9080/admin`, `admin` / `admin`.
- Staff users in the `tumidpldap` realm, e.g. `admin1` / `admin`, `professor1` / `professor`, `employee1` / `employee`. See [test-users.mdx](../../../docs/docs/developer/authentication-and-authorization/keycloak/test-users.mdx).
- Applicants log in through DocApply itself, not Keycloak. After importing test data, `applicant2@docapply.local` / `applicant` works (the Lighthouse job in `pr-check.yml` uses it).

## Translations

Edit `src/main/webapp/i18n/en/<area>.json` and `src/main/webapp/i18n/de/<area>.json`. The bundles `en.json` and `de.json` are generated and gitignored. Rebuild them with `node prebuild.mjs`; `pnpm start`, `pnpm run test:ci` and the builds run it for you; plain `pnpm run test` does not.

## Regenerate the OpenAPI spec and client

Do this after changing a controller, DTO or API enum.

```bash
docker compose -f docker/local-setup/services.yml up -d keycloak
./gradlew generateApiDocs -x webapp                         # boots the server with the api-docs profile, writes openapi/openapi.yaml
./gradlew openApiGenerate                                   # writes src/main/webapp/app/generated
pnpm exec prettier --write ./src/main/webapp/app/generated
git add -f openapi/openapi.yaml src/main/webapp/app/generated
```

- `src/main/webapp/app/generated/` is tracked but matched by `.gitignore`. Without `-f`, new files are silently left out and CI fails.
- Annotate API enums with `@Schema(enumAsRef = true)`. Otherwise the generator inlines them as anonymous unions or per-field enums.
- On a PR with the `server` label, CI regenerates and commits the client automatically.

## Troubleshooting

| Symptom                                                                                  | Cause and fix                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The page shows "An error has occurred while loading…" for 10 to 20 seconds, then renders | Keycloak on `:9080` is unreachable, and keycloak-js waits out its 10-second iframe timeout before bootstrap continues. Check `docker port docapply-keycloak-1`. If no port is published, `docker restart` does not help. Recreate it: `docker compose -f docker/local-setup/services.yml up -d --force-recreate keycloak`. |
| Recreating Keycloak lost my changes                                                      | The realm is re-imported from `realm-config/*.json` on every start. Admin-console edits are lost unless exported back to the JSON.                                                                                                                                                                                         |
| Confirm Keycloak is healthy                                                              | `curl -sf http://localhost:9080/realms/tumidpldap/.well-known/openid-configuration` returns 200.                                                                                                                                                                                                                           |
| Server fails on start with a database connection error                                   | PostgreSQL is not running or not reachable on `:5432`. Check `docker exec docapply-postgres-1 pg_isready -U docapply -d docapply`. User, password and database are all `docapply`. Another project's PostgreSQL (e.g. Artemis) on the same port blocks the container from starting.                                        |
| A new translation key shows as the raw key                                               | The bundle is stale. Run `node prebuild.mjs` and reload.                                                                                                                                                                                                                                                                   |
| Unexplained build errors                                                                 | `./gradlew clean build`.                                                                                                                                                                                                                                                                                                   |

For AI features you need a local LLM; see [local-llm-setup.mdx](../../../docs/docs/developer/getting-started/local-llm-setup.mdx).
