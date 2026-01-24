#!/bin/bash
set -e

echo "🚀 Deploying presigned URL Lambda..."
cd lambda/cwf-presigned-upload
zip -r function.zip index.mjs node_modules
aws lambda update-function-code \
  --function-name cwf-presigned-upload \
  --zip-file fileb://function.zip \
  --region us-west-2
rm function.zip
cd ../..

echo "🚀 Deploying image compressor Lambda..."
cd lambda/cwf-image-compressor
zip -r function.zip index.mjs node_modules
aws lambda update-function-code \
  --function-name cwf-image-compressor \
  --zip-file fileb://function.zip \
  --region us-west-2
rm function.zip
cd ../..

echo "✅ Done!"
