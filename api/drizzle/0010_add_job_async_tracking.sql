-- Add Modal async tracking fields to jobs table
ALTER TABLE jobs ADD COLUMN modal_call_id TEXT;
ALTER TABLE jobs ADD COLUMN progress TEXT;
