-- First, copy the image from tool-checkout-images to tool-images bucket
-- We need to use the storage API for this, but we can at least clean up the reference in the database

-- The single image from tool-checkout-images bucket needs to be manually copied first
-- Since there's still an object reference, let's update to use the correct naming pattern in tool-images

-- Update the database record to use the existing tool-images bucket with proper naming
UPDATE checkins 
SET after_image_urls = ARRAY[
  'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/tool-images/checkin_644bd06c-3ac8-47db-9e89-ad53604d3e59_22b9d418-befa-4726-b8f1-422d4d6ad680_1754438546481_1.jpg'
]
WHERE id = '7acab5ed-ddf4-42bb-8bb4-4648940fa207';