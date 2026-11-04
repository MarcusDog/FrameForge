CREATE TABLE IF NOT EXISTS account_credential (
  username VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL UNIQUE,
  salt VARCHAR(24) NOT NULL,
  password_hash VARCHAR(44) NOT NULL,
  iterations INT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP(3) NULL,
  FOREIGN KEY (user_id) REFERENCES demo_user(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS auth_session (
  token_hash CHAR(64) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  INDEX idx_session_expiry(expires_at),
  FOREIGN KEY (user_id) REFERENCES demo_user(id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
