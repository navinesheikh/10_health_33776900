-- FitTrack database schema
CREATE DATABASE IF NOT EXISTS health
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE health;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  hashed_password VARCHAR(255) NOT NULL,
  role ENUM('member', 'admin') NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workouts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  exercise_name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  calories_burned SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  workout_date DATE NOT NULL,
  notes VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workouts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_workouts_user_date (user_id, workout_date),
  INDEX idx_workouts_exercise (exercise_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_audit (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_audit_time (attempted_at)
) ENGINE=InnoDB;
