#!/bin/bash
set -e

# OscarMike Production Deployment Script

echo "🚀 Starting deployment process for OscarMike..."

# Check for required tools
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js and try again."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed. Please install npm and try again."
    exit 1
fi

# Make sure we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Load environment variables
echo "📦 Loading production environment variables..."
if [ -f ".env.production" ]; then
    export $(grep -v '^#' .env.production | xargs)
else
    echo "⚠️ .env.production file not found. Using default environment variables."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the project
echo "🔨 Building project..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:push

# Start the server
echo "🚀 Starting server in production mode..."
npm run start

echo "✅ Deployment completed successfully!" 