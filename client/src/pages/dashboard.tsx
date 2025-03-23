import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Exercise, ExerciseType, ExerciseStatus, exerciseTypes } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import CircularProgress from '@/components/ui/circular-progress';
import ExerciseCard from '@/components/ui/exercise-card';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

const Dashboard: React.FC = () => {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Get authenticated user data from localStorage
  const [userData, setUserData] = useState<{id: number, username: string} | null>(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        navigate('/login');
      }
    } else {
      // Redirect to login if no user data is found
      navigate('/login');
    }
  }, [navigate]);
  
  // If user data is not loaded yet or if user is not authenticated, show loading or redirect
  if (!userData) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  const userId = userData.id;
  
  // Fetch user exercises
  const { data: exercises, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}/exercises`],
    queryFn: async () => {
      // Initialize with default exercises if none exist
      const response = await fetch(`/api/users/${userId}/exercises`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch exercises');
      }
      
      const data = await response.json();
      
      // If no exercises exist, create default ones
      if (data.length === 0) {
        const defaultExercises: Partial<Exercise>[] = [];
        
        for (const type of exerciseTypes) {
          // Ensure we provide all required fields for a new exercise
          defaultExercises.push({
            userId,
            type,
            status: 'not_started',
            repCount: null,
            formScore: null,
            runTime: null,
            completedAt: null,
            points: null,
          });
        }
        
        // Create default exercises
        return Promise.all(
          defaultExercises.map(async (exercise) => {
            const response = await fetch('/api/exercises', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(exercise),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to create ${exercise.type} exercise`);
            }
            
            return response.json();
          })
        );
      }
      
      return data;
    },
  });
  
  // Get the latest exercise for each type
  const getLatestExerciseByType = (type: ExerciseType): Exercise | undefined => {
    if (!exercises) return undefined;
    
    const typeExercises = exercises.filter((e: Exercise) => e.type === type);
    return typeExercises.length > 0 ? typeExercises[0] : undefined;
  };
  
  // Calculate overall score
  const calculateOverallScore = (): { score: number, max: number } => {
    if (!exercises) return { score: 0, max: 0 };
    
    const completedExercises = exercises.filter((e: Exercise) => e.status === 'completed');
    const totalPoints = completedExercises.reduce((sum: number, e: Exercise) => sum + (e.points || 0), 0);
    
    return { score: totalPoints, max: 300 };
  };
  
  // Get exercise status info
  const getExerciseStatusInfo = (type: ExerciseType): { status: ExerciseStatus, bestResult: string } => {
    const exercise = getLatestExerciseByType(type);
    
    if (!exercise) {
      return { status: 'not_started', bestResult: 'N/A' };
    }
    
    let bestResult = 'N/A';
    
    if (exercise.status === 'completed') {
      switch (type) {
        case 'pushups':
        case 'pullups':
        case 'situps':
          bestResult = `${exercise.repCount || 0} reps`;
          break;
        case 'run':
          if (exercise.runTime) {
            const minutes = Math.floor(exercise.runTime / 60);
            const seconds = exercise.runTime % 60;
            bestResult = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          }
          break;
      }
    }
    
    return { status: exercise.status, bestResult };
  };
  
  const { score, max } = calculateOverallScore();
  const scorePercentage = max > 0 ? Math.round((score / max) * 100) : 0;
  
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-dark">PT Test Dashboard</h2>
        <p className="text-gray-600">Complete all four events to get your final score</p>
      </div>
      
      {/* User Stats Summary */}
      <Card className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-dark">Your Progress</h3>
          <button className="text-primary hover:text-primary-dark text-sm font-medium focus:outline-none">
            View History
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {exerciseTypes.map(type => {
            const exercise = getLatestExerciseByType(type);
            let percentage = 0;
            
            if (exercise && exercise.status === 'completed') {
              // Arbitrary percentages for demo
              switch (type) {
                case 'pushups': percentage = 75; break;
                case 'pullups': percentage = 50; break;
                case 'situps': percentage = 90; break;
                case 'run': percentage = 65; break;
              }
            }
            
            return (
              <div key={type} className="text-center">
                <CircularProgress value={percentage}>
                  <span className="text-sm font-semibold">{percentage}%</span>
                </CircularProgress>
                <p className="mt-2 text-sm font-medium text-neutral-dark">
                  {type === 'pushups' ? 'Push-ups' :
                   type === 'pullups' ? 'Pull-ups' :
                   type === 'situps' ? 'Sit-ups' : '2-Mile Run'}
                </p>
                <p className="text-xs text-gray-500">
                  {getExerciseStatusInfo(type).bestResult}
                </p>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-neutral-dark">Overall Score</span>
            <span className="text-sm font-semibold text-primary">{score}/{max}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary rounded-full h-2" 
              style={{ width: `${scorePercentage}%` }}
            ></div>
          </div>
        </div>
      </Card>
      
      {/* Exercise Selection */}
      <h3 className="text-lg font-semibold text-neutral-dark mb-4">Select Exercise</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {exerciseTypes.map(type => {
          const { status, bestResult } = getExerciseStatusInfo(type);
          return (
            <ExerciseCard 
              key={type}
              type={type}
              status={status}
              bestResult={bestResult}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
