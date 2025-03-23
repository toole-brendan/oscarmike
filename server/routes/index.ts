import express from 'express';
import runDataRouter from './run-data';

// Create main router
const router = express.Router();

// Register routes
router.use('/run-data', runDataRouter);

// Add future routes here
// router.use('/users', usersRouter);
// router.use('/exercises', exercisesRouter);
// router.use('/form-issues', formIssuesRouter);
// router.use('/key-points', keyPointsRouter);

export default router; 