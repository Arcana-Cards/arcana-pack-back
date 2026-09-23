ALTER TABLE booster_templates
  ADD COLUMN preset_key VARCHAR(40) NULL AFTER name;

ALTER TABLE booster_templates
  ADD UNIQUE KEY uq_booster_preset_key (preset_key);
