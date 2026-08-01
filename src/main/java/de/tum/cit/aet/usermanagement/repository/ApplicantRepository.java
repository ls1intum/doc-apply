package de.tum.cit.aet.usermanagement.repository;

import de.tum.cit.aet.core.repository.DocApplyJpaRepository;
import de.tum.cit.aet.job.constants.SubjectArea;
import de.tum.cit.aet.job.domain.Job;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/**
 * Spring Data JPA repository for the {@link Job} entity.
 */
@Repository
public interface ApplicantRepository extends DocApplyJpaRepository<Applicant, UUID> {
    @Query(
        """
            SELECT DISTINCT applicant.user
            FROM Applicant applicant
            WHERE :subjectArea MEMBER OF applicant.subjectAreaSubscriptions
        """
    )
    Set<User> findAllBySubjectAreaSubscription(@Param("subjectArea") SubjectArea subjectArea);

    @Modifying
    @Query(
        value = """
            INSERT INTO applicants (
                user_id, street, postal_code, city, country,
                bachelor_degree_name, bachelor_grade_upper_limit, bachelor_grade_lower_limit, bachelor_grade, bachelor_university,
                master_degree_name, master_grade_upper_limit, master_grade_lower_limit, master_grade, master_university
            )
            VALUES (
                :userId, :street, :postalCode, :city, :country,
                :bachelorDegreeName, :bachelorGradeUpperLimit, :bachelorGradeLowerLimit, :bachelorGrade, :bachelorUniversity,
                :masterDegreeName, :masterGradeUpperLimit, :masterGradeLowerLimit, :masterGrade, :masterUniversity
            )
        """,
        nativeQuery = true
    )
    void insertApplicant(
        @Param("userId") UUID userId,
        @Param("street") String street,
        @Param("postalCode") String postalCode,
        @Param("city") String city,
        @Param("country") String country,
        @Param("bachelorDegreeName") String bachelorDegreeName,
        @Param("bachelorGradeUpperLimit") String bachelorGradeUpperLimit,
        @Param("bachelorGradeLowerLimit") String bachelorGradeLowerLimit,
        @Param("bachelorGrade") String bachelorGrade,
        @Param("bachelorUniversity") String bachelorUniversity,
        @Param("masterDegreeName") String masterDegreeName,
        @Param("masterGradeUpperLimit") String masterGradeUpperLimit,
        @Param("masterGradeLowerLimit") String masterGradeLowerLimit,
        @Param("masterGrade") String masterGrade,
        @Param("masterUniversity") String masterUniversity
    );

    @Modifying
    @Query(
        value = """
            UPDATE applicants SET
                street = :street,
                postal_code = :postalCode,
                city = :city,
                country = :country,
                bachelor_degree_name = :bachelorDegreeName,
                bachelor_grade_upper_limit = :bachelorGradeUpperLimit,
                bachelor_grade_lower_limit = :bachelorGradeLowerLimit,
                bachelor_grade = :bachelorGrade,
                bachelor_university = :bachelorUniversity,
                master_degree_name = :masterDegreeName,
                master_grade_upper_limit = :masterGradeUpperLimit,
                master_grade_lower_limit = :masterGradeLowerLimit,
                master_grade = :masterGrade,
                master_university = :masterUniversity
            WHERE user_id = :userId
        """,
        nativeQuery = true
    )
    void updateApplicant(
        @Param("street") String street,
        @Param("postalCode") String postalCode,
        @Param("city") String city,
        @Param("country") String country,
        @Param("bachelorDegreeName") String bachelorDegreeName,
        @Param("bachelorGradeUpperLimit") String bachelorGradeUpperLimit,
        @Param("bachelorGradeLowerLimit") String bachelorGradeLowerLimit,
        @Param("bachelorGrade") String bachelorGrade,
        @Param("bachelorUniversity") String bachelorUniversity,
        @Param("masterDegreeName") String masterDegreeName,
        @Param("masterGradeUpperLimit") String masterGradeUpperLimit,
        @Param("masterGradeLowerLimit") String masterGradeLowerLimit,
        @Param("masterGrade") String masterGrade,
        @Param("masterUniversity") String masterUniversity,
        @Param("userId") UUID userId
    );
}
