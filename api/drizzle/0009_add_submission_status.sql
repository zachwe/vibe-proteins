-- Add status and error columns to submissions table
ALTER TABLE submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE submissions ADD COLUMN error TEXT;
