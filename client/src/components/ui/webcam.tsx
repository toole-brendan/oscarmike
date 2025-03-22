import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { initPoseDetector, detectPoses, drawSkeleton } from '@/lib/pose-detection';

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
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('Error getting media devices:', error);
      }
    };
    
    getDevices();
  }, [selectedDeviceId]);
  
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
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: width },
          height: { ideal: height },
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      setIsCameraActive(true);
      
      // Start pose detection loop
      detectPoseLoop();
    } catch (error) {
      toast({
        title: 'Camera access denied',
        description: 'Please grant camera permission to use this feature.',
        variant: 'destructive',
      });
      console.error('Error accessing camera:', error);
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
      <div className="camera-container bg-gray-900 relative overflow-hidden rounded-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onPlay={() => setIsCameraActive(true)}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full skeleton-overlay"
        />
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
        
        {devices.length > 1 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={switchCamera}
            className="text-sm"
          >
            Switch Camera
          </Button>
        )}
      </div>
    </div>
  );
};

export default Webcam;
