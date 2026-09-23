ALTER TABLE collection_copies
  ADD COLUMN in_binder TINYINT(1) NOT NULL DEFAULT 0 AFTER animated;

ALTER TABLE collection_copies
  ADD INDEX idx_copies_user_binder (user_id, in_binder);
