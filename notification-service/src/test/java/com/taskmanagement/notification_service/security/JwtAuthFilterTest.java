package com.taskmanagement.notification_service.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JwtAuthFilterTest {

    private static final String SECRET = "test-secret";

    private static String b64(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    private static String token(String alg, long exp, String secret) throws Exception {
        String unsigned = b64("{\"alg\":\"" + alg + "\",\"typ\":\"JWT\"}") + "." + b64("{\"user_id\":1,\"exp\":" + exp + "}");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String sig = Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(unsigned.getBytes(StandardCharsets.UTF_8)));
        return unsigned + "." + sig;
    }

    private int call(String secret, String method, String uri, String authHeader) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        if (authHeader != null) req.addHeader("Authorization", authHeader);
        MockHttpServletResponse res = new MockHttpServletResponse();
        new JwtAuthFilter(secret, 30).doFilter(req, res, new MockFilterChain());
        return res.getStatus();
    }

    @Test
    void limitsNotificationsPerUser() throws Exception {
        JwtAuthFilter filter = new JwtAuthFilter(SECRET, 2);
        String header = "Bearer " + token("HS256", future(), SECRET);
        int[] statuses = new int[3];
        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/notifications/send");
            req.addHeader("Authorization", header);
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, new MockFilterChain());
            statuses[i] = res.getStatus();
        }
        assertEquals(200, statuses[0]);
        assertEquals(200, statuses[1]);
        assertEquals(429, statuses[2]);
    }

    private static long future() { return Instant.now().getEpochSecond() + 3600; }

    @Test
    void validTokenPasses() throws Exception {
        assertEquals(200, call(SECRET, "POST", "/api/notifications/send", "Bearer " + token("HS256", future(), SECRET)));
    }

    @Test
    void rejectsBadTokens() throws Exception {
        String uri = "/api/notifications/send";
        assertEquals(401, call(SECRET, "POST", uri, null));
        assertEquals(401, call(SECRET, "POST", uri, "Bearer garbage"));
        assertEquals(401, call(SECRET, "POST", uri, "Bearer " + token("HS256", future(), "other")));
        assertEquals(401, call(SECRET, "POST", uri, "Bearer " + token("HS256", Instant.now().getEpochSecond() - 10, SECRET)));
        assertEquals(401, call(SECRET, "POST", uri, "Bearer " + token("none", future(), SECRET)));
    }

    @Test
    void failsClosedWithoutSecret() throws Exception {
        assertEquals(401, call("", "POST", "/api/notifications/send", "Bearer " + token("HS256", future(), SECRET)));
    }

    @Test
    void preflightAndHealthSkipAuth() throws Exception {
        assertEquals(200, call(SECRET, "OPTIONS", "/api/notifications/send", null));
        assertEquals(200, call(SECRET, "GET", "/api/notifications/health", null));
    }
}
