package com.taskmanagement.notification_service.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Requires a valid HS256 JWT (issued by auth-service) on /api/notifications/send and limits
 * each user to a number of notifications per hour.
 * Fails closed: if JWT_SECRET is not configured, every protected request is rejected.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Pattern ALG = Pattern.compile("\"alg\"\\s*:\\s*\"HS256\"");
    private static final Pattern EXP = Pattern.compile("\"exp\"\\s*:\\s*(\\d+)");
    private static final Pattern USER_ID = Pattern.compile("\"user_id\"\\s*:\\s*(\\d+)");
    private static final long WINDOW_SECONDS = 3600;

    private record Window(long resetAt, int count) {
    }

    private final byte[] secret;
    private final int maxPerHour;
    private final Map<Long, Window> windows = new ConcurrentHashMap<>();

    public JwtAuthFilter(@Value("${app.jwt.secret:}") String secret,
                         @Value("${app.rate-limit.per-hour:30}") int maxPerHour) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.maxPerHour = maxPerHour;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Only protect the send endpoint; let CORS preflight and health checks through.
        return !(request.getRequestURI().startsWith("/api/notifications/send")
                && !"OPTIONS".equalsIgnoreCase(request.getMethod()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "Authorization header required");
            return;
        }

        Long userId = secret.length == 0 ? null : authenticate(header.substring("Bearer ".length()));
        if (userId == null) {
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid token");
            return;
        }
        if (!allow(userId)) {
            reject(response, 429, "Too many notifications, please try again later");
            return;
        }
        chain.doFilter(request, response);
    }

    /** Fixed-window limit of maxPerHour notifications per user (in memory, per instance). */
    private boolean allow(long userId) {
        long now = Instant.now().getEpochSecond();
        Window w = windows.merge(userId, new Window(now + WINDOW_SECONDS, 1),
                (old, fresh) -> now >= old.resetAt() ? fresh : new Window(old.resetAt(), old.count() + 1));
        return w.count() <= maxPerHour;
    }

    /** Returns the token's user_id, or null if the token is invalid or expired. */
    private Long authenticate(String token) {
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3) {
            return null;
        }
        try {
            Base64.Decoder decoder = Base64.getUrlDecoder();
            String header = new String(decoder.decode(parts[0]), StandardCharsets.UTF_8);
            if (!ALG.matcher(header).find()) {
                return null;
            }

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] expected = mac.doFinal((parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(expected, decoder.decode(parts[2]))) {
                return null;
            }

            String payload = new String(decoder.decode(parts[1]), StandardCharsets.UTF_8);
            Matcher exp = EXP.matcher(payload);
            Matcher uid = USER_ID.matcher(payload);
            if (!exp.find() || Long.parseLong(exp.group(1)) <= Instant.now().getEpochSecond() || !uid.find()) {
                return null;
            }
            return Long.parseLong(uid.group(1));
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            return null;
        }
    }

    private static void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
