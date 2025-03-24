#!/bin/bash
set -e

# OscarMike Full AWS Deployment Script
# This script handles the complete AWS deployment process including:
# - Building the application
# - Setting up EC2 instance
# - Configuring S3 bucket
# - Setting up CloudFront distribution

echo "🚀 Starting full AWS deployment for OscarMike..."

# Check for required tools
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed. Please install AWS CLI and try again."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js and try again."
    exit 1
fi

# Variables - update these as needed
S3_BUCKET="ptchampion.ai"
DOMAIN_NAME="ptchampion.ai"
EC2_INSTANCE_TYPE="t2.micro"
EC2_KEY_NAME="ptchampion-key"
AWS_REGION="us-east-1"
CLOUDFRONT_DISTRIBUTION_ID="E1FRFF3JQNGRE1" # Update with your actual distribution ID if different

# Load environment variables
echo "📦 Loading production environment variables..."
if [ -f ".env.production" ]; then
    # Load env vars without comments
    set -a
    source <(grep -v '^#' .env.production)
    set +a
else
    echo "⚠️ .env.production file not found. Using default environment variables."
fi

# Step 1: Build the application
echo "🔨 Building application..."
npm install
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

# Step 2: Deploy to S3
echo "☁️ Deploying frontend to S3..."
# Check if bucket exists, create if not
if ! aws s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null; then
    echo "📦 Creating S3 bucket: $S3_BUCKET"
    aws s3api create-bucket --bucket "$S3_BUCKET" --region "$AWS_REGION"
    
    # Configure bucket for website hosting
    aws s3 website "s3://$S3_BUCKET/" --index-document index.html --error-document index.html
    
    # Set bucket policy for public access
    cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$S3_BUCKET/*"
        }
    ]
}
EOF
    aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy file://bucket-policy.json
    rm bucket-policy.json
fi

# Upload files to S3
echo "📤 Uploading files to S3..."
aws s3 sync dist/public/ "s3://$S3_BUCKET/" --delete

# Step 3: Setup CloudFront
echo "🌐 Setting up CloudFront..."
# Check if distribution exists
if aws cloudfront get-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID" &>/dev/null; then
    echo "✅ CloudFront distribution exists, creating invalidation..."
    aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
else
    echo "🔄 Setting up new CloudFront distribution..."
    
    # Get S3 website endpoint
    S3_REGION=$(aws s3api get-bucket-location --bucket "$S3_BUCKET" --query "LocationConstraint" --output text)
    if [ "$S3_REGION" = "None" ] || [ "$S3_REGION" = "null" ]; then
        S3_REGION="us-east-1"
    fi
    S3_WEBSITE_ENDPOINT="${S3_BUCKET}.s3-website-${S3_REGION}.amazonaws.com"
    
    # Create CloudFront distribution
    cat > cloudfront-config.json << EOF
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
    
    # Create the CloudFront distribution
    DISTRIBUTION_INFO=$(aws cloudfront create-distribution --distribution-config file://cloudfront-config.json)
    CLOUDFRONT_DISTRIBUTION_ID=$(echo "$DISTRIBUTION_INFO" | grep -o '"Id": "[^"]*' | cut -d'"' -f4)
    CLOUDFRONT_DOMAIN=$(echo "$DISTRIBUTION_INFO" | grep -o '"DomainName": "[^"]*' | cut -d'"' -f4)
    
    echo "✅ Created CloudFront distribution: $CLOUDFRONT_DISTRIBUTION_ID"
    echo "🌎 CloudFront domain: $CLOUDFRONT_DOMAIN"
    
    # Save the distribution ID for future reference
    echo "CLOUDFRONT_DISTRIBUTION_ID=$CLOUDFRONT_DISTRIBUTION_ID" > cloudfront-info.txt
    
    # Clean up
    rm cloudfront-config.json
fi

# Step 4: Deploy backend on EC2
echo "🖥️ Setting up EC2 instance..."

# Check if EC2 key pair exists, create if not
if ! aws ec2 describe-key-pairs --key-names "$EC2_KEY_NAME" &>/dev/null; then
    echo "🔑 Creating EC2 key pair: $EC2_KEY_NAME"
    aws ec2 create-key-pair --key-name "$EC2_KEY_NAME" --query "KeyMaterial" --output text > "${EC2_KEY_NAME}.pem"
    chmod 400 "${EC2_KEY_NAME}.pem"
fi

# Create security group
SECURITY_GROUP_NAME="ptchampion-sg"
SECURITY_GROUP_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SECURITY_GROUP_NAME" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null)

if [ "$SECURITY_GROUP_ID" = "None" ] || [ -z "$SECURITY_GROUP_ID" ]; then
    echo "🔒 Creating security group: $SECURITY_GROUP_NAME"
    SECURITY_GROUP_ID=$(aws ec2 create-security-group --group-name "$SECURITY_GROUP_NAME" --description "Security group for PTChampion app" --query "GroupId" --output text)
    
    # Allow SSH, HTTP and HTTPS
    aws ec2 authorize-security-group-ingress --group-id "$SECURITY_GROUP_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SECURITY_GROUP_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SECURITY_GROUP_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SECURITY_GROUP_ID" --protocol tcp --port 3000 --cidr 0.0.0.0/0
fi

# Use the updated user data script
cat ec2-user-data.sh > ec2-temp-user-data.sh

# Check if EC2 instance is already running
INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=ptchampion-server" "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].InstanceId" --output text)

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo "🚀 Launching new EC2 instance..."
    
    # Terminate any existing instances with the same name but not running
    OLD_INSTANCE_IDS=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=ptchampion-server" "Name=instance-state-name,Values=pending,stopping,stopped" --query "Reservations[].Instances[].InstanceId" --output text)
    if [ -n "$OLD_INSTANCE_IDS" ]; then
        echo "🧹 Cleaning up old instances..."
        for OLD_ID in $OLD_INSTANCE_IDS; do
            echo "   Terminating instance $OLD_ID"
            aws ec2 terminate-instances --instance-ids "$OLD_ID" > /dev/null
        done
    fi
    
    # Launch new instance with updated user data
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id ami-0e731c8a588258d0d \
        --instance-type "$EC2_INSTANCE_TYPE" \
        --key-name "$EC2_KEY_NAME" \
        --security-group-ids "$SECURITY_GROUP_ID" \
        --user-data file://ec2-temp-user-data.sh \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=ptchampion-server}]" \
        --query "Instances[0].InstanceId" \
        --output text)
    
    echo "⏳ Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
    
    # Get instance public IP
    INSTANCE_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
    echo "✅ EC2 instance launched with IP: $INSTANCE_IP"
    echo "🔑 Connect with: ssh -i ${EC2_KEY_NAME}.pem ec2-user@$INSTANCE_IP"
    
    # Wait for the instance to complete initialization
    echo "⏳ Waiting for instance initialization (this may take a few minutes)..."
    echo "   You can check the status with: ssh -i ${EC2_KEY_NAME}.pem ec2-user@$INSTANCE_IP 'sudo cat /var/log/cloud-init-output.log'"
    
    # Sleep for a short time to allow initialization to start
    sleep 10
else
    echo "✅ EC2 instance already running: $INSTANCE_ID"
    INSTANCE_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
    echo "🖥️ Instance IP: $INSTANCE_IP"
    
    # Update CloudFront distribution with the EC2 backend origin
    echo "🔄 Updating CloudFront configuration to point to EC2 backend..."
    EC2_DOMAIN="$INSTANCE_IP"
    
    # Update CloudFront origin for API requests
    if [ -f "update-cloudfront.js" ]; then
        echo "   Running CloudFront update script..."
        EC2_DOMAIN=$EC2_DOMAIN node update-cloudfront.js
    fi
fi

# Clean up temp file
rm -f ec2-temp-user-data.sh

echo "✅ Deployment complete!"
echo ""
echo "🌐 Frontend: https://$DOMAIN_NAME (via CloudFront)"
echo "🖥️ Backend: http://$INSTANCE_IP:3000 (via EC2)"
echo ""
echo "✨ Next steps:"
echo "1. Wait a few minutes for CloudFront distribution to fully deploy"
echo "2. If you're using a custom domain, configure Route 53 or your DNS provider to point to CloudFront"
echo "3. To SSH into your EC2 instance: ssh -i ${EC2_KEY_NAME}.pem ec2-user@$INSTANCE_IP" 