/**
 * ProductResult data model for individual product search results
 * Represents a single product in search results with all required fields
 */
class ProductResult {
    /**
     * Creates a new ProductResult instance
     * @param {string} id - Product ID (required)
     * @param {string} name - Product name (required)
     * @param {string|null} description - Product description (optional)
     * @param {number} price - Product price (required, non-negative)
     * @param {number} stock_level - Stock level (required, non-negative integer)
     * @param {boolean} in_stock - Whether product is in stock (required)
     * @param {string} status_label - Stock status label (required)
     * @param {number} similarity_score - Semantic similarity score (required, 0-1)
     */
    constructor(id, name, description, price, stock_level, in_stock, status_label, similarity_score) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.price = price;
        this.stock_level = stock_level;
        this.in_stock = in_stock;
        this.status_label = status_label;
        this.similarity_score = similarity_score;
        
        // Validate the instance after construction
        this._validate();
    }

    /**
     * Validates the ProductResult instance
     * @private
     * @throws {Error} If validation fails
     */
    _validate() {
        // Validate id (required string)
        if (!this.id || typeof this.id !== 'string') {
            throw new Error('id is required and must be a non-empty string');
        }

        // Validate name (required string)
        if (!this.name || typeof this.name !== 'string') {
            throw new Error('name is required and must be a non-empty string');
        }

        // Validate description (optional string)
        if (this.description !== null && typeof this.description !== 'string') {
            throw new Error('description must be a string or null');
        }

        // Validate price (required non-negative number)
        if (typeof this.price !== 'number' || isNaN(this.price)) {
            throw new Error('price is required and must be a number');
        }
        if (this.price < 0) {
            throw new Error('price must be non-negative');
        }

        // Validate stock_level (required non-negative integer)
        if (typeof this.stock_level !== 'number' || isNaN(this.stock_level)) {
            throw new Error('stock_level is required and must be a number');
        }
        if (this.stock_level < 0 || !Number.isInteger(this.stock_level)) {
            throw new Error('stock_level must be a non-negative integer');
        }

        // Validate in_stock (required boolean)
        if (typeof this.in_stock !== 'boolean') {
            throw new Error('in_stock is required and must be a boolean');
        }

        // Validate status_label (required string)
        if (!this.status_label || typeof this.status_label !== 'string') {
            throw new Error('status_label is required and must be a non-empty string');
        }

        // Validate similarity_score (required number between 0 and 1)
        if (typeof this.similarity_score !== 'number' || isNaN(this.similarity_score)) {
            throw new Error('similarity_score is required and must be a number');
        }
        if (this.similarity_score < 0 || this.similarity_score > 1) {
            throw new Error('similarity_score must be between 0 and 1');
        }

        // Validate consistency between stock_level and in_stock
        const expectedInStock = this.stock_level > 0;
        if (this.in_stock !== expectedInStock) {
            throw new Error('in_stock must be consistent with stock_level (true if stock_level > 0, false otherwise)');
        }

        // Validate status_label consistency
        const expectedLabel = this.in_stock ? "In stock" : "Out of stock – available for pre-order";
        if (this.status_label !== expectedLabel) {
            throw new Error(`status_label must be "${expectedLabel}" for current stock status`);
        }
    }

    /**
     * Creates a ProductResult instance from a plain object
     * @param {Object} obj - Plain object with ProductResult properties
     * @returns {ProductResult} New ProductResult instance
     */
    static fromObject(obj) {
        return new ProductResult(
            obj.id,
            obj.name,
            obj.description,
            obj.price,
            obj.stock_level,
            obj.in_stock,
            obj.status_label,
            obj.similarity_score
        );
    }

    /**
     * Creates a ProductResult from database row data
     * @param {Object} row - Database row with product data
     * @returns {ProductResult} New ProductResult instance
     */
    static fromDatabaseRow(row) {
        const stock_level = parseInt(row.stock_level) || 0;
        const in_stock = stock_level > 0;
        const status_label = in_stock ? "In stock" : "Out of stock – available for pre-order";
        const similarity_score = parseFloat(row.similarity_score) || 0;

        return new ProductResult(
            row.id,
            row.name,
            row.description || null,
            parseFloat(row.price) || 0,
            stock_level,
            in_stock,
            status_label,
            similarity_score
        );
    }

    /**
     * Converts the ProductResult instance to a plain object
     * @returns {Object} Plain object representation
     */
    toObject() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            price: this.price,
            stock_level: this.stock_level,
            in_stock: this.in_stock,
            status_label: this.status_label,
            similarity_score: this.similarity_score
        };
    }
}

module.exports = ProductResult;