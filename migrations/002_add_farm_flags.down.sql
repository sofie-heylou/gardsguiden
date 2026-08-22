-- Down migration for 002_add_farm_flags.
--
-- Dropping farm_flags discards the per-visitor dedup records.  That is not
-- data loss in any meaningful sense (the rows are pseudonymous and exist only
-- to prevent double-flagging), but it does mean every previous flagger can
-- flag every farm again, and user_flag_count on farms would then disagree with
-- the empty table until an admin clears the counters.
--
-- user_farm_flags is intentionally NOT recreated: it belonged to the removed
-- login system and nothing reads it.

DROP TABLE IF EXISTS farm_flags;
