const { SqlFilterParams } = require('../models');

/**
 * FilterMapper component for mapping QueryComponents into SQL-ready filter parameters
 * Transforms structured query components into concrete filter parameters for database queries
 */
class FilterMapper {
    /**
     * Creates a new FilterMapper instance
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.options = {
            validateRanges: true,
            allowNullFilters: true,
            ...options
        };
    }

    /**
     * Maps QueryComponents to SqlFilterParams
     * @param {QueryComponents} queryComponents - The structured query components
     * @returns {SqlFilterParams} SQL-ready filter parameters
     */
    map(queryComponents) {
        if (!queryComponents) {
            throw new Error('QueryComponents is required');
        }

        // Validate QueryComponents structure
        this._validateQueryComponents(queryComponents);

        // Extract price constraints with validation
        const priceConstraints = this._extractPriceConstraints(queryComponents);

        // Extract negation/exclusion terms
        const exclusionTerms = this._extractExclusionTerms(queryComponents);

        // Create and validate SqlFilterParams
        const sqlFilterParams = new SqlFilterParams(
            priceConstraints.min_price,
            priceConstraints.max_price,
            exclusionTerms
        );

        // Additional validation if enabled
        if (this.options.validateRanges) {
            this._validateFilterParams(sqlFilterParams);
        }

        return sqlFilterParams;
    }

    /**
     * Validates QueryComponents structure
     * @private
     * @param {QueryComponents} queryComponents - The query components to validate
     * @throws {Error} If validation fails
     */
    _validateQueryComponents(queryComponents) {
        // Check for required semantic_query field
        if (!queryComponents.semantic_query || typeof queryComponents.semantic_query !== 'string') {
            throw new Error('QueryComponents must have a valid semantic_query string');
        }

        // Validate price_min if present
        if (queryComponents.price_min !== null && queryComponents.price_min !== undefined) {
            if (typeof queryComponents.price_min !== 'number' || isNaN(queryComponents.price_min)) {
                throw new Error('price_min must be a valid number or null');
            }
            if (queryComponents.price_min < 0) {
                throw new Error('price_min must be non-negative');
            }
        }

        // Validate price_max if present
        if (queryComponents.price_max !== null && queryComponents.price_max !== undefined) {
            if (typeof queryComponents.price_max !== 'number' || isNaN(queryComponents.price_max)) {
                throw new Error('price_max must be a valid number or null');
            }
            if (queryComponents.price_max < 0) {
                throw new Error('price_max must be non-negative');
            }
        }

        // Validate negated_terms if present
        if (queryComponents.negated_terms !== null && queryComponents.negated_terms !== undefined) {
            if (!Array.isArray(queryComponents.negated_terms)) {
                throw new Error('negated_terms must be an array or null');
            }
            for (const term of queryComponents.negated_terms) {
                if (typeof term !== 'string') {
                    throw new Error('All negated_terms must be strings');
                }
            }
        }
    }

    /**
     * Extracts and validates price constraints
     * @private
     * @param {QueryComponents} queryComponents - The query components
     * @returns {Object} Price constraints {min_price, max_price}
     */
    _extractPriceConstraints(queryComponents) {
        let min_price = null;
        let max_price = null;

        // Direct passthrough of price constraints
        if (queryComponents.price_min !== null && queryComponents.price_min !== undefined) {
            min_price = queryComponents.price_min;
        }

        if (queryComponents.price_max !== null && queryComponents.price_max !== undefined) {
            max_price = queryComponents.price_max;
        }

        // Validate price range consistency
        if (min_price !== null && max_price !== null) {
            if (min_price > max_price) {
                throw new Error('price_min cannot be greater than price_max');
            }
        }

        return { min_price, max_price };
    }

    /**
     * Extracts exclusion terms from negated terms
     * @private
     * @param {QueryComponents} queryComponents - The query components
     * @returns {string[]|null} Array of exclusion terms or null
     */
    _extractExclusionTerms(queryComponents) {
        if (!queryComponents.negated_terms || queryComponents.negated_terms.length === 0) {
            return null;
        }

        // Filter and clean negated terms
        const exclusionTerms = queryComponents.negated_terms
            .filter(term => term && typeof term === 'string' && term.trim().length > 0)
            .map(term => term.trim().toLowerCase())
            .filter((term, index, array) => array.indexOf(term) === index); // Remove duplicates

        return exclusionTerms.length > 0 ? exclusionTerms : null;
    }

    /**
     * Validates the final SqlFilterParams
     * @private
     * @param {SqlFilterParams} sqlFilterParams - The filter parameters to validate
     * @throws {Error} If validation fails
     */
    _validateFilterParams(sqlFilterParams) {
        // Validate price range consistency (redundant check for safety)
        if (sqlFilterParams.min_price !== null && sqlFilterParams.max_price !== null) {
            if (sqlFilterParams.min_price > sqlFilterParams.max_price) {
                throw new Error('Mapped filter parameters have invalid price range');
            }
        }

        // Validate that we have meaningful filters if exclusion terms are present
        if (sqlFilterParams.excluded_terms && sqlFilterParams.excluded_terms.length === 0) {
            // Convert empty array to null for consistency
            sqlFilterParams.excluded_terms = null;
        }
    }

    /**
     * Creates a FilterMapper instance with specific validation options
     * @param {Object} options - Configuration options
     * @returns {FilterMapper} New FilterMapper instance
     */
    static withOptions(options) {
        return new FilterMapper(options);
    }

    /**
     * Creates a FilterMapper instance with strict validation enabled
     * @returns {FilterMapper} FilterMapper with strict validation
     */
    static strict() {
        return new FilterMapper({
            validateRanges: true,
            allowNullFilters: false
        });
    }

    /**
     * Creates a FilterMapper instance with lenient validation
     * @returns {FilterMapper} FilterMapper with lenient validation
     */
    static lenient() {
        return new FilterMapper({
            validateRanges: false,
            allowNullFilters: true
        });
    }

    /**
     * Utility method to check if QueryComponents has any filterable constraints
     * @param {QueryComponents} queryComponents - The query components to check
     * @returns {boolean} True if there are filterable constraints
     */
    static hasFilterableConstraints(queryComponents) {
        if (!queryComponents) return false;

        const hasPriceMin = queryComponents.price_min !== null && queryComponents.price_min !== undefined;
        const hasPriceMax = queryComponents.price_max !== null && queryComponents.price_max !== undefined;
        const hasExclusions = Boolean(queryComponents.negated_terms && Array.isArray(queryComponents.negated_terms) && queryComponents.negated_terms.length > 0);

        return Boolean(hasPriceMin || hasPriceMax || hasExclusions);
    }

    /**
     * Utility method to get a summary of what filters will be applied
     * @param {QueryComponents} queryComponents - The query components
     * @returns {Object} Summary of filters that will be applied
     */
    static getFilterSummary(queryComponents) {
        if (!queryComponents) {
            return { hasPriceFilters: false, hasExclusionFilters: false, filterCount: 0 };
        }

        const hasPriceMin = queryComponents.price_min !== null && queryComponents.price_min !== undefined;
        const hasPriceMax = queryComponents.price_max !== null && queryComponents.price_max !== undefined;
        const hasExclusions = Boolean(queryComponents.negated_terms && Array.isArray(queryComponents.negated_terms) && queryComponents.negated_terms.length > 0);

        const hasPriceFilters = hasPriceMin || hasPriceMax;
        const hasExclusionFilters = hasExclusions;
        
        let filterCount = 0;
        if (hasPriceMin) filterCount++;
        if (hasPriceMax) filterCount++;
        if (hasExclusionFilters) filterCount++;

        return {
            hasPriceFilters,
            hasExclusionFilters,
            filterCount,
            priceRange: hasPriceFilters ? {
                min: queryComponents.price_min,
                max: queryComponents.price_max
            } : null,
            exclusionCount: hasExclusions ? queryComponents.negated_terms.length : 0
        };
    }
}

module.exports = FilterMapper;