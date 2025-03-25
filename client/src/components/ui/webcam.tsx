import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initPoseDetector, detectPoses, drawSkeleton } from '@/lib/pose-detection';
import { Camera, RefreshCw, Calculator, ExternalLink, AlertTriangle, X, Check } from 'lucide-react';

interface WebcamProps {
  onPoseDetected?: (pose: any) => void;
  width?: number;
  height?: number;
  className?: string;
}

const Webcam: React.FC<WebcamProps> = ({
  onPoseDetected,
  width = 640,
  height = 480,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraState, setCameraState] = useState<'inactive' | 'requesting' | 'active' | 'error' | 'restricted'>('inactive');
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedPose, setDetectedPose] = useState(false);
  const [showManualMode, setShowManualMode] = useState(false);
  const detectionLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Check if we're in an iframe (which often restricts camera access)
  useEffect(() => {
    try {
      setIsEmbedded(window.self !== window.top);
    } catch (e) {
      // If we can't access window.top due to security restrictions,
      // we're definitely in an iframe with different origin
      setIsEmbedded(true);
    }
  }, []);

  // Initialize TensorFlow in background when component mounts
  useEffect(() => {
    const initTensorFlow = async () => {
      try {
        console.log("Initializing TensorFlow and pose detector...");
        await initPoseDetector();
        console.log("TensorFlow and pose detector initialized successfully");
      } catch (error) {
        console.error('Error initializing pose detector:', error);
      }
    };
    
    initTensorFlow();
    
    return () => {
      // Clean up video on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up detection loop
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
      }
    };
  }, []);

  // Simple function to enable camera
  const enableCamera = async () => {
    if (!videoRef.current) return;
    
    setCameraState('requesting');
    
    try {
      // Try with basic constraints first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      if (!stream) {
        throw new Error("No stream returned from getUserMedia");
      }
      
      // Apply stream to video element
      if (!videoRef.current) return;
      
      videoRef.current.srcObject = stream;
      
      // Use a safe pattern for event handler assignment
      const video = videoRef.current;
      video.onloadedmetadata = () => {
        video.play()
          .then(() => {
            console.log("Camera is active and playing");
            setCameraState('active');
            
            // Initialize canvas once we have video dimensions
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth || width;
              canvasRef.current.height = videoRef.current.videoHeight || height;
              
              // Start pose detection
              startPoseDetection();
            }
          })
          .catch(error => {
            console.error("Error playing video:", error);
            setCameraState('error');
          });
      };
    } catch (error) {
      console.error("Camera access error:", error);
      
      // Check if this is a permissions policy violation (common in iframes)
      if (error instanceof DOMException && 
          (error.message.includes("Permissions policy") || 
           error.name === "NotAllowedError")) {
        setCameraState('restricted');
      } else {
        setCameraState('error');
        toast({
          title: 'Camera Error',
          description: 'Could not access your camera. Please check permissions.',
          variant: 'destructive'
        });
      }
    }
  };

  // Start pose detection loop
  const startPoseDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    setIsDetecting(true);
    
    const detectFrame = async () => {
      // Skip if camera is no longer active
      if (cameraState !== 'active' || !videoRef.current || !canvasRef.current) {
        setIsDetecting(false);
        return;
      }
      
      try {
        // Ensure video is playing and ready
        if (video.readyState >= 2) {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Always draw the video frame first so the user can see themselves
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Try to detect poses
          const poses = await detectPoses(video);
          
          if (poses && poses.length > 0) {
            // Draw skeleton overlay
            drawSkeleton(ctx, poses[0], canvas.width, canvas.height);
            setDetectedPose(true);
            
            // Send pose data to parent component
            if (onPoseDetected) {
              onPoseDetected(poses[0]);
            }
          } else {
            setDetectedPose(false);
          }
        }
      } catch (error) {
        console.error("Pose detection error:", error);
        // Just continue with camera feed without pose detection
      }
      
      // Continue detection loop
      detectionLoopRef.current = requestAnimationFrame(detectFrame);
    };
    
    // Start the detection loop
    detectionLoopRef.current = requestAnimationFrame(detectFrame);
  };

  // Handle manual rep counting mode
  const activateManualMode = () => {
    setShowManualMode(true);
    
    toast({
      title: 'Manual Counting Mode Activated',
      description: 'You can now count your reps manually using the buttons.',
    });
    
    // Let the parent component know we're in manual mode
    if (onPoseDetected) {
      onPoseDetected({ manualMode: true });
    }
  };

  // Reset everything and try again
  const resetCamera = () => {
    // Stop camera
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Stop detection loop
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    
    // Reset state
    setCameraState('inactive');
    setIsDetecting(false);
    setDetectedPose(false);
    setShowManualMode(false);
  };

  // Opens the current page in a new tab to escape iframe restrictions
  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="camera-container bg-gray-900 relative overflow-hidden rounded-lg" style={{ minHeight: '400px', position: 'relative' }}>
        {/* Video element - always present but may be hidden */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover absolute inset-0 z-10"
          style={{ display: cameraState === 'active' ? 'block' : 'none' }}
        />
        
        {/* Canvas overlay for skeleton - only visible when camera is active */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-20 w-full h-full"
          style={{ display: cameraState === 'active' ? 'block' : 'none' }}
        />
        
        {/* State-based UI overlays */}
        
        {/* Initial state when camera is inactive */}
        {cameraState === 'inactive' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
            <Camera className="h-16 w-16 mb-4 text-gray-400" />
            <h3 className="text-xl font-bold mb-2">Camera Access Required</h3>
            <p className="text-sm text-center text-gray-300 mb-6 max-w-md">
              This exercise requires camera access to analyze your form and count repetitions.
              Your video stays on your device and is not uploaded or stored.
            </p>
            
            {isEmbedded && (
              <div className="bg-amber-900/50 rounded-lg p-4 mb-4 max-w-md">
                <p className="text-sm text-amber-200 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                  You may need to open this page in a new tab for camera access
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={enableCamera}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Camera className="h-4 w-4 mr-2" />
                Enable Camera
              </Button>
              
              {isEmbedded && (
                <Button 
                  onClick={openInNewTab}
                  variant="outline"
                  className="text-white border-white/20 hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
              )}
              
              <Button 
                onClick={activateManualMode}
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Manual Counting
              </Button>
            </div>
          </div>
        )}
        
        {/* Camera requesting state */}
        {cameraState === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold mb-2">Requesting Camera...</h3>
            <p className="text-sm text-center text-gray-300 mb-4">
              Please allow camera access when prompted by your browser.
            </p>
          </div>
        )}
        
        {/* Error state */}
        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
            <X className="h-16 w-16 mb-4 text-red-500" />
            <h3 className="text-xl font-bold mb-2">Camera Error</h3>
            <p className="text-sm text-center text-gray-300 mb-6 max-w-md">
              We couldn't access your camera. This might be due to:
            </p>
            <ul className="list-disc text-sm text-left text-gray-300 mb-6 max-w-md pl-6">
              <li>Camera permission denied</li>
              <li>No camera connected to your device</li>
              <li>Another app is using your camera</li>
            </ul>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={resetCamera}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              
              <Button 
                onClick={activateManualMode}
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Manual Counting
              </Button>
            </div>
          </div>
        )}
        
        {/* Restricted mode (permissions policy violation) */}
        {cameraState === 'restricted' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
            <AlertTriangle className="h-16 w-16 mb-4 text-amber-500" />
            <h3 className="text-xl font-bold mb-2">Security Restriction Detected</h3>
            <p className="text-sm text-center text-gray-300 mb-4 max-w-md">
              Your browser is blocking camera access because this site is embedded in another website.
            </p>
            <div className="bg-amber-900/50 rounded-lg p-4 mb-6 max-w-md">
              <p className="text-sm text-amber-200">
                To fix this issue, please open this page in a new tab using the button below.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={openInNewTab}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
              
              <Button 
                onClick={activateManualMode}
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Manual Counting
              </Button>
            </div>
          </div>
        )}
        
        {/* Manual counting mode overlay */}
        {showManualMode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white bg-gray-900">
            <Calculator className="h-16 w-16 mb-4 text-blue-400" />
            <h3 className="text-xl font-bold mb-2">Manual Counting Mode</h3>
            <p className="text-sm text-center text-gray-300 mb-6 max-w-md">
              Camera analysis is disabled. Please count your repetitions manually using the controls provided.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={resetCamera}
                variant="outline"
                className="text-white border-white/20 hover:bg-white/10"
              >
                <Camera className="h-4 w-4 mr-2" />
                Try Camera Again
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Status bar below camera */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center">
          <span className="text-gray-500">Camera:</span>
          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            cameraState === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {cameraState === 'active' ? 'Active' : cameraState === 'requesting' ? 'Requesting...' : 'Inactive'}
          </span>
          
          {cameraState === 'active' && (
            <>
              <span className="ml-3 text-gray-500">Detection:</span>
              <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                isDetecting ? (detectedPose ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800') : 'bg-red-100 text-red-800'
              }`}>
                {isDetecting ? (detectedPose ? 'Detected' : 'Searching') : 'Off'}
              </span>
            </>
          )}
          
          {showManualMode && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Manual Mode
            </span>
          )}
        </div>
        
        <div className="flex space-x-2">
          {cameraState === 'active' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={resetCamera}
              className="text-xs flex items-center"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          
          {cameraState !== 'active' && !showManualMode && (
            <Button
              variant="default"
              size="sm"
              onClick={enableCamera}
              className="text-xs flex items-center"
            >
              <Camera className="h-3 w-3 mr-1" />
              Enable Camera
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Webcam;
