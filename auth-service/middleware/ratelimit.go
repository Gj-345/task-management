package middleware

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type window struct {
	count   int
	resetAt time.Time
}

// RateLimit limits each client IP to max requests per period (fixed window, in memory).
// It protects login/register from brute force; use a shared store if running multiple instances.
func RateLimit(max int, period time.Duration) gin.HandlerFunc {
	var (
		mu      sync.Mutex
		clients = make(map[string]*window)
	)

	go func() {
		for range time.Tick(period) {
			now := time.Now()
			mu.Lock()
			for ip, w := range clients {
				if now.After(w.resetAt) {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		w, ok := clients[ip]
		if !ok || now.After(w.resetAt) {
			w = &window{resetAt: now.Add(period)}
			clients[ip] = w
		}
		w.count++
		allowed := w.count <= max
		retryAfter := int(time.Until(w.resetAt).Seconds()) + 1
		mu.Unlock()

		if !allowed {
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests, please try again later"})
			return
		}
		c.Next()
	}
}
