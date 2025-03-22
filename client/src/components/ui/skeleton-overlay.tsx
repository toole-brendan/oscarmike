import React, { useRef, useEffect } from 'react';
import { Pose } from '@/lib/pose-detection';

interface SkeletonOverlayProps {
  pose: Pose | null;
  width: number;
  height: number;
  className?: string;
}

const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  pose,
  width,
  height,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Draw skeleton on SVG
  useEffect(() => {
    if (!svgRef.current || !pose) return;
    
    // SVG elements would be created and updated here
    // But for simplicity, we'll use the provided pose to render
    // a pre-defined skeleton structure
    
  }, [pose, width, height]);
  
  if (!pose) {
    return (
      <div className={`skeleton-overlay ${className}`}>
        <svg 
          ref={svgRef}
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${width} ${height}`}
          className="opacity-70"
        >
          {/* Empty state when no pose is detected */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            fill="#3B82F6"
            fontSize="16"
          >
            Waiting for pose detection...
          </text>
        </svg>
      </div>
    );
  }
  
  // Render skeleton based on pose data
  return (
    <div className={`skeleton-overlay ${className}`}>
      <svg 
        ref={svgRef}
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${width} ${height}`}
      >
        {pose.keypoints.map((keypoint, index) => (
          keypoint.score > 0.3 && (
            <circle
              key={`keypoint-${index}`}
              cx={keypoint.x}
              cy={keypoint.y}
              r="5"
              fill="#3B82F6"
            />
          )
        ))}
        
        {/* Connecting lines would be drawn here based on keypoint pairs */}
        {/* This is simplified - a real implementation would connect the proper keypoints */}
      </svg>
    </div>
  );
};

export default SkeletonOverlay;
