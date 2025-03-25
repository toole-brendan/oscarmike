#!/bin/bash

# Script to deploy camera test page and apply all fixes
set -e

echo "=== Deploying Camera Test Page and Applying All Fixes ==="

# 1. Update CloudFront headers
echo "Updating CloudFront headers to allow camera access..."
node update-cloudfront-headers.cjs

# 2. Copy camera test page to S3
echo "Uploading camera test page to S3..."
aws s3 cp camera-header-test.html s3://ptchampion.ai/camera-test.html --content-type "text/html"

# 3. Force CloudFront to pick up new headers with a complete invalidation
echo "Forcing CloudFront cache invalidation..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/*"

echo ""
echo "=== Deployment Complete! ==="
echo ""
echo "The following changes were made:"
echo "1. Updated Content-Security-Policy and camera permissions headers"
echo "2. Uploaded camera test page to your S3 bucket"
echo "3. Invalidated CloudFront cache to ensure changes take effect immediately"
echo ""
echo "You can now test camera access at:"
echo "https://ptchampion.ai/camera-test.html"
echo ""
echo "It may take 5-15 minutes for the changes to fully propagate through CloudFront."
echo "After that time, please try your application again." 