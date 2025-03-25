#!/bin/bash

# Script to deploy camera and TensorFlow fixes
set -e

echo "=== Deploying Camera and TensorFlow Fixes ==="

# 1. Update CloudFront headers
echo "Updating CloudFront headers..."
node update-cloudfront-headers.cjs

# 2. Rebuild and deploy to ensure headers are used
echo "Rebuilding and deploying application..."
npm run build
aws s3 sync dist/public/ s3://ptchampion.ai/ --delete

# 3. Force CloudFront to pick up new headers with a complete invalidation
echo "Forcing CloudFront cache invalidation..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/*"

echo ""
echo "=== Fixes deployed! ==="
echo ""
echo "The following changes were made:"
echo "1. Added TensorFlow domains to Content-Security-Policy to allow model loading"
echo "2. Relaxed camera permissions to ensure they work across browsers"
echo ""
echo "It may take 5-15 minutes for the changes to fully propagate through CloudFront."
echo "After that time, please try your application again." 