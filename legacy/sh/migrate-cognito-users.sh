#!/bin/bash

# Migration script to create Cognito users matching existing database user IDs
# This ensures seamless authentication with existing data

USER_POOL_ID="us-west-2_84dcGaogx"
REGION="${AWS_REGION:-us-west-2}"
TEMP_PASSWORD="${TEMP_USER_PASSWORD:-}"

if [[ -z "$TEMP_PASSWORD" ]]; then
  read -s -p "Enter temporary password to assign to migrated users: " TEMP_PASSWORD
  echo
fi

if [[ -z "$TEMP_PASSWORD" ]]; then
  echo "❌ ERROR: Provide TEMP_USER_PASSWORD env var or enter it interactively."
  exit 1
fi

echo "🚀 Starting Cognito user migration for Stargazer Farm team..."

# First, delete the current test user
echo "Deleting current test user..."
aws cognito-idp admin-delete-user \
  --user-pool-id $USER_POOL_ID \
  --username "7871f320-d031-70a1-541b-748f221805f3" \
  --region $REGION 2>/dev/null || echo "Test user already deleted or doesn't exist"

# Create users with their existing database user IDs
declare -A USERS=(
  ["4d7124f9-c0f2-490d-a765-3a3f8d1dbad8"]="carlhilo22@gmail.com"
  ["48155769-4d22-4d36-9982-095ac9ad6b2c"]="mae@stargazer-farm.com"
  ["7dd4187f-ff2a-4367-9e7b-0c8741f25495"]="paniellesterjohnlegarda@gmail.com"
  ["b8006f2b-0ec7-4107-b05a-b4c6b49541fd"]="stefan@stargazer-farm.com"
  ["3fcd5103-95d4-46d3-bbe8-b7a5220ee4c5"]="stefhamilton@gmail.com"
  ["0cb0a42d-272b-43ee-b047-7c0b6ec62f6e"]="vickyyap04@gmail.com"
)

for user_id in "${!USERS[@]}"; do
  email="${USERS[$user_id]}"
  echo "Creating Cognito user: $email with ID: $user_id"
  
  # Create user with existing database ID as username
  aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username "$user_id" \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true \
    --message-action SUPPRESS \
    --temporary-password "$TEMP_PASSWORD" \
    --region $REGION
  
  if [ $? -eq 0 ]; then
    echo "✅ Created user: $email"
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
      --user-pool-id $USER_POOL_ID \
      --username "$user_id" \
      --password "$TEMP_PASSWORD" \
      --permanent \
      --region $REGION
    
    echo "✅ Set permanent password for: $email"
  else
    echo "❌ Failed to create user: $email"
  fi
  
  echo ""
done

echo "🎉 Migration complete!"
echo ""
echo "📧 All users were provisioned with the temporary password passed to this script."
echo "   (Password value intentionally omitted from logs.)"
