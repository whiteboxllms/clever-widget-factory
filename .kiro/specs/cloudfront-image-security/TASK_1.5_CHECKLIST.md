# Task 1.5 Verification Checklist

## Pre-Verification

Before starting Task 1.5, ensure these tasks are complete:

- [x] **Task 1.1**: CloudFront key pair generated in AWS Console
- [x] **Task 1.2**: Private key downloaded and verified locally
- [x] **Task 1.3**: Private key stored in AWS Secrets Manager
- [x] **Task 1.4**: Key Pair ID documented in `cloudfront-config.env`

## Verification Steps

### Step 1: AWS Console Verification

- [ ] Open AWS Console: https://console.aws.amazon.com/cloudfront/
- [ ] Navigate to **Key Management** in left sidebar
- [ ] Locate key pair with your Key Pair ID
- [ ] Verify **Status** column shows "Active"
- [ ] Click on Key Pair ID to view details
- [ ] Confirm Key Pair ID matches `cloudfront-config.env`
- [ ] Confirm public key content is visible
- [ ] Confirm created date matches Task 1.1 date

### Step 2: Automated Script Verification

- [ ] Run verification script:
  ```bash
  cd .kiro/specs/cloudfront-image-security
  ./scripts/verify-key-pair-active.sh
  ```
- [ ] Script reports "Key pair is active and ready to use"
- [ ] No error messages in script output
- [ ] Key Pair ID matches configuration

### Step 3: Configuration Review

- [ ] Open `cloudfront-config.env`
- [ ] Verify `CLOUDFRONT_KEY_PAIR_ID` is set (not "REPLACE_WITH_YOUR_KEY_PAIR_ID")
- [ ] Verify Key Pair ID format: starts with "APKA"
- [ ] Verify `CLOUDFRONT_PRIVATE_KEY_SECRET_NAME` is set to "cloudfront-private-key"

### Step 4: Secrets Manager Cross-Check

- [ ] Run: `./scripts/verify-secrets-manager.sh`
- [ ] Confirm private key exists in Secrets Manager
- [ ] Confirm private key is valid RSA format
- [ ] Confirm secret name matches configuration

## Understanding Key Pair Status

### What "Active" Means

An **active** key pair:
- ✅ CloudFront will accept signed cookies created with this key pair
- ✅ Image requests with valid signatures will be served
- ✅ The public key is available for signature verification

An **inactive** key pair:
- ❌ CloudFront will reject all signed cookies using this key pair
- ❌ All image requests will return 403 Forbidden
- ❌ Users will not be able to view images

### How to Check Status

**AWS Console Method** (Recommended):
1. CloudFront Console → Key Management
2. Look at "Status" column
3. Should show "Active" (green checkmark)

**AWS CLI Method**:
```bash
aws cloudfront list-public-keys \
  --query "PublicKeyList.Items[?Id=='YOUR_KEY_PAIR_ID']" \
  --output table
```

If the key pair appears in the list, it's active.

## Troubleshooting

### Issue: Status Shows "Inactive"

**Solution**:
1. Select the key pair in CloudFront Console
2. Click **Actions** → **Enable**
3. Wait a few seconds for status to update
4. Re-run verification

### Issue: Key Pair Not Found

**Possible Causes**:
- Key Pair ID is incorrect
- Key pair was deleted
- Wrong AWS account/region

**Solution**:
1. Verify Key Pair ID in AWS Console
2. If deleted, repeat Tasks 1.1-1.4 to create new key pair
3. Update `cloudfront-config.env` with new Key Pair ID

### Issue: Multiple Key Pairs Exist

**Solution**:
1. Identify which key pair matches your private key in Secrets Manager
2. Verify Key Pair ID matches configuration
3. Disable or delete unused key pairs
4. **Warning**: Only delete key pairs you're certain are not in use

### Issue: Permission Denied

**Required IAM Permissions**:
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

**Solution**: Ask your AWS administrator to grant these permissions.

## Security Considerations

### Key Pair Status is Public

- ✅ Safe to view in AWS Console
- ✅ Safe to check via AWS CLI
- ✅ Not sensitive information

### Private Key is Secret

- ❌ Never view in CloudFront Console (only public key is shown)
- ❌ Never log or expose
- ✅ Only stored in AWS Secrets Manager

### When to Disable a Key Pair

Disable a key pair when:
- Rotating keys (after deploying new key pair)
- Suspected private key compromise
- Testing fallback behavior

**Warning**: Disabling a key pair immediately breaks all signed cookies using that key pair.

## How CloudFront Uses This Key Pair

### Cookie Generation Flow

```
1. User authenticates with Cognito
2. Frontend requests signed cookies from Lambda
3. Lambda retrieves private key from Secrets Manager
4. Lambda signs cookie policy with private key
5. Lambda includes Key Pair ID in cookie
6. Browser stores cookies
```

### Image Request Flow

```
1. Browser requests image from CloudFront
2. Browser includes signed cookies
3. CloudFront extracts Key Pair ID from cookie
4. CloudFront looks up public key for that Key Pair ID
5. CloudFront verifies signature using public key
6. If valid → serve image
7. If invalid → 403 Forbidden
```

**Critical**: CloudFront must have an **active** key pair with the matching Key Pair ID, or all requests will fail.

## Post-Verification

After completing all verification steps:

- [ ] All checklist items are complete
- [ ] Key pair status is "Active"
- [ ] No error messages in any verification
- [ ] Configuration file is correct
- [ ] Private key is in Secrets Manager
- [ ] Ready to proceed to Task 2

## Next Steps

### Immediate Next Tasks

1. **Task 2.1**: Create Origin Access Identity for CloudFront
   - Allows CloudFront to access private S3 bucket
   - Required before creating CloudFront distribution

2. **Task 3**: Prepare S3 bucket policy
   - Draft policy allowing CloudFront OAI access
   - Don't apply yet (zero-downtime migration)

### Future Tasks Using This Key Pair

1. **Task 5**: Create CloudFront distribution
   - Configure distribution to trust this key pair
   - CloudFront will use public key to verify signatures

2. **Task 6**: Create Cookie Generator Lambda
   - Lambda will use private key to sign cookies
   - Lambda will include Key Pair ID in cookies

3. **Task 30**: Gradual rollout
   - Enable CloudFront for 1-2 users
   - Monitor for 403 errors (indicates key pair issues)
   - Scale to 100% if no issues

## Documentation

### Files Created in This Task

- `TASK_1.5_INSTRUCTIONS.md` - Detailed verification instructions
- `TASK_1.5_CHECKLIST.md` - This checklist
- `scripts/verify-key-pair-active.sh` - Automated verification script

### Files Updated

- `scripts/README.md` - Added verify-key-pair-active.sh documentation

### Configuration Files

- `cloudfront-config.env` - Contains Key Pair ID (from Task 1.4)

## Success Criteria

Task 1.5 is complete when:

- ✅ Key pair status is "Active" in CloudFront Console
- ✅ Automated verification script passes
- ✅ Key Pair ID matches configuration
- ✅ Private key exists in Secrets Manager
- ✅ All checklist items are checked
- ✅ No error messages in any verification

## Estimated Time

**2-5 minutes** depending on verification method

## Cost

**$0.00** - Verifying key pair status is free

---

**Task Status**: 🔄 In Progress  
**Prerequisites**: Tasks 1.1, 1.2, 1.3, 1.4 complete  
**Next Task**: Task 2.1 (Create Origin Access Identity)  
**Estimated Completion**: 2-5 minutes
