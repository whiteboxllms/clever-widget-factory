# Parts Review Guide

## Overview

You now have a CSV file with all 895 parts ready for review and enhancement: `parts-review-20260125-145729-enhanced.csv`

## CSV Structure

| Column | Description |
|--------|-------------|
| `id` | Part UUID (don't modify) |
| `name` | Part name (don't modify) |
| `current_description` | Existing description (reference only) |
| `current_policy` | Existing policy (reference only) |
| `category` | Part category (reference only) |
| `unit` | Unit of measurement (reference only) |
| `suggested_description` | **FILL THIS IN** - Physical characteristics |
| `suggested_policy` | **FILL THIS IN** - Usage guidelines and best practices |
| `policy_guidelines` | Auto-generated hints based on part type |

## How to Fill In Descriptions and Policies

### Description (Physical Characteristics)
Focus on what the part IS:
- Material (steel, plastic, wood, etc.)
- Size/dimensions
- Color
- Condition
- Brand/model (if relevant)

**Example:** "Stainless steel 1-inch T-shaped pipe fitting. Threaded connections on all three ends. Corrosion-resistant finish."

### Policy (Usage Guidelines & Best Practices)
Focus on HOW to use it:
- Proper usage instructions
- Safety precautions
- When/where to use
- Maintenance requirements
- Storage recommendations
- Best practices for optimal results

**Example:** "Use for connecting three pipes at right angles in plumbing systems. Apply thread tape before installation to prevent leaks. Tighten hand-tight plus 1-2 turns with wrench. Suitable for water, air, or gas lines up to 150 PSI."

## Policy Writing Framework

Use this 1-2 sentence structure:

**Sentence 1:** What it's for + How to use it properly
**Sentence 2:** Safety/maintenance tip OR best practice

### Examples by Category

#### Tools
"Use for [specific task]. Wear [safety equipment] and [maintenance instruction]."
- "Use for drilling holes in wood, metal, or plastic. Wear safety glasses and secure workpiece before drilling. Clean and oil chuck after each use."

#### Electrical Parts
"Rated for [specs]. [Installation/safety instruction]."
- "Rated for 220V, 15A maximum load. Turn off power at breaker before installation. Use only with properly grounded outlets."

#### Plumbing Parts
"[Material] fitting for [application]. [Installation tip]."
- "PVC Schedule 40 coupling for permanent pipe connections. Apply primer and cement, allow 24 hours to cure before pressure testing."

#### Fasteners
"[Material] fastener for [application]. [Installation tip]."
- "Stainless steel screws for outdoor applications. Pre-drill pilot holes to prevent wood splitting and ensure straight installation."

#### Chemicals/Consumables
"[Purpose/application]. [Storage/safety instruction]."
- "Permanent marker for labeling tools, containers, and materials. Cap tightly after use to prevent drying. Store at room temperature."

#### Lumber/Materials
"[Dimensions] [material] for [applications]. [Storage/handling tip]."
- "2x2 inch lumber for light framing and support structures. Store flat in dry location to prevent warping. Check for knots before cutting."

## Workflow

1. **Open the CSV** in Excel, Google Sheets, or your preferred spreadsheet editor

2. **Review each part:**
   - Read the `name` and `current_description`
   - Check the `policy_guidelines` column for hints
   - Fill in `suggested_description` (physical characteristics)
   - Fill in `suggested_policy` (1-2 sentence usage guide)

3. **Focus on high-value parts first:**
   - Sellable products (already done - 7 parts)
   - Frequently used tools
   - Safety-critical items (electrical, chemicals)
   - Expensive equipment

4. **Batch similar items:**
   - Group similar parts (all PVC fittings, all screws, etc.)
   - Write one good policy, then adapt for similar items
   - This makes the process much faster

5. **Save and import:**
   - Once complete, save the CSV
   - Use the import script (to be created) to bulk update the database

## Quality Checklist

Good descriptions and policies should:
- ✅ Be specific and actionable
- ✅ Include safety information when relevant
- ✅ Mention proper storage/maintenance
- ✅ Use clear, simple language
- ✅ Be 1-3 sentences (concise but complete)
- ❌ Avoid jargon unless necessary
- ❌ Don't repeat the part name
- ❌ Don't include pricing or supplier info (that's in other fields)

## Current Status

- **Total parts:** 895
- **Parts with embeddings:** 7 (sellable products)
- **Parts needing review:** 888

## Next Steps

1. Review and fill in the CSV (can be done incrementally)
2. Once ready, run the backfill script to generate embeddings
3. Test semantic search with your enhanced descriptions

## Benefits of Good Descriptions & Policies

With well-written descriptions and policies, your semantic search will be able to:
- Find parts by usage ("what do I use for outdoor plumbing?")
- Find parts by material ("show me stainless steel fasteners")
- Find parts by safety requirements ("what needs safety glasses?")
- Find parts by maintenance needs ("what needs to be oiled?")
- Provide helpful guidance to team members who are unfamiliar with certain parts

This transforms your parts inventory from a simple list into a searchable knowledge base!
