CREATE TABLE IF NOT EXISTS pending_burns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_id INT NOT NULL,
  foil TINYINT(1) NOT NULL DEFAULT 0,
  animated TINYINT(1) NOT NULL DEFAULT 0,
  serial VARCHAR(32) NOT NULL,
  card_json JSON NOT NULL,
  seen_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_burns_user_unseen (user_id, seen_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
