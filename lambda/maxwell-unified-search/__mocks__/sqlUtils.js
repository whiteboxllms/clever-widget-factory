// Mock for /opt/nodejs/sqlUtils Lambda layer dependency
// Replicates the minimal escapeLiteral behaviour: doubles single-quotes.
module.exports = {
  escapeLiteral: (str) => String(str).replace(/'/g, "''"),
};
