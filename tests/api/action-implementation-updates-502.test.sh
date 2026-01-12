#!/bin/bash
# Test for action_implementation_updates 502 error
# This test verifies the endpoint returns 200 OK and valid JSON

set -e

API_BASE="https://0720au267k.execute-api.us-west-2.amazonaws.com/prod"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  echo "Usage: $0 <auth_token>"
  echo "Example: $0 'Bearer eyJraWQ...'"
  exit 1
fi

echo "Testing /api/action_implementation_updates endpoint..."
echo ""

# Test 1: Basic GET request with action_id and limit
echo "Test 1: GET with action_id and limit=1"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "${API_BASE}/api/action_implementation_updates?action_id=57b8ca48-0f22-46b8-83ef-3b955b66e338&limit=1" \
  -H "authorization: ${TOKEN}" \
  -H "accept: application/json")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "HTTP Status: $HTTP_CODE"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Expected 200, got $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi

# Verify JSON is valid
if ! echo "$BODY" | jq . > /dev/null 2>&1; then
  echo "❌ FAIL: Response is not valid JSON"
  echo "Response: $BODY"
  exit 1
fi

# Verify response has 'data' field
if ! echo "$BODY" | jq -e '.data' > /dev/null 2>&1; then
  echo "❌ FAIL: Response missing 'data' field"
  echo "Response: $BODY"
  exit 1
fi

echo "✅ PASS: Test 1 passed"
echo ""

# Test 2: GET without action_id (should return all updates user has access to)
echo "Test 2: GET without action_id (limit=5)"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "${API_BASE}/api/action_implementation_updates?limit=5" \
  -H "authorization: ${TOKEN}" \
  -H "accept: application/json")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Expected 200, got $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi

echo "✅ PASS: Test 2 passed"
echo ""

# Test 3: GET with date range
echo "Test 3: GET with date range"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  "${API_BASE}/api/action_implementation_updates?start_date=2024-01-01&end_date=2025-12-31&limit=10" \
  -H "authorization: ${TOKEN}" \
  -H "accept: application/json")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ FAIL: Expected 200, got $HTTP_CODE"
  exit 1
fi

echo "✅ PASS: Test 3 passed"
echo ""

echo "✅ ALL TESTS PASSED"
echo ""
echo "Summary:"
echo "- Endpoint returns 200 OK"
echo "- Response is valid JSON"
echo "- Response contains 'data' field"
echo "- Handles various query parameters correctly"
