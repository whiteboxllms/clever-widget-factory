-- Update tools with legacy location "Storage Shed" to use Storage Shed area
UPDATE tools 
SET parent_structure_id = 'e41f3481-d62b-4d42-a36e-803fca8a0829'
WHERE legacy_storage_vicinity ILIKE '%storage%shed%' 
  AND parent_structure_id IS NULL;