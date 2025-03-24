#!/bin/bash
yum update -y
yum install -y git
curl -sL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs
npm install -g pm2

# Install nginx for reverse proxy
amazon-linux-extras install -y nginx1 || dnf install -y nginx

# Clone your repository (using HTTPS, as we don't have deploy keys set up)
cd /home/ec2-user
# Use a public GitHub URL that doesn't require authentication
git clone https://github.com/brendan-toole/oscarmike.git ptchampion
cd ptchampion

# Install dependencies and build the server
npm install
npm run build

# Create .env.production file
cat > .env.production << 'ENVEOF'
NODE_ENV=production
NODE_TLS_REJECT_UNAUTHORIZED=0

# AWS RDS PostgreSQL Connection
DATABASE_URL=postgres://postgres:Dunlainge1!@ptchampion-1-instance-1.ck9iecaw2h6w.us-east-1.rds.amazonaws.com:5432/postgres

# JWT configuration
JWT_SECRET=use-a-secure-random-string-in-production
JWT_EXPIRES_IN=24h

# Redis configuration for caching - Update if using AWS ElastiCache
REDIS_URL=redis://localhost:6379
CACHE_TTL=300 # 5 minutes in seconds
DISABLE_CACHE=true

# Server port configuration
PORT=3000
ENVEOF

# Start the server with PM2
NODE_ENV=production NODE_TLS_REJECT_UNAUTHORIZED=0 pm2 start dist/index.js --name ptchampion-api
pm2 startup
pm2 save

# Configure Nginx as a reverse proxy
mkdir -p /etc/nginx/conf.d/
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
systemctl enable nginx || service nginx enable
systemctl start nginx || service nginx start
