import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExerciseType, exerciseTypes } from '@shared/schema';
import { apiRequestObject } from '@/lib/queryClient';
import { AlertTriangle, MapPin, Globe, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type LeaderboardUser = {
  userId: number;
  username: string;
  totalPoints: number;
  distance?: number;
};

type LeaderboardExercise = {
  id: number;
  userId: number;
  type: ExerciseType;
  status: string;
  repCount: number | null;
  formScore: number | null;
  runTime: number | null;
  completedAt: string;
  points: number | null;
};

const Leaderboard: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'overall' | ExerciseType>('overall');
  const [userId, setUserId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'global' | 'local'>('global');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Try to get user ID from local storage for demo purposes
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.id) {
          setUserId(parsed.id);
        }
      } catch (e) {
        console.error('Error parsing stored user', e);
      }
    }
  }, []);

  // Mutation for updating user location
  const locationMutation = useMutation({
    mutationFn: async (location: { latitude: number; longitude: number }) => {
      if (!userId) {
        throw new Error("No user ID available");
      }
      return apiRequestObject({
        url: `/api/users/${userId}/location`,
        method: 'PATCH',
        body: location,
        on401: 'throw'
      });
    },
    onSuccess: () => {
      toast({
        title: "Location updated",
        description: "Your location has been updated for local leaderboards.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/local-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/local-leaderboard', selectedTab] });
    },
    onError: (error) => {
      console.error('Error updating location:', error);
      toast({
        title: "Error updating location",
        description: "Could not update your location. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Function to get user's location and update it
  const updateUserLocation = () => {
    if (!userId) {
      setLocationError("You need to be logged in to use local leaderboards");
      return;
    }

    setIsUpdatingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsUpdatingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        locationMutation.mutate({ latitude, longitude });
        setIsUpdatingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationError("Could not get your location. Please enable location services and try again.");
        setIsUpdatingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Fetch global overall leaderboard data
  const { data: globalOverallLeaderboard, isLoading: globalOverallLoading } = useQuery({
    queryKey: ['/api/leaderboard'],
    queryFn: async () => {
      return apiRequestObject({
        url: '/api/leaderboard',
        method: 'GET',
        on401: 'throw'
      }) as Promise<LeaderboardUser[]>;
    }
  });

  // Fetch global exercise-specific leaderboard data
  const { data: globalExerciseLeaderboard, isLoading: globalExerciseLoading } = useQuery({
    queryKey: ['/api/leaderboard', selectedTab],
    queryFn: async () => {
      if (selectedTab === 'overall') return null;
      
      return apiRequestObject({
        url: `/api/leaderboard/${selectedTab}`,
        method: 'GET',
        on401: 'throw'
      }) as Promise<LeaderboardExercise[]>;
    },
    enabled: selectedTab !== 'overall'
  });

  // Fetch local overall leaderboard data
  const { data: localOverallLeaderboard, isLoading: localOverallLoading } = useQuery({
    queryKey: ['/api/local-leaderboard'],
    queryFn: async () => {
      if (!userId) {
        throw new Error("No user ID available");
      }
      
      return apiRequestObject({
        url: `/api/local-leaderboard?userId=${userId}`,
        method: 'GET',
        on401: 'throw'
      }) as Promise<LeaderboardUser[]>;
    },
    enabled: viewMode === 'local' && userId !== null,
    retry: false,
    onError: (err) => {
      console.error('Error fetching local overall leaderboard:', err);
      setLocationError("Error fetching local leaderboard. You may need to update your location.");
    }
  });

  // Fetch local exercise-specific leaderboard data
  const { data: localExerciseLeaderboard, isLoading: localExerciseLoading } = useQuery({
    queryKey: ['/api/local-leaderboard', selectedTab],
    queryFn: async () => {
      if (selectedTab === 'overall' || !userId) {
        return null;
      }
      
      return apiRequestObject({
        url: `/api/local-leaderboard/${selectedTab}?userId=${userId}`,
        method: 'GET',
        on401: 'throw'
      }) as Promise<LeaderboardExercise[]>;
    },
    enabled: viewMode === 'local' && selectedTab !== 'overall' && userId !== null,
    retry: false,
    onError: (err) => {
      console.error('Error fetching local exercise leaderboard:', err);
      setLocationError("Error fetching local leaderboard. You may need to update your location.");
    }
  });

  const overallLeaderboard = viewMode === 'global' ? globalOverallLeaderboard : localOverallLeaderboard;
  const exerciseLeaderboard = viewMode === 'global' ? globalExerciseLeaderboard : localExerciseLeaderboard;
  
  const isLoading = viewMode === 'global' 
    ? (globalOverallLoading || (selectedTab !== 'overall' && globalExerciseLoading))
    : (localOverallLoading || (selectedTab !== 'overall' && localExerciseLoading));

  // Format the run time from seconds to MM:SS
  const formatRunTime = (seconds: number | null): string => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format distance to show in miles with one decimal place
  const formatDistance = (distance: number | undefined): string => {
    if (distance === undefined) return 'N/A';
    return `${distance.toFixed(1)} mi`;
  };

  // Get user rank badge based on position
  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-400 text-black">1st</Badge>;
    if (index === 1) return <Badge className="bg-gray-300 text-black">2nd</Badge>;
    if (index === 2) return <Badge className="bg-amber-600 text-white">3rd</Badge>;
    return <Badge variant="outline">{index + 1}th</Badge>;
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Loading leaderboard data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold text-neutral-dark mb-6">PT Test Leaderboard</h1>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'global' ? 'default' : 'outline'} 
            onClick={() => setViewMode('global')}
            className="flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            Global
          </Button>
          <Button 
            variant={viewMode === 'local' ? 'default' : 'outline'} 
            onClick={() => setViewMode('local')}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            Local (5 mi)
          </Button>
        </div>
        
        {viewMode === 'local' && (
          <Button 
            variant="outline" 
            onClick={updateUserLocation}
            disabled={isUpdatingLocation || !userId}
            className="flex items-center gap-2"
          >
            {isUpdatingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Update My Location
          </Button>
        )}
      </div>
      
      {viewMode === 'local' && locationError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-medium">{locationError}</p>
            <p className="text-yellow-700 text-sm mt-1">
              Local leaderboards require your location. Please update your location to see users in your area.
            </p>
          </div>
        </div>
      )}
      
      <Tabs defaultValue="overall" value={selectedTab} onValueChange={(value) => setSelectedTab(value as 'overall' | ExerciseType)}>
        <TabsList className="mb-6">
          <TabsTrigger value="overall">Overall</TabsTrigger>
          <TabsTrigger value="pushups">Push-ups</TabsTrigger>
          <TabsTrigger value="pullups">Pull-ups</TabsTrigger>
          <TabsTrigger value="situps">Sit-ups</TabsTrigger>
          <TabsTrigger value="run">2-Mile Run</TabsTrigger>
        </TabsList>

        <TabsContent value="overall">
          <Card>
            <CardHeader>
              <CardTitle>
                {viewMode === 'global' ? 'Global Overall Ranking' : 'Local Overall Ranking'}
              </CardTitle>
              {viewMode === 'local' && (
                <CardDescription>
                  Users within 5 miles of your location
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                    {viewMode === 'local' && (
                      <TableHead className="text-right">Distance</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallLeaderboard && overallLeaderboard.length > 0 ? (
                    overallLeaderboard.map((entry, index) => (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium">{getRankBadge(index)}</TableCell>
                        <TableCell>{entry.username}</TableCell>
                        <TableCell className="text-right font-semibold">{entry.totalPoints}</TableCell>
                        {viewMode === 'local' && (
                          <TableCell className="text-right">{formatDistance(entry.distance)}</TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={viewMode === 'local' ? 4 : 3} className="text-center py-8 text-gray-500">
                        {viewMode === 'local' 
                          ? "No local users found. Try updating your location or switching to global view."
                          : "No leaderboard data available yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {exerciseTypes.map((type) => (
          <TabsContent key={type} value={type}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {viewMode === 'global' ? 'Global ' : 'Local '}
                  {type === 'pushups' ? 'Push-ups' :
                   type === 'pullups' ? 'Pull-ups' :
                   type === 'situps' ? 'Sit-ups' : '2-Mile Run'} Ranking
                </CardTitle>
                {viewMode === 'local' && (
                  <CardDescription>
                    Users within 5 miles of your location
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>User ID</TableHead>
                      {type === 'run' ? (
                        <TableHead className="text-right">Time</TableHead>
                      ) : (
                        <TableHead className="text-right">Repetitions</TableHead>
                      )}
                      <TableHead className="text-right">Form Score</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exerciseLeaderboard && exerciseLeaderboard.length > 0 ? (
                      exerciseLeaderboard.map((entry, index) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{getRankBadge(index)}</TableCell>
                          <TableCell>User #{entry.userId}</TableCell>
                          {type === 'run' ? (
                            <TableCell className="text-right">{formatRunTime(entry.runTime)}</TableCell>
                          ) : (
                            <TableCell className="text-right">{entry.repCount || 'N/A'}</TableCell>
                          )}
                          <TableCell className="text-right">{entry.formScore || 'N/A'}</TableCell>
                          <TableCell className="text-right font-semibold">{entry.points || 0}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          {viewMode === 'local'
                            ? `No local ${type} exercise data available. Try updating your location or switching to global view.`
                            : `No ${type} exercise data available yet.`}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Leaderboard;