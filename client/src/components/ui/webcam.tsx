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
      const constraints = {
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: width },
          height: { ideal: height },
        }
      };
      
      console.log("Attempting to access camera with constraints:", constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Camera access granted:", stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded, playing video");
          if (videoRef.current) videoRef.current.play();
          setIsCameraActive(true);
          // Start pose detection loop
          detectPoseLoop();
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
    
    const detectFrame = async () => {
      if (!video.paused && !video.ended && video.readyState >= 2) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
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
      }
      
      // Continue detection loop
      requestAnimationFrame(detectFrame);
    };
    
    video.onloadeddata = () => {
      detectFrame();
    };
  };
  
  return (
    <div className={`relative ${className}`}>
      <div className="camera-container bg-gray-900 relative overflow-hidden rounded-lg" style={{ minHeight: '400px' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCameraActive ? 'block' : 'none' }}
          onPlay={() => setIsCameraActive(true)}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full skeleton-overlay"
          style={{ display: isCameraActive ? 'block' : 'none' }}
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
