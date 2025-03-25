#!/bin/bash

# Script to deploy camera permission fixes to AWS CloudFront
set -e

echo "=== Camera Permissions Fix Deployment ==="
echo ""

# Check AWS CLI availability
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# 1. Build the project (using the root package.json)
echo "Building project..."
npm run build

# 2. Create diagnostic test page
echo "Creating camera diagnostic page..."
cat > dist/public/camera-test.html << 'EOL'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Camera Diagnostic Tool - PTChampion</title>
    <style>
        body { font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 20px; }
        video { width: 100%; max-width: 640px; background: #f0f0f0; border-radius: 8px; }
        button { padding: 10px 20px; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; }
        #logs { background: #f0f0f0; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; height: 200px; overflow-y: auto; }
        .warning { background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>PTChampion Camera Diagnostic Tool</h1>
    
    <h2>Environment Info</h2>
    <div id="env-info"></div>
    
    <h2>HTTP Headers</h2>
    <div id="headers-info">Loading...</div>
    
    <h2>Camera Test</h2>
    <video id="video" autoplay playsinline></video>
    <div style="margin: 10px 0">
        <button id="start-camera">Request Camera Access</button>
        <button id="stop-camera" disabled>Stop Camera</button>
        <button id="check-tensorflow" style="margin-left: 10px">Check TensorFlow</button>
    </div>
    
    <h2>Logs</h2>
    <div id="logs"></div>

    <script>
        function log(message) {
            const logs = document.getElementById('logs');
            const time = new Date().toLocaleTimeString();
            logs.textContent += `[${time}] ${message}\n`;
            logs.scrollTop = logs.scrollHeight;
            console.log(message);
        }
        
        function displayEnvInfo() {
            const envInfo = document.getElementById('env-info');
            const data = {
                userAgent: navigator.userAgent,
                secureContext: window.isSecureContext,
                protocol: window.location.protocol,
                hostname: window.location.hostname,
                mediaDevicesAvailable: !!navigator.mediaDevices,
                getUserMediaAvailable: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                screen: { 
                    width: window.screen.width, 
                    height: window.screen.height 
                }
            };
            
            let html = '<ul>';
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'object') {
                    html += `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`;
                } else {
                    html += `<li><strong>${key}:</strong> ${value}</li>`;
                }
            }
            html += '</ul>';
            envInfo.innerHTML = html;
            
            log(`Environment: ${JSON.stringify(data)}`);
        }
        
        // Check headers
        function checkHeaders() {
            const headersInfo = document.getElementById('headers-info');
            headersInfo.innerHTML = '<div class="warning">Headers cannot be directly inspected from JavaScript. Check network tab in developer tools.</div>';
            
            // Create a list of headers we're interested in
            const interestingHeaders = [
                'Content-Security-Policy',
                'Feature-Policy',
                'Permissions-Policy',
                'Cross-Origin-Embedder-Policy',
                'Access-Control-Allow-Origin'
            ];
            
            headersInfo.innerHTML += '<p>Headers to look for in Network tab:</p><ul>' + 
                interestingHeaders.map(h => `<li>${h}</li>`).join('') + '</ul>';
        }
        
        // Handle camera start
        async function startCamera() {
            const video = document.getElementById('video');
            const startBtn = document.getElementById('start-camera');
            const stopBtn = document.getElementById('stop-camera');
            
            try {
                log('Requesting camera permission...');
                
                // Try simplified constraints first
                const constraints = { 
                    video: true, 
                    audio: false 
                };
                log(`Using constraints: ${JSON.stringify(constraints)}`);
                
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
                
                log('Camera access granted successfully');
                startBtn.disabled = true;
                stopBtn.disabled = false;
                
                // List devices
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(d => d.kind === 'videoinput');
                    log(`Video devices: ${videoDevices.length}`);
                    videoDevices.forEach((device, i) => {
                        log(`  Device ${i+1}: ${device.label || 'unnamed device'}`);
                    });
                } catch (err) {
                    log(`Error listing devices: ${err.message}`);
                }
            } catch (error) {
                log(`Error: ${error.name} - ${error.message}`);
                
                if (error.name === 'NotAllowedError') {
                    log('Permission denied by user or system');
                } else if (error.name === 'NotFoundError') {
                    log('No camera found');
                } else if (error.name === 'NotReadableError') {
                    log('Camera already in use');
                } else if (error.name === 'OverconstrainedError') {
                    log('Trying with minimal constraints...');
                    try {
                        const minimalStream = await navigator.mediaDevices.getUserMedia({ 
                            video: true 
                        });
                        video.srcObject = minimalStream;
                        log('Camera access granted with minimal constraints');
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                    } catch (minimalError) {
                        log(`Even minimal constraints failed: ${minimalError.message}`);
                    }
                } else if (!window.isSecureContext) {
                    log('Not in a secure context (HTTPS required)');
                }
            }
        }
        
        // Handle camera stop
        function stopCamera() {
            const video = document.getElementById('video');
            const startBtn = document.getElementById('start-camera');
            const stopBtn = document.getElementById('stop-camera');
            
            if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                video.srcObject = null;
                log('Camera stopped');
                
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }
        }
        
        // Check TensorFlow.js availability
        async function checkTensorFlow() {
            log('Checking TensorFlow.js availability...');
            
            try {
                // Dynamically import TensorFlow
                log('Loading TensorFlow.js...');
                const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js');
                log(`TensorFlow.js loaded: ${tf.version.tfjs}`);
                
                // Try to initialize WebGL backend
                log('Trying WebGL backend...');
                await tf.setBackend('webgl');
                await tf.ready();
                log(`Backend initialized: ${tf.getBackend()}`);
                
                // Create a small tensor as a test
                const tensor = tf.tensor2d([[1, 2], [3, 4]]);
                log(`Test tensor created: shape=${tensor.shape}, dtype=${tensor.dtype}`);
                tensor.dispose();
                
                log('TensorFlow.js is working correctly!');
            } catch (error) {
                log(`TensorFlow.js error: ${error.message}`);
                
                // Try CPU backend if WebGL fails
                try {
                    const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js');
                    log('Trying CPU backend as fallback...');
                    await tf.setBackend('cpu');
                    await tf.ready();
                    log(`CPU backend initialized: ${tf.getBackend()}`);
                } catch (cpuError) {
                    log(`CPU backend also failed: ${cpuError.message}`);
                }
            }
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            displayEnvInfo();
            checkHeaders();
            document.getElementById('start-camera').addEventListener('click', startCamera);
            document.getElementById('stop-camera').addEventListener('click', stopCamera);
            document.getElementById('check-tensorflow').addEventListener('click', checkTensorFlow);
            log('Test page initialized - click "Request Camera Access"');
        });
    </script>
</body>
</html>
EOL

# 3. Update CloudFront headers
echo "Updating CloudFront headers for camera permissions..."
node update-cloudfront-headers.cjs

# 4. Uploading to S3
echo "Uploading camera test page to S3..."
aws s3 cp dist/public/camera-test.html s3://ptchampion.ai/camera-test.html

# 5. Deploying production build
echo "Deploying updated front-end to S3..."
aws s3 sync dist/public/ s3://ptchampion.ai/ --delete

# 6. Invalidate CloudFront cache
echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id E1FRFF3JQNGRE1 --paths "/*"

echo ""
echo "=== Camera fix deployment complete! ==="
echo ""
echo "Camera diagnostic test URL: https://ptchampion.ai/camera-test.html"
echo ""
echo "Troubleshooting steps:"
echo "1. Visit the camera test page and check the environment info"
echo "2. Click 'Request Camera Access' to test basic camera functionality"
echo "3. Click 'Check TensorFlow' to verify TensorFlow.js is working"
echo "4. Check browser console for any errors (F12 > Console tab)"
echo ""
echo "If camera access works on the test page but not in the app:"
echo "- There might be an issue with TensorFlow.js initialization"
echo "- Check browser console while using the main app"
echo ""
