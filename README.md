# OMPT: AI-Powered Fitness Evaluation

A computer vision-powered application that grades bodyweight exercises and running performance for physical fitness tests.

## Overview

OMPT is a comprehensive fitness evaluation tool that uses artificial intelligence and computer vision to assess and grade physical fitness exercises with precision. The application focuses on four key exercises commonly found in military and fitness tests:

- Push-ups
- Pull-ups  
- Sit-ups
- 2-mile run

Unlike traditional fitness tests that rely on human judgment, OMPT leverages advanced pose detection technology to ensure consistent and objective evaluation of exercise form and performance.

## Features

### Real-time Form Analysis
- Computer vision powered by TensorFlow.js detects and analyzes 17 key body points
- Provides instant feedback on exercise form and technique
- Detects and counts valid repetitions only when proper form is maintained
- High-precision angle calculation for joint position analysis

### Exercise Types
- **Push-ups**: 
  - Monitors elbow angles, body alignment, and range of motion
  - Checks for proper depth (90° elbow angle at bottom position)
  - Validates straight back alignment during movement
  - Ensures full range of motion with arms fully extended at top

- **Pull-ups**: 
  - Tracks chin position relative to bar and full extension
  - Validates complete arm extension at bottom position
  - Monitors shoulder alignment and movement patterns
  - Prevents "kipping" and other form cheats

- **Sit-ups**: 
  - Evaluates torso angle and proper form throughout the movement
  - Measures hip flexion angle for proper execution
  - Detects incomplete repetitions
  - Tracks back positioning for safety

- **2-Mile Run**: 
  - Integrates with smartwatch devices via Web Bluetooth and vendor APIs
  - Supports multiple smartwatch brands (Garmin, Apple, Fitbit, Samsung, Polar, Suunto, Coros)
  - Verified run tracking with GPS data and distance validation
  - Captures comprehensive metrics including pace, heart rate, cadence, and elevation
  - Exports run data in industry-standard GPX format
  - Real-time route visualization and performance metrics
  - Enforces completion of full 2-mile distance for test validity

### Performance Tracking
- Records rep counts, form scores, and completion times
- Provides detailed feedback on form issues and areas for improvement
- Stores historical data to track progress over time
- Calculates point scores based on military fitness standards
- Verifies run completion with smartwatch GPS data for integrity

### User-Friendly Interface
- Clean and intuitive dashboard displays exercise status and best results
- Visual representation of body position and form during exercises
- Real-time audio and visual cues for exercise technique
- Mobile-responsive design for use on various devices

## Technology Stack

### Frontend
- React for UI components and state management
- TensorFlow.js for in-browser pose detection without server latency
- Shadcn UI for modern interface components
- Real-time data visualization with Recharts
- TanStack Query for efficient data fetching and caching
- Wouter for lightweight routing
- Tailwind CSS for responsive styling
- TypeScript for improved type safety
- Web Bluetooth API for direct smartwatch connectivity

### Backend
- Express.js server handling API requests
- PostgreSQL database for data persistence with proper indexing
- Drizzle ORM for type-safe database interactions
- RESTful API design for client-server communication
- Rate limiting for API protection
- Express session management for authentication
- Smartwatch API integrations (Garmin Connect, Fitbit)

### Computer Vision
- TensorFlow.js MoveNet pose detection model
- Real-time keypoint detection (17 body points) at 30FPS
- Custom exercise validation algorithms for each exercise type
- Configurable confidence thresholds for pose detection
- WebRTC integration for camera access across browsers

### Security Implementation
- JWT-based authentication with proper expiration
- Bcrypt password hashing with configurable salt rounds
- Rate limiting to prevent brute-force attacks
- Input validation and sanitization
- Protected API routes with middleware authorization
- HTTPS enforcement in production
- Secure HTTP headers implementation

## Technical Implementation

### Pose Detection Architecture
The application uses TensorFlow.js's pose detection models to identify key body points in real-time. The process follows these steps:

1. **Initialization**: 
   - Loads the MoveNet SinglePose Lightning model (~3MB)
   - Initializes WebGL backend for GPU acceleration
   - Sets up camera with optimal resolution for detection

2. **Detection Pipeline**:
   - Captures video frames at ~30FPS 
   - Preprocesses frames (resizing, normalization)
   - Runs inference to extract 17 keypoints with confidence scores
   - Post-processes keypoints to smooth detection jitter
   - Applies detection results to exercise validation logic

3. **Keypoint Utilization**:
   - Calculates joint angles (e.g., elbow angles during push-ups)
   - Measures distances between body parts
   - Tracks movement patterns over time
   - Validates proper exercise form against defined criteria

### Exercise Validation Algorithms
Each exercise has specific validation rules using geometric calculations:

- **Push-ups**: 
  - Proper elbow flexion angle (90° at bottom position)
  - Straight back alignment (hip-shoulder-ankle angle)
  - Full range of motion (arms fully extended at top)
  - Proper head position relative to spine

- **Pull-ups**:
  - Chin clearing the bar at top position (negative Y-distance between chin and wrists)
  - Full arm extension at bottom position (>150° elbow angle)
  - Proper shoulder alignment throughout movement
  - Detection of "kipping" motion via acceleration analysis

- **Sit-ups**:
  - Proper torso-to-floor angle (>70° at top position)
  - Complete range of motion (returning to starting position)
  - Correct positioning of upper body
  - Proper knee angle (bent at ~90°)

### Rep Detection System
The rep detection algorithm analyzes movement patterns over time:

1. Maintains a sliding window of recent poses (typically 5-10 frames)
2. Analyzes the trajectory of key joints to identify exercise phases
3. Detects state transitions (e.g., down to up in push-ups)
4. Validates full range of motion before counting a rep
5. Applies debouncing to prevent duplicate rep counting

### Scoring System
The application implements a sophisticated scoring system:

- **Push-ups, Pull-ups, Sit-ups**:
  - Base score calculated from rep count
  - Adjusted by form quality percentage
  - Scaled based on military fitness standards by age/gender
  - Time factors considered (reps per minute)

- **2-Mile Run**:
  - Base score from completion time
  - Points deducted for pace inconsistency
  - Adjusted for elevation changes (when GPS data available)
  - Scaled based on military fitness standards by age/gender

### Data Storage Architecture
Exercise data is stored in a PostgreSQL database with the following schema:

- **Users Table**:
  - `id`: Primary key
  - `username`: Unique identifier
  - `password`: Bcrypt hashed
  - `latitude/longitude`: Optional location for run tracking

- **Exercises Table**:
  - `id`: Primary key
  - `userId`: Foreign key to Users
  - `type`: Exercise type (enum)
  - `status`: Current status (not_started/in_progress/completed)
  - `repCount`: Number of valid repetitions
  - `formScore`: Score based on form quality (0-100)
  - `runTime`: Time in seconds for run events
  - `completedAt`: Timestamp of completion
  - `points`: Calculated performance points
  - `createdAt`: Creation timestamp

- **FormIssues Table**:
  - `id`: Primary key
  - `exerciseId`: Foreign key to Exercises
  - `issue`: Description of form problem
  - `severity`: Issue severity level
  - `timestamp`: When issue occurred

- **KeyPoints Table**:
  - `id`: Primary key
  - `exerciseId`: Foreign key to Exercises
  - `timestamp`: When keypoints were captured
  - `data`: JSON blob of keypoint data

### Smartwatch Integration Architecture
The application uses Web Bluetooth API and vendor-specific API integrations to connect with smartwatch devices for run verification:

1. **Connectivity Layer**:
   - Web Bluetooth API for direct device connectivity in compatible browsers
   - Vendor API integrations for Garmin Connect, Fitbit, and other platforms
   - Automated device discovery and pairing process
   - Robust connection management with error handling and reconnection logic

2. **Data Collection Pipeline**:
   - Real-time GPS coordinate tracking with configurable sampling rate
   - Heart rate monitoring via Bluetooth GATT service
   - Pace calculation with terrain and elevation consideration
   - Noise filtering for GPS waypoints with confidence scoring
   - Persistent data storage in cross-compatible formats

3. **Verification System**:
   - Distance validation using GPS waypoints and distance calculations
   - Route integrity verification to prevent data manipulation
   - Minimum waypoint requirement to validate continuous tracking
   - Completion threshold validation (minimum 2.0 miles)
   - Data integrity checks with statistical anomaly detection

4. **Data Utilization**:
   - Standardized GPX export capabilities for external analysis
   - Integration with fitness platforms through authentication tokens
   - Performance metrics visualization with heat maps and split analysis
   - Historical comparison with previous run attempts
   - Secure cloud storage of verified run data

## Browser & Device Compatibility

### Supported Browsers
- Chrome 83+ (recommended for best performance)
- Firefox 76+
- Safari 14+ (limited performance)
- Edge 83+

### Hardware Requirements
- **Processor**: Dual-core processor, 2GHz+ recommended
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Camera**: 720p webcam minimum, 1080p recommended
- **GPU**: Dedicated GPU recommended for optimal performance
- **Network**: Stable broadband connection (5Mbps+)

### Mobile Support
- Progressive Web App (PWA) functionality
- Responsive design for tablet and mobile use
- Reduced detection quality on low-end mobile devices

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL database (v14+)
- Redis (optional, for enhanced caching)
- Webcam for exercise detection
- Modern browser with WebRTC support

### Development Setup

1. Clone the repository
```
git clone https://github.com/yourusername/ompt.git
cd ompt
```

2. Install dependencies
```
npm install
```

3. Set up environment variables
```
# Create .env file with the following variables
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379 # Optional
```

4. Push database schema
```
npm run db:push
```

5. Start the development server
```
npm run dev
```

6. Open your browser and navigate to `http://localhost:5000`

### Production Setup

1. Clone the repository and install dependencies as above

2. Create production environment variables
```
# Create .env.production file with secure production values
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your_secure_session_secret
JWT_SECRET=your_secure_jwt_secret
NODE_ENV=production
PORT=5000
```

3. Build the application
```
npm run build
```

4. Start the production server
```
npm run start
```

### Docker Deployment

1. Build the Docker image
```
docker build -t ompt:latest .
```

2. Run the container
```
docker run -p 5000:5000 --env-file .env.production ompt:latest
```

## Usage Guide

### Setting Up a Test
1. Create an account or login with existing credentials
2. From the dashboard, select the exercise you wish to perform
3. Position yourself in front of your webcam ensuring your full body is visible
4. Follow the on-screen instructions to begin the exercise

### Setting Up a Run Test with Smartwatch
1. From the dashboard, select "2-Mile Run" exercise
2. Connect your smartwatch using the "Connect Device" option
   - The system will scan for nearby Bluetooth-enabled smartwatches
   - For vendor-specific connections (Garmin, Fitbit), you may need to authorize via their respective apps
3. Once connected, your smartwatch details and connection status will display
4. Position yourself at your starting point for the run
5. Press "Start Run" to begin tracking through your smartwatch
6. Complete the full 2-mile distance as measured by your smartwatch
7. Upon completion, press "End Run" to finish the test
8. Review your performance metrics and verification status
9. Save the results to your profile for evaluation

### During Exercise
- The application will display your body position with a skeleton overlay
- Real-time feedback will appear indicating proper or improper form
- Valid repetitions will be counted automatically
- Form issues will be tracked and saved for later review

### During the Run
- The application will display real-time metrics from your smartwatch including:
  - Current distance
  - Elapsed time
  - Current pace
  - Heart rate and zone
  - Estimated completion time
- A progress indicator will show your progress toward the 2-mile goal
- GPS data will be continuously collected to verify your route

### After Exercise
- Review your performance metrics including rep count and form score
- Examine detailed feedback on form issues
- Track progress over time through historical data
- Compare results with military fitness standards

### After the Run
- Review comprehensive performance metrics
- Verify the run was successfully tracked and meets the 2-mile requirement
- Export your run data in GPX format if desired
- View your verified run on the results page with official scoring
- Compare against military fitness standards

## Performance Optimization

### Client-Side Optimizations
- Efficient render management with React
- WebGL acceleration for TensorFlow operations
- Webcam frame rate throttling based on device capability
- Lazy loading of non-critical components
- RAM usage optimization for pose detection model

### Server-Side Optimizations
- Connection pooling for database operations
- Query optimization with proper indexes
- Redis caching for frequent data access patterns
- Horizontal scaling support with stateless design
- Response compression for bandwidth reduction

### Data Flow Optimization
- Minimal keypoint data transmission
- Batched updates for exercise statistics
- Incremental loading of historical data
- WebSocket usage for real-time updates (where appropriate)

## Scalability & Production Readiness

### Optimized for Scale
The application has been designed with scalability in mind:

- **Database Architecture**
  - Connection pooling optimized for high concurrency (25 simultaneous connections)
  - Proper indexing on all frequently queried fields
  - Designed for horizontal scaling with connection pooling
  - Dedicated indexes for leaderboard and user history queries

- **Caching Layer**
  - Redis-based caching for leaderboards and frequently accessed data
  - Configurable TTL (Time-To-Live) for cached items
  - Cache invalidation strategies for data consistency
  - Memory-optimized storage patterns

- **API Performance**
  - Rate limiting to prevent abuse and ensure consistent performance
  - Pagination support for all list endpoints
  - Request logging and monitoring for performance analysis
  - Optimized routes with minimal overhead

- **Security Measures**
  - JWT-based authentication with proper expiration
  - Bcrypt password hashing with configurable salt rounds
  - Protected routes with proper authorization checks
  - Input validation and sanitization

### Deployment Infrastructure
For optimal performance with hundreds of users, we recommend:

- **Database**
  - Production-grade PostgreSQL instance (AWS RDS, Azure Database, or similar)
  - At least 4 vCPUs and 16GB RAM for medium workloads
  - Regular backup schedule
  - Read replicas for scaling read operations

- **Application Servers**
  - Multiple application instances behind a load balancer
  - Auto-scaling based on CPU/memory utilization
  - Minimum of 2 instances for high availability
  - Blue-green deployment strategy for zero-downtime updates

- **Caching**
  - Dedicated Redis instance for caching
  - Consider Redis Cluster for larger deployments
  - Cache warming strategies for commonly accessed data

- **Monitoring**
  - Detailed logging with Winston
  - Integration with monitoring tools (Datadog, New Relic, etc.)
  - Custom metrics for performance tracking
  - Alerting for availability and performance issues

### Production Deployment
Use the included deployment script:

```bash
./deploy.sh
```

This will:
1. Install all required dependencies
2. Build the application for production
3. Run database migrations
4. Start the server with production settings

## Error Handling & Resilience

### Client-Side Error Handling
- Graceful degradation when TensorFlow fails to load
- Alternate modes for devices without webcam access
- Toast notification system for user feedback
- Retry logic for temporary network issues

### Server-Side Resilience
- Exponential backoff for database connection issues
- Fallback to in-memory database for development
- Comprehensive error logging with context
- API error responses with meaningful codes and messages

## Testing Strategy

### Frontend Testing
- Component testing with React Testing Library
- Visual regression testing for UI components
- End-to-end testing with Playwright or Cypress
- Performance testing with Lighthouse

### Backend Testing
- API endpoint testing with Jest
- Database integration tests
- Load testing with Artillery or JMeter
- Security testing with OWASP guidelines

### AI/ML Testing
- Pose detection accuracy validation
- Rep counting reliability testing
- Form validation consistency checks
- Cross-browser compatibility testing

## Contributing

We welcome contributions to the OMPT project! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests to ensure functionality
5. Submit a pull request

Please see CONTRIBUTING.md for detailed guidelines.

## Future Enhancements

- Integration with additional wearable devices and fitness platforms
- Advanced smartwatch metrics analysis (VO2 max, training effect, recovery time)
- Virtual group runs with real-time position sharing
- Route planning and course verification for standardized testing
- AI-powered running form analysis using smartwatch motion sensors
- Support for more exercise types (burpees, planks, lunges)
- Machine learning improvements for higher accuracy
- Mobile application support with React Native
- Group/team testing capabilities
- Offline mode with synchronization
- Virtual coaching with AI feedback
- Integration with fitness platforms (Strava, Garmin, etc.)
- Personalized training recommendations
- Advanced analytics dashboard

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TensorFlow.js team for their pose detection models
- The open-source community for their invaluable contributions
- Shadcn UI for the component library
- Military fitness standards documentation for scoring references