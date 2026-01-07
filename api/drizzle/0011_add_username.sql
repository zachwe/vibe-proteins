-- Add username column to user table for public display on leaderboards
ALTER TABLE `user` ADD COLUMN `username` text;
CREATE UNIQUE INDEX IF NOT EXISTS `user_username_unique` ON `user` (`username`) WHERE `username` IS NOT NULL;
