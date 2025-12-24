const { generateEmbedding } = require('../../shared/embeddings');
const EnhancedDatabaseService = require('../services/EnhancedDatabaseService');

/**
 * HybridRetriever component for executing combined SQL and vector similarity searches
 * Implements parameterized SQL query generation with vector similarity, price filtering,
 * and product eligibility constraints
 */
class HybridRetriever {
    /**
     * Creates a new HybridRetriever instance
     * @param {EnhancedDatabaseService} databaseService - Database service instance
     * @param {Object} embeddingService - Embedding service instance (optional, uses default if not provided)
     */
    constructor(databaseService = null, embeddingService = null) {
        this.db = databaseService || new EnhancedDatabaseService();
        this.embeddingService = embeddingService;
        
        // SQL query template for hybrid search
        this.baseQuery = `
            SELECT 
                id,
                name,
                description,
                price,
                stock_level,
                is_active,
                1 - (embedding <=> $1) AS similarity_score
            FROM products 
            WHERE is_active = TRUE
        `;
    }

    /**
     * Executes a hybrid search combining SQL filtering and vector similarity
     * @param {string} semanticQuery - The semantic search terms
     * @param {SqlFilterParams} filters - Filter parameters for SQL query
     * @param {number} limit - Maximum number of results (default: 20)
     * @param {Object} options - Additional search options
     * @returns {Promise<Array>} Array of search result rows
     */
    async search(semanticQuery, filters, limit = 20, options = {}) {
        try {
            // Generate embedding for the semantic query
            const queryEmbedding = await this._generateQueryEmbedding(semanticQuery);
            
            // Build the parameterized SQL query with vector similarity optimization
            const { sql, params } = this._buildQuery(queryEmbedding, filters, limit, options);
            
            // Log the query for debugging (if enabled)
            if (options.debug) {
                console.log('HybridRetriever SQL:', {
                    sql: sql.replace(/\s+/g, ' ').trim(),
                    paramCount: params.length,
                    semanticQuery,
                    filters: filters.toObject(),
                    embeddingDimensions: queryEmbedding.length
                });
            }
            
            // Execute the query with vector similarity optimization
            const results = await this._executeVectorQuery(sql, params, options);
            
            // Apply post-processing if needed (e.g., negation filtering)
            const processedResults = await this._postProcessResults(results, filters, options);
            
            return processedResults;
            
        } catch (error) {
            console.error('HybridRetriever search error:', {
                semanticQuery,
                filters: filters.toObject(),
                error: error.message
            });
            throw new Error(`Search execution failed: ${error.message}`);
        }
    }

    /**
     * Generates SQL query with parameterized filters
     * @param {Array} queryEmbedding - Query embedding vector
     * @param {SqlFilterParams} filters - Filter parameters
     * @param {number} limit - Result limit
     * @param {Object} options - Additional options
     * @returns {Object} Object with sql string and params array
     * @private
     */
    _buildQuery(queryEmbedding, filters, limit, options = {}) {
        let sql = this.baseQuery;
        const params = [JSON.stringify(queryEmbedding)];
        let paramIndex = 2;

        // Add NULL-safe price filtering with inclusive boundaries
        if (filters.min_price !== null && filters.min_price !== undefined) {
            // Use NULL-safe comparison to handle products with NULL prices
            sql += ` AND (price IS NOT NULL AND price >= $${paramIndex})`;
            params.push(filters.min_price);
            paramIndex++;
        }

        if (filters.max_price !== null && filters.max_price !== undefined) {
            // Use NULL-safe comparison to handle products with NULL prices
            sql += ` AND (price IS NOT NULL AND price <= $${paramIndex})`;
            params.push(filters.max_price);
            paramIndex++;
        }

        // Log applied price filters for debugging and monitoring
        if ((filters.min_price !== null && filters.min_price !== undefined) || 
            (filters.max_price !== null && filters.max_price !== undefined)) {
            const priceFilterLog = {
                min_price: filters.min_price,
                max_price: filters.max_price,
                filter_type: 'price_range',
                boundaries: 'inclusive'
            };
            
            if (options.debug) {
                console.log('Applied price filters:', priceFilterLog);
            }
        }

        // Add basic negation filtering (enhanced version would use vector similarity)
        if (filters.excluded_terms && filters.excluded_terms.length > 0) {
            const exclusionConditions = filters.excluded_terms.map(() => {
                const condition = `(description IS NULL OR description NOT ILIKE $${paramIndex})`;
                paramIndex++;
                return condition;
            });
            sql += ` AND ${exclusionConditions.join(' AND ')}`;
            filters.excluded_terms.forEach(term => params.push(`%${term}%`));

            // Log applied negation filters
            if (options.debug) {
                console.log('Applied negation filters:', {
                    excluded_terms: filters.excluded_terms,
                    filter_type: 'negation',
                    method: 'text_pattern_matching'
                });
            }
        }

        // Add ordering with stock level boosting and similarity ranking
        sql += `
            ORDER BY 
                (stock_level > 0) DESC,  -- In-stock products first
                embedding <=> $1         -- Then by semantic similarity (ascending distance)
        `;

        // Add limit
        sql += ` LIMIT $${paramIndex}`;
        params.push(limit);

        return { sql, params };
    }

    /**
     * Generates embedding for the semantic query
     * @param {string} semanticQuery - The semantic search terms
     * @returns {Promise<Array>} Query embedding vector
     * @private
     */
    async _generateQueryEmbedding(semanticQuery) {
        if (!semanticQuery || typeof semanticQuery !== 'string') {
            throw new Error('Semantic query must be a non-empty string');
        }

        try {
            if (this.embeddingService) {
                return await this.embeddingService.generateEmbedding(semanticQuery);
            } else {
                return await generateEmbedding(semanticQuery);
            }
        } catch (error) {
            console.error('Embedding generation failed:', {
                semanticQuery,
                error: error.message
            });
            throw new Error(`Failed to generate embedding: ${error.message}`);
        }
    }

    /**
     * Executes vector similarity query with performance optimizations
     * @param {string} sql - SQL query string
     * @param {Array} params - Query parameters
     * @param {Object} options - Execution options
     * @returns {Promise<Array>} Query results
     * @private
     */
    async _executeVectorQuery(sql, params, options = {}) {
        try {
            // Set vector search optimization parameters if requested
            if (options.optimizeVector !== false) {
                await this._setVectorOptimizations();
            }
            
            // Execute the main query
            const results = await this.db.queryWithParams(sql, params);
            
            // Validate similarity scores and embedding dimensions
            if (options.validateResults !== false) {
                this._validateVectorResults(results);
            }
            
            return results;
            
        } catch (error) {
            console.error('Vector query execution error:', {
                error: error.message,
                sqlPreview: sql.substring(0, 200)
            });
            throw error;
        }
    }

    /**
     * Sets PostgreSQL parameters for optimal vector search performance
     * @private
     */
    async _setVectorOptimizations() {
        try {
            // Set work_mem for better vector operations (if not already optimized)
            await this.db.queryWithParams('SET LOCAL work_mem = $1', ['256MB']);
            
            // Enable parallel query execution for large datasets
            await this.db.queryWithParams('SET LOCAL max_parallel_workers_per_gather = $1', [2]);
            
            // Optimize for vector similarity operations
            await this.db.queryWithParams('SET LOCAL effective_cache_size = $1', ['1GB']);
            
        } catch (error) {
            // Log but don't fail - these are optimizations, not requirements
            console.warn('Vector optimization settings failed (non-critical):', error.message);
        }
    }

    /**
     * Validates vector similarity results for consistency
     * @param {Array} results - Query results to validate
     * @private
     */
    _validateVectorResults(results) {
        for (const result of results) {
            // Validate similarity score is within expected range [0, 1]
            if (result.similarity_score !== null && result.similarity_score !== undefined) {
                if (result.similarity_score < 0 || result.similarity_score > 1) {
                    console.warn('Invalid similarity score detected:', {
                        productId: result.id,
                        score: result.similarity_score
                    });
                }
            }
        }
    }

    /**
     * Post-processes search results (e.g., advanced negation filtering)
     * @param {Array} results - Raw search results
     * @param {SqlFilterParams} filters - Filter parameters
     * @param {Object} options - Additional options
     * @returns {Promise<Array>} Processed results
     * @private
     */
    async _postProcessResults(results, filters, options = {}) {
        // Apply similarity threshold filtering if specified
        if (options.similarityThreshold && typeof options.similarityThreshold === 'number') {
            const filteredResults = results.filter(result => 
                result.similarity_score >= options.similarityThreshold
            );
            
            if (options.debug) {
                console.log('Similarity threshold filtering:', {
                    threshold: options.similarityThreshold,
                    originalCount: results.length,
                    filteredCount: filteredResults.length
                });
            }
            
            return filteredResults;
        }
        
        // Future enhancement: implement semantic negation filtering here
        // This would involve generating embeddings for excluded terms and
        // filtering out products with high similarity to negated characteristics
        
        if (options.debug && filters.excluded_terms && filters.excluded_terms.length > 0) {
            console.log('Post-processing with negation filters:', {
                originalCount: results.length,
                excludedTerms: filters.excluded_terms
            });
        }
        
        return results;
    }

    /**
     * Validates that the database schema is compatible
     * @returns {Promise<Object>} Schema validation result
     */
    async validateSchema() {
        return this.db.validateSchema();
    }

    /**
     * Tests the database connection
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
        return this.db.testConnection();
    }

    /**
     * Ensures proper vector indexes exist for optimal performance
     * @returns {Promise<Object>} Index status and recommendations
     */
    async ensureVectorIndexes() {
        try {
            // Check if vector index exists
            const indexQuery = `
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'products' 
                AND indexdef LIKE '%embedding%'
                AND indexdef LIKE '%vector_%'
            `;
            
            const existingIndexes = await this.db.queryWithParams(indexQuery);
            
            const recommendations = [];
            let hasVectorIndex = false;
            
            // Check for IVFFlat index (recommended for large datasets)
            const hasIVFFlat = existingIndexes.some(idx => 
                idx.indexdef.includes('ivfflat') && idx.indexdef.includes('vector_cosine_ops')
            );
            
            if (hasIVFFlat) {
                hasVectorIndex = true;
            } else {
                // Check for HNSW index (alternative for smaller datasets)
                const hasHNSW = existingIndexes.some(idx => 
                    idx.indexdef.includes('hnsw') && idx.indexdef.includes('vector_cosine_ops')
                );
                
                if (hasHNSW) {
                    hasVectorIndex = true;
                } else {
                    recommendations.push({
                        type: 'missing_vector_index',
                        severity: 'high',
                        message: 'No vector similarity index found. Performance will be poor for large datasets.',
                        suggestion: 'CREATE INDEX products_embedding_idx ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);'
                    });
                }
            }
            
            // Check for composite indexes that might help with filtered vector searches
            const hasCompositeIndex = existingIndexes.some(idx => 
                idx.indexdef.includes('is_active') && idx.indexdef.includes('embedding')
            );
            
            if (!hasCompositeIndex) {
                recommendations.push({
                    type: 'missing_composite_index',
                    severity: 'medium',
                    message: 'No composite index for filtered vector searches.',
                    suggestion: 'Consider creating: CREATE INDEX products_active_embedding_idx ON products (is_active) INCLUDE (embedding) WHERE is_active = TRUE;'
                });
            }
            
            return {
                hasVectorIndex,
                existingIndexes: existingIndexes.map(idx => ({
                    name: idx.indexname,
                    definition: idx.indexdef
                })),
                recommendations,
                status: recommendations.length === 0 ? 'optimal' : 'needs_optimization'
            };
            
        } catch (error) {
            console.error('Vector index check failed:', error.message);
            return {
                hasVectorIndex: false,
                existingIndexes: [],
                recommendations: [{
                    type: 'index_check_failed',
                    severity: 'high',
                    message: `Failed to check vector indexes: ${error.message}`,
                    suggestion: 'Verify database connection and permissions'
                }],
                status: 'unknown'
            };
        }
    }

    /**
     * Analyzes vector search performance and provides optimization suggestions
     * @param {string} semanticQuery - Test query for analysis
     * @param {SqlFilterParams} filters - Test filters
     * @returns {Promise<Object>} Performance analysis results
     */
    async analyzeVectorPerformance(semanticQuery, filters) {
        try {
            const queryEmbedding = await this._generateQueryEmbedding(semanticQuery);
            const { sql, params } = this._buildQuery(queryEmbedding, filters, 10);
            
            // Get query execution plan
            const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
            const planResult = await this.db.queryWithParams(explainQuery, params);
            const plan = planResult[0]['QUERY PLAN'][0];
            
            // Analyze the execution plan
            const analysis = {
                executionTime: plan['Execution Time'],
                planningTime: plan['Planning Time'],
                totalCost: plan.Plan['Total Cost'],
                actualRows: plan.Plan['Actual Rows'],
                indexUsage: this._analyzeIndexUsage(plan.Plan),
                recommendations: []
            };
            
            // Performance recommendations
            if (analysis.executionTime > 1000) {
                analysis.recommendations.push({
                    type: 'slow_query',
                    message: `Query execution time (${analysis.executionTime}ms) exceeds 1 second`,
                    suggestion: 'Consider adding vector indexes or reducing result limit'
                });
            }
            
            if (!analysis.indexUsage.usesVectorIndex) {
                analysis.recommendations.push({
                    type: 'no_vector_index',
                    message: 'Query is not using vector indexes',
                    suggestion: 'Ensure vector indexes exist and are being used'
                });
            }
            
            if (analysis.indexUsage.hasSeqScan) {
                analysis.recommendations.push({
                    type: 'sequential_scan',
                    message: 'Query includes sequential scans which may be slow',
                    suggestion: 'Consider adding indexes for filtered columns'
                });
            }
            
            return analysis;
            
        } catch (error) {
            return {
                error: error.message,
                recommendations: [{
                    type: 'analysis_failed',
                    message: `Performance analysis failed: ${error.message}`,
                    suggestion: 'Check query syntax and database connection'
                }]
            };
        }
    }

    /**
     * Analyzes query execution plan for index usage
     * @param {Object} plan - Query execution plan
     * @returns {Object} Index usage analysis
     * @private
     */
    _analyzeIndexUsage(plan) {
        const analysis = {
            usesVectorIndex: false,
            hasSeqScan: false,
            indexesUsed: []
        };
        
        const analyzePlanNode = (node) => {
            if (node['Node Type'] === 'Seq Scan') {
                analysis.hasSeqScan = true;
            }
            
            if (node['Node Type'] === 'Index Scan' || node['Node Type'] === 'Index Only Scan') {
                const indexName = node['Index Name'];
                if (indexName) {
                    analysis.indexesUsed.push(indexName);
                    if (indexName.includes('embedding') || indexName.includes('vector')) {
                        analysis.usesVectorIndex = true;
                    }
                }
            }
            
            // Recursively analyze child plans
            if (node.Plans) {
                node.Plans.forEach(analyzePlanNode);
            }
        };
        
        analyzePlanNode(plan);
        return analysis;
    }
    async getQueryMetrics(semanticQuery, filters) {
        const startTime = Date.now();
        
        try {
            // Generate embedding timing
            const embeddingStart = Date.now();
            const queryEmbedding = await this._generateQueryEmbedding(semanticQuery);
            const embeddingTime = Date.now() - embeddingStart;
            
            // Build query timing
            const queryBuildStart = Date.now();
            const { sql, params } = this._buildQuery(queryEmbedding, filters, 1);
            const queryBuildTime = Date.now() - queryBuildStart;
            
            // Database query timing (with EXPLAIN)
            const dbStart = Date.now();
            const explainSql = `EXPLAIN (ANALYZE, BUFFERS) ${sql}`;
            const explainResult = await this.db.queryWithParams(explainSql, params);
            const dbTime = Date.now() - dbStart;
            
            const totalTime = Date.now() - startTime;
            
            return {
                totalTime,
                embeddingTime,
                queryBuildTime,
                dbTime,
                queryPlan: explainResult,
                metrics: {
                    embeddingPercentage: totalTime > 0 ? Math.round((embeddingTime / totalTime) * 100) : 0,
                    queryBuildPercentage: totalTime > 0 ? Math.round((queryBuildTime / totalTime) * 100) : 0,
                    dbPercentage: totalTime > 0 ? Math.round((dbTime / totalTime) * 100) : 0
                }
            };
        } catch (error) {
            return {
                error: error.message,
                totalTime: Date.now() - startTime
            };
        }
    }

    /**
     * Extracts applied filter information from filters and options
     * @param {SqlFilterParams} filters - Filter parameters
     * @param {Object} options - Search options
     * @returns {Object} Applied filters information
     * @private
     */
    _getAppliedFilters(filters, options = {}) {
        const appliedFilters = {
            price_min: null,
            price_max: null,
            excluded_terms: []
        };

        // Extract price filters
        if (filters.min_price !== null && filters.min_price !== undefined) {
            appliedFilters.price_min = filters.min_price;
        }

        if (filters.max_price !== null && filters.max_price !== undefined) {
            appliedFilters.price_max = filters.max_price;
        }

        // Extract negation filters
        if (filters.excluded_terms && filters.excluded_terms.length > 0) {
            appliedFilters.excluded_terms = [...filters.excluded_terms];
        }

        return appliedFilters;
    }

    /**
     * Executes a search with detailed logging and debugging information
     * @param {string} semanticQuery - The semantic search terms
     * @param {SqlFilterParams} filters - Filter parameters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Object>} Search results with debug information
     */
    async searchWithDebug(semanticQuery, filters, limit = 20) {
        const debugInfo = {
            startTime: Date.now(),
            semanticQuery,
            filters: filters.toObject(),
            limit
        };

        try {
            // Generate embedding with timing
            const embeddingStart = Date.now();
            const queryEmbedding = await this._generateQueryEmbedding(semanticQuery);
            debugInfo.embeddingTime = Date.now() - embeddingStart;
            debugInfo.embeddingDimensions = queryEmbedding.length;

            // Build query with timing
            const queryBuildStart = Date.now();
            const { sql, params } = this._buildQuery(queryEmbedding, filters, limit, { debug: true });
            debugInfo.queryBuildTime = Date.now() - queryBuildStart;
            debugInfo.sql = sql.replace(/\s+/g, ' ').trim();
            debugInfo.paramCount = params.length;

            // Execute query with timing
            const dbStart = Date.now();
            const results = await this.db.queryWithParams(sql, params);
            debugInfo.dbTime = Date.now() - dbStart;
            debugInfo.resultCount = results.length;

            // Post-process with timing
            const postProcessStart = Date.now();
            const processedResults = await this._postProcessResults(results, filters, { debug: true });
            debugInfo.postProcessTime = Date.now() - postProcessStart;
            debugInfo.finalResultCount = processedResults.length;

            debugInfo.totalTime = Date.now() - debugInfo.startTime;

            return {
                results: processedResults,
                debug: debugInfo
            };

        } catch (error) {
            debugInfo.error = error.message;
            debugInfo.totalTime = Date.now() - debugInfo.startTime;
            
            return {
                results: [],
                debug: debugInfo
            };
        }
    }
}

module.exports = HybridRetriever;