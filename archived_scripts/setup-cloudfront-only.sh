#!/bin/bash
set -e

# CloudFront Setup Script for ptchampion.ai
DOMAIN_NAME="ptchampion.ai"
S3_BUCKET="ptchampion.ai"
AWS_REGION="us-east-1"

# Certificate ARN - replace with the ARN of your validated certificate
# Original DNS validation certificate: 
# arn:aws:acm:us-east-1:476114114609:certificate/f1809d71-c401-47f1-a212-41c5cfc91538
# 
# Email validation certificate:
# arn:aws:acm:us-east-1:476114114609:certificate/c6465057-f102-43f8-a96c-a52708b2a7c8
CERT_ARN="arn:aws:acm:us-east-1:476114114609:certificate/f1809d71-c401-47f1-a212-41c5cfc91538"

echo "🔐 Setting up CloudFront distribution for ${DOMAIN_NAME}"

# Check for required tools
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed. Please install AWS CLI and try again."
    exit 1
fi

# Check AWS credentials
aws sts get-caller-identity &> /dev/null || {
    echo "❌ AWS credentials not configured properly. Please run 'aws configure' first."
    exit 1
}

# Verify certificate is valid
echo "🔍 Checking certificate status..."
CERT_STATUS=$(aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION --query 'Certificate.Status' --output text)

if [ "$CERT_STATUS" != "ISSUED" ]; then
    echo "⚠️ Certificate is not yet valid. Current status: $CERT_STATUS"
    echo "Please validate the certificate first by checking the email sent to admin@ptchampion.ai"
    echo "or any other administrative email addresses associated with your domain."
    echo "Once validated, run this script again."
    exit 1
fi

echo "✅ Certificate is valid!"

# Configure S3 bucket
echo "🔄 Checking S3 bucket configuration..."

# Try to get the bucket region
S3_BUCKET_REGION=$(aws s3api get-bucket-location --bucket "$S3_BUCKET" --query "LocationConstraint" --output text)
if [ "$S3_BUCKET_REGION" = "None" ] || [ "$S3_BUCKET_REGION" = "null" ]; then
    S3_BUCKET_REGION="us-east-1"
fi

echo "📊 S3 bucket region: $S3_BUCKET_REGION"

# Check if S3 website hosting is enabled
if aws s3api get-bucket-website --bucket "$S3_BUCKET" 2>/dev/null; then
    echo "✅ S3 website hosting is enabled"
    S3_WEBSITE_ENDPOINT="${S3_BUCKET}.s3-website-${S3_BUCKET_REGION}.amazonaws.com"
    USE_WEBSITE_ENDPOINT=true
else
    echo "⚠️ S3 website hosting is not enabled, enabling it now..."
    aws s3 website s3://$S3_BUCKET --index-document index.html --error-document index.html
    echo "✅ S3 website hosting enabled"
    S3_WEBSITE_ENDPOINT="${S3_BUCKET}.s3-website-${S3_BUCKET_REGION}.amazonaws.com"
    USE_WEBSITE_ENDPOINT=true
fi

echo "📊 Using S3 endpoint: $S3_WEBSITE_ENDPOINT"

# Set up CloudFront distribution
echo "🔄 Setting up CloudFront distribution..."

# Create CloudFront configuration file
DISTRIBUTION_CONFIG_FILE="cloudfront-config.json"

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
    "ACMCertificateArn": "${CERT_ARN}",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "CloudFrontDefaultCertificate": false
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
    
    # Update the ViewerCertificate section
    jq --arg cert "$CERT_ARN" '.ViewerCertificate = {"ACMCertificateArn": $cert, "SSLSupportMethod": "sni-only", "MinimumProtocolVersion": "TLSv1.2_2021", "CloudFrontDefaultCertificate": false}' updated-config.json > updated-config-cert.json
    
    # Update the distribution with our modified configuration
    aws cloudfront update-distribution --id "$EXISTING_DISTRO" --distribution-config file://updated-config-cert.json --if-match "$ETAG"
    
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

# For website endpoint, we need public read access
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

# Set up DNS record for CloudFront distribution
echo ""
echo "📝 DNS Setup Required"
echo "======================"
echo "Create the following record in GoDaddy DNS settings to point your domain to CloudFront:"
echo ""
echo "Record Type: CNAME"
echo "Name: @"
echo "Value: ${CLOUDFRONT_DOMAIN}"
echo "TTL: 1 Hour"
echo ""

echo """
🎉 CloudFront distribution is set up!

Your website will be available at:
https://${CLOUDFRONT_DOMAIN}

After updating your DNS in GoDaddy to point to CloudFront, it will also be available at:
https://${DOMAIN_NAME}

Note: DNS changes can take up to 24-48 hours to fully propagate.
"""

# Clean up temporary files
rm -f "$DISTRIBUTION_CONFIG_FILE" bucket-policy.json existing-distro.json updated-config.json updated-config-cert.json 2>/dev/null || true 