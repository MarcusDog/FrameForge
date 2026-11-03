SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS demo_user (
  id VARCHAR(20) PRIMARY KEY, name VARCHAR(80) NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS template (
  id VARCHAR(60) PRIMARY KEY, title VARCHAR(100) NOT NULL, category VARCHAR(60) NOT NULL,
  description VARCHAR(500) NOT NULL, required_image_count INT NOT NULL,
  cover_url VARCHAR(200) NOT NULL, layout VARCHAR(20) NOT NULL,
  CHECK (required_image_count BETWEEN 1 AND 3)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS asset (
  id CHAR(36) PRIMARY KEY, user_id VARCHAR(20) NOT NULL, path VARCHAR(200) NOT NULL,
  mime_type VARCHAR(40) NOT NULL, size_bytes BIGINT NOT NULL, width INT NOT NULL, height INT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES demo_user(id), INDEX ix_asset_user(user_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS task (
  seq BIGINT AUTO_INCREMENT PRIMARY KEY, id CHAR(36) NOT NULL UNIQUE,
  user_id VARCHAR(20) NOT NULL, template_id VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL, current_stage VARCHAR(30),
  result_path VARCHAR(200), error_code VARCHAR(60), error_message VARCHAR(500),
  request_key VARCHAR(80) NOT NULL, payload_hash CHAR(64) NOT NULL,
  check_ms INT NOT NULL, generation_ms INT NOT NULL, organize_ms INT NOT NULL, fail_at VARCHAR(30),
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_submission(user_id, request_key),
  INDEX ix_task_history(user_id, seq), INDEX ix_task_active(user_id, status),
  FOREIGN KEY (user_id) REFERENCES demo_user(id), FOREIGN KEY (template_id) REFERENCES template(id),
  CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED'))
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS task_asset (
  task_id CHAR(36) NOT NULL, asset_id CHAR(36) NOT NULL, position INT NOT NULL,
  PRIMARY KEY(task_id, position), UNIQUE KEY uq_task_asset(task_id, asset_id),
  FOREIGN KEY(task_id) REFERENCES task(id), FOREIGN KEY(asset_id) REFERENCES asset(id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE IF NOT EXISTS task_stage (
  task_id CHAR(36) NOT NULL, stage VARCHAR(30) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMP(3), ended_at TIMESTAMP(3), duration_ms BIGINT, error_message VARCHAR(500),
  PRIMARY KEY(task_id, stage), FOREIGN KEY(task_id) REFERENCES task(id),
  CHECK (stage IN ('MATERIAL_CHECK','GENERATING','ORGANIZING')),
  CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','SKIPPED'))
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
