#!/bin/bash

USER_POOL_ID="us-west-2_84dcGaogx"
REGION="us-west-2"
TEMP_PASSWORD="StargazerFarm2025!"

echo "🚀 Starting Cognito user migration..."

# Delete test user
aws cognito-idp admin-delete-user --user-pool-id $USER_POOL_ID --username "7871f320-d031-70a1-541b-748f221805f3" --region $REGION 2>/dev/null

# Create users
aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username "4d7124f9-c0f2-490d-a765-3a3f8d1dbad8" --user-attributes Name=email,Value="carlhilo22@gmail.com" Name=email_verified,Value=true --message-action SUPPRESS --temporary-password "$TEMP_PASSWORD" --region $REGION && aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username "4d7124f9-c0f2-490d-a765-3a3f8d1dbad8" --password "$TEMP_PASSWORD" --permanent --region $REGION && echo "✅ carlhilo22@gmail.com"

aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username "48155769-4d22-4d36-9982-095ac9ad6b2c" --user-attributes Name=email,Value="mae@stargazer-farm.com" Name=email_verified,Value=true --message-action SUPPRESS --temporary-password "$TEMP_PASSWORD" --region $REGION && aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username "48155769-4d22-4d36-9982-095ac9ad6b2c" --password "$TEMP_PASSWORD" --permanent --region $REGION && echo "✅ mae@stargazer-farm.com"

aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username "7dd4187f-ff2a-4367-9e7b-0c8741f25495" --user-attributes Name=email,Value="paniellesterjohnlegarda@gmail.com" Name=email_verified,Value=true --message-action SUPPRESS --temporary-password "$TEMP_PASSWORD" --region $REGION && aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username "7dd4187f-ff2a-4367-9e7b-0c8741f25495" --password "$TEMP_PASSWORD" --permanent --region $REGION && echo "✅ paniellesterjohnlegarda@gmail.com"

aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username "b8006f2b-0ec7-4107-b05a-b4c6b49541fd" --user-attributes Name=email,Value="stefan@stargazer-farm.com" Name=email_verified,Value=true --message-action SUPPRESS --temporary-password "$TEMP_PASSWORD" --region $REGION && aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username "b8006f2b-0ec7-4107-b05a-b4c6b49541fd" --password "$TEMP_PASSWORD" --permanent --region $REGION && echo "✅ stefan@stargazer-farm.com"

aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username "3fcd5103-95d4-46d3-bbe8-b7a5220ee4c5" --user-attributes Name=email,Value="stefhamilton@gmail.com" Name=email_verified,Value=true --message-action SUPPRESS --temporary-password "$TEMP_PASSWORD" --region $REGION && aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username "3fcd5103-95d4-46d3-bbe8-b7a5220ee4c5" --password "$TEMP_PASSWORD" --permanent --region $REGION && echo "✅ stefhamilton@gmail.com"

aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username "0cb0a42d-272b-43ee-b047-7c0b6ec62f6e" --user-attributes Name=email,Value="vickyyap04@gmail.com" Name=email_verified,Value=true --message-action SUPPRESS --temporary-password "$TEMP_PASSWORD" --region $REGION && aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username "0cb0a42d-272b-43ee-b047-7c0b6ec62f6e" --password "$TEMP_PASSWORD" --permanent --region $REGION && echo "✅ vickyyap04@gmail.com"

echo "🎉 Migration complete! All users can log in with password: $TEMP_PASSWORD"
