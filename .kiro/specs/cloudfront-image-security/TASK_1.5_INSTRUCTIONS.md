# Task 1.5: Verify Key Pair is Active in CloudFront

## Overview

After documenting the CloudFront Key Pair ID in Task 1.4, we need to verify that the key pair is **active** and ready to use for signing cookies. This verification ensures that CloudFront will accept signed cookies created with this key pair.

## What "Active" Means

A CloudFront key pair can have two states:

- **Active**: The key pair is enabled and CloudFront will accept signed cookies/URLs created with it
- **Inactive**: The key pair is disabled and CloudFront will reject signed cookies/URLs (returns 403 Forbidden)

**Why this matters**: If you try to use an inactive key pair, all image requests will fail with 403 errors, even with valid signed cookies.

## Prerequisites

Before starting this task:

- [x] Task 1.1: CloudFront key pair generated
- [x] Task 1.2: Private key downloaded and verified
- [x] Task 1.3: Private key stored in Secrets Manager
- [x] Task 1.4: Key Pair ID documented in configuration

## Verification Methods

### Method 1: AWS Console (Recommended)

This is the easiest and most reliable method.

#### Step 1: Open CloudFront Console

1. Go to: https://console.aws.amazon.com/cloudfront/
2. Click **Key Management** in the left sidebar
3. You should see the **Public Keys** section

#### Step 2: Locate Your Key Pair

1. Find the key pair you created in Task 1.1
2. Look for the row with your Key Pair ID (starts with "APKA")
3. Check the **Status** column

#### Step 3: Verify Status

The status should show: **Active** ✅

If it shows **Inactive** ❌:
1. Click the checkbox next to the key pair
2. Click **Actions** → **Enable**
3. Confirm the action
4. Wait a few seconds for the status to update

#### Step 4: Verify Key Pair Details

Click on the Key Pair ID to view details:

- **ID**: Should match your documented Key Pair ID (e.g., `APKA2JXHY4EXAMPLE`)
- **Status**: Should be **Active**
- **Created**: Should show the date from Task 1.1
- **Public Key**: Should show the public key content (starts with `-----BEGIN PUBLIC KEY-----`)

### Method 2: AWS CLI

If you prefer command-line verification:

```bash
# Get your Key Pair ID from configuration
source .kiro/specs/cloudfront-image-security/cloudfront-config.env

# List all key pairs and check status
aws cloudfront list-public-keys \
  --query "PublicKeyList.Items[?Id=='$CLOUDFRONT_KEY_PAIR_ID'].[Id,Name,CreatedTime,Comment]" \
  --output table
```

**Expected output**:
```
-----------------------------------------------------------------
|                        ListPublicKeys                         |
+------------------+------------------+------------+------------+
|  APKA2JXHY4...   |  cwf-image-key   | 2024-01-15 |  Active    |
+------------------+------------------+------------+------------+
```

**Note**: The AWS CLI doesn't directly show the "Active/Inactive" status. If the key pair appears in the list, it's active. If it doesn't appear, it may have been deleted.

### Method 3: Automated Verification Script

We've created a script that checks the key pair status:

```bash
cd .kiro/specs/cloudfront-image-security
./scripts/verify-key-pair-active.sh
```

**Expected output**:
```
==========================================
CloudFront Key Pair Status Verification
==========================================

✅ Key Pair ID: APKA2JXHY4EXAMPLE
✅ Key Pair Status: Active
✅ Key Pair Created: 2024-01-15T10:30:00Z

==========================================
✅ Key pair is active and ready to use!
==========================================

Next Steps:
  • Task 2: Create Origin Access Identity
  • Task 5: Create CloudFront distribution
```

## Verification Checklist

Use this checklist to confirm the key pair is ready:

- [ ] Key pair appears in CloudFront Console → Key Management
- [ ] Status shows "Active" (not "Inactive")
- [ ] Key Pair ID matches the documented ID in `cloudfront-config.env`
- [ ] Public key content is visible in the console
- [ ] Created date matches when you generated the key pair (Task 1.1)
- [ ] No error messages when viewing key pair details

## Troubleshooting

### Issue: Key Pair Shows "Inactive"

**Cause**: The key pair was disabled (manually or by AWS)

**Solution**:
1. In CloudFront Console → Key Management
2. Select the inactive key pair
3. Click **Actions** → **Enable**
4. Verify status changes to "Active"

### Issue: Key Pair Not Found

**Cause**: The key pair may have been deleted or the Key Pair ID is incorrect

**Solution**:
1. Verify the Key Pair ID in `cloudfront-config.env` matches the console
2. If the key pair was deleted, you'll need to:
   - Generate a new key pair (repeat Task 1.1)
   - Store the new private key (repeat Task 1.3)
   - Update the Key Pair ID (repeat Task 1.4)

### Issue: Multiple Key Pairs Exist

**Cause**: You may have created multiple key pairs during testing

**Solution**:
1. Identify which key pair has the matching private key in Secrets Manager
2. Verify the Key Pair ID matches your configuration
3. Disable or delete unused key pairs to avoid confusion
4. **Important**: Only delete key pairs if you're certain they're not in use

### Issue: Can't Access CloudFront Console

**Cause**: Insufficient IAM permissions

**Solution**: Ensure your AWS user/role has these permissions:
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudfront:ListPublicKeys",
    "cloudfront:GetPublicKey",
    "cloudfront:UpdatePublicKey"
  ],
  "Resource": "*"
}
```

## What Happens Next

After verifying the key pair is active:

1. **Task 2**: Create Origin Access Identity for CloudFront
   - This allows CloudFront to access the private S3 bucket

2. **Task 5**: Create CloudFront distribution
   - The distribution will be configured to trust this key pair
   - CloudFront will validate signed cookies using the public key

3. **Task 6**: Create Cookie Generator Lambda
   - The Lambda will use the private key to sign cookies
   - The Lambda will include the Key Pair ID in the cookies

## How CloudFront Uses the Key Pair

### During Cookie Generation (Lambda)

```javascript
// Lambda function signs cookies with private key
const signature = crypto.sign('RSA-SHA1', policyBuffer, privateKey);

// Lambda includes Key Pair ID in cookie
const cookies = [
  `CloudFront-Policy=${encodedPolicy}; ...`,
  `CloudFront-Signature=${signature}; ...`,
  `CloudFront-Key-Pair-Id=${CLOUDFRONT_KEY_PAIR_ID}; ...`  // ← Your Key Pair ID
];
```

### During Image Request (CloudFront)

```
1. Browser sends image request with cookies
2. CloudFront extracts Key Pair ID from cookie
3. CloudFront looks up the public key for that Key Pair ID
4. CloudFront verifies the signature using the public key
5. If signature is valid → serve image
6. If signature is invalid → return 403 Forbidden
```

**Key Point**: CloudFront must have an **active** key pair with the matching Key Pair ID, or all requests will fail.

## Security Notes

### Key Pair Status is Public Information

- The status (Active/Inactive) is not sensitive
- Anyone with CloudFront console access can see it
- This is fine - the security comes from the private key, not the status

### When to Disable a Key Pair

Disable a key pair when:
- You suspect the private key has been compromised
- You're rotating keys and want to force re-authentication
- You're testing fallback behavior

**Important**: Disabling a key pair will immediately break all signed cookies using that key pair. Users will get 403 errors until they get new cookies with a different key pair.

### Key Rotation

Best practice: Rotate CloudFront key pairs every 90 days

1. Generate a new key pair (Task 1.1)
2. Store the new private key (Task 1.3)
3. Update Lambda to use the new key pair
4. Wait 1 hour (cookie expiration time)
5. Disable the old key pair
6. Delete the old key pair after 30 days

## Cost Information

**No cost** - verifying key pair status is free.

## Estimated Time

**2 minutes** to verify key pair status in AWS Console

## Success Criteria

Task 1.5 is complete when:

- [x] Key pair status is "Active" in CloudFront Console
- [x] Key Pair ID matches the documented ID in configuration
- [x] No error messages when viewing key pair details
- [x] Verification checklist is complete

## Next Steps

After completing Task 1.5:

1. **Task 2**: Create Origin Access Identity for CloudFront
2. **Task 3**: Prepare S3 bucket policy (don't apply yet)
3. **Task 4**: Deploy Lambda@Edge image resizer
4. **Task 5**: Create CloudFront distribution (will use this key pair)

---

**Task Status**: 🔄 In Progress  
**Prerequisites**: Tasks 1.1, 1.2, 1.3, 1.4 complete  
**Next Task**: Task 2.1 (Create Origin Access Identity)
