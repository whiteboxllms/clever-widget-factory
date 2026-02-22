# Task 1.2: Download Private Key PEM File - Quick Instructions

## What You Need to Do

Task 1.2 requires you to download and verify the CloudFront private key that was generated in Task 1.1.

## Step-by-Step Instructions

### 1. Locate the Downloaded Key

When you created the CloudFront key pair in AWS Console (Task 1.1), AWS automatically downloaded a file. Check your **Downloads folder** for:
- `private_key.pem`
- `pk-APKAXXXXXXXXXX.pem` (where X's are your key pair ID)

### 2. Move the Key to Secure Location

```bash
# Create secure keys directory
mkdir -p .keys

# Move the key (adjust path if needed)
mv ~/Downloads/private_key.pem .keys/cloudfront-private-key.pem

# Set secure permissions
chmod 600 .keys/cloudfront-private-key.pem
```

### 3. Verify the Key

Run the verification script:

```bash
cd .kiro/specs/cloudfront-image-security
./scripts/verify-private-key.sh
```

This will check:
- ✓ File exists and is readable
- ✓ Correct PEM format
- ✓ Valid RSA key
- ✓ Secure permissions (600)
- ✓ Protected by .gitignore
- ✓ Not tracked by git

### 4. Expected Output

You should see all checks pass:

```
==========================================
CloudFront Private Key Verification
==========================================

1. Checking if key file exists... PASS
2. Checking file permissions... PASS
3. Checking PEM format... PASS
4. Checking file size... PASS (1675 bytes)
5. Verifying RSA key integrity... PASS
6. Extracting key information... PASS
   Key size: 2048 bits
7. Checking .gitignore protection... PASS
8. Checking git tracking... PASS
9. Extracting public key... PASS

==========================================
Verification Complete!
==========================================
```

## What the Key Should Look Like

The private key file should contain:

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef...
(many lines of base64-encoded data)
...xyz1234567890abcdef
-----END RSA PRIVATE KEY-----
```

## Troubleshooting

### Problem: Can't find the downloaded key

**Solution**: 
1. Check your Downloads folder for `*.pem` files
2. If not found, you may need to regenerate the key pair:
   - Go to AWS Console → CloudFront → Key Management
   - Delete the old key pair
   - Create a new key pair (this will trigger a download)

### Problem: "OpenSSL reports the key is invalid"

**Solution**: The file may be corrupted. Regenerate the key pair in AWS Console.

### Problem: "Permission denied"

**Solution**: 
```bash
chmod 600 .keys/cloudfront-private-key.pem
```

## Security Checklist

Before proceeding to Task 1.3, ensure:

- [ ] Private key file exists at `.keys/cloudfront-private-key.pem`
- [ ] File permissions are 600 (owner read-only)
- [ ] File is NOT tracked by git
- [ ] `.keys/` directory is in `.gitignore`
- [ ] Verification script passes all checks
- [ ] You have the CloudFront Key Pair ID from AWS Console

## Next Steps

Once Task 1.2 is complete:
1. **Task 1.3**: Store private key in AWS Secrets Manager
2. **Task 1.4**: Note the CloudFront Key Pair ID for Lambda configuration
3. **Task 1.5**: Verify key pair is active in CloudFront

## Need Help?

See the detailed guide: `CLOUDFRONT_KEY_SETUP.md`

---

**Task Status**: Ready to verify  
**Estimated Time**: 5 minutes  
**Prerequisites**: Task 1.1 completed
