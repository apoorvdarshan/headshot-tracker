const videoElement = document.querySelector(".input_video");
const canvasElement = document.querySelector(".output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const coordsDisplay = document.getElementById("coords");

const reactionBox = document.querySelector(".reaction-wrapper");
const reactionVideo = document.getElementById("reactionVideo");

// Default fallback size
const fallbackWidth = 800;
const fallbackHeight = 600;

canvasElement.width = fallbackWidth;
canvasElement.height = fallbackHeight;

// Auto-switch model logic
let currentModel = "short";
let missedFrames = 0;
const maxMissedFrames = 15;

const faceDetection = new FaceDetection({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
});
faceDetection.setOptions({
  model: "short",
  minDetectionConfidence: 0.3,
});

function switchModel(toModel) {
  if (currentModel !== toModel) {
    faceDetection.setOptions({
      model: toModel,
      minDetectionConfidence: 0.3,
    });
    console.log(`🔄 Switched to ${toModel} model`);
    currentModel = toModel;
  }
}

// 👋 Setup hand detection
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});
hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

let openHandsDetected = false;

hands.onResults((results) => {
  const openHands = results.multiHandLandmarks.filter((landmarks) => {
    // Simple logic: thumb tip x < index tip x (for both hands)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    return Math.abs(indexTip.y - thumbTip.y) > 0.1;
  });

  if (openHands.length === 2) {
    if (!openHandsDetected) {
      reactionBox.style.display = "block";
      reactionVideo.currentTime = 0;
      reactionVideo.play();
      openHandsDetected = true;
    }
  } else {
    if (openHandsDetected) {
      reactionBox.style.display = "none";
      reactionVideo.pause();
      reactionVideo.currentTime = 0;
      openHandsDetected = false;
    }
  }
  canvasCtx.save();
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1); // Flip to match mirrored video

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      for (const point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(
          point.x * canvasElement.width,
          point.y * canvasElement.height,
          5,
          0,
          2 * Math.PI
        );
        canvasCtx.fillStyle = "#00ff88";
        canvasCtx.fill();
      }
    }
  }

  canvasCtx.restore();
});

// 👁️ Face detection
faceDetection.onResults((results) => {
  const width = results.image.width || videoElement.videoWidth || fallbackWidth;
  const height =
    results.image.height || videoElement.videoHeight || fallbackHeight;

  canvasElement.width = width;
  canvasElement.height = height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, width, height);

  canvasCtx.translate(width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, width, height);

  if (results.detections.length > 0) {
    missedFrames = 0;
    switchModel("short");

    const detection = results.detections[0];
    const bbox = detection.boundingBox;
    const centerX = bbox.xCenter * width;
    const centerY = (bbox.yCenter - bbox.height * 0.42) * height;

    canvasCtx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    canvasCtx.lineWidth = 2;
    canvasCtx.shadowColor = "red";
    canvasCtx.shadowBlur = 10;

    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
    canvasCtx.moveTo(centerX, 0);
    canvasCtx.lineTo(centerX, height);
    canvasCtx.moveTo(0, centerY);
    canvasCtx.lineTo(width, centerY);
    canvasCtx.stroke();

    canvasCtx.fillStyle = "red";
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
    canvasCtx.fill();
    canvasCtx.shadowBlur = 0;

    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.fillStyle = "blue";
    canvasCtx.font = "bold 22px monospace";
    canvasCtx.fillText(
      `[${Math.round(width - centerX)}, ${Math.round(height - centerY)}]`,
      -centerX + 50,
      centerY - 20
    );
    canvasCtx.restore();

    coordsDisplay.innerText = `[${Math.round(width - centerX)}, ${Math.round(
      height - centerY
    )}]`;
  } else {
    missedFrames++;
    if (missedFrames > maxMissedFrames) {
      switchModel("full");
    }
  }

  canvasCtx.restore();
});

// 👁️ + ✋ Combined camera stream
const camera = new Camera(videoElement, {
  onFrame: async () => {
    const image = videoElement;
    await faceDetection.send({ image });
    await hands.send({ image });
  },
  width: fallbackWidth,
  height: fallbackHeight,
});
camera.start();

const hamburger = document.getElementById("hamburger");
const guideContent = document.getElementById("guideContent");

hamburger.addEventListener("click", () => {
  guideContent.classList.toggle("show");
});
