import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import Webcam from '@/components/ui/webcam';
import FormIndicator from '@/components/ui/form-indicator';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { validateExercise, detectRep, FormFeedback } from '@/lib/exercise-validation';
import { ExerciseType, exerciseInfo } from '@shared/schema';

const Exercise: React.FC = () => {
  const [match, params] = useRoute<{ type: string }>('/exercise/:type');
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Guard clause to handle invalid routes
  if (!match || !params || !params.type) {
    navigate('/');
    return null;
  }
  
  const exerciseType = params.type as ExerciseType;
  const info = exerciseInfo[exerciseType];
  
  // Exercise state
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [currentFeedback, setCurrentFeedback] = useState<FormFeedback | null>(null);
  const [formScore, setFormScore] = useState(100);
  const [poseHistory, setPoseHistory] = useState<any[]>([]);
  
  // Refs for timers
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const repAnimationRef = useRef<boolean>(false);
  
  // Setup timer for exercise
  useEffect(() => {
    if (isStarted && !isPaused && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      // Time's up - end exercise
      endExercise();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStarted, isPaused, timeRemaining]);
  
  // Handle pose detection
  const handlePoseDetected = (pose: any) => {
    if (!isStarted || isPaused) return;
    
    // Store pose history (last 10 poses)
    setPoseHistory(prev => {
      const newHistory = [...prev, pose];
      if (newHistory.length > 10) {
        return newHistory.slice(-10);
      }
      return newHistory;
    });
    
    // Validate form
    const validation = validateExercise(exerciseType, pose);
    
    // Update form score (simplified - real implementation would be more complex)
    if (!validation.isValidRep) {
      setFormScore(prev => Math.max(prev - 0.5, 0));
    }
    
    // Get most important feedback
    const mainFeedback = validation.feedback.find(f => f.severity === 'error') || 
                         validation.feedback.find(f => f.severity === 'warning') ||
                         validation.feedback.find(f => f.severity === 'info') ||
                         null;
    
    if (mainFeedback) {
      setCurrentFeedback(mainFeedback);
    }
    
    // Detect completed rep
    if (poseHistory.length >= 5) {
      const isRep = detectRep(exerciseType, pose, poseHistory);
      
      if (isRep && !repAnimationRef.current) {
        repAnimationRef.current = true;
        setRepCount(prev => prev + 1);
        
        // Reset animation flag after a delay
        setTimeout(() => {
          repAnimationRef.current = false;
        }, 1000);
      }
    }
  };
  
  // Exercise control functions
  const startExercise = () => {
    setIsStarted(true);
    setTimeRemaining(120);
    setRepCount(0);
    setFormScore(100);
  };
  
  const togglePause = () => {
    setIsPaused(prev => !prev);
  };
  
  // Mutation for saving exercise results
  const saveMutation = useMutation({
    mutationFn: async () => {
      const exerciseData = {
        userId: 1, // Hardcoded for demo
        type: exerciseType,
        status: 'completed',
        repCount,
        formScore: Math.round(formScore),
        completedAt: new Date().toISOString(),
        points: calculatePoints(),
      };
      
      return apiRequest('POST', '/api/exercises', exerciseData);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      navigate(`/results/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Error saving results',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const endExercise = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    saveMutation.mutate();
  };
  
  // Calculate points based on performance
  const calculatePoints = () => {
    // Simplified scoring algorithm
    // In a real app, this would be more complex and based on standards
    let points = 0;
    
    switch (exerciseType) {
      case 'pushups':
        points = Math.min(100, repCount);
        break;
      case 'pullups':
        points = Math.min(100, repCount * 5);
        break;
      case 'situps':
        points = Math.min(100, repCount * 0.8);
        break;
      default:
        points = 0;
    }
    
    // Adjust for form score
    points = Math.round(points * (formScore / 100));
    
    return points;
  };
  
  // Format time remaining
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div>
      <div className="mb-6 flex items-center">
        <button 
          className="mr-4 text-gray-600 hover:text-primary focus:outline-none"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold text-neutral-dark">{info.title}</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera View / AI Analysis */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4">
          <div className="camera-container bg-gray-900 mx-auto relative">
            <Webcam
              onPoseDetected={handlePoseDetected}
              className="w-full h-full"
            />
            
            {/* Form feedback indicator */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <FormIndicator feedback={currentFeedback} />
            </div>
          </div>
        </div>
        
        {/* Exercise Controls and Stats */}
        <Card className="p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-neutral-dark mb-2">Exercise Details</h3>
            <p className="text-sm text-gray-600">
              Complete as many correct {info.title.toLowerCase()} as possible in the 2-minute time period.
            </p>
          </div>
          
          {/* Timer */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Time Remaining</span>
              <span className="text-2xl font-bold text-neutral-dark">{formatTime(timeRemaining)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="timer-progress bg-primary rounded-full h-2.5" 
                style={{ width: `${(timeRemaining / 120) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {/* Rep Counter */}
          <div className="mb-6 text-center">
            <span className="text-sm font-medium text-gray-600 block">Reps Completed</span>
            <div className={`mt-2 text-5xl font-bold text-primary ${repAnimationRef.current ? 'rep-counter' : ''}`}>
              {repCount}
            </div>
          </div>
          
          {/* Form Analysis */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Form Analysis</h4>
            <div className="bg-gray-50 rounded-lg p-3">
              {currentFeedback ? (
                <div className="flex items-center mb-2">
                  {currentFeedback.isValid ? (
                    <CheckCircle className="h-5 w-5 text-secondary mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 text-error mr-2" />
                  )}
                  <span className="text-sm">{currentFeedback.issue}</span>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 py-2">
                  Get in position to begin form analysis
                </div>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="mt-auto grid grid-cols-2 gap-4">
            {!isStarted ? (
              <Button
                className="col-span-2 bg-primary hover:bg-blue-600"
                onClick={startExercise}
              >
                Start Test
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={togglePause}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={endExercise}
                >
                  End Test
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Exercise;
