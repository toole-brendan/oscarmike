// Script to enable camera access by adding permissive headers via JavaScript
// This script can be included in your application to help diagnose camera permission issues

(function() {
  console.log("Camera permissions fix script loaded");
  
  // Function to request camera permissions with maximum compatibility
  async function requestCameraWithFallbacks() {
    console.log("Attempting to request camera access with multiple methods");
    
    try {
      // Try the standard way first
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      };
      
      console.log("Requesting camera with standard constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted with standard method!");
      
      // Clean up the stream - we just needed to get permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.warn("Standard camera request failed:", error);
      
      // Try with minimal constraints
      try {
        console.log("Trying with minimal constraints");
        const minimalStream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("Camera access granted with minimal constraints!");
        minimalStream.getTracks().forEach(track => track.stop());
        return true;
      } catch (minError) {
        console.error("Minimal camera request also failed:", minError);
        
        // Log detailed information about the browser environment
        console.log("Browser details:", {
          userAgent: navigator.userAgent,
          vendor: navigator.vendor,
          platform: navigator.platform,
          mediaDevices: !!navigator.mediaDevices,
          getUserMedia: !!navigator.mediaDevices?.getUserMedia,
          secureContext: window.isSecureContext,
          protocol: window.location.protocol,
          permissions: 'Permissions' in navigator ? 'Available' : 'Not available'
        });
        
        return false;
      }
    }
  }
  
  // Check for camera permissions API
  if ('permissions' in navigator) {
    navigator.permissions.query({ name: 'camera' })
      .then(permissionStatus => {
        console.log("Camera permission status:", permissionStatus.state);
        
        // Monitor for permission changes
        permissionStatus.onchange = () => {
          console.log("Camera permission changed to:", permissionStatus.state);
        };
        
        if (permissionStatus.state === 'prompt' || permissionStatus.state === 'denied') {
          console.log("Attempting to request camera permission...");
          requestCameraWithFallbacks();
        }
      })
      .catch(error => {
        console.error("Error checking camera permission:", error);
        // Try direct camera access anyway
        requestCameraWithFallbacks();
      });
  } else {
    console.log("Permissions API not available, trying direct camera access");
    requestCameraWithFallbacks();
  }
  
  // Add this script to the page to report any CSP violations
  window.addEventListener('securitypolicyviolation', (e) => {
    console.error('CSP violation detected:', {
      violatedDirective: e.violatedDirective,
      effectiveDirective: e.effectiveDirective,
      blockedURI: e.blockedURI,
      originalPolicy: e.originalPolicy
    });
  });
})(); 