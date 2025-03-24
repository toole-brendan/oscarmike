# AWS Deployment Guide for PT Champion

This comprehensive guide walks you through deploying the PT Champion application to AWS, with detailed steps to avoid common deployment issues.

## Architecture Overview

The PT Champion deployment architecture consists of:

1. **Frontend**: React application deployed to S3 and served via CloudFront CDN
2. **Backend**: Node.js/Express API deployed on EC2
3. **Database**: PostgreSQL on AWS RDS
4. **Caching**: Redis (optional, for improved performance)

## Prerequisites

1. An AWS account with appropriate permissions
2. AWS CLI installed and configured on your local machine
3. Node.js and npm installed
4. Git for version control

## Initial AWS Setup

### 1. Configure AWS CLI

Ensure your AWS CLI is set up correctly:

```bash
# Install AWS CLI if not already installed
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure with your credentials
aws configure
```

Provide the following when prompted:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Default output format (json is recommended)

### 2. Set Environment Variables

Create a `.env.production` file with your production settings:

```
NODE_ENV=production
NODE_TLS_REJECT_UNAUTHORIZED=0

# AWS RDS PostgreSQL Connection
DATABASE_URL=postgres://[username]:[password]@[rds-endpoint]:5432/[database]

# JWT configuration
# Use a strong, randomly generated secret
JWT_SECRET=[generate-a-secure-random-string]
JWT_EXPIRES_IN=24h

# Redis configuration for caching (if using ElastiCache)
REDIS_URL=redis://[redis-endpoint]:6379
CACHE_TTL=300 # 5 minutes in seconds
DISABLE_CACHE=false

# Server port configuration
PORT=3000
```

Replace placeholder values with your actual configuration.

## Detailed Deployment Process

### 1. Database Setup (RDS)

```bash
# Create a PostgreSQL database instance
aws rds create-db-instance \
    --db-instance-identifier ptchampion-1-instance-1 \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --allocated-storage 20 \
    --master-username postgres \
    --master-user-password [your-secure-password] \
    --vpc-security-group-ids [security-group-id] \
    --publicly-accessible \
    --port 5432

# Wait for the instance to be available
aws rds wait db-instance-available --db-instance-identifier ptchampion-1-instance-1
```

Make sure to create a security group that allows inbound connections on port 5432 from your EC2 instances.

### 2. Create EC2 Security Group

```bash
# Create security group
aws ec2 create-security-group \
    --group-name ptchampion-sg \
    --description "Security group for PT Champion application"

# Allow SSH (port 22), HTTP (port 80), HTTPS (port 443), and API (port 3000)
aws ec2 authorize-security-group-ingress \
    --group-name ptchampion-sg \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name ptchampion-sg \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name ptchampion-sg \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name ptchampion-sg \
    --protocol tcp \
    --port 3000 \
    --cidr 0.0.0.0/0
```

### 3. Create EC2 Key Pair

```bash
# Create a key pair for SSH access
aws ec2 create-key-pair \
    --key-name ptchampion-key \
    --query "KeyMaterial" \
    --output text > ptchampion-key.pem

# Set proper permissions
chmod 400 ptchampion-key.pem
```

### 4. Launch EC2 Instance for Backend

```bash
# Launch EC2 instance
aws ec2 run-instances \
    --image-id ami-0e731c8a588258d0d \
    --instance-type t2.micro \
    --key-name ptchampion-key \
    --security-group-ids [security-group-id] \
    --user-data file://ec2-user-data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=ptchampion-server}]"
```

The EC2 instance needs an IAM role with permissions to access other AWS services like S3 and RDS.

### 5. Create S3 Bucket for Frontend

```bash
# Create S3 bucket
aws s3api create-bucket \
    --bucket ptchampion.ai \
    --region us-east-1

# Configure bucket for website hosting
aws s3 website s3://ptchampion.ai/ \
    --index-document index.html \
    --error-document index.html

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
            "Resource": "arn:aws:s3:::ptchampion.ai/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket ptchampion.ai \
    --policy file://bucket-policy.json
```

### 6. Build and Deploy Frontend

```bash
# Build frontend
npm install
npm run build

# Deploy to S3
aws s3 sync dist/public/ s3://ptchampion.ai/ --delete
```

### 7. Set Up CloudFront Distribution

This step is critical for proper API routing. Create a CloudFront distribution with two origins:

1. S3 bucket for static assets
2. EC2 instance for API endpoints

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
    --distribution-config file://cloudfront-config.json
```

The `cloudfront-config.json` file must include:

```json
{
  "CallerReference": "setup-1742822491",
  "Aliases": {
    "Quantity": 1,
    "Items": [
      "ptchampion.ai"
    ]
  },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "S3-ptchampion.ai",
        "DomainName": "ptchampion.ai.s3-website-us-east-1.amazonaws.com",
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
            "Items": [
              "TLSv1.2"
            ]
          },
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {
          "Enabled": false
        }
      },
      {
        "Id": "ApiBackend",
        "DomainName": "[YOUR-EC2-PUBLIC-DNS]",
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
            "Items": [
              "TLSv1.2"
            ]
          },
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {
          "Enabled": false
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-ptchampion.ai",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": [
        "GET",
        "HEAD"
      ],
      "CachedMethods": {
        "Quantity": 2,
        "Items": [
          "GET",
          "HEAD"
        ]
      }
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "ApiBackend",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 7,
          "Items": [
            "GET",
            "HEAD",
            "OPTIONS",
            "PUT",
            "POST",
            "PATCH",
            "DELETE"
          ],
          "CachedMethods": {
            "Quantity": 2,
            "Items": [
              "GET",
              "HEAD"
            ]
          }
        },
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
      }
    ]
  },
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
  },
  "Comment": "CloudFront distribution for ptchampion.ai",
  "PriceClass": "PriceClass_100",
  "Enabled": true,
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "HttpVersion": "http2",
  "IsIPV6Enabled": true
}
```

### 8. Configure EC2 Backend

Create an `ec2-user-data.sh` script:

```bash
#!/bin/bash
yum update -y
yum install -y git
curl -sL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
npm install -g pm2

# Install nginx for reverse proxy
amazon-linux-extras install -y nginx1 || dnf install -y nginx

# Clone repository
cd /home/ec2-user
git clone https://github.com/brendan-toole/oscarmike.git ptchampion
cd ptchampion

# Install dependencies and build
npm install
npm run build

# Create .env.production file
cat > .env.production << 'ENVEOF'
NODE_ENV=production
NODE_TLS_REJECT_UNAUTHORIZED=0

# AWS RDS PostgreSQL Connection
DATABASE_URL=postgres://[username]:[password]@[rds-endpoint]:5432/[database]

# JWT configuration
JWT_SECRET=[your-secure-jwt-secret]
JWT_EXPIRES_IN=24h

# Redis configuration for caching
REDIS_URL=redis://localhost:6379
CACHE_TTL=300 # 5 minutes in seconds
DISABLE_CACHE=true

# Server port configuration
PORT=3000
ENVEOF

# Start the server with PM2
NODE_ENV=production pm2 start dist/index.js --name ptchampion-api
pm2 startup
pm2 save

# Configure Nginx as a reverse proxy
cat > /etc/nginx/conf.d/ptchampion.conf << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx
```

## Database Security Configuration

### Configure the RDS Security Group to Allow EC2 Access

This step is critical to allow your EC2 instance to connect to the RDS database:

```bash
# Get EC2 instance security group ID
EC2_SG_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=ptchampion-server" \
    --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" \
    --output text)

# Get RDS security group ID
RDS_SG_ID=$(aws rds describe-db-instances \
    --db-instance-identifier ptchampion-1-instance-1 \
    --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" \
    --output text)

# Allow EC2 security group to access RDS on port 5432
aws ec2 authorize-security-group-ingress \
    --group-id $RDS_SG_ID \
    --protocol tcp \
    --port 5432 \
    --source-group $EC2_SG_ID
```

## CloudFront Configuration for API Routing

### Critical Configuration Points

1. **Ensure the correct EC2 domain:** Always use the current EC2 public DNS or IP
2. **Configure proper cache behaviors:**
   - Use `CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"` (CachingDisabled policy)
   - Use `OriginRequestPolicyId: "216adef6-5c7f-47e4-b989-5492eafa07d3"` (AllViewer policy)
3. **Include all HTTP methods for API routes:**
   - Include all methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
4. **Create invalidations after updates:**
   - Always create a CloudFront invalidation after updating distribution

```bash
# Update CloudFront distribution when EC2 instance changes
# Get the current ETag first
ETAG=$(aws cloudfront get-distribution \
    --id [DISTRIBUTION_ID] \
    --query "ETag" \
    --output text)

# Modify the distribution-config.json file with the new EC2 domain
# Then update the distribution
aws cloudfront update-distribution \
    --id [DISTRIBUTION_ID] \
    --if-match $ETAG \
    --distribution-config file://updated-distribution-config.json

# Create invalidation for API routes
aws cloudfront create-invalidation \
    --distribution-id [DISTRIBUTION_ID] \
    --paths "/api/*"
```

## JWT Security Configuration

For security, always use a strong random JWT secret in production, never a placeholder:

```bash
# Generate a secure random JWT secret
NEW_JWT_SECRET=$(openssl rand -hex 32)

# Update the .env.production file on the EC2 instance
ssh -i ptchampion-key.pem ec2-user@[EC2-PUBLIC-DNS] "
sudo sed -i \"s|JWT_SECRET=.*|JWT_SECRET=${NEW_JWT_SECRET}|\" /home/ec2-user/ptchampion/.env.production
sudo pm2 restart ptchampion-api
"
```

## Troubleshooting Common Issues

### 1. CloudFront API Routing Issues (405 Method Not Allowed)

If you receive a 405 Method Not Allowed error when making POST/PUT/DELETE requests:

1. Check that your CloudFront distribution's cache behavior for the `/api/*` path pattern:
   - Has all HTTP methods included in AllowedMethods
   - Uses a CachingDisabled policy (ID: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad)
   - Uses the AllViewer origin request policy (ID: 216adef6-5c7f-47e4-b989-5492eafa07d3)

2. Verify the API origin domain is correct:
   ```bash
   aws cloudfront get-distribution-config \
     --id [DISTRIBUTION_ID] \
     --query "DistributionConfig.Origins.Items[?Id=='ApiBackend'].DomainName" \
     --output text
   ```

3. Create an invalidation after changes:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id [DISTRIBUTION_ID] \
     --paths "/api/*"
   ```

### 2. Database Connection Issues

If your backend can't connect to the database:

1. Check RDS security group inbound rules allow traffic from EC2 security group:
   ```bash
   # Get EC2 security group
   EC2_SG=$(aws ec2 describe-instances \
     --filters "Name=tag:Name,Values=ptchampion-server" \
     --query "Reservations[0].Instances[0].SecurityGroups[0].GroupId" \
     --output text)
   
   # Get RDS security group
   RDS_SG=$(aws rds describe-db-instances \
     --db-instance-identifier ptchampion-1-instance-1 \
     --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" \
     --output text)
   
   # Add inbound rule if needed
   aws ec2 authorize-security-group-ingress \
     --group-id $RDS_SG \
     --protocol tcp \
     --port 5432 \
     --source-group $EC2_SG
   ```

2. Verify the database connection string in the EC2 environment:
   ```bash
   ssh -i ptchampion-key.pem ec2-user@[EC2-PUBLIC-DNS] "sudo cat /home/ec2-user/ptchampion/.env.production | grep DATABASE_URL"
   ```

3. Check RDS instance status:
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier ptchampion-1-instance-1 \
     --query "DBInstances[0].DBInstanceStatus" \
     --output text
   ```

### 3. Backend Server Issues

If the backend isn't responding:

1. SSH into the EC2 instance:
   ```bash
   ssh -i ptchampion-key.pem ec2-user@[EC2-PUBLIC-DNS]
   ```

2. Check the application status:
   ```bash
   sudo pm2 status
   sudo pm2 logs ptchampion-api --lines 50
   ```

3. Restart the application:
   ```bash
   sudo pm2 restart ptchampion-api
   ```

4. Check nginx configuration:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

## Deployment Checklist

Use this checklist to ensure all aspects of the deployment are properly configured:

- [ ] RDS database created and publicly accessible
- [ ] EC2 security group created with proper inbound rules
- [ ] EC2 instance launched with correct user data script
- [ ] Database security group allows connections from EC2 security group
- [ ] S3 bucket created and configured for static website hosting
- [ ] Frontend built and uploaded to S3
- [ ] CloudFront distribution created with proper origins and cache behaviors
- [ ] Check CloudFront API routing configuration (methods, policies)
- [ ] Verify JWT secret is securely generated in production
- [ ] Create CloudFront invalidation after any distribution changes
- [ ] Test API endpoints through both direct EC2 and CloudFront URLs
- [ ] Monitor application logs for any errors

## Maintenance and Updates

### Updating the Backend

```bash
# SSH into the instance
ssh -i ptchampion-key.pem ec2-user@[EC2-PUBLIC-DNS]

# Navigate to the project directory
cd /home/ec2-user/ptchampion

# Pull latest changes
sudo git pull

# Install dependencies and build
sudo npm install
sudo npm run build

# Restart the application
sudo pm2 restart ptchampion-api
```

### Updating the Frontend

```bash
# Build frontend locally
npm run build

# Deploy to S3
aws s3 sync dist/public/ s3://ptchampion.ai/ --delete

# Create CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION_ID] \
  --paths "/*"
```

### Updating CloudFront Configuration

Always get the current ETag before updating:

```bash
# Get current ETag
ETAG=$(aws cloudfront get-distribution \
  --id [DISTRIBUTION_ID] \
  --query "ETag" \
  --output text)

# Download current config
aws cloudfront get-distribution-config \
  --id [DISTRIBUTION_ID] > current-config.json

# Edit the config, then update
aws cloudfront update-distribution \
  --id [DISTRIBUTION_ID] \
  --if-match $ETAG \
  --distribution-config file://updated-config.json
```

## Conclusion

By following this detailed guide, you should be able to deploy the PT Champion application to AWS without encountering the common issues. The guide emphasizes the proper configuration of CloudFront for API routing and ensuring database connectivity from the EC2 instance. 