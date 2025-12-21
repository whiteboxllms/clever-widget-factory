/**
 * QueryComponents data model for structured query representation
 * Represents the parsed components of a natural language query
 */
class QueryComponents {
    /**
     * Creates a new QueryComponents instance
     * @param {string} semantic_query - The semantic search terms (required, non-empty)
     * @param {number|null} price_min - Minimum price constraint (optional, non-negative)
     * @param {number|null} price_max - Maximum price constraint (optional, non-negative)
     * @param {string[]|null} negated_terms - Terms to exclude from results (optional)
     */
    constructor(semantic_query, price_min = null, price_max = null, negated_terms = null) {
        this.semantic_query = semantic_query;
        this.price_min = price_min;
        this.price_max = price_max;
        this.negated_terms = negated_terms;
        
        // Validate the instance after construction
        this._validate();
    }

    /**
     * Validates the QueryComponents instance
     * @private
     * @throws {Error} If validation fails
     */
    _validate() {
        // Validate semantic_query (required, non-empty string)
        if (!this.semantic_query || typeof this.semantic_query !== 'string') {
            throw new Error('semantic_query is required and must be a non-empty string');
        }
        
        if (this.semantic_query.trim().length === 0) {
            throw new Error('semantic_query cannot be empty or whitespace only');
        }

        // Validate price_min (optional, non-negative number)
        if (this.price_min !== null) {
            if (typeof this.price_min !== 'number' || isNaN(this.price_min)) {
                throw new Error('price_min must be a number or null');
            }
            if (this.price_min < 0) {
                throw new Error('price_min must be non-negative');
            }
        }

        // Validate price_max (optional, non-negative number)
        if (this.price_max !== null) {
            if (typeof this.price_max !== 'number' || isNaN(this.price_max)) {
                throw new Error('price_max must be a number or null');
            }
            if (this.price_max < 0) {
                throw new Error('price_max must be non-negative');
            }
        }

        // Validate price range consistency (min <= max)
        if (this.price_min !== null && this.price_max !== null) {
            if (this.price_min > this.price_max) {
                throw new Error('price_min cannot be greater than price_max');
            }
        }

        // Validate negated_terms (optional array of strings)
        if (this.negated_terms !== null) {
            if (!Array.isArray(this.negated_terms)) {
                throw new Error('negated_terms must be an array or null');
            }
            for (const term of this.negated_terms) {
                if (typeof term !== 'string') {
                    throw new Error('All negated_terms must be strings');
                }
            }
        }
    }

    /**
     * Creates a QueryComponents instance from a plain object
     * @param {Object} obj - Plain object with QueryComponents properties
     * @returns {QueryComponents} New QueryComponents instance
     */
    static fromObject(obj) {
        return new QueryComponents(
            obj.semantic_query,
            obj.price_min,
            obj.price_max,
            obj.negated_terms
        );
    }

    /**
     * Converts the QueryComponents instance to a plain object
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            semantic_query: this.semantic_query,
            price_min: this.price_min,
            price_max: this.price_max,
            negated_terms: this.negated_terms
        };
    }

    /**
     * Creates a copy of the QueryComponents instance
     * @returns {QueryComponents} New QueryComponents instance with same values
     */
    clone() {
        return new QueryComponents(
            this.semantic_query,
            this.price_min,
            this.price_max,
            this.negated_terms ? [...this.negated_terms] : null
        );
    }
}

module.exports = QueryComponents;