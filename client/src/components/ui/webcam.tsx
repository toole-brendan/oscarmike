import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initPoseDetector, detectPoses, drawSkeleton } from '@/lib/pose-detection';
import { Camera, RefreshCw, Bug } from 'lucide-react';

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
  const [isReady, setIsReady] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedPose, setDetectedPose] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(true);
  const detectionLoopRef = useRef<number | null>(null);
  const { toast } = useToast();
  
  // Initialize TensorFlow.js and pose detector
  useEffect(() => {
    const init = async () => {
      try {
        console.log("Initializing TensorFlow and pose detector...");
        await initPoseDetector();
        setIsReady(true);
        console.log("TensorFlow and pose detector initialized successfully");
      } catch (error) {
        toast({
          title: 'Error initializing pose detector',
          description: 'Please refresh the page and try again.',
          variant: 'destructive',
        });
        console.error('Error initializing pose detector:', error);
      }
    };
    
    init();
  }, [toast]);
  
  // Get available cameras
  useEffect(() => {
    const getDevices = async () => {
      try {
        // First request camera access to get permission
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then((stream) => {
            // Stop tracks immediately
            stream.getTracks().forEach(track => track.stop());
            
            // Now enumerate devices
            return navigator.mediaDevices.enumerateDevices();
          })
          .then((devices) => {
            console.log("Available devices:", devices);
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log("Available video devices:", videoDevices);
            
            setDevices(videoDevices);
            
            if (videoDevices.length > 0 && !selectedDeviceId) {
              setSelectedDeviceId(videoDevices[0].deviceId);
            }
          });
      } catch (error) {
        console.error('Error getting media devices:', error);
        toast({
          title: 'Cannot access camera',
          description: 'Please allow camera access in your browser settings.',
          variant: 'destructive',
        });
      }
    };
    
    getDevices();
  }, []);
  
  // Start camera when ready
  useEffect(() => {
    if (isReady && selectedDeviceId && !isCameraActive) {
      startCamera();
    }
    
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up detection loop
      if (detectionLoopRef.current !== null) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  }, [isReady, selectedDeviceId, isCameraActive]);
  
  // Start the webcam
  const startCamera = async () => {
    if (!videoRef.current) return;
    
    try {
      // First reset any existing stream
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      // Set up canvas first
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        console.log(`Canvas dimensions preset to: ${width}x${height}`);
      }
      
      // Use device id if available
      const constraints = {
        audio: false,
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: 'environment', width: { ideal: width }, height: { ideal: height } }
      };
      
      console.log("Attempting to access camera with constraints:", constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted:", stream);
      
      // Only after we have a stream, apply to video element
      if (videoRef.current) {
        // Prevent automatic size changes that could interrupt video
        videoRef.current.width = width;
        videoRef.current.height = height;
        videoRef.current.srcObject = stream;
        
        // Play video with a handler for success
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("Video is now playing");
                setIsCameraActive(true);
                // Start pose detection loop
                detectPoseLoop();
              })
              .catch((playError) => {
                console.error("Error playing video:", playError);
                toast({
                  title: 'Error starting video',
                  description: 'Could not play the camera stream. Please try again.',
                  variant: 'destructive',
                });
              });
          }
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera access denied',
        description: 'Please grant camera permission to use this feature.',
        variant: 'destructive',
      });
    }
  };
  
  // Switch camera
  const switchCamera = async () => {
    // Clean up existing detection loop
    if (detectionLoopRef.current !== null) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    const currentIndex = devices.findIndex(device => device.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    
    setSelectedDeviceId(devices[nextIndex].deviceId);
    setIsCameraActive(false);
    setIsDetecting(false);
  };
  
  // Continuously detect poses
  const detectPoseLoop = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Wait for the video to be properly loaded
    if (video.readyState < 2) {
      console.log("Video not ready yet, waiting...");
      setTimeout(detectPoseLoop, 100);
      return;
    }
    
    // Update canvas dimensions if needed
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || width;
      canvas.height = video.videoHeight || height;
      console.log(`Canvas dimensions updated to: ${canvas.width}x${canvas.height}`);
    }
    
    setIsDetecting(true);
    
    const detectFrame = async () => {
      // Only proceed if camera is active
      if (!isCameraActive) {
        console.log("Camera inactive - pausing pose detection until camera is active again");
        setIsDetecting(false);
        return;
      }
      
      // Check if video element still exists and is playing
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        console.log("Video paused/ended - pausing pose detection");
        setIsDetecting(false);
        return;
      }
      
      if (videoRef.current.readyState >= 2) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (debugMode) {
          // Add debug overlay with semi-transparent background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Display debug text
          ctx.font = '16px sans-serif';
          ctx.fillStyle = 'white';
          ctx.fillText(`Camera active: ${isCameraActive ? 'Yes' : 'No'}`, 10, 30);
          ctx.fillText(`Canvas size: ${canvas.width}x${canvas.height}`, 10, 60);
          ctx.fillText(`Detecting poses: ${isDetecting ? 'Yes' : 'No'}`, 10, 90);
        }
        
        try {
          // Detect poses
          const poses = await detectPoses(video);
          
          if (poses && poses.length > 0) {
            // Draw skeleton with MUCH higher visibility
            drawSkeleton(ctx, poses[0], canvas.width, canvas.height);
            setDetectedPose(true);
            
            if (debugMode) {
              // Show additional debug info for pose
              ctx.fillStyle = 'white';
              ctx.fillText(`Pose detected: Yes`, 10, 120);
              ctx.fillText(`Keypoints: ${poses[0].keypoints.length}`, 10, 150);
            }
            
            // Callback with pose data
            if (onPoseDetected) {
              onPoseDetected(poses[0]);
            }
          } else {
            setDetectedPose(false);
            if (debugMode) {
              ctx.fillStyle = 'white';
              ctx.fillText(`Pose detected: No`, 10, 120);
            }
          }
        } catch (error) {
          console.error('Error detecting poses:', error);
          if (debugMode) {
            ctx.fillStyle = 'red';
            ctx.fillText(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 10, 180);
          }
        }
      }
      
      // Continue detection loop with a reference we can cancel if needed
      detectionLoopRef.current = requestAnimationFrame(detectFrame);
    };
    
    // Start detection loop
    console.log("Starting pose detection loop");
    detectionLoopRef.current = requestAnimationFrame(detectFrame);
  };
  
  return (
    <div className={`relative ${className}`}>
      <div className="camera-container bg-gray-900 relative overflow-hidden rounded-lg" style={{ minHeight: '400px', position: 'relative' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          width={width}
          height={height}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            display: isCameraActive ? 'block' : 'none',
            position: 'absolute',
            zIndex: 1 
          }}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: 2,
            display: isCameraActive ? 'block' : 'none' 
          }}
        />
        
        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-white p-4">
            <Camera className="h-16 w-16 mb-4 text-gray-400" />
            <div className="mb-4 text-center">
              <h3 className="text-lg font-bold mb-2">Camera Access Required</h3>
              <p className="text-sm text-gray-300">
                This exercise requires camera access for pose detection.
              </p>
            </div>
            <Button 
              onClick={startCamera}
              className="bg-primary flex items-center"
            >
              <Camera className="h-4 w-4 mr-2" />
              Enable Camera
            </Button>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-500">Camera Status:</span>
          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isCameraActive ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isCameraActive ? 'Active' : 'Inactive'}
          </span>
          
          {isCameraActive && (
            <>
              <span className="ml-4 text-sm text-gray-500">Pose Detection:</span>
              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isDetecting ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
              }`}>
                {isDetecting ? (detectedPose ? 'Detected' : 'Searching') : 'Inactive'}
              </span>
            </>
          )}
        </div>
        
        <div className="flex space-x-2">
          {!isCameraActive && (
            <Button
              variant="default"
              size="sm"
              onClick={startCamera}
              className="text-sm flex items-center"
            >
              <Camera className="h-4 w-4 mr-1" />
              Start Camera
            </Button>
          )}
          
          {isCameraActive && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Clean up detection loop
                  if (detectionLoopRef.current !== null) {
                    cancelAnimationFrame(detectionLoopRef.current);
                    detectionLoopRef.current = null;
                  }
                  
                  if (videoRef.current && videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream;
                    stream.getTracks().forEach(track => track.stop());
                    videoRef.current.srcObject = null;
                    setIsCameraActive(false);
                    setIsDetecting(false);
                    
                    // Restart camera after a short delay
                    setTimeout(() => {
                      startCamera();
                    }, 500);
                  }
                }}
                className="text-sm flex items-center"
                title="Restart camera"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              
              <Button
                variant={debugMode ? "default" : "outline"}
                size="sm"
                onClick={() => setDebugMode(!debugMode)}
                className="text-sm flex items-center"
                title="Toggle debug mode"
              >
                <Bug className="h-4 w-4 mr-1" />
                {debugMode ? "Debug On" : "Debug Off"}
              </Button>
            </>
          )}
          
          {devices.length > 1 && isCameraActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={switchCamera}
              className="text-sm"
            >
              Switch Camera
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Webcam;
