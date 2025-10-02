-- Update any storage vicinity with "storage" in the name to "Storage Shed"
-- This will consolidate all storage-related vicinities into one standard name
UPDATE storage_vicinities 
SET name = 'Storage Shed'
WHERE LOWER(name) LIKE '%storage%' 
AND name != 'Storage Shed';