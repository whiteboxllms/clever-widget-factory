# Task 1.4: Note the CloudFront Key Pair ID for Lambda Configuration

## What You Need to Do

Task 1.4 requires you to document the CloudFront Key Pair ID that was generated in Task 1.1. This ID will be used as an environment variable in the Cookie Generator Lambda function (Task 6) to sign CloudFront cookies.

## Prerequisites

- Task 1.1 completed (CloudFront key pair generated in AWS Console)
- Task 1.3 completed (private key stored in Secrets Manager)
- AWS CLI configured with credentials
- Access to AWS CloudFront Console

## Understanding the Key Pair ID

The **CloudFront Key Pair ID** is a unique identifier for your CloudFront public key. It looks like:
- Format: `APKAXXXXXXXXXX` (starts with "APKA" followed by alphanumeric characters)
- Example: `APKA2JXHY4EXAMPLE`

This ID is:
- **Public**: Safe to store in environment variables and configuration files
- **Required**: Lambda needs it to sign cookies that CloudFront can validate
- **Immutable**: Tied to the specific key pair you generated

## Method 1: Retrieve from AWS Console (Recommended)

### Step 1: Navigate to CloudFront Key Management

1. Open AWS Console: https://console.aws.amazon.com/cloudfront/
2. In the left sidebar, click **Key Management** (under "Security")
3. Look for the key pair you created in Task 1.1

### Step 2: Copy the Key Pair ID

You'll see a table with columns:
- **ID**: This is your Key Pair ID (e.g., `APKA2JXHY4EXAMPLE`)
- **Name**: The name you gave it (if any)
- **Status**: Should be "Active"
- **Created**: Timestamp when you created it

**Copy the ID value** - you'll need it for the next steps.

## Method 2: Retrieve via AWS CLI

Unfortunately, AWS CLI does not provide a direct command to list CloudFront key pairs for the root account. However, you can verify the key pair ID if you already know it:

```bash
# This command doesn't exist in AWS CLI v2:
# aws cloudfront list-public-keys --region us-east-1  # CloudFront is global, but uses us-east-1

# Instead, you must use the AWS Console (Method 1) or check your notes from Task 1.1
```

**Note**: CloudFront key pair management is only available through the AWS Console for root account keys. If you're using CloudFront public keys (newer method), you can list them via CLI, but that's not what we're using for this implementation.

## Method 3: Check Your Task 1.1 Notes

When you generated the key pair in Task 1.1, the Key Pair ID was displayed on the screen. Check:
- Your notes from Task 1.1
- The filename of the downloaded private key (may include the ID)
- Any screenshots you took during Task 1.1

## Step-by-Step Instructions

### 1. Retrieve Your Key Pair ID

Use Method 1 (AWS Console) to get your Key Pair ID. It should look like:
```
APKA2JXHY4EXAMPLE
```

### 2. Store the Key Pair ID in Configuration File

Create a configuration file to document the Key Pair ID:

```bash
# Navigate to the spec directory
cd .kiro/specs/cloudfront-image-security

# Create the configuration file
cat > cloudfront-config.env << 'EOF'
# CloudFront Configuration for Image Security
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# CloudFront Key Pair ID (from Task 1.1)
# This is the public key identifier used to sign cookies
# Format: APKAXXXXXXXXXX
CLOUDFRONT_KEY_PAIR_ID=REPLACE_WITH_YOUR_KEY_PAIR_ID

# Secrets Manager secret name (from Task 1.3)
CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=cloudfront-private-key

# CloudFront Distribution Domain (will be set in Task 5)
# Format: d1234567890.cloudfront.net
CLOUDFRONT_DOMAIN=PENDING_TASK_5

# Cookie expiration time in seconds (default: 1 hour)
COOKIE_EXPIRATION_SECONDS=3600

# AWS Region for Secrets Manager and Lambda
AWS_REGION=us-west-2
EOF
```

### 3. Update the Configuration File with Your Key Pair ID

Edit the file and replace `REPLACE_WITH_YOUR_KEY_PAIR_ID` with your actual Key Pair ID:

```bash
# Open the file in your editor
nano cloudfront-config.env

# Or use sed to replace it directly
sed -i 's/REPLACE_WITH_YOUR_KEY_PAIR_ID/APKA2JXHY4EXAMPLE/' cloudfront-config.env
```

**Replace `APKA2JXHY4EXAMPLE` with your actual Key Pair ID!**

### 4. Verify the Configuration File

```bash
# View the configuration file
cat cloudfront-config.env
```

**Expected Output:**
```bash
# CloudFront Configuration for Image Security
# Generated: 2024-01-15 12:00:00 UTC

# CloudFront Key Pair ID (from Task 1.1)
CLOUDFRONT_KEY_PAIR_ID=APKA2JXHY4EXAMPLE

# Secrets Manager secret name (from Task 1.3)
CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=cloudfront-private-key

# CloudFront Distribution Domain (will be set in Task 5)
CLOUDFRONT_DOMAIN=PENDING_TASK_5

# Cookie expiration time in seconds (default: 1 hour)
COOKIE_EXPIRATION_SECONDS=3600

# AWS Region for Secrets Manager and Lambda
AWS_REGION=us-west-2
```

### 5. Document the Key Pair ID in README

Update the main documentation:

```bash
# Add Key Pair ID to the README
cat >> .kiro/specs/cloudfront-image-security/scripts/README.md << EOF

## CloudFront Key Pair ID

**Key Pair ID**: \`APKA2JXHY4EXAMPLE\` (replace with your actual ID)

This ID is used in:
- Cookie Generator Lambda environment variable: \`CLOUDFRONT_KEY_PAIR_ID\`
- CloudFront signed cookie: \`CloudFront-Key-Pair-Id\` cookie value
- CloudFront distribution trusted signers configuration

**Location**: Stored in \`cloudfront-config.env\` for reference
EOF
```

## How Lambda Will Use the Key Pair ID

When creating the Cookie Generator Lambda (Task 6), you'll set this environment variable:

```bash
# Lambda environment variables
CLOUDFRONT_KEY_PAIR_ID=APKA2JXHY4EXAMPLE
CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=cloudfront-private-key
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
COOKIE_EXPIRATION_SECONDS=3600
```

The Lambda function will use it like this:

```javascript
// Lambda code snippet
const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;

// Include in signed cookie response
const cookies = [
  `CloudFront-Policy=${encodedPolicy}; ...`,
  `CloudFront-Signature=${signature}; ...`,
  `CloudFront-Key-Pair-Id=${keyPairId}; ...`  // <-- Key Pair ID used here
];
```

## CloudFront Cookie Structure

The three cookies that will be generated:

1. **CloudFront-Policy**: Base64-encoded JSON policy (what resources can be accessed)
2. **CloudFront-Signature**: RSA-SHA1 signature of the policy (proves authenticity)
3. **CloudFront-Key-Pair-Id**: Your Key Pair ID (tells CloudFront which public key to use for verification)

CloudFront will:
1. Read the `CloudFront-Key-Pair-Id` cookie
2. Look up the corresponding public key in its trusted signers
3. Use that public key to verify the `CloudFront-Signature`
4. If valid, grant access according to the `CloudFront-Policy`

## Security Considerations

### Key Pair ID is Public
- ✅ Safe to store in environment variables
- ✅ Safe to commit to git (in configuration files)
- ✅ Safe to include in CloudFront cookies (sent to browser)
- ✅ Safe to log in CloudWatch

### Private Key is Secret
- ❌ Never store in environment variables
- ❌ Never commit to git
- ❌ Never send to browser
- ❌ Never log in CloudWatch
- ✅ Only store in AWS Secrets Manager

## Verification Checklist

Before proceeding to Task 1.5, ensure:

- [ ] You have retrieved your CloudFront Key Pair ID from AWS Console
- [ ] Key Pair ID format is correct (starts with "APKA")
- [ ] Key Pair ID is documented in `cloudfront-config.env`
- [ ] Configuration file is created and readable
- [ ] You understand how Lambda will use the Key Pair ID
- [ ] You understand the difference between Key Pair ID (public) and private key (secret)

## Troubleshooting

### Problem: Can't find Key Pair ID in AWS Console

**Solution**: 
1. Go to CloudFront Console: https://console.aws.amazon.com/cloudfront/
2. Click "Key Management" in the left sidebar
3. If you don't see any key pairs, you may need to complete Task 1.1 first
4. If you see multiple key pairs, look for the one created most recently

### Problem: Key Pair ID format doesn't match

**Solution**: CloudFront Key Pair IDs always start with "APKA" followed by alphanumeric characters. If yours looks different, you may be looking at:
- A CloudFront distribution ID (starts with "E")
- An Origin Access Identity ID (starts with "E")
- A public key ID (different format, used with CloudFront public keys)

Make sure you're looking at the **Key Pair ID** in the Key Management section.

### Problem: Multiple key pairs exist

**Solution**: If you have multiple key pairs:
1. Check the "Created" timestamp to find the one from Task 1.1
2. Verify the private key filename matches the Key Pair ID
3. If unsure, you can test each one (only one will work with your private key)

### Problem: Lost the Key Pair ID

**Solution**: If you can't find the Key Pair ID:
1. Check the private key filename (may include the ID)
2. Check your notes from Task 1.1
3. If all else fails, generate a new key pair and start over from Task 1.1

## Cost Information

**No additional cost** - documenting the Key Pair ID is free. The Key Pair ID itself is just metadata.

## Next Steps

Once Task 1.4 is complete:
1. **Task 1.5**: Verify key pair is active in CloudFront
2. **Task 5**: Create CloudFront distribution (will reference this Key Pair ID)
3. **Task 6**: Create Cookie Generator Lambda (will use this Key Pair ID as environment variable)

## Quick Reference

### Configuration File Location
```
.kiro/specs/cloudfront-image-security/cloudfront-config.env
```

### Lambda Environment Variable
```bash
CLOUDFRONT_KEY_PAIR_ID=APKA2JXHY4EXAMPLE
```

### CloudFront Cookie Name
```
CloudFront-Key-Pair-Id
```

### AWS Console Location
```
CloudFront → Key Management → Key Pairs
```

---

**Task Status**: Ready to execute  
**Estimated Time**: 5 minutes  
**Prerequisites**: Task 1.1, Task 1.3 completed  
**AWS Services**: CloudFront (Key Management)  
**Output**: `cloudfront-config.env` file with Key Pair ID documented
