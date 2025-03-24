// Script to update CloudFront configuration with a new origin for the API server
const fs = require('fs');

// Read CloudFront config
const cloudFrontConfig = JSON.parse(fs.readFileSync('cloudfront-config.json', 'utf8'));
const distributionConfig = cloudFrontConfig.DistributionConfig;

// Get EC2 domain from environment variable
const apiDomain = process.env.EC2_DOMAIN;
if (!apiDomain) {
  console.error('EC2_DOMAIN environment variable is not set');
  process.exit(1);
}

console.log(`Adding API origin with domain: ${apiDomain}`);

// Add new origin for API server
distributionConfig.Origins.Items.push({
  Id: "ApiBackend",
  DomainName: apiDomain,
  OriginPath: "",
  CustomHeaders: { Quantity: 0 },
  CustomOriginConfig: {
    HTTPPort: 80,
    HTTPSPort: 443,
    OriginProtocolPolicy: "http-only",
    OriginSslProtocols: {
      Quantity: 1,
      Items: ["TLSv1.2"]
    },
    OriginReadTimeout: 30,
    OriginKeepaliveTimeout: 5
  },
  ConnectionAttempts: 3,
  ConnectionTimeout: 10,
  OriginShield: { Enabled: false }
});

// Update origins quantity
distributionConfig.Origins.Quantity = distributionConfig.Origins.Items.length;

// Add cache behavior for API routes
if (!distributionConfig.CacheBehaviors) {
  distributionConfig.CacheBehaviors = { Quantity: 0, Items: [] };
} else if (!distributionConfig.CacheBehaviors.Items) {
  distributionConfig.CacheBehaviors.Items = [];
}

distributionConfig.CacheBehaviors.Items.push({
  PathPattern: "/api/*",
  TargetOriginId: "ApiBackend",
  ViewerProtocolPolicy: "redirect-to-https",
  AllowedMethods: {
    Quantity: 7,
    Items: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
    CachedMethods: {
      Quantity: 2,
      Items: ["GET", "HEAD"]
    }
  },
  Compress: true,
  DefaultTTL: 0,
  MinTTL: 0,
  MaxTTL: 0,
  SmoothStreaming: false,
  FieldLevelEncryptionId: "",
  ForwardedValues: {
    QueryString: true,
    Cookies: {
      Forward: "all"
    },
    Headers: {
      Quantity: 6,
      Items: [
        "Authorization",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
        "Host",
        "Content-Type"
      ]
    },
    QueryStringCacheKeys: {
      Quantity: 0
    }
  },
  LambdaFunctionAssociations: { Quantity: 0 },
  FunctionAssociations: { Quantity: 0 }
});

// Update cache behaviors quantity
distributionConfig.CacheBehaviors.Quantity = distributionConfig.CacheBehaviors.Items.length;

// Write updated config to file
fs.writeFileSync('distribution-config.json', JSON.stringify(distributionConfig, null, 2)); 