const { query } = require('../../shared/db');
const { Client } = require('pg');

/**
 * Enhanced database service for semantic search pipeline
 * Extends the existing shared database service with vector operations and parameterized queries
 */
class EnhancedDatabaseService {
    constructor() {
        this.dbConfig = {
            host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            ssl: {
                rejectUnauthorized: false
            }
        };
    }

    /**
     * Executes a parameterized query (safer than the shared db.query)
     * @param {string} sql - SQL query with parameter placeholders ($1, $2, etc.)
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} Query result rows
     */
    async queryWithParams(sql, params = []) {
        const client = new Client(this.dbConfig);
        try {
            await client.connect();
            const result = await client.query(sql, params);
            return result.rows;
        } catch (error) {
            console.error('Database query error:', {
                sql: sql.substring(0, 200),
                paramCount: params.length,
                error: error.message
            });
            throw error;
        } finally {
            await client.end();
        }
    }

    /**
     * Executes a vector similarity search query
     * @param {string} semanticQuery - The semantic search terms
     * @param {Array} queryEmbedding - The query embedding vector
     * @param {Object} filters - Filter parameters
     * @param {number} limit - Maximum number of results
     * @returns {Promise<Array>} Search results
     */
    async vectorSearch(semanticQuery, queryEmbedding, filters = {}, limit = 20) {
        const { min_price, max_price, excluded_terms } = filters;

        // Build the SQL query with vector similarity
        let sql = `
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

        const params = [JSON.stringify(queryEmbedding)];
        let paramIndex = 2;

        // Add price filters
        if (min_price !== null && min_price !== undefined) {
            sql += ` AND price >= $${paramIndex}`;
            params.push(min_price);
            paramIndex++;
        }

        if (max_price !== null && max_price !== undefined) {
            sql += ` AND price <= $${paramIndex}`;
            params.push(max_price);
            paramIndex++;
        }

        // Add exclusion filters (simplified - would need more sophisticated implementation)
        if (excluded_terms && excluded_terms.length > 0) {
            // For now, use simple text matching - could be enhanced with vector similarity
            const exclusionConditions = excluded_terms.map(() => {
                const condition = `description NOT ILIKE $${paramIndex}`;
                paramIndex++;
                return condition;
            });
            sql += ` AND ${exclusionConditions.join(' AND ')}`;
            excluded_terms.forEach(term => params.push(`%${term}%`));
        }

        // Order by stock level (in-stock first) then by similarity
        sql += `
            ORDER BY 
                (stock_level > 0) DESC,
                embedding <=> $1
            LIMIT $${paramIndex}
        `;
        params.push(limit);

        return this.queryWithParams(sql, params);
    }

    /**
     * Validates that the products table has the required schema
     * @returns {Promise<Object>} Schema validation result
     */
    async validateSchema() {
        try {
            // Check if products table exists with required columns
            const schemaQuery = `
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'products' 
                AND column_name IN ('id', 'name', 'description', 'price', 'stock_level', 'is_active', 'embedding')
                ORDER BY column_name
            `;

            const columns = await this.queryWithParams(schemaQuery);
            
            const requiredColumns = ['id', 'name', 'description', 'price', 'stock_level', 'is_active', 'embedding'];
            const foundColumns = columns.map(col => col.column_name);
            const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

            // Check if pgvector extension is available
            const extensionQuery = `
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'vector'
                ) as has_vector_extension
            `;
            const extensionResult = await this.queryWithParams(extensionQuery);
            const hasVectorExtension = extensionResult[0]?.has_vector_extension || false;

            return {
                valid: missingColumns.length === 0 && hasVectorExtension,
                foundColumns,
                missingColumns,
                hasVectorExtension,
                details: {
                    columnsFound: foundColumns.length,
                    columnsRequired: requiredColumns.length,
                    vectorExtensionAvailable: hasVectorExtension
                }
            };
        } catch (error) {
            console.error('Schema validation error:', error.message);
            return {
                valid: false,
                error: error.message,
                foundColumns: [],
                missingColumns: ['unknown'],
                hasVectorExtension: false
            };
        }
    }

    /**
     * Fallback to the existing shared database service for simple queries
     * @param {string} sql - SQL query string
     * @returns {Promise<Array>} Query result rows
     */
    async simpleQuery(sql) {
        return query(sql);
    }

    /**
     * Tests the database connection
     * @returns {Promise<boolean>} True if connection is successful
     */
    async testConnection() {
        try {
            const result = await this.queryWithParams('SELECT 1 as test');
            return result.length > 0 && result[0].test === 1;
        } catch (error) {
            console.error('Database connection test failed:', error.message);
            return false;
        }
    }
}

module.exports = EnhancedDatabaseService;