import express from 'express';
import path from 'path';
import runDataRouter from './routes/run-data';
import smartwatchApiRouter from './routes/smartwatch-api';

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Simple CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Add Feature-Policy/Permissions-Policy for camera access
  res.header('Feature-Policy', 'camera self; microphone self');
  res.header('Permissions-Policy', 'camera=self, microphone=self');
  
  // Add strict HTTPS policy for secure contexts
  res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// API routes
app.use('/api/run-data', runDataRouter);
app.use('/api', smartwatchApiRouter); // Mount smartwatch API routes

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the client build directory
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  // Handle any routes not covered by the API
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; 