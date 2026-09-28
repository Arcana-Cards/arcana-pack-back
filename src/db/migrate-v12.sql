ALTER TABLE users
  ADD COLUMN sprint_days DECIMAL(4,1) NULL AFTER role;

CREATE TABLE IF NOT EXISTS sprint_attendance (
  jira_sprint_id INT NOT NULL,
  person_key VARCHAR(191) NOT NULL,
  days DECIMAL(4,1) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (jira_sprint_id, person_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
