/**
 * SearchPipeline - Main orchestrator for the 5-step search pipeline
 */

class SearchPipeline {
  constructor(queryRewriter, filterMapper, hybridRetriever, resultFormatter, responseGenerator) {
    this.queryRewriter = queryRewriter;
    this.filterMapper = filterMapper;
    this.hybridRetriever = hybridRetriever;
    this.resultFormatter = resultFormatter;
    this.responseGenerator = responseGenerator;
  }

  async execute(rawQuery, organizationId) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] Pipeline started`, { rawQuery, organizationId });

    try {
      // Step 1: Query Rewriting
      const step1Start = Date.now();
      const queryComponents = await this.queryRewriter.rewrite(rawQuery);
      console.log(`[${requestId}] Step 1 - Query Rewriting: ${Date.now() - step1Start}ms`, queryComponents);

      // Step 2: Filter Mapping
      const step2Start = Date.now();
      const sqlFilters = this.filterMapper.map(queryComponents);
      console.log(`[${requestId}] Step 2 - Filter Mapping: ${Date.now() - step2Start}ms`, sqlFilters);

      // Step 3: Hybrid Retrieval
      const step3Start = Date.now();
      const { rows, excludedProducts, sqlQuery } = await this.hybridRetriever.retrieve(
        queryComponents,
        sqlFilters,
        organizationId
      );
      console.log(`[${requestId}] Step 3 - Hybrid Retrieval: ${Date.now() - step3Start}ms`, {
        resultCount: rows.length,
        excludedCount: excludedProducts.length
      });

      // Step 4: Result Formatting
      const step4Start = Date.now();
      const products = this.resultFormatter.formatProducts(rows);
      console.log(`[${requestId}] Step 4 - Result Formatting: ${Date.now() - step4Start}ms`);

      // Step 5: Response Generation
      const step5Start = Date.now();
      const responseObj = await this.responseGenerator.generate(
        rawQuery,
        products,
        queryComponents,
        sqlFilters,
        excludedProducts
      );
      console.log(`[${requestId}] Step 5 - Response Generation: ${Date.now() - step5Start}ms`);
      
      // Filter products to only those selected by LLM
      const selectedProducts = responseObj.productIds 
        ? products.filter(p => responseObj.productIds.includes(p.id))
        : products.slice(0, 3);

      const totalTime = Date.now() - startTime;
      console.log(`[${requestId}] Pipeline completed: ${totalTime}ms`);

      return {
        text: responseObj.text || responseObj,
        products: selectedProducts,
        filters_applied: {
          price_min: sqlFilters.price_min || null,
          price_max: sqlFilters.price_max || null,
          negated_terms: queryComponents.negatedTerms || []
        },
        queryComponents,
        sqlQuery,
        requestId,
        executionTimeMs: totalTime
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] Pipeline failed after ${totalTime}ms:`, error);
      throw error;
    }
  }
}

module.exports = { SearchPipeline };
