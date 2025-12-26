/**
 * DebugInfo data model for debugging information in search responses
 * Contains detailed information about query processing for debugging purposes
 */
class DebugInfo {
    /**
     * Creates a new DebugInfo instance
     * @param {string} semantic_query - The processed semantic query string
     * @param {string} raw_sql - The generated SQL query
     * @param {Object} parsed_constraints - The parsed query constraints
     * @param {Object} execution_times - Execution times for each pipeline step
     * @param {Object} metadata - Additional metadata for debugging
     */
    constructor(semantic_query, raw_sql, parsed_constraints, execution_times = {}, metadata = {}) {
        this.semantic_query = semantic_query;
        this.raw_sql = raw_sql;
        this.parsed_constraints = parsed_constraints;
        this.execution_times = execution_times;
        this.metadata = metadata;
        
        // Enhanced logging structures for filter decisions
        this.filter_decisions = [];
        this.negation_decisions = [];
        this.excluded_products = [];
        this.pipeline_steps = [];
        
        // Validate the instance after construction
        this._validate();
    }

    /**
     * Validates the DebugInfo instance
     * @private
     * @throws {Error} If validation fails
     */
    _validate() {
        // Validate semantic_query (required string)
        if (typeof this.semantic_query !== 'string') {
            throw new Error('semantic_query must be a string');
        }

        // Validate raw_sql (required string)
        if (typeof this.raw_sql !== 'string') {
            throw new Error('raw_sql must be a string');
        }

        // Validate parsed_constraints (required object)
        if (typeof this.parsed_constraints !== 'object' || this.parsed_constraints === null) {
            throw new Error('parsed_constraints must be an object');
        }

        // Validate execution_times (optional object)
        if (typeof this.execution_times !== 'object' || this.execution_times === null) {
            throw new Error('execution_times must be an object');
        }

        // Validate metadata (optional object)
        if (typeof this.metadata !== 'object' || this.metadata === null) {
            throw new Error('metadata must be an object');
        }
    }

    /**
     * Creates a DebugInfo instance from a plain object
     * @param {Object} obj - Plain object with DebugInfo properties
     * @returns {DebugInfo} New DebugInfo instance
     */
    static fromObject(obj) {
        return new DebugInfo(
            obj.semantic_query,
            obj.raw_sql,
            obj.parsed_constraints,
            obj.execution_times || {},
            obj.metadata || {}
        );
    }

    /**
     * Converts the DebugInfo instance to a plain object
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            semantic_query: this.semantic_query,
            raw_sql: this.raw_sql,
            parsed_constraints: this.parsed_constraints,
            execution_times: this.execution_times,
            metadata: this.metadata,
            filter_decisions: this.filter_decisions,
            negation_decisions: this.negation_decisions,
            excluded_products: this.excluded_products,
            pipeline_steps: this.pipeline_steps
        };
    }

    /**
     * Adds execution time for a pipeline step
     * @param {string} step - The pipeline step name
     * @param {number} timeMs - Execution time in milliseconds
     */
    addExecutionTime(step, timeMs) {
        if (typeof step !== 'string') {
            throw new Error('step must be a string');
        }
        if (typeof timeMs !== 'number' || isNaN(timeMs) || timeMs < 0) {
            throw new Error('timeMs must be a non-negative number');
        }
        this.execution_times[step] = timeMs;
    }

    /**
     * Adds metadata entry
     * @param {string} key - The metadata key
     * @param {*} value - The metadata value
     */
    addMetadata(key, value) {
        if (typeof key !== 'string') {
            throw new Error('key must be a string');
        }
        this.metadata[key] = value;
    }

    /**
     * Gets total execution time across all steps
     * @returns {number} Total execution time in milliseconds
     */
    getTotalExecutionTime() {
        return Object.values(this.execution_times).reduce((total, time) => total + time, 0);
    }

    /**
     * Gets formatted execution summary
     * @returns {string} Formatted execution time summary
     */
    getExecutionSummary() {
        const total = this.getTotalExecutionTime();
        const steps = Object.entries(this.execution_times)
            .map(([step, time]) => `${step}: ${time}ms`)
            .join(', ');
        return `Total: ${total}ms (${steps})`;
    }

    /**
     * Logs a filter decision for debugging
     * @param {string} filter_type - Type of filter (e.g., 'price', 'negation', 'active')
     * @param {string} decision - The decision made
     * @param {string} reasoning - Why the decision was made
     * @param {Object} context - Additional context data
     */
    logFilterDecision(filter_type, decision, reasoning, context = {}) {
        this.filter_decisions.push({
            timestamp: new Date().toISOString(),
            filter_type,
            decision,
            reasoning,
            context
        });
    }

    /**
     * Logs a negation filtering decision
     * @param {string} negated_term - The term being negated
     * @param {string} product_id - Product being evaluated
     * @param {string} product_description - Product description
     * @param {number} similarity_score - Similarity to negated term
     * @param {boolean} excluded - Whether product was excluded
     * @param {string} reasoning - Reasoning for the decision
     */
    logNegationDecision(negated_term, product_id, product_description, similarity_score, excluded, reasoning) {
        this.negation_decisions.push({
            timestamp: new Date().toISOString(),
            negated_term,
            product_id,
            product_description: product_description?.substring(0, 100) + (product_description?.length > 100 ? '...' : ''),
            similarity_score,
            excluded,
            reasoning
        });
    }

    /**
     * Logs an excluded product for transparency
     * @param {string} product_id - Product ID
     * @param {string} product_name - Product name
     * @param {string} exclusion_reason - Why it was excluded
     * @param {Object} exclusion_context - Additional context
     */
    logExcludedProduct(product_id, product_name, exclusion_reason, exclusion_context = {}) {
        this.excluded_products.push({
            timestamp: new Date().toISOString(),
            product_id,
            product_name,
            exclusion_reason,
            exclusion_context
        });
    }

    /**
     * Logs a pipeline step execution
     * @param {string} step_name - Name of the pipeline step
     * @param {string} status - Status (started, completed, failed)
     * @param {Object} step_data - Data about the step execution
     */
    logPipelineStep(step_name, status, step_data = {}) {
        this.pipeline_steps.push({
            timestamp: new Date().toISOString(),
            step_name,
            status,
            step_data
        });
    }

    /**
     * Gets a summary of filter decisions
     * @returns {Object} Summary of all filter decisions
     */
    getFilterDecisionSummary() {
        const summary = {
            total_decisions: this.filter_decisions.length,
            by_type: {},
            negation_exclusions: this.negation_decisions.filter(d => d.excluded).length,
            total_excluded_products: this.excluded_products.length
        };

        // Count decisions by type
        this.filter_decisions.forEach(decision => {
            summary.by_type[decision.filter_type] = (summary.by_type[decision.filter_type] || 0) + 1;
        });

        return summary;
    }

    /**
     * Gets negation transparency message for customer feedback
     * @returns {string|null} Message about what was filtered out, or null if no negations
     */
    getNegationTransparencyMessage() {
        if (this.negation_decisions.length === 0) {
            return null;
        }

        const excludedTerms = [...new Set(
            this.negation_decisions
                .filter(d => d.excluded)
                .map(d => d.negated_term)
        )];

        const excludedCount = this.excluded_products.filter(p => 
            p.exclusion_reason.includes('negation')
        ).length;

        if (excludedTerms.length === 0) {
            return null;
        }

        return `We excluded ${excludedCount} products containing characteristics you wanted to avoid: ${excludedTerms.join(', ')}`;
    }
}

module.exports = DebugInfo;