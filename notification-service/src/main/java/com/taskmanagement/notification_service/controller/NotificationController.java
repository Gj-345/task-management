package com.taskmanagement.notification_service.controller;

import com.taskmanagement.notification_service.dto.NotificationRequest;
import com.taskmanagement.notification_service.service.EmailService;
import com.taskmanagement.notification_service.service.RecipientVerifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "${app.cors.allowed-origin:*}")
@RequiredArgsConstructor
public class NotificationController {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@,;<>]+@[^\\s@,;<>]+\\.[^\\s@,;<>]+$");
    private static final int MAX_FIELD_LENGTH = 1000;

    private final EmailService emailService;
    private final RecipientVerifier recipientVerifier;

    @PostMapping("/send")
    public ResponseEntity<?> sendNotification(@RequestBody NotificationRequest req,
                                              @RequestHeader("Authorization") String authorization) {
        String validationError = validate(req);
        if (validationError != null) {
            return ResponseEntity.badRequest().body(Map.of("error", validationError));
        }

        switch (recipientVerifier.verify(req.getTo(), authorization)) {
            case NOT_REGISTERED -> {
                return ResponseEntity.badRequest().body(Map.of("error", "Recipient is not a registered user"));
            }
            case UNAVAILABLE -> {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Could not verify recipient"));
            }
            case REGISTERED -> { }
        }

        try {
            emailService.sendTaskNotification(req);
            return ResponseEntity.ok(Map.of("message", "Notification sent successfully"));
        } catch (Exception e) {
            log.error("Failed to send notification to {}", req.getTo(), e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Failed to send notification"));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "notification-service"));
    }

    private static String validate(NotificationRequest req) {
        if (req.getTo() == null || !EMAIL.matcher(req.getTo().trim()).matches()) {
            return "A valid recipient email ('to') is required";
        }
        // Subject goes into a mail header, so it must not contain line breaks (header injection)
        if (req.getSubject() != null && req.getSubject().contains("\n")
                || req.getSubject() != null && req.getSubject().contains("\r")) {
            return "Subject must not contain line breaks";
        }
        for (String field : new String[]{req.getSubject(), req.getTaskTitle(),
                req.getTaskDescription(), req.getAssignedBy()}) {
            if (field != null && field.length() > MAX_FIELD_LENGTH) {
                return "Field too long (max " + MAX_FIELD_LENGTH + " characters)";
            }
        }
        return null;
    }
}
