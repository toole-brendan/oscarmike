import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initPoseDetector, detectPoses, drawSkeleton } from '@/lib/pose-detection';
import { Camera, RefreshCw } from 'lucide-react';

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
  const { toast } = useToast();
  
  // Initialize TensorFlow.js and pose detector
  useEffect(() => {
    const init = async () => {
      try {
        await initPoseDetector();
        setIsReady(true);
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
      
      // Simple constraints first - try to get any video
      const constraints = {
        audio: false,
        video: true
      };
      
      console.log("Attempting to access camera with basic constraints:", constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted:", stream);
      
      // Only after we have a stream, apply size constraints
      if (videoRef.current) {
        videoRef.current.style.width = '100%';
        videoRef.current.style.height = '100%';
        videoRef.current.style.display = 'block';
        videoRef.current.style.objectFit = 'cover';
        videoRef.current.srcObject = stream;
        
        // Play video immediately
        try {
          await videoRef.current.play();
          console.log("Video is now playing");
          setIsCameraActive(true);
          // Start pose detection loop
          detectPoseLoop();
        } catch (playError) {
          console.error("Error playing video:", playError);
          toast({
            title: 'Error starting video',
            description: 'Could not play the camera stream. Please try again.',
            variant: 'destructive',
          });
        }
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
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    const currentIndex = devices.findIndex(device => device.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    
    setSelectedDeviceId(devices[nextIndex].deviceId);
    setIsCameraActive(false);
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
    
    // Make sure the canvas dimensions match the video
    canvas.width = video.videoWidth || width;
    canvas.height = video.videoHeight || height;
    
    console.log(`Canvas dimensions set to: ${canvas.width}x${canvas.height}`);
    
    const detectFrame = async () => {
      if (video.paused || video.ended || !isCameraActive) {
        // If video is not playing or camera inactive, exit detection loop
        console.log("Video paused/ended or camera inactive - stopping pose detection");
        return;
      }
      
      if (video.readyState >= 2) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        try {
          // Detect poses
          const poses = await detectPoses(video);
          
          if (poses && poses.length > 0) {
            // Draw skeleton
            drawSkeleton(ctx, poses[0], canvas.width, canvas.height);
            
            // Callback with pose data
            if (onPoseDetected) {
              onPoseDetected(poses[0]);
            }
          }
        } catch (error) {
          console.error('Error detecting poses:', error);
        }
      }
      
      // Continue detection loop
      requestAnimationFrame(detectFrame);
    };
    
    // Start detection loop
    console.log("Starting pose detection loop");
    detectFrame();
  };
  
  return (
    <div className={`relative ${className}`}>
      <div className="camera-container bg-gray-900 relative overflow-hidden rounded-lg" style={{ minHeight: '400px', position: 'relative' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            display: isCameraActive ? 'block' : 'none',
            position: 'absolute',
            zIndex: 1 
          }}
          onPlay={() => setIsCameraActive(true)}
        />
        <canvas
          ref={canvasRef}
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (videoRef.current && videoRef.current.srcObject) {
                  const stream = videoRef.current.srcObject as MediaStream;
                  stream.getTracks().forEach(track => track.stop());
                  setIsCameraActive(false);
                  startCamera();
                }
              }}
              className="text-sm flex items-center"
              title="Restart camera"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
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
