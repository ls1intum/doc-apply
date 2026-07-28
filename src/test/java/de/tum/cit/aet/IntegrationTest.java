package de.tum.cit.aet;

import de.tum.cit.aet.core.config.AsyncSyncConfiguration;
import de.tum.cit.aet.core.config.EmbeddedSQL;
import de.tum.cit.aet.core.config.JacksonConfiguration;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;

/**
 * Base composite annotation for integration tests.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(classes = { DocApplyApp.class, JacksonConfiguration.class, AsyncSyncConfiguration.class, TestSecurityConfiguration.class })
@AutoConfigureMockMvc
@ActiveProfiles("test")
@EmbeddedSQL
public @interface IntegrationTest {}
