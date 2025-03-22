import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Heart } from 'lucide-react';

const Run: React.FC = () => {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Run state
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [distance, setDistance] = useState(0); // in miles
  const [heartRate, setHeartRate] = useState(0);
  const [isWatchConnected, setIsWatchConnected] = useState(false);
  
  // Refs for timers
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const watchSimulationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Setup timer for run
  useEffect(() => {
    if (isStarted && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      
      // Simulate watch data updates
      watchSimulationRef.current = setInterval(() => {
        simulateWatchData();
      }, 5000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (watchSimulationRef.current) {
        clearInterval(watchSimulationRef.current);
      }
    };
  }, [isStarted, isPaused]);
  
  // Simulate smartwatch connection and data
  useEffect(() => {
    // Simulate connecting to a smartwatch
    const connectWatch = async () => {
      try {
        // In a real app, this would use Web Bluetooth API or similar
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsWatchConnected(true);
        toast({
          title: 'Smartwatch Connected',
          description: 'Your fitness device is now tracking your run.',
        });
      } catch (error) {
        toast({
          title: 'Failed to connect smartwatch',
          description: 'Please make sure your device is nearby and Bluetooth is enabled.',
          variant: 'destructive',
        });
      }
    };
    
    connectWatch();
    
    return () => {
      // Clean up watch connection
    };
  }, [toast]);
  
  // Simulate watch data updates
  const simulateWatchData = () => {
    // In a real app, this would receive data from a connected smartwatch
    // Increase distance based on elapsed time (simplified simulation)
    const newDistance = Math.min(2, distance + (Math.random() * 0.1));
    setDistance(newDistance);
    
    // Set heart rate (random variation)
    const baseHeartRate = 160;
    const newHeartRate = baseHeartRate + Math.floor(Math.random() * 10 - 5);
    setHeartRate(newHeartRate);
    
    // If 2 miles completed, end the run
    if (newDistance >= 2) {
      endRun();
    }
  };
  
  // Run control functions
  const startRun = () => {
    setIsStarted(true);
    setElapsedTime(0);
    setDistance(0);
  };
  
  const togglePause = () => {
    setIsPaused(prev => !prev);
  };
  
  // Save run results
  const saveMutation = useMutation({
    mutationFn: async () => {
      const runData = {
        userId: 1, // Hardcoded for demo
        type: 'run',
        status: 'completed',
        runTime: elapsedTime,
        completedAt: new Date().toISOString(),
        points: calculatePoints(),
      };
      
      return apiRequest('POST', '/api/exercises', runData);
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
  
  const endRun = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (watchSimulationRef.current) {
      clearInterval(watchSimulationRef.current);
    }
    
    setIsStarted(false);
    
    saveMutation.mutate();
  };
  
  // Calculate points based on performance
  const calculatePoints = () => {
    // Simplified scoring algorithm for 2-mile run
    // In a real app, this would be based on standards
    
    // Base time for maximum points (e.g., 13:00 = 780 seconds)
    const baseTime = 780;
    
    // Calculate points (max 100)
    if (elapsedTime <= baseTime) {
      return 100;
    } else {
      // Deduct 1 point for every 6 seconds over base time
      const overTime = elapsedTime - baseTime;
      const deduction = Math.floor(overTime / 6);
      return Math.max(0, 100 - deduction);
    }
  };
  
  // Format time
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Calculate current pace
  const calculatePace = () => {
    if (distance === 0) return '--:--';
    
    const secondsPerMile = elapsedTime / distance;
    const paceMinutes = Math.floor(secondsPerMile / 60);
    const paceSeconds = Math.floor(secondsPerMile % 60);
    
    return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/mi`;
  };
  
  // Calculate estimated finish time
  const calculateEstimatedFinish = () => {
    if (distance === 0) return '--:--';
    
    const secondsPerMile = elapsedTime / distance;
    const estimatedTotalSeconds = secondsPerMile * 2; // 2 miles total
    
    return formatTime(Math.round(estimatedTotalSeconds));
  };
  
  // Get heart rate zone
  const getHeartRateZone = () => {
    if (heartRate < 130) return 'Zone 2';
    if (heartRate < 150) return 'Zone 3';
    if (heartRate < 170) return 'Zone 4';
    return 'Zone 5';
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
        <h2 className="text-2xl font-bold text-neutral-dark">2-Mile Run</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map View */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4">
          <div className="h-96 bg-gray-100 rounded-lg overflow-hidden">
            {/* This would be replaced with an actual map component */}
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <div className="text-center text-gray-500">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-12 w-12 mx-auto text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
                  />
                </svg>
                <p className="mt-2 text-sm">Map view would appear here</p>
                <p className="text-xs">Using GPS data from connected smartwatch</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="text-sm text-gray-500 block">Distance</span>
              <span className="text-xl font-bold text-neutral-dark">{distance.toFixed(1)} mi</span>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-500 block">Pace</span>
              <span className="text-xl font-bold text-neutral-dark">{calculatePace()}</span>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-500 block">Estimated Finish</span>
              <span className="text-xl font-bold text-neutral-dark">{calculateEstimatedFinish()}</span>
            </div>
          </div>
        </div>
        
        {/* Run Controls and Stats */}
        <Card className="p-6 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-neutral-dark mb-2">Run Details</h3>
            <p className="text-sm text-gray-600">Complete the 2-mile run in the fastest time possible.</p>
          </div>
          
          {/* Smart Watch Connection */}
          <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center text-primary">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-2" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M6.625 2.655A9 9 0 0119 11a1 1 0 11-2 0 7 7 0 00-9.625-6.492 1 1 0 11-.75-1.853zM4.662 4.959A1 1 0 014.75 6.37 6.97 6.97 0 003 11a1 1 0 11-2 0 8.97 8.97 0 012.25-5.953 1 1 0 011.412-.088z" 
                  clipRule="evenodd" 
                />
                <path 
                  fillRule="evenodd" 
                  d="M5 11a5 5 0 1110 0 1 1 0 11-2 0 3 3 0 10-6 0c0 1.677-.345 3.276-.968 4.729a1 1 0 11-1.838-.789A9.964 9.964 0 005 11zm8.921 2.012a1 1 0 01.831 1.145 19.86 19.86 0 01-.545 2.436 1 1 0 11-1.92-.558c.207-.713.371-1.445.49-2.192a1 1 0 011.144-.83z" 
                  clipRule="evenodd" 
                />
              </svg>
              <h4 className="font-medium">
                {isWatchConnected ? 'Smart Watch Connected' : 'Connecting...'}
              </h4>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {isWatchConnected 
                ? 'Your Garmin Forerunner 945 is tracking your run. GPS signal is strong.' 
                : 'Looking for nearby devices...'}
            </p>
          </div>
          
          {/* Timer */}
          <div className="mb-6">
            <div className="text-center mb-2">
              <span className="text-4xl font-bold text-neutral-dark">{formatTime(elapsedTime)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="timer-progress bg-primary rounded-full h-2.5" 
                style={{ width: `${Math.min(100, (distance / 2) * 100)}%` }}
              ></div>
            </div>
          </div>
          
          {/* Heart Rate */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Heart Rate</h4>
            <div className="flex items-center">
              <Heart className="h-6 w-6 text-error mr-2" />
              <span className="text-2xl font-bold text-neutral-dark">{heartRate} BPM</span>
              <span className="ml-2 text-sm text-gray-500">({getHeartRateZone()})</span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="mt-auto grid grid-cols-2 gap-4">
            {!isStarted ? (
              <Button
                className="col-span-2 bg-primary hover:bg-blue-600"
                onClick={startRun}
                disabled={!isWatchConnected}
              >
                Start Run
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
                  onClick={endRun}
                >
                  End Run
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Run;
