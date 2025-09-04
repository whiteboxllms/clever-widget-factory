-- Update tools with legacy location "Guest House" to use Guest House area
UPDATE tools 
SET parent_structure_id = '6d742e4b-315e-4916-8af7-1fce35390987'
WHERE legacy_storage_vicinity ILIKE '%guest%house%' 
  AND parent_structure_id IS NULL;