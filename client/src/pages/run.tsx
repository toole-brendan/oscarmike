import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Heart, MapPin, Activity, Watch, AlertCircle } from 'lucide-react';
import { 
  useSmartWatch, 
  SmartWatchDevice, 
  SmartWatchRunData, 
  RunSummary 
} from '@/lib/smartwatch-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Run: React.FC = () => {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // Run state
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Smart watch integration
  const { 
    device, 
    data, 
    devices, 
    scanning, 
    connecting,
    recording,
    supportedBrands, 
    scanForDevices, 
    connectDevice, 
    disconnectDevice,
    startRecording,
    stopRecording,
    exportGPX
  } = useSmartWatch();
  
  // Setup timer for run
  useEffect(() => {
    if (isStarted && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStarted, isPaused]);
  
  // Run control functions
  const startRun = () => {
    if (!device) {
      toast({
        title: 'No smartwatch connected',
        description: 'Please connect a smartwatch to track your run.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsStarted(true);
    setElapsedTime(0);
    startRecording();
  };
  
  const togglePause = () => {
    setIsPaused(prev => !prev);
  };
  
  // Save run results
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!runSummary) {
        throw new Error('No run data available');
      }
      
      // First save the exercise
      const exerciseData = {
        userId: 1, // Replace with actual user ID in production
        type: 'run',
        status: 'completed',
        runTime: Math.round(runSummary.totalTime),
        completedAt: new Date(),
        points: calculatePoints(runSummary),
        verified: runSummary.verified,
      };
      
      const exerciseResponse = await apiRequest('POST', '/api/exercises', exerciseData);
      const exerciseResult = await exerciseResponse.json();
      
      // Then save the run data with the exercise ID
      if (runSummary.verified) {
        const runDataPayload = {
          exerciseId: exerciseResult.id,
          deviceType: device?.brand || 'unknown',
          deviceName: device?.name || 'Unknown Device',
          startTime: new Date(runSummary.startTime),
          endTime: new Date(runSummary.endTime),
          totalDistance: runSummary.totalDistance,
          avgPace: runSummary.avgPace,
          avgHeartRate: runSummary.avgHeartRate,
          maxHeartRate: runSummary.maxHeartRate,
          calories: runSummary.calories,
          elevationGain: 0, // Not available in our current implementation
          gpsData: JSON.stringify(runSummary.trackPoints),
        };
        
        await apiRequest('POST', '/api/run-data', runDataPayload);
      }
      
      return exerciseResult;
    },
    onSuccess: async (data) => {
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
    
    setIsStarted(false);
    const summary = stopRecording();
    setRunSummary(summary);
    
    if (summary) {
      // Check if the run is valid (2 miles)
      if (summary.totalDistance < 2) {
        toast({
          title: 'Run incomplete',
          description: `You've only completed ${summary.totalDistance.toFixed(2)} miles. The test requires a full 2-mile run.`,
          variant: 'destructive',
        });
      } else {
        setShowCompleteDialog(true);
      }
    } else {
      toast({
        title: 'No run data',
        description: 'No data was recorded from your smartwatch.',
        variant: 'destructive',
      });
    }
  };
  
  // Calculate points based on performance
  const calculatePoints = (summary: RunSummary): number => {
    // Base time for maximum points (e.g., 13:00 = 780 seconds)
    const baseTime = 780;
    
    // Calculate points (max 100)
    if (summary.totalTime <= baseTime) {
      return 100;
    } else {
      // Deduct 1 point for every 6 seconds over base time
      const overTime = summary.totalTime - baseTime;
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
    if (!data || data.distance === 0) return '--:--';
    
    const paceSeconds = data.pace;
    const paceMinutes = Math.floor(paceSeconds / 60);
    const paceRemainingSeconds = Math.floor(paceSeconds % 60);
    
    return `${paceMinutes}:${paceRemainingSeconds.toString().padStart(2, '0')}/mi`;
  };
  
  // Get heart rate zone
  const getHeartRateZone = (heartRate: number) => {
    if (heartRate < 130) return 'Zone 2';
    if (heartRate < 150) return 'Zone 3';
    if (heartRate < 170) return 'Zone 4';
    return 'Zone 5';
  };
  
  // Handle scan button click
  const handleScan = async () => {
    try {
      await scanForDevices();
    } catch (error) {
      toast({
        title: 'Error scanning for devices',
        description: 'Make sure Bluetooth is enabled and try again.',
        variant: 'destructive',
      });
    }
  };
  
  // Handle device selection
  const handleDeviceSelect = async (deviceId: string) => {
    try {
      await connectDevice(deviceId);
    } catch (error) {
      toast({
        title: 'Error connecting to device',
        description: 'Unable to connect to the selected device.',
        variant: 'destructive',
      });
    }
  };
  
  // Handle complete dialog close
  const handleCompleteDialogClose = () => {
    setShowCompleteDialog(false);
  };
  
  // Handle save results
  const handleSaveResults = () => {
    saveMutation.mutate();
    setShowCompleteDialog(false);
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
            {data && data.latitude && data.longitude ? (
              // This would be replaced with an actual map component using leaflet or similar
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <div className="text-center text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto text-primary"/>
                  <p className="mt-2 text-sm">GPS location: {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}</p>
                  <p className="text-xs">Using GPS data from {device?.name || 'connected smartwatch'}</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <div className="text-center text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="mt-2 text-sm">No GPS data available</p>
                  <p className="text-xs">Connect a smartwatch to see your location</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <span className="text-sm text-gray-500 block">Distance</span>
              <span className="text-xl font-bold text-neutral-dark">
                {data ? data.distance.toFixed(2) : '0.00'} mi
              </span>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-500 block">Pace</span>
              <span className="text-xl font-bold text-neutral-dark">
                {data ? calculatePace() : '--:--'}
              </span>
            </div>
            <div className="text-center">
              <span className="text-sm text-gray-500 block">Calories</span>
              <span className="text-xl font-bold text-neutral-dark">
                {data && data.calories ? data.calories : '0'}
              </span>
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
              <Watch className="h-5 w-5 mr-2" />
              <h4 className="font-medium">
                {device ? `${device.name} Connected` : 'Smart Watch Required'}
              </h4>
            </div>
            
            {device ? (
              <p className="text-sm text-gray-600 mt-2">
                {device.brand.charAt(0).toUpperCase() + device.brand.slice(1)} watch connected and tracking your run.
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-2">
                  A smartwatch is required to verify your 2-mile run.
                </p>
                
                {devices.length > 0 ? (
                  <div className="flex gap-2 items-center">
                    <Select onValueChange={handleDeviceSelect}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a device" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map(device => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleScan} 
                    disabled={scanning}
                    className="w-full"
                  >
                    {scanning ? 'Scanning...' : 'Scan for Devices'}
                  </Button>
                )}
              </div>
            )}
          </div>
          
          {/* Verification Alert */}
          {!device && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Verification Required</AlertTitle>
              <AlertDescription>
                You must connect a smartwatch to verify your 2-mile run. Run data without verification will not be accepted.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Timer */}
          <div className="mb-6">
            <div className="text-center mb-2">
              <span className="text-4xl font-bold text-neutral-dark">{formatTime(elapsedTime)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="timer-progress bg-primary rounded-full h-2.5" 
                style={{ width: `${Math.min(100, ((data?.distance || 0) / 2) * 100)}%` }}
              ></div>
            </div>
          </div>
          
          {/* Heart Rate */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Heart Rate</h4>
            <div className="flex items-center">
              <Heart className="h-6 w-6 text-error mr-2" />
              <span className="text-2xl font-bold text-neutral-dark">
                {data ? data.heartRate : 0} BPM
              </span>
              <span className="ml-2 text-sm text-gray-500">
                {data ? `(${getHeartRateZone(data.heartRate)})` : ''}
              </span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="mt-auto grid grid-cols-2 gap-4">
            {!isStarted ? (
              <Button
                className="col-span-2 bg-primary hover:bg-blue-600"
                onClick={startRun}
                disabled={!device}
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
      
      {/* Completion Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Completed!</DialogTitle>
            <DialogDescription>
              Congratulations on completing your 2-mile run.
            </DialogDescription>
          </DialogHeader>
          
          {runSummary && (
            <div className="py-4">
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Distance</p>
                  <p className="text-lg font-semibold">{runSummary.totalDistance.toFixed(2)} miles</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="text-lg font-semibold">{formatTime(runSummary.totalTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Pace</p>
                  <p className="text-lg font-semibold">
                    {formatTime(runSummary.avgPace)}/mi
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Heart Rate</p>
                  <p className="text-lg font-semibold">{runSummary.avgHeartRate} BPM</p>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500">Verification Status</p>
                <div className="flex items-center mt-1">
                  {runSummary.verified ? (
                    <>
                      <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                      <p className="text-green-700">Verified by {device?.name}</p>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                      <p className="text-red-700">Not verified</p>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-500">Points Earned</p>
                <p className="text-2xl font-bold text-primary">
                  {calculatePoints(runSummary)}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCompleteDialogClose}>Cancel</Button>
            <Button onClick={handleSaveResults}>Save Results</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Run;
