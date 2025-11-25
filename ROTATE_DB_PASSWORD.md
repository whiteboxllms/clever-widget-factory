# Database Password Rotation Guide

## New Password
**Password:** `8T!$T5#N4q0%5j`

## Step 1: Update Database Password

### Option A: Via AWS RDS Console (Recommended)

1. Go to [AWS RDS Console](https://console.aws.amazon.com/rds/)
2. Select your database instance: `cwf-dev-postgres`
3. Click **"Modify"**
4. Scroll to **"Master password"**
5. Enter new password: `8T!$T5#N4q0%5j`
6. Click **"Continue"**
7. Choose **"Apply immediately"**
8. Click **"Modify DB instance"**

**Note:** The database will be briefly unavailable during the password change.

### Option B: Via psql (Direct Connection)

```bash
# Connect to database (using old password)
psql -h cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com \
     -U postgres \
     -d postgres

# Change password
ALTER USER postgres WITH PASSWORD '8T!$T5#N4q0%5j';

# Exit
\q
```

### Option C: Via AWS CLI

```bash
aws rds modify-db-instance \
  --db-instance-identifier cwf-dev-postgres \
  --master-user-password '8T!$T5#N4q0%5j' \
  --apply-immediately \
  --region us-west-2
```

## Step 2: Update Lambda Functions

### Quick Method: Use the Script

```bash
./update-lambda-passwords.sh
```

### Manual Method: Update Each Function

```bash
# Set variables
NEW_PASSWORD="8T!\$T5#N4q0%5j"
REGION="us-west-2"

# Update core Lambda
aws lambda update-function-configuration \
  --function-name cwf-core-lambda \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD,DB_HOST=cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com,DB_PORT=5432,DB_NAME=postgres,DB_USER=postgres}"

# Update actions Lambda
aws lambda update-function-configuration \
  --function-name cwf-actions-lambda \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD,DB_HOST=cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com,DB_PORT=5432,DB_NAME=postgres,DB_USER=postgres}"

# Update authorizer Lambda
aws lambda update-function-configuration \
  --function-name cwf-api-authorizer \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD,DB_HOST=cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com,DB_PORT=5432,DB_NAME=postgres,DB_USER=postgres}"

# Update organization Lambda
aws lambda update-function-configuration \
  --function-name cwf-organization-lambda \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD,DB_HOST=cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com,DB_PORT=5432,DB_NAME=postgres,DB_USER=postgres}"

# Update db-migration Lambda
aws lambda update-function-configuration \
  --function-name cwf-db-migration \
  --region "$REGION" \
  --environment "Variables={DB_PASSWORD=$NEW_PASSWORD,DB_HOST=cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com,DB_PORT=5432,DB_NAME=postgres,DB_USER=postgres}"
```

## Step 3: Update API Server (if applicable)

If you have a local API server (`api/server.js`), update the environment variable:

```bash
export RDS_PASSWORD="8T!\$T5#N4q0%5j"
```

Or add to your `.env` file:
```
RDS_PASSWORD=8T!$T5#N4q0%5j
```

## Step 4: Verify

### Test Lambda Function

```bash
# Test a Lambda function
aws lambda invoke \
  --function-name cwf-core-lambda \
  --region us-west-2 \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  response.json

cat response.json
```

### Test Database Connection

```bash
# Test connection with new password
psql -h cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com \
     -U postgres \
     -d postgres \
     -c "SELECT version();"
```

## Important Notes

1. **Order Matters**: Update the database password FIRST, then update Lambda functions
2. **Brief Downtime**: There will be a brief period where Lambda functions can't connect (between password change and Lambda update)
3. **Test Immediately**: After updating, test that your application still works
4. **Monitor Logs**: Check CloudWatch logs for any connection errors

## Troubleshooting

### Error: "password authentication failed"

- Verify the password was updated correctly in RDS
- Check that Lambda environment variables match exactly
- Ensure special characters are properly escaped

### Error: "Connection timeout"

- Check security groups allow Lambda to connect to RDS
- Verify RDS instance is running
- Check VPC configuration

### Lambda functions still using old password

- Wait a few seconds for Lambda configuration to propagate
- Check CloudWatch logs for the actual error
- Verify environment variables were set correctly

## Security Checklist

- [ ] Database password changed in RDS
- [ ] All Lambda functions updated with new password
- [ ] API server updated (if applicable)
- [ ] Tested database connection
- [ ] Tested Lambda functions
- [ ] Monitored CloudWatch logs for errors
- [ ] Verified application still works
- [ ] Documented new password in secure location (password manager)

## Password Storage

**DO NOT:**
- ❌ Commit password to git
- ❌ Store in plain text files
- ❌ Share via email/Slack

**DO:**
- ✅ Store in password manager (1Password, LastPass, etc.)
- ✅ Use environment variables in Lambda
- ✅ Use AWS Secrets Manager for production (future improvement)


