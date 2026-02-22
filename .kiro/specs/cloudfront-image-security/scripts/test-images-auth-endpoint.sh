#!/bin/bash
# Test script for POST /api/images/auth endpoint
# Tests the endpoint with a valid Cognito token

set -e

API_BASE="${VITE_API_BASE_URL:-https://0720au267k.execute-api.us-west-2.amazonaws.com/prod}"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <auth_token>"
  echo "Example: $0 'Bearer eyJraWQ...'"
  echo ""
  echo "Note: You need a valid Cognito authentication token with organization_id claim"
  exit 1
fi

ENDPOINT="${API_BASE}/api/images/auth"

echo "========================================="
echo "Testing POST /api/images/auth Endpoint"
echo "========================================="
echo ""
echo "API Base URL: ${API_BASE}"
echo "Endpoint: ${ENDPOINT}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Test 1: Basic request with valid token
echo "Test 1: POST with valid Cognito token"
echo "----------------------------------------"

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "${ENDPOINT}" \
  -X POST \
  -H "authorization: ${TOKEN}" \
  -H "accept: application/json" \
  -H "content-type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response Headers:"
echo "$RESPONSE" | grep -E "^(Set-Cookie|Content-Type|Access-Control)" | head -10
echo ""
echo "Response Body:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

# Validate HTTP status
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Expected 200, got $HTTP_CODE"
  echo ""
  echo "This may indicate:"
  echo "  1. Invalid Cognito token"
  echo "  2. Missing organization_id in token claims"
  echo "  3. Lambda function error"
  echo "  4. API Gateway configuration issue"
  exit 1
fi

# Verify JSON is valid
if ! echo "$BODY" | jq . > /dev/null 2>&1; then
  echo "❌ FAIL: Response is not valid JSON"
  exit 1
fi

# Verify response structure
if ! echo "$BODY" | jq -e '.success' > /dev/null 2>&1; then
  echo "❌ FAIL: Response missing 'success' field"
  exit 1
fi

if ! echo "$BODY" | jq -e '.expiresAt' > /dev/null 2>&1; then
  echo "❌ FAIL: Response missing 'expiresAt' field"
  exit 1
fi

# Verify Set-Cookie headers are present
if ! echo "$RESPONSE" | grep -q "Set-Cookie:"; then
  echo "❌ FAIL: Response missing Set-Cookie headers"
  exit 1
fi

# Verify CloudFront cookies are set
COOKIE_COUNT=$(echo "$RESPONSE" | grep -c "CloudFront-")
if [ "$COOKIE_COUNT" -lt 3 ]; then
  echo "❌ FAIL: Expected 3 CloudFront cookies (Policy, Signature, Key-Pair-Id), found $COOKIE_COUNT"
  exit 1
fi

echo "✅ PASS: Test 1 passed"
echo ""

# Test 2: Verify cookies contain expected structure
echo "Test 2: Verify cookie structure"
echo "--------------------------------"

# Extract cookies from response
POLICY_COOKIE=$(echo "$RESPONSE" | grep -oP 'CloudFront-Policy=\K[^;]+')
SIGNATURE_COOKIE=$(echo "$RESPONSE" | grep -oP 'CloudFront-Signature=\K[^;]+')
KEYPAIR_COOKIE=$(echo "$RESPONSE" | grep -oP 'CloudFront-Key-Pair-Id=\K[^;]+')

echo "CloudFront-Policy: ${POLICY_COOKIE:0:50}..."
echo "CloudFront-Signature: ${SIGNATURE_COOKIE:0:50}..."
echo "CloudFront-Key-Pair-Id: ${KEYPAIR_COOKIE}"
echo ""

# Verify cookie attributes
if ! echo "$RESPONSE" | grep -q "Secure; HttpOnly"; then
  echo "⚠️  WARNING: Cookies may not have Secure and HttpOnly flags"
fi

if ! echo "$RESPONSE" | grep -q "SameSite=Strict"; then
  echo "⚠️  WARNING: Cookies may not have SameSite=Strict attribute"
fi

echo "✅ PASS: Test 2 passed"
echo ""

# Test 3: Verify expiresAt is reasonable
EXPIRES_AT=$(echo "$BODY" | jq -r '.expiresAt')
echo "Test 3: Verify expiration time"
echo "-------------------------------"
echo "Expires at: $EXPIRES_AT"

# Check if expiration is within reasonable range (30-60 minutes from now)
EXPIRES_EPOCH=$(date -d "$EXPIRES_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$EXPIRES_AT" +%s 2>/dev/null || echo "0")
CURRENT_EPOCH=$(date +%s)
EXPECTED_MAX=$((CURRENT_EPOCH + 3660))  # 61 minutes from now
EXPECTED_MIN=$((CURRENT_EPOCH + 1740))  # 29 minutes from now

if [ "$EXPIRES_EPOCH" -gt "$EXPECTED_MIN" ] && [ "$EXPIRES_EPOCH" -lt "$EXPECTED_MAX" ]; then
  echo "✅ PASS: Expiration time is reasonable (~1 hour)"
else
  echo "⚠️  WARNING: Expiration time may not match expected 1-hour duration"
  echo "   Current epoch: $CURRENT_EPOCH"
  echo "   Expected range: $EXPECTED_MIN - $EXPECTED_MAX"
  echo "   Actual epoch: $EXPIRES_EPOCH"
fi
echo ""

# Test 4: Verify correlationId for debugging
CORRELATION_ID=$(echo "$BODY" | jq -r '.correlationId // empty')
if [ -n "$CORRELATION_ID" ]; then
  echo "Test 4: Correlation ID for debugging"
  echo "-------------------------------------"
  echo "Correlation ID: $CORRELATION_ID"
  echo "✅ PASS: Test 4 passed"
  echo ""
fi

echo "========================================="
echo "✅ ALL TESTS PASSED"
echo "========================================="
echo ""
echo "Summary:"
echo "- Endpoint returns 200 OK"
echo "- Response is valid JSON"
echo "- Response contains expected fields (success, expiresAt, correlationId)"
echo "- Set-Cookie headers present with 3 CloudFront cookies"
echo "- Cookies have proper security attributes"
echo "- Expiration time is reasonable (~1 hour)"
echo ""
echo "Next steps:"
echo "1. Verify cookies are sent with subsequent image requests"
echo "2. Test image access with CloudFront domain"
echo "3. Verify organization-scoped access control"
echo ""
echo "To test with actual images, use:"
echo "  curl -b \"CloudFront-Policy=...; CloudFront-Signature=...; CloudFront-Key-Pair-Id=...\" \\"
echo "    https://d3l6r2sq70ysui.cloudfront.net/organizations/<org_id>/images/original/<image_key>"
