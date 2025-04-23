// app.js

import { FilesetResolver, PoseLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest';

let videoElement = document.getElementById('webcam');
let canvasElement = document.getElementById('overlay');
let canvasCtx = canvasElement.getContext('2d');
let feedbackElement = document.getElementById('feedback');
let threejsContainer = document.getElementById('threejs-container');

let poseLandmarker = null;
let running = false;
let currentExercise = null;

let scene, camera, renderer;
let annotationObjects = [];

window.addEventListener('resize', () => {
  if (renderer && camera) {
    camera.aspect = threejsContainer.clientWidth / threejsContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threejsContainer.clientWidth, threejsContainer.clientHeight);
  }
});

async function setupPoseLandmarker() {
  feedbackElement.textContent = 'Loading pose model...';
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'video',
      numPoses: 1,
    });

    feedbackElement.textContent = 'Model loaded. Ready!';
  } catch (error) {
    console.error('Model loading error:', error);
    feedbackElement.textContent = 'Error loading pose model.';
  }
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    videoElement.srcObject = stream;
    await videoElement.play();
    return new Promise(resolve => {
      videoElement.onloadedmetadata = () => resolve(videoElement);
    });
  } catch (error) {
    console.error('Camera access error:', error);
    feedbackElement.textContent = 'Webcam access denied or failed.';
  }
}

function setupThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, threejsContainer.clientWidth / threejsContainer.clientHeight, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(threejsContainer.clientWidth, threejsContainer.clientHeight);
  threejsContainer.innerHTML = '';
  threejsContainer.appendChild(renderer.domElement);

  annotationObjects.forEach(obj => scene.remove(obj));
  annotationObjects = [];
}

function animateThreeJS() {
  requestAnimationFrame(animateThreeJS);
  renderer.render(scene, camera);
}

function clearCanvas() {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
}

function drawKeypoints(keypoints, colors) {
  const radius = 5;
  keypoints.forEach((keypoint, i) => {
    const color = colors[i] || 'green';
    canvasCtx.beginPath();
    canvasCtx.arc(keypoint.x * canvasElement.width, keypoint.y * canvasElement.height, radius, 0, 2 * Math.PI);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();
  });
}

function drawConnections(keypoints, connections, colors) {
  connections.forEach(([i, j]) => {
    const color = colors[i] === 'red' || colors[j] === 'red' ? 'red' : 'green';
    canvasCtx.beginPath();
    canvasCtx.moveTo(keypoints[i].x * canvasElement.width, keypoints[i].y * canvasElement.height);
    canvasCtx.lineTo(keypoints[j].x * canvasElement.width, keypoints[j].y * canvasElement.height);
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 3;
    canvasCtx.stroke();
  });
}

function calculateAngle(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  const angleRad = Math.acos(dot / (magAB * magCB));
  return (angleRad * 180) / Math.PI;
}

function evaluateSquats(keypoints) {
  let feedback = [];
  let colors = Array(keypoints.length).fill('green');
  let annotations = [];

  const leftShoulder = keypoints[11];
  const rightShoulder = keypoints[12];
  const leftHip = keypoints[23];
  const rightHip = keypoints[24];
  const midShoulder = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const midHip = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const backAngle = calculateAngle({ x: midHip.x, y: midHip.y + 0.1 }, midHip, midShoulder);

  if (backAngle < 70) {
    feedback.push('Leaned forward too much');
    [11, 12, 23, 24].forEach(i => colors[i] = 'red');
    annotations.push({ jointIndex: 23, message: 'Keep back straighter' });
  }

  const leftKnee = keypoints[25];
  const leftAnkle = keypoints[27];
  const rightKnee = keypoints[26];
  const rightAnkle = keypoints[28];

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  if (leftKneeAngle > 160 || rightKneeAngle > 160) {
    feedback.push('Bend knees more');
    [25, 26].forEach(i => colors[i] = 'red');
    annotations.push({ jointIndex: 25, message: 'Knees too straight' });
  }

  return { feedback, colors, annotations };
}

function evaluatePushUps(keypoints) {
  let feedback = [];
  let colors = Array(keypoints.length).fill('green');
  let annotations = [];

  const leftShoulder = keypoints[11];
  const rightShoulder = keypoints[12];
  const leftElbow = keypoints[13];
  const rightElbow = keypoints[14];
  const leftWrist = keypoints[15];
  const rightWrist = keypoints[16];
  const leftHip = keypoints[23];
  const rightHip = keypoints[24];

  const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

  if (leftElbowAngle > 160 || rightElbowAngle > 160) {
    feedback.push('Lower elbows more');
    [13, 14].forEach(i => colors[i] = 'red');
    annotations.push({ jointIndex: 13, message: 'Bend elbows' });
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;

  if (shoulderY > hipY - 0.1) {
    feedback.push('Lower your chest');
    [11, 12].forEach(i => colors[i] = 'red');
    annotations.push({ jointIndex: 11, message: 'Chest too high' });
  }

  if (hipY > shoulderY + 0.1) {
    feedback.push('Don’t sag your back');
    [23, 24].forEach(i => colors[i] = 'red');
    annotations.push({ jointIndex: 23, message: 'Back sagging' });
  }

  return { feedback, colors, annotations };
}

function drawAnnotations(annotations, keypoints) {
  annotationObjects.forEach(obj => scene.remove(obj));
  annotationObjects = [];

  annotations.forEach(({ jointIndex, message }) => {
    const keypoint = keypoints[jointIndex];
    const loader = new THREE.FontLoader();
    loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', font => {
      const geometry = new THREE.TextGeometry(message, {
        font: font,
        size: 0.2,
        height: 0.05
      });
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const textMesh = new THREE.Mesh(geometry, material);
      textMesh.position.set((keypoint.x - 0.5) * 4, -(keypoint.y - 0.5) * 3, 0);
      scene.add(textMesh);
      annotationObjects.push(textMesh);
    });
  });
}

async function detectPose() {
  if (!running || !poseLandmarker) return;

  if (videoElement.readyState < 2) {
    requestAnimationFrame(detectPose);
    return;
  }

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  try {
    const result = await poseLandmarker.detectForVideo(videoElement, performance.now());
    clearCanvas();

    if (result.poseLandmarks.length > 0) {
      const keypoints = result.poseLandmarks[0];
      let evalData = { feedback: [], colors: [], annotations: [] };

      if (currentExercise === 'squats') {
        evalData = evaluateSquats(keypoints);
      } else if (currentExercise === 'pushups') {
        evalData = evaluatePushUps(keypoints);
      }

      drawKeypoints(keypoints, evalData.colors);
      drawConnections(keypoints, [
        [11, 12], [11, 23], [12, 24], [23, 24],
        [23, 25], [24, 26], [25, 27], [26, 28],
        [11, 13], [12, 14], [13, 15], [14, 16],
      ], evalData.colors);

      feedbackElement.textContent = evalData.feedback.join(' | ') || 'Great posture!';
      drawAnnotations(evalData.annotations, keypoints);
    } else {
      feedbackElement.textContent = 'No person detected.';
    }
  } catch (error) {
    console.error('Pose detection error:', error);
    feedbackElement.textContent = 'Pose detection error.';
  }

  requestAnimationFrame(detectPose);
}

async function startExercise(exercise) {
  feedbackElement.textContent = 'Initializing...';

  if (!poseLandmarker) {
    await setupPoseLandmarker();
  }

  if (!videoElement.srcObject) {
    await setupCamera();
  }

  currentExercise = exercise;
  running = true;

  setupThreeJS();
  animateThreeJS();
  detectPose();
}

document.getElementById('start-squats').addEventListener('click', () => startExercise('squats'));
document.getElementById('start-pushups').addEventListener('click', () => startExercise('pushups'));
