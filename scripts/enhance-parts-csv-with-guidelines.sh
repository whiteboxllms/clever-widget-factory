#!/bin/bash
set -e

# Enhance the parts CSV with policy guidelines and examples

INPUT_FILE="$1"

if [ -z "$INPUT_FILE" ]; then
  echo "Usage: $0 <input-csv-file>"
  echo "Example: $0 parts-review-20260125-145729.csv"
  exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: File not found: $INPUT_FILE"
  exit 1
fi

OUTPUT_FILE="${INPUT_FILE%.csv}-enhanced.csv"

echo "📝 Enhancing CSV with policy guidelines..."
echo ""

# Create enhanced CSV with additional columns
{
  echo "id,name,current_description,current_policy,category,unit,suggested_description,suggested_policy,policy_guidelines"
  
  # Skip header and process each line
  tail -n +2 "$INPUT_FILE" | while IFS= read -r line; do
    # Extract name from CSV (second field)
    NAME=$(echo "$line" | cut -d',' -f2 | tr -d '"')
    
    # Generate policy guidelines based on part name patterns
    GUIDELINES=""
    
    # Tools
    if echo "$NAME" | grep -iE "drill|saw|hammer|wrench|pliers|screwdriver|chisel" > /dev/null; then
      GUIDELINES="Tool usage: Describe proper handling, safety precautions, and maintenance. Example: 'Wear safety glasses when using. Clean and oil after each use. Store in dry location.'"
    
    # Electrical
    elif echo "$NAME" | grep -iE "electrical|power|voltage|amp|wire|cable|plug|switch" > /dev/null; then
      GUIDELINES="Electrical safety: Specify voltage/amperage ratings, proper installation, and safety warnings. Example: 'Rated for 220V. Turn off power before installation. Use only with properly grounded outlets.'"
    
    # Plumbing
    elif echo "$NAME" | grep -iE "pipe|faucet|valve|elbow|tee|coupling|pvc" > /dev/null; then
      GUIDELINES="Plumbing: Describe size, material, pressure rating, and installation tips. Example: 'PVC Schedule 40. Apply primer and cement for permanent joints. Allow 24 hours to cure before pressure testing.'"
    
    # Fasteners
    elif echo "$NAME" | grep -iE "screw|bolt|nut|nail|rivet" > /dev/null; then
      GUIDELINES="Fastener: Specify size, material, load capacity, and recommended applications. Example: 'Stainless steel for outdoor use. Pre-drill pilot holes to prevent wood splitting.'"
    
    # Chemicals/Liquids
    elif echo "$NAME" | grep -iE "oil|chemical|paint|solvent|acid|vinegar|wine" > /dev/null; then
      GUIDELINES="Chemical/Liquid: Include safety data, storage requirements, and proper disposal. Example: 'Store in cool, dry place away from direct sunlight. Dispose according to local regulations.'"
    
    # Consumables
    elif echo "$NAME" | grep -iE "bag|tape|marker|pencil|paper|glue" > /dev/null; then
      GUIDELINES="Consumable: Describe intended use and any special handling. Example: 'Use for general marking on wood, metal, or plastic. Cap tightly after use to prevent drying.'"
    
    # Default
    else
      GUIDELINES="General: Describe what the part is, how to use it properly, and any safety or maintenance considerations."
    fi
    
    # Output line with empty suggested columns and guidelines
    echo "$line,\"\",\"\",$GUIDELINES"
  done
} > "$OUTPUT_FILE"

echo "✅ Enhanced CSV created: $OUTPUT_FILE"
echo ""
echo "The CSV now includes:"
echo "- suggested_description: (empty - fill in physical characteristics)"
echo "- suggested_policy: (empty - fill in usage guidelines and best practices)"
echo "- policy_guidelines: (auto-generated hints based on part type)"
echo ""
echo "Policy Writing Tips:"
echo "1. Physical Description: Color, size, material, condition"
echo "2. Usage: How to use properly, when to use, what for"
echo "3. Safety: Warnings, precautions, protective equipment needed"
echo "4. Maintenance: Cleaning, storage, inspection requirements"
echo "5. Best Practices: Tips for optimal results"
echo ""
echo "Examples from sellable products:"
echo "- Banana Wine: 'Rich in potassium and B vitamins from banana fermentation. May support heart health, energy levels, and digestive wellness. Best enjoyed as an evening beverage or paired with meals. The natural tryptophan content may promote relaxation and better sleep quality.'"
echo "- Pure Vinegar: 'Traditional Filipino coconut vinegar with natural probiotics and acetic acid. May support digestive health, blood sugar regulation, and weight management. Use in cooking, salad dressings, or diluted as a health tonic. Contains amino acids and minerals from coconut sap.'"
