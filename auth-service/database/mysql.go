package database

import (
	"fmt"
	"log"
	"os"

	"auth-service/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// DB is the shared database handle, initialised by Connect.
var DB *gorm.DB

// Connect opens the MySQL connection from DB_* environment variables and migrates the schema.
func Connect() error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{TranslateError: true})
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}

	if err := db.AutoMigrate(&models.User{}); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	DB = db
	log.Println("Database connected successfully")
	return nil
}
