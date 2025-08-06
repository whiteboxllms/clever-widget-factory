-- Fix all variations of storage vicinity names in tools table
UPDATE tools 
SET storage_vicinity = 'Storage Shed'
WHERE LOWER(TRIM(storage_vicinity)) LIKE '%storage%'
AND storage_vicinity != 'Storage Shed';

-- Also fix any parts table references
UPDATE parts 
SET storage_vicinity = 'Storage Shed'
WHERE LOWER(TRIM(storage_vicinity)) LIKE '%storage%'
AND storage_vicinity != 'Storage Shed';