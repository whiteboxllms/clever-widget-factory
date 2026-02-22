# CloudFront Image Security Scripts

This directory contains utility scripts for setting up and managing CloudFront image security infrastructure.

## Scripts

### setup-key-pair-id.sh

**Purpose**: Configure the CloudFront Key Pair ID in the configuration file for Lambda deployment.

**Usage**:
```bash
# Interactive mode (prompts for Key Pair ID)
./scripts/setup-key-pair-id.sh

# Non-interactive mode (provide Key Pair ID as argument)
./scripts/setup-key-pair-id.sh APKA2JXHY4EXAMPLE
```

**What it does**:
1. Validates Key Pair ID format (must start with "APKA")
2. Updates `cloudfront-config.env` with the Key Pair ID
3. Creates backup of configuration file
4. Verifies the update was successful

**Example output**:
```
==========================================
CloudFront Key Pair ID Setup
==========================================

🔑 Please enter your CloudFront Key Pair ID
   (Format: APKAXXXXXXXXXX)

Key Pair ID: APKA2JXHY4EXAMPLE

✅ Valid Key Pair ID format: APKA2JXHY4EXAMPLE

📝 Updating configuration file...
✅ Configuration updated successfully!

📄 Configuration file: .kiro/specs/cloudfront-image-security/cloudfront-config.env
🔑 Key Pair ID: APKA2JXHY4EXAMPLE

Next steps:
  1. Verify key pair is active: ./scripts/verify-key-pair.sh
  2. Proceed to Task 1.5
```

**Related Task**: Task 1.4

---

### verify-key-pair.sh

**Purpose**: Verify that the CloudFront Key Pair ID is documented and the private key is accessible in Secrets Manager.

**Usage**:
```bash
# Verify complete key pair configuration
./scripts/verify-key-pair.sh
```

**What it checks**:
1. ✓ Configuration file exists
2. ✓ Key Pair ID is set (not placeholder)
3. ✓ Key Pair ID format is valid
4. ✓ Private key exists in Secrets Manager
5. ✓ Private key is valid RSA format

**Example output**:
```
==========================================
CloudFront Key Pair Verification
==========================================

📋 Configuration loaded from: .kiro/specs/cloudfront-image-security/cloudfront-config.env

✅ Key Pair ID: APKA2JXHY4EXAMPLE

✅ Key Pair ID format is valid

🔐 Verifying private key in Secrets Manager...

✅ Private key found in Secrets Manager
   Secret Name: cloudfront-private-key
   Secret ARN: arn:aws:secretsmanager:us-west-2:123456789012:secret:cloudfront-private-key-AbCdEf
   Region: us-west-2

🔍 Verifying private key format...
✅ Private key is valid RSA format

==========================================
✅ All verifications passed!
==========================================

Summary:
  • Key Pair ID: APKA2JXHY4EXAMPLE
  • Private Key: Stored in Secrets Manager
  • Configuration: .kiro/specs/cloudfront-image-security/cloudfront-config.env

Ready for Task 1.5: Verify key pair is active in CloudFront
```

**Related Tasks**: Task 1.4, Task 1.5

---

### verify-key-pair-active.sh

**Purpose**: Verify that the CloudFront key pair is active and ready to use for signing cookies.

**Usage**:
```bash
# Verify key pair is active in CloudFront
./scripts/verify-key-pair-active.sh
```

**What it checks**:
1. ✓ Configuration file exists
2. ✓ Key Pair ID is set (not placeholder)
3. ✓ Key pair exists in CloudFront
4. ✓ Key pair is active (not disabled)
5. ✓ Public key content is present
6. ✓ Key pair is listed in active public keys

**Example output**:
```
==========================================
CloudFront Key Pair Status Verification
==========================================

🔍 Checking Key Pair: APKA2JXHY4EXAMPLE

📡 Fetching key pair details from CloudFront...

✅ Key Pair ID: APKA2JXHY4EXAMPLE
✅ Key Pair Created: 2024-01-15T10:30:00Z

✅ Public key is present (1234 bytes)

🔍 Verifying key pair is active...

✅ Key pair is active and listed in CloudFront

==========================================
✅ Key pair is active and ready to use!
==========================================

Summary:
  • Key Pair ID: APKA2JXHY4EXAMPLE
  • Status: Active
  • Created: 2024-01-15T10:30:00Z
  • Public Key: Present

Next Steps:
  • Task 2: Create Origin Access Identity
  • Task 5: Create CloudFront distribution
  • Task 6: Create Cookie Generator Lambda

How CloudFront will use this key pair:
  1. Lambda signs cookies with private key (from Secrets Manager)
  2. Lambda includes Key Pair ID in cookies
  3. CloudFront validates signatures using this public key
  4. If valid → serve image, if invalid → 403 Forbidden
```

**What "Active" means**:
- CloudFront will accept signed cookies created with this key pair
- Image requests with valid signatures will be served
- The public key is available for signature verification

**If key pair is inactive**:
- All signed cookies using this key pair will be rejected
- All image requests will return 403 Forbidden
- You'll need to enable the key pair in CloudFront Console

**Related Task**: Task 1.5

---

### verify-private-key.sh

**Purpose**: Verify that the CloudFront private key is properly formatted and securely stored locally.

**Usage**:
```bash
# Verify key at default location (.keys/cloudfront-private-key.pem)
./scripts/verify-private-key.sh

# Verify key at custom location
./scripts/verify-private-key.sh /path/to/private_key.pem
```

**What it checks**:
1. ✓ Key file exists
2. ✓ File permissions are 600 (owner read-only)
3. ✓ PEM format headers are correct
4. ✓ File size is reasonable (1600-1700 bytes for RSA 2048-bit)
5. ✓ RSA key integrity (using OpenSSL)
6. ✓ Key information (bit size)
7. ✓ .gitignore protection
8. ✓ Not tracked by git
9. ✓ Extract public key for verification

**Example output**:
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
   Public key saved to: .keys/cloudfront-private-key-public.pem

==========================================
Verification Complete!
==========================================
```

### verify-secrets-manager.sh

**Purpose**: Verify that the CloudFront private key is correctly stored in AWS Secrets Manager and accessible by Lambda functions.

**Usage**:
```bash
# Verify secret in Secrets Manager
./scripts/verify-secrets-manager.sh
```

**What it checks**:
1. ✓ AWS CLI is installed
2. ✓ AWS credentials are configured
3. ✓ Secret exists in Secrets Manager
4. ✓ Secret metadata is correct
5. ✓ Secret value can be retrieved
6. ✓ PEM format is valid
7. ✓ RSA key integrity
8. ✓ Key information (bit size)
9. ✓ Comparison with local key (if exists)
10. ✓ IAM permissions for Lambda access
11. ✓ Secret rotation configuration

**Example output**:
```
==========================================
Secrets Manager Verification
==========================================

1. Checking AWS CLI installation... ✓ PASS
2. Checking AWS credentials... ✓ PASS (Account: 123456789012)
3. Checking if secret exists in Secrets Manager... ✓ PASS
4. Retrieving secret metadata... ✓ PASS
   Secret ARN: arn:aws:secretsmanager:us-west-2:123456789012:secret:cloudfront-private-key-AbCdEf
   Created: 2024-01-15T12:00:00-08:00
5. Retrieving secret value... ✓ PASS
6. Checking PEM format... ✓ PASS
7. Verifying RSA key integrity... ✓ PASS
8. Extracting key information... ✓ PASS
   Key size: 2048 bits
9. Comparing with local key... ✓ PASS
10. Checking IAM permissions for Lambda access... ✓ PASS
11. Checking secret rotation configuration... disabled

==========================================
Verification Complete!
==========================================

Summary:
  Secret Name: cloudfront-private-key
  Region: us-west-2
  ARN: arn:aws:secretsmanager:us-west-2:123456789012:secret:cloudfront-private-key-AbCdEf
  Key Size: 2048 bits

Next Steps:
  1. Note the CloudFront Key Pair ID (Task 1.4)
  2. Verify key pair is active in CloudFront (Task 1.5)
  3. Create Cookie Generator Lambda with this secret (Task 6)

Lambda Environment Variables:
  CLOUDFRONT_PRIVATE_KEY_SECRET_NAME=cloudfront-private-key
  CLOUDFRONT_KEY_PAIR_ID=<from Task 1.4>
  CLOUDFRONT_DOMAIN=<from Task 5>
```

## Related Tasks

- **Task 1.1**: Generate CloudFront key pair in AWS Console
- **Task 1.2**: Download private key PEM file (this script helps verify)
- **Task 1.3**: Store private key in AWS Secrets Manager
- **Task 1.4**: Note the CloudFront Key Pair ID
- **Task 1.5**: Verify key pair is active in CloudFront

## Security Notes

**CRITICAL**: Never commit private keys to version control!

- Private keys should be stored in `.keys/` directory (gitignored)
- File permissions should be 600 (owner read-only)
- Keys should be backed up in secure password manager
- Production keys should be stored in AWS Secrets Manager
- Keys should be rotated every 90 days

## Troubleshooting

### "Private key not found"
- Ensure you've downloaded the key from AWS Console
- Move it to `.keys/cloudfront-private-key.pem`
- Or specify the correct path as an argument

### "OpenSSL reports the key is invalid"
- The key file may be corrupted
- Regenerate the key pair in AWS Console
- Ensure you downloaded the complete file

### "WARNING: Private key is tracked by git!"
- Remove it immediately:
  ```bash
  git rm --cached .keys/cloudfront-private-key.pem
  git commit -m 'Remove private key from git'
  ```
- Rotate the key pair (compromised keys should not be used)

## Future Scripts

Additional scripts to be added:

- `test-signed-cookies.sh` - Test cookie generation and CloudFront access
- `rotate-key-pair.sh` - Automate key pair rotation process
- `verify-cloudfront-config.sh` - Verify CloudFront distribution configuration

## Contributing

When adding new scripts:
1. Make them executable: `chmod +x script-name.sh`
2. Add comprehensive error handling
3. Use colored output for clarity (GREEN=pass, RED=fail, YELLOW=warn)
4. Document usage in this README
5. Link to related tasks in the tasks.md file
