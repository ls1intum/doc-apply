package de.tum.cit.aet.application.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import de.tum.cit.aet.AbstractResourceTest;
import de.tum.cit.aet.application.domain.dto.ApplicationDocumentIdsDTO;
import de.tum.cit.aet.application.domain.dto.DocumentInformationHolderDTO;
import de.tum.cit.aet.core.constants.DocumentType;
import de.tum.cit.aet.core.documents.domain.Document;
import de.tum.cit.aet.core.documents.repository.DocumentRepository;
import de.tum.cit.aet.usermanagement.domain.Applicant;
import de.tum.cit.aet.usermanagement.domain.User;
import de.tum.cit.aet.usermanagement.dto.ApplicantDTO;
import de.tum.cit.aet.usermanagement.dto.UserDTO;
import de.tum.cit.aet.usermanagement.repository.ApplicantRepository;
import de.tum.cit.aet.usermanagement.repository.UserRepository;
import de.tum.cit.aet.utility.DatabaseCleaner;
import de.tum.cit.aet.utility.MvcTestClient;
import de.tum.cit.aet.utility.security.JwtPostProcessors;
import de.tum.cit.aet.utility.testdata.ApplicantTestData;
import de.tum.cit.aet.utility.testdata.DocumentTestData;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.core.type.TypeReference;

class ApplicantResourceTest extends AbstractResourceTest {

    @Autowired
    ApplicantRepository applicantRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    DocumentRepository documentRepository;

    @Autowired
    DatabaseCleaner databaseCleaner;

    @Autowired
    MvcTestClient api;

    Applicant applicant;

    @BeforeEach
    void setup() {
        databaseCleaner.clean();
        applicant = ApplicantTestData.savedWithNewUser(applicantRepository, userRepository);
    }

    @Nested
    class ApplicantProfileTests {

        @Test
        void getApplicantProfileReturnsProfileWithPersonalInformation() {
            ApplicantDTO profile = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .getAndRead("/api/applicants/profile", null, ApplicantDTO.class, 200);

            assertThat(profile).isNotNull();
            assertThat(profile.user()).isNotNull();
            assertThat(profile.user().userId()).isEqualTo(applicant.getUserId());
            assertThat(profile.user().email()).isEqualTo(applicant.getUser().getEmail());
            assertThat(profile.user().firstName()).isEqualTo(applicant.getUser().getFirstName());
            assertThat(profile.user().lastName()).isEqualTo(applicant.getUser().getLastName());
            assertThat(profile.street()).isEqualTo(applicant.getStreet());
            assertThat(profile.city()).isEqualTo(applicant.getCity());
            assertThat(profile.country()).isEqualTo(applicant.getCountry());
        }

        @Test
        void getApplicantProfileWithoutAuthReturnsForbidden() {
            Void response = api.getAndRead("/api/applicants/profile", null, Void.class, 403);
            assertThat(response).isNull();
        }

        @Test
        void getApplicantProfileCreatesApplicantForExistingUserWithoutApplicationHistory() {
            User userWithoutApplicant = ApplicantTestData.saveApplicant("new-applicant@test.local", userRepository);

            ApplicantDTO profile = api
                .with(JwtPostProcessors.jwtUser(userWithoutApplicant.getUserId(), "ROLE_APPLICANT"))
                .getAndRead("/api/applicants/profile", null, ApplicantDTO.class, 200);

            assertThat(profile).isNotNull();
            assertThat(profile.user()).isNotNull();
            assertThat(profile.user().userId()).isEqualTo(userWithoutApplicant.getUserId());
            assertThat(profile.user().email()).isEqualTo(userWithoutApplicant.getEmail());
            assertThat(applicantRepository.findById(userWithoutApplicant.getUserId())).isPresent();
        }

        @Test
        void updateApplicantProfileUpdatesPersonalInformation() {
            UserDTO updatedUserDTO = new UserDTO(
                applicant.getUserId(),
                "updated.email@example.com",
                applicant.getUser().getAvatar(),
                "UpdatedFirstName",
                "UpdatedLastName",
                "Other",
                "German",
                LocalDate.of(1995, 5, 15),
                "+49123456789",
                "https://updated-website.com",
                "https://linkedin.com/in/updated",
                "en",
                null
            );

            ApplicantDTO updatePayload = new ApplicantDTO(
                updatedUserDTO,
                "Updated Street 123",
                "80333",
                "Munich",
                "Germany",
                "Computer Science",
                "2.0",
                "5.0",
                "1.5",
                "Technical University of Munich",
                "Informatics",
                "1.0",
                "5.0",
                "1.3",
                "TUM",
                false,
                false,
                null
            );

            ApplicantDTO updatedProfile = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile", updatePayload, ApplicantDTO.class, 200);

            assertThat(updatedProfile).isNotNull();
            assertThat(updatedProfile.user().email()).isEqualTo("updated.email@example.com");
            assertThat(updatedProfile.user().firstName()).isEqualTo("UpdatedFirstName");
            assertThat(updatedProfile.user().lastName()).isEqualTo("UpdatedLastName");
            assertThat(updatedProfile.user().gender()).isEqualTo("Other");
            assertThat(updatedProfile.user().nationality()).isEqualTo("German");
            assertThat(updatedProfile.street()).isEqualTo("Updated Street 123");
            assertThat(updatedProfile.postalCode()).isEqualTo("80333");
            assertThat(updatedProfile.city()).isEqualTo("Munich");
            assertThat(updatedProfile.country()).isEqualTo("Germany");
            assertThat(updatedProfile.bachelorDegreeName()).isEqualTo("Computer Science");
            assertThat(updatedProfile.bachelorGrade()).isEqualTo("1.5");
            assertThat(updatedProfile.masterDegreeName()).isEqualTo("Informatics");
            assertThat(updatedProfile.masterGrade()).isEqualTo("1.3");

            Applicant persistedApplicant = applicantRepository.findById(applicant.getUserId()).orElseThrow();
            assertThat(persistedApplicant.getUser().getEmail()).isEqualTo("updated.email@example.com");
            assertThat(persistedApplicant.getUser().getFirstName()).isEqualTo("UpdatedFirstName");
            assertThat(persistedApplicant.getUser().getLastName()).isEqualTo("UpdatedLastName");
            assertThat(persistedApplicant.getStreet()).isEqualTo("Updated Street 123");
            assertThat(persistedApplicant.getCity()).isEqualTo("Munich");
            assertThat(persistedApplicant.getBachelorDegreeName()).isEqualTo("Computer Science");
            assertThat(persistedApplicant.getMasterGrade()).isEqualTo("1.3");
        }

        @Test
        void updateApplicantProfileWithNullUserReturnsBadRequest() {
            ApplicantDTO invalidPayload = new ApplicantDTO(
                null,
                "Street 123",
                "80333",
                "Munich",
                "Germany",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                false,
                null
            );

            Void response = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile", invalidPayload, Void.class, 400);

            assertThat(response).isNull();
        }

        @Test
        void updateApplicantProfileWithoutAuthReturnsForbidden() {
            UserDTO userDTO = new UserDTO(
                applicant.getUserId(),
                applicant.getUser().getEmail(),
                applicant.getUser().getAvatar(),
                "FirstName",
                "LastName",
                "Male",
                "German",
                LocalDate.of(1990, 1, 1),
                null,
                null,
                null,
                "en",
                null
            );

            ApplicantDTO updatePayload = new ApplicantDTO(
                userDTO,
                "Street",
                "12345",
                "City",
                "Country",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                false,
                null
            );

            Void response = api.putAndRead("/api/applicants/profile", updatePayload, Void.class, 403);
            assertThat(response).isNull();
        }

        @Test
        void updateApplicantProfileWithPartialDataUpdatesOnlyProvidedFields() {
            UserDTO partialUserDTO = new UserDTO(
                applicant.getUserId(),
                applicant.getUser().getEmail(),
                applicant.getUser().getAvatar(),
                "NewFirstName",
                applicant.getUser().getLastName(),
                applicant.getUser().getGender(),
                applicant.getUser().getNationality(),
                applicant.getUser().getBirthday(),
                applicant.getUser().getPhoneNumber(),
                applicant.getUser().getWebsite(),
                applicant.getUser().getLinkedinUrl(),
                "en",
                null
            );

            ApplicantDTO partialUpdate = new ApplicantDTO(
                partialUserDTO,
                "New Street",
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
                applicant.getMasterUniversity(),
                false,
                false,
                null
            );

            ApplicantDTO updated = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile", partialUpdate, ApplicantDTO.class, 200);

            assertThat(updated.user().firstName()).isEqualTo("NewFirstName");
            assertThat(updated.user().lastName()).isEqualTo(applicant.getUser().getLastName());
            assertThat(updated.street()).isEqualTo("New Street");
            assertThat(updated.city()).isEqualTo(applicant.getCity());
        }
    }

    @Nested
    class ApplicantPersonalInformationTests {

        @Test
        void updateApplicantPersonalInformationUpdatesOnlyPersonalFields() {
            ApplicantDTO updatePayload = new ApplicantDTO(
                new UserDTO(
                    applicant.getUserId(),
                    "personal.updated@example.com",
                    applicant.getUser().getAvatar(),
                    "UpdatedFirstName",
                    "UpdatedLastName",
                    "Other",
                    "German",
                    LocalDate.of(1994, 4, 20),
                    "+49111111111",
                    "https://personal.example.com",
                    "https://linkedin.com/in/personal-updated",
                    "en",
                    null
                ),
                "Updated Street 99",
                "80802",
                "Munich",
                "Germany",
                "Should Stay Bachelor",
                "9.9",
                "9.9",
                "9.9",
                "Should Stay Bachelor University",
                "Should Stay Master",
                "9.9",
                "9.9",
                "9.9",
                "Should Stay Master University",
                false,
                false,
                null
            );

            ApplicantDTO updated = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/personal-information", updatePayload, ApplicantDTO.class, 200);

            assertThat(updated.user().email()).isEqualTo("personal.updated@example.com");
            assertThat(updated.user().firstName()).isEqualTo("UpdatedFirstName");
            assertThat(updated.user().lastName()).isEqualTo("UpdatedLastName");
            assertThat(updated.street()).isEqualTo("Updated Street 99");
            assertThat(updated.postalCode()).isEqualTo("80802");
            assertThat(updated.city()).isEqualTo("Munich");
            assertThat(updated.country()).isEqualTo("Germany");
            assertThat(updated.bachelorDegreeName()).isEqualTo(applicant.getBachelorDegreeName());
            assertThat(updated.bachelorGrade()).isEqualTo(applicant.getBachelorGrade());
            assertThat(updated.masterDegreeName()).isEqualTo(applicant.getMasterDegreeName());
            assertThat(updated.masterGrade()).isEqualTo(applicant.getMasterGrade());

            Applicant persistedApplicant = applicantRepository.findById(applicant.getUserId()).orElseThrow();
            assertThat(persistedApplicant.getUser().getEmail()).isEqualTo("personal.updated@example.com");
            assertThat(persistedApplicant.getStreet()).isEqualTo("Updated Street 99");
            assertThat(persistedApplicant.getBachelorDegreeName()).isEqualTo(applicant.getBachelorDegreeName());
            assertThat(persistedApplicant.getMasterDegreeName()).isEqualTo(applicant.getMasterDegreeName());
        }

        @Test
        void updateApplicantPersonalInformationWithNullUserReturnsBadRequest() {
            ApplicantDTO invalidPayload = new ApplicantDTO(
                null,
                "Street 123",
                "80333",
                "Munich",
                "Germany",
                applicant.getBachelorDegreeName(),
                applicant.getBachelorGradeUpperLimit(),
                applicant.getBachelorGradeLowerLimit(),
                applicant.getBachelorGrade(),
                applicant.getBachelorUniversity(),
                applicant.getMasterDegreeName(),
                applicant.getMasterGradeUpperLimit(),
                applicant.getMasterGradeLowerLimit(),
                applicant.getMasterGrade(),
                applicant.getMasterUniversity(),
                false,
                false,
                null
            );

            Void response = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/personal-information", invalidPayload, Void.class, 400);

            assertThat(response).isNull();
        }

        @Test
        void updateApplicantPersonalInformationWithoutAuthReturnsForbidden() {
            ApplicantDTO updatePayload = ApplicantDTO.getFromEntity(applicant);

            Void response = api.putAndRead("/api/applicants/profile/personal-information", updatePayload, Void.class, 403);
            assertThat(response).isNull();
        }
    }

    @Nested
    class ApplicantDocumentSettingsTests {

        @Test
        void updateApplicantDocumentSettingsUpdatesOnlyDocumentFields() {
            ApplicantDTO updatePayload = new ApplicantDTO(
                new UserDTO(
                    applicant.getUserId(),
                    "should.not.change@example.com",
                    applicant.getUser().getAvatar(),
                    "ShouldNotChange",
                    "ShouldNotChange",
                    "Other",
                    "French",
                    LocalDate.of(1988, 8, 8),
                    "+49999999999",
                    "https://ignore.example.com",
                    "https://linkedin.com/in/ignore",
                    "en",
                    null
                ),
                "Should Not Change Street",
                "99999",
                "Should Not Change City",
                "Should Not Change Country",
                "Updated Bachelor Degree",
                "1.0",
                "5.0",
                "1.2",
                "Updated Bachelor University",
                "Updated Master Degree",
                "1.0",
                "5.0",
                "1.1",
                "Updated Master University",
                false,
                false,
                null
            );

            ApplicantDTO updated = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/document-settings", updatePayload, ApplicantDTO.class, 200);

            assertThat(updated.user().email()).isEqualTo(applicant.getUser().getEmail());
            assertThat(updated.user().firstName()).isEqualTo(applicant.getUser().getFirstName());
            assertThat(updated.street()).isEqualTo(applicant.getStreet());
            assertThat(updated.city()).isEqualTo(applicant.getCity());
            assertThat(updated.bachelorDegreeName()).isEqualTo("Updated Bachelor Degree");
            assertThat(updated.bachelorGrade()).isEqualTo("1.2");
            assertThat(updated.bachelorUniversity()).isEqualTo("Updated Bachelor University");
            assertThat(updated.masterDegreeName()).isEqualTo("Updated Master Degree");
            assertThat(updated.masterGrade()).isEqualTo("1.1");
            assertThat(updated.masterUniversity()).isEqualTo("Updated Master University");

            Applicant persistedApplicant = applicantRepository.findById(applicant.getUserId()).orElseThrow();
            assertThat(persistedApplicant.getUser().getEmail()).isEqualTo(applicant.getUser().getEmail());
            assertThat(persistedApplicant.getStreet()).isEqualTo(applicant.getStreet());
            assertThat(persistedApplicant.getBachelorDegreeName()).isEqualTo("Updated Bachelor Degree");
            assertThat(persistedApplicant.getMasterUniversity()).isEqualTo("Updated Master University");
        }

        @Test
        void shouldStoreDegreeStatusAndKeepDegreeDataWhenABoxIsTicked() {
            ApplicantDTO updatePayload = ApplicantTestData.dtoWithDegreeStatus(applicant, false, true, "  Writing my Master's thesis  ");

            ApplicantDTO updated = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/document-settings", updatePayload, ApplicantDTO.class, 200);

            assertThat(updated.noBachelorDegree()).isFalse();
            assertThat(updated.noMasterDegree()).isTrue();
            assertThat(updated.degreeStatusExplanation()).isEqualTo("Writing my Master's thesis");

            Applicant persistedApplicant = applicantRepository.findById(applicant.getUserId()).orElseThrow();
            assertThat(persistedApplicant.isNoMasterDegree()).isTrue();
            assertThat(persistedApplicant.getDegreeStatusExplanation()).isEqualTo("Writing my Master's thesis");
            assertThat(persistedApplicant.getMasterDegreeName()).isEqualTo(applicant.getMasterDegreeName());
        }

        @Test
        void shouldDropDegreeStatusExplanationWhenNoBoxIsTicked() {
            ApplicantDTO updatePayload = ApplicantTestData.dtoWithDegreeStatus(applicant, false, false, "No longer relevant");

            ApplicantDTO updated = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/document-settings", updatePayload, ApplicantDTO.class, 200);

            assertThat(updated.degreeStatusExplanation()).isNull();
            assertThat(applicantRepository.findById(applicant.getUserId()).orElseThrow().getDegreeStatusExplanation()).isNull();
        }

        @Test
        void shouldRejectDocumentSettingsWhenDegreeStatusExplanationIsTooLong() {
            String tooLong = "a".repeat(ApplicantDTO.MAX_DEGREE_STATUS_EXPLANATION_LENGTH + 1);
            ApplicantDTO updatePayload = ApplicantTestData.dtoWithDegreeStatus(applicant, true, false, tooLong);

            Void response = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/document-settings", updatePayload, Void.class, 400);

            assertThat(response).isNull();
            assertThat(applicantRepository.findById(applicant.getUserId()).orElseThrow().isNoBachelorDegree()).isFalse();
        }

        @Test
        void updateApplicantDocumentSettingsWithNullUserReturnsBadRequest() {
            ApplicantDTO invalidPayload = new ApplicantDTO(
                null,
                applicant.getStreet(),
                applicant.getPostalCode(),
                applicant.getCity(),
                applicant.getCountry(),
                "Updated Bachelor Degree",
                "1.0",
                "5.0",
                "1.2",
                "Updated Bachelor University",
                "Updated Master Degree",
                "1.0",
                "5.0",
                "1.1",
                "Updated Master University",
                false,
                false,
                null
            );

            Void response = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead("/api/applicants/profile/document-settings", invalidPayload, Void.class, 400);

            assertThat(response).isNull();
        }

        @Test
        void updateApplicantDocumentSettingsWithoutAuthReturnsForbidden() {
            ApplicantDTO updatePayload = ApplicantDTO.getFromEntity(applicant);

            Void response = api.putAndRead("/api/applicants/profile/document-settings", updatePayload, Void.class, 403);
            assertThat(response).isNull();
        }
    }

    @Nested
    class ProfileDocumentIdsTests {

        @Test
        void getApplicantProfileDocumentIdsReturnsGroupedDocuments() {
            DocumentTestData.savedMockDocument(
                documentRepository,
                applicant.getUser(),
                null,
                applicant,
                DocumentType.BACHELOR_TRANSCRIPT,
                "bachelor_profile.pdf"
            );
            DocumentTestData.savedMockDocument(documentRepository, applicant.getUser(), null, applicant, DocumentType.CV, "cv_profile.pdf");
            DocumentTestData.savedMockDocument(
                documentRepository,
                applicant.getUser(),
                null,
                applicant,
                DocumentType.REFERENCE,
                "reference_profile.pdf"
            );

            ApplicationDocumentIdsDTO dto = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .getAndRead("/api/applicants/profile/document-ids", null, ApplicationDocumentIdsDTO.class, 200);

            assertThat(dto).isNotNull();
            assertThat(dto.getBachelorDocumentIds()).hasSize(1);
            assertThat(dto.getBachelorDocumentIds().iterator().next().getName()).isEqualTo("bachelor_profile.pdf");
            assertThat(dto.getCvDocumentId()).isNotNull();
            assertThat(dto.getCvDocumentId().getName()).isEqualTo("cv_profile.pdf");
            assertThat(dto.getReferenceDocumentIds()).hasSize(1);
            assertThat(dto.getReferenceDocumentIds().iterator().next().getName()).isEqualTo("reference_profile.pdf");
        }

        @Test
        void getApplicantProfileDocumentIdsWithoutAuthReturnsForbidden() {
            Void response = api.getAndRead("/api/applicants/profile/document-ids", null, Void.class, 403);
            assertThat(response).isNull();
        }
    }

    @Nested
    class DeleteDocumentFromProfileTests {

        @Test
        void deleteDocumentFromProfileRemovesIt() {
            Document doc = DocumentTestData.savedMockDocument(
                documentRepository,
                applicant.getUser(),
                null,
                applicant,
                DocumentType.CV,
                "profile_cv.pdf"
            );

            assertThat(documentRepository.existsById(doc.getDocumentId())).isTrue();

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .deleteAndRead("/api/applicants/profile/documents/" + doc.getDocumentId(), null, Void.class, 204);

            assertThat(documentRepository.existsById(doc.getDocumentId())).isFalse();
        }

        @Test
        void deleteDocumentFromProfileWithoutAuthReturnsForbidden() {
            Document doc = DocumentTestData.savedMockDocument(
                documentRepository,
                applicant.getUser(),
                null,
                applicant,
                DocumentType.CV,
                "profile_cv.pdf"
            );

            Void response = api.deleteAndRead("/api/applicants/profile/documents/" + doc.getDocumentId(), null, Void.class, 403);
            assertThat(response).isNull();
        }

        @Test
        void deleteDocumentFromProfileNonexistentThrowsNotFound() {
            Void response = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .deleteAndRead("/api/applicants/profile/documents/" + UUID.randomUUID(), null, Void.class, 404);

            assertThat(response).isNull();
        }
    }

    @Nested
    class RenameApplicantProfileDocumentTests {

        @Test
        void renameApplicantProfileDocumentUpdatesName() {
            Document doc = DocumentTestData.savedMockDocument(
                documentRepository,
                applicant.getUser(),
                null,
                applicant,
                DocumentType.CV,
                "profile_original_name.pdf"
            );

            api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    "/api/applicants/profile/documents/" + doc.getDocumentId() + "/name?newName=profile_new_name.pdf",
                    null,
                    Void.class,
                    200
                );

            Document updated = documentRepository.findById(doc.getDocumentId()).orElseThrow();
            assertThat(updated.getName()).isEqualTo("profile_new_name.pdf");
        }

        @Test
        void renameApplicantProfileDocumentNonexistentThrowsNotFound() {
            Void response = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .putAndRead(
                    "/api/applicants/profile/documents/" + UUID.randomUUID() + "/name?newName=profile_new_name.pdf",
                    null,
                    Void.class,
                    404
                );

            assertThat(response).isNull();
        }

        @Test
        void renameApplicantProfileDocumentWithoutAuthReturnsForbidden() {
            Document doc = DocumentTestData.savedMockDocument(
                documentRepository,
                applicant.getUser(),
                null,
                applicant,
                DocumentType.CV,
                "profile_original_name.pdf"
            );

            Void response = api.putAndRead(
                "/api/applicants/profile/documents/" + doc.getDocumentId() + "/name?newName=profile_new_name.pdf",
                null,
                Void.class,
                403
            );

            assertThat(response).isNull();
        }
    }

    @Nested
    class UploadApplicantProfileDocumentsTests {

        @Test
        void uploadApplicantProfileDocumentsPreservesOriginalFilename() {
            MockMultipartFile file = DocumentTestData.createMockPdfFile("files", "cv_profile.pdf", "PDF profile content");

            Set<DocumentInformationHolderDTO> uploadedDocs = api
                .with(JwtPostProcessors.jwtUser(applicant.getUserId(), "ROLE_APPLICANT"))
                .multipartPostAndRead("/api/applicants/profile/documents/" + DocumentType.CV, List.of(file), new TypeReference<>() {}, 200);

            assertThat(uploadedDocs).hasSize(1);
            DocumentInformationHolderDTO uploadedDoc = uploadedDocs.iterator().next();
            assertThat(uploadedDoc.getName()).isEqualTo("cv_profile.pdf");
            assertThat(uploadedDoc.getSize()).isEqualTo("PDF profile content".getBytes().length);
        }
    }
}
