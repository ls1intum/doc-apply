package de.tum.cit.aet.utility;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.stereotype.Component;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Thin HTTP client for MVC.
 * - Central place for common request setup (Accept, JSON content).
 * - Keeps request-building logic away from individual tests.
 *
 * Tip: Use the "with(...)" helper to attach security to all requests from this
 * client,
 * for example a JWT RequestPostProcessor.
 */
@Component
public class MvcTestClient {

    // --- Framework wiring
    // -----------------------------------------------------------

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // --- Defaults
    // --------------------------------------------------------------------------------
    private MediaType defaultAccept = MediaType.APPLICATION_JSON;

    /**
     * RequestPostProcessors applied to every request from this client.
     * Typical use is authentication, e.g. a JWT post-processor.
     */
    private final List<RequestPostProcessor> defaultPostProcessors = new ArrayList<>();

    /**
     * Sets the default Accept header used by all requests.
     * JSON is used by default.
     */
    public MvcTestClient withDefaultAccept(MediaType accept) {
        this.defaultAccept = accept;
        return this;
    }

    /**
     * Replaces the set of RequestPostProcessors applied to every request.
     * Example usage: api.with(jwt(...)).getAndRead(...)
     */
    public MvcTestClient with(RequestPostProcessor... rpps) {
        this.defaultPostProcessors.clear();
        if (rpps != null && rpps.length > 0) {
            this.defaultPostProcessors.addAll(Arrays.asList(rpps));
        }
        return this;
    }

    /**
     * Removes all default RequestPostProcessors.
     * After calling this, subsequent requests will not carry previously set
     * processors.
     */
    public MvcTestClient withoutPostProcessors() {
        this.defaultPostProcessors.clear();
        return this;
    }

    // --- request + assert 200 OK + JSON deserialization -----------------------
    // Use these in tests by default.

    /**
     * Performs a GET and asserts 200 OK, then deserializes the body to the given
     * class.
     * Query parameters and optional Accept overrides are supported.
     * If type is Void, only the assertion is performed.
     */
    public <T> T getAndRead(String url, Map<String, String> params, Class<T> type, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = getOk(url, params, accepts);
            case 204 -> result = getNoContent(url, params, accepts);
            case 400 -> result = getInvalid(url, params, accepts);
            case 401 -> result = getUnauthorized(url, params, accepts);
            case 403 -> result = getForbidden(url, params, accepts);
            case 404 -> result = getNotFound(url, params, accepts);
            case 500 -> result = getInternalServerError(url, params, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }

        if (type == Void.class) {
            return null;
        }
        return read(result, type);
    }

    public <T> T multipartPostAndRead(String url, List<MockMultipartFile> files, TypeReference<T> responseType, int expectedStatus) {
        return multipartPostAndRead(url, files, Map.of(), responseType, expectedStatus);
    }

    public <T> T multipartPostAndRead(
        String url,
        List<MockMultipartFile> files,
        Map<String, String> params,
        TypeReference<T> responseType,
        int expectedStatus
    ) {
        try {
            MockMultipartHttpServletRequestBuilder builder = multipart(url);
            for (MockMultipartFile file : files) {
                builder.file(file);
            }
            params.forEach(builder::param);
            // Apply default Accept header and RequestPostProcessors (e.g., JWT)
            builder = applyDefaults(builder);
            MvcResult result = mockMvc.perform(builder).andExpect(status().is(expectedStatus)).andReturn();

            String body = result.getResponse().getContentAsString();
            if (body.isEmpty()) {
                return null;
            }
            return objectMapper.readValue(body, responseType);
        } catch (Exception e) {
            throw new AssertionError("Multipart POST " + url + " failed", e);
        }
    }

    /**
     * Performs a GET and asserts 200 OK, then deserializes the body using a
     * TypeReference.
     * Useful for generic types like PageResponse<Foo>.
     */
    public <T> T getAndRead(String url, Map<String, String> params, TypeReference<T> typeRef, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = getOk(url, params, accepts);
            case 400 -> result = getInvalid(url, params, accepts);
            case 401 -> result = getUnauthorized(url, params, accepts);
            case 403 -> result = getForbidden(url, params, accepts);
            case 404 -> result = getNotFound(url, params, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }
        return read(result, typeRef);
    }

    /**
     * Performs a GET and asserts the given status, then returns the raw response
     * body as bytes.
     * Useful for binary downloads (e.g. ZIP, PDF).
     */
    public byte[] getAndReturnBytes(String url, Map<String, String> params, int expectedStatus, MediaType... accepts) {
        try {
            MultiValueMap<String, String> multiParams = new LinkedMultiValueMap<>();
            if (params != null) {
                params.forEach(multiParams::add);
            }

            ResultActions action = mockMvc.perform(applyDefaults(MockMvcRequestBuilders.get(url).params(multiParams), accepts));

            MockHttpServletResponse response;
            switch (expectedStatus) {
                case 200 -> response = action.andExpect(status().isOk()).andReturn().getResponse();
                case 204 -> response = action.andExpect(status().isNoContent()).andReturn().getResponse();
                case 400 -> response = action.andExpect(status().isBadRequest()).andReturn().getResponse();
                case 401 -> response = action.andExpect(status().isUnauthorized()).andReturn().getResponse();
                case 403 -> response = action.andExpect(status().isForbidden()).andReturn().getResponse();
                case 404 -> response = action.andExpect(status().isNotFound()).andReturn().getResponse();
                case 409 -> response = action.andExpect(status().isConflict()).andReturn().getResponse();
                case 429 -> response = action.andExpect(status().isTooManyRequests()).andReturn().getResponse();
                case 500 -> response = action.andExpect(status().isInternalServerError()).andReturn().getResponse();
                default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
            }

            return response.getContentAsByteArray();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with status " + expectedStatus, e);
        }
    }

    /**
     * Performs a GET and asserts the given status, then returns the full servlet
     * response.
     * Useful for asserting headers/content-type for downloads.
     */
    public MockHttpServletResponse getAndReturnResponse(String url, Map<String, String> params, int expectedStatus, MediaType... accepts) {
        try {
            MultiValueMap<String, String> multiParams = new LinkedMultiValueMap<>();
            if (params != null) {
                params.forEach(multiParams::add);
            }

            ResultActions action = mockMvc.perform(applyDefaults(MockMvcRequestBuilders.get(url).params(multiParams), accepts));

            return switch (expectedStatus) {
                case 200 -> action.andExpect(status().isOk()).andReturn().getResponse();
                case 204 -> action.andExpect(status().isNoContent()).andReturn().getResponse();
                case 400 -> action.andExpect(status().isBadRequest()).andReturn().getResponse();
                case 401 -> action.andExpect(status().isUnauthorized()).andReturn().getResponse();
                case 403 -> action.andExpect(status().isForbidden()).andReturn().getResponse();
                case 404 -> action.andExpect(status().isNotFound()).andReturn().getResponse();
                case 409 -> action.andExpect(status().isConflict()).andReturn().getResponse();
                case 429 -> action.andExpect(status().isTooManyRequests()).andReturn().getResponse();
                case 500 -> action.andExpect(status().isInternalServerError()).andReturn().getResponse();
                default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
            };
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with status " + expectedStatus, e);
        }
    }

    /**
     * Performs a POST with a JSON body and asserts the given status, then returns
     * the raw response
     * body as bytes.
     * Useful for binary downloads (e.g. PDF) returned from POST requests.
     */
    public byte[] postAndReturnBytes(String url, Object body, int expectedStatus, MediaType... accepts) {
        try {
            ResultActions action = mockMvc.perform(
                applyDefaults(post(url), accepts).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
            );

            MockHttpServletResponse response;
            switch (expectedStatus) {
                case 200 -> response = action.andExpect(status().isOk()).andReturn().getResponse();
                case 204 -> response = action.andExpect(status().isNoContent()).andReturn().getResponse();
                case 400 -> response = action.andExpect(status().isBadRequest()).andReturn().getResponse();
                case 401 -> response = action.andExpect(status().isUnauthorized()).andReturn().getResponse();
                case 403 -> response = action.andExpect(status().isForbidden()).andReturn().getResponse();
                case 404 -> response = action.andExpect(status().isNotFound()).andReturn().getResponse();
                case 500 -> response = action.andExpect(status().isInternalServerError()).andReturn().getResponse();
                default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
            }

            return response.getContentAsByteArray();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with status " + expectedStatus, e);
        }
    }

    /**
     * Performs a POST with a JSON body and asserts the given status, then returns the full servlet response.
     * Useful for asserting response headers such as {@code Set-Cookie}.
     *
     * @param url            the target URL
     * @param body           the request body serialized to JSON
     * @param expectedStatus the expected HTTP status code
     * @param accepts        optional accept media types
     * @return the full servlet response
     */
    public MockHttpServletResponse postAndReturnResponse(String url, Object body, int expectedStatus, MediaType... accepts) {
        try {
            ResultActions action = mockMvc.perform(
                applyDefaults(post(url), accepts).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
            );

            return switch (expectedStatus) {
                case 200 -> action.andExpect(status().isOk()).andReturn().getResponse();
                case 201 -> action.andExpect(status().isCreated()).andReturn().getResponse();
                case 202 -> action.andExpect(status().isAccepted()).andReturn().getResponse();
                case 204 -> action.andExpect(status().isNoContent()).andReturn().getResponse();
                case 400 -> action.andExpect(status().isBadRequest()).andReturn().getResponse();
                case 401 -> action.andExpect(status().isUnauthorized()).andReturn().getResponse();
                case 403 -> action.andExpect(status().isForbidden()).andReturn().getResponse();
                case 404 -> action.andExpect(status().isNotFound()).andReturn().getResponse();
                case 409 -> action.andExpect(status().isConflict()).andReturn().getResponse();
                case 429 -> action.andExpect(status().isTooManyRequests()).andReturn().getResponse();
                case 500 -> action.andExpect(status().isInternalServerError()).andReturn().getResponse();
                default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
            };
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with status " + expectedStatus, e);
        }
    }

    /**
     * Performs a POST with a JSON body and asserts 200 OK, then deserializes to the
     * given class.
     * If type is Void, only the assertion is performed.
     */
    public <T> T postAndRead(String url, Object body, Class<T> type, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = postOk(url, body, accepts);
            case 201 -> result = postCreated(url, body, accepts);
            case 202 -> result = postAccepted(url, body, accepts);
            case 204 -> result = postNoContent(url, body, accepts);
            case 400 -> result = postInvalid(url, body, accepts);
            case 401 -> result = postUnauthorized(url, body, accepts);
            case 403 -> result = postForbidden(url, body, accepts);
            case 404 -> result = postNotFound(url, body, accepts);
            case 409 -> result = postConflict(url, body, accepts);
            case 429 -> result = postTooManyRequests(url, body, accepts);
            case 500 -> result = postInternalServerError(url, body, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }

        if (type == Void.class) {
            return null;
        }
        return read(result, type);
    }

    /**
     * Performs a POST with a JSON body and asserts 200 OK, then deserializes using
     * a TypeReference.
     */
    public <T> T postAndRead(String url, Object body, TypeReference<T> typeRef, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = postOk(url, body, accepts);
            case 201 -> result = postCreated(url, body, accepts);
            case 202 -> result = postAccepted(url, body, accepts);
            case 204 -> result = postNoContent(url, body, accepts);
            case 400 -> result = postInvalid(url, body, accepts);
            case 401 -> result = postUnauthorized(url, body, accepts);
            case 403 -> result = postForbidden(url, body, accepts);
            case 404 -> result = postNotFound(url, body, accepts);
            case 409 -> result = postConflict(url, body, accepts);
            case 429 -> result = postTooManyRequests(url, body, accepts);
            case 500 -> result = postInternalServerError(url, body, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }
        return read(result, typeRef);
    }

    /**
     * Performs a PUT with a JSON body and asserts 200 OK, then deserializes to the
     * given class.
     * If type is Void, only the assertion is performed.
     */
    public <T> T putAndRead(String url, Object body, Class<T> type, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = putOk(url, body, accepts);
            case 204 -> result = putNoContent(url, body, accepts);
            case 400 -> result = putInvalid(url, body, accepts);
            case 401 -> result = putUnauthorized(url, body, accepts);
            case 403 -> result = putForbidden(url, body, accepts);
            case 404 -> result = putNotFound(url, body, accepts);
            case 409 -> result = putConflict(url, body, accepts);
            case 500 -> result = putInternalServerError(url, body, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }

        if (type == Void.class) {
            return null;
        }
        return read(result, type);
    }

    /**
     * Performs a PUT with a JSON body and asserts 200 OK, then deserializes using a
     * TypeReference.
     */
    public <T> T putAndRead(String url, Object body, TypeReference<T> typeRef, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = putOk(url, body, accepts);
            case 204 -> result = putNoContent(url, body, accepts);
            case 400 -> result = putInvalid(url, body, accepts);
            case 401 -> result = putUnauthorized(url, body, accepts);
            case 403 -> result = putForbidden(url, body, accepts);
            case 404 -> result = putNotFound(url, body, accepts);
            case 409 -> result = putConflict(url, body, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }
        return read(result, typeRef);
    }

    /**
     * Performs a DELETE and asserts 204 No Content, then optionally deserializes if
     * a body is returned.
     * If type is Void, only the assertion is performed.
     */
    public <T> T deleteAndRead(String url, Object body, Class<T> type, int expectedStatus, MediaType... accepts) {
        MvcResult result;
        switch (expectedStatus) {
            case 200 -> result = deleteOk(url, body, accepts);
            case 204 -> result = deleteNoContent(url, body, accepts);
            case 400 -> result = deleteInvalid(url, body, accepts);
            case 401 -> result = deleteUnauthorized(url, body, accepts);
            case 403 -> result = deleteForbidden(url, body, accepts);
            case 404 -> result = deleteNotFound(url, body, accepts);
            case 500 -> result = deleteInternalServerError(url, body, accepts);
            default -> throw new IllegalArgumentException("Unsupported status: " + expectedStatus);
        }

        if (type == Void.class) {
            return null;
        }
        return read(result, type);
    }

    /**
     * Performs a DELETE and asserts 204 No Content, then deserializes using a
     * TypeReference if present.
     */
    public <T> T deleteAndRead(String url, Object body, TypeReference<T> typeRef, int expectedStatus, MediaType... accepts) {
        return read(deleteOk(url, body, accepts), typeRef);
    }

    // --- No-throws convenience (assert 200 OK inside)
    // -------------------------------------------

    /**
     * Low-level GET that asserts 200 OK and returns the MvcResult.
     * Wraps checked exceptions as AssertionError for cleaner tests.
     */
    private MvcResult getOk(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isOk()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed", e);
        }
    }

    /**
     * Low-level GET that asserts 200 OK and returns the MvcResult.
     * Wraps checked exceptions as AssertionError for cleaner tests.
     */
    private MvcResult getNoContent(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isNoContent()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with 204", e);
        }
    }

    /**
     * Low-level GET that asserts 400 Bad Request and returns the MvcResult.
     */
    private MvcResult getInvalid(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isBadRequest()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with 400", e);
        }
    }

    /**
     * Low-level GET that asserts 401 Unauthorized and returns the MvcResult.
     */
    private MvcResult getUnauthorized(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isUnauthorized()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with 401", e);
        }
    }

    /**
     * Low-level GET that asserts 403 Forbidden and returns the MvcResult.
     */
    private MvcResult getForbidden(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isForbidden()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with 403", e);
        }
    }

    /**
     * Low-level GET that asserts 404 Not Found and returns the MvcResult.
     */
    private MvcResult getNotFound(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isNotFound()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with 404", e);
        }
    }

    /**
     * Low-level GET that asserts 500 Internal Server Error and returns the
     * MvcResult.
     */
    private MvcResult getInternalServerError(String url, Map<String, String> params, MediaType... accepts) {
        try {
            return get(url, params, accepts).andExpect(status().isInternalServerError()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("GET " + url + " failed with 500", e);
        }
    }

    /**
     * Low-level POST that asserts 200 OK and returns the MvcResult.
     */
    private MvcResult postOk(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isOk()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 200", e);
        }
    }

    /**
     * Low-level POST that asserts 201 Created and returns the MvcResult.
     */
    private MvcResult postCreated(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isCreated()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 201", e);
        }
    }

    /**
     * Low-level POST that asserts 204 No Content and returns the MvcResult.
     */
    private MvcResult postNoContent(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isNoContent()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 204", e);
        }
    }

    /**
     * Low-level POST that asserts 400 Bad Request and returns the MvcResult.
     */
    private MvcResult postInvalid(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isBadRequest()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 400", e);
        }
    }

    /**
     * Low-level POST that asserts 401 Unauthorized and returns the MvcResult.
     */
    private MvcResult postUnauthorized(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isUnauthorized()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 401", e);
        }
    }

    /**
     * Low-level POST that asserts 403 Forbidden and returns the MvcResult.
     */
    private MvcResult postForbidden(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isForbidden()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 403", e);
        }
    }

    /**
     * Low-level POST that asserts 404 Not Found and returns the MvcResult.
     */
    private MvcResult postNotFound(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isNotFound()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 404", e);
        }
    }

    /**
     * Low-level POST that asserts 409 Conflict and returns the MvcResult.
     */
    private MvcResult postConflict(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isConflict()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 409", e);
        }
    }

    /**
     * Low-level POST that asserts 500 Internal Server Error and returns the
     * MvcResult.
     */
    private MvcResult postInternalServerError(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isInternalServerError()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed with 500", e);
        }
    }

    /**
     * Low-level POST that asserts 429 Too Many Requests and returns the MvcResult.
     */
    private MvcResult postTooManyRequests(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isTooManyRequests()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed", e);
        }
    }

    /**
     * Low-level POST that asserts 202 Accepted and returns the MvcResult.
     */
    private MvcResult postAccepted(String url, Object body, MediaType... accepts) {
        try {
            return postJson(url, body, accepts).andExpect(status().isAccepted()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("POST " + url + " failed", e);
        }
    }

    /**
     * Low-level PUT that asserts 200 OK and returns the MvcResult.
     */
    private MvcResult putOk(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isOk()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed", e);
        }
    }

    /**
     * Low-level PUT that asserts 204 No Content and returns the MvcResult.
     */
    private MvcResult putNoContent(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isNoContent()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed", e);
        }
    }

    /**
     * Low-level PUT that asserts 400 Bad Request and returns the MvcResult.
     */
    private MvcResult putInvalid(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isBadRequest()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed with 400", e);
        }
    }

    /**
     * Low-level PUT that asserts 401 Unauthorized and returns the MvcResult.
     */
    private MvcResult putUnauthorized(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isUnauthorized()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed with 401", e);
        }
    }

    /**
     * Low-level PUT that asserts 403 Forbidden and returns the MvcResult.
     */
    private MvcResult putForbidden(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isForbidden()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed with 403", e);
        }
    }

    /**
     * Low-level PUT that asserts 404 Not Found and returns the MvcResult.
     */
    private MvcResult putNotFound(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isNotFound()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed with 404", e);
        }
    }

    /**
     * Low-level PUT that asserts 500 Internal Server Error and returns the
     * MvcResult.
     */
    private MvcResult putInternalServerError(String url, Object body, MediaType... accepts) {
        try {
            return putJson(url, body, accepts).andExpect(status().isInternalServerError()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " failed with 500", e);
        }
    }

    /**
     * Low-level DELETE that asserts 200 Ok and returns the MvcResult.
     */
    private MvcResult deleteOk(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isOk()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 202", e);
        }
    }

    /**
     * Low-level DELETE that asserts 204 No Content and returns the MvcResult.
     */
    private MvcResult deleteNoContent(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isNoContent()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 204", e);
        }
    }

    /**
     * Low-level DELETE that asserts 400 Bad Request and returns the MvcResult.
     */
    private MvcResult deleteInvalid(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isBadRequest()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 400", e);
        }
    }

    /**
     * Low-level DELETE that asserts 401 Unauthorized and returns the MvcResult.
     */
    private MvcResult deleteUnauthorized(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isUnauthorized()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 401", e);
        }
    }

    /**
     * Low-level DELETE that asserts 403 Forbidden and returns the MvcResult.
     */
    private MvcResult deleteForbidden(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isForbidden()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 403", e);
        }
    }

    /**
     * Low-level DELETE that asserts 404 Not Found and returns the MvcResult.
     */
    private MvcResult deleteNotFound(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isNotFound()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 404", e);
        }
    }

    /*
     * Low-level PUT that asserts 409 Conflict and returns the MvcResult.
     */
    private MvcResult putConflict(String url, Object body, MediaType... accepts) {
        try {
            return mockMvc
                .perform(
                    applyDefaults(put(url), accepts).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
                )
                .andExpect(status().isConflict())
                .andReturn();
        } catch (Exception e) {
            throw new AssertionError("PUT " + url + " expected 409", e);
        }
    }

    /**
     * Low-level DELETE that asserts 500 Internal Server Error and returns the MvcResult.
     */
    private MvcResult deleteInternalServerError(String url, Object body, MediaType... accepts) {
        try {
            return deleteJson(url, body, accepts).andExpect(status().isInternalServerError()).andReturn();
        } catch (Exception e) {
            throw new AssertionError("DELETE " + url + " failed with 500", e);
        }
    }

    // --- HTTP performers (low-level, throw checked Exception)
    // -----------------------------------

    /**
     * Builds and performs a GET with query parameters, applying defaults and
     * processors.
     */
    private ResultActions get(String url, Map<String, String> params, MediaType... accepts) throws Exception {
        MockHttpServletRequestBuilder requestBuilder = applyDefaults(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(url),
            accepts
        );
        if (params != null) params.forEach(requestBuilder::param);
        return mockMvc.perform(requestBuilder);
    }

    /**
     * Builds and performs a POST with a JSON body, applying defaults and
     * processors.
     */
    private ResultActions postJson(String url, Object body, MediaType... accepts) throws Exception {
        return mockMvc.perform(
            applyDefaults(post(url), accepts).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
        );
    }

    /**
     * Builds and performs a PUT with a JSON body, applying defaults and processors.
     */
    private ResultActions putJson(String url, Object body, MediaType... accepts) throws Exception {
        return mockMvc.perform(
            applyDefaults(put(url), accepts).contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body))
        );
    }

    /**
     * Builds and performs a DELETE, optionally with a JSON body, applying defaults
     * and processors.
     */
    private ResultActions deleteJson(String url, Object body, MediaType... accepts) throws Exception {
        MockHttpServletRequestBuilder requestBuilder = applyDefaults(delete(url), accepts).contentType(MediaType.APPLICATION_JSON);
        if (body != null) requestBuilder.content(objectMapper.writeValueAsString(body));
        return mockMvc.perform(requestBuilder);
    }

    // --- Shortcuts that parse JSON bodies
    // --------------------------------------------------------

    /**
     * Reads and deserializes the response body into a concrete class.
     */
    private <T> T read(MvcResult result, Class<T> type) {
        try {
            return objectMapper.readValue(body(result), type);
        } catch (Exception e) {
            throw new AssertionError("Failed to read body as " + type.getSimpleName(), e);
        }
    }

    /**
     * Reads and deserializes the response body using a TypeReference.
     */
    private <T> T read(MvcResult result, TypeReference<T> typeRef) {
        try {
            return objectMapper.readValue(body(result), typeRef);
        } catch (Exception e) {
            throw new AssertionError("Failed to read body via TypeReference", e);
        }
    }

    // --- Internal helpers
    // ------------------------------------------------------------------------

    /**
     * Applies the default Accept header and all configured RequestPostProcessors.
     * This is where authentication processors are attached.
     */
    private <B extends AbstractMockHttpServletRequestBuilder<B>> B applyDefaults(B requestBuilder, MediaType... accepts) {
        requestBuilder = (accepts != null && accepts.length > 0) ? requestBuilder.accept(accepts) : requestBuilder.accept(defaultAccept);
        for (RequestPostProcessor rpp : defaultPostProcessors) {
            requestBuilder.with(rpp);
        }
        return requestBuilder;
    }

    // --- Misc helpers
    // ----------------------------------------------------------------------------

    /**
     * Returns the response body as a string.
     */
    private static String body(MvcResult result) throws Exception {
        MockHttpServletResponse resp = result.getResponse();
        return resp.getContentAsString();
    }
}
