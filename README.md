# PT Test Pro: AI-Powered Fitness Evaluation

A computer vision-powered application that grades bodyweight exercises and running performance for physical fitness tests.

## Overview

PT Test Pro is a comprehensive fitness evaluation tool that uses artificial intelligence and computer vision to assess and grade physical fitness exercises with precision. The application focuses on four key exercises commonly found in military and fitness tests:

- Push-ups
- Pull-ups  
- Sit-ups
- 2-mile run

Unlike traditional fitness tests that rely on human judgment, PT Test Pro leverages advanced pose detection technology to ensure consistent and objective evaluation of exercise form and performance.

## Features

### Real-time Form Analysis
- Computer vision powered by TensorFlow.js detects and analyzes 17 key body points
- Provides instant feedback on exercise form and technique
- Detects and counts valid repetitions only when proper form is maintained

### Exercise Types
- **Push-ups**: Monitors elbow angles, body alignment, and range of motion
- **Pull-ups**: Tracks chin position relative to bar and full extension
- **Sit-ups**: Evaluates torso angle and proper form throughout the movement
- **2-Mile Run**: Integrates with smartwatch GPS to track distance and pace

### Performance Tracking
- Records rep counts, form scores, and completion times
- Provides detailed feedback on form issues and areas for improvement
- Stores historical data to track progress over time

### User-Friendly Interface
- Clean and intuitive dashboard displays exercise status and best results
- Visual representation of body position and form during exercises
- Real-time audio and visual cues for exercise technique

## Technology Stack

### Frontend
- React for UI components
- TensorFlow.js for in-browser pose detection
- Shadcn UI for modern interface components
- Real-time data visualization with Recharts

### Backend
- Express.js server handling API requests
- PostgreSQL database for data persistence
- Drizzle ORM for database interactions
- RESTful API design for client-server communication

### Computer Vision
- TensorFlow.js MoveNet pose detection model
- Real-time keypoint detection (17 body points)
- Custom exercise validation algorithms for each exercise type

## Technical Implementation

### Pose Detection
The application uses TensorFlow.js's pose detection models to identify key body points in real-time. This information is processed through custom algorithms to:

1. Calculate joint angles (e.g., elbow angles during push-ups)
2. Measure distances between body parts
3. Track movement patterns over time
4. Validate proper exercise form

### Exercise Validation
Each exercise has specific validation rules:

- **Push-ups**: 
  - Proper elbow flexion angle (90° at bottom position)
  - Straight back alignment
  - Full range of motion (arms fully extended at top)

- **Pull-ups**:
  - Chin clearing the bar at top position
  - Full arm extension at bottom position
  - Proper shoulder alignment

- **Sit-ups**:
  - Proper torso-to-floor angle
  - Complete range of motion
  - Correct positioning of upper body

### Data Storage
Exercise data is stored in a PostgreSQL database with the following schema:

- Users (authentication and profiles)
- Exercises (tracking test events)
- Form Issues (detailed feedback on technique)
- Key Points (body position data for analysis)

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL database
- Webcam for exercise detection

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/pt-test-pro.git
cd pt-test-pro
```

2. Install dependencies
```
npm install
```

3. Set up environment variables
```
DATABASE_URL=postgresql://username:password@host:port/database
```

4. Push database schema
```
npm run db:push
```

5. Start the application
```
npm run dev
```

6. Open your browser and navigate to `http://localhost:5000`

## Usage Guide

### Setting Up a Test
1. Create an account or login with existing credentials
2. From the dashboard, select the exercise you wish to perform
3. Position yourself in front of your webcam ensuring your full body is visible
4. Follow the on-screen instructions to begin the exercise

### During Exercise
- The application will display your body position with a skeleton overlay
- Real-time feedback will appear indicating proper or improper form
- Valid repetitions will be counted automatically
- Form issues will be tracked and saved for later review

### After Exercise
- Review your performance metrics including rep count and form score
- Examine detailed feedback on form issues
- Track progress over time through historical data

## Future Enhancements

- Integration with additional wearable devices
- Support for more exercise types
- Machine learning improvements for higher accuracy
- Mobile application support
- Group/team testing capabilities

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TensorFlow.js team for their pose detection models
- The open-source community for their invaluable contributions