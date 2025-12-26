// Test the negation filtering logic
const availableProducts = [
  {
    id: "29dac526-4b9d-4246-a14e-414586911da7",
    name: "Long neck vinegar spice ",
    description: "Long neck spiced vinegar made from our coconuts and sili.",
    current_quantity: 1,
    cost_per_unit: 210,
    sellable: true
  },
  {
    id: "87fb9e44-3ab9-4566-9acd-77f2a1d1f34e",
    name: "Pure vinegar ",
    description: "Lipid",
    current_quantity: 1,
    cost_per_unit: 40,
    sellable: true
  },
  {
    id: "6ba21e95-3d40-4ffe-9f92-edb6b8d20c4b",
    name: "Spiced vinegar lipid",
    description: "Organic coconut vinegar with sili (chili) from stargazer farm.",
    current_quantity: 5,
    cost_per_unit: 120,
    sellable: true
  }
];

function testNegationFiltering(extractedSearchTerm) {
  console.log(`\n=== Testing negation filtering for: "${extractedSearchTerm}" ===`);
  
  if (extractedSearchTerm.startsWith('NOT_')) {
    const unwantedTerms = extractedSearchTerm.replace('NOT_', '').split('_');
    console.log('🚫 Unwanted terms:', unwantedTerms);
    
    // Filter available products to exclude those with unwanted characteristics
    const filteredProducts = availableProducts.filter(part => {
      const nameMatch = unwantedTerms.some(term => 
        part.name.toLowerCase().includes(term.toLowerCase())
      );
      const descMatch = unwantedTerms.some(term => 
        part.description && part.description.toLowerCase().includes(term.toLowerCase())
      );
      
      // Return products that DON'T match the unwanted terms
      const shouldExclude = nameMatch || descMatch;
      
      console.log(`${shouldExclude ? '🚫' : '✅'} ${part.name} - Name match: ${nameMatch}, Desc match: ${descMatch}`);
      
      return !shouldExclude;
    });
    
    console.log(`\n🎯 Final filtered products: ${filteredProducts.length} products`);
    filteredProducts.forEach(p => {
      console.log(`   - ${p.name} (${p.description})`);
    });
    
    return filteredProducts;
  } else {
    console.log('This is a positive search, not testing negation filtering.');
    return [];
  }
}

// Test cases
const testQueries = [
  "NOT_spice",
  "NOT_bitter", 
  "NOT_spice_sauce",
  "spice" // positive case
];

testQueries.forEach(query => {
  testNegationFiltering(query);
});