# Lambda Security Configuration

## Database Credentials

**IMPORTANT**: Database passwords are no longer hardcoded in source code. All Lambda functions require the `DB_PASSWORD` environment variable to be set.

### Required Environment Variables

All Lambda functions that connect to the database require:

- `DB_PASSWORD` (required) - PostgreSQL database password
- `DB_HOST` (optional) - Database hostname (defaults to dev RDS instance)
- `DB_PORT` (optional) - Database port (defaults to 5432)
- `DB_NAME` (optional) - Database name (defaults to 'postgres')
- `DB_USER` (optional) - Database user (defaults to 'postgres')

### Setting Environment Variables

#### Via AWS Console

1. Go to AWS Lambda Console
2. Select your Lambda function
3. Go to Configuration → Environment variables
4. Add `DB_PASSWORD` and other required variables

#### Via AWS CLI

```bash
aws lambda update-function-configuration \
  --function-name cwf-core-lambda \
  --environment Variables="{DB_PASSWORD=your-secure-password,DB_HOST=your-host,DB_PORT=5432,DB_NAME=postgres,DB_USER=postgres}" \
  --region us-west-2
```

#### Via Infrastructure as Code (Recommended)

Use AWS CloudFormation, Terraform, or AWS SAM to manage environment variables securely.

### Security Best Practices

1. **Never commit passwords to version control** - All passwords must be set via environment variables
2. **Use AWS Secrets Manager** - For production, consider storing credentials in AWS Secrets Manager
3. **Rotate passwords regularly** - Update environment variables when passwords are rotated
4. **Use IAM roles** - Ensure Lambda execution roles have minimal required permissions
5. **Enable encryption** - Use encrypted environment variables in Lambda

### Migration from Hardcoded Passwords

If you were previously using hardcoded passwords, you must now:

1. Set the `DB_PASSWORD` environment variable for all Lambda functions
2. Update deployment scripts to include environment variables
3. Verify functions work correctly after deployment

### Error Handling

If `DB_PASSWORD` is not set, Lambda functions will throw an error:
```
Error: DB_PASSWORD environment variable is required
```

This ensures that functions fail fast rather than using insecure defaults.


