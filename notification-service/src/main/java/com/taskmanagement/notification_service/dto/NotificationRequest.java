package com.taskmanagement.notification_service.dto;

import lombok.Data;

@Data
public class NotificationRequest {
    private String to;
    private String subject;
    private String taskTitle;
    private String taskDescription;
    private String assignedBy;
    private String type;
}