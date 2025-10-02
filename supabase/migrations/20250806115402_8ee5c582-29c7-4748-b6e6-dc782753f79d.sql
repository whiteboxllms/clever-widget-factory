-- First, update tools and parts tables to reference the standardized names
UPDATE tools 
SET storage_vicinity = 'Guest House'
WHERE storage_vicinity IN ('Guest Hoise', 'Guest House Cr', 'Guesthouse');

UPDATE tools 
SET storage_vicinity = 'Kitchen'
WHERE storage_vicinity = 'Kitchen Measurement';

UPDATE parts 
SET storage_vicinity = 'Guest House'
WHERE storage_vicinity IN ('Guest Hoise', 'Guest House Cr', 'Guesthouse');

UPDATE parts 
SET storage_vicinity = 'Kitchen'
WHERE storage_vicinity = 'Kitchen Measurement';

-- Now delete the old vicinity entries that we're consolidating
DELETE FROM storage_vicinities 
WHERE name IN ('Guest Hoise', 'Guest House Cr', 'Guesthouse', 'Kitchen Measurement');