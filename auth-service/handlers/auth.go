package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"auth-service/database"
	"auth-service/middleware"
	"auth-service/models"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	bcryptCost = 12

	// mysqlDuplicateEntry is the MySQL error number for a unique-key violation.
	mysqlDuplicateEntry = 1062
)

// dummyHash is compared against when the user does not exist so that Login
// takes roughly the same time either way, preventing user enumeration by timing.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password"), bcryptCost)

func errorResponse(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": message})
}

func newAuthResponse(user models.User, token string) models.AuthResponse {
	var resp models.AuthResponse
	resp.Token = token
	resp.User.ID = user.ID
	resp.User.Name = user.Name
	resp.User.Email = user.Email
	return resp
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func isDuplicateEntry(err error) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == mysqlDuplicateEntry
}

// Register creates a new user account and returns an access token.
func Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "Invalid request: name, a valid email and a password of 6-72 characters are required")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		log.Printf("register: hash password: %v", err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	user := models.User{
		Name:     strings.TrimSpace(req.Name),
		Email:    normalizeEmail(req.Email),
		Password: string(hashedPassword),
	}

	if err := database.DB.Create(&user).Error; err != nil {
		if isDuplicateEntry(err) || errors.Is(err, gorm.ErrDuplicatedKey) {
			errorResponse(c, http.StatusConflict, "Email already exists")
			return
		}
		log.Printf("register: create user: %v", err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Email)
	if err != nil {
		log.Printf("register: generate token: %v", err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	c.JSON(http.StatusCreated, newAuthResponse(user, token))
}

// Login verifies credentials and returns an access token.
func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "Invalid request: a valid email and password are required")
		return
	}

	var user models.User
	err := database.DB.Where("email = ?", normalizeEmail(req.Email)).First(&user).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		errorResponse(c, http.StatusUnauthorized, "Invalid email or password")
		return
	case err != nil:
		log.Printf("login: find user: %v", err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		errorResponse(c, http.StatusUnauthorized, "Invalid email or password")
		return
	}

	token, err := middleware.GenerateToken(user.ID, user.Email)
	if err != nil {
		log.Printf("login: generate token: %v", err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	c.JSON(http.StatusOK, newAuthResponse(user, token))
}

// LookupUser finds a user by email (?email=) so tasks can be assigned to them.
func LookupUser(c *gin.Context) {
	email := normalizeEmail(c.Query("email"))
	if email == "" {
		errorResponse(c, http.StatusBadRequest, "email query parameter is required")
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			errorResponse(c, http.StatusNotFound, "User not found")
			return
		}
		log.Printf("lookup: find user: %v", err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": user.ID, "name": user.Name, "email": user.Email})
}

// Me returns the profile of the authenticated user.
func Me(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			errorResponse(c, http.StatusNotFound, "User not found")
			return
		}
		log.Printf("me: find user %d: %v", userID, err)
		errorResponse(c, http.StatusInternalServerError, "Internal server error")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":    user.ID,
		"name":  user.Name,
		"email": user.Email,
	})
}
