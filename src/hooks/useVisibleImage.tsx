import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AssetType = 'asset' | 'stock';

const imageUrlCache = new Map<string, string | null>();

export function useVisibleImage(
  assetId: string,
  assetType: AssetType,
  initialImageUrl?: string | null
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    if (imageUrl) return;
    const cacheKey = `${assetType}:${assetId}`;
    if (imageUrlCache.has(cacheKey)) {
      setImageUrl(imageUrlCache.get(cacheKey) || null);
      return;
    }

    let cancelled = false;
    const fetchImage = async () => {
      try {
        setLoading(true);
        const table = assetType === 'asset' ? 'tools' : 'parts';
        const { data, error } = await supabase
          .from(table)
          .select('image_url')
          .eq('id', assetId)
          .single();
        if (error) {
          // Cache miss as null to avoid refetching repeatedly
          imageUrlCache.set(cacheKey, null);
          return;
        }
        const url = (data as { image_url?: string | null })?.image_url || null;
        imageUrlCache.set(cacheKey, url);
        if (!cancelled) {
          setImageUrl(url);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchImage();
    return () => {
      cancelled = true;
    };
  }, [isVisible, imageUrl, assetId, assetType]);

  return { containerRef, imageUrl, loading };
}


