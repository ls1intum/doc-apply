---
name: write-tests
description: Use when writing, fixing or reviewing DocApply tests, whether server JUnit resource tests under src/test/java or client Vitest specs under src/test/webapp, or when a test fails locally or in CI.
---

# Write tests

The full guidelines are [server-tests.mdx](../../../docs/docs/developer/server-guidelines/server-tests.mdx) and [client-tests.mdx](../../../docs/docs/developer/client-guidelines/client-tests.mdx). Both test trees mirror the source package structure.

## Server (JUnit 5, AssertJ, Testcontainers PostgreSQL)

Docker must be running; tests start their own PostgreSQL 18 container (`jdbc:tc:postgresql` in `src/test/resources/application-test.properties`).

### Where tests go

- Test at the resource layer: `<module>/web/rest/<Name>ResourceTest.java`, extending `de.tum.cit.aet.AbstractResourceTest`.
- Do not add `*ServiceTest` classes. Service behaviour is covered through the endpoint that uses it. A few legacy service tests exist; do not extend them.
- Architecture rules live in `DTOArchitectureTest` and `TechnicalStructureTest`.

### Building blocks

| Need                 | Use                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Clean state per test | `@Autowired DatabaseCleaner databaseCleaner;` then `databaseCleaner.clean()` in `@BeforeEach`     |
| Test data            | `utility/testdata/*TestData` factories, e.g. `UserTestData.savedProfessor(userRepository, group)` |
| HTTP calls           | `@Autowired MvcTestClient api;` with `getAndRead`, `postAndRead`, `putAndRead`, `deleteAndRead`   |
| Authenticated user   | `api.with(JwtPostProcessors.jwtUser(user.getUserId(), "ROLE_PROFESSOR"))`                         |
| Mock a collaborator  | `Mockito.mock(...)` plus `ReflectionTestUtils.setField(...)`, not `@MockitoBean`                  |

If no factory method fits, add one to the closest `*TestData` class with JavaDoc.

### Rules

- Name tests `should<ExpectedBehavior>When<StateUnderTest>` and group them with `@Nested`.
- Use the most specific AssertJ assertion: `assertThat(list).hasSize(1)`, not `assertThat(list.size()).isEqualTo(1)`.
- Use deterministic data and IDs returned by the database. Never hardcode IDs.
- Cover the authorization cases: the owner, another user of the same role, and a role that must get `403`.
- Never put `@MockitoBean`, `@MockitoSpyBean`, `@TestPropertySource`, `@ActiveProfiles`, `@DirtiesContext`, `@ContextConfiguration` or `@Import` on a concrete test class. Each one starts another Spring context. Shared setup belongs in the abstract base class.
- Do not use `@Isolated`. Tests run in parallel and must not share mutable state.

### Commands

```bash
./gradlew test --tests 'RatingResourceTest*' -x webapp                    # one class, including @Nested classes
./gradlew test -DincludeTags='ArchitectureTest' -x webapp                 # architecture tests
./gradlew test jacocoTestReport -x webapp                                 # all tests plus coverage
open build/reports/jacoco/test/html/index.html
```

CI also runs `./gradlew spotlessCheck -Pprod` and `./gradlew checkstyleMain -x webapp -Pprod`.

## Client (Vitest, ng-mocks)

Specs live in `src/test/webapp/app/...`, mirroring `src/main/webapp/app/...`. Shared helpers are in `src/test/webapp/util/`.

### What to test

- Test observable behaviour: user interactions, output emissions, branches, computed signals, HTTP requests and error paths, validators, pure utilities.
- Do not write `should create` or `toBeTruthy()` existence tests, styling or class-presence checks, getter or setter round-trips, or tests that only check a default value. Delete them when you touch a file that has them.
- Collapse three or more similar tests into one `it.each` table.

### Rules

- Every `it(...)` title starts with `should`.
- Mock dependencies individually with `MockComponent`, `MockPipe`, `MockDirective` and `MockProvider`. Never import full modules, never use `NO_ERRORS_SCHEMA` or `overrideTemplate()`.
- Create mocks inside `beforeEach`, not at module scope, so call counts do not leak between tests. After the first `fixture.detectChanges()`, `await fixture.whenStable()` and `vi.clearAllMocks()` if initialization calls would pollute assertions.
- Clean up in `afterEach`: `httpMock.verify()` when using `HttpTestingController`, and `vi.restoreAllMocks()`.
- Prefer `toHaveBeenCalledOnce()` over `toHaveBeenCalled()` or `toHaveBeenCalledTimes(1)`.
- Vitest has no `toBeTrue()` or `toBeFalse()`. Use `toBe(true)` and `toBe(false)`.
- Production style rules apply to specs: no object or array spread, no `as any`. Reach private members with `component['member']`; for a typed view use `as unknown as <Type>`.

### Commands

```bash
pnpm exec vitest run src/test/webapp/app/path/to/thing.spec.ts           # one spec
pnpm run test                                                            # all specs plus coverage
pnpm run test:ci                                                         # with CI thresholds
pnpm run compile:ts:tests                                                # type-check specs
pnpm run prettier:check                                                  # format gate for specs
```

ESLint ignores `src/test/webapp/**`, so Prettier and `compile:ts:tests` are the only CI gates on spec style and types. Run both before pushing.

## CI failures

| Symptom                                        | Fix                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Server coverage below 60% lines, 32% branches  | Add resource-level tests for the changed endpoints; check `build/reports/jacoco/test/html/index.html`. |
| Client coverage below 50/40/50/50              | Add behaviour tests for the changed code; check `build/test-results/vitest/coverage/index.html`.       |
| Server tests slow, many context starts in logs | A concrete test class added a context-changing annotation. Move it to the base class.                  |
| Test passes alone, fails in the suite          | Shared state. Clean the database in `@BeforeEach`, or move client mocks into `beforeEach`.             |
