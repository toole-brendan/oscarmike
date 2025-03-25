const { CloudFrontClient, GetDistributionConfigCommand, UpdateDistributionCommand, CreateResponseHeadersPolicyCommand, ListResponseHeadersPoliciesCommand } = require('@aws-sdk/client-cloudfront');

async function updateCloudFrontHeaders() {
  try {
    console.log('Updating CloudFront distribution security headers...');
    
    // CloudFront distribution ID for PTChampion
    const distributionId = 'E1FRFF3JQNGRE1';
    
    // Create CloudFront client
    const client = new CloudFrontClient({ region: 'us-east-1' });
    
    // Step 1: Try to find existing policy
    console.log('Checking for existing named Response Headers Policy...');
    let policyId = null;
    
    try {
      const existingPolicies = await client.send(
        new ListResponseHeadersPoliciesCommand({})
      );
      
      console.log('Response Headers Policies response:', JSON.stringify(existingPolicies, null, 2));
      
      if (existingPolicies.ResponseHeadersPolicyList && 
          existingPolicies.ResponseHeadersPolicyList.Items && 
          existingPolicies.ResponseHeadersPolicyList.Items.length > 0) {
            
        const ptcPolicy = existingPolicies.ResponseHeadersPolicyList.Items.find(
          policy => policy.ResponseHeadersPolicySummary && 
                   policy.ResponseHeadersPolicySummary.Name === 'PTChampionSecurityHeaders'
        );
        
        if (ptcPolicy) {
          policyId = ptcPolicy.ResponseHeadersPolicySummary.Id;
          console.log(`Found existing policy with ID: ${policyId}`);
        } else {
          console.log('No existing "PTChampionSecurityHeaders" policy found');
        }
      } else {
        console.log('No Response Headers Policies found in the account');
      }
    } catch (err) {
      console.error('Error listing Response Headers Policies:', err);
      console.log('Continuing without policy lookup...');
    }
    
    // Step 2: If no existing policy, create one
    if (!policyId) {
      console.log('Creating new Response Headers Policy...');
      try {
        const createPolicyResult = await client.send(
          new CreateResponseHeadersPolicyCommand({
            ResponseHeadersPolicyConfig: {
              Name: 'PTChampionSecurityHeaders',
              Comment: 'Security headers for PT Champion app with camera permissions',
              CustomHeadersConfig: {
                Items: [
                  {
                    Header: 'Feature-Policy',
                    Value: 'camera *; microphone *; geolocation *',
                    Override: true
                  },
                  {
                    Header: 'Permissions-Policy',
                    Value: 'camera=(self https://ptchampion.ai https://*.ptchampion.ai *), microphone=(self *), geolocation=(self *)',
                    Override: true
                  },
                  {
                    Header: 'Content-Security-Policy',
                    Value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: mediastream:; connect-src * 'unsafe-inline' data: blob: mediastream:; img-src * data: blob: mediastream:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; media-src * blob: mediastream: mediadevice:; worker-src * blob:; frame-ancestors 'self' https://ptchampion.ai https://*.ptchampion.ai *; frame-src *",
                    Override: true
                  },
                  {
                    Header: 'Cross-Origin-Embedder-Policy',
                    Value: 'unsafe-none',
                    Override: true
                  },
                  {
                    Header: 'Access-Control-Allow-Origin',
                    Value: '*',
                    Override: true
                  },
                  {
                    Header: 'Access-Control-Allow-Methods',
                    Value: 'GET, POST, PUT, DELETE, OPTIONS',
                    Override: true
                  }
                ],
                Quantity: 6
              },
              SecurityHeadersConfig: {
                ContentSecurityPolicy: {
                  ContentSecurityPolicy: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: mediastream:; connect-src * 'unsafe-inline' data: blob: mediastream:; img-src * data: blob: mediastream:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; media-src * blob: mediastream: mediadevice:; worker-src * blob:; frame-ancestors 'self' https://ptchampion.ai https://*.ptchampion.ai *; frame-src *",
                  Override: true
                },
                FrameOptions: {
                  FrameOption: 'ALLOWALL',
                  Override: true
                },
                ReferrerPolicy: {
                  ReferrerPolicy: 'strict-origin-when-cross-origin',
                  Override: true
                },
                StrictTransportSecurity: {
                  AccessControlMaxAgeSec: 63072000,
                  IncludeSubdomains: true,
                  Preload: true,
                  Override: true
                },
                XSSProtection: {
                  ModeBlock: true,
                  Protection: true,
                  Override: true
                },
                ContentTypeOptions: {
                  Override: true
                }
              }
            }
          })
        );
        
        policyId = createPolicyResult.ResponseHeadersPolicy.Id;
        console.log(`Created new policy with ID: ${policyId}`);
      } catch (err) {
        console.error('Error creating Response Headers Policy:', err);
        console.log('Falling back to inline headers...');
      }
    }
    
    // Step 3: Get the current distribution config
    console.log('Getting current distribution configuration...');
    const { DistributionConfig, ETag } = await client.send(
      new GetDistributionConfigCommand({ Id: distributionId })
    );
    
    console.log('Retrieved current distribution configuration');
    
    // Step 4: Update default cache behavior with named policy or inline headers
    if (policyId) {
      console.log(`Setting ResponseHeadersPolicyId to ${policyId}`);
      DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId = policyId;
      
      // Remove conflicting inline policy if it exists
      if (DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicy) {
        delete DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicy;
      }
    } else {
      console.log('Setting inline ResponseHeadersPolicy');
      DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicy = createResponseHeadersPolicy();
      
      // Remove conflicting policy ID if it exists
      if (DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId) {
        delete DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId;
      }
    }
    
    console.log('DefaultCacheBehavior settings:', JSON.stringify(DistributionConfig.DefaultCacheBehavior, null, 2));
    
    // The CloudFront config is using the modern approach with CachePolicyId, so we shouldn't use ForwardedValues
    if (DistributionConfig.DefaultCacheBehavior.CachePolicyId) {
      console.log(`Found CachePolicyId ${DistributionConfig.DefaultCacheBehavior.CachePolicyId}, removing ForwardedValues`);
      delete DistributionConfig.DefaultCacheBehavior.ForwardedValues;
    }
    
    console.log('Updating distribution with new configuration...');
    
    // Step 5: Update the distribution with new config
    try {
      const updateResult = await client.send(
        new UpdateDistributionCommand({
          Id: distributionId,
          IfMatch: ETag,
          DistributionConfig: DistributionConfig
        })
      );
      
      console.log('CloudFront distribution updated successfully');
      console.log(`Distribution ID: ${updateResult.Distribution.Id}`);
      console.log(`Distribution Status: ${updateResult.Distribution.Status}`);
      console.log(`Distribution Domain Name: ${updateResult.Distribution.DomainName}`);
      
      return true;
    } catch (error) {
      console.error('Error updating CloudFront distribution:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in updateCloudFrontHeaders:', error);
    throw error;
  }
}

function createResponseHeadersPolicy() {
  return {
    // Create a custom response headers policy
    CustomResponseHeaders: {
      Quantity: 6,
      Items: [
        {
          // Feature Policy to allow camera access - maximally permissive
          Header: 'Feature-Policy',
          Value: 'camera *; microphone *; geolocation *',
          Override: true
        },
        {
          // Permissions Policy - maximally permissive with correct syntax for embedding
          Header: 'Permissions-Policy',
          Value: 'camera=(self https://ptchampion.ai https://*.ptchampion.ai *), microphone=(self *), geolocation=(self *)',
          Override: true
        },
        {
          // Extremely relaxed content security policy with clear frame-ancestors
          Header: 'Content-Security-Policy',
          Value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: mediastream:; connect-src * 'unsafe-inline' data: blob: mediastream:; img-src * data: blob: mediastream:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; media-src * blob: mediastream: mediadevice:; worker-src * blob:; frame-ancestors 'self' https://ptchampion.ai https://*.ptchampion.ai *; frame-src *",
          Override: true
        },
        {
          // Disabled Cross-Origin-Embedder-Policy to prevent restrictions
          Header: 'Cross-Origin-Embedder-Policy',
          Value: 'unsafe-none',
          Override: true
        },
        {
          // Access-Control-Allow-Origin
          Header: 'Access-Control-Allow-Origin',
          Value: '*',
          Override: true
        },
        {
          // Access-Control-Allow-Methods
          Header: 'Access-Control-Allow-Methods',
          Value: 'GET, POST, PUT, DELETE, OPTIONS',
          Override: true
        }
      ]
    },
    Name: 'PTChampionSecurityHeaders',
    HeadersConfig: {
      // Standard security headers
      SecurityHeadersConfig: {
        ContentSecurityPolicy: {
          ContentSecurityPolicy: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: mediastream:; connect-src * 'unsafe-inline' data: blob: mediastream:; img-src * data: blob: mediastream:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; media-src * blob: mediastream: mediadevice:; worker-src * blob:; frame-ancestors 'self' https://ptchampion.ai https://*.ptchampion.ai *; frame-src *",
          Override: true
        },
        FrameOptions: {
          FrameOption: 'ALLOWALL',
          Override: true
        },
        ReferrerPolicy: {
          ReferrerPolicy: 'strict-origin-when-cross-origin',
          Override: true
        },
        StrictTransportSecurity: {
          AccessControlMaxAgeSec: 63072000,
          IncludeSubdomains: true,
          Preload: true,
          Override: true
        },
        XSSProtection: {
          ModeBlock: true,
          Protection: true,
          Override: true
        },
        ContentTypeOptions: {
          Override: true
        }
      }
    }
  };
}

// Execute if this is the main module
if (require.main === module) {
  updateCloudFrontHeaders()
    .then(() => console.log('CloudFront headers update completed'))
    .catch(error => {
      console.error('CloudFront headers update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateCloudFrontHeaders };
