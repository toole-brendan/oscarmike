#!/bin/bash
# Generate a secure random JWT secret
NEW_JWT_SECRET=$(openssl rand -hex 32)
echo "Generated new JWT secret"

# Apply the sed command to the .env.production file
sed -i "s|JWT_SECRET=use-a-secure-random-string-in-production|JWT_SECRET=${NEW_JWT_SECRET}|" /home/ec2-user/ptchampion/.env.production

# Restart the API service
pm2 restart ptchampion-api

echo "JWT secret updated and API restarted" 