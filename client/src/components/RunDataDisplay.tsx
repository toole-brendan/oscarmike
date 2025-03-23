import React from 'react';
import { SmartWatchRunData, RunSummary } from '@/lib/smartwatch-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Timer, Route, Zap, Award, Footprints } from 'lucide-react';

interface RunDataDisplayProps {
  data: SmartWatchRunData | null;
  summary?: RunSummary | null;
  className?: string;
}

const RunDataDisplay: React.FC<RunDataDisplayProps> = ({ 
  data, 
  summary, 
  className = '' 
}) => {
  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format pace as mm:ss/mi
  const formatPace = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
  };
  
  // Get heart rate zone
  const getHeartRateZone = (bpm: number): string => {
    if (bpm < 120) return 'Zone 1';
    if (bpm < 140) return 'Zone 2';
    if (bpm < 160) return 'Zone 3';
    if (bpm < 180) return 'Zone 4';
    return 'Zone 5';
  };
  
  // Helper to get heart rate zone class
  const getHeartRateZoneClass = (bpm: number): string => {
    if (bpm < 120) return 'text-blue-500';
    if (bpm < 140) return 'text-green-500';
    if (bpm < 160) return 'text-yellow-500';
    if (bpm < 180) return 'text-orange-500';
    return 'text-red-500';
  };

  // Calculate estimated finish time based on current pace
  const calculateEstimatedFinish = (): string => {
    if (!data || data.distance === 0) return '--:--';
    
    // If we already have summary data, return actual time
    if (summary) {
      return formatTime(summary.totalTime);
    }
    
    // Otherwise estimate based on current pace
    const estimatedTotalSeconds = data.pace * 2; // 2 miles total
    return formatTime(Math.round(estimatedTotalSeconds));
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Run Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center p-3 bg-primary-50 rounded-lg">
              <Route className="h-5 w-5 text-primary mb-1" />
              <div className="text-xs text-muted-foreground">Distance</div>
              <div className="text-xl font-bold">
                {summary ? summary.totalDistance.toFixed(2) : data ? data.distance.toFixed(2) : '0.00'} mi
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-primary-50 rounded-lg">
              <Timer className="h-5 w-5 text-primary mb-1" />
              <div className="text-xs text-muted-foreground">Est. Finish</div>
              <div className="text-xl font-bold">
                {calculateEstimatedFinish()}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-primary-50 rounded-lg">
              <Zap className="h-5 w-5 text-primary mb-1" />
              <div className="text-xs text-muted-foreground">Pace</div>
              <div className="text-xl font-bold">
                {data ? formatPace(data.pace) : (summary ? formatPace(summary.avgPace) : '--:--')}
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center p-3 bg-primary-50 rounded-lg">
              <Heart className={`h-5 w-5 mb-1 ${data ? getHeartRateZoneClass(data.heartRate) : 'text-primary'}`} />
              <div className="text-xs text-muted-foreground">Heart Rate</div>
              <div className="text-xl font-bold">
                {data ? data.heartRate : (summary ? summary.avgHeartRate : 0)} BPM
              </div>
              <div className="text-xs">
                {data ? getHeartRateZone(data.heartRate) : (summary ? getHeartRateZone(summary.avgHeartRate) : '')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Additional Stats (when available) */}
      {(data?.calories || summary?.calories) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Additional Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="text-sm text-muted-foreground">Calories</div>
                  <div className="font-medium">{data?.calories || summary?.calories || 0}</div>
                </div>
              </div>
              
              {data?.cadence && (
                <div className="flex items-center space-x-2">
                  <Footprints className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Cadence</div>
                    <div className="font-medium">{data.cadence} spm</div>
                  </div>
                </div>
              )}
              
              {summary && (
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="text-sm text-muted-foreground">Max Heart Rate</div>
                    <div className="font-medium">{summary.maxHeartRate} BPM</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Verification Status when summary is available */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verification Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-2 ${summary.verified ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <div className={`font-medium ${summary.verified ? 'text-green-700' : 'text-red-700'}`}>
                  {summary.verified ? 'Verified' : 'Not Verified'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {summary.verified 
                    ? 'This run has been verified by your smartwatch data' 
                    : 'This run could not be verified - make sure you complete the full 2 miles'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RunDataDisplay; 