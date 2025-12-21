/**
 * SearchLogger utility for structured logging throughout the search pipeline
 * Provides consistent logging format and methods for debugging and monitoring
 */
class SearchLogger {
    /**
     * Creates a new SearchLogger instance
     * @param {string} request_id - Unique request identifier for correlation
     * @param {boolean} debug_enabled - Whether debug logging is enabled
     */
    constructor(request_id, debug_enabled = false) {
        this.request_id = request_id;
        this.debug_enabled = debug_enabled;
        this.start_time = Date.now();
        this.step_times = {};
    }

    /**
     * Logs a search request
     * @param {string} raw_query - The original user query
     * @param {Object} request_params - Additional request parameters
     */
    logSearchRequest(raw_query, request_params = {}) {
        this._log('search_request', {
            raw_query,
            request_params,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Logs query rewriting results
     * @param {Object} query_components - The parsed QueryComponents
     * @param {string} original_query - Original query string
     * @param {Object} extraction_details - Details about extraction process
     */
    logQueryRewriting(query_components, original_query, extraction_details = {}) {
        this._log('query_rewriting', {
            original_query,
            parsed_query: query_components.toObject(),
            extraction_details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Logs filter mapping results
     * @param {Object} sql_filter_params - The mapped SqlFilterParams
     * @param {Object} query_components - Source QueryComponents
     */
    logFilterMapping(sql_filter_params, query_components) {
        this._log('filter_mapping', {
            input_constraints: query_components.toObject(),
            output_filters: sql_filter_params.toObject(),
            mapping_decisions: this._analyzeFilterMapping(query_components, sql_filter_params),
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Logs SQL query generation and execution
     * @param {string} sql_query - The generated SQL query
     * @param {Object} query_params - SQL parameters
     * @param {number} result_count - Number of results returned
     * @param {number} execution_time_ms - Query execution time
     */
    logSqlExecution(sql_query, query_params, result_count, execution_time_ms) {
        this._log('sql_execution', {
            sql_query: this._sanitizeSql(sql_query),
            query_params: this._sanitizeParams(query_params),
            result_count,
            execution_time_ms,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Logs negation filtering decisions
     * @param {string} negated_term - The term being filtered
     * @param {Array} evaluated_products - Products that were evaluated
     * @param {Array} excluded_products - Products that were excluded
     * @param {number} similarity_threshold - Threshold used for exclusion
     */
    logNegationFiltering(negated_term, evaluated_products, excluded_products, similarity_threshold) {
        this._log('negation_filtering', {
            negated_term,
            evaluated_count: evaluated_products.length,
            excluded_count: excluded_products.length,
            similarity_threshold,
            excluded_products: excluded_products.map(p => ({
                id: p.id,
                name: p.name,
                similarity_score: p.similarity_score,
                exclusion_reason: `Matches negated term "${negated_term}"`
            })),
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Logs pipeline step execution
     * @param {string} step_name - Name of the pipeline step
     * @param {string} status - Status (started, completed, failed)
     * @param {number} duration_ms - Step execution time
     * @param {Object} step_data - Additional step data
     */
    logPipelineStep(step_name, status, duration_ms = null, step_data = {}) {
        const log_entry = {
            step_name,
            status,
            step_data,
            timestamp: new Date().toISOString()
        };

        if (duration_ms !== null) {
            log_entry.duration_ms = duration_ms;
            this.step_times[step_name] = duration_ms;
        }

        this._log('pipeline_step', log_entry);
    }

    /**
     * Logs final search results and summary
     * @param {Object} search_response - The SearchResponse object
     * @param {number} total_duration_ms - Total request duration
     */
    logSearchResults(search_response, total_duration_ms) {
        const summary = search_response.getSummary();
        
        this._log('search_results', {
            result_summary: summary,
            total_duration_ms,
            step_durations: this.step_times,
            filters_applied: search_response.filters_applied.getDetailedFilterInfo(),
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Logs an error that occurred during processing
     * @param {string} error_type - Type of error
     * @param {Error} error - The error object
     * @param {Object} context - Additional context about the error
     */
    logError(error_type, error, context = {}) {
        this._log('error', {
            error_type,
            error_message: error.message,
            error_stack: this.debug_enabled ? error.stack : undefined,
            context,
            timestamp: new Date().toISOString()
        }, 'ERROR');
    }

    /**
     * Gets comprehensive logging summary for debug response
     * @returns {Object} Complete logging summary
     */
    getLoggingSummary() {
        return {
            request_id: this.request_id,
            total_duration_ms: Date.now() - this.start_time,
            step_durations: this.step_times,
            debug_enabled: this.debug_enabled
        };
    }

    /**
     * Internal logging method
     * @private
     * @param {string} event_type - Type of event being logged
     * @param {Object} data - Event data
     * @param {string} level - Log level (INFO, ERROR, DEBUG)
     */
    _log(event_type, data, level = 'INFO') {
        const log_entry = {
            timestamp: new Date().toISOString(),
            request_id: this.request_id,
            event_type,
            level,
            ...data
        };

        // In production, this would go to CloudWatch or another logging service
        console.log(JSON.stringify(log_entry));
    }

    /**
     * Analyzes filter mapping decisions
     * @private
     * @param {Object} query_components - Input QueryComponents
     * @param {Object} sql_filter_params - Output SqlFilterParams
     * @returns {Object} Analysis of mapping decisions
     */
    _analyzeFilterMapping(query_components, sql_filter_params) {
        return {
            price_mapping: {
                min_mapped: query_components.price_min === sql_filter_params.min_price,
                max_mapped: query_components.price_max === sql_filter_params.max_price,
                range_preserved: this._isPriceRangePreserved(query_components, sql_filter_params)
            },
            negation_mapping: {
                terms_mapped: JSON.stringify(query_components.negated_terms) === JSON.stringify(sql_filter_params.excluded_terms),
                term_count: {
                    input: query_components.negated_terms ? query_components.negated_terms.length : 0,
                    output: sql_filter_params.excluded_terms ? sql_filter_params.excluded_terms.length : 0
                }
            }
        };
    }

    /**
     * Checks if price range is preserved in mapping
     * @private
     * @param {Object} query_components - Input QueryComponents
     * @param {Object} sql_filter_params - Output SqlFilterParams
     * @returns {boolean} Whether price range is preserved
     */
    _isPriceRangePreserved(query_components, sql_filter_params) {
        return query_components.price_min === sql_filter_params.min_price &&
               query_components.price_max === sql_filter_params.max_price;
    }

    /**
     * Sanitizes SQL query for logging (removes sensitive data)
     * @private
     * @param {string} sql - SQL query string
     * @returns {string} Sanitized SQL
     */
    _sanitizeSql(sql) {
        // In production, you might want to remove or mask sensitive parts
        return sql;
    }

    /**
     * Sanitizes query parameters for logging
     * @private
     * @param {Object} params - Query parameters
     * @returns {Object} Sanitized parameters
     */
    _sanitizeParams(params) {
        // In production, you might want to remove or mask sensitive parameters
        return params;
    }
}

module.exports = SearchLogger;