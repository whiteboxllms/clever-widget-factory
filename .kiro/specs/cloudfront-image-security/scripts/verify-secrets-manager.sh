#!/bin/bash

# CloudFront Private Key - Secrets Manager Verification Script
# This script verifies that the private key is correctly stored in AWS Secrets Manager

set -e

echo "=========================================="
echo "Secrets Manager Verification"
echo "=========================================="
echo ""

SECRET_NAME="cloudfront-private-key"
REGION="us-west-2"
TEMP_KEY="/tmp/retrieved-key.pem"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print success
print_success() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
}

# Function to print failure
print_failure() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    exit 1
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ WARNING${NC}: $1"
}

# 1. Check AWS CLI is installed
echo "1. Checking AWS CLI installation..."
if ! command -v aws &> /dev/null; then
    print_failure "AWS CLI is not installed. Install it from https://aws.amazon.com/cli/"
fi
print_success "AWS CLI is installed"

# 2. Check AWS credentials are configured
echo "2. Checking AWS credentials..."
if ! aws sts get-caller-identity --region $REGION &> /dev/null; then
    print_failure "AWS credentials not configured or invalid. Run 'aws configure'"
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_success "AWS credentials valid (Account: $ACCOUNT_ID)"

# 3. Check if secret exists
echo "3. Checking if secret exists in Secrets Manager..."
if ! aws secretsmanager describe-secret --secret-id $SECRET_NAME --region $REGION &> /dev/null; then
    print_failure "Secret '$SECRET_NAME' not found in region $REGION"
fi
print_success "Secret '$SECRET_NAME' exists"

# 4. Get secret metadata
echo "4. Retrieving secret metadata..."
SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id $SECRET_NAME \
    --region $REGION \
    --query 'ARN' \
    --output text)
CREATED_DATE=$(aws secretsmanager describe-secret \
    --secret-id $SECRET_NAME \
    --region $REGION \
    --query 'CreatedDate' \
    --output text)
print_success "Secret ARN: $SECRET_ARN"
echo "   Created: $CREATED_DATE"

# 5. Retrieve secret value
echo "5. Retrieving secret value..."
if ! aws secretsmanager get-secret-value \
    --secret-id $SECRET_NAME \
    --region $REGION \
    --query 'SecretString' \
    --output text > $TEMP_KEY 2>/dev/null; then
    print_failure "Failed to retrieve secret value. Check IAM permissions."
fi
print_success "Secret value retrieved"

# 6. Check PEM format
echo "6. Checking PEM format..."
if ! grep -q "BEGIN RSA PRIVATE KEY" $TEMP_KEY; then
    print_failure "Secret does not contain valid PEM format (missing BEGIN RSA PRIVATE KEY)"
fi
if ! grep -q "END RSA PRIVATE KEY" $TEMP_KEY; then
    print_failure "Secret does not contain valid PEM format (missing END RSA PRIVATE KEY)"
fi
print_success "PEM format is valid"

# 7. Verify RSA key integrity
echo "7. Verifying RSA key integrity..."
if ! openssl rsa -in $TEMP_KEY -check -noout 2>/dev/null; then
    print_failure "RSA key integrity check failed. Key may be corrupted."
fi
print_success "RSA key integrity verified"

# 8. Extract key information
echo "8. Extracting key information..."
KEY_SIZE=$(openssl rsa -in $TEMP_KEY -text -noout 2>/dev/null | grep "Private-Key:" | awk '{print $2}')
print_success "Key size: $KEY_SIZE"

# 9. Compare with local key (if exists)
echo "9. Comparing with local key..."
LOCAL_KEY=".keys/cloudfront-private-key.pem"
if [ -f "$LOCAL_KEY" ]; then
    if diff -q $TEMP_KEY $LOCAL_KEY > /dev/null 2>&1; then
        print_success "Stored key matches local key"
    else
        print_warning "Stored key differs from local key. This may be expected if you updated the secret."
    fi
else
    print_warning "Local key not found at $LOCAL_KEY (this is OK if you've already deleted it)"
fi

# 10. Test Lambda IAM permissions (simulate)
echo "10. Checking IAM permissions for Lambda access..."
# Note: This checks if the current user can access the secret
# Lambda will need similar permissions via its execution role
if aws secretsmanager get-secret-value \
    --secret-id $SECRET_NAME \
    --region $REGION \
    --query 'SecretString' \
    --output text > /dev/null 2>&1; then
    print_success "IAM permissions allow secret access"
else
    print_failure "IAM permissions insufficient. Lambda will need secretsmanager:GetSecretValue"
fi

# 11. Check secret rotation configuration
echo "11. Checking secret rotation configuration..."
ROTATION_ENABLED=$(aws secretsmanager describe-secret \
    --secret-id $SECRET_NAME \
    --region $REGION \
    --query 'RotationEnabled' \
    --output text 2>/dev/null || echo "false")
if [ "$ROTATION_ENABLED" = "true" ]; then
    print_warning "Secret rotation is enabled. Ensure Lambda handles rotation gracefully."
else
    echo "   Secret rotation: disabled (manual rotation recommended every 90 days)"
fi

# Cleanup
rm -f $TEMP_KEY

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Secret Name: $SECRET_NAME"
echo "  Region: $REGION"
echo "  ARN: $SECRET_ARN"
echo "  Key Size: $KEY_SIZE"
echo ""
echo "Next Steps:"
echo "  1. Note the CloudFront Key Pair ID (Task 1.4)"
echo "  2. Verify key pair is active in CloudFront (Task 1.5)"
echo "  3. Create Cookie Generator Lambda with this secret (Task 6)"
echo ""
echo "Lambda Environment Variables:"
echo "  CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=$SECRET_NAME"
echo "  CLOUDFRONT_KEY_PAIR_ID=<from Task 1.4>"
echo "  CLOUDFRONT_DOMAIN=<from Task 5>"
echo ""
