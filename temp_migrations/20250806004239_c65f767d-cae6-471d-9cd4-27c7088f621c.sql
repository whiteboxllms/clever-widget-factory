-- Step 1: Copy the single image from tool-checkout-images to tool-images bucket
-- We'll do this by updating the checkins record to point to a new path in tool-images

-- First, let's update the database record to point to the new location
UPDATE checkins 
SET after_image_urls = ARRAY[
  'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/tool-images/checkin_644bd06c-3ac8-47db-9e89-ad53604d3e59_22b9d418-befa-4726-b8f1-422d4d6ad680_1754438546481_1.jpg'
]
WHERE id = '7acab5ed-ddf4-42bb-8bb4-4648940fa207';