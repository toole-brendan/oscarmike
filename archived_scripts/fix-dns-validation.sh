#!/bin/bash
set -e

# DNS Validation Troubleshooting Script
DOMAIN_NAME="ptchampion.ai"
AWS_REGION="us-east-1"
CERT_ARN="arn:aws:acm:us-east-1:476114114609:certificate/f1809d71-c401-47f1-a212-41c5cfc91538"

echo "🔍 Checking certificate validation details for ${DOMAIN_NAME}..."

# Get certificate details
CERT_DETAILS=$(aws acm describe-certificate --certificate-arn $CERT_ARN --region $AWS_REGION)

# Extract validation info
VALIDATION_NAME=$(echo "$CERT_DETAILS" | grep -o '"Name": "[^"]*"' | head -1 | cut -d'"' -f4)
VALIDATION_VALUE=$(echo "$CERT_DETAILS" | grep -o '"Value": "[^"]*"' | head -1 | cut -d'"' -f4)
VALIDATION_STATUS=$(echo "$CERT_DETAILS" | grep -o '"ValidationStatus": "[^"]*"' | head -1 | cut -d'"' -f4)

echo "📝 Certificate Status: $VALIDATION_STATUS"
echo ""
echo "Validation record needs to be set up as follows:"
echo "----------------------------------------------"
echo "Record Type: CNAME"
echo "Name: $VALIDATION_NAME"
echo "Value: $VALIDATION_VALUE"
echo ""

# Remove domain from validation name for GoDaddy
GODADDY_NAME=$(echo "$VALIDATION_NAME" | sed "s/\.${DOMAIN_NAME}\.//")

echo "For GoDaddy, you should enter:"
echo "------------------------------"
echo "Record Type: CNAME"
echo "Name: $GODADDY_NAME  (without the domain part)"
echo "Value: $VALIDATION_VALUE"
echo "TTL: 1 Hour"
echo ""

# Check if it's set up correctly
echo "🔍 Testing if the DNS record is properly set..."
DIG_RESULT=$(dig @8.8.8.8 $VALIDATION_NAME CNAME)
FOUND_VALUE=$(echo "$DIG_RESULT" | grep -A1 "ANSWER SECTION" | tail -1 | awk '{print $5}')

if [ -z "$FOUND_VALUE" ]; then
    echo "❌ DNS record not found. Please create the CNAME record in GoDaddy."
    echo "It may take up to 48 hours for DNS changes to propagate globally."
else
    echo "✅ DNS record found!"
    echo "Record value: $FOUND_VALUE"
    
    if [[ "$FOUND_VALUE" == *"$VALIDATION_VALUE"* ]]; then
        echo "✅ Record value matches expected value!"
        echo "Certificate validation should proceed automatically."
        echo "This can take up to 30 minutes."
    else
        echo "❌ Record value does NOT match expected value."
        echo "Found: $FOUND_VALUE"
        echo "Expected: $VALIDATION_VALUE"
        echo "Please update the DNS record with the correct value."
    fi
fi

echo ""
echo "⚠️ GoDaddy DNS entries can be tricky. Here are some tips:"
echo "1. Make sure you're just entering '$GODADDY_NAME' in the Name field (not the full domain)"
echo "2. Some providers strip the trailing dot (.) - you might need to add it back"
echo "3. Ensure you've copied the exact validation value, including any dots at the end"
echo "4. Try adding a trailing dot to the Value if it's not accepting it without one"
echo ""
echo "After updating the DNS record, wait a few minutes and run this script again to verify." 