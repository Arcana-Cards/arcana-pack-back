ALTER TABLE cards
  ADD COLUMN text_color VARCHAR(16) NOT NULL DEFAULT '#f4efe6' AFTER glow_color;
