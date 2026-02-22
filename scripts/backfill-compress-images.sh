#!/bin/bash
# Wrapper script to run the image compression backfill

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing dependencies..."
npm install --prefix . --package-lock=false --no-save \
  @aws-sdk/client-s3@^3.990.0 \
  sharp@^0.33.5

echo ""
echo "Running backfill script..."
node backfill-compress-images.js "$@"
