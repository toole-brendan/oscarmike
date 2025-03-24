#!/bin/bash
set -e

# CloudFront with SSL Certificate Setup Script
DOMAIN_NAME="ptchampion.ai"
S3_BUCKET="ptchampion.ai"
AWS_REGION="us-east-1"  # ACM certificates for CloudFront must be in us-east-1

echo "🔐 Setting up SSL Certificate and CloudFront for ${DOMAIN_NAME}"

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

# Step 1: Check if certificate already exists
echo "🔍 Checking for existing certificates for ${DOMAIN_NAME}..."
EXISTING_CERT_ARN=$(aws acm list-certificates --region $AWS_REGION --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" --output text)

if [ -z "$EXISTING_CERT_ARN" ]; then
    echo "🔄 No existing certificate found. Requesting a new SSL certificate..."
    CERT_ARN=$(aws acm request-certificate \
        --domain-name $DOMAIN_NAME \
        --validation-method DNS \
        --region $AWS_REGION \
        --output text \
        --query 'CertificateArn')
    
    echo "✅ Certificate requested: $CERT_ARN"
else
    echo "✅ Using existing certificate: $EXISTING_CERT_ARN"
    CERT_ARN=$EXISTING_CERT_ARN
fi

# Step 2: Get validation information
echo "🔄 Getting domain validation details..."
sleep 5  # Give AWS a moment to process the certificate request

VALIDATION_DETAILS=$(aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --region $AWS_REGION \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord')

# Extract validation information
VALIDATION_NAME=$(echo $VALIDATION_DETAILS | jq -r '.Name')
VALIDATION_VALUE=$(echo $VALIDATION_DETAILS | jq -r '.Value')
VALIDATION_TYPE=$(echo $VALIDATION_DETAILS | jq -r '.Type')

# Check if we have the validation details
if [ -z "$VALIDATION_NAME" ] || [ "$VALIDATION_NAME" = "null" ]; then
    echo "⚠️ Validation details not yet available. Please try again in a few seconds."
    echo ""
    echo "To continue setup, run this command when validation details are available:"
    echo "aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION"
    echo ""
    echo "Once you see the ResourceRecord information, you need to create this DNS record at your DNS provider:"
    echo "Then run this script again with: ./setup-ssl-cloudfront.sh --continue $CERT_ARN"
    exit 0
fi

# Continue setup if we have the validation details or --continue flag was passed
if [ "$1" = "--continue" ] && [ ! -z "$2" ]; then
    CERT_ARN=$2
    echo "🔄 Continuing setup with certificate: $CERT_ARN"
fi

# Step 3: Display validation instructions
echo ""
echo "📝 Domain Validation Required"
echo "=============================="
echo "Create the following CNAME record in your DNS settings:"
echo ""
echo "Record Name: $VALIDATION_NAME"
echo "Record Value: $VALIDATION_VALUE"
echo "Record Type: $VALIDATION_TYPE"
echo ""
echo "⚠️ IMPORTANT: You must create this DNS record before continuing."
echo "The SSL certificate cannot be issued until DNS validation is complete."
echo ""

# Step 4: Prompt to continue
read -p "Have you added the DNS record? (y/n): " DNS_CONFIRMED

if [ "$DNS_CONFIRMED" != "y" ] && [ "$DNS_CONFIRMED" != "Y" ]; then
    echo "Please add the DNS record and run this script again with: ./setup-ssl-cloudfront.sh --continue $CERT_ARN"
    exit 0
fi

# Step 5: Wait for certificate validation
echo "🔄 Waiting for certificate validation. This can take up to 30 minutes..."
aws acm wait certificate-validated --certificate-arn $CERT_ARN --region $AWS_REGION

if [ $? -ne 0 ]; then
    echo "⚠️ Certificate validation is taking longer than expected."
    echo "This is normal and can sometimes take several hours depending on DNS propagation."
    echo ""
    echo "You can check the status with:"
    echo "aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION"
    echo ""
    echo "Once validated, run this script again with: ./setup-ssl-cloudfront.sh --continue $CERT_ARN"
    exit 0
fi

echo "✅ Certificate has been validated successfully!"

# Step 6: Configure S3 bucket
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
    echo "⚠️ S3 website hosting is not enabled, using S3 bucket as origin"
    S3_WEBSITE_ENDPOINT="${S3_BUCKET}.s3.${S3_BUCKET_REGION}.amazonaws.com"
    USE_WEBSITE_ENDPOINT=false
fi

echo "📊 Using S3 endpoint: $S3_WEBSITE_ENDPOINT"

# Step 7: Set up CloudFront distribution
echo "🔄 Setting up CloudFront distribution..."

# Create CloudFront configuration file
DISTRIBUTION_CONFIG_FILE="cloudfront-config.json"

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

# Step 8: Set up S3 bucket policy to allow CloudFront access
echo "🔄 Setting up S3 bucket policy for CloudFront..."

if [ "$USE_WEBSITE_ENDPOINT" = true ]; then
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
else
    # For S3 origin, we should restrict access to CloudFront only (but need OAI for that)
    # Using public read access for now
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
fi

aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy file://bucket-policy.json

echo "✅ S3 bucket policy updated successfully."

# Step 9: Set up DNS record for CloudFront distribution
echo ""
echo "📝 DNS Setup Required"
echo "======================"
echo "Create the following record in your DNS settings to point your domain to CloudFront:"
echo ""
echo "Record Name: ${DOMAIN_NAME}"
echo "Record Type: CNAME"
echo "Record Value: ${CLOUDFRONT_DOMAIN}"
echo ""

# If Route 53 is the DNS provider, offer to set it up automatically
read -p "Are you using Route 53 for DNS management? (y/n): " USING_ROUTE53

if [ "$USING_ROUTE53" = "y" ] || [ "$USING_ROUTE53" = "Y" ]; then
    echo "🔄 Getting Route 53 hosted zone ID..."
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "${DOMAIN_NAME}." --query "HostedZones[0].Id" --output text)
    
    if [ -z "$HOSTED_ZONE_ID" ] || [ "$HOSTED_ZONE_ID" = "None" ]; then
        echo "❌ Could not find a Route 53 hosted zone for ${DOMAIN_NAME}"
        echo "Please create the DNS record manually."
    else
        # Remove /hostedzone/ prefix
        HOSTED_ZONE_ID=$(echo $HOSTED_ZONE_ID | sed 's/\/hostedzone\///')
        echo "✅ Found Route 53 hosted zone: $HOSTED_ZONE_ID"
        
        # Create change batch file
        cat > dns-change.json << EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN_NAME}",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "${CLOUDFRONT_DOMAIN}"
          }
        ]
      }
    }
  ]
}
EOF
        
        # Apply the change
        aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch file://dns-change.json
        
        echo "✅ DNS record created successfully in Route 53!"
    fi
else
    echo "Please create the DNS record manually with your DNS provider."
fi

echo """
🎉 SSL Certificate and CloudFront setup complete!

Your website will be available at:
https://${CLOUDFRONT_DOMAIN}

When DNS propagates, it will also be available at:
https://${DOMAIN_NAME}

Note: DNS changes and SSL certificate validation can take up to 24-48 hours to fully propagate.
"""

# Clean up temporary files
rm -f "$DISTRIBUTION_CONFIG_FILE" bucket-policy.json existing-distro.json updated-config.json updated-config-cert.json dns-change.json 2>/dev/null || true 