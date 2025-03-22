import { Pose, KeyPoint, calculateAngle, calculateDistance } from './pose-detection';
import { ExerciseType } from '@shared/schema';

export type FormFeedback = {
  issue: string;
  severity: 'info' | 'warning' | 'error';
  isValid: boolean;
};

export type ExerciseValidation = {
  isValidRep: boolean;
  feedback: FormFeedback[];
};

// Main validation function for different exercise types
export const validateExercise = (
  exerciseType: ExerciseType,
  pose: Pose | null,
  previousPose: Pose | null = null
): ExerciseValidation => {
  if (!pose) {
    return {
      isValidRep: false,
      feedback: [
        { issue: 'No pose detected', severity: 'error', isValid: false }
      ]
    };
  }

  switch (exerciseType) {
    case 'pushups':
      return validatePushup(pose, previousPose);
    case 'pullups':
      return validatePullup(pose, previousPose);
    case 'situps':
      return validateSitup(pose, previousPose);
    default:
      return {
        isValidRep: false,
        feedback: [
          { issue: 'Unknown exercise type', severity: 'error', isValid: false }
        ]
      };
  }
};

// Validate pushup form
const validatePushup = (pose: Pose, previousPose: Pose | null): ExerciseValidation => {
  const feedback: FormFeedback[] = [];
  let isValidRep = true;
  
  // Get required keypoints
  const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
  const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
  const rightElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
  const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
  const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
  const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
  const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
  const leftKnee = pose.keypoints.find(kp => kp.name === 'left_knee');
  const rightKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
  const leftAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
  const rightAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
  
  // Check if all required keypoints are detected with good confidence
  const requiredKeypoints = [
    leftShoulder, rightShoulder,
    leftElbow, rightElbow,
    leftWrist, rightWrist,
    leftHip, rightHip,
    leftKnee, rightKnee,
    leftAnkle, rightAnkle
  ];
  
  if (requiredKeypoints.some(kp => !kp || kp.score < 0.3)) {
    feedback.push({
      issue: 'Cannot see all body parts clearly',
      severity: 'warning',
      isValid: false
    });
    isValidRep = false;
  } else {
    // Check elbow angle (should be around 90 degrees in down position)
    if (leftElbow && leftShoulder && leftWrist) {
      const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      if (leftElbowAngle < 70 || leftElbowAngle > 110) {
        feedback.push({
          issue: 'Improper elbow angle',
          severity: 'warning',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good elbow angle',
          severity: 'info',
          isValid: true
        });
      }
    }
    
    // Check back alignment
    if (leftShoulder && leftHip && leftKnee) {
      const backAlignment = calculateAngle(leftShoulder, leftHip, leftKnee);
      if (backAlignment < 160) {
        feedback.push({
          issue: 'Back not straight',
          severity: 'warning',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good back alignment',
          severity: 'info',
          isValid: true
        });
      }
    }
    
    // Check if body is low enough (in the down position)
    if (leftShoulder && leftElbow && rightShoulder && rightElbow) {
      const leftShoulderToElbowDist = calculateDistance(leftShoulder, leftElbow);
      const rightShoulderToElbowDist = calculateDistance(rightShoulder, rightElbow);
      
      // This is a rough approximation - would need to be fine-tuned
      if (leftShoulderToElbowDist < 30 && rightShoulderToElbowDist < 30) {
        feedback.push({
          issue: 'Not going low enough',
          severity: 'error',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good depth',
          severity: 'info',
          isValid: true
        });
      }
    }
  }
  
  return { isValidRep, feedback };
};

// Validate pullup form
const validatePullup = (pose: Pose, previousPose: Pose | null): ExerciseValidation => {
  const feedback: FormFeedback[] = [];
  let isValidRep = true;
  
  // Get required keypoints
  const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
  const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
  const rightElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
  const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
  const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
  const nose = pose.keypoints.find(kp => kp.name === 'nose');
  
  // Check if all required keypoints are detected with good confidence
  const requiredKeypoints = [
    leftShoulder, rightShoulder,
    leftElbow, rightElbow,
    leftWrist, rightWrist,
    nose
  ];
  
  if (requiredKeypoints.some(kp => !kp || kp.score < 0.3)) {
    feedback.push({
      issue: 'Cannot see all body parts clearly',
      severity: 'warning',
      isValid: false
    });
    isValidRep = false;
  } else {
    // Check chin over bar (in up position)
    if (nose && leftWrist && rightWrist) {
      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      if (nose.y > avgWristY) {
        feedback.push({
          issue: 'Chin not over bar',
          severity: 'error',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good chin position',
          severity: 'info',
          isValid: true
        });
      }
    }
    
    // Check arm extension (in down position)
    if (leftElbow && leftShoulder && leftWrist) {
      const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      if (leftElbowAngle < 150) {
        feedback.push({
          issue: 'Arms not fully extended',
          severity: 'warning',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good arm extension',
          severity: 'info',
          isValid: true
        });
      }
    }
  }
  
  return { isValidRep, feedback };
};

// Validate situp form
const validateSitup = (pose: Pose, previousPose: Pose | null): ExerciseValidation => {
  const feedback: FormFeedback[] = [];
  let isValidRep = true;
  
  // Get required keypoints
  const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
  const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
  const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
  const leftKnee = pose.keypoints.find(kp => kp.name === 'left_knee');
  const rightKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
  const nose = pose.keypoints.find(kp => kp.name === 'nose');
  
  // Check if all required keypoints are detected with good confidence
  const requiredKeypoints = [
    leftShoulder, rightShoulder,
    leftHip, rightHip,
    leftKnee, rightKnee,
    nose
  ];
  
  if (requiredKeypoints.some(kp => !kp || kp.score < 0.3)) {
    feedback.push({
      issue: 'Cannot see all body parts clearly',
      severity: 'warning',
      isValid: false
    });
    isValidRep = false;
  } else {
    // Check if upper body is upright in the up position
    if (leftShoulder && leftHip && nose) {
      const upperBodyAngle = calculateAngle(nose, leftShoulder, leftHip);
      if (upperBodyAngle < 60) {
        feedback.push({
          issue: 'Not sitting up enough',
          severity: 'error',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good upright position',
          severity: 'info',
          isValid: true
        });
      }
    }
    
    // Check if knees are bent properly
    if (leftHip && leftKnee && leftAnkle && rightHip && rightKnee && rightAnkle) {
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      
      if (leftKneeAngle > 130 || rightKneeAngle > 130) {
        feedback.push({
          issue: 'Knees not bent properly',
          severity: 'warning',
          isValid: false
        });
        isValidRep = false;
      } else {
        feedback.push({
          issue: 'Good knee position',
          severity: 'info',
          isValid: true
        });
      }
    }
  }
  
  return { isValidRep, feedback };
};

// Detect a rep (full exercise movement)
export const detectRep = (
  exerciseType: ExerciseType,
  currentPose: Pose,
  poseHistory: Pose[]
): boolean => {
  // This is a simplified implementation
  // In a real application, this would analyze the sequence of poses
  // to detect a complete rep based on the specific exercise
  
  if (poseHistory.length < 5) return false;
  
  switch (exerciseType) {
    case 'pushups':
      return detectPushupRep(currentPose, poseHistory);
    case 'pullups':
      return detectPullupRep(currentPose, poseHistory);
    case 'situps':
      return detectSitupRep(currentPose, poseHistory);
    default:
      return false;
  }
};

const detectPushupRep = (currentPose: Pose, poseHistory: Pose[]): boolean => {
  // Very simplified - would need a more sophisticated algorithm in production
  // Look for a pattern of going down (elbow angle decreasing) then up (increasing)
  
  // Get elbow angles for current and recent poses
  const getElbowAngle = (pose: Pose): number => {
    const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
    
    if (leftElbow && leftShoulder && leftWrist && leftElbow.score > 0.3) {
      return calculateAngle(leftShoulder, leftElbow, leftWrist);
    }
    return 180; // Default to straight arm
  };
  
  const currentAngle = getElbowAngle(currentPose);
  const recentAngles = poseHistory.slice(-5).map(getElbowAngle);
  
  // Check if there was a down position (small angle) followed by up position (large angle)
  const wasDown = Math.min(...recentAngles) < 90;
  const isUp = currentAngle > 150;
  
  return wasDown && isUp;
};

const detectPullupRep = (currentPose: Pose, poseHistory: Pose[]): boolean => {
  // Similar to pushup detection but looking at chin-over-bar and arm extension
  
  const getChinBarDistance = (pose: Pose): number => {
    const nose = pose.keypoints.find(kp => kp.name === 'nose');
    const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
    const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    
    if (nose && leftWrist && rightWrist) {
      const avgWristY = (leftWrist.y + rightWrist.y) / 2;
      return nose.y - avgWristY; // Negative if chin is above bar
    }
    return 100; // Default large distance
  };
  
  const currentDist = getChinBarDistance(currentPose);
  const recentDists = poseHistory.slice(-5).map(getChinBarDistance);
  
  // Check if chin was over bar and now arms are extended
  const wasChinOverBar = Math.min(...recentDists) < 0;
  const isExtended = currentDist > 50;
  
  return wasChinOverBar && isExtended;
};

const detectSitupRep = (currentPose: Pose, poseHistory: Pose[]): boolean => {
  // Look for pattern of lying down then sitting up
  
  const getUpperBodyAngle = (pose: Pose): number => {
    const nose = pose.keypoints.find(kp => kp.name === 'nose');
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
    
    if (nose && leftShoulder && leftHip) {
      return calculateAngle(nose, leftShoulder, leftHip);
    }
    return 0; // Default to lying flat
  };
  
  const currentAngle = getUpperBodyAngle(currentPose);
  const recentAngles = poseHistory.slice(-5).map(getUpperBodyAngle);
  
  // Check if there was a down position followed by upright position
  const wasDown = Math.min(...recentAngles) < 30;
  const isUp = currentAngle > 70;
  
  return wasDown && isUp;
};
