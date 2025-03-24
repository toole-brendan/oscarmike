#!/bin/bash
set -e

echo "🔧 Setting up AWS CLI for OscarMike deployment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed."
    echo "Please install AWS CLI using the instructions at:"
    echo "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check AWS CLI version
AWS_VERSION=$(aws --version)
echo "✅ Found AWS CLI: $AWS_VERSION"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials are not configured properly."
    echo "You need to configure AWS CLI with your access key and secret key."
    echo ""
    echo "Please run the following command and provide your AWS credentials:"
    echo "aws configure"
    
    # Ask user if they want to configure now
    read -p "Would you like to configure AWS CLI now? (y/n): " configure_now
    if [[ $configure_now == "y" || $configure_now == "Y" ]]; then
        aws configure
    else
        echo "❌ Exiting. Please run 'aws configure' manually before proceeding."
        exit 1
    fi
else
    # Get current AWS configuration info
    ACCOUNT_INFO=$(aws sts get-caller-identity)
    ACCOUNT_ID=$(echo "$ACCOUNT_INFO" | grep -o '"Account": "[^"]*' | cut -d'"' -f4)
    USER_ARN=$(echo "$ACCOUNT_INFO" | grep -o '"Arn": "[^"]*' | cut -d'"' -f4)
    
    echo "✅ AWS credentials are configured properly."
    echo "Account ID: $ACCOUNT_ID"
    echo "User ARN: $USER_ARN"
    
    # Display current AWS region
    AWS_REGION=$(aws configure get region)
    if [ -z "$AWS_REGION" ]; then
        echo "⚠️ No AWS region is set. Using default region: us-east-1"
        AWS_REGION="us-east-1"
        aws configure set region "$AWS_REGION"
    else
        echo "✅ AWS region: $AWS_REGION"
    fi
fi

echo ""
echo "✅ AWS CLI setup complete."
echo ""
echo "To proceed with deployment:"
echo "1. Run './aws-deploy.sh' to deploy the application to AWS"
echo "2. Make sure you have the following permissions in your AWS account:"
echo "   - EC2: Create/manage instances, security groups, and key pairs"
echo "   - S3: Create/manage buckets and objects"
echo "   - CloudFront: Create/manage distributions"
echo "   - Route 53 (optional): Manage DNS records if using custom domain"
echo "" 