# Repository guidelines

These rules apply to every change, however small, including code you only move or reformat. They win over your defaults and over patterns in older code: when existing code breaks a rule, do not copy it.

## Before you write code

Do these four steps for every task. Skipping one is how duplicates and rule violations get into the repository.

1. **Read this whole file** before your first edit. It is short on purpose; every line is a rule.
2. **Read the guideline for each area you touch**, even for a small fix. The guidelines hold the reasons and the examples that this file only names.

   | Area                                        | Guideline                                                                                                                                                                                                                                                 |
   | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Client components, signals, templates, i18n | [client development](docs/docs/developer/client-guidelines/client-development.mdx)                                                                                                                                                                        |
   | Client styling and colours                  | [client styling](docs/docs/developer/client-guidelines/client-styling.mdx) · [colour theming](docs/docs/developer/client-guidelines/color-theming.mdx)                                                                                                    |
   | UI text in English or German                | [language guidelines](docs/docs/developer/client-guidelines/language-guidelines.mdx)                                                                                                                                                                      |
   | Server services, controllers, DTOs          | [server development](docs/docs/developer/server-guidelines/server-development.mdx) · [error handling](docs/docs/developer/server-guidelines/error-handling.mdx) · [authorization](docs/docs/developer/authentication-and-authorization/authorization.mdx) |
   | Entities, queries, transactions             | [database](docs/docs/developer/server-guidelines/database-and-performance.mdx) · [Liquibase](docs/docs/developer/server-guidelines/liquibase-guidelines.mdx)                                                                                              |
   | Tests                                       | [client tests](docs/docs/developer/client-guidelines/client-tests.mdx) · [server tests](docs/docs/developer/server-guidelines/server-tests.mdx)                                                                                                           |
   | API changes                                 | [OpenAPI](docs/docs/developer/general-guidelines/openapi.mdx)                                                                                                                                                                                             |
   | Branches, PRs, documentation                | [branches](docs/docs/developer/general-guidelines/branch-guidelines.mdx) · [pull requests](docs/docs/developer/general-guidelines/pull-request-guidelines.mdx) · [documentation](docs/docs/developer/general-guidelines/writing-documentation.mdx)        |

3. **Search before you create.** Before you add a constant, type, enum, helper, component, translation key or server utility, search the code for one that already exists:
   - Client: `app/shared/constants`, `app/shared/util`, `app/shared/components`, `app/shared/validators`, the generated models in `app/generated`, and the UI kit's exported types (`TumAetUi*` in `@tumaet/ui-angular`).
   - Server: the `core` module, the module you work in, and the repository's existing `...ElseThrow` methods.
   - Reuse what exists. When a value is needed in two places, move it into the shared folder above and import it in both; never declare a second copy. When you find two copies, merge them. Prefer the kit's or the generated type over a hand-written union with the same members.
4. **Check your diff against this file before you commit**: comments, the non-negotiables below, and the required checks (lint, `pnpm run prettier:check`, both dead-code checks, the tests you touched).

## Comments

This is the rule reviewers flag most. Comments take exactly two shapes, in TypeScript and Java alike:

- **JSDoc or JavaDoc** above a method, class, interface, type or exported constant. Methods carry `@param` for each parameter and `@returns` (JavaDoc: `@return`) when they return a value. JavaDoc is plain English, without HTML tags.
- **Numbered step comments** inside a complex method body: `// 1)`, `// 2)`, `// 3)`, never `// 1.`. Once you number one phase, number every phase of that method.

Nothing else. No loose inline or trailing comments, no comments on fields or inputs that only repeat their name, no section banners and no commented-out code. A comment explains a non-obvious why; it never retells what the code does, references an issue number, or narrates a bug and its fix (that belongs in the PR).

```typescript
/**
 * Saves the draft and publishes the job once the server has accepted it.
 *
 * @param jobId the job to publish
 * @returns whether the job is now public
 */
async publish(jobId: string): Promise<boolean> {
  // 1) Save the open changes, so the published version matches the form
  await this.saveDraft();

  // 2) Publish and reflect the new state in the page
  const job = await firstValueFrom(this.jobApi.publishJob(jobId));
  this.job.set(job);
  return job.state === 'PUBLISHED';
}
```

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
- Never inject with `@Autowired` fields. Do not break a circular dependency with `@Lazy` or `ObjectProvider`; restructure the services. [server development](docs/docs/developer/server-guidelines/server-development.mdx)
- Guard every endpoint with a role annotation (`@Applicant`, `@ProfessorOrEmployee`, `@ProfessorOrAdmin`, `@Admin`, ...) and check ownership with `@CheckAccess` or `currentUserService.assertAccessTo`. Validate that IDs from the request exist before authorizing. [authorization](docs/docs/developer/authentication-and-authorization/authorization.mdx)
- Throw the matching exception class (`EntityNotFoundException`, `InvalidParameterException`, `OperationNotAllowedException`, `ResourceAlreadyExistsException`, `AccessDeniedException`), not a generic one. [error handling](docs/docs/developer/server-guidelines/error-handling.mdx)
- Write queries in uppercase SQL inside text blocks, with joins instead of sub-queries. Mark `@ManyToOne` and `@OneToOne` as `FetchType.LAZY`, never combine `JOIN FETCH` with a `Pageable`, and return a `Slice` when no total count is needed. [database](docs/docs/developer/server-guidelines/database-and-performance.mdx)
- Use `.toList()`, not `Collectors.toList()`. No wildcard imports. Build paths with `Path.of`.

### Client

- Use signal APIs. `@Input`, `@Output`, `@ViewChild`, `@ViewChildren`, `@ContentChild` and `@ContentChildren` are banned; `localRules/enforce-signal-apis` fails the lint. Use `inject()` for dependencies. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Use `@if`, `@for` and `@switch`, not structural directives. Never call methods or getters in templates, except signals. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Use `undefined`, never `null`. Where a browser API or library returns `null` (`localStorage.getItem`, `querySelector`, `getAttribute`), turn it into `undefined` right there with `?? undefined`. Never use the non-null assertion `!`. No `any`, no inline `as` casts; declare a typed variable instead. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Do not use the spread operator for objects or arrays; write the copy or merge explicitly. This applies to specs too. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Derive state with `computed()`, never with getters. Use `effect()` only for side effects. Await server calls with `firstValueFrom` instead of subscribing by hand. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Use a `<button>` for an action and a link for navigation. Give every input a label. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Build pages from the shared components. They use the TUM AET UI kit (`@tumaet/ui-angular`), which only `app/shared/components`, `app/shared/dialog` and `app/shared/ui-library` may import. Open dialogs with the shared `DialogService` and show notifications with `ToastService`. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Call the server only through the generated services and models in `src/main/webapp/app/generated`. Do not write custom API wrappers or interfaces. [OpenAPI](docs/docs/developer/general-guidelines/openapi.mdx)
- All user-visible text goes through translation with the `jhiTranslate` directive, not the pipe. Add keys to both `src/main/webapp/i18n/en/<area>.json` and `src/main/webapp/i18n/de/<area>.json`. `en.json` and `de.json` are generated bundles; never edit them. Run `node prebuild.mjs` to rebuild them. [client development](docs/docs/developer/client-guidelines/client-development.mdx)
- Colour only with the semantic tokens in `content/scss/_tokens.scss` (`bg-primary-default`, `text-text-secondary`, `border-border-default`, ...). Never hard-code a colour: no hex or `rgb()` values, no Tailwind palette classes such as `bg-blue-50`, no arbitrary values such as `text-[#333]` or `text-[var(--palette-primary-color)]`. Do not add a palette value or token when an existing one fits; a new one needs a value for every theme in `_palette.scss`. Style shared and kit components through their inputs and the native `class` attribute, never their internals. [client styling](docs/docs/developer/client-guidelines/client-styling.mdx) · [colour theming](docs/docs/developer/client-guidelines/color-theming.mdx)
- Give a shared component a class input (`classStyling`, `widthClass`, ...) only when the classes must reach an element that a `class` on the component cannot style, such as an overlay panel or the native control inside. Layout on the component itself goes through `class`.
- Style with Tailwind classes: no inline `style` or `[style.x]` bindings, no `[ngClass]`, no `::ng-deep` and no important modifiers (`!` or `!important`). The kit and Quill styles sit in cascade layers below Tailwind's utilities, so a plain class already wins; the only exception is a size a kit component fixes in its own component styles. Put conditional classes in a `computed()`. [client styling](docs/docs/developer/client-guidelines/client-styling.mdx)
- Format ICU plurals through the project's `IcuTranslateCompiler`. Do not add `ngx-translate-messageformat-compiler`; it breaks the production build.
- Give a Tailwind `sr-only` element a `relative` parent. The app shell has a single scroll container, and an unanchored `sr-only` element adds a second scrollbar.

### Everywhere

- Never hardcode the platform name. It is an admin setting with the default `DocApply`. Use `{siteName}` in client translations and `${SITE_NAME!}` in server email templates.
- Remove unreachable code, even when its only user is its own test. Required checks run on every PR: `python3 supporting_scripts/check_dead_code.py` and `pnpm run dead-code:client`.
- Use **client** and **server**, not "frontend" or "backend". This also applies to commit messages, PR text and issues.
- Follow the [comment rule](#comments) above.
- Do not add a dependency for what a few lines of code or an existing library already does.
- All code and comments are in English. UI text follows the [language guidelines](docs/docs/developer/client-guidelines/language-guidelines.mdx).

## Repository boundaries

- The server uses Spring Boot and Java 25; the client uses Angular 22. Use the Gradle wrapper, Node 24 and pnpm (`corepack enable`). Exact versions live in `build.gradle`, `gradle.properties` and `package.json`.
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
- Client specs never import `TranslateModule.forRoot()` or whole production modules; use `provideTranslateMock()` from `src/test/webapp/util/translate.mock.ts` and `MockComponent`, `MockPipe` or `MockProvider`. Never use `NO_ERRORS_SCHEMA` or `overrideTemplate()`. Combine cases that differ only in input with `it.each`. [client tests](docs/docs/developer/client-guidelines/client-tests.mdx)
- Server test names follow `should<Behaviour>When<State>`. Use AssertJ with its specific assertions (`hasSize`, `isPresent`, `contains`) and build data with the test factories. [server tests](docs/docs/developer/server-guidelines/server-tests.mdx)
- Client test names start with `should`. Test behaviour, not initialization, styling or getters. Prefer `toHaveBeenCalledOnce()`. Vitest has no `toBeTrue()`; use `toBe(true)`. [client tests](docs/docs/developer/client-guidelines/client-tests.mdx)
- ESLint ignores `src/test/webapp/**`. Prettier is the only style gate on specs, so run `pnpm run prettier:check` before pushing.
- See [write-tests](.claude/skills/write-tests/SKILL.md) for commands and patterns.

## Commits and pull requests

- Target `main`. Branch names start with `chore/`, `feat/`, `test/`, `bugfix/` or `general/`, followed by kebab-case. [branches](docs/docs/developer/general-guidelines/branch-guidelines.mdx)
- PR titles match `` `Bugfix|Development|Documentation|Test|General`: Capitalized title ``, e.g. `` `Development`: Add application dashboard page ``. `pr-check.yml` enforces the pattern. Write the title from the user's point of view, in plain English.
- Link every PR to an issue. Search for an existing issue before creating one. Fill in `.github/PULL_REQUEST_TEMPLATE.md` and remove sections that do not apply. [pull requests](docs/docs/developer/general-guidelines/pull-request-guidelines.mdx)
- Keep PRs small (XS to M). Stage specific files; never `git add -A`, which picks up build output and logs.
- Commit subjects are short and imperative.
- When you review a PR, check only the changed lines against this file and the guidelines, and report a finding only when you are certain it breaks a rule.
