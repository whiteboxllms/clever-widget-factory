-- Standardize supplier names and merge duplicates

-- Step 1: Update parts that reference duplicate suppliers to use the standardized versions

-- Merge "mambusao" parts to "Mambusao" (keep the proper case version)
UPDATE parts 
SET supplier_id = '3a7f7386-dafd-47af-b801-78eba5e5526a'
WHERE supplier_id = 'b39808de-d627-45fd-83c8-8f1ded4a86ad';

-- Merge "DA" parts to "D.A" but first update D.A to D.A. with period
UPDATE suppliers 
SET name = 'D.A.'
WHERE id = '68faa756-7349-4aa2-b137-f4ea33731512';

-- Merge "DA" parts to standardized "D.A."
UPDATE parts 
SET supplier_id = '68faa756-7349-4aa2-b137-f4ea33731512'
WHERE supplier_id = 'a60795c8-bf12-4dbe-9b00-2a211b97a357';

-- Merge "us" and "Us" parts to "US" (uppercase standard)
UPDATE parts 
SET supplier_id = 'eabaed13-b5d3-4406-bda6-ea590648f7a8'
WHERE supplier_id IN ('f8bd1399-d3fc-4273-b3d8-c93e013be4fb', 'd8a7a841-1f22-4ed7-b48a-c56b71c87ae5');

-- Step 2: Mark duplicate suppliers as inactive (soft delete)
UPDATE suppliers 
SET is_active = false
WHERE id IN (
    'b39808de-d627-45fd-83c8-8f1ded4a86ad', -- mambusao (lowercase)
    'a60795c8-bf12-4dbe-9b00-2a211b97a357', -- DA (no period)
    'f8bd1399-d3fc-4273-b3d8-c93e013be4fb', -- us (lowercase)
    'd8a7a841-1f22-4ed7-b48a-c56b71c87ae5'  -- Us (mixed case)
);

-- Step 3: Add a comment to track the consolidation
COMMENT ON COLUMN suppliers.name IS 'Supplier names follow these conventions: Proper case for companies, UPPERCASE for countries/regions, periods for abbreviations (D.A.)';