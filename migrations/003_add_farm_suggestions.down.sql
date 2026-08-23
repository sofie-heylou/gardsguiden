-- Down migration for 003_add_farm_suggestions.
--
-- Destructive: farm_suggestions holds visitor-submitted correction text and
-- the sender's email address, which exists nowhere else once the notification
-- email has been read. Take a database snapshot before running this.

DROP TABLE IF EXISTS farm_suggestions;
