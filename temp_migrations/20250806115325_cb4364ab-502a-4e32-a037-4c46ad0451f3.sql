-- Update specific storage vicinity names to standardize them
UPDATE storage_vicinities 
SET name = 'Guest House'
WHERE name IN ('Guest Hoise', 'Guest House Cr', 'Guesthouse');

UPDATE storage_vicinities 
SET name = 'Kitchen'
WHERE name = 'Kitchen Measurement';