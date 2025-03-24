#!/bin/bash
set -e

echo "🌩️ Setting up CloudFront for ptchampion.ai..."

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed. Please install AWS CLI and try again."
    exit 1
fi

# Check AWS credentials
aws sts get-caller-identity &> /dev/null || {
    echo "❌ AWS credentials not configured properly. Please run 'aws configure' first."
    exit 1
}

S3_BUCKET="ptchampion.ai"
DOMAIN_NAME="ptchampion.ai"

# Try to get the bucket region
S3_REGION=$(aws s3api get-bucket-location --bucket "$S3_BUCKET" --query "LocationConstraint" --output text)
if [ "$S3_REGION" = "None" ] || [ "$S3_REGION" = "null" ]; then
    S3_REGION="us-east-1"
fi

echo "📊 S3 bucket region: $S3_REGION"

# Check if S3 website hosting is enabled
if aws s3api get-bucket-website --bucket "$S3_BUCKET" 2>/dev/null; then
    echo "✅ S3 website hosting is enabled"
    S3_WEBSITE_ENDPOINT="${S3_BUCKET}.s3-website-${S3_REGION}.amazonaws.com"
    USE_WEBSITE_ENDPOINT=true
else
    echo "⚠️ S3 website hosting is not enabled, using S3 bucket as origin"
    S3_WEBSITE_ENDPOINT="${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com"
    USE_WEBSITE_ENDPOINT=false
fi

echo "📊 Using S3 endpoint: $S3_WEBSITE_ENDPOINT"

DISTRIBUTION_CONFIG_FILE="cloudfront-config.json"

# Create CloudFront configuration file
echo "📝 Creating CloudFront configuration file..."

if [ "$USE_WEBSITE_ENDPOINT" = true ]; then
  # Using S3 website hosting (custom origin)
  cat > "$DISTRIBUTION_CONFIG_FILE" << EOF
{
  "CallerReference": "setup-$(date +%s)",
  "Aliases": {
    "Quantity": 1,
    "Items": ["${DOMAIN_NAME}"]
  },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${S3_BUCKET}",
        "DomainName": "${S3_WEBSITE_ENDPOINT}",
        "OriginPath": "",
        "CustomHeaders": {
          "Quantity": 0
        },
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": {
            "Quantity": 1,
            "Items": ["TLSv1.2"]
          },
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${S3_BUCKET}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6", 
    "Compress": true
  },
  "Comment": "CloudFront distribution for ${DOMAIN_NAME}",
  "Enabled": true,
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "HttpVersion": "http2",
  "PriceClass": "PriceClass_100",
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  }
}
EOF
else
  # Using S3 bucket directly (S3 origin)
  cat > "$DISTRIBUTION_CONFIG_FILE" << EOF
{
  "CallerReference": "setup-$(date +%s)",
  "Aliases": {
    "Quantity": 1,
    "Items": ["${DOMAIN_NAME}"]
  },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${S3_BUCKET}",
        "DomainName": "${S3_WEBSITE_ENDPOINT}",
        "OriginPath": "",
        "CustomHeaders": {
          "Quantity": 0
        },
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${S3_BUCKET}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6", 
    "Compress": true
  },
  "Comment": "CloudFront distribution for ${DOMAIN_NAME}",
  "Enabled": true,
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "HttpVersion": "http2",
  "PriceClass": "PriceClass_100",
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  }
}
EOF
fi

# Check if a distribution already exists for this domain
echo "🔍 Checking if CloudFront distribution already exists..."
EXISTING_DISTRO=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?contains(@, '${DOMAIN_NAME}')]].Id" --output text)

if [ -n "$EXISTING_DISTRO" ]; then
    echo "🔄 Found existing CloudFront distribution: $EXISTING_DISTRO"
    
    # Get the distribution config
    aws cloudfront get-distribution-config --id "$EXISTING_DISTRO" > existing-distro.json
    ETAG=$(grep -o '"ETag": "[^"]*"' existing-distro.json | cut -d'"' -f4)
    
    echo "🔄 Updating existing distribution..."
    # Extract and modify the distribution configuration
    jq '.DistributionConfig' existing-distro.json > updated-config.json
    
    # Update the distribution with our modified configuration
    aws cloudfront update-distribution --id "$EXISTING_DISTRO" --distribution-config file://updated-config.json --if-match "$ETAG"
    
    echo "✅ Updated CloudFront distribution: $EXISTING_DISTRO"
    DISTRIBUTION_ID="$EXISTING_DISTRO"
else
    echo "🔄 Creating new CloudFront distribution..."
    
    # Create the CloudFront distribution
    DISTRIBUTION_RESULT=$(aws cloudfront create-distribution --distribution-config file://$DISTRIBUTION_CONFIG_FILE)
    DISTRIBUTION_ID=$(echo "$DISTRIBUTION_RESULT" | grep -o '"Id": "[^"]*"' | head -1 | cut -d'"' -f4)
    
    echo "✅ Created CloudFront distribution: $DISTRIBUTION_ID"
fi

# Get the CloudFront domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id "$DISTRIBUTION_ID" --query "Distribution.DomainName" --output text)

echo "☁️ CloudFront distribution domain: $CLOUDFRONT_DOMAIN"

# Set up S3 bucket policy to allow CloudFront access
echo "🔄 Setting up S3 bucket policy for CloudFront..."

cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${S3_BUCKET}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy file://bucket-policy.json

echo "✅ S3 bucket policy updated successfully."

echo """
🎉 CloudFront distribution is set up!

To complete the setup:
1. Update your DNS for ${DOMAIN_NAME} with a CNAME record pointing to:
   ${CLOUDFRONT_DOMAIN}

2. If you're using Route 53, run:
   aws route53 change-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --change-batch '{
     \"Changes\": [{
       \"Action\": \"UPSERT\",
       \"ResourceRecordSet\": {
         \"Name\": \"${DOMAIN_NAME}\",
         \"Type\": \"CNAME\",
         \"TTL\": 300,
         \"ResourceRecords\": [{\"Value\": \"${CLOUDFRONT_DOMAIN}\"}]
       }
     }]
   }'

3. For SSL support, get an ACM certificate and update the distribution.

Your website will be available at:
https://${CLOUDFRONT_DOMAIN}

When DNS propagates, it will also be available at:
https://${DOMAIN_NAME}
"""

# Clean up temporary files
rm -f "$DISTRIBUTION_CONFIG_FILE" bucket-policy.json existing-distro.json updated-config.json 2>/dev/null || true 