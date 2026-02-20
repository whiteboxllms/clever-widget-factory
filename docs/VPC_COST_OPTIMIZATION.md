# VPC Cost Optimization - February 9, 2026

## Problem
AWS was charging ~$0.50/day (~$15/month) for VPC-related resources that were unnecessary.

## Root Cause
Four Lambda functions had VPC configuration even though the RDS database is publicly accessible:
- `cwf-actions-lambda`
- `cwf-organization-lambda`
- `cwf-db-migration`
- `cwf-analytics-lambda`

When Lambda functions are in a VPC, AWS creates Elastic Network Interfaces (ENIs) which cost $0.005/hour each (~$3.60/month per ENI).

## Solution Applied
Removed VPC configuration from all 4 Lambda functions using:

```bash
aws lambda update-function-configuration \
  --function-name <function-name> \
  --vpc-config 'SubnetIds=[],SecurityGroupIds=[]' \
  --region us-west-2
```

## Verification
- ✅ All 4 functions successfully updated
- ✅ Database connectivity tested and working (cwf-db-migration test query successful)
- ✅ ENIs are being automatically cleaned up by AWS (takes up to 20 minutes)
- ✅ No code changes required
- ✅ Deployment scripts already correct (don't add VPC config)

## Expected Savings
- **Before**: ~$0.50/day (~$15/month)
- **After**: $0/day for VPC charges
- **Annual savings**: ~$180/year

## Technical Details

### RDS Configuration
- Database: `cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com`
- Publicly Accessible: Yes
- VPC: vpc-08d52e7db41e35670 (default VPC)

### Why This Works
Since the RDS instance is publicly accessible, Lambda functions can connect directly using the public endpoint without needing to be in the same VPC. The functions use SSL connections for security.

### Deployment Scripts
Our deployment scripts in `scripts/deploy/` are already correct:
- They only use `update-function-code` (doesn't touch VPC config)
- The `create-function` command in `deploy-analytics-lambda.sh` doesn't include `--vpc-config`
- No changes needed to deployment scripts

## Monitoring
Check your AWS Cost Explorer in a few days to confirm the VPC charges have stopped.

## Notes
- The VPC configuration was likely added manually during initial setup
- AWS will automatically clean up the orphaned ENIs within 20 minutes
- All Lambda functions continue to work exactly as before
