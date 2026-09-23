ALTER TABLE cards
  ADD COLUMN kind ENUM('creature','object','land','spell','enchantment') NOT NULL DEFAULT 'creature' AFTER magic_type;
