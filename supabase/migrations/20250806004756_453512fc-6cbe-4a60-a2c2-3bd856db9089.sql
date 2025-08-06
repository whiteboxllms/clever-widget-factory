-- Since we can't delete the bucket while it has objects, 
-- let's delete the single object first, then the bucket
DELETE FROM storage.objects 
WHERE bucket_id = 'tool-checkout-images' 
AND name = '644bd06c-3ac8-47db-9e89-ad53604d3e59_22b9d418-befa-4726-b8f1-422d4d6ad680_1754438546481_1.jpg';

-- Now delete the bucket
DELETE FROM storage.buckets WHERE id = 'tool-checkout-images';