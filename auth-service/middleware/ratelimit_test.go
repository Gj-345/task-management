package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/", RateLimit(3, time.Minute), func(c *gin.Context) { c.Status(http.StatusOK) })

	send := func(remoteAddr string) int {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		req.RemoteAddr = remoteAddr
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	for i := 0; i < 3; i++ {
		if got := send("1.2.3.4:1000"); got != http.StatusOK {
			t.Fatalf("request %d: status = %d, want 200", i+1, got)
		}
	}
	if got := send("1.2.3.4:1000"); got != http.StatusTooManyRequests {
		t.Errorf("4th request: status = %d, want 429", got)
	}
	if got := send("5.6.7.8:1000"); got != http.StatusOK {
		t.Errorf("different IP: status = %d, want 200", got)
	}
}
