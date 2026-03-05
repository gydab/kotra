-- ==========================================
-- Migration 005: Fix WBIF ID mismatch
-- ==========================================
-- The wbif_id values were incorrectly set to the player's GLOBAL RANK 
-- position on the WBIF ratings table (e.g., Grétar Aasen = rank #102),
-- NOT the actual WBIF player profile ID (matchlog?id=XXXX).
--
-- This migration:
-- 1. Moves the rank numbers to the 'rank' column (where they belong)
-- 2. Sets wbif_id to NULL (players can self-link via dashboard)
-- ==========================================

-- Move the incorrectly stored rank values to the rank column
-- and clear wbif_id
UPDATE players SET
  rank = CAST(wbif_id AS INTEGER),
  wbif_id = NULL
WHERE country = 'IS' AND wbif_id IS NOT NULL;
