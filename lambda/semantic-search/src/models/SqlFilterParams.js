/**
 * SqlFilterParams data model for SQL query filter parameters
 * Represents the filter parameters that will be applied to SQL queries
 */
class SqlFilterParams {
    /**
     * Creates a new SqlFilterParams instance
     * @param {number|null} min_price - Minimum price filter (optional, non-negative)
     * @param {number|null} max_price - Maximum price filter (optional, non-negative)
     * @param {string[]|null} excluded_terms - Terms to exclude from results (optional)
     */
    constructor(min_price = null, max_price = null, excluded_terms = null) {
        this.min_price = min_price;
        this.max_price = max_price;
        this.excluded_terms = excluded_terms;
        
        // Validate the instance after construction
        this._validate();
    }

    /**
     * Validates the SqlFilterParams instance
     * @private
     * @throws {Error} If validation fails
     */
    _validate() {
        // Validate min_price (optional, non-negative number)
        if (this.min_price !== null) {
            if (typeof this.min_price !== 'number' || isNaN(this.min_price)) {
                throw new Error('min_price must be a number or null');
            }
            if (this.min_price < 0) {
                throw new Error('min_price must be non-negative');
            }
        }

        // Validate max_price (optional, non-negative number)
        if (this.max_price !== null) {
            if (typeof this.max_price !== 'number' || isNaN(this.max_price)) {
                throw new Error('max_price must be a number or null');
            }
            if (this.max_price < 0) {
                throw new Error('max_price must be non-negative');
            }
        }

        // Validate price range consistency (min <= max)
        if (this.min_price !== null && this.max_price !== null) {
            if (this.min_price > this.max_price) {
                throw new Error('min_price cannot be greater than max_price');
            }
        }

        // Validate excluded_terms (optional array of strings)
        if (this.excluded_terms !== null) {
            if (!Array.isArray(this.excluded_terms)) {
                throw new Error('excluded_terms must be an array or null');
            }
            for (const term of this.excluded_terms) {
                if (typeof term !== 'string') {
                    throw new Error('All excluded_terms must be strings');
                }
            }
        }
    }

    /**
     * Creates a SqlFilterParams instance from a plain object
     * @param {Object} obj - Plain object with SqlFilterParams properties
     * @returns {SqlFilterParams} New SqlFilterParams instance
     */
    static fromObject(obj) {
        return new SqlFilterParams(
            obj.min_price,
            obj.max_price,
            obj.excluded_terms
        );
    }

    /**
     * Converts the SqlFilterParams instance to a plain object
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            min_price: this.min_price,
            max_price: this.max_price,
            excluded_terms: this.excluded_terms
        };
    }

    /**
     * Creates a copy of the SqlFilterParams instance
     * @returns {SqlFilterParams} New SqlFilterParams instance with same values
     */
    clone() {
        return new SqlFilterParams(
            this.min_price,
            this.max_price,
            this.excluded_terms ? [...this.excluded_terms] : null
        );
    }

    /**
     * Checks if any price filters are applied
     * @returns {boolean} True if min_price or max_price is set
     */
    hasPriceFilters() {
        return this.min_price !== null || this.max_price !== null;
    }

    /**
     * Checks if any exclusion filters are applied
     * @returns {boolean} True if excluded_terms is set and not empty
     */
    hasExclusionFilters() {
        return this.excluded_terms !== null && this.excluded_terms.length > 0;
    }

    /**
     * Checks if any filters are applied
     * @returns {boolean} True if any filters are set
     */
    hasFilters() {
        return this.hasPriceFilters() || this.hasExclusionFilters();
    }
}

module.exports = SqlFilterParams;