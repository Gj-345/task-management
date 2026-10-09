package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// These tests cover request validation, which runs before any database access.

func post(handler gin.HandlerFunc, body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/", handler)
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestRegister_InvalidRequest(t *testing.T) {
	tests := map[string]string{
		"empty body":     `{}`,
		"bad email":      `{"name":"A","email":"nope","password":"secret1"}`,
		"short password": `{"name":"A","email":"a@example.com","password":"123"}`,
		"long password":  `{"name":"A","email":"a@example.com","password":"` + strings.Repeat("x", 73) + `"}`,
		"malformed json": `{`,
	}
	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			if got := post(Register, body).Code; got != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", got)
			}
		})
	}
}

func TestLogin_InvalidRequest(t *testing.T) {
	tests := map[string]string{
		"empty body":  `{}`,
		"bad email":   `{"email":"nope","password":"x"}`,
		"no password": `{"email":"a@example.com"}`,
	}
	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			if got := post(Login, body).Code; got != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", got)
			}
		})
	}
}

func TestNormalizeEmail(t *testing.T) {
	if got := normalizeEmail("  Foo@Example.COM "); got != "foo@example.com" {
		t.Errorf("got %q", got)
	}
}
