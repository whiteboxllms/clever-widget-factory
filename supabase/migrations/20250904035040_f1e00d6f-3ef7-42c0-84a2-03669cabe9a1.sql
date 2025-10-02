-- Make legacy_storage_vicinity nullable with a default value
ALTER TABLE tools 
ALTER COLUMN legacy_storage_vicinity DROP NOT NULL,
ALTER COLUMN legacy_storage_vicinity SET DEFAULT 'General';