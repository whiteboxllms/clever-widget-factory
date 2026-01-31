const escapeLiteral = (value = '') => String(value).replace(/'/g, "''");

const formatSqlValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'ARRAY[]::text[]';
    const sanitizedItems = value.map((item) => `'${escapeLiteral(String(item))}'`);
    return `ARRAY[${sanitizedItems.join(', ')}]`;
  }
  if (typeof value === 'object') {
    return `'${escapeLiteral(JSON.stringify(value))}'::jsonb`;
  }
  return `'${escapeLiteral(String(value))}'`;
};

const buildUpdateClauses = (body, allowedFields) => {
  return allowedFields.reduce((clauses, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      clauses.push(`${field} = ${formatSqlValue(body[field])}`);
    }
    return clauses;
  }, []);
};

module.exports = {
  escapeLiteral,
  formatSqlValue,
  buildUpdateClauses
};
