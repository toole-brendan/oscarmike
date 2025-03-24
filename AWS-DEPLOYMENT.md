# AWS Deployment Guide for OscarMike

This guide walks you through deploying the OscarMike application to AWS using EC2, S3, and CloudFront.

## Prerequisites

1. An AWS account with appropriate permissions
2. AWS CLI installed and configured on your local machine
3. Node.js and npm installed
4. Git for version control

## AWS Setup

1. First, ensure your AWS CLI is set up correctly by running:
   ```bash
   chmod +x aws-setup.sh
   ./aws-setup.sh
   ```

   This script will:
   - Check if AWS CLI is installed
   - Verify your AWS credentials are configured
   - Set a default region if not already configured

2. If you don't have AWS CLI installed, install it using the instructions at:
   [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

3. After installing, configure your AWS CLI with:
   ```bash
   aws configure
   ```
   
   You'll need to provide:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region (e.g., us-east-1)
   - Default output format (json is recommended)

## Architecture Overview

The deployment consists of:

1. **Frontend**: React application deployed to S3 and served via CloudFront CDN
2. **Backend**: Node.js/Express API deployed on EC2
3. **Database**: PostgreSQL on AWS RDS (referenced in the scripts)

## Deployment Process

Make the deployment script executable and run it:

```bash
chmod +x aws-deploy.sh
./aws-deploy.sh
```

This comprehensive script will:

1. **Build the application**: Compile the frontend and backend code
2. **Deploy to S3**: Upload the frontend assets to an S3 bucket
3. **Configure CloudFront**: Set up a CDN distribution for the S3 bucket
4. **Launch EC2**: Set up an EC2 instance for the backend API
5. **Configure Security**: Set up security groups and key pairs

## Post-Deployment

After successful deployment:

1. **Frontend URL**: https://ptchampion.ai (through CloudFront)
2. **Backend URL**: http://[EC2-IP]:3000 (as shown in the deployment output)

### DNS Configuration

If you're using a custom domain:

1. Go to your domain registrar or AWS Route 53
2. Create a CNAME record pointing to your CloudFront distribution domain
3. Wait for DNS propagation (may take up to 48 hours)

## Manual Connection to EC2

To SSH into your EC2 instance:

```bash
ssh -i ptchampion-key.pem ec2-user@[EC2-IP]
```

Where [EC2-IP] is the IP address displayed in the deployment output.

## Troubleshooting

### Common Issues:

1. **Build Failed**:
   - Check your Node.js version (use nvm to manage multiple versions)
   - Check package dependencies in package.json

2. **S3 Bucket Already Exists**:
   - If owned by you, the script will use the existing bucket
   - If owned by someone else, modify the S3_BUCKET variable in aws-deploy.sh

3. **CloudFront Distribution Issues**:
   - Check for existing distributions with `aws cloudfront list-distributions`
   - Update the CLOUDFRONT_DISTRIBUTION_ID in aws-deploy.sh if needed

4. **EC2 Connection Issues**:
   - Ensure key pair permissions: `chmod 400 ptchampion-key.pem`
   - Check security group allows SSH (port 22)

5. **Node.js Application Not Starting**:
   - SSH into the EC2 instance
   - Check logs with `pm2 logs ptchampion-api`

## Maintenance

### Updating the Application

1. Make changes to your codebase locally
2. Test locally with `npm run dev`
3. Deploy updates by running `./aws-deploy.sh` again

### Checking Service Status on EC2

SSH into your EC2 instance and run:

```bash
pm2 status
pm2 logs ptchampion-api
```

### Scaling Up

As your application grows:

1. **EC2**: Upgrade instance type for more resources
2. **RDS**: Increase database capacity
3. **ElastiCache**: Add Redis for improved caching
4. **Load Balancer**: Add multiple EC2 instances behind a load balancer 