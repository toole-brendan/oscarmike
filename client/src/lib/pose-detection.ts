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

// Initialize the pose detector
export const initPoseDetector = async (): Promise<void> => {
  // Make sure TF backend is initialized
  await tf.ready();
  
  // Create detector using MoveNet
  const model = poseDetection.SupportedModels.MoveNet;
  const detectorConfig = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,
    minPoseScore: 0.3
  };
  
  detector = await poseDetection.createDetector(model, detectorConfig);
  
  console.log('Pose detector initialized');
};

// Detect poses in a video element
export const detectPoses = async (
  video: HTMLVideoElement
): Promise<Pose[] | null> => {
  if (!detector) {
    console.error('Detector not initialized');
    return null;
  }
  
  try {
    const poses = await detector.estimatePoses(video);
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
  if (!pose || !pose.keypoints) return;
  
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
  
  // Draw keypoints
  keypoints.forEach(keypoint => {
    if (keypoint.score > 0.3) {
      ctx.beginPath();
      ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#3B82F6';
      ctx.fill();
    }
  });
  
  // Draw connections
  connections.forEach(([p1Name, p2Name]) => {
    const keypoint1 = keypoints.find(kp => kp.name === p1Name);
    const keypoint2 = keypoints.find(kp => kp.name === p2Name);
    
    if (keypoint1 && keypoint2 && keypoint1.score > 0.3 && keypoint2.score > 0.3) {
      ctx.beginPath();
      ctx.moveTo(keypoint1.x, keypoint1.y);
      ctx.lineTo(keypoint2.x, keypoint2.y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3B82F6';
      ctx.stroke();
    }
  });
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
