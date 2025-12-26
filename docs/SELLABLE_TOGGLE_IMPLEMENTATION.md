# Sellable Toggle Implementation

## Overview

Added a "sellable" toggle to the stock item editing interface that allows farm owners to control which items are available for sale in the Sari Sari store chat interface.

## Changes Made

### 1. Database Schema
- **Added `sellable` column to `parts` table** (not creating a new products table)
- **Default value**: `false` (existing items are not sellable by default for safety)
- **Index**: Added for efficient filtering of sellable items
- **Migration files**:
  - `scripts/add-sellable-column.sql` - Main migration script
  - `migrations/add_sellable_to_parts.sql` - Alternative migration location

### 2. User Interface Updates

#### Stock Item Form (`src/components/InventoryItemForm.tsx`)
- **Added sellable toggle** before the "Cost per unit" field
- **Label**: "Available for sale in Sari Sari Store"
- **Tooltip**: Explains that enabled items will be visible to customers
- **Default**: Unchecked (false) for new items

#### Inventory Management (`src/pages/Inventory.tsx`)
- **Updated Part interface** to include `sellable: boolean`
- **Updated form data handling** to include sellable field
- **Updated API calls** (both create and update) to include sellable field

### 3. Sari Sari Agent Integration

#### Database Integration
- **Updated InventoryService** to work with `parts` table instead of `products` table
- **Column mapping**: `stock_quantity` → `current_quantity`
- **Table references**: `products` → `parts`
- **Foreign keys**: `product_id` → `part_id`

#### Key Methods Updated
- `getSellableProducts()` - Filters parts where `sellable = true`
- `toggleSellability()` - Updates sellable status
- `getProductsByCategory()` - Includes sellable filtering
- `searchProducts()` - Includes sellable filtering

### 4. Database Migration

```sql
-- Add sellable column to parts table
ALTER TABLE parts ADD COLUMN IF NOT EXISTS sellable BOOLEAN DEFAULT false NOT NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_parts_sellable ON parts(sellable);

-- Add documentation
COMMENT ON COLUMN parts.sellable IS 'Controls whether part is visible to customers in sari sari store';
```

## Usage

### For Farm Owners
1. **Edit any stock item** (e.g., "Spiced Vinegar")
2. **Find the "Available for sale in Sari Sari Store" toggle** before the cost field
3. **Check the toggle** to make the item available to customers
4. **Save the changes**

### For Customers
- Only items with `sellable = true` will appear in the Sari Sari chat interface
- Items can be browsed, inquired about, and added to cart
- Pricing and availability are pulled from the same inventory system

## Technical Details

### Form Data Flow
1. **Form initialization**: `sellable: false` by default
2. **Edit mode**: Loads existing `sellable` value from database
3. **Submit**: Includes `sellable` field in API request
4. **Database**: Stores boolean value in `parts.sellable` column

### API Integration
- **Create part**: `POST /parts` includes `sellable` field
- **Update part**: `PUT /parts/:id` includes `sellable` field
- **Sari Sari queries**: Filter by `WHERE sellable = true`

### Safety Considerations
- **Default false**: New items are not sellable by default
- **Existing items**: Remain non-sellable until explicitly enabled
- **Index performance**: Efficient filtering with database index
- **Backward compatibility**: Non-breaking change to existing system

## Future Enhancements

### Potential Additions
1. **Bulk toggle**: Select multiple items to make sellable/non-sellable
2. **Category defaults**: Auto-enable sellable for certain categories
3. **Pricing controls**: Separate customer pricing from cost tracking
4. **Inventory sync**: Real-time updates between inventory and chat interface
5. **Analytics**: Track which items are popular in the store

### Integration Points
- **Chat interface**: Already configured to use `getSellableProducts()`
- **Inventory service**: Handles all sellable filtering logic
- **Database**: Optimized with proper indexing
- **UI feedback**: Clear indication of sellable status

## Testing

### Manual Testing Steps
1. **Create new item**: Verify sellable defaults to false
2. **Edit existing item**: Verify current sellable status loads correctly
3. **Toggle sellable**: Verify changes save to database
4. **Chat interface**: Verify only sellable items appear
5. **Performance**: Verify filtering is efficient with index

### Database Verification
```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'parts' AND column_name = 'sellable';

-- Check index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'parts' AND indexname = 'idx_parts_sellable';

-- View sellable items
SELECT id, name, sellable FROM parts WHERE sellable = true;
```

This implementation provides a clean, safe way to control which inventory items are available for sale in the Sari Sari store while maintaining full integration with the existing inventory management system.