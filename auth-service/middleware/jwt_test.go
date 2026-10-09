package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func newTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/me", AuthMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user_id": c.GetUint("user_id")})
	})
	return r
}

func doRequest(r *gin.Engine, authHeader string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestGenerateToken_RequiresSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if _, err := GenerateToken(1, "a@example.com"); err == nil {
		t.Fatal("expected error when JWT_SECRET is empty")
	}
}

func TestAuthMiddleware(t *testing.T) {
	t.Setenv("JWT_SECRET", "test-secret")
	r := newTestRouter()

	valid, err := GenerateToken(7, "a@example.com")
	if err != nil {
		t.Fatal(err)
	}

	expired, err := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{
		UserID:           7,
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour))},
	}).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatal(err)
	}

	wrongAlg, err := jwt.NewWithClaims(jwt.SigningMethodHS512, Claims{UserID: 7}).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatal(err)
	}

	wrongSecret, err := jwt.NewWithClaims(jwt.SigningMethodHS256, Claims{UserID: 7}).SignedString([]byte("other"))
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name   string
		header string
		want   int
	}{
		{"valid token", "Bearer " + valid, http.StatusOK},
		{"missing header", "", http.StatusUnauthorized},
		{"wrong scheme", "Basic abc", http.StatusUnauthorized},
		{"garbage token", "Bearer not-a-jwt", http.StatusUnauthorized},
		{"expired token", "Bearer " + expired, http.StatusUnauthorized},
		{"unexpected algorithm", "Bearer " + wrongAlg, http.StatusUnauthorized},
		{"wrong secret", "Bearer " + wrongSecret, http.StatusUnauthorized},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := doRequest(r, tt.header).Code; got != tt.want {
				t.Errorf("status = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestAuthMiddleware_MissingSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if got := doRequest(newTestRouter(), "Bearer abc").Code; got != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", got)
	}
}
