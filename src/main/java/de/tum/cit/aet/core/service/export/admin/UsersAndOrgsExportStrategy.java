package de.tum.cit.aet.core.service.export.admin;

import de.tum.cit.aet.core.dto.exportdata.admin.AdminResearchGroupExportDTO;
import de.tum.cit.aet.core.dto.exportdata.admin.AdminUserExportDTO;
import de.tum.cit.aet.core.exception.UserDataExportException;
import de.tum.cit.aet.core.service.ZipExportService;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.usermanagement.constants.UserRole;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.Department;
import de.tum.cit.aet.usermanagement.domain.ResearchGroup;
import de.tum.cit.aet.usermanagement.domain.School;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.domain.UserResearchGroupRole;
import de.tum.cit.aet.usermanagement.dto.DepartmentDTO;
import de.tum.cit.aet.usermanagement.dto.SchoolShortDTO;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.DepartmentRepository;
import de.tum.cit.aet.usermanagement.repository.ResearchGroupRepository;
import de.tum.cit.aet.usermanagement.repository.SchoolRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipOutputStream;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Produces the {@link de.tum.cit.aet.core.constants.AdminExportType#USERS_AND_ORGS}
 * export: a lean JSON-only snapshot of the people and organisational
 * structure that can be used to re-seed the database after a hard reset.
 *
 * <p>Contents of the produced ZIP:
 * <pre>
 * users-and-orgs/
 * ├── manifest.json
 * └── _machine_readable/
 *     ├── schools.json
 *     ├── departments.json
 *     ├── research_groups.json
 *     ├── users.json
 *     ├── user_research_group_roles.json
 *     ├── applicants.json
 *     └── applicant_subject_area_subscriptions.json
 * </pre>
 *
 * <p>No PDFs, no XLSX, no binary documents, no jobs and no applications —
 * this export is for disaster recovery / migration only. Jobs, applications
 * and documents are transient operational data that the full admin export
 * already covers; the users-and-orgs export is intentionally minimal so it
 * is fast to build and trivial to re-import.
 *
 * <p>The {@code user_research_group_roles.json},
 * {@code applicants.json} and {@code applicant_subject_area_subscriptions.json}
 * files mirror their underlying tables literally — one flat row per database
 * row — so a re-import script can {@code INSERT} straight into the target
 * table without having to walk any nested structures.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UsersAndOrgsExportStrategy {

    private final SchoolRepository schoolRepository;
    private final DepartmentRepository departmentRepository;
    private final ResearchGroupRepository researchGroupRepository;
    private final UserRepository userRepository;
    private final ApplicantRepository applicantRepository;
    private final ResearchGroupsExportStrategy researchGroupsExportStrategy;
    private final ZipExportService zipExportService;
    private final ObjectMapper objectMapper;

    /**
     * Writes all seven JSON dumps (schools, departments, research groups,
     * users, user↔research-group roles, applicants and applicant subject-area
     * subscriptions) into the supplied ZIP output stream and records every
     * entity in the manifest. The method is intentionally simple: no
     * per-job iteration, no lazy loading trickery, no XLSX / PDF work — it
     * just serialises seven flat lists.
     *
     * @param zos      open ZIP output stream rooted at the export's top-level folder
     * @param manifest export-wide audit trail; all produced entities are recorded against it
     */
    public void exportUsersAndOrgs(@NonNull ZipOutputStream zos, @NonNull ExportManifest manifest) {
        writeSchools(zos, manifest);
        writeDepartments(zos, manifest);
        writeResearchGroups(zos, manifest);
        List<User> users = writeUsers(zos, manifest);
        writeUserResearchGroupRoles(zos, manifest, users);
        List<Applicant> applicants = writeApplicants(zos, manifest);
        writeApplicantSubjectAreaSubscriptions(zos, manifest, applicants);
    }

    private void writeSchools(ZipOutputStream zos, ExportManifest manifest) {
        List<School> schools = schoolRepository
            .findAll()
            .stream()
            .sorted(Comparator.comparing(School::getName, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        manifest.expect(ExportManifest.Category.SCHOOL, schools.size());
        List<SchoolShortDTO> dtos = new ArrayList<>(schools.size());
        for (School school : schools) {
            try {
                dtos.add(SchoolShortDTO.fromEntity(school));
                manifest.exported(ExportManifest.Category.SCHOOL);
            } catch (Exception e) {
                log.warn("Failed to convert school {} for users-and-orgs export", school.getSchoolId(), e);
                manifest.failed(ExportManifest.Category.SCHOOL, school.getSchoolId(), school.getName(), e);
            }
        }
        writeJsonEntry(zos, "_machine_readable/schools.json", dtos);
    }

    private void writeDepartments(ZipOutputStream zos, ExportManifest manifest) {
        List<Department> departments = departmentRepository
            .findAll()
            .stream()
            .sorted(Comparator.comparing(Department::getName, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        manifest.expect(ExportManifest.Category.DEPARTMENT, departments.size());
        List<DepartmentDTO> dtos = new ArrayList<>(departments.size());
        for (Department department : departments) {
            try {
                dtos.add(DepartmentDTO.fromEntity(department));
                manifest.exported(ExportManifest.Category.DEPARTMENT);
            } catch (Exception e) {
                log.warn("Failed to convert department {} for users-and-orgs export", department.getDepartmentId(), e);
                manifest.failed(ExportManifest.Category.DEPARTMENT, department.getDepartmentId(), department.getName(), e);
            }
        }
        writeJsonEntry(zos, "_machine_readable/departments.json", dtos);
    }

    private void writeResearchGroups(ZipOutputStream zos, ExportManifest manifest) {
        List<ResearchGroup> groups = researchGroupRepository
            .findAll()
            .stream()
            .sorted(Comparator.comparing(ResearchGroup::getName, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        manifest.expect(ExportManifest.Category.RESEARCH_GROUP, groups.size());
        List<AdminResearchGroupExportDTO> dtos = new ArrayList<>(groups.size());
        for (ResearchGroup group : groups) {
            try {
                dtos.add(researchGroupsExportStrategy.toDto(group));
                manifest.exported(ExportManifest.Category.RESEARCH_GROUP);
            } catch (Exception e) {
                log.warn("Failed to convert research group {} for users-and-orgs export", group.getResearchGroupId(), e);
                manifest.failed(ExportManifest.Category.RESEARCH_GROUP, group.getResearchGroupId(), group.getName(), e);
            }
        }
        writeJsonEntry(zos, "_machine_readable/research_groups.json", dtos);
    }

    private List<User> writeUsers(ZipOutputStream zos, ExportManifest manifest) {
        List<User> users = userRepository
            .findAll()
            .stream()
            .sorted(Comparator.comparing(User::getLastName, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        manifest.expect(ExportManifest.Category.USER, users.size());
        List<AdminUserExportDTO> dtos = new ArrayList<>(users.size());
        for (User user : users) {
            try {
                dtos.add(AdminUserExportDTO.getFromEntity(user));
                manifest.exported(ExportManifest.Category.USER);
            } catch (Exception e) {
                log.warn("Failed to convert user {} for users-and-orgs export", user.getUserId(), e);
                manifest.failed(ExportManifest.Category.USER, user.getUserId(), user.getEmail(), e);
            }
        }
        writeJsonEntry(zos, "_machine_readable/users.json", dtos);
        return users;
    }

    /**
     * Writes a flat dump of the {@code user_research_group_roles} join table:
     * one row per {@code (userId, researchGroupId, role)} triple, straight
     * from {@link User#getResearchGroupRoles()}. The join row's own primary
     * key is intentionally omitted — it is opaque, nothing downstream
     * references it, and re-import will generate fresh UUIDs.
     *
     * @param zos       open ZIP output stream
     * @param manifest  audit trail; every role row is recorded individually
     * @param users     the users loaded by {@link #writeUsers} (reused so we
     *                  don't hit the repository twice)
     */
    private void writeUserResearchGroupRoles(ZipOutputStream zos, ExportManifest manifest, List<User> users) {
        List<UserResearchGroupRoleRow> rows = new ArrayList<>();
        for (User user : users) {
            if (user.getResearchGroupRoles() == null) {
                continue;
            }
            for (UserResearchGroupRole role : user.getResearchGroupRoles()) {
                manifest.expect(ExportManifest.Category.USER_RESEARCH_GROUP_ROLE, 1);
                try {
                    rows.add(
                        new UserResearchGroupRoleRow(
                            user.getUserId(),
                            role.getResearchGroup() == null ? null : role.getResearchGroup().getResearchGroupId(),
                            role.getRole()
                        )
                    );
                    manifest.exported(ExportManifest.Category.USER_RESEARCH_GROUP_ROLE);
                } catch (Exception e) {
                    log.warn(
                        "Failed to convert user_research_group_role {} for users-and-orgs export",
                        role.getUserResearchGroupRoleId(),
                        e
                    );
                    manifest.failed(
                        ExportManifest.Category.USER_RESEARCH_GROUP_ROLE,
                        role.getUserResearchGroupRoleId(),
                        user.getEmail(),
                        e
                    );
                }
            }
        }
        writeJsonEntry(zos, "_machine_readable/user_research_group_roles.json", rows);
    }

    /**
     * Flat representation of one row in the {@code user_research_group_roles}
     * join table. Intentionally nested inside the strategy — this shape is
     * only used by the users-and-orgs export and doesn't justify a top-level
     * DTO.
     */
    private record UserResearchGroupRoleRow(UUID userId, UUID researchGroupId, UserRole role) {}

    /**
     * Writes a flat dump of the {@code applicants} table: one row per applicant
     * profile with {@code userId} as the primary key (one-to-one with
     * {@link User} via {@code @MapsId}). The subject-area subscription join
     * table is handled separately by
     * {@link #writeApplicantSubjectAreaSubscriptions} — this file carries only
     * the scalar columns of the {@code applicants} table.
     *
     * @param zos      open ZIP output stream
     * @param manifest audit trail; every applicant row is recorded individually
     * @return the applicants loaded from the repository, reused by the caller
     *         so the subject-subscription writer does not have to hit the DB twice
     */
    private List<Applicant> writeApplicants(ZipOutputStream zos, ExportManifest manifest) {
        List<Applicant> applicants = applicantRepository
            .findAll()
            .stream()
            .sorted(
                Comparator.comparing(
                    a -> a.getUserId() == null ? null : a.getUserId().toString(),
                    Comparator.nullsLast(Comparator.naturalOrder())
                )
            )
            .toList();
        manifest.expect(ExportManifest.Category.APPLICANT, applicants.size());
        List<ApplicantRow> rows = new ArrayList<>(applicants.size());
        for (Applicant applicant : applicants) {
            try {
                rows.add(
                    new ApplicantRow(
                        applicant.getUserId(),
                        applicant.getStreet(),
                        applicant.getPostalCode(),
                        applicant.getCity(),
                        applicant.getCountry(),
                        applicant.getBachelorDegreeName(),
                        applicant.getBachelorGradeUpperLimit(),
                        applicant.getBachelorGradeLowerLimit(),
                        applicant.getBachelorGrade(),
                        applicant.getBachelorUniversity(),
                        applicant.getMasterDegreeName(),
                        applicant.getMasterGradeUpperLimit(),
                        applicant.getMasterGradeLowerLimit(),
                        applicant.getMasterGrade(),
                        applicant.getMasterUniversity()
                    )
                );
                manifest.exported(ExportManifest.Category.APPLICANT);
            } catch (Exception e) {
                log.warn("Failed to convert applicant {} for users-and-orgs export", applicant.getUserId(), e);
                manifest.failed(ExportManifest.Category.APPLICANT, applicant.getUserId(), null, e);
            }
        }
        writeJsonEntry(zos, "_machine_readable/applicants.json", rows);
        return applicants;
    }

    /**
     * Writes a flat dump of the {@code applicant_subject_area_subscriptions}
     * join table: one row per {@code (userId, subjectArea)} pair, pulled
     * straight from {@link Applicant#getSubjectAreaSubscriptions()}. Mirrors
     * the same shape used for {@code user_research_group_roles.json} so
     * re-import scripts can {@code INSERT} directly into the target table.
     *
     * @param zos        open ZIP output stream
     * @param manifest   audit trail; each subscription row is recorded individually
     * @param applicants the applicants loaded by {@link #writeApplicants}
     *                   (reused so we don't hit the repository twice)
     */
    private void writeApplicantSubjectAreaSubscriptions(ZipOutputStream zos, ExportManifest manifest, List<Applicant> applicants) {
        List<ApplicantSubjectAreaRow> rows = new ArrayList<>();
        for (Applicant applicant : applicants) {
            if (applicant.getSubjectAreaSubscriptions() == null) {
                continue;
            }
            for (SubjectArea subjectArea : applicant.getSubjectAreaSubscriptions()) {
                manifest.expect(ExportManifest.Category.APPLICANT_SUBJECT_AREA_SUBSCRIPTION, 1);
                try {
                    rows.add(new ApplicantSubjectAreaRow(applicant.getUserId(), subjectArea));
                    manifest.exported(ExportManifest.Category.APPLICANT_SUBJECT_AREA_SUBSCRIPTION);
                } catch (Exception e) {
                    log.warn(
                        "Failed to convert applicant subject area subscription ({}, {}) for users-and-orgs export",
                        applicant.getUserId(),
                        subjectArea,
                        e
                    );
                    manifest.failed(
                        ExportManifest.Category.APPLICANT_SUBJECT_AREA_SUBSCRIPTION,
                        applicant.getUserId(),
                        subjectArea == null ? null : subjectArea.name(),
                        e
                    );
                }
            }
        }
        writeJsonEntry(zos, "_machine_readable/applicant_subject_area_subscriptions.json", rows);
    }

    /**
     * Flat representation of one row in the {@code applicants} table. Only
     * the columns re-import needs — the linked {@link User} is already
     * written to {@code users.json} and the subject-area subscriptions go
     * into their own file.
     */
    private record ApplicantRow(
        UUID userId,
        String street,
        String postalCode,
        String city,
        String country,
        String bachelorDegreeName,
        String bachelorGradeUpperLimit,
        String bachelorGradeLowerLimit,
        String bachelorGrade,
        String bachelorUniversity,
        String masterDegreeName,
        String masterGradeUpperLimit,
        String masterGradeLowerLimit,
        String masterGrade,
        String masterUniversity
    ) {}

    /**
     * Flat representation of one row in the
     * {@code applicant_subject_area_subscriptions} element-collection table.
     */
    private record ApplicantSubjectAreaRow(UUID userId, SubjectArea subjectArea) {}

    private void writeJsonEntry(ZipOutputStream zos, String entryPath, Object payload) {
        try {
            byte[] bytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(payload);
            zipExportService.addFileToZip(zos, entryPath, bytes);
        } catch (IOException e) {
            throw new UserDataExportException("Failed to write JSON entry " + entryPath, e);
        }
    }
}
