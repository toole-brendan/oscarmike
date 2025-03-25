#!/bin/bash
set -e

echo "=== Creating CloudFront Invalidation to Apply Headers ==="

# Run the script that updates the CloudFront distribution with security headers
echo "Ensuring Response Headers Policy is applied to CloudFront distribution..."
node update-cloudfront-headers.cjs

# Check if the update was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to update CloudFront distribution with security headers"
  exit 1
fi

echo "CloudFront distribution updated successfully with security headers!"

# 4. Create CloudFront invalidation to apply changes immediately
echo "Creating CloudFront invalidation to apply changes immediately..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/*"

echo ""
echo "=== CloudFront invalidation created! ==="
echo ""
echo "Please note: CloudFront distribution updates can take up to 15-30 minutes to fully propagate,"
echo "but the invalidation should make the new headers available within a few minutes."
echo ""
echo "Next steps:"
echo "1. Wait 3-5 minutes for the invalidation to complete"
echo "2. Test your site again to verify camera permissions are now working"
echo "3. Check the browser's Network tab to confirm the security headers are being sent"
echo "   - Content-Security-Policy (with frame-ancestors directive)"
echo "   - Permissions-Policy (with camera= directive using parentheses)"
echo "   - Feature-Policy"
echo ""
