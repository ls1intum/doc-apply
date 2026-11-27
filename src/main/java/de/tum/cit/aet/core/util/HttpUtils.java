package de.tum.cit.aet.core.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Helpers for HTTP-related tasks.
 */
public class HttpUtils {

    private HttpUtils() {}

    /**
     * Resolves the client's IP address from the HTTP request. Prefers the 'X-Real-IP' header, which the nginx reverse
     * proxy overwrites with the address it received the request from, so a client cannot choose it. The
     * 'X-Forwarded-For' header is not used, because nginx appends to whatever the client sent and its first value is
     * therefore chosen by the client. Without a proxy, the remote address is used.
     *
     * @param request the HTTP servlet request
     * @return the resolved client IP address as a String
     */
    public static String getClientIp(HttpServletRequest request) {
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }
}
