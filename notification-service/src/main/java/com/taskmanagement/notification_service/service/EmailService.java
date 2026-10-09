package com.taskmanagement.notification_service.service;

import com.taskmanagement.notification_service.dto.NotificationRequest;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void sendTaskNotification(NotificationRequest req) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(req.getTo());
        helper.setSubject(req.getSubject() != null ? req.getSubject() : "📋 Task Notification");

        String html = buildEmailHtml(req);
        helper.setText(html, true);

        mailSender.send(message);
    }

    private String buildEmailHtml(NotificationRequest req) {
        return """
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#3b82f6;">📋 Task Management</h2>
              <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0;">
                <h3 style="margin:0 0 8px;">%s</h3>
                <p style="color:#64748b;margin:0;">%s</p>
              </div>
              <p style="color:#64748b;">Assigned by: <strong>%s</strong></p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
              <p style="color:#94a3b8;font-size:12px;">Task Management System</p>
            </div>
        """.formatted(
                escape(req.getTaskTitle(), "New Task"),
                escape(req.getTaskDescription(), ""),
                escape(req.getAssignedBy(), "System")
        );
    }

    /** Escapes user-supplied text so it cannot inject HTML into the email body. */
    private static String escape(String value, String fallback) {
        return HtmlUtils.htmlEscape(value != null ? value : fallback);
    }
}