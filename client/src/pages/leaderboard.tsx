import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExerciseType, exerciseTypes } from '@shared/schema';
import { apiRequestObject } from '@/lib/queryClient';

type LeaderboardUser = {
  userId: number;
  username: string;
  totalPoints: number;
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

  // Fetch overall leaderboard data
  const { data: overallLeaderboard, isLoading: overallLoading } = useQuery({
    queryKey: ['/api/leaderboard'],
    queryFn: async () => {
      return apiRequestObject({
        url: '/api/leaderboard',
        method: 'GET',
        on401: 'throw'
      }) as Promise<LeaderboardUser[]>;
    }
  });

  // Fetch exercise-specific leaderboard data
  const { data: exerciseLeaderboard, isLoading: exerciseLoading } = useQuery({
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

  const isLoading = overallLoading || (selectedTab !== 'overall' && exerciseLoading);

  // Format the run time from seconds to MM:SS
  const formatRunTime = (seconds: number | null): string => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
              <CardTitle>Overall Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallLeaderboard && overallLeaderboard.length > 0 ? (
                    overallLeaderboard.map((entry, index) => (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium">{getRankBadge(index)}</TableCell>
                        <TableCell>{entry.username}</TableCell>
                        <TableCell className="text-right font-semibold">{entry.totalPoints}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                        No leaderboard data available yet.
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
                  {type === 'pushups' ? 'Push-ups' :
                   type === 'pullups' ? 'Pull-ups' :
                   type === 'situps' ? 'Sit-ups' : '2-Mile Run'} Ranking
                </CardTitle>
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
                          No {type} exercise data available yet.
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