-- Add scoring note for reference binders with prediction limitations
ALTER TABLE `reference_binders` ADD COLUMN `scoring_note` text;
