const fs = require('fs');
const { execSync } = require('child_process');

const sql = fs.readFileSync('migration_policy_agreement.sql', 'utf8');
const payload = JSON.stringify({ sql });

const command = `aws lambda invoke --function-name cwf-db-migration --payload '${payload}' response.json --region us-west-2`;

try {
  execSync(command, { stdio: 'inherit' });
  const response = JSON.parse(fs.readFileSync('response.json', 'utf8'));
  console.log('Migration result:', response);
} catch (error) {
  console.error('Migration failed:', error.message);
}