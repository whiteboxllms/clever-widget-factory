#!/bin/bash

# Script to migrate all image folders
# Usage: ./migrate-all-folders.sh

BATCH_SIZE=50

# Folders to process
FOLDERS=(
  "tool-images/parts/"
  "tool-images/tools/"
  "tool-resolution-photos/"
  "mission-evidence/"
)

echo "Starting migration of all image folders"
echo "========================================"

for FOLDER in "${FOLDERS[@]}"; do
  echo ""
  echo "Processing folder: $FOLDER"
  echo "----------------------------------------"
  
  START_AFTER=""
  FOLDER_TOTAL=0
  FOLDER_SUCCESS=0
  
  while true; do
    # Build payload
    if [ -z "$START_AFTER" ]; then
      PAYLOAD="{\"batchSize\":$BATCH_SIZE,\"prefix\":\"$FOLDER\",\"dryRun\":false}"
    else
      PAYLOAD="{\"batchSize\":$BATCH_SIZE,\"prefix\":\"$FOLDER\",\"startAfter\":\"$START_AFTER\",\"dryRun\":false}"
    fi
    
    # Invoke Lambda
    echo "$PAYLOAD" | aws lambda invoke \
      --function-name cwf-backfill-compress \
      --payload file:///dev/stdin \
      --region us-west-2 \
      --cli-binary-format raw-in-base64-out \
      --cli-read-timeout 0 \
      response.json > /dev/null 2>&1
    
    # Parse response
    BODY=$(cat response.json | jq -r '.body')
    SUMMARY=$(echo "$BODY" | jq '.summary')
    PROCESSED=$(echo "$SUMMARY" | jq -r '.processed')
    SUCCESS=$(echo "$SUMMARY" | jq -r '.success')
    HAS_MORE=$(echo "$SUMMARY" | jq -r '.hasMore')
    NEXT_START=$(echo "$SUMMARY" | jq -r '.nextStartAfter')
    
    FOLDER_TOTAL=$((FOLDER_TOTAL + PROCESSED))
    FOLDER_SUCCESS=$((FOLDER_SUCCESS + SUCCESS))
    
    echo "  Batch: $SUCCESS/$PROCESSED successful (Total: $FOLDER_SUCCESS)"
    
    if [ "$HAS_MORE" != "true" ]; then
      break
    fi
    
    START_AFTER="$NEXT_START"
    sleep 1
  done
  
  echo "Folder complete: $FOLDER_SUCCESS images migrated"
done

echo ""
echo "========================================"
echo "All folders migrated!"
