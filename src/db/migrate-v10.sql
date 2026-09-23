ALTER TABLE cards ADD COLUMN giphy_url VARCHAR(500) NULL AFTER art_animated_url;

UPDATE cards
SET giphy_url = art_animated_url
WHERE giphy_url IS NULL
  AND art_animated_url LIKE '%giphy.com%';

UPDATE cards
SET giphy_url = art_url
WHERE giphy_url IS NULL
  AND art_url LIKE '%giphy.com%';
