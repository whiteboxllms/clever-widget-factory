-- Clean up: Remove the tool-checkout-images bucket since we're consolidating to tool-images
DELETE FROM storage.buckets WHERE id = 'tool-checkout-images';