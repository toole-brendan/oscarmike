import express from 'express';
import { insertRunDataSchema } from '../../shared/schema';
import { storage } from '../storage';
import { isAuthenticated } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// POST /api/run-data - Store run data from smartwatch
router.post('/', isAuthenticated, async (req, res) => {
  try {
    // Validate request body against schema
    const validationResult = insertRunDataSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid run data',
        details: validationResult.error.format()
      });
    }
    
    // Ensure the exercise belongs to the current user
    const exercise = await storage.getExerciseById(req.body.exerciseId);
    
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    
    if (exercise.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to add data to this exercise' });
    }
    
    // Store the run data
    const runData = await storage.createRunData(req.body);
    
    // Update the exercise to mark it as verified
    await storage.updateExercise(exercise.id, { verified: true });
    
    res.status(201).json(runData);
  } catch (error) {
    console.error('Error storing run data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/run-data/:exerciseId - Get run data for an exercise
router.get('/:exerciseId', isAuthenticated, async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.exerciseId);
    
    if (isNaN(exerciseId)) {
      return res.status(400).json({ error: 'Invalid exercise ID' });
    }
    
    // Get the exercise to check ownership
    const exercise = await storage.getExerciseById(exerciseId);
    
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    
    // Check if user is authorized to access this data
    if (exercise.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to access this run data' });
    }
    
    // Get the run data for this exercise
    const data = await storage.getRunDataByExerciseId(exerciseId);
    
    if (!data) {
      return res.status(404).json({ error: 'No run data found for this exercise' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error retrieving run data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/run-data/export/:exerciseId - Export run data as GPX
router.get('/export/:exerciseId', isAuthenticated, async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.exerciseId);
    
    if (isNaN(exerciseId)) {
      return res.status(400).json({ error: 'Invalid exercise ID' });
    }
    
    // Get the exercise to check ownership
    const exercise = await storage.getExerciseById(exerciseId);
    
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    
    // Check if user is authorized to access this data
    if (exercise.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to access this run data' });
    }
    
    // Get the run data for this exercise
    const data = await storage.getRunDataByExerciseId(exerciseId);
    
    if (!data) {
      return res.status(404).json({ error: 'No run data found for this exercise' });
    }
    
    // Parse the GPS data
    let trackPoints: any[] = [];
    try {
      if (data.gpsData) {
        trackPoints = JSON.parse(data.gpsData);
      }
    } catch (e) {
      console.error('Error parsing GPS data:', e);
    }
    
    // Generate GPX file
    const gpx = generateGPX(exercise, data, trackPoints);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="run-${exerciseId}.gpx"`);
    
    res.send(gpx);
  } catch (error) {
    console.error('Error exporting run data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate GPX from run data
function generateGPX(exercise: any, runData: any, trackPoints: any[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="OMPT Run Tracker" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>OMPT 2-Mile Run</name>
    <time>${new Date(runData.startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>2-Mile Run</name>
    <trkseg>`;
  
  const points = trackPoints.map(point => {
    return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${point.altitude || 0}</ele>
        <time>${new Date(point.timestamp).toISOString()}</time>
        ${point.heartRate ? `<extensions><hr>${point.heartRate}</hr></extensions>` : ''}
      </trkpt>`;
  }).join('\n');
  
  const footer = `    </trkseg>
  </trk>
</gpx>`;
  
  return `${header}\n${points}\n${footer}`;
}

export default router; 