import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowUp, CheckCircle, XCircle } from 'lucide-react';
import { ExerciseType, exerciseInfo } from '@shared/schema';

// Simple chart component placeholder
const PerformanceChart: React.FC = () => (
  <div className="bg-gray-50 rounded-lg p-4 h-64 flex items-center justify-center">
    <div className="text-center text-gray-500">
      <BarChart3 className="h-12 w-12 mx-auto text-gray-400" />
      <p className="mt-2 text-sm">Performance chart visualization will appear here</p>
      <p className="text-xs">Powered by TensorFlow.js data analysis</p>
    </div>
  </div>
);

import { BarChart3 } from 'lucide-react';

const Results: React.FC = () => {
  const [match, params] = useRoute<{ id: string }>('/results/:id');
  const [_, navigate] = useLocation();
  
  // Guard clause to handle invalid routes
  if (!match || !params || !params.id) {
    navigate('/');
    return null;
  }
  
  const exerciseId = parseInt(params.id);
  
  // Fetch exercise results
  const { data: exercise, isLoading } = useQuery({
    queryKey: [`/api/exercises/${exerciseId}`],
    queryFn: async () => {
      const response = await fetch(`/api/exercises/${exerciseId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch exercise results');
      }
      
      return response.json();
    },
  });
  
  if (isLoading) {
    return <div className="text-center p-8">Loading results...</div>;
  }
  
  if (!exercise) {
    return <div className="text-center p-8">Exercise results not found</div>;
  }
  
  const exerciseType = exercise.type as ExerciseType;
  const info = exerciseInfo[exerciseType];
  
  // Format date
  const formattedDate = new Date(exercise.completedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  // Get performance rating
  const getPerformanceRating = () => {
    const points = exercise.points || 0;
    
    if (points >= 90) return { text: 'Excellent', class: 'bg-green-100 text-secondary' };
    if (points >= 75) return { text: 'Good', class: 'bg-blue-100 text-blue-700' };
    if (points >= 60) return { text: 'Satisfactory', class: 'bg-yellow-100 text-yellow-700' };
    return { text: 'Needs Improvement', class: 'bg-red-100 text-error' };
  };
  
  const rating = getPerformanceRating();
  
  // Format results based on exercise type
  const formatResult = () => {
    switch (exerciseType) {
      case 'pushups':
      case 'pullups':
      case 'situps':
        return `${exercise.repCount} reps`;
      case 'run':
        if (exercise.runTime) {
          const minutes = Math.floor(exercise.runTime / 60);
          const seconds = exercise.runTime % 60;
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        return 'N/A';
      default:
        return 'N/A';
    }
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
        <h2 className="text-2xl font-bold text-neutral-dark">Exercise Results</h2>
      </div>
      
      <Card className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-neutral-dark">{info.title}</h3>
            <p className="text-sm text-gray-600">Completed on {formattedDate}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${rating.class}`}>
            {rating.text}
          </div>
        </div>
        
        {/* Results Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <span className="text-sm text-gray-600 block mb-1">Total Reps</span>
            <span className="text-3xl font-bold text-neutral-dark">{exercise.repCount || 0}</span>
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center text-xs font-medium text-secondary">
                <ArrowUp className="h-4 w-4 mr-1" />
                +5 from last attempt
              </span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <span className="text-sm text-gray-600 block mb-1">Form Score</span>
            <span className="text-3xl font-bold text-neutral-dark">{exercise.formScore || 0}%</span>
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center text-xs font-medium text-secondary">
                <ArrowUp className="h-4 w-4 mr-1" />
                +3% from last attempt
              </span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <span className="text-sm text-gray-600 block mb-1">Points Earned</span>
            <span className="text-3xl font-bold text-neutral-dark">{exercise.points || 0}/100</span>
            <div className="mt-2 flex justify-center">
              <span className="inline-flex items-center text-xs font-medium text-secondary">
                <ArrowUp className="h-4 w-4 mr-1" />
                +7 points improvement
              </span>
            </div>
          </div>
        </div>
        
        {/* Form Analysis */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-neutral-dark mb-4">Form Analysis</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-neutral-dark mb-2">Strengths</h5>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-secondary mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Consistent elbow angle at 90° during the lowering phase</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-secondary mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Excellent back alignment throughout the exercise</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-secondary mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Maintained good head position throughout the test</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h5 className="font-medium text-neutral-dark mb-2">Areas for Improvement</h5>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <XCircle className="h-5 w-5 text-error mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Chest didn't consistently touch the ground on some reps</span>
                  </li>
                  <li className="flex items-start">
                    <XCircle className="h-5 w-5 text-error mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">Slight dip in hip position during later repetitions</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* Performance Chart */}
        <div>
          <h4 className="text-lg font-semibold text-neutral-dark mb-4">Performance Over Time</h4>
          <PerformanceChart />
        </div>
      </Card>
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <Button
          className="flex-1 bg-primary hover:bg-blue-600"
          onClick={() => navigate('/')}
        >
          Save Results
        </Button>
        <Button
          className="flex-1 bg-secondary hover:bg-green-600 text-white"
          onClick={() => navigate(`/exercise/${exerciseType}`)}
        >
          Try Again
        </Button>
        <Button
          variant="outline"
          className="flex-1"
        >
          Share Results
        </Button>
      </div>
    </div>
  );
};

export default Results;
