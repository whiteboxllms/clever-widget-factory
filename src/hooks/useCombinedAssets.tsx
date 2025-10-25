import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserNames } from '@/hooks/useUserNames';

export interface CombinedAsset {
  id: string;
  name: string;
  type: 'asset' | 'stock';
  description?: string;
  category?: string;
  status?: string;
  serial_number?: string;
  current_quantity?: number;
  minimum_quantity?: number;
  unit?: string;
  cost_per_unit?: number;
  cost_evidence_url?: string;
  supplier?: string;
  image_url?: string;
  storage_location?: string;
  storage_vicinity?: string;
  parent_structure_id?: string;
  parent_structure_name?: string; // Resolved name from parent_structure_id
  legacy_storage_vicinity?: string;
  area_display?: string; // Computed field: parent_structure_name || legacy_storage_vicinity
  has_issues?: boolean;
  is_checked_out?: boolean;
  checked_out_to?: string;
  checked_out_user_id?: string;
  checked_out_date?: string;
  accountable_person_id?: string;
  accountable_person_name?: string; // Resolved name from accountable_person_id
  accountable_person_color?: string; // Favorite color of accountable person
  created_at: string;
  updated_at: string;
}

type AssetsQueryOptions = {
  search?: string;
  limit?: number;
  page?: number;
  searchDescriptions?: boolean;
  showLowStock?: boolean;
};

export const useCombinedAssets = (showRemovedItems: boolean = false, options?: AssetsQueryOptions) => {
  const [assets, setAssets] = useState<CombinedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isFetchingRef = useRef(false);
  const latestRequestIdRef = useRef(0);
  
  // Use shared hook for user names (cached) - we'll fetch names for all users
  // This breaks the circular dependency that was causing flickering
  const { getUserName, getUserColor } = useUserNames([]);
  const currentSearchRef = useRef<string | undefined>(options?.search);
  const currentLimitRef = useRef<number>(options?.limit ?? 50);
  const currentPageRef = useRef<number>(options?.page ?? 0);

  const fetchAssets = async (overrides?: AssetsQueryOptions & { append?: boolean }) => {
    if (isFetchingRef.current) {
      console.warn('fetch ignored because a request is already in-flight');
      return;
    }
    isFetchingRef.current = true;
    const requestId = ++latestRequestIdRef.current;
    try {
      setLoading(true);
      // compute effective query params
      const effectiveSearch = overrides?.search ?? currentSearchRef.current;
      const effectiveLimit = overrides?.limit ?? currentLimitRef.current;
      const effectivePage = overrides?.page ?? currentPageRef.current;
      const includeDescriptions = overrides?.searchDescriptions ?? options?.searchDescriptions ?? false;
      const effectiveShowLowStock = overrides?.showLowStock ?? options?.showLowStock ?? false;
      if (overrides?.search !== undefined) currentSearchRef.current = overrides.search;
      if (overrides?.limit !== undefined) currentLimitRef.current = overrides.limit!;
      if (overrides?.page !== undefined) currentPageRef.current = overrides.page!;

      // Fetch tools (assets)
      let toolsQuery = supabase
        .from('tools')
        .select(`
          id,
          name,
          description,
          category,
          status,
          serial_number,
          parent_structure_id,
          storage_location,
          legacy_storage_vicinity,
          accountable_person_id,
          image_url,
          created_at,
          updated_at
        `);
      
      if (!showRemovedItems) {
        toolsQuery = toolsQuery.neq('status', 'removed');
      }

      if (effectiveSearch && effectiveSearch.trim() !== '') {
        const term = `%${effectiveSearch.trim()}%`;
        const fields = [
          `name.ilike.${term}`,
          `serial_number.ilike.${term}`,
          `category.ilike.${term}`,
          `storage_location.ilike.${term}`
        ];
        if (includeDescriptions) fields.push(`description.ilike.${term}`);
        toolsQuery = toolsQuery.or(fields.join(','));
      }

      const toolsOffset = effectivePage * effectiveLimit;
      const toolsRangeEnd = toolsOffset + effectiveLimit - 1;
      toolsQuery = toolsQuery.order('name').range(toolsOffset, toolsRangeEnd);

      // Build parts (stock) query
      let partsQuery = supabase
        .from('parts')
        .select(`
          id,
          name,
          description,
          category,
          current_quantity,
          minimum_quantity,
          unit,
          parent_structure_id,
          storage_location,
          legacy_storage_vicinity,
          accountable_person_id,
          image_url,
          created_at,
          updated_at
        `);

      if (effectiveSearch && effectiveSearch.trim() !== '') {
        const term = `%${effectiveSearch.trim()}%`;
        const fields = [
          `name.ilike.${term}`,
          `category.ilike.${term}`,
          `storage_location.ilike.${term}`
        ];
        if (includeDescriptions) fields.push(`description.ilike.${term}`);
        partsQuery = partsQuery.or(fields.join(','));
      }

      // When showing low stock, we need to fetch ALL parts to find all low stock items
      // instead of just the paginated subset
      if (effectiveShowLowStock) {
        // Don't apply pagination when filtering for low stock - we need all parts
        // Filter for parts that have minimum_quantity set and are greater than 0
        partsQuery = partsQuery
          .not('minimum_quantity', 'is', null)
          .gt('minimum_quantity', 0)
          .order('name');
      } else {
        // Normal pagination for other cases
        const partsOffset = toolsOffset; // keep same paging window size for both
        const partsRangeEnd = partsOffset + effectiveLimit - 1;
        partsQuery = partsQuery.order('name').range(partsOffset, partsRangeEnd);
      }

      // Kick off all independent requests in parallel
      const toolsPromise = toolsQuery;
      const partsPromise = partsQuery;
      const checkoutsPromise = supabase
        .from('checkouts')
        .select('tool_id, user_name, user_id, checkout_date')
        .eq('is_returned', false);
      const issuesPromise = supabase
        .from('issues')
        .select('context_id')
        .eq('context_type', 'tool')
        .eq('status', 'active');
      const parentsPromise = supabase
        .from('tools')
        .select('id, name')
        .in('category', ['Infrastructure', 'Container'])
        .neq('status', 'removed');

      const [toolsResponse, partsResponse, checkoutsResp, issuesResp, parentsResp] = await Promise.all([
        toolsPromise,
        partsPromise,
        checkoutsPromise,
        issuesPromise,
        parentsPromise
      ]);

      if (toolsResponse.error) throw toolsResponse.error;
      if (partsResponse.error) throw partsResponse.error;
      if (checkoutsResp.error) console.error('Error fetching checkouts:', checkoutsResp.error);
      if (issuesResp.error) console.error('Error fetching issues:', issuesResp.error);
      if (parentsResp.error) console.error('Error fetching parent structures:', parentsResp.error);

      // Build helper maps
      const checkoutMap = new Map<string, { user_name: string; user_id: string; checkout_date: string }>();
      checkoutsResp.data?.forEach(checkout => {
        checkoutMap.set(checkout.tool_id, {
          user_name: checkout.user_name,
          user_id: checkout.user_id,
          checkout_date: checkout.checkout_date
        });
      });

      const toolsWithIssues = new Set(issuesResp.data?.map(issue => issue.context_id) || []);

      // Create parent structure name map
      const parentStructureMap = new Map<string, string>();
      parentsResp.data?.forEach(parent => {
        parentStructureMap.set(parent.id, parent.name);
      });

      // Collect all unique accountable person IDs for shared hook
      const accountablePersonIds = Array.from(new Set([
        ...(toolsResponse.data || []).map(tool => tool.accountable_person_id).filter(Boolean),
        ...(partsResponse.data || []).map(part => part.accountable_person_id).filter(Boolean)
      ]));

      // Note: User names will be fetched separately using useUserNames hook

      // Transform and combine data
      // Transform parts to stock first
      let transformedParts = (partsResponse.data || []).map(part => {
        const parentStructureName = part.parent_structure_id ? parentStructureMap.get(part.parent_structure_id) : null;
        const accountablePersonName = part.accountable_person_id ? getUserName(part.accountable_person_id) : null;
        const accountablePersonColor = part.accountable_person_id ? getUserColor(part.accountable_person_id) : null;
        return {
          ...part,
          type: 'stock' as const,
          parent_structure_name: parentStructureName,
          area_display: parentStructureName || part.legacy_storage_vicinity,
          has_issues: false,
          is_checked_out: false,
          accountable_person_name: accountablePersonName,
          accountable_person_color: accountablePersonColor
        };
      });

      // Apply low stock filtering client-side if needed
      if (effectiveShowLowStock) {
        transformedParts = transformedParts.filter(part => 
          part.minimum_quantity !== null && 
          part.minimum_quantity > 0 && 
          part.current_quantity < part.minimum_quantity
        );
      }

      const transformedAssets: CombinedAsset[] = [
        // Only include tools (assets) when NOT showing low stock
        // When showing low stock, we only want stock items
        ...(effectiveShowLowStock ? [] : (toolsResponse.data || []).map(tool => {
          const checkout = checkoutMap.get(tool.id);
          const parentStructureName = tool.parent_structure_id ? parentStructureMap.get(tool.parent_structure_id) : null;
          const accountablePersonName = tool.accountable_person_id ? getUserName(tool.accountable_person_id) : null;
          const accountablePersonColor = tool.accountable_person_id ? getUserColor(tool.accountable_person_id) : null;
          return {
            ...tool,
            type: 'asset' as const,
            parent_structure_name: parentStructureName,
            area_display: parentStructureName || tool.legacy_storage_vicinity,
            has_issues: toolsWithIssues.has(tool.id),
            is_checked_out: checkoutMap.has(tool.id),
            checked_out_to: checkout?.user_name,
            checked_out_user_id: checkout?.user_id,
            checked_out_date: checkout?.checkout_date,
            accountable_person_name: accountablePersonName,
            accountable_person_color: accountablePersonColor
          };
        })),
        // Add filtered parts
        ...transformedParts
      ];
      
      if (latestRequestIdRef.current === requestId) {
        if (overrides?.append) {
          setAssets(prev => [...prev, ...transformedAssets]);
        } else {
          // Only update if the assets have actually changed
          setAssets(prev => {
            if (prev.length !== transformedAssets.length) {
              return transformedAssets;
            }
            
            // Check if any asset has changed by comparing IDs and key properties
            const hasChanges = prev.some((prevAsset, index) => {
              const nextAsset = transformedAssets[index];
              if (!nextAsset || prevAsset.id !== nextAsset.id) return true;
              
              // Check key properties that affect rendering
              return prevAsset.name !== nextAsset.name ||
                     prevAsset.type !== nextAsset.type ||
                     prevAsset.status !== nextAsset.status ||
                     prevAsset.current_quantity !== nextAsset.current_quantity ||
                     prevAsset.has_issues !== nextAsset.has_issues ||
                     prevAsset.is_checked_out !== nextAsset.is_checked_out ||
                     prevAsset.accountable_person_name !== nextAsset.accountable_person_name ||
                     prevAsset.accountable_person_color !== nextAsset.accountable_person_color ||
                     prevAsset.updated_at !== nextAsset.updated_at;
            });
            
            if (hasChanges) {
              return transformedAssets;
            } else {
              return prev;
            }
          });
        }
      } else {
        console.warn('assets: stale response discarded');
      }
    } catch (error) {
      console.error('Error fetching combined assets:', error);
      toast({
        title: "Error",
        description: "Failed to load assets",
        variant: "destructive"
      });
    } finally {
      if (latestRequestIdRef.current === requestId) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  };

  const createAsset = async (assetData: Record<string, unknown>, isAsset: boolean) => {
    try {
      const table = isAsset ? 'tools' : 'parts';
      const { data, error } = await supabase
        .from(table)
        // @ts-expect-error: Insert shape varies per table; validated server-side
        .insert(assetData)
        .select()
        .single();

      if (error) {
        console.error(`Supabase error creating ${table}:`, error);
        throw error;
      }

      // Log creation event for stock items (parts_history)
      if (!isAsset) {
        try {
          const partData = data as Partial<CombinedAsset>;
          await supabase
            .from('parts_history')
            .insert({
              part_id: data.id,
              change_type: 'create',
              old_quantity: 0,
              new_quantity: partData.current_quantity || 0,
              quantity_change: partData.current_quantity || 0,
              changed_by: (await supabase.auth.getUser()).data.user?.id,
              change_reason: `Created stock item: ${data.name}`,
              organization_id: data.organization_id
            });
        } catch (historyError) {
          console.warn('Failed to log creation to parts_history:', historyError);
        }
      } else {
        // Log creation event for tools/assets (asset_history table)
        try {
          const currentUser = await supabase.auth.getUser();
          if (currentUser.data.user) {
            await supabase
              .from('asset_history')
              .insert({
                asset_id: data.id,
                changed_by: currentUser.data.user.id,
                changed_at: new Date().toISOString(),
                change_type: 'created',
                field_changed: null,
                old_value: null,
                new_value: null,
                notes: `Asset created: ${data.name}`,
                organization_id: data.organization_id
              });
          }
        } catch (historyError) {
          console.warn('Failed to log creation to asset_history:', historyError);
        }
      }

      // Add to local state
      const newAsset: CombinedAsset = {
        ...data,
        type: isAsset ? 'asset' : 'stock',
        has_issues: false,
        is_checked_out: false
      };
      
      setAssets(prev => [...prev, newAsset]);
      return data;
    } catch (error) {
      console.error(`Error creating ${isAsset ? 'asset' : 'stock item'}:`, error);
      toast({
        title: "Error",
        description: `Failed to create ${isAsset ? 'asset' : 'stock item'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      return null;
    }
  };

  const updateAsset = async (assetId: string, updates: Partial<CombinedAsset>, isAsset: boolean) => {
    try {
      const table = isAsset ? 'tools' : 'parts';
      
      // For assets, fetch current values before updating
      let currentAsset = null;
      if (isAsset) {
        const { data } = await supabase
          .from('tools')
          .select('*')
          .eq('id', assetId)
          .single();
        currentAsset = data;
      }
      
      const { error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', assetId);

      if (error) throw error;

      // Log history for assets
      if (isAsset && currentAsset) {
        try {
          const currentUser = await supabase.auth.getUser();
          if (currentUser.data.user) {
            const historyPromises = [];
            
            // Track each changed field
            for (const [field, newValue] of Object.entries(updates)) {
              const oldValue = currentAsset[field];
              
              // Only log if value actually changed
              if (oldValue !== newValue) {
                const changeType = field === 'status' ? 'status_change' : 'updated';
                
                historyPromises.push(
                  supabase
                    .from('asset_history')
                    .insert({
                      asset_id: assetId,
                      changed_by: currentUser.data.user.id,
                      changed_at: new Date().toISOString(),
                      change_type: changeType,
                      field_changed: field,
                      old_value: oldValue ? String(oldValue) : null,
                      new_value: newValue ? String(newValue) : null,
                      notes: `Field '${field}' updated`,
                      organization_id: currentAsset.organization_id
                    })
                );
              }
            }
            
            if (historyPromises.length > 0) {
              await Promise.all(historyPromises);
            }
          }
        } catch (historyError) {
          console.warn('Failed to log asset updates to history:', historyError);
        }
      }

      // Update local state
      setAssets(prev => prev.map(asset => 
        asset.id === assetId ? { ...asset, ...updates } : asset
      ));

      return true;
    } catch (error) {
      console.error(`Error updating ${isAsset ? 'asset' : 'stock item'}:`, error);
      toast({
        title: "Error",
        description: `Failed to update ${isAsset ? 'asset' : 'stock item'}`,
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAssets();
    // If StrictMode double-invokes effects in dev, the in-flight guard above
    // ensures we will not duplicate concurrent requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRemovedItems]);

  // Memoize the assets array to prevent unnecessary re-renders
  // Create stable references for each asset to prevent object recreation
  const memoizedAssets = useMemo(() => {
    return assets.map(asset => ({ ...asset })); // Create new object references only when content changes
  }, [assets]);

  return {
    assets: memoizedAssets,
    loading,
    fetchAssets,
    createAsset,
    updateAsset,
    refetch: fetchAssets
  };
};