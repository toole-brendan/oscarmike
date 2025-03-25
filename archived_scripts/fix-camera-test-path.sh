#!/bin/bash

# Script to fix the camera test page path
set -e

echo "=== Fixing Camera Test Page Path ==="

# Create the camera test page in the correct location
echo "Creating camera test page at correct path..."
mkdir -p dist/public
cp dist/camera-test.html dist/public/camera-test.html

# Upload to correct path in S3
echo "Uploading to correct path in S3..."
aws s3 cp dist/public/camera-test.html s3://ptchampion.ai/public/camera-test.html

# Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/public/camera-test.html"

echo ""
echo "=== Camera test page fix complete! ==="
echo ""
echo "Try accessing the camera test at: https://ptchampion.ai/public/camera-test.html"
echo "" 