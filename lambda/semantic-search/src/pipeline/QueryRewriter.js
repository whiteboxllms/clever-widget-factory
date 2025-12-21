const { QueryComponents } = require('../models');

/**
 * QueryRewriter component for transforming natural language queries
 * into structured QueryComponents objects with semantic intent and constraints
 */
class QueryRewriter {
    /**
     * Creates a new QueryRewriter instance
     * @param {Object} llmClient - LLM client for natural language processing
     * @param {Object} options - Configuration options
     */
    constructor(llmClient, options = {}) {
        this.llmClient = llmClient;
        this.options = {
            fallbackToRegex: true,
            maxRetries: 2,
            timeout: 5000,
            ...options
        };
    }

    /**
     * Transforms a raw natural language query into structured QueryComponents
     * @param {string} rawQuery - The raw user query
     * @returns {Promise<QueryComponents>} Structured query components
     */
    async rewrite(rawQuery) {
        if (!rawQuery || typeof rawQuery !== 'string') {
            throw new Error('Raw query must be a non-empty string');
        }

        const trimmedQuery = rawQuery.trim();
        if (trimmedQuery.length === 0) {
            throw new Error('Raw query cannot be empty or whitespace only');
        }

        try {
            // Try LLM-based extraction first
            const llmResult = await this._extractWithLLM(trimmedQuery);
            if (llmResult) {
                return llmResult;
            }
        } catch (error) {
            console.warn('LLM extraction failed, falling back to regex:', error.message);
        }

        // Fallback to regex-based extraction
        if (this.options.fallbackToRegex) {
            return this._extractWithRegex(trimmedQuery);
        }

        throw new Error('Failed to extract query components');
    }

    /**
     * Extracts query components using LLM
     * @private
     * @param {string} query - The query to process
     * @returns {Promise<QueryComponents|null>} Extracted components or null if failed
     */
    async _extractWithLLM(query) {
        const prompt = this._buildExtractionPrompt(query);
        
        try {
            const response = await this.llmClient.generate({
                prompt,
                maxTokens: 200,
                temperature: 0.1,
                timeout: this.options.timeout
            });

            const parsed = this._parseLLMResponse(response);
            if (parsed) {
                return new QueryComponents(
                    parsed.semantic_query,
                    parsed.price_min,
                    parsed.price_max,
                    parsed.negated_terms
                );
            }
        } catch (error) {
            console.error('LLM extraction error:', error);
        }

        return null;
    }

    /**
     * Builds the extraction prompt for the LLM
     * @private
     * @param {string} query - The query to process
     * @returns {string} The formatted prompt
     */
    _buildExtractionPrompt(query) {
        return `Extract structured information from this product search query. Return a JSON object with these fields:
- semantic_query: The main product search terms (required, string)
- price_min: Minimum price if specified (number or null)
- price_max: Maximum price if specified (number or null)  
- negated_terms: Array of terms to exclude like "no", "not", "avoid", "without" (array or null)

Examples:
Query: "instant noodles under 20 pesos"
Response: {"semantic_query": "instant noodles", "price_min": null, "price_max": 20, "negated_terms": null}

Query: "rice above 50 pesos no spicy"
Response: {"semantic_query": "rice", "price_min": 50, "price_max": null, "negated_terms": ["spicy"]}

Query: "tools between 100 and 500 pesos without batteries"
Response: {"semantic_query": "tools", "price_min": 100, "price_max": 500, "negated_terms": ["batteries"]}

Query: "${query}"
Response:`;
    }

    /**
     * Parses the LLM response into structured data
     * @private
     * @param {string} response - The LLM response
     * @returns {Object|null} Parsed data or null if invalid
     */
    _parseLLMResponse(response) {
        try {
            // Extract JSON from response (handle cases where LLM adds extra text)
            const jsonMatch = response.match(/\{.*\}/s);
            if (!jsonMatch) {
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate required fields
            if (!parsed.semantic_query || typeof parsed.semantic_query !== 'string') {
                return null;
            }

            // Normalize price fields
            if (parsed.price_min !== null && (typeof parsed.price_min !== 'number' || parsed.price_min < 0)) {
                parsed.price_min = null;
            }
            if (parsed.price_max !== null && (typeof parsed.price_max !== 'number' || parsed.price_max < 0)) {
                parsed.price_max = null;
            }

            // Normalize negated_terms
            if (parsed.negated_terms && !Array.isArray(parsed.negated_terms)) {
                parsed.negated_terms = null;
            }

            return parsed;
        } catch (error) {
            console.warn('Failed to parse LLM response:', error.message);
            return null;
        }
    }

    /**
     * Extracts query components using regex patterns as fallback
     * @private
     * @param {string} query - The query to process
     * @returns {QueryComponents} Extracted components
     */
    _extractWithRegex(query) {
        const lowerQuery = query.toLowerCase();
        
        // Extract price constraints
        const priceConstraints = this._extractPriceConstraints(lowerQuery);
        
        // Extract negated terms
        const negatedTerms = this._extractNegatedTerms(lowerQuery);
        
        // Extract semantic query by removing price and negation patterns
        const semanticQuery = this._extractSemanticQuery(query, priceConstraints, negatedTerms);
        
        return new QueryComponents(
            semanticQuery,
            priceConstraints.price_min,
            priceConstraints.price_max,
            negatedTerms.length > 0 ? negatedTerms : null
        );
    }

    /**
     * Extracts price constraints from query using regex patterns
     * @private
     * @param {string} query - The lowercase query
     * @returns {Object} Price constraints {price_min, price_max}
     */
    _extractPriceConstraints(query) {
        let price_min = null;
        let price_max = null;

        // Pattern: "between X and Y pesos" or "from X to Y" or "X to Y pesos"
        const betweenPatterns = [
            /(?:between|from)\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)\s+(?:and|to)\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /(?:₱|php)?\s*(\d+(?:\.\d+)?)\s+to\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)\s*(?:pesos?|php|₱)?/,
            /(?:₱|php)?\s*(\d+(?:\.\d+)?)\s*-\s*(?:₱|php)?\s*(\d+(?:\.\d+)?)\s*(?:pesos?|php|₱)?/
        ];

        for (const pattern of betweenPatterns) {
            const match = query.match(pattern);
            if (match) {
                const min = parseFloat(match[1]);
                const max = parseFloat(match[2]);
                // Ensure min <= max
                price_min = Math.min(min, max);
                price_max = Math.max(min, max);
                return { price_min, price_max };
            }
        }

        // Pattern: "under X pesos" or "below X" or "<= X" or "less than X"
        const underPatterns = [
            /(?:under|below|up\s+to|less\s+than)\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /<=\s*(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /max\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /maximum\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/
        ];

        for (const pattern of underPatterns) {
            const match = query.match(pattern);
            if (match) {
                price_max = parseFloat(match[1]);
                break;
            }
        }

        // Pattern: "above X pesos" or "over X" or "> X" or "more than X"
        const abovePatterns = [
            /(?:above|over|more\s+than|greater\s+than)\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            />=?\s*(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /min\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /minimum\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/,
            /starting\s+(?:from|at)\s+(?:₱|php)?\s*(\d+(?:\.\d+)?)/
        ];

        for (const pattern of abovePatterns) {
            const match = query.match(pattern);
            if (match) {
                price_min = parseFloat(match[1]);
                break;
            }
        }

        // Handle currency symbols and validate extracted prices
        if (price_min !== null && (isNaN(price_min) || price_min < 0)) {
            price_min = null;
        }
        if (price_max !== null && (isNaN(price_max) || price_max < 0)) {
            price_max = null;
        }

        // Ensure price_min <= price_max if both are specified
        if (price_min !== null && price_max !== null && price_min > price_max) {
            // Swap them if they're reversed
            [price_min, price_max] = [price_max, price_min];
        }

        return { price_min, price_max };
    }

    /**
     * Extracts negated terms from query
     * @private
     * @param {string} query - The lowercase query
     * @returns {string[]} Array of negated terms
     */
    _extractNegatedTerms(query) {
        const negatedTerms = [];
        
        // Enhanced patterns for negation with better word boundary detection
        const negationPatterns = [
            // "no X" patterns
            /\bno\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g,
            // "not X" patterns  
            /\bnot\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g,
            // "avoid X" patterns
            /\bavoid\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g,
            // "without X" patterns
            /\bwithout\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g,
            // "don't want X" patterns
            /\bdon'?t\s+want\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g,
            // "exclude X" patterns
            /\bexclude\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g,
            // "skip X" patterns
            /\bskip\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g
        ];

        for (const pattern of negationPatterns) {
            let match;
            // Reset regex lastIndex to avoid issues with global flag
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(query)) !== null) {
                const term = match[1].trim().toLowerCase();
                
                // Filter out common stop words and price-related terms
                const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'pesos', 'php', 'peso', 'price', 'cost', 'money'];
                
                // Split multi-word terms and filter each word
                const words = term.split(/\s+/);
                const validWords = words.filter(word => 
                    word && 
                    word.length > 1 && 
                    !stopWords.includes(word) && 
                    !/^\d+/.test(word) // Not starting with numbers
                );
                
                if (validWords.length > 0) {
                    const cleanTerm = validWords.join(' ');
                    if (!negatedTerms.includes(cleanTerm)) {
                        negatedTerms.push(cleanTerm);
                    }
                }
            }
        }

        // Handle compound negations like "no spicy or hot"
        const compoundNegations = this._extractCompoundNegations(query);
        for (const term of compoundNegations) {
            if (!negatedTerms.includes(term)) {
                negatedTerms.push(term);
            }
        }

        return negatedTerms;
    }

    /**
     * Extracts compound negations like "no spicy or hot food"
     * @private
     * @param {string} query - The lowercase query
     * @returns {string[]} Array of compound negated terms
     */
    _extractCompoundNegations(query) {
        const compoundTerms = [];
        
        // Pattern: "no X or Y" or "not X or Y" or "avoid X and Y"
        const compoundPatterns = [
            /\b(?:no|not|avoid|without)\s+([a-zA-Z]+)\s+(?:or|and)\s+([a-zA-Z]+)/g,
            /\b(?:no|not|avoid|without)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s*,\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g
        ];

        for (const pattern of compoundPatterns) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(query)) !== null) {
                const term1 = match[1].trim().toLowerCase();
                const term2 = match[2].trim().toLowerCase();
                
                if (term1 && term1.length > 1 && !compoundTerms.includes(term1)) {
                    compoundTerms.push(term1);
                }
                if (term2 && term2.length > 1 && !compoundTerms.includes(term2)) {
                    compoundTerms.push(term2);
                }
            }
        }

        return compoundTerms;
    }

    /**
     * Extracts semantic query by removing price and negation patterns
     * @private
     * @param {string} originalQuery - The original query
     * @param {Object} priceConstraints - Extracted price constraints
     * @param {string[]} negatedTerms - Extracted negated terms
     * @returns {string} Clean semantic query
     */
    _extractSemanticQuery(originalQuery, priceConstraints, negatedTerms) {
        let semanticQuery = originalQuery;

        // Remove price patterns (comprehensive list)
        const pricePatterns = [
            // Between patterns
            /(?:between|from)\s+\d+(?:\.\d+)?\s+(?:and|to)\s+\d+(?:\.\d+)?(?:\s*(?:pesos?|php|₱))?/gi,
            /\d+(?:\.\d+)?\s+to\s+\d+(?:\.\d+)?(?:\s*(?:pesos?|php|₱))?/gi,
            /\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?(?:\s*(?:pesos?|php|₱))?/gi,
            // Under/below patterns
            /(?:under|below|up\s+to|less\s+than|<=|max|maximum)\s+\d+(?:\.\d+)?(?:\s*(?:pesos?|php|₱))?/gi,
            // Above/over patterns
            /(?:above|over|more\s+than|greater\s+than|>=?|min|minimum|starting\s+(?:from|at))\s+\d+(?:\.\d+)?(?:\s*(?:pesos?|php|₱))?/gi,
            // Currency symbols and amounts
            /₱\s*\d+(?:\.\d+)?/gi,
            /php\s*\d+(?:\.\d+)?/gi,
            /\d+(?:\.\d+)?\s*(?:pesos?|php|₱)/gi
        ];

        for (const pattern of pricePatterns) {
            semanticQuery = semanticQuery.replace(pattern, ' ');
        }

        // Remove negation patterns (comprehensive list)
        const negationPatterns = [
            /\b(?:no|not|avoid|without|don'?t\s+want|exclude|skip)\s+[a-zA-Z]+(?:\s+[a-zA-Z]+)*/gi,
            // Handle compound negations
            /\b(?:no|not|avoid|without)\s+[a-zA-Z]+\s+(?:or|and)\s+[a-zA-Z]+/gi,
            /\b(?:no|not|avoid|without)\s+[a-zA-Z]+(?:\s+[a-zA-Z]+)*\s*,\s*[a-zA-Z]+(?:\s+[a-zA-Z]+)*/gi
        ];

        for (const pattern of negationPatterns) {
            semanticQuery = semanticQuery.replace(pattern, ' ');
        }

        // Remove common filler words and normalize
        const fillerWords = [
            'please', 'find', 'search', 'for', 'looking', 'want', 'need', 'buy', 'purchase', 
            'get', 'show', 'me', 'some', 'any', 'good', 'best', 'cheap', 'expensive',
            'quality', 'brand', 'type', 'kind', 'sort'
        ];

        const fillerPattern = new RegExp(`\\b(?:${fillerWords.join('|')})\\b`, 'gi');
        semanticQuery = semanticQuery.replace(fillerPattern, ' ');

        // Clean up whitespace and punctuation
        semanticQuery = semanticQuery
            .replace(/[^\w\s]/g, ' ') // Remove punctuation except word chars and spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

        // Ensure we have a meaningful semantic query
        if (!semanticQuery || semanticQuery.length < 2) {
            // Extract meaningful words from original query as fallback
            const words = this._extractMeaningfulWords(originalQuery);
            semanticQuery = words.slice(0, 3).join(' ') || 'products';
        }

        // Final validation and normalization
        semanticQuery = this._normalizeSemanticQuery(semanticQuery);

        return semanticQuery;
    }

    /**
     * Extracts meaningful words from a query for fallback semantic query
     * @private
     * @param {string} query - The original query
     * @returns {string[]} Array of meaningful words
     */
    _extractMeaningfulWords(query) {
        const stopWords = new Set([
            'the', 'and', 'or', 'but', 'for', 'with', 'without', 'under', 'above', 
            'between', 'pesos', 'php', 'peso', 'no', 'not', 'avoid', 'please',
            'find', 'search', 'looking', 'want', 'need', 'buy', 'get', 'show',
            'me', 'some', 'any', 'good', 'best', 'from', 'to', 'at', 'in', 'on'
        ]);

        return query.toLowerCase()
            .split(/\s+/)
            .filter(word => {
                return word.length > 2 && 
                       !stopWords.has(word) &&
                       !/^\d+$/.test(word) && // Not just numbers
                       /^[a-zA-Z]/.test(word); // Starts with letter
            });
    }

    /**
     * Normalizes the semantic query for consistency
     * @private
     * @param {string} query - The query to normalize
     * @returns {string} Normalized query
     */
    _normalizeSemanticQuery(query) {
        if (!query || query.trim().length === 0) {
            return 'products';
        }

        // Convert to lowercase for consistency
        let normalized = query.toLowerCase().trim();

        // Handle common product category synonyms
        const synonyms = {
            'noodle': 'noodles',
            'tool': 'tools', 
            'rice': 'rice',
            'food': 'food',
            'drink': 'drinks',
            'snack': 'snacks'
        };

        for (const [singular, plural] of Object.entries(synonyms)) {
            normalized = normalized.replace(new RegExp(`\\b${singular}\\b`, 'g'), plural);
        }

        // Ensure minimum length
        if (normalized.length < 2) {
            return 'products';
        }

        return normalized;
    }
}

module.exports = QueryRewriter;