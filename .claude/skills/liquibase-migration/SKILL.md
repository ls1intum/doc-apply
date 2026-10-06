---
name: liquibase-migration
description: Use when adding or changing a database table, column, index or constraint in DocApply, when an entity change needs a schema change, or when a Liquibase changeset fails on startup or in tests.
---

# Liquibase migration

DocApply runs on PostgreSQL 18. Liquibase applies every changelog in `src/main/resources/config/liquibase/master.xml` on server start and in the Testcontainers PostgreSQL used by server tests. The whole schema up to the PostgreSQL switch is one baseline, `00000000000000_postgresql_baseline.xml`; new migrations go in new files after it. The full rules are in [liquibase-guidelines.mdx](../../../docs/docs/developer/server-guidelines/liquibase-guidelines.mdx) and [database-and-performance.mdx](../../../docs/docs/developer/server-guidelines/database-and-performance.mdx).

## Checklist

1. Find the next number: the last `<include>` in `master.xml`. Files are named `000000000000NN_<snake_case_purpose>.xml` under `changelog/`; the first one after the baseline is `00000000000001_…`.
2. Put the whole logical migration in one file. One file can hold several changesets.
3. Changeset IDs start with the file number. With several changesets, add a letter: `001a_…`, `001b_…`. With one, no letter: `001_add_status_column_to_application`.
4. Set `author` to your own name. Look at the existing changelogs for the name you used before, and keep using it.
5. Guard every changeset with `<preConditions onFail="MARK_RAN">`, so a re-run or a partially migrated database does not fail.
6. Register the file at the bottom of `master.xml`, above the `jhipster-needle` comments, with `relativeToChangelogFile="true"`. A file that is not registered never runs.
7. Update the `@Entity` in the same change. A new entity needs `@ExportedUserData` or `@NoUserDataExportRequired`, or `TechnicalStructureTest` fails.
8. Run the migration (see Verify).

## Column and index conventions

- Timestamps are `timestamp(3) with time zone`, like `created_at` and `last_modified_at` in the baseline.
- UUID keys are `uuid`, not `char(36)` or `varchar`.
- Prefer a default value over a nullable column. Make a column nullable only when it has to be.
- Add an index for columns used in `WHERE`, `JOIN` or sorting on large tables.
- An ordered `List` with `@OrderColumn` needs its order column created here. Hibernate does not create it.
- Use `<sql>` for data migrations. Keep them idempotent: update only rows still in the old shape.

## Preconditions

| Change                       | Guard                                                                   |
| ---------------------------- | ----------------------------------------------------------------------- |
| `createTable`                | `<not><tableExists tableName="t"/></not>`                               |
| `addColumn`                  | `<not><columnExists tableName="t" columnName="c"/></not>`               |
| `dropColumn`, `renameColumn` | `<columnExists tableName="t" columnName="c"/>`                          |
| `createIndex`                | `<not><indexExists tableName="t" indexName="idx_…"/></not>`             |
| `addUniqueConstraint`        | `<not><indexExists tableName="t" indexName="<constraint name>"/></not>` |
| `addForeignKeyConstraint`    | `<not><foreignKeyConstraintExists foreignKeyName="fk_…"/></not>`        |

Guard `addUniqueConstraint` with `indexExists` on the constraint name. PostgreSQL backs every unique constraint with an index of the same name, so the check is reliable.

## Example

```xml
<changeSet id="001a_add_status_to_applications" author="your-name">
  <preConditions onFail="MARK_RAN">
    <not>
      <columnExists tableName="applications" columnName="status"/>
    </not>
  </preConditions>
  <addColumn tableName="applications">
    <column name="status" type="varchar(32)" defaultValue="DRAFT">
      <constraints nullable="false"/>
    </column>
  </addColumn>
</changeSet>
```

## Verify

- Start the server against local PostgreSQL: `./gradlew -x webapp`. Liquibase runs on startup and logs each changeset it applies.
- Or run any resource test, which boots a fresh Testcontainers PostgreSQL and applies every changelog: `./gradlew test --tests 'RatingResourceTest*' -x webapp`.
- Run the architecture tests after entity changes: `./gradlew test -DincludeTags='ArchitectureTest' -x webapp`.

## Common failures

| Symptom                                            | Cause and fix                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Validation Failed: 1 changesets check sum was: …` | A changeset that already ran was edited. Revert it and add a new changeset instead. Never edit a merged changeset.                   |
| Migration silently does nothing                    | The file is missing from `master.xml`, or a precondition marked it `MARK_RAN`. Check the `DATABASECHANGELOG` table.                  |
| A renumbered file runs every changeset again       | The file name is part of a changeset's identity. Only renumber before merge, and make sure every precondition actually guards.       |
| `column "…" does not exist` at runtime             | Hibernate does not create or validate the schema (`ddl-auto: none`). The entity changed but no registered changeset adds the column. |
