#!/bin/bash
set -e

# OscarMike Production Deployment Script

echo "🚀 Starting deployment process for OscarMike..."

# Check for required tools
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js and try again."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed. Please install npm and try again."
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed. Please install AWS CLI and try again."
    exit 1
fi

# Make sure we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the project root directory."
    exit 1
fi

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

# Verify database connection
echo "🔍 Verifying connection to AWS RDS PostgreSQL..."
DB_HOST="ptchampion-1-instance-1.ck9iecaw2h6w.us-east-1.rds.amazonaws.com"
if pg_isready -h $DB_HOST -p 5432; then
    echo "✅ Successfully connected to AWS RDS PostgreSQL"
else
    echo "❌ Cannot connect to AWS RDS PostgreSQL. Please check your database configuration."
    echo "🔄 Continuing deployment anyway, but be aware the database connection may fail."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the project
echo "🔨 Building project..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:push

# Deploy frontend to S3
echo "☁️ Deploying frontend to S3..."
if [ -d "dist" ]; then
    # Check AWS credentials
    aws sts get-caller-identity &> /dev/null || {
        echo "❌ AWS credentials not configured properly. Please run 'aws configure' first."
        exit 1
    }
    
    # Get the bucket ownership settings
    echo "🔍 Checking S3 bucket configuration..."
    BUCKET_OWNERSHIP=$(aws s3api get-bucket-ownership-controls --bucket ptchampion.ai --output json 2>/dev/null || echo '{"OwnershipControls":{"Rules":[{"ObjectOwnership":"BucketOwnerEnforced"}]}}')
    
    if echo "$BUCKET_OWNERSHIP" | grep -q "BucketOwnerEnforced"; then
        echo "ℹ️ Bucket has Object Ownership set to BucketOwnerEnforced, skipping ACL parameters"
        USE_ACL=false
    else
        echo "ℹ️ Using ACLs for bucket access control"
        USE_ACL=true
    fi
    
    # Enable static website hosting on the S3 bucket if not already enabled
    echo "🌐 Configuring S3 bucket for static website hosting..."
    aws s3 website s3://ptchampion.ai/ --index-document index.html --error-document index.html
    
    # Upload files to S3
    echo "📤 Uploading files to S3..."
    if [ "$USE_ACL" = true ]; then
        aws s3 sync dist/public/ s3://ptchampion.ai/ --delete --acl public-read
    else
        aws s3 sync dist/public/ s3://ptchampion.ai/ --delete
    fi
    
    echo "🌎 Website deployed to https://ptchampion.ai"
else
    echo "❌ dist directory not found. Build may have failed."
    exit 1
fi

# Create CloudFront invalidation to refresh cache
echo "☁️ Creating CloudFront invalidation..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/*"

# Start the server
echo "🚀 Starting server in production mode using AWS RDS PostgreSQL..."
NODE_ENV=production pm2 start dist/index.js --name ptchampion-api

echo "✅ Deployment completed successfully!" 