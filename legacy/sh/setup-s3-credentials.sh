#!/bin/bash

# Create IAM user
aws iam create-user --user-name cwf-s3-uploader

# Create and attach policy
aws iam put-user-policy --user-name cwf-s3-uploader --policy-name S3UploadPolicy --policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::cwf-dev-assets/*"
    }
  ]
}'

# Create access key
aws iam create-access-key --user-name cwf-s3-uploader
