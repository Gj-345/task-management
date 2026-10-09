package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auth-service/database"
	"auth-service/handlers"
	"auth-service/middleware"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const shutdownTimeout = 10 * time.Second

func main() {
	// A missing .env file is fine: configuration may come from the real environment.
	if err := godotenv.Load(); err != nil {
		log.Printf("no .env file loaded: %v", err)
	}

	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET must be set")
	}

	if err := database.Connect(); err != nil {
		log.Fatalf("database: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + getEnv("PORT", "8080"),
		Handler:           newRouter(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("Auth service running on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func newRouter() *gin.Engine {
	r := gin.Default()
	r.Use(cors(getEnv("CORS_ALLOW_ORIGIN", "*")))

	auth := r.Group("/api/auth")
	{
		limit := middleware.RateLimit(10, time.Minute)
		auth.POST("/register", limit, handlers.Register)
		auth.POST("/login", limit, handlers.Login)
		auth.GET("/me", middleware.AuthMiddleware(), handlers.Me)
		auth.GET("/users/lookup", middleware.AuthMiddleware(), handlers.LookupUser)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "auth-service"})
	})

	return r
}

// cors allows cross-origin requests from the given origin ("*" for any).
// Set CORS_ALLOW_ORIGIN to the frontend origin in production.
func cors(allowOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowOrigin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
