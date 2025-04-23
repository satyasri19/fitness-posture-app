# Real-Time Fitness App

This is a real-time, browser-based fitness application that uses MediaPipe Pose Landmarker and Three.js to provide pose tracking and posture evaluation for Squats and Push-Ups exercises.

## Features

- Real-time webcam-based pose detection using MediaPipe Pose Landmarker (Web)
- Exercise selection UI with buttons for Squats and Push-Ups
- Rule-based posture evaluation with phase detection
- Visual feedback with colored keypoints and connections (green for correct, red for incorrect)
- 3D annotations near problematic joints using Three.js
- Mobile-responsive design for phone browsers

## Getting Started

### Prerequisites

- A modern web browser with webcam support (Chrome, Firefox, Edge, Safari)
- Webcam access permission

### Running the App Locally

1. Clone or download this repository.
2. Open the `fitness-app/index.html` file in your browser.
3. Allow webcam access when prompted.
4. Click "Start Squats" or "Start Push-Ups" to begin exercise detection.

## Usage

- The app will detect your pose in real-time and evaluate your posture based on simple rule-based logic.
- Keypoints and connections will be colored green if posture is correct, or red if issues are detected.
- 3D text annotations will appear near joints with detected problems.
- Feedback messages will be shown below the video.

## Optional

- This project can be extended to a React Native or WebView-based mobile app for APK delivery.

## License

This project is open source and free to use.
