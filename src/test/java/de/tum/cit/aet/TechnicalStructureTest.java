package de.tum.cit.aet;

import static com.tngtech.archunit.base.DescribedPredicate.alwaysTrue;
import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption.DoNotIncludeTests;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import de.tum.cit.aet.ai.config.AiPricingProperties;
import de.tum.cit.aet.core.config.ApplicantRetentionProperties;
import de.tum.cit.aet.core.config.ApplicationProperties;
import de.tum.cit.aet.core.config.Constants;
import de.tum.cit.aet.core.config.UserRetentionProperties;
import de.tum.cit.aet.core.domain.export.ExportedUserData;
import de.tum.cit.aet.core.domain.export.NoUserDataExportRequired;
import de.tum.cit.aet.core.domain.export.UserDataExportProviderType;
import de.tum.cit.aet.core.service.export.ApplicantDataExportProvider;
import de.tum.cit.aet.core.service.export.StaffDataExportProvider;
import de.tum.cit.aet.core.service.export.UserDataSectionProvider;
import de.tum.cit.aet.core.service.export.UserSettingsExportProvider;
import jakarta.persistence.Entity;
import org.springframework.stereotype.Component;

@AnalyzeClasses(packagesOf = TumApplyApp.class, importOptions = DoNotIncludeTests.class)
class TechnicalStructureTest {

    /**
     * Enforces the layered architecture boundaries of the backend.
     *
     * This rule prevents unintended coupling between technical layers (Config, Web, Service, Security,
     * Persistence, Domain, Dto) and keeps dependencies directional.
     */
    // prettier-ignore
    @ArchTest
    static final ArchRule respectsTechnicalArchitectureLayers = layeredArchitecture()
        .consideringAllDependencies()
        .layer("Config").definedBy("..config..")
        .layer("Web").definedBy("..web..")
        .optionalLayer("Service").definedBy("..service..", "..retention..")
        .layer("Security").definedBy("..security..")
        .optionalLayer("Persistence").definedBy("..repository..")
        .layer("Domain").definedBy("..domain..")
        .optionalLayer("Dto").definedBy("..dto..")

        .whereLayer("Config").mayNotBeAccessedByAnyLayer()
        .whereLayer("Web").mayOnlyBeAccessedByLayers("Config")
        .whereLayer("Service").mayOnlyBeAccessedByLayers("Web", "Config", "Security")
        .whereLayer("Security").mayOnlyBeAccessedByLayers("Config", "Service", "Web")
        .whereLayer("Persistence").mayOnlyBeAccessedByLayers("Service", "Security", "Web", "Config")
        .whereLayer("Domain").mayOnlyBeAccessedByLayers("Persistence", "Service", "Security", "Web", "Config", "Dto")

        .ignoreDependency(belongToAnyOf(TumApplyApp.class), alwaysTrue())
        .ignoreDependency(alwaysTrue(), belongToAnyOf(
            Constants.class,
            AiPricingProperties.class,
            ApplicationProperties.class,
            ApplicantRetentionProperties.class,
            UserRetentionProperties.class
        ));

    /**
     * Requires each JPA entity to explicitly decide whether it participates in user data export.
     *
     * Entities must declare exactly one intent via @ExportedUserData (included in export) or
     * {@code @NoUserDataExportRequired} (explicitly excluded). This avoids silently missing entities in data exports.
     *
     * Note: this is a structural guard only. Runtime completeness of exported CSV content is
     * validated by dedicated integration tests in UserDataExportResourceTest.
     */
    @ArchTest
    static final ArchRule entitiesMustDeclareDataExportDecision = classes()
        .that()
        .areAnnotatedWith(Entity.class)
        .should(
            new ArchCondition<>("declare @ExportedUserData or @NoUserDataExportRequired") {
                @Override
                public void check(JavaClass javaClass, ConditionEvents events) {
                    boolean hasExportDecision =
                        javaClass.isAnnotatedWith(ExportedUserData.class) || javaClass.isAnnotatedWith(NoUserDataExportRequired.class);

                    if (!hasExportDecision) {
                        events.add(
                            SimpleConditionEvent.violated(
                                javaClass,
                                javaClass.getFullName() + " must be annotated with @ExportedUserData or @NoUserDataExportRequired"
                            )
                        );
                    }
                }
            }
        );

    /**
     * Ensures exported entities reference a valid, executable export provider.
     *
     * For every entity annotated with @ExportedUserData, the configured provider type must resolve to a
     * Spring @Component that implements UserDataSectionProvider.
     *
     * Note: this guarantees provider wiring and type safety, but not that every field/record is present
     * in the final ZIP output. Content-level assertions are covered by integration tests.
     */
    @ArchTest
    static final ArchRule exportedEntitiesMustReferenceComponentProvider = classes()
        .that()
        .areAnnotatedWith(ExportedUserData.class)
        .should(
            new ArchCondition<>("reference a @Component provider implementing UserDataSectionProvider") {
                @Override
                public void check(JavaClass javaClass, ConditionEvents events) {
                    ExportedUserData annotation = javaClass.reflect().getAnnotation(ExportedUserData.class);
                    Class<? extends UserDataSectionProvider> providerClass = resolveProvider(annotation.by());

                    if (!UserDataSectionProvider.class.isAssignableFrom(providerClass)) {
                        events.add(
                            SimpleConditionEvent.violated(
                                javaClass,
                                javaClass.getFullName() + " declares invalid export provider " + providerClass.getName()
                            )
                        );
                        return;
                    }

                    if (!providerClass.isAnnotationPresent(Component.class)) {
                        events.add(
                            SimpleConditionEvent.violated(
                                javaClass,
                                javaClass.getFullName() +
                                    " references provider " +
                                    providerClass.getName() +
                                    " which is not a Spring @Component"
                            )
                        );
                    }
                }
            }
        )
        .allowEmptyShould(true);

    private static Class<? extends UserDataSectionProvider> resolveProvider(UserDataExportProviderType type) {
        return switch (type) {
            case APPLICANT -> ApplicantDataExportProvider.class;
            case STAFF -> StaffDataExportProvider.class;
            case USER_SETTINGS -> UserSettingsExportProvider.class;
        };
    }
}
