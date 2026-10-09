package com.taskmanagement.notification_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/** Asks auth-service whether a recipient is a registered user, so the API cannot be used as an open mail relay. */
@Service
public class RecipientVerifier {

    public enum Result { REGISTERED, NOT_REGISTERED, UNAVAILABLE }

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final String authServiceUrl;

    public RecipientVerifier(@Value("${app.auth-service-url:http://localhost:8080}") String authServiceUrl) {
        this.authServiceUrl = authServiceUrl;
    }

    public Result verify(String email, String authorizationHeader) {
        try {
            String query = URLEncoder.encode(email.trim(), StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder(URI.create(authServiceUrl + "/api/auth/users/lookup?email=" + query))
                    .header("Authorization", authorizationHeader)
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 200) return Result.REGISTERED;
            if (status == 404) return Result.NOT_REGISTERED;
            return Result.UNAVAILABLE;
        } catch (IOException e) {
            return Result.UNAVAILABLE;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.UNAVAILABLE;
        }
    }
}
