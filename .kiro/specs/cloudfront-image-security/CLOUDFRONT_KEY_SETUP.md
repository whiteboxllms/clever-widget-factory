# CloudFront Key Pair Setup Guide

## Task 1.2: Download Private Key PEM File

### Overview
This task involves downloading and verifying the CloudFront private key that was generated in Task 1.1. The private key is critical for signing CloudFront cookies and must be handled with extreme care.

### Prerequisites
- Task 1.1 must be completed (CloudFront key pair generated in AWS Console)
- You should have received a `private_key.pem` file download from AWS when creating the key pair

### Steps to Complete Task 1.2

#### 1. Locate the Downloaded Private Key

When you created the CloudFront key pair in Task 1.1, AWS automatically downloaded a file named something like:
- `private_key.pem`
- `pk-APKAXXXXXXXXXX.pem` (where the X's are your key pair ID)

**Check your Downloads folder** for this file.

#### 2. Verify the Key Format

The private key should be in PEM format. You can verify this by checking:

```bash
# View the key file (first few lines)
head -5 private_key.pem
```

**Expected output:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
```

The file should:
- Start with `-----BEGIN RSA PRIVATE KEY-----`
- End with `-----END RSA PRIVATE KEY-----`
- Contain base64-encoded data between the headers
- Be approximately 1600-1700 bytes in size

#### 3. Verify Key Integrity

You can verify the key is valid and not corrupted:

```bash
# Check if the key is valid RSA format
openssl rsa -in private_key.pem -check -noout
```

**Expected output:**
```
RSA key ok
```

If you see errors, the key file may be corrupted and you'll need to regenerate it.

#### 4. Extract the Public Key (Optional Verification)

To verify the key pair matches what's in AWS:

```bash
# Extract the public key from the private key
openssl rsa -in private_key.pem -pubout -out public_key.pem

# View the public key
cat public_key.pem
```

You can compare this public key with the one shown in the AWS CloudFront Console under Key Management.

#### 5. Secure the Private Key

**CRITICAL SECURITY STEPS:**

1. **Move the key to a secure location** (do NOT commit to git):
   ```bash
   # Create a secure keys directory (already in .gitignore)
   mkdir -p .keys
   mv ~/Downloads/private_key.pem .keys/cloudfront-private-key.pem
   chmod 600 .keys/cloudfront-private-key.pem
   ```

2. **Verify .gitignore includes the keys directory**:
   ```bash
   grep -q "\.keys" .gitignore || echo ".keys/" >> .gitignore
   ```

3. **Never commit the private key to version control**
4. **Never share the private key via email, Slack, or other insecure channels**
5. **Never store the private key in application code**

### Security Best Practices

#### Key Storage
- **Local Development**: Store in `.keys/` directory (gitignored)
- **Production**: Store in AWS Secrets Manager (Task 1.3)
- **Backup**: Store encrypted backup in secure password manager (1Password, LastPass, etc.)

#### Key Permissions
```bash
# Set restrictive permissions (owner read-only)
chmod 600 .keys/cloudfront-private-key.pem

# Verify permissions
ls -l .keys/cloudfront-private-key.pem
# Should show: -rw------- (600)
```

#### Key Rotation
- CloudFront key pairs should be rotated every 90 days
- When rotating:
  1. Generate new key pair in AWS Console
  2. Update AWS Secrets Manager with new key
  3. Deploy Lambda functions with new key pair ID
  4. Wait 24 hours for old cookies to expire
  5. Delete old key pair from CloudFront

### Verification Checklist

Before proceeding to Task 1.3, verify:

- [ ] Private key file exists and is accessible
- [ ] Key starts with `-----BEGIN RSA PRIVATE KEY-----`
- [ ] Key ends with `-----END RSA PRIVATE KEY-----`
- [ ] `openssl rsa -in private_key.pem -check -noout` returns "RSA key ok"
- [ ] Key file has 600 permissions (owner read-only)
- [ ] Key is stored in `.keys/` directory (gitignored)
- [ ] Key is NOT committed to git
- [ ] You have the CloudFront Key Pair ID from AWS Console

### Troubleshooting

#### Problem: Private key file not found
**Solution**: Check your Downloads folder for files matching `*private_key*.pem` or `pk-*.pem`. If not found, you may need to regenerate the key pair in AWS Console (Task 1.1).

#### Problem: "unable to load Private Key" error
**Solution**: The file may be corrupted or in the wrong format. Verify the file starts with `-----BEGIN RSA PRIVATE KEY-----`. If not, regenerate the key pair.

#### Problem: Permission denied when reading key
**Solution**: Ensure you have read permissions:
```bash
chmod 600 .keys/cloudfront-private-key.pem
```

#### Problem: Key pair ID unknown
**Solution**: Find your key pair ID in AWS Console:
1. Go to CloudFront → Key Management
2. Look for your key pair in the list
3. The ID will be in format `APKAXXXXXXXXXX`

### Next Steps

Once Task 1.2 is complete, proceed to:
- **Task 1.3**: Store private key in AWS Secrets Manager
- **Task 1.4**: Note the CloudFront Key Pair ID for Lambda configuration
- **Task 1.5**: Verify key pair is active in CloudFront

### Additional Resources

- [AWS CloudFront Signed URLs and Cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html)
- [OpenSSL RSA Key Commands](https://www.openssl.org/docs/man1.1.1/man1/rsa.html)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Related Tasks**: 1.1, 1.3, 1.4, 1.5
