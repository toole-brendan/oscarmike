import express from 'express';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

// Endpoints to check if smartwatch APIs are available
// These are mock endpoints that would be replaced with actual API integrations in production

// Check if Garmin Connect API is available
router.head('/garmin/status', (req, res) => {
  // In a real app, this would check if the Garmin Connect API integration is properly configured
  res.status(200).end();
});

// Check if Fitbit API is available
router.head('/fitbit/status', (req, res) => {
  // In a real app, this would check if the Fitbit API integration is properly configured
  res.status(200).end();
});

// OAuth callback for Garmin Connect (mock)
router.get('/garmin/auth/callback', (req, res) => {
  // In a real app, this would handle the OAuth callback from Garmin Connect
  res.json({ success: true, message: 'Garmin Connect authentication successful' });
});

// OAuth callback for Fitbit (mock)
router.get('/fitbit/auth/callback', (req, res) => {
  // In a real app, this would handle the OAuth callback from Fitbit
  res.json({ success: true, message: 'Fitbit authentication successful' });
});

// Get Garmin Connect activities (mock)
router.get('/garmin/activities', isAuthenticated, (req, res) => {
  // In a real app, this would fetch activities from Garmin Connect API
  const mockActivities = [
    {
      id: 'gc-123456',
      name: '2-Mile Run',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      distance: 2.03,
      avgPace: 575, // seconds per mile
      avgHeartRate: 155,
      maxHeartRate: 172,
      calories: 210,
      elevationGain: 12,
      trackPoints: generateMockTrackPoints(2.03),
    }
  ];
  
  res.json(mockActivities);
});

// Get Fitbit activities (mock)
router.get('/fitbit/activities', isAuthenticated, (req, res) => {
  // In a real app, this would fetch activities from Fitbit API
  const mockActivities = [
    {
      id: 'fb-567890',
      name: '2-Mile Run',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      distance: 2.05,
      avgPace: 582, // seconds per mile
      avgHeartRate: 152,
      maxHeartRate: 168,
      calories: 205,
      elevationGain: 10,
      trackPoints: generateMockTrackPoints(2.05),
    }
  ];
  
  res.json(mockActivities);
});

// Helper function to generate mock track points
function generateMockTrackPoints(distance: number) {
  const points = [];
  const totalPoints = 50; // Number of points to generate
  const startTime = Date.now() - 3600000; // 1 hour ago
  const duration = 20 * 60 * 1000; // 20 minutes in milliseconds
  const timeIncrement = duration / totalPoints;
  
  // Base coordinates (example: Central Park, NYC)
  const baseLatitude = 40.7812;
  const baseLongitude = -73.9665;
  
  for (let i = 0; i < totalPoints; i++) {
    const progress = i / totalPoints; // 0 to 1
    const currentDistance = distance * progress;
    
    // Simulate a circular route
    const angle = progress * 2 * Math.PI;
    const radius = 0.003; // Small radius for a tight loop
    
    const latitude = baseLatitude + Math.sin(angle) * radius;
    const longitude = baseLongitude + Math.cos(angle) * radius;
    
    points.push({
      latitude,
      longitude,
      altitude: 10 + Math.sin(angle * 2) * 5, // Simulated hills
      timestamp: startTime + (i * timeIncrement),
      heartRate: 140 + Math.floor(Math.sin(angle) * 15), // Heart rate variation
    });
  }
  
  return points;
}

export default router; 