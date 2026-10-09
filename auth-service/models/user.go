package models

import "gorm.io/gorm"

// User is a registered account.
type User struct {
	gorm.Model
	Name     string `json:"name" gorm:"size:100;not null"`
	Email    string `json:"email" gorm:"size:255;uniqueIndex;not null"`
	Password string `json:"-" gorm:"not null"`
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required,max=100"`
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=6,max=72"` // bcrypt ignores input beyond 72 bytes
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  struct {
		ID    uint   `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"user"`
}
