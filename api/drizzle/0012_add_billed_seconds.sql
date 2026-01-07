-- Add billed_seconds column to jobs table for partial billing tracking
ALTER TABLE jobs ADD COLUMN billed_seconds REAL DEFAULT 0;
