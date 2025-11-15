import { useRef } from 'react';

type AssetType = 'asset' | 'stock';

export function useVisibleImage(
  assetId: string,
  assetType: AssetType,
  initialImageUrl?: string | null
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Return the initial image URL directly since we now have S3 URLs from the API
  return { 
    containerRef, 
    imageUrl: initialImageUrl, 
    loading: false 
  };
}
