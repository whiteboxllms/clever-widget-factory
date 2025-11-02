import { createSupabaseClient, validateOrganizationAccess } from '../lib/supabase.ts';
import { 
  QueryPartsInventorySchema, 
  GetPartDetailsSchema, 
  CheckPartsAvailabilitySchema 
} from '../lib/schemas.ts';
import { logToolInvocation, createSuccessResponse, createErrorResponse, formatError, buildSearchQuery } from '../lib/utils.ts';

export async function queryPartsInventory(params: any) {
  const validatedParams = QueryPartsInventorySchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('query_parts_inventory', validatedParams.organization_id, undefined, validatedParams);

    // Build query
    let query = supabase
      .from('parts')
      .select(`
        id,
        name,
        description,
        category,
        current_quantity,
        minimum_quantity,
        unit,
        storage_location,
        storage_vicinity,
        supplier,
        supplier_id,
        cost_per_unit,
        image_url
      `)
      .eq('organization_id', validatedParams.organization_id)
      .order('name', { ascending: true })
      .limit(validatedParams.limit);

    // Apply filters
    if (validatedParams.search_term) {
      const searchQuery = buildSearchQuery(validatedParams.search_term);
      query = query.or(`name.ilike.%${validatedParams.search_term}%,description.ilike.%${validatedParams.search_term}%`);
    }
    if (validatedParams.category) {
      query = query.eq('category', validatedParams.category);
    }
    if (validatedParams.min_quantity !== undefined) {
      query = query.gte('current_quantity', validatedParams.min_quantity);
    }
    if (validatedParams.storage_vicinity) {
      query = query.eq('storage_vicinity', validatedParams.storage_vicinity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error querying parts inventory:', error);
      return createErrorResponse('Failed to query parts inventory', 'DATABASE_ERROR');
    }

    // Add availability status
    const partsWithStatus = (data || []).map(part => ({
      ...part,
      availability_status: part.current_quantity <= (part.minimum_quantity || 0) ? 'low_stock' : 'available',
      needs_reorder: part.current_quantity <= (part.minimum_quantity || 0)
    }));

    return createSuccessResponse({
      parts: partsWithStatus,
      count: partsWithStatus.length,
      filters_applied: {
        search_term: validatedParams.search_term,
        category: validatedParams.category,
        min_quantity: validatedParams.min_quantity,
        storage_vicinity: validatedParams.storage_vicinity
      },
      summary: {
        total_parts: partsWithStatus.length,
        low_stock_count: partsWithStatus.filter(p => p.needs_reorder).length,
        available_count: partsWithStatus.filter(p => !p.needs_reorder).length
      }
    });

  } catch (error) {
    console.error('Error in queryPartsInventory:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function getPartDetails(params: any) {
  const validatedParams = GetPartDetailsSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('get_part_details', validatedParams.organization_id, undefined, validatedParams);

    // Get part details
    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('*')
      .eq('id', validatedParams.part_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (partError || !part) {
      return createErrorResponse('Part not found', 'NOT_FOUND');
    }

    // Get recent history
    const { data: history, error: historyError } = await supabase
      .from('parts_history')
      .select(`
        id,
        change_type,
        quantity_change,
        new_quantity,
        old_quantity,
        change_reason,
        changed_at,
        changed_by,
        supplier_name,
        order_id
      `)
      .eq('part_id', validatedParams.part_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('changed_at', { ascending: false })
      .limit(10);

    // Get recent orders
    const { data: orders, error: ordersError } = await supabase
      .from('parts_orders')
      .select(`
        id,
        quantity_ordered,
        quantity_received,
        status,
        ordered_at,
        expected_delivery_date,
        supplier_name,
        estimated_cost
      `)
      .eq('part_id', validatedParams.part_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('ordered_at', { ascending: false })
      .limit(5);

    return createSuccessResponse({
      part: {
        ...part,
        availability_status: part.current_quantity <= (part.minimum_quantity || 0) ? 'low_stock' : 'available',
        needs_reorder: part.current_quantity <= (part.minimum_quantity || 0)
      },
      recent_history: history || [],
      recent_orders: orders || [],
      metadata: {
        history_count: history?.length || 0,
        orders_count: orders?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in getPartDetails:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function checkPartsAvailability(params: any) {
  const validatedParams = CheckPartsAvailabilitySchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('check_parts_availability', validatedParams.organization_id, undefined, validatedParams);

    const availabilityResults = [];
    const unavailableParts = [];
    const lowStockParts = [];

    // Check each required part
    for (const requiredPart of validatedParams.required_parts) {
      const { data: part, error } = await supabase
        .from('parts')
        .select('id, name, current_quantity, minimum_quantity, unit, storage_location')
        .eq('id', requiredPart.part_id)
        .eq('organization_id', validatedParams.organization_id)
        .single();

      if (error || !part) {
        unavailableParts.push({
          part_id: requiredPart.part_id,
          name: 'Unknown Part',
          required_quantity: requiredPart.quantity,
          available_quantity: 0,
          status: 'not_found',
          reason: 'Part not found in inventory'
        });
        continue;
      }

      const availability = {
        part_id: requiredPart.part_id,
        name: part.name,
        required_quantity: requiredPart.quantity,
        available_quantity: part.current_quantity,
        unit: part.unit,
        storage_location: part.storage_location,
        status: part.current_quantity >= requiredPart.quantity ? 'available' : 'insufficient',
        reason: part.current_quantity >= requiredPart.quantity ? 
          'Sufficient stock available' : 
          `Only ${part.current_quantity} ${part.unit} available, need ${requiredPart.quantity}`
      };

      availabilityResults.push(availability);

      if (availability.status === 'insufficient') {
        if (part.current_quantity === 0) {
          unavailableParts.push(availability);
        } else {
          lowStockParts.push(availability);
        }
      }
    }

    const allAvailable = unavailableParts.length === 0 && lowStockParts.length === 0;

    return createSuccessResponse({
      overall_availability: allAvailable ? 'available' : 'insufficient',
      all_parts_available: allAvailable,
      results: availabilityResults,
      unavailable_parts: unavailableParts,
      low_stock_parts: lowStockParts,
      summary: {
        total_parts_checked: validatedParams.required_parts.length,
        available_count: availabilityResults.filter(r => r.status === 'available').length,
        insufficient_count: availabilityResults.filter(r => r.status === 'insufficient').length,
        unavailable_count: unavailableParts.length,
        low_stock_count: lowStockParts.length
      }
    });

  } catch (error) {
    console.error('Error in checkPartsAvailability:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}
