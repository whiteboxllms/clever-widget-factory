#!/bin/bash

# Update Lambda IAM role to grant SSM Parameter Store permissions
# This replaces Secrets Manager permissions with SSM permissions

set -e

FUNCTION_NAME="cwf-image-auth"
REGION="us-west-2"
PARAMETER_NAME="/cloudfront/private-key"

echo "=========================================="
echo "Update IAM Permissions for $FUNCTION_NAME"
echo "=========================================="
echo ""

# Get Lambda function's execution role
echo "Getting Lambda execution role..."
ROLE_NAME=$(aws lambda get-function \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --query 'Configuration.Role' \
  --output text | awk -F'/' '{print $NF}')

if [ -z "$ROLE_NAME" ]; then
  echo "❌ Error: Could not find execution role for Lambda function"
  exit 1
fi

echo "✓ Found execution role: $ROLE_NAME"
echo ""

# Create inline policy for SSM Parameter Store access
POLICY_NAME="SSMParameterStoreAccess"

echo "Creating IAM policy for SSM Parameter Store access..."
cat > /tmp/ssm-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:${REGION}:*:parameter${PARAMETER_NAME}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.${REGION}.amazonaws.com"
        }
      }
    }
  ]
}
EOF

echo "✓ Policy document created"
echo ""

# Attach inline policy to role
echo "Attaching policy to role..."
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name $POLICY_NAME \
  --policy-document file:///tmp/ssm-policy.json

echo "✓ Policy attached successfully"
echo ""

# Clean up
rm /tmp/ssm-policy.json

echo "=========================================="
echo "✅ IAM Permissions Updated Successfully"
echo "=========================================="
echo ""
echo "Summary:"
echo "  Role: $ROLE_NAME"
echo "  Policy: $POLICY_NAME"
echo "  Permissions:"
echo "    - ssm:GetParameter on $PARAMETER_NAME"
echo "    - kms:Decrypt for SSM SecureString decryption"
echo ""
echo "The Lambda function can now read the CloudFront private key from SSM."
echo ""
