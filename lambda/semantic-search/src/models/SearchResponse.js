const ProductResult = require('./ProductResult');
const FiltersApplied = require('./FiltersApplied');
const DebugInfo = require('./DebugInfo');

/**
 * SearchResponse data model for complete search API responses
 * Represents the complete response structure for search operations
 */
class SearchResponse {
    /**
     * Creates a new SearchResponse instance
     * @param {ProductResult[]} results - Array of product results (required)
     * @param {FiltersApplied} filters_applied - Applied filters information (required)
     * @param {DebugInfo|null} debug - Debug information (optional)
     */
    constructor(results, filters_applied, debug = null) {
        this.results = results;
        this.filters_applied = filters_applied;
        this.debug = debug;
        
        // Validate the instance after construction
        this._validate();
    }

    /**
     * Validates the SearchResponse instance
     * @private
     * @throws {Error} If validation fails
     */
    _validate() {
        // Validate results (required array of ProductResult)
        if (!Array.isArray(this.results)) {
            throw new Error('results must be an array');
        }
        
        for (let i = 0; i < this.results.length; i++) {
            if (!(this.results[i] instanceof ProductResult)) {
                throw new Error(`results[${i}] must be a ProductResult instance`);
            }
        }

        // Validate filters_applied (required FiltersApplied instance)
        if (!(this.filters_applied instanceof FiltersApplied)) {
            throw new Error('filters_applied must be a FiltersApplied instance');
        }

        // Validate debug (optional DebugInfo instance)
        if (this.debug !== null && !(this.debug instanceof DebugInfo)) {
            throw new Error('debug must be a DebugInfo instance or null');
        }
    }

    /**
     * Creates a SearchResponse instance from a plain object
     * @param {Object} obj - Plain object with SearchResponse properties
     * @returns {SearchResponse} New SearchResponse instance
     */
    static fromObject(obj) {
        const results = obj.results.map(result => ProductResult.fromObject(result));
        const filters_applied = FiltersApplied.fromObject(obj.filters_applied);
        const debug = obj.debug ? DebugInfo.fromObject(obj.debug) : null;
        
        return new SearchResponse(results, filters_applied, debug);
    }

    /**
     * Converts the SearchResponse instance to a plain object
     * @returns {Object} Plain object representation suitable for JSON serialization
     */
    toObject() {
        return {
            results: this.results.map(result => result.toObject()),
            filters_applied: this.filters_applied.toObject(),
            debug: this.debug ? this.debug.toObject() : null
        };
    }

    /**
     * Converts the SearchResponse to JSON string
     * @returns {string} JSON representation
     */
    toJSON() {
        return JSON.stringify(this.toObject());
    }

    /**
     * Gets the number of results
     * @returns {number} Number of product results
     */
    getResultCount() {
        return this.results.length;
    }

    /**
     * Gets results sorted by similarity score (highest first)
     * @returns {ProductResult[]} Sorted results
     */
    getResultsSortedBySimilarity() {
        return [...this.results].sort((a, b) => b.similarity_score - a.similarity_score);
    }

    /**
     * Gets in-stock results only
     * @returns {ProductResult[]} In-stock results
     */
    getInStockResults() {
        return this.results.filter(result => result.in_stock);
    }

    /**
     * Gets out-of-stock results only
     * @returns {ProductResult[]} Out-of-stock results
     */
    getOutOfStockResults() {
        return this.results.filter(result => !result.in_stock);
    }

    /**
     * Gets results within a specific price range
     * @param {number|null} minPrice - Minimum price (inclusive)
     * @param {number|null} maxPrice - Maximum price (inclusive)
     * @returns {ProductResult[]} Filtered results
     */
    getResultsInPriceRange(minPrice = null, maxPrice = null) {
        return this.results.filter(result => {
            if (minPrice !== null && result.price < minPrice) return false;
            if (maxPrice !== null && result.price > maxPrice) return false;
            return true;
        });
    }

    /**
     * Gets summary statistics about the results
     * @returns {Object} Summary statistics
     */
    getSummary() {
        const inStockCount = this.getInStockResults().length;
        const outOfStockCount = this.getOutOfStockResults().length;
        const prices = this.results.map(r => r.price);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;

        return {
            total_results: this.results.length,
            in_stock_count: inStockCount,
            out_of_stock_count: outOfStockCount,
            price_range: {
                min: minPrice,
                max: maxPrice,
                average: Math.round(avgPrice * 100) / 100
            },
            filters_applied: this.filters_applied.hasFilters(),
            debug_enabled: this.debug !== null
        };
    }
}

module.exports = SearchResponse;