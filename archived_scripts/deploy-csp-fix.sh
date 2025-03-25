#!/bin/bash

# Script to deploy Content Security Policy fixes for TensorFlow and camera access
set -e

echo "=== Deploying CSP and Camera Permission Fixes ==="

# 1. Make script executable
chmod +x "${0}"

# 2. Rebuild application with updated CSP in HTML
echo "Rebuilding application with updated CSP in index.html..."
npm run build

# 3. Verify the build output has correct CSP headers
echo "Verifying build output has correct CSP headers..."
grep -n "Content-Security-Policy" dist/public/index.html

# 4. Deploy to S3
echo "Deploying to S3 bucket..."
aws s3 sync dist/public/ s3://ptchampion.ai/ --delete

# 5. Update CloudFront headers
echo "Updating CloudFront distribution headers..."
node update-cloudfront-headers.cjs

# 6. Force CloudFront to pick up new content with a complete invalidation
echo "Forcing CloudFront cache invalidation..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/*"

echo ""
echo "=== Fixes deployed! ==="
echo ""
echo "The following changes were made:"
echo "1. Updated CSP in index.html to allow TensorFlow Hub domains"
echo "2. Added mediadevice: to media-src in CSP"
echo "3. Updated Feature-Policy and Permissions-Policy to fully enable camera access"
echo "4. Updated CloudFront distribution headers to match these settings"
echo ""
echo "It may take 5-15 minutes for the changes to fully propagate through CloudFront."
echo "After that time, the application should be able to load the TensorFlow models and access the camera." 