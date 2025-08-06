-- First, update any tools that reference storage vicinities with "storage" in the name
UPDATE tools 
SET storage_vicinity = 'Storage Shed'
WHERE storage_vicinity IN (
  SELECT name FROM storage_vicinities 
  WHERE LOWER(name) LIKE '%storage%' AND name != 'Storage Shed'
);

-- Update any parts that reference storage vicinities with "storage" in the name  
UPDATE parts 
SET storage_vicinity = 'Storage Shed'
WHERE storage_vicinity IN (
  SELECT name FROM storage_vicinities 
  WHERE LOWER(name) LIKE '%storage%' AND name != 'Storage Shed'
);

-- Now delete the duplicate storage vicinities (keeping only "Storage Shed")
DELETE FROM storage_vicinities 
WHERE LOWER(name) LIKE '%storage%' 
AND name != 'Storage Shed';