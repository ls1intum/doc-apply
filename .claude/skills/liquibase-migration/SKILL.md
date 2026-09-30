---
name: liquibase-migration
description: Use when adding or changing a database table, column, index or constraint in DocApply, when an entity change needs a schema change, or when a Liquibase changeset fails on startup or in tests.
---

# Liquibase migration

DocApply runs on MySQL. Liquibase applies every changelog in `src/main/resources/config/liquibase/master.xml` on server start and in the Testcontainers MySQL used by server tests. The full rules are in [liquibase-guidelines.mdx](../../../docs/docs/developer/server-guidelines/liquibase-guidelines.mdx) and [database-and-performance.mdx](../../../docs/docs/developer/server-guidelines/database-and-performance.mdx).

## Checklist

1. Find the next number: the last `<include>` in `master.xml`. Files are named `000000000000NN_<snake_case_purpose>.xml` under `changelog/`.
2. Put the whole logical migration in one file. One file can hold several changesets.
3. Changeset IDs start with the file number. With several changesets, add a letter: `055a_…`, `055b_…`. With one, no letter: `055_add_status_column_to_application`.
4. Set `author` to your own name. Look at the existing changelogs for the name you used before, and keep using it.
5. Guard every changeset with `<preConditions onFail="MARK_RAN">`, so a re-run or a partially migrated database does not fail.
6. Register the file at the bottom of `master.xml`, above the `jhipster-needle` comments, with `relativeToChangelogFile="true"`. A file that is not registered never runs.
7. Update the `@Entity` in the same change. A new entity needs `@ExportedUserData` or `@NoUserDataExportRequired`, or `TechnicalStructureTest` fails.
8. Run the migration (see Verify).

## Column and index conventions

- Timestamps are `DATETIME(3)`, not `TIMESTAMP`.
- UUID keys are `CHAR(36)`.
- Prefer a default value over a nullable column. Make a column nullable only when it has to be.
- Add an index for columns used in `WHERE`, `JOIN` or sorting on large tables.
- An ordered `List` with `@OrderColumn` needs its order column created here. Hibernate does not create it.
- Use `<sql>` for data migrations. Keep them idempotent: update only rows still in the old shape.

## Preconditions that work on MySQL

| Change                       | Guard                                                                   |
| ---------------------------- | ----------------------------------------------------------------------- |
| `createTable`                | `<not><tableExists tableName="t"/></not>`                               |
| `addColumn`                  | `<not><columnExists tableName="t" columnName="c"/></not>`               |
| `dropColumn`, `renameColumn` | `<columnExists tableName="t" columnName="c"/>`                          |
| `createIndex`                | `<not><indexExists tableName="t" indexName="idx_…"/></not>`             |
| `addUniqueConstraint`        | `<not><indexExists tableName="t" indexName="<constraint name>"/></not>` |
| `addForeignKeyConstraint`    | `<not><foreignKeyConstraintExists foreignKeyName="fk_…"/></not>`        |

Never use `uniqueConstraintExists`. On MySQL it never matches, whether keyed by name or by columns. The `<not>` guard always passes, the change runs again, and the migration dies with `Duplicate key name '…' (1061)`. MySQL backs a unique constraint with an index of the same name, so `indexExists` is the reliable check. Changelogs 008, 045 and 052 use this pattern.

## Example

```xml
<changeSet id="055a_add_status_to_applications" author="your-name">
  <preConditions onFail="MARK_RAN">
    <not>
      <columnExists tableName="applications" columnName="status"/>
    </not>
  </preConditions>
  <addColumn tableName="applications">
    <column name="status" type="VARCHAR(32)" defaultValue="DRAFT">
      <constraints nullable="false"/>
    </column>
  </addColumn>
</changeSet>
```

## Verify

- Start the server against local MySQL: `./gradlew -x webapp`. Liquibase runs on startup and logs each changeset it applies.
- Or run any resource test, which boots a fresh Testcontainers MySQL and applies every changelog: `./gradlew test --tests 'RatingResourceTest*' -x webapp`.
- Run the architecture tests after entity changes: `./gradlew test -DincludeTags='ArchitectureTest' -x webapp`.

## Common failures

| Symptom                                            | Cause and fix                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Validation Failed: 1 changesets check sum was: …` | A changeset that already ran was edited. Revert it and add a new changeset instead. Never edit a merged changeset.                   |
| `Duplicate key name '…' (1061)`                    | The unique constraint guard used `uniqueConstraintExists`. Switch to `indexExists`.                                                  |
| Migration silently does nothing                    | The file is missing from `master.xml`, or a precondition marked it `MARK_RAN`. Check the `DATABASECHANGELOG` table.                  |
| A renumbered file runs every changeset again       | The file name is part of a changeset's identity. Only renumber before merge, and make sure every precondition actually guards.       |
| `Unknown column '…' in 'field list'` at runtime    | Hibernate does not create or validate the schema (`ddl-auto: none`). The entity changed but no registered changeset adds the column. |
