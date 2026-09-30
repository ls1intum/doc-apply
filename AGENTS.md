# Repository guidelines

## Task-specific guidance

Read the checked-in skill for the task at hand. Claude Code discovers them automatically; other tools can read the files directly.

| Task                                                | Guidance                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Change a database schema or fix a failing changeset | [liquibase-migration](.claude/skills/liquibase-migration/SKILL.md) |
| Write or debug JUnit or Vitest tests                | [write-tests](.claude/skills/write-tests/SKILL.md)                 |
| Set up, run, or troubleshoot the local application  | [local-setup](.claude/skills/local-setup/SKILL.md)                 |

Read the relevant guideline under `docs/docs/developer/` for a rule-governed change. When you change a convention, update its guideline and skill in the same change.

## Non-negotiables

These are DocApply-specific rules. The linked guidelines give reasons and examples; the skills give procedures.

### Server

- REST controllers take and return DTOs, never `@Entity` types. DTOs are Java records and hold no entities or logic. `DTOArchitectureTest` enforces this. [server development](docs/docs/developer/server-guidelines/server-development.mdx)
- Use constructor injection. Do not inject `EntityManager` or `EntityManagerFactory` into services or controllers; go through Spring Data repositories. [server development](docs/docs/developer/server-guidelines/server-development.mdx)
- Use `@Transactional` only when a method saves or deletes through two or more repositories. Not for single-repository writes or reads. [database](docs/docs/developer/server-guidelines/database-and-performance.mdx)
- Never use `FetchType.EAGER` on `@OneToMany` or `@ManyToMany`. Filter in SQL, page every list endpoint, and annotate query parameters with `@Param`. [database](docs/docs/developer/server-guidelines/database-and-performance.mdx)
- Every `@Entity` carries `@ExportedUserData` or `@NoUserDataExportRequired`. `TechnicalStructureTest` enforces this. [server tests](docs/docs/developer/server-guidelines/server-tests.mdx)
- Sanitize user-supplied HTML on write and on read. [server development](docs/docs/developer/server-guidelines/server-development.mdx)
- Annotate Java enums exposed through the API with `@Schema(enumAsRef = true)`, so the generated client gets one shared named enum instead of inlined string unions. [OpenAPI](docs/docs/developer/general-guidelines/openapi.mdx)
- Name the logger `log`. [server development](docs/docs/developer/server-guidelines/server-development.mdx)

### Client

- Use signal APIs. `@Input`, `@Output`, `@ViewChild`, `@ViewChildren`, `@ContentChild` and `@ContentChildren` are banned; `localRules/enforce-signal-apis` fails the lint. Use `inject()` for dependencies. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Use `@if`, `@for` and `@switch`, not structural directives. Never call methods or getters in templates, except signals. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Use `undefined`, never `null`. Never use the non-null assertion `!`. No `any`, no inline `as` casts; declare a typed variable instead. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Do not use the spread operator for objects or arrays; write the copy or merge explicitly. This applies to specs too. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Call the server only through the generated services and models in `src/main/webapp/app/generated`. Do not write custom API wrappers or interfaces. [OpenAPI](docs/docs/developer/general-guidelines/openapi.mdx)
- All user-visible text goes through translation with the `jhiTranslate` directive, not the pipe. Add keys to both `src/main/webapp/i18n/en/<area>.json` and `src/main/webapp/i18n/de/<area>.json`. `en.json` and `de.json` are generated bundles; never edit them. Run `node prebuild.mjs` to rebuild them. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Use semantic colour tokens, never hard-coded colours. Style PrimeNG components with `class`, not the deprecated `styleClass`. [client styling](docs/docs/developer/client-guidelines/client-styling.mdx) · [colour theming](docs/docs/developer/client-guidelines/color-theming.mdx)
- Give a Tailwind `sr-only` element a `relative` parent. The app shell has a single scroll container, and an unanchored `sr-only` element adds a second scrollbar.

### Everywhere

- Never hardcode the platform name. It is an admin setting with the default `DocApply`. Use `{siteName}` in client translations and `${SITE_NAME!}` in server email templates.
- Remove unreachable code, even when its only user is its own test. Required checks run on every PR: `python3 supporting_scripts/check_dead_code.py` and `pnpm run dead-code:client`.
- Use **client** and **server**, not "frontend" or "backend". This also applies to commit messages, PR text and issues.
- Comments take two shapes. JSDoc or JavaDoc above a method with `@param` and `@returns`, or numbered step comments (`// 1)`, `// 2)`) inside a complex method body. Number every phase once you number one. JavaDoc is plain English, without HTML tags. Comments explain a non-obvious why; they do not reference issue numbers or retell a bug and its fix.
- All code and comments are in English. UI text follows the [language guidelines](docs/docs/developer/client-guidelines/language-guidelines.mdx).

## Repository boundaries

- The server uses Spring Boot and Java 25; the client uses Angular 21. Use the Gradle wrapper, Node 24 and pnpm (`corepack enable`). Exact versions live in `build.gradle`, `gradle.properties` and `package.json`.
- Server code lives under `src/main/java/de/tum/cit/aet/`, grouped by module (`application`, `job`, `evaluation`, `interview`, `usermanagement`, `core`, and others). The Angular application is under `src/main/webapp/app/`.
- Server tests are in `src/test/java/`, client tests in `src/test/webapp/`. Both mirror the source package structure.
- `src/main/webapp/app/generated/` and `openapi/openapi.yaml` are generated. Change the server annotations and regenerate instead of hand-editing. The generated directory is tracked but matched by `.gitignore`, so stage it with `git add -f`. [OpenAPI](docs/docs/developer/general-guidelines/openapi.mdx)
- Liquibase changelogs live in `src/main/resources/config/liquibase/changelog/` and must be registered in `master.xml`. Never edit a changeset that has already been merged. [Liquibase](docs/docs/developer/server-guidelines/liquibase-guidelines.mdx)
- Before starting or stopping local services, check what is already running. MySQL (`:3306`) and Keycloak (`:9080`) come from `docker/local-setup/services.yml`.

## Documentation

- Developer, admin, professor and applicant documentation lives in `docs/docs/`, grouped by audience. Register a new page in the matching `docs/sidebar-*.ts`. Follow the [documentation guideline](docs/docs/developer/general-guidelines/writing-documentation.mdx).
- Do not commit plans, design specs or scratch notes. Keep working notes in the issue or PR.

## Testing

- Server coverage lives at the resource layer (`*ResourceTest`, extending `AbstractResourceTest`). Do not add new `*ServiceTest` classes. [server tests](docs/docs/developer/server-guidelines/server-tests.mdx)
- Never add `@MockitoBean`, `@MockitoSpyBean`, `@TestPropertySource`, `@ActiveProfiles`, `@DirtiesContext`, `@ContextConfiguration` or `@Import` to a concrete test class; each one forces a new Spring context. [server tests](docs/docs/developer/server-guidelines/server-tests.mdx)
- Client test names start with `should`. Test behaviour, not initialization, styling or getters. Prefer `toHaveBeenCalledOnce()`. Vitest has no `toBeTrue()`; use `toBe(true)`. [client tests](docs/docs/developer/client-guidelines/client-tests.mdx)
- ESLint ignores `src/test/webapp/**`. Prettier is the only style gate on specs, so run `pnpm run prettier:check` before pushing.
- See [write-tests](.claude/skills/write-tests/SKILL.md) for commands and patterns.

## Commits and pull requests

- Target `main`. Branch names start with `chore/`, `feat/`, `test/`, `bugfix/` or `general/`, followed by kebab-case. [branches](docs/docs/developer/general-guidelines/branch-guidelines.mdx)
- PR titles match `` `Bugfix|Development|Documentation|Test|General`: Capitalized title ``, e.g. `` `Development`: Add application dashboard page ``. `pr-check.yml` enforces the pattern. Write the title from the user's point of view, in plain English.
- Link every PR to an issue. Search for an existing issue before creating one. Fill in `.github/PULL_REQUEST_TEMPLATE.md` and remove sections that do not apply. [pull requests](docs/docs/developer/general-guidelines/pull-request-guidelines.mdx)
- Keep PRs small (XS to M). Stage specific files; never `git add -A`, which picks up build output and logs.
- Commit subjects are short and imperative.
