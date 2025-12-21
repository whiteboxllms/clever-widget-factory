/**
 * FiltersApplied data model for tracking applied search filters
 * Represents the filters that were actually applied to the search query
 */
class FiltersApplied {
    /**
     * Creates a new FiltersApplied instance
     * @param {number|null} price_min - Minimum price filter applied (optional)
     * @param {number|null} price_max - Maximum price filter applied (optional)
     * @param {string[]|null} excluded_terms - Terms excluded from results (optional)
     */
    constructor(price_min = null, price_max = null, excluded_terms = null) {
        this.price_min = price_min;
        this.price_max = price_max;
        this.excluded_terms = excluded_terms;
        
        // Validate the instance after construction
        this._validate();
    }

    /**
     * Validates the FiltersApplied instance
     * @private
     * @throws {Error} If validation fails
     */
    _validate() {
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
     * Creates a FiltersApplied instance from SqlFilterParams
     * @param {SqlFilterParams} sqlFilterParams - SQL filter parameters
     * @returns {FiltersApplied} New FiltersApplied instance
     */
    static fromSqlFilterParams(sqlFilterParams) {
        return new FiltersApplied(
            sqlFilterParams.min_price,
            sqlFilterParams.max_price,
            sqlFilterParams.excluded_terms
        );
    }

    /**
     * Creates a FiltersApplied instance from a plain object
     * @param {Object} obj - Plain object with FiltersApplied properties
     * @returns {FiltersApplied} New FiltersApplied instance
     */
    static fromObject(obj) {
        return new FiltersApplied(
            obj.price_min,
            obj.price_max,
            obj.excluded_terms
        );
    }

    /**
     * Converts the FiltersApplied instance to a plain object
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            price_min: this.price_min,
            price_max: this.price_max,
            excluded_terms: this.excluded_terms
        };
    }

    /**
     * Checks if any filters were applied
     * @returns {boolean} True if any filters are set
     */
    hasFilters() {
        return this.price_min !== null || 
               this.price_max !== null || 
               (this.excluded_terms !== null && this.excluded_terms.length > 0);
    }

    /**
     * Gets a human-readable description of applied filters
     * @returns {string} Description of applied filters
     */
    getDescription() {
        const parts = [];
        
        if (this.price_min !== null && this.price_max !== null) {
            parts.push(`Price: ₱${this.price_min} - ₱${this.price_max}`);
        } else if (this.price_min !== null) {
            parts.push(`Price: ₱${this.price_min}+`);
        } else if (this.price_max !== null) {
            parts.push(`Price: up to ₱${this.price_max}`);
        }
        
        if (this.excluded_terms && this.excluded_terms.length > 0) {
            parts.push(`Excluded: ${this.excluded_terms.join(', ')}`);
        }
        
        return parts.length > 0 ? parts.join('; ') : 'No filters applied';
    }

    /**
     * Gets detailed filter information for logging
     * @returns {Object} Detailed filter information
     */
    getDetailedFilterInfo() {
        return {
            price_filtering: {
                enabled: this.price_min !== null || this.price_max !== null,
                min_price: this.price_min,
                max_price: this.price_max,
                range_type: this._getPriceRangeType()
            },
            negation_filtering: {
                enabled: this.excluded_terms !== null && this.excluded_terms.length > 0,
                excluded_terms: this.excluded_terms || [],
                exclusion_count: this.excluded_terms ? this.excluded_terms.length : 0
            },
            filter_summary: this.getDescription()
        };
    }

    /**
     * Gets the type of price range filtering
     * @private
     * @returns {string} Type of price range
     */
    _getPriceRangeType() {
        if (this.price_min !== null && this.price_max !== null) {
            return 'range';
        } else if (this.price_min !== null) {
            return 'minimum_only';
        } else if (this.price_max !== null) {
            return 'maximum_only';
        }
        return 'none';
    }

    /**
     * Logs filter application decision
     * @param {Object} debugInfo - DebugInfo instance to log to
     * @param {string} source - Source of the filters (e.g., 'query_rewriter', 'filter_mapper')
     */
    logFilterApplication(debugInfo, source) {
        if (this.price_min !== null || this.price_max !== null) {
            debugInfo.logFilterDecision(
                'price',
                'applied',
                `Price filter applied from ${source}`,
                {
                    min_price: this.price_min,
                    max_price: this.price_max,
                    range_type: this._getPriceRangeType()
                }
            );
        }

        if (this.excluded_terms && this.excluded_terms.length > 0) {
            debugInfo.logFilterDecision(
                'negation',
                'applied',
                `Negation filter applied from ${source}`,
                {
                    excluded_terms: this.excluded_terms,
                    exclusion_count: this.excluded_terms.length
                }
            );
        }

        if (!this.hasFilters()) {
            debugInfo.logFilterDecision(
                'none',
                'no_filters',
                `No filters applied from ${source}`,
                {}
            );
        }
    }
}

module.exports = FiltersApplied;