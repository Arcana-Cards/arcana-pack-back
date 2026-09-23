-- Arcana Pack — Database Schema

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(40) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'collector') NOT NULL DEFAULT 'collector',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS universes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  tagline VARCHAR(255) NULL,
  description TEXT NULL,
  accent_color VARCHAR(16) NOT NULL DEFAULT '#7c3aed',
  backdrop_color VARCHAR(16) NOT NULL DEFAULT '#0b0614',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS editions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  universe_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(16) NOT NULL,
  number INT NOT NULL DEFAULT 1,
  description TEXT NULL,
  released_at DATE NULL,
  cover_color VARCHAR(16) NOT NULL DEFAULT '#1e1b4b',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_edition_code (code),
  UNIQUE KEY uq_edition_universe_number (universe_id, number),
  FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  universe_id INT NOT NULL,
  edition_id INT NOT NULL,
  collector_number INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  subtitle VARCHAR(120) NULL,
  description TEXT NULL,
  flavor_text VARCHAR(500) NULL,
  style ENUM('painterly','pixel','comic','gothic','neon','stained_glass','watercolor','holographic') NOT NULL DEFAULT 'painterly',
  magic_type ENUM('none','arcane','nature','fire','water','shadow','holy','chaos','swamp','tech') NOT NULL DEFAULT 'none',
  kind ENUM('creature','object','land','spell','enchantment') NOT NULL DEFAULT 'creature',
  subtype VARCHAR(80) NULL,
  rarity ENUM('common','uncommon','rare','epic','legendary','mythic') NOT NULL DEFAULT 'common',
  foil TINYINT(1) NOT NULL DEFAULT 0,
  animated TINYINT(1) NOT NULL DEFAULT 0,
  border_color VARCHAR(16) NOT NULL DEFAULT '#d4af37',
  back_color VARCHAR(16) NOT NULL DEFAULT '#1a1028',
  glow_color VARCHAR(16) NOT NULL DEFAULT '#a78bfa',
  text_color VARCHAR(16) NOT NULL DEFAULT '#f4efe6',
  frame_style ENUM('classic','ornate','minimal','rune','hextech','swamp') NOT NULL DEFAULT 'classic',
  holofoil_pattern ENUM('none','linear','radial','galaxy','prism') NOT NULL DEFAULT 'linear',
  power INT NULL,
  toughness INT NULL,
  artist VARCHAR(80) NULL,
  art_seed VARCHAR(64) NOT NULL,
  art_url VARCHAR(500) NULL,
  art_filter ENUM('none','shiny','blur','holo','chrome','vignette','swamp','neon','pixel') NOT NULL DEFAULT 'none',
  border_finish ENUM('matte','shiny','metallic','neon','prism','swamp') NOT NULL DEFAULT 'matte',
  art_animated_url VARCHAR(500) NULL,
  giphy_url VARCHAR(500) NULL,
  animated_unlock_copies INT NOT NULL DEFAULT 5,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_card_edition_number (edition_id, collector_number),
  INDEX idx_cards_universe (universe_id),
  INDEX idx_cards_rarity (rarity),
  FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE,
  FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booster_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  preset_key VARCHAR(40) NULL,
  description TEXT NULL,
  universe_id INT NULL,
  edition_id INT NULL,
  card_count INT NOT NULL DEFAULT 5,
  rarity_weights JSON NOT NULL,
  average_rarity ENUM('common','uncommon','rare','epic','legendary','mythic') NOT NULL DEFAULT 'uncommon',
  guaranteed_rarity ENUM('common','uncommon','rare','epic','legendary','mythic') NOT NULL DEFAULT 'rare',
  foil_chance DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  animated_chance DECIMAL(5,2) NOT NULL DEFAULT 3.00,
  allow_duplicates TINYINT(1) NOT NULL DEFAULT 1,
  art_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booster_preset_key (preset_key),
  FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE SET NULL,
  FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_boosters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  template_id INT NOT NULL,
  granted_by INT NOT NULL,
  opened_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_boosters_user (user_id, opened_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES booster_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notebooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  edition_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notebook_user_edition (user_id, edition_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collection_copies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  card_id INT NOT NULL,
  booster_id INT NULL,
  foil TINYINT(1) NOT NULL DEFAULT 0,
  animated TINYINT(1) NOT NULL DEFAULT 0,
  in_binder TINYINT(1) NOT NULL DEFAULT 0,
  binder_slot INT NULL,
  serial VARCHAR(32) NOT NULL,
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_copy_serial (serial),
  INDEX idx_copies_user_card (user_id, card_id),
  INDEX idx_copies_user_binder (user_id, in_binder),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (booster_id) REFERENCES user_boosters(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
