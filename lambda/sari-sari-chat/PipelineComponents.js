/**
 * Pipeline component adapters
 */

class QueryRewriter {
  constructor(extractIntentFn) {
    this.extractIntent = extractIntentFn;
  }

  async rewrite(rawQuery) {
    return await this.extractIntent(rawQuery);
  }
}

class FilterMapper {
  map(queryComponents) {
    return {
      price_min: queryComponents.priceConstraints?.min,
      price_max: queryComponents.priceConstraints?.max,
      negated_terms: queryComponents.negatedTerms || []
    };
  }
}

class HybridRetriever {
  constructor(dbQuery, filterNegatedProductsFn, generateEmbeddingFn, cosineSimilarityFn) {
    this.dbQuery = dbQuery;
    this.filterNegatedProducts = filterNegatedProductsFn;
    this.generateEmbedding = generateEmbeddingFn;
    this.cosineSimilarity = cosineSimilarityFn;
  }

  async retrieve(queryComponents, sqlFilters, organizationId) {
    console.log('[HybridRetriever] Input:', JSON.stringify({ queryComponents, sqlFilters, organizationId }, null, 2));
    
    const searchTerms = queryComponents.productTerms?.join(' ') || queryComponents.extractedQuery;
    console.log('[HybridRetriever] Search terms:', searchTerms);
    
    // Generate embedding for semantic search
    const queryEmbedding = await this.generateEmbedding(searchTerms);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const priceConditions = [];
    if (sqlFilters.price_min !== null && sqlFilters.price_min !== undefined) {
      priceConditions.push(`p.cost_per_unit >= ${parseFloat(sqlFilters.price_min)}`);
    }
    if (sqlFilters.price_max !== null && sqlFilters.price_max !== undefined) {
      priceConditions.push(`p.cost_per_unit <= ${parseFloat(sqlFilters.price_max)}`);
    }
    const priceFilter = priceConditions.length > 0 ? `AND ${priceConditions.join(' AND ')}` : '';
    
    // Hybrid search: vector similarity + text match
    const query = `
      SELECT p.id, p.name, p.description, p.cost_per_unit, p.unit, p.current_quantity, p.image_url,
             (1 - (p.search_embedding <=> '${embeddingStr}'::vector)) as similarity
      FROM parts p
      WHERE p.organization_id = '${organizationId}'
        AND p.sellable = true
        AND p.search_embedding IS NOT NULL
        ${priceFilter}
      ORDER BY similarity DESC
      LIMIT 10
    `;
    
    console.log('[HybridRetriever] SQL Query:', query);
    
    let rows = await this.dbQuery(query);
    console.log('[HybridRetriever] Query results:', rows.length, 'rows');
    if (rows.length > 0) {
      console.log('[HybridRetriever] Top result:', JSON.stringify(rows[0], null, 2));
    }
    
    const excludedProducts = [];
    if (sqlFilters.negated_terms && sqlFilters.negated_terms.length > 0) {
      rows = rows.filter(product => {
        const productText = `${product.name} ${product.description || ''}`.toLowerCase();
        for (const term of sqlFilters.negated_terms) {
          if (productText.includes(term.toLowerCase())) {
            excludedProducts.push({ id: product.id, name: product.name, negatedTerm: term });
            return false;
          }
        }
        return true;
      });
    }
    
    console.log('[HybridRetriever] Final results:', rows.length, 'rows after filtering');
    return { rows, excludedProducts, sqlQuery: query };
  }
}

class ResponseGenerator {
  constructor(generateConversationalResponseFn) {
    this.generateResponse = generateConversationalResponseFn;
  }

  async generate(rawQuery, products, queryComponents, sqlFilters, excludedProducts) {
    return await this.generateResponse(
      rawQuery,
      products,
      queryComponents,
      { min: sqlFilters.price_min, max: sqlFilters.price_max },
      excludedProducts
    );
  }
}

module.exports = {
  QueryRewriter,
  FilterMapper,
  HybridRetriever,
  ResponseGenerator
};
