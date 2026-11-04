-- Additive migration: safe for an existing volume; never overwrite edited profiles.
CREATE TABLE IF NOT EXISTS user_profile (
  user_id VARCHAR(20) PRIMARY KEY,
  nickname VARCHAR(24) NOT NULL,
  bio VARCHAR(160) NOT NULL DEFAULT '',
  avatar_color CHAR(7) NOT NULL DEFAULT '#6551d9',
  avatar_asset_id CHAR(36) NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES demo_user(id),
  CONSTRAINT fk_profile_avatar FOREIGN KEY (avatar_asset_id) REFERENCES asset(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
INSERT IGNORE INTO user_profile(user_id,nickname,avatar_color)
SELECT id,name,IF(id='bob','#38745d','#6551d9') FROM demo_user;
