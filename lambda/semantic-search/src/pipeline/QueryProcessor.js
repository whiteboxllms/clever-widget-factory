/**
 * QueryProcessor - Enhanced query processing pipeline
 * 
 * Integrates with existing semantic search while adding:
 * - Price constraint extraction
 * - Negation handling  
 * - Natural language processing
 * 
 * Leverages existing shared modules and sari-sari-agent NLP capabilities
 */

class QueryProcessor {
  constructor() {
    // Price extraction patterns
    this.pricePatterns = {
      under: /(?:under|below|less than|<=?)\s*(\d+(?:\.\d+)?)/i,
      above: /(?:above|over|more than|>=?)\s*(\d+(?:\.\d+)?)/i,
      between: /(?:between|from)\s*(\d+(?:\.\d+)?)\s*(?:and|to)\s*(\d+(?:\.\d+)?)/i
    };

    // Negation patterns
    this.negationPatterns = [
      /\bno\s+(\w+)/gi,
      /\bnot\s+(\w+)/gi,
      /\bavoid\s+(\w+)/gi,
      /\bwithout\s+(\w+)/gi
    ];
  }

  /**
   * Process natural language query into structured components
   * 
   * @param {string} rawQuery - Raw user query
   * @returns {Object} Structured query components
   */
  processQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    const query = rawQuery.trim();
    
    // Extract price constraints
    const priceConstraints = this.extractPriceConstraints(query);
    
    // Extract negated terms
    const negatedTerms = this.extractNegatedTerms(query);
    
    // Extract semantic query (clean of price and negation terms)
    const semanticQuery = this.extractSemanticQuery(query, priceConstraints, negatedTerms);

    return {
      original_query: rawQuery,
      semantic_query: semanticQuery,
      price_min: priceConstraints.min,
      price_max: priceConstraints.max,
      negated_terms: negatedTerms,
      has_price_filter: priceConstraints.min !== null || priceConstraints.max !== null,
      has_negations: negatedTerms.length > 0
    };
  }

  /**
   * Extract price constraints from natural language
   */
  extractPriceConstraints(query) {
    const constraints = { min: null, max: null };
    
    // Check for "under X" pattern
    const underMatch = query.match(this.pricePatterns.under);
    if (underMatch) {
      constraints.max = parseFloat(underMatch[1]);
    }
    
    // Check for "above X" pattern
    const aboveMatch = query.match(this.pricePatterns.above);
    if (aboveMatch) {
      constraints.min = parseFloat(aboveMatch[1]);
    }
    
    // Check for "between X and Y" pattern (overrides individual constraints)
    const betweenMatch = query.match(this.pricePatterns.between);
    if (betweenMatch) {
      constraints.min = parseFloat(betweenMatch[1]);
      constraints.max = parseFloat(betweenMatch[2]);
    }
    
    return constraints;
  }

  /**
   * Extract negated terms from natural language
   */
  extractNegatedTerms(query) {
    const negatedTerms = [];
    
    for (const pattern of this.negationPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        negatedTerms.push(match[1].toLowerCase().trim());
      }
    }
    
    return [...new Set(negatedTerms)]; // Remove duplicates
  }

  /**
   * Extract semantic query by removing price and negation terms
   */
  extractSemanticQuery(query, priceConstraints, negatedTerms) {
    let semanticQuery = query;
    
    // Remove price-related phrases
    semanticQuery = semanticQuery.replace(this.pricePatterns.under, '');
    semanticQuery = semanticQuery.replace(this.pricePatterns.above, '');
    semanticQuery = semanticQuery.replace(this.pricePatterns.between, '');
    
    // Remove negation phrases
    for (const pattern of this.negationPatterns) {
      semanticQuery = semanticQuery.replace(pattern, '');
    }
    
    // Clean up extra whitespace and punctuation
    semanticQuery = semanticQuery.replace(/\s+/g, ' ').trim();
    semanticQuery = semanticQuery.replace(/^[,\s]+|[,\s]+$/g, '');
    
    // If semantic query is empty after cleaning, use original query
    if (!semanticQuery || semanticQuery.length === 0) {
      semanticQuery = query;
    }
    
    return semanticQuery;
  }

  /**
   * Build enhanced SQL query with price filtering and product eligibility
   */
  buildEnhancedQuery(queryComponents, table, organizationId, limit = 10) {
    const { semantic_query, price_min, price_max } = queryComponents;
    
    // Base query structure (reuse existing logic)
    const baseSelect = table === 'tools' ? `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.category,
        t.storage_location,
        t.image_url,
        t.status,
        t.serial_number,
        t.accountable_person_id,
        t.parent_structure_id,
        parent_tool.name as parent_structure_name,
        t.search_text,
        (t.search_embedding <=> $1::vector) as distance,
        (1 - (t.search_embedding <=> $1::vector)) as similarity
      FROM ${table} t
      LEFT JOIN tools parent_tool ON t.parent_structure_id = parent_tool.id
    ` : `
      SELECT 
        id,
        name,
        description,
        category,
        storage_location,
        image_url,
        current_quantity,
        minimum_quantity,
        unit,
        cost_per_unit,
        price,
        search_text,
        (search_embedding <=> $1::vector) as distance,
        (1 - (search_embedding <=> $1::vector)) as similarity
      FROM ${table}
    `;

    // Build WHERE clause with enhanced filtering
    const whereConditions = [
      'search_embedding IS NOT NULL',
      `organization_id = '${organizationId.replace(/'/g, "''")}'`
    ];

    // Add price filtering for parts table (assuming it has price column)
    if (table === 'parts') {
      if (price_min !== null) {
        whereConditions.push(`price >= ${price_min}`);
      }
      if (price_max !== null) {
        whereConditions.push(`price <= ${price_max}`);
      }
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    // Enhanced ORDER BY with stock level boosting for parts
    const orderBy = table === 'parts' ? 
      'ORDER BY (current_quantity > 0) DESC, distance' :
      'ORDER BY distance';

    const sql = `${baseSelect} ${whereClause} ${orderBy} LIMIT ${limit}`;
    
    return sql;
  }

  /**
   * Apply negation filtering to results
   */
  applyNegationFiltering(results, negatedTerms) {
    if (!negatedTerms || negatedTerms.length === 0) {
      return results;
    }

    return results.filter(result => {
      const searchText = `${result.name || ''} ${result.description || ''}`.toLowerCase();
      
      // Exclude if any negated term is found in the product text
      return !negatedTerms.some(term => 
        searchText.includes(term.toLowerCase())
      );
    });
  }

  /**
   * Format results with enhanced metadata
   */
  formatResults(results, queryComponents, table) {
    const formattedResults = results.map(result => {
      const formatted = { ...result };
      
      // Add stock status for parts
      if (table === 'parts' && result.current_quantity !== undefined) {
        formatted.in_stock = result.current_quantity > 0;
        formatted.stock_status = result.current_quantity > 0 ? 
          'In stock' : 
          'Out of stock – available for pre-order';
      }
      
      return formatted;
    });

    return {
      results: formattedResults,
      query_info: {
        original_query: queryComponents.original_query,
        semantic_query: queryComponents.semantic_query,
        filters_applied: {
          price_min: queryComponents.price_min,
          price_max: queryComponents.price_max,
          negated_terms: queryComponents.negated_terms
        },
        has_price_filter: queryComponents.has_price_filter,
        has_negations: queryComponents.has_negations
      },
      table,
      count: formattedResults.length
    };
  }
}

module.exports = QueryProcessor;