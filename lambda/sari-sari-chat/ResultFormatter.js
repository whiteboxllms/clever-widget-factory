/**
 * ResultFormatter - Converts SQL rows to structured product results
 */

class ResultFormatter {
  /**
   * Format database rows into product results
   * @param {Array} rows - Database rows
   * @returns {Array} Formatted product results
   */
  static formatProducts(rows) {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      policy: row.policy || '', // Include policy field for health benefits/usage
      price: parseFloat(row.cost_per_unit || 0),
      stock_level: row.current_quantity || 0,
      in_stock: row.current_quantity > 0,
      status_label: row.current_quantity > 0 ? 'In stock' : 'Out of stock',
      similarity_score: row.similarity ? parseFloat(row.similarity.toFixed(4)) : null,
      unit: row.unit,
      image_url: row.image_url,
      embedding_source: row.embedding_source || null // For debugging unified embeddings
    }));
  }
}

module.exports = { ResultFormatter };
