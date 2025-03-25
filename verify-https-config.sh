#!/bin/bash

# Script to verify and update HTTPS configuration for CloudFront distribution
# This ensures that the distribution is properly configured for secure camera access

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}HTTPS Configuration Verification for PT Champion${NC}"
echo "----------------------------------------"

# Use the hardcoded distribution ID from our CloudFront update script
DISTRIBUTION_ID="E1FRFF3JQNGRE1"

if [ -z "$DISTRIBUTION_ID" ]; then
  echo -e "${RED}Error: Could not find CloudFront distribution for PT Champion${NC}"
  echo "Please check your AWS credentials and region settings."
  exit 1
fi

echo -e "${GREEN}Using CloudFront Distribution: $DISTRIBUTION_ID${NC}"

# Get the current configuration
echo "Retrieving current configuration..."
TEMP_CONFIG_FILE="cloudfront-temp-config.json"
ETAG=$(aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --query "ETag" --output text)
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --query "DistributionConfig" --output json > $TEMP_CONFIG_FILE

echo "Checking HTTPS configuration..."

# Check if HTTPS is enforced
VIEWER_PROTOCOL_POLICY=$(cat $TEMP_CONFIG_FILE | grep -A 5 "DefaultCacheBehavior" | grep -A 2 "ViewerProtocolPolicy" | grep -o '"[^"]*"' | tail -1 | tr -d '"')

if [ "$VIEWER_PROTOCOL_POLICY" != "redirect-to-https" ]; then
  echo -e "${YELLOW}Warning: HTTPS redirection is not enforced.${NC}"
  echo "Updating configuration to enforce HTTPS..."
  
  # Use perl instead of sed for better compatibility with macOS
  perl -i -pe 's/"ViewerProtocolPolicy": "[^"]*"/"ViewerProtocolPolicy": "redirect-to-https"/g' $TEMP_CONFIG_FILE
  perl -i -pe 's/"ViewerProtocolPolicy": "allow-all"/"ViewerProtocolPolicy": "redirect-to-https"/g' $TEMP_CONFIG_FILE
  
  echo "Configuration updated, applying changes..."
  
  # Apply the updated configuration
  aws cloudfront update-distribution --id $DISTRIBUTION_ID --if-match $ETAG --distribution-config file://$TEMP_CONFIG_FILE
  
  echo -e "${GREEN}CloudFront configuration updated to enforce HTTPS.${NC}"
  echo "It may take up to 15 minutes for the changes to propagate."
  
  # Create invalidation to ensure changes take effect
  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
  echo "Created CloudFront invalidation to propagate changes faster."
else
  echo -e "${GREEN}HTTPS redirection is properly enforced.${NC}"
fi

# Check for proper CORS headers
echo "Checking response headers policy..."

# Look for the camera permissions policy
if ! grep -q "Permissions-Policy" $TEMP_CONFIG_FILE || ! grep -q "camera=" $TEMP_CONFIG_FILE; then
  echo -e "${YELLOW}Warning: Camera permissions policy may be missing.${NC}"
  echo "Please run the update-cloudfront-headers.cjs script to update headers."
  echo "Command: node update-cloudfront-headers.cjs"
else
  echo -e "${GREEN}Camera permissions policy appears to be configured.${NC}"
fi

# Clean up
rm $TEMP_CONFIG_FILE

echo -e "${BLUE}Configuration check complete.${NC}"
echo "For camera permissions to work correctly, ensure:"
echo "1. Your site is served over HTTPS"
echo "2. Proper Feature-Policy and Permissions-Policy headers are set"
echo "3. Content-Security-Policy allows media device access"

# Create CloudFront invalidation to ensure latest headers take effect
echo -e "${YELLOW}Creating CloudFront invalidation to ensure changes take effect...${NC}"
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo -e "${GREEN}✅ CloudFront invalidation created successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Deploy the updated webcam component to production"
echo "2. Test camera access in an incognito browser window after CloudFront changes propagate (5-15 minutes)" 