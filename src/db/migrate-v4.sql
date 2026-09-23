ALTER TABLE cards
  ADD COLUMN art_filter ENUM('none','shiny','blur','holo','chrome','vignette','swamp','neon','pixel') NOT NULL DEFAULT 'none' AFTER art_url,
  ADD COLUMN border_finish ENUM('matte','shiny','metallic','neon','prism','swamp') NOT NULL DEFAULT 'matte' AFTER art_filter,
  ADD COLUMN art_animated_url VARCHAR(500) NULL AFTER border_finish,
  ADD COLUMN animated_unlock_copies INT NOT NULL DEFAULT 5 AFTER art_animated_url;
