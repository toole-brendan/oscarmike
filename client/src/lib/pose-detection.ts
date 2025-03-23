import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';

// Define the keypoints we care about for exercise form detection
export type KeyPoint = {
  x: number;
  y: number;
  score: number;
  name: string;
};

export type Pose = {
  keypoints: KeyPoint[];
  score: number;
};

let detector: poseDetection.PoseDetector | null = null;
let isModelLoading = false;

// Initialize the pose detector
export const initPoseDetector = async (): Promise<void> => {
  if (detector) {
    console.log('Pose detector already initialized');
    return;
  }
  
  if (isModelLoading) {
    console.log('Model loading already in progress');
    return;
  }
  
  isModelLoading = true;
  
  try {
    // Make sure TF backend is initialized
    console.log('Setting up TensorFlow backend...');
    
    // Force WebGL backend for better performance
    await tf.setBackend('webgl');
    await tf.ready();
    
    // Print detailed backend info
    console.log(`TensorFlow ready. Using backend: ${tf.getBackend()}`);
    // Use optional chaining and type assertions to safely access backend properties
    try {
      const backend = tf.engine().backend as any;
      if (backend && backend.getMaxTextureSize) {
        console.log(`WebGL Max Texture Size: ${backend.getMaxTextureSize()}`);
      }
      if (backend && backend.getGPGPUContext && backend.getGPGPUContext()) {
        console.log(`WebGL Version: ${backend.getGPGPUContext().version}`);
      }
    } catch (e) {
      console.warn('Could not get detailed WebGL info:', e);
    }
    
    // Create detector using MoveNet - with detailed error reporting
    console.log('Creating pose detector...');
    const model = poseDetection.SupportedModels.MoveNet;
    
    // Configure model for better balance of performance and accuracy
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true,
      minPoseScore: 0.2, // Lower threshold to detect poses more easily
    };
    
    console.log('Creating pose detector with config:', detectorConfig);
    
    // Force release any potential previous models
    tf.engine().startScope();
    if (detector) {
      try {
        // Use type assertion to handle the dispose method
        (detector as any).dispose?.();
        console.log('Disposed previous detector');
      } catch (e) {
        console.warn('Error disposing previous detector:', e);
      }
    }
    
    // Create the detector
    detector = await poseDetection.createDetector(model, detectorConfig);
    tf.engine().endScope();
    
    console.log('Pose detector initialized successfully');
    
    // Pre-warm the model with a dummy tensor
    try {
      console.log('Warming up pose detector...');
      // Create a properly typed tensor for the model
      const dummyImg = new ImageData(192, 192);
      const dummyResult = await detector.estimatePoses(dummyImg, { flipHorizontal: false });
      console.log('Warmup complete:', dummyResult);
    } catch (warmupError) {
      console.warn('Warmup error (non-critical):', warmupError);
    }
  } catch (error) {
    console.error('Failed to initialize pose detector:', error);
    
    // Try falling back to CPU if WebGL fails
    if (tf.getBackend() === 'webgl') {
      try {
        console.log('Attempting to fall back to CPU backend...');
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('Successfully switched to CPU backend');
        
        // Don't try to create detector again here, let the next attempt handle it
        detector = null;
      } catch (fallbackError) {
        console.error('Error during backend fallback:', fallbackError);
      }
    }
    
    throw error;
  } finally {
    isModelLoading = false;
  }
};

// Check if detector is initialized
export const isDetectorReady = (): boolean => {
  return detector !== null;
};

// Detect poses in a video element
export const detectPoses = async (
  video: HTMLVideoElement
): Promise<Pose[] | null> => {
  if (!detector) {
    console.error('Detector not initialized');
    return null;
  }
  
  if (!video || video.readyState < 2) {
    console.warn('Video not ready for pose detection');
    return null;
  }
  
  try {
    const poses = await detector.estimatePoses(video);
    
    if (poses && poses.length > 0) {
      // Log first detection for debugging
      if (poses[0]?.keypoints?.length > 0) {
        const nose = poses[0].keypoints.find(kp => kp.name === 'nose');
        if (nose && nose.score && nose.score > 0.5) {
          console.debug(`Detected pose with nose at (${Math.round(nose.x)}, ${Math.round(nose.y)}) - confidence: ${Math.round(nose.score * 100)}%`);
        }
      }
    }
    
    return poses as Pose[];
  } catch (error) {
    console.error('Error detecting poses:', error);
    return null;
  }
};

// Draw the skeleton on a canvas
export const drawSkeleton = (
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  videoWidth: number,
  videoHeight: number
): void => {
  if (!pose || !pose.keypoints || !ctx) {
    console.warn('Invalid input for drawSkeleton');
    return;
  }
  
  try {
    const keypoints = pose.keypoints;
    
    // Define connections for skeleton
    const connections = [
      ['nose', 'left_eye'], ['nose', 'right_eye'],
      ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
      ['nose', 'left_shoulder'], ['nose', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'], ['right_shoulder', 'right_elbow'],
      ['left_elbow', 'left_wrist'], ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
      ['left_knee', 'left_ankle'], ['right_knee', 'right_ankle']
    ];
    
    // Draw semi-transparent overlay for visual debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, videoWidth, videoHeight);
    
    // Draw keypoints with larger dots for better visibility
    keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3) {
        // Draw a bigger, more visible dot
        ctx.beginPath();
        ctx.arc(keypoint.x, keypoint.y, 12, 0, 2 * Math.PI);
        
        // Use bright, highly visible colors
        let color;
        switch(keypoint.name.split('_')[0]) {
          case 'left': color = 'rgba(0, 255, 0, 0.9)'; break;   // Bright green for left side
          case 'right': color = 'rgba(255, 0, 0, 0.9)'; break;  // Bright red for right side
          case 'nose': color = 'rgba(255, 255, 0, 0.9)'; break; // Yellow for nose
          case 'eye': color = 'rgba(0, 255, 255, 0.9)'; break;  // Cyan for eyes
          default: color = 'rgba(255, 100, 255, 0.9)';          // Pink for others
        }
        
        ctx.fillStyle = color;
        ctx.fill();
        
        // Add white border for contrast
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'white';
        ctx.stroke();
        
        // Add keypoint name for debugging
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(keypoint.name, keypoint.x + 15, keypoint.y);
      }
    });
    
    // Draw connections with thicker lines and glow effect
    connections.forEach(([p1Name, p2Name]) => {
      const keypoint1 = keypoints.find(kp => kp.name === p1Name);
      const keypoint2 = keypoints.find(kp => kp.name === p2Name);
      
      if (keypoint1 && keypoint2 && keypoint1.score > 0.3 && keypoint2.score > 0.3) {
        // Glow effect (draw multiple lines with decreasing opacity)
        for (let i = 8; i > 0; i -= 2) {
          ctx.beginPath();
          ctx.moveTo(keypoint1.x, keypoint1.y);
          ctx.lineTo(keypoint2.x, keypoint2.y);
          ctx.lineWidth = i;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * (1 - i/10)})`; // white glow
          ctx.stroke();
        }
        
        // Main line
        ctx.beginPath();
        ctx.moveTo(keypoint1.x, keypoint1.y);
        ctx.lineTo(keypoint2.x, keypoint2.y);
        ctx.lineWidth = 6;
        
        // Color lines based on body parts
        if (p1Name.includes('shoulder') || p2Name.includes('shoulder')) {
          ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)'; // blue for upper body
        } else if (p1Name.includes('hip') || p2Name.includes('hip')) {
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)'; // orange for core
        } else if (p1Name.includes('knee') || p2Name.includes('knee')) {
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; // yellow for legs
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // white for others
        }
        
        ctx.stroke();
      }
    });
  } catch (error) {
    console.error('Error drawing skeleton:', error);
  }
};

// Calculate angle between three points
export const calculateAngle = (
  p1: KeyPoint,
  p2: KeyPoint,
  p3: KeyPoint
): number => {
  const angle = Math.abs(
    Math.atan2(p3.y - p2.y, p3.x - p2.x) - 
    Math.atan2(p1.y - p2.y, p1.x - p2.x)
  ) * (180 / Math.PI);
  
  return Math.abs(angle);
};

// Calculate distance between two points
export const calculateDistance = (
  p1: KeyPoint,
  p2: KeyPoint
): number => {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) + 
    Math.pow(p2.y - p1.y, 2)
  );
};
