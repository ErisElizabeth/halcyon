const gameplay = document.querySelector("#gameplay");
const startScreen = document.querySelector(".start-screen");
const playButton = document.querySelector(".play-button");
const homeAnchorLayer = document.querySelector(".home-anchor-layer");
const homeAnchorSpace = document.querySelector(".home-anchor-space");
const homeAnchorVideos = [...document.querySelectorAll(".home-anchor-sprite, .home-anchor-backdrop")];
const levelTitle = document.querySelector(".level-title");
const cursor = document.querySelector(".cursor");
const obstacleField = document.querySelector(".obstacle-field");
const spiralField = document.querySelector(".spiral-field");
const triangleTest = document.querySelector(".triangle-test");
const gameOverScreen = document.querySelector(".game-over-screen");
const levelCompleteScreen = document.querySelector(".level-complete-screen");
const scoreLine = document.querySelector(".score-line");
const againButton = document.querySelector(".again-button");
const scoreForm = document.querySelector(".score-form");
const playerNameInput = document.querySelector(".player-name-input");
const leaderboardList = document.querySelector(".leaderboard-list");
const minimumMovesValue = document.querySelector(".minimum-moves-value");
const playerMovesValue = document.querySelector(".player-moves-value");
const closeCallMessage = document.querySelector(".close-call-message");
const triangleLinksLayer = document.querySelector(".triangle-links");
const triangleVideos = [...document.querySelectorAll(".triangle-video")];
const assetNodes = [...document.querySelectorAll(".asset-node")];
const triangleLinks = [...document.querySelectorAll(".triangle-link")];
const triangleCenterAnchor = document.querySelector(".triangle-center-anchor");
const audioElements = {
  playLoop: document.querySelector("#play-loop-audio"),
  lostLoop: document.querySelector("#lost-loop-audio"),
};
const audioFiles = {
  playLoop: "assets/audio/halcyon_play_loop.ogg",
  lostLoop: "assets/audio/halcyon_lost_loop.ogg",
};
const audioVolumes = {
  playLoop: 0.6,
  lostLoop: 0.72,
};
const supabaseUrl = "https://jurpddzoprhuboxyghau.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cnBkZHpvcHJodWJveHlnaGF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDcxNzUsImV4cCI6MjA5MzQyMzE3NX0.gAQAYN5Pizs5Hiet9hviGQ16Ph1MDif-uDs1mhFpJvA";
const freezeOffsets = [0.2, 0.2, 0.02];
const introPlaybackRate = 3;
const baseGameOverSpriteCount = 50;
const gameOverSpriteGrowth = 1.0466;
const obstacleSize = 16;
const lethalObstacleSize = obstacleSize * 0.9;
const baseSpiralCount = 3;
const spiralSize = 16;
const spiralObstacleAvoidanceDiameter = 40;
const spiralSpacing = 120;
const spiralConsumeDuration = 300;
const obstacleEdgeMargin = 34;
const obstacleColors = [
  "#0000D1",
  "#0707ea",
  "#1010ff",
];
const triangleRotationRpm = 5;
const triangleRotationRadiansPerSecond = triangleRotationRpm * 2 * Math.PI / 60;
const lineFadeDuration = 1500;
const gameOverLineFadeDuration = lineFadeDuration / 2;
const levelTransitionDuration = 250;
const rotationStartDelay = 100;
const settleDuration = 1170;
const levelTitleDuration = 1000;
const videoReadyTimeout = 1800;
const explosionSource = "assets/explode.mp4";
const explosionSlowdown = 2.5;
const explosionDuration = 11 / 24 * 1000 * explosionSlowdown;
const explosionReadyTimeout = 120;
const solverMaxDepth = 6;
const solverMaxStates = 1400;
const solverGridColumns = 5;
const solverGridRows = 4;
const levelOneMinimumMoveLow = 23;
const levelOneMinimumMoveHigh = 25;

const cursorState = {
  x: 0,
  y: 0,
};
let draggedNode = null;
let draggedHandle = null;
let suppressNextGameplayClick = false;
let dragStartPoints = null;
let dragStartSideLength = 0;
let baseTriangleSideLength = 0;
let rotationPaused = true;
let lastRotationTime = null;
let settleTimer = null;
let triangleSettling = false;
let gameOver = false;
let gameStarted = false;
let audioStarted = false;
let lostAudioStarted = false;
let levelOneMinimumMoves = null;
let playerMoves = 0;
let levelComplete = false;
const pendingCapturedSpirals = new Set();
let activeAudio = audioElements.playLoop;
let audioContext = null;
let audioGain = null;
let audioBuffers = null;
let audioBuffersPromise = null;
let activeAudioSource = null;
let activeAudioMode = "element";
let webAudioLoopName = "playLoop";
let webAudioLoopStartedAt = 0;
let webAudioLoopOffset = 0;
let currentLevel = 1;
let closeCallTimer = null;
let pendingCloseCall = false;
let finalScore = 0;
let totalScore = 0;
let scoreSubmitted = false;
let supabaseClient = null;
let audioOutputScale = 1;
let elementFadeFrame = null;
let triangleReady = false;
let restartTimer = null;
let gameOverCleanupStarted = false;
let levelTransitioning = false;
const collisionTestKeys = new Set();

Object.values(audioElements).forEach((track) => {
  track.volume = 0.6;
});
audioElements.lostLoop.volume = audioVolumes.lostLoop;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function playElementAudio(track) {
  const playback = track.play();

  playback?.catch(() => {});
}

function elementVolumeFor(track) {
  return track === audioElements.lostLoop
    ? audioVolumes.lostLoop
    : audioVolumes.playLoop;
}

function setElementAudioScale(scale) {
  Object.values(audioElements).forEach((track) => {
    track.volume = elementVolumeFor(track) * scale;
  });
}

function setWebAudioVolume(name, scale) {
  if (!audioContext || !audioGain) {
    return;
  }

  audioGain.gain.cancelScheduledValues(audioContext.currentTime);
  audioGain.gain.setValueAtTime(audioVolumes[name] * scale, audioContext.currentTime);
}

function fadeElementAudioScale(startScale, targetScale, duration) {
  window.cancelAnimationFrame(elementFadeFrame);

  const startTime = performance.now();

  function tick(now) {
    const progress = duration > 0 ? clamp((now - startTime) / duration, 0, 1) : 1;
    const nextScale = startScale + (targetScale - startScale) * progress;

    setElementAudioScale(nextScale);

    if (progress < 1) {
      elementFadeFrame = window.requestAnimationFrame(tick);
    }
  }

  elementFadeFrame = window.requestAnimationFrame(tick);
}

function fadeAudioOutput(targetScale, duration = 2000) {
  const startScale = audioOutputScale;

  audioOutputScale = targetScale;

  if (activeAudioMode === "web" && audioContext && audioGain) {
    const now = audioContext.currentTime;

    audioGain.gain.cancelScheduledValues(now);
    audioGain.gain.setValueAtTime(audioVolumes[webAudioLoopName] * startScale, now);
    audioGain.gain.linearRampToValueAtTime(audioVolumes[webAudioLoopName] * targetScale, now + duration / 1000);
  }

  fadeElementAudioScale(startScale, targetScale, duration);
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    audioContext = new AudioContextConstructor();
    audioGain = audioContext.createGain();
    audioGain.gain.value = audioVolumes.playLoop * audioOutputScale;
    audioGain.connect(audioContext.destination);
  }

  return audioContext;
}

function loadAudioBuffers() {
  const context = ensureAudioContext();

  if (!context) {
    return Promise.resolve(null);
  }

  if (!audioBuffersPromise) {
    audioBuffersPromise = Promise.all(
      Object.entries(audioFiles).map(async ([name, url]) => {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data);

        return [name, buffer];
      }),
    ).then((entries) => {
      audioBuffers = Object.fromEntries(entries);
      return audioBuffers;
    }).catch(() => null);
  }

  return audioBuffersPromise;
}

function stopWebAudioLoop() {
  if (!activeAudioSource) {
    return;
  }

  try {
    activeAudioSource.stop();
  } catch {
    // source may already be stopped
  }

  activeAudioSource = null;
}

function startWebAudioLoop(name, offset = 0) {
  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  const source = context.createBufferSource();
  const buffer = audioBuffers[name];
  const marker = buffer.duration > 0 ? offset % buffer.duration : 0;

  stopWebAudioLoop();
  setWebAudioVolume(name, audioOutputScale);
  source.buffer = buffer;
  source.loop = true;
  source.connect(audioGain);
  source.start(context.currentTime + 0.01, marker);
  activeAudioSource = source;
  activeAudioMode = "web";
  webAudioLoopName = name;
  webAudioLoopStartedAt = context.currentTime + 0.01;
  webAudioLoopOffset = marker;
}

function currentWebAudioMarker() {
  const buffer = audioBuffers?.[webAudioLoopName];

  if (!audioContext || !buffer) {
    return 0;
  }

  return (audioContext.currentTime - webAudioLoopStartedAt + webAudioLoopOffset) % buffer.duration;
}

function switchAudio(fromTrack, toTrack, time) {
  fromTrack.pause();
  const duration = toTrack.duration || 0;
  const marker = toTrack.loop && duration > 0
    ? time % duration
    : Math.min(time, duration || time);

  toTrack.currentTime = marker;
  toTrack.volume = elementVolumeFor(toTrack) * audioOutputScale;
  activeAudio = toTrack;
  playElementAudio(toTrack);
}

async function startPlayAudio() {
  if (audioStarted || gameOver) {
    return;
  }

  audioStarted = true;

  try {
    const context = ensureAudioContext();

    await context.resume();
    await loadAudioBuffers();

    if (audioBuffers) {
      startWebAudioLoop("playLoop", 0);
      return;
    }
  } catch {
    // fall back to audio elements below
  }

  activeAudioMode = "element";
  activeAudio = audioElements.playLoop;
  audioElements.playLoop.currentTime = 0;
  audioElements.playLoop.volume = audioVolumes.playLoop * audioOutputScale;
  playElementAudio(audioElements.playLoop);
}

function switchToLostAudio() {
  if (lostAudioStarted || !audioStarted) {
    return;
  }

  lostAudioStarted = true;

  if (activeAudioMode === "web" && audioBuffers) {
    startWebAudioLoop("lostLoop", currentWebAudioMarker());
    return;
  }

  switchAudio(activeAudio, audioElements.lostLoop, activeAudio.currentTime || 0);
}

function switchToPlayAudio() {
  if (!audioStarted || !lostAudioStarted) {
    return;
  }

  lostAudioStarted = false;

  if (activeAudioMode === "web" && audioBuffers) {
    startWebAudioLoop("playLoop", currentWebAudioMarker());
    return;
  }

  switchAudio(audioElements.lostLoop, audioElements.playLoop, audioElements.lostLoop.currentTime || 0);
}

function handleAudioVisibilityChange() {
  if (document.hidden) {
    fadeAudioOutput(0);
    return;
  }

  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  fadeAudioOutput(1);
}

function cssPixelValue(name) {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
}

function cursorHitRadius() {
  return cssPixelValue("--cursor-hit-size") / 2;
}

function playableBounds() {
  const rect = gameplay.getBoundingClientRect();
  const radius = cursorHitRadius();

  return {
    minX: radius,
    minY: radius,
    maxX: gameplay.clientWidth - radius,
    maxY: gameplay.clientHeight - radius,
    rect,
  };
}

function moveCursor(x, y) {
  const bounds = playableBounds();
  cursorState.x = clamp(x, bounds.minX, bounds.maxX);
  cursorState.y = clamp(y, bounds.minY, bounds.maxY);
  cursor.style.transform = `translate(${cursorState.x}px, ${cursorState.y}px)`;
}

function moveLockedCursor(deltaX, deltaY) {
  const bounds = playableBounds();
  const atLeft = cursorState.x <= bounds.minX;
  const atRight = cursorState.x >= bounds.maxX;
  const atTop = cursorState.y <= bounds.minY;
  const atBottom = cursorState.y >= bounds.maxY;

  const nextX = (atLeft && deltaX < 0) || (atRight && deltaX > 0)
    ? cursorState.x
    : cursorState.x + deltaX;
  const nextY = (atTop && deltaY < 0) || (atBottom && deltaY > 0)
    ? cursorState.y
    : cursorState.y + deltaY;

  moveCursor(nextX, nextY);
}

function centerCursor() {
  const bounds = playableBounds();
  moveCursor((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
}

function freezeHomeAnchorSprite() {
  homeAnchorVideos.forEach((video) => {
    function freeze() {
      const duration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 1.2;

      video.pause();
      video.currentTime = Math.max(0, duration - 0.2);
    }

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      freeze();
      return;
    }

    video.addEventListener("loadedmetadata", freeze, { once: true });
  });
}

function positionHomeAnchorBackdrop() {
  if (!homeAnchorLayer || !homeAnchorSpace || startScreen.classList.contains("hidden")) {
    return;
  }

  const screenRect = startScreen.getBoundingClientRect();
  const anchorRect = homeAnchorSpace.getBoundingClientRect();

  homeAnchorLayer.style.left = `${anchorRect.left - screenRect.left + anchorRect.width / 2}px`;
  homeAnchorLayer.style.top = `${anchorRect.top - screenRect.top}px`;
}

function eventClientPoint(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0];

  if (touch) {
    return {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function moveCursorToInput(event) {
  if (!event) {
    centerCursor();
    return;
  }

  if (eventIsTouch(event)) {
    gameplay.classList.add("touch-input");
  }

  const point = eventClientPoint(event);
  const bounds = playableBounds();
  moveCursor(point.x - bounds.rect.left, point.y - bounds.rect.top);
}

function eventIsTouch(event) {
  return event.pointerType === "touch" || event.type.startsWith("touch");
}

function handleGameplayAction(event) {
  if (!gameStarted || gameOver || levelComplete) {
    return;
  }

  if (draggedNode || suppressNextGameplayClick) {
    suppressNextGameplayClick = false;
    return;
  }

  if (event) {
    moveCursorToInput(event);
  }

  gameplay.classList.add("active");
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function gameOverSpriteCountForLevel(level) {
  return Math.round(baseGameOverSpriteCount * Math.pow(gameOverSpriteGrowth, level - 1));
}

function captureSpriteCountForLevel(level) {
  return baseSpiralCount + Math.floor(level / 6);
}

function minimumMovesForLevel(level) {
  const baseMoves = levelOneMinimumMoves ?? Math.round(randomBetween(levelOneMinimumMoveLow, levelOneMinimumMoveHigh + 1));

  return Math.round(baseMoves * Math.pow(gameOverSpriteGrowth, level - 1));
}

function collisionsDisabled() {
  return collisionTestKeys.has("t") && collisionTestKeys.has("w");
}

function createIrregularPolygon(sides) {
  const points = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * 2 * Math.PI + randomBetween(-0.16, 0.16);
    const radius = randomBetween(38, 50);
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;

    points.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  }

  return `polygon(${points.join(", ")})`;
}

function startAreaExclusion() {
  const trianglePoints = assetNodes.map(nodePoint);
  const center = triangleCenter(trianglePoints);
  const radius = Math.max(...trianglePoints.map((point) => distanceBetween(point, center))) * 2;

  return {
    center,
    radius,
  };
}

function generateObstacles() {
  obstacleField.replaceChildren();
  const width = gameplay.clientWidth;
  const height = gameplay.clientHeight;
  const startArea = startAreaExclusion();
  const obstacleCount = gameOverSpriteCountForLevel(currentLevel);
  const columns = Math.ceil(Math.sqrt(obstacleCount * width / height) * 1.35);
  const rows = Math.ceil(obstacleCount / columns * 1.35);
  const playableWidth = Math.max(1, width - obstacleEdgeMargin * 2);
  const playableHeight = Math.max(1, height - obstacleEdgeMargin * 2);
  const cellWidth = playableWidth / columns;
  const cellHeight = playableHeight / rows;
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = {
        x: obstacleEdgeMargin + (column + randomBetween(0.18, 0.82)) * cellWidth,
        y: obstacleEdgeMargin + (row + randomBetween(0.18, 0.82)) * cellHeight,
      };

      if (distanceBetween(point, startArea.center) > startArea.radius + obstacleSize) {
        cells.push(point);
      }
    }
  }

  while (cells.length < obstacleCount) {
    const point = {
      x: randomBetween(obstacleEdgeMargin, Math.max(obstacleEdgeMargin, width - obstacleEdgeMargin)),
      y: randomBetween(obstacleEdgeMargin, Math.max(obstacleEdgeMargin, height - obstacleEdgeMargin)),
    };

    if (distanceBetween(point, startArea.center) > startArea.radius + obstacleSize) {
      cells.push(point);
    }
  }

  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = cells[index];

    cells[index] = cells[swapIndex];
    cells[swapIndex] = current;
  }

  for (let index = 0; index < obstacleCount; index += 1) {
    const obstacle = document.createElement("div");
    const sides = 5 + Math.floor(Math.random() * 4) * 2;
    const point = cells[index];

    obstacle.className = "obstacle";
    obstacle.style.left = `${point.x}px`;
    obstacle.style.top = `${point.y}px`;
    obstacle.style.clipPath = createIrregularPolygon(sides);
    obstacle.style.rotate = `${randomBetween(0, 360).toFixed(1)}deg`;
    obstacle.style.setProperty("--obstacle-color", obstacleColors[index % obstacleColors.length]);
    obstacle.style.setProperty("--obstacle-highlight", `${randomBetween(0, 360).toFixed(1)}deg`);
    obstacleField.appendChild(obstacle);
  }
}

function createSpiralSprite() {
  const sprite = document.createElement("div");

  sprite.className = "spiral-sprite";
  sprite.innerHTML = `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path class="spiral-depth" d="M8 8 C10.2 7.1 10.9 9.5 9.2 10.8 C6.9 12.7 3.9 10.7 4.3 7.7 C4.8 3.9 9.5 2.7 12.1 5.4 C14.9 8.4 13.3 13.1 9.4 14.1"></path>
      <path class="spiral-core" d="M8 8 C10.2 7.1 10.9 9.5 9.2 10.8 C6.9 12.7 3.9 10.7 4.3 7.7 C4.8 3.9 9.5 2.7 12.1 5.4 C14.9 8.4 13.3 13.1 9.4 14.1"></path>
      <circle class="spiral-highlight" cx="6.3" cy="5.2" r="1.1"></circle>
    </svg>
  `;

  return sprite;
}

function generateSpiralSprite() {
  spiralField.replaceChildren();
  const width = gameplay.clientWidth;
  const height = gameplay.clientHeight;
  const startArea = startAreaExclusion();
  const spiralCount = captureSpriteCountForLevel(currentLevel);
  const obstacleAvoidanceRadius = spiralObstacleAvoidanceDiameter / 2 + spiralSize / 2;
  const obstacles = obstacleCenters();
  const candidates = [];
  const points = [];

  for (let attempt = 0; attempt < 2500; attempt += 1) {
    const candidate = {
      x: randomBetween(obstacleEdgeMargin, Math.max(obstacleEdgeMargin, width - obstacleEdgeMargin)),
      y: randomBetween(obstacleEdgeMargin, Math.max(obstacleEdgeMargin, height - obstacleEdgeMargin)),
    };
    const clearsStartArea = distanceBetween(candidate, startArea.center) > startArea.radius + obstacleSize;
    const clearsObstacles = obstacles.every((obstacle) => (
      distanceBetween(candidate, obstacle) >= obstacleAvoidanceRadius
    ));

    if (clearsStartArea && clearsObstacles) {
      candidates.push(candidate);
    }
  }

  while (points.length < spiralCount && candidates.length > 0) {
    const point = candidates.reduce((best, candidate) => {
      const nearestDistance = points.length > 0
        ? Math.min(...points.map((existingPoint) => distanceBetween(candidate, existingPoint)))
        : distanceBetween(candidate, startArea.center);
      const bestNearestDistance = points.length > 0
        ? Math.min(...points.map((existingPoint) => distanceBetween(best, existingPoint)))
        : distanceBetween(best, startArea.center);

      return nearestDistance > bestNearestDistance ? candidate : best;
    }, candidates[0]);
    const pointIndex = candidates.indexOf(point);

    points.push(point);
    candidates.splice(pointIndex, 1);
  }

  while (points.length < spiralCount) {
    const fallbackAngle = points.length / spiralCount * 2 * Math.PI - Math.PI / 2;
    const fallbackRadius = Math.min(width, height) * 0.36;

    points.push({
      x: clamp(startArea.center.x + Math.cos(fallbackAngle) * fallbackRadius, obstacleEdgeMargin, width - obstacleEdgeMargin),
      y: clamp(startArea.center.y + Math.sin(fallbackAngle) * fallbackRadius, obstacleEdgeMargin, height - obstacleEdgeMargin),
    });
  }

  points.forEach((point) => {
    const sprite = createSpiralSprite();

    sprite.style.left = `${point.x}px`;
    sprite.style.top = `${point.y}px`;
    spiralField.appendChild(sprite);
  });
}

function obstacleCenters() {
  return [...obstacleField.querySelectorAll(".obstacle")].map((obstacle) => ({
    x: Number.parseFloat(obstacle.style.left),
    y: Number.parseFloat(obstacle.style.top),
  }));
}

function spiralCenter(sprite) {
  return {
    x: Number.parseFloat(sprite.style.left),
    y: Number.parseFloat(sprite.style.top),
  };
}

function circleIntersectsBox(circle, radius, boxCenter, boxSize) {
  const half = boxSize / 2;
  const closestX = clamp(circle.x, boxCenter.x - half, boxCenter.x + half);
  const closestY = clamp(circle.y, boxCenter.y - half, boxCenter.y + half);
  const deltaX = circle.x - closestX;
  const deltaY = circle.y - closestY;

  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}

function triggerGameOver() {
  if (gameOver) {
    return;
  }

  gameOver = true;
  rotationPaused = true;
  triangleSettling = false;
  triangleReady = false;
  gameplay.classList.add("game-ended");
  gameplay.classList.remove("active");
  if (document.pointerLockElement === gameplay) {
    document.exitPointerLock();
  }
  window.clearTimeout(closeCallTimer);
  closeCallMessage.classList.remove("visible");
  finalScore = totalScore;
  scoreSubmitted = false;
  scoreForm.hidden = false;
  playerNameInput.value = "";
  leaderboardList.replaceChildren();
  window.clearTimeout(settleTimer);
  assetNodes.forEach((node) => node.classList.remove("settling"));
  draggedNode?.classList.remove("dragging");
  draggedNode = null;
  switchToLostAudio();
  playGameOverExplosion();
}

function showCloseCall() {
  if (gameOver || levelComplete) {
    return;
  }

  if (triangleSettling) {
    pendingCloseCall = true;
    return;
  }

  window.clearTimeout(closeCallTimer);
  closeCallMessage.classList.remove("visible");
  closeCallMessage.offsetWidth;
  closeCallMessage.classList.add("visible");
  closeCallTimer = window.setTimeout(() => {
    closeCallMessage.classList.remove("visible");
  }, 550);
}

function fadeOutTriangleLinks() {
  triangleLinksLayer.classList.add("visible");
  triangleLinksLayer.style.opacity = "1";

  if (!triangleLinksLayer.animate) {
    triangleLinksLayer.style.opacity = "0";
    triangleLinksLayer.classList.remove("visible");
    return Promise.resolve();
  }

  const fade = triangleLinksLayer.animate(
    [
      { opacity: 1 },
      { opacity: 0 },
    ],
    {
      duration: gameOverLineFadeDuration,
      easing: "linear",
      fill: "forwards",
    },
  );

  return fade.finished.then(() => {
    triangleLinksLayer.style.opacity = "0";
    triangleLinksLayer.classList.remove("visible");
  }).catch(() => {});
}

function fadeAndClearRemainingSprites(duration = 500) {
  if (duration === 500 && gameOverCleanupStarted) {
    return;
  }

  if (duration === 500) {
    gameOverCleanupStarted = true;
  }

  [obstacleField, spiralField].forEach((field) => {
    field.style.pointerEvents = "none";

    if (!field.animate) {
      field.replaceChildren();
      field.classList.remove("visible");
      field.style.opacity = "0";
      return;
    }

    const fade = field.animate(
      [
        { opacity: Number.parseFloat(getComputedStyle(field).opacity) || 1 },
        { opacity: 0 },
      ],
      {
        duration,
        easing: "ease",
        fill: "forwards",
      },
    );

    fade.finished.then(() => {
      field.replaceChildren();
      field.classList.remove("visible");
      field.style.opacity = "0";
    }).catch(() => {
      field.replaceChildren();
      field.classList.remove("visible");
      field.style.opacity = "0";
    });
  });
}

function fadeElementToZero(element, duration) {
  if (!element.animate) {
    element.style.opacity = "0";
    return;
  }

  const fade = element.animate(
    [
      { opacity: Number.parseFloat(getComputedStyle(element).opacity) || 1 },
      { opacity: 0 },
    ],
    {
      duration,
      easing: "ease",
      fill: "forwards",
    },
  );

  fade.finished.then(() => {
    element.style.opacity = "0";
  }).catch(() => {
    element.style.opacity = "0";
  });
}

function resetElementFadeState(element) {
  element.getAnimations?.().forEach((animation) => animation.cancel());
  element.style.opacity = "";
}

function resetLevelVisualLayers() {
  [triangleTest, obstacleField, spiralField, triangleLinksLayer, closeCallMessage].forEach(resetElementFadeState);
  obstacleField.classList.remove("visible");
  spiralField.classList.remove("visible");
  triangleLinksLayer.classList.remove("visible");
  closeCallMessage.classList.remove("visible");
}

function clearGameplayObjects() {
  obstacleField.replaceChildren();
  spiralField.replaceChildren();
  pendingCapturedSpirals.clear();
  draggedNode?.classList.remove("dragging");
  draggedNode = null;
  draggedHandle = null;
  triangleSettling = false;
  triangleReady = false;
  rotationPaused = true;
  window.clearTimeout(settleTimer);
  window.clearTimeout(closeCallTimer);
  closeCallMessage.classList.remove("visible");
}

function showGameOverScreen() {
  gameOverScreen.classList.add("visible");
  fadeAndClearRemainingSprites();
}

function playExplosionVideo(video) {
  const node = video.closest(".asset-node");

  video.pause();
  node?.classList.remove("mask-tight");
  video.classList.remove("exploding");
  video.src = explosionSource;
  video.loop = false;
  video.playbackRate = 1 / explosionSlowdown;

  function startExplosion() {
    video.removeEventListener("canplay", startExplosion);
    video.removeEventListener("loadeddata", startExplosion);
    video.currentTime = 0;
    video.classList.remove("frozen");
    video.classList.add("active", "exploding");

    const playback = video.play();

    playback?.catch(() => {});
  }

  video.addEventListener("loadeddata", startExplosion, { once: true });
  video.addEventListener("canplay", startExplosion, { once: true });
  video.load();
  window.setTimeout(startExplosion, explosionReadyTimeout);
}

function playGameOverExplosion() {
  fadeOutTriangleLinks().then(() => {
    showGameOverScreen();
  });

  triangleVideos.forEach(playExplosionVideo);

  window.setTimeout(() => {
    showGameOverScreen();
  }, explosionDuration);
}

function resetTriangleVideos() {
  triangleVideos.forEach((video) => {
    const node = video.closest(".asset-node");

    video.pause();
    video.src = "assets/timeline-2.mp4";
    video.loop = false;
    video.playbackRate = introPlaybackRate;
    video.classList.remove("active", "frozen", "exploding");
    node?.classList.remove("mask-tight", "dragging", "settling");
    node?.style.removeProperty("--mask-shrink-duration");
    node?.style.removeProperty("left");
    node?.style.removeProperty("top");
  });

  triangleLinksLayer.classList.remove("visible");
  triangleLinksLayer.style.opacity = "";
}

function resetTriangleToCenter() {
  resetTriangleVideos();
  assetNodes.forEach((node) => {
    node.style.removeProperty("left");
    node.style.removeProperty("top");
  });
  centerCursor();
  updateTriangleLinks();
}

function clearAndStartLevel(nextLevel) {
  currentLevel = nextLevel;
  levelComplete = false;
  gameStarted = false;
  gameOver = false;
  triangleReady = false;
  levelTransitioning = false;
  gameOverCleanupStarted = false;
  pendingCloseCall = false;
  playerMoves = 0;
  window.halcyonPlayerMoves = playerMoves;
  levelCompleteScreen.classList.remove("visible");
  resetLevelVisualLayers();
  clearGameplayObjects();
  resetTriangleToCenter();
  startGame();
}

function restartGame(event) {
  event?.preventDefault();

  if (!gameOver && !levelComplete) {
    return;
  }

  window.clearTimeout(restartTimer);
  switchToPlayAudio();
  gameOver = false;
  levelComplete = false;
  gameStarted = false;
  lostAudioStarted = false;
  currentLevel = 1;
  levelOneMinimumMoves = null;
  playerMoves = 0;
  totalScore = 0;
  finalScore = 0;
  levelTransitioning = true;
  triangleReady = false;
  gameplay.classList.remove("game-ended");
  pendingCloseCall = false;
  gameOverScreen.classList.remove("visible");
  levelCompleteScreen.classList.remove("visible");
  fadeAndClearRemainingSprites(levelTransitionDuration);
  fadeElementToZero(triangleTest, levelTransitionDuration);
  restartTimer = window.setTimeout(() => {
    clearAndStartLevel(1);
  }, levelTransitionDuration);
}

function checkObstacleCollisions(points = assetNodes.map(nodePoint)) {
  if (gameOver || levelComplete || levelTransitioning || collisionsDisabled()) {
    return;
  }

  const radius = anchorRadius();
  const obstacles = obstacleCenters();
  let closeCall = false;
  const hit = points.some((point) => (
    obstacles.some((obstacle) => {
      if (circleIntersectsBox(point, radius, obstacle, lethalObstacleSize)) {
        return true;
      }

      if (circleIntersectsBox(point, radius, obstacle, obstacleSize)) {
        closeCall = true;
      }

      return false;
    })
  ));

  if (hit) {
    triggerGameOver();
    return;
  }

  if (closeCall) {
    showCloseCall();
  }
}

function consumeSpiral(sprite) {
  if (!sprite || sprite.classList.contains("consumed")) {
    return;
  }

  sprite.classList.add("consumed");
  checkLevelComplete();

  window.setTimeout(() => {
    sprite.remove();
  }, spiralConsumeDuration);
}

function levelScore() {
  const minimumMoves = minimumMovesForLevel(currentLevel);

  if (!minimumMoves || playerMoves <= 0) {
    return 0;
  }

  return Math.floor(minimumMoves / playerMoves * 100);
}

function highScoreClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!window.supabase?.createClient) {
    return null;
  }

  supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
  return supabaseClient;
}

async function submitHighScore(playerName, score) {
  const client = highScoreClient();

  if (!client) {
    throw new Error("supabase unavailable");
  }

  const name = (playerName || "").trim().slice(0, 20) || "Anonymous";
  const { error } = await client
    .from("high_scores")
    .insert({
      player_name: name,
      score: Math.trunc(score),
    });

  if (error) {
    throw error;
  }
}

async function fetchTopThreeHighScores() {
  const client = highScoreClient();

  if (!client) {
    throw new Error("supabase unavailable");
  }

  const { data, error } = await client
    .from("high_scores")
    .select("player_name, score, created_at")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    throw error;
  }

  return data || [];
}

function renderGameOverLeaderboard(scores) {
  leaderboardList.replaceChildren();

  if (!scores) {
    const item = document.createElement("li");

    item.textContent = "Leaderboard unavailable.";
    leaderboardList.appendChild(item);
    return;
  }

  scores.forEach((score) => {
    const item = document.createElement("li");
    const name = (score.player_name || "Anonymous").trim().slice(0, 20) || "Anonymous";

    item.textContent = `${name} — ${Math.trunc(score.score)}`;
    leaderboardList.appendChild(item);
  });
}

function updateHud() {
  if (minimumMovesValue) {
    minimumMovesValue.textContent = minimumMovesForLevel(currentLevel);
  }

  if (playerMovesValue) {
    playerMovesValue.textContent = playerMoves;
  }
}

function checkLevelComplete() {
  if (levelComplete || gameOver) {
    return;
  }

  const remainingSprites = spiralField.querySelectorAll(".spiral-sprite:not(.consumed)").length;

  if (remainingSprites > 0) {
    return;
  }

  levelComplete = true;
  levelTransitioning = true;
  rotationPaused = true;
  triangleSettling = false;
  triangleReady = false;
  window.clearTimeout(closeCallTimer);
  closeCallMessage.classList.remove("visible");
  window.clearTimeout(settleTimer);
  const earnedScore = levelScore();

  totalScore += earnedScore;
  finalScore = totalScore;
  updateHud();
  scoreLine.textContent = `score ${totalScore}`;
  fadeAndClearRemainingSprites(levelTransitionDuration);
  fadeElementToZero(triangleTest, levelTransitionDuration);
  fadeElementToZero(closeCallMessage, levelTransitionDuration);
  window.setTimeout(() => {
    clearAndStartLevel(currentLevel + 1);
  }, levelTransitionDuration);
}

function checkSpiralCollisions(points = assetNodes.map(nodePoint)) {
  if (levelComplete || levelTransitioning || collisionsDisabled() || draggedNode || !triangleReady) {
    return;
  }

  const sprites = [...spiralField.querySelectorAll(".spiral-sprite:not(.consumed)")];

  if (sprites.length === 0) {
    return;
  }

  const collisionRadius = anchorRadius() + spiralSize / 2;

  sprites.forEach((sprite) => {
    const center = spiralCenter(sprite);
    const hit = points.some((point) => distanceBetween(point, center) <= collisionRadius);

    if (hit) {
      if (triangleSettling) {
        pendingCapturedSpirals.add(sprite);
        return;
      }

      consumeSpiral(sprite);
    }
  });
}

function consumePendingSpirals() {
  if (collisionsDisabled()) {
    pendingCapturedSpirals.clear();
    return;
  }

  pendingCapturedSpirals.forEach((sprite) => {
    consumeSpiral(sprite);
  });
  pendingCapturedSpirals.clear();
}

function collectCenters() {
  return [...spiralField.querySelectorAll(".spiral-sprite")].map(spiralCenter);
}

function captureRadius() {
  return assetNodes[0]?.querySelector(".asset-handle").offsetWidth / 2 || 0;
}

function anchorRadius() {
  return cssPixelValue("--anchor-hit-radius");
}

function anchorGlowRadius() {
  return anchorRadius() * 1.45;
}

function constrainAssetPoint(node, x, y) {
  const boundsRadius = captureRadius();
  const collisionRadius = anchorRadius();
  let nextX = clamp(x, boundsRadius, gameplay.clientWidth - boundsRadius);
  let nextY = clamp(y, boundsRadius, gameplay.clientHeight - boundsRadius);

  if (collisionsDisabled()) {
    return { x: nextX, y: nextY };
  }

  for (let pass = 0; pass < 2; pass += 1) {
    assetNodes.forEach((otherNode) => {
      if (otherNode === node) {
        return;
      }

      const otherPoint = nodePoint(otherNode);
      const deltaX = nextX - otherPoint.x;
      const deltaY = nextY - otherPoint.y;
      const distance = Math.hypot(deltaX, deltaY);
      const minimumDistance = collisionRadius * 2;

      if (distance >= minimumDistance) {
        return;
      }

      const fallbackX = node.offsetLeft - otherPoint.x || 1;
      const fallbackY = node.offsetTop - otherPoint.y || 0;
      const fallbackDistance = Math.hypot(fallbackX, fallbackY);
      const unitX = distance === 0 ? fallbackX / fallbackDistance : deltaX / distance;
      const unitY = distance === 0 ? fallbackY / fallbackDistance : deltaY / distance;

      nextX = otherPoint.x + unitX * minimumDistance;
      nextY = otherPoint.y + unitY * minimumDistance;
      nextX = clamp(nextX, boundsRadius, gameplay.clientWidth - boundsRadius);
      nextY = clamp(nextY, boundsRadius, gameplay.clientHeight - boundsRadius);
    });
  }

  return {
    x: clamp(nextX, boundsRadius, gameplay.clientWidth - boundsRadius),
    y: clamp(nextY, boundsRadius, gameplay.clientHeight - boundsRadius),
  };
}

function moveAssetNode(node, clientX, clientY) {
  const rect = gameplay.getBoundingClientRect();
  const point = constrainAssetPoint(
    node,
    clientX - rect.left,
    clientY - rect.top,
  );

  node.style.left = `${point.x}px`;
  node.style.top = `${point.y}px`;
  updateTriangleLinks();
}

function moveAssetNodeFromInput(node, event) {
  const point = eventClientPoint(event);

  moveAssetNode(node, point.x, point.y);
}

function nodePoint(node) {
  const rect = node.getBoundingClientRect();
  const gameplayRect = gameplay.getBoundingClientRect();

  return {
    x: rect.left - gameplayRect.left,
    y: rect.top - gameplayRect.top,
  };
}

function animateTriangleLinks(duration = settleDuration) {
  const startedAt = performance.now();

  function tick(now) {
    updateTriangleLinks();

    if (now - startedAt < duration) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function triangleCenter(points = assetNodes.map(nodePoint)) {
  return points.reduce((total, point) => {
    return {
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    };
  }, { x: 0, y: 0 });
}

function equilateralOptions(a, b) {
  const deltaX = b.x - a.x;
  const deltaY = b.y - a.y;
  const midpoint = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
  const heightScale = Math.sqrt(3) / 2;

  return [
    {
      x: midpoint.x - deltaY * heightScale,
      y: midpoint.y + deltaX * heightScale,
    },
    {
      x: midpoint.x + deltaY * heightScale,
      y: midpoint.y - deltaX * heightScale,
    },
  ];
}

function circleIntersections(first, firstRadius, second, secondRadius) {
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    return [];
  }

  const along = (firstRadius ** 2 - secondRadius ** 2 + distance ** 2) / (2 * distance);
  const heightSquared = firstRadius ** 2 - along ** 2;

  if (heightSquared < -0.001) {
    return [];
  }

  const height = Math.sqrt(Math.max(0, heightSquared));
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const base = {
    x: first.x + unitX * along,
    y: first.y + unitY * along,
  };

  return [
    {
      x: base.x - unitY * height,
      y: base.y + unitX * height,
    },
    {
      x: base.x + unitY * height,
      y: base.y - unitX * height,
    },
  ];
}

function sideLengthFrom(points) {
  return Math.hypot(
    points[2].x - points[1].x,
    points[2].y - points[1].y,
  );
}

function setNodePosition(node, point) {
  node.style.left = `${point.x}px`;
  node.style.top = `${point.y}px`;
}

function fallbackEquilateralPlacement(anchorIndex, endPoint) {
  const startPoint = dragStartPoints[anchorIndex];
  const otherIndexes = assetNodes
    .map((node, index) => index)
    .filter((index) => index !== anchorIndex);
  const placements = otherIndexes.map((nearIndex) => {
    const farIndex = otherIndexes.find((index) => index !== nearIndex);
    const nearTarget = {
      x: endPoint.x + dragStartPoints[nearIndex].x - startPoint.x,
      y: endPoint.y + dragStartPoints[nearIndex].y - startPoint.y,
    };
    const farTarget = {
      x: endPoint.x + dragStartPoints[farIndex].x - startPoint.x,
      y: endPoint.y + dragStartPoints[farIndex].y - startPoint.y,
    };
    const deltaX = nearTarget.x - endPoint.x;
    const deltaY = nearTarget.y - endPoint.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const corner = {
      x: endPoint.x + deltaX / distance * dragStartSideLength,
      y: endPoint.y + deltaY / distance * dragStartSideLength,
    };
    const thirdPoint = equilateralOptions(endPoint, corner).reduce((best, option) => (
      distanceBetween(option, farTarget) < distanceBetween(best, farTarget)
        ? option
        : best
    ));

    return {
      nearIndex,
      farIndex,
      corner,
      thirdPoint,
      score: distanceBetween(corner, nearTarget) + distanceBetween(thirdPoint, farTarget),
    };
  });

  return placements.reduce((best, option) => (
    option.score < best.score ? option : best
  ), placements[0]);
}

function angleAtPoint(center, first, second) {
  const firstX = first.x - center.x;
  const firstY = first.y - center.y;
  const secondX = second.x - center.x;
  const secondY = second.y - center.y;
  const firstLength = Math.hypot(firstX, firstY);
  const secondLength = Math.hypot(secondX, secondY);

  if (firstLength === 0 || secondLength === 0) {
    return 0;
  }

  const cosine = clamp(
    (firstX * secondX + firstY * secondY) / (firstLength * secondLength),
    -1,
    1,
  );

  return Math.acos(cosine);
}

function placementIsStable(placement, anchorIndex, startPoint, endPoint) {
  if (!placement || !Number.isFinite(placement.corner.x) || !Number.isFinite(placement.thirdPoint.x)) {
    return false;
  }

  const minReleaseAngle = Math.PI / 6;
  const movedAngle = angleAtPoint(endPoint, startPoint, placement.corner);
  const sideTolerance = Math.max(0.75, dragStartSideLength * 0.03);
  const sides = [
    distanceBetween(endPoint, placement.corner),
    distanceBetween(placement.corner, placement.thirdPoint),
    distanceBetween(placement.thirdPoint, endPoint),
  ];
  const sideLengthsAreStable = sides.every((side) => (
    Math.abs(side - dragStartSideLength) <= sideTolerance
  ));

  return (
    placement.nearIndex !== anchorIndex
    && placement.farIndex !== anchorIndex
    && placement.nearIndex !== placement.farIndex
    && movedAngle >= minReleaseAngle
    && sideLengthsAreStable
  );
}

function clonePoints(points) {
  return points.map((point) => ({
    x: point.x,
    y: point.y,
  }));
}

function pointInBounds(point) {
  const radius = captureRadius();

  return {
    x: clamp(point.x, radius, gameplay.clientWidth - radius),
    y: clamp(point.y, radius, gameplay.clientHeight - radius),
  };
}

function fallbackPlacementForPoints(points, anchorIndex, endPoint, sideLength) {
  const startPoint = points[anchorIndex];
  const otherIndexes = points
    .map((point, index) => index)
    .filter((index) => index !== anchorIndex);
  const placements = otherIndexes.map((nearIndex) => {
    const farIndex = otherIndexes.find((index) => index !== nearIndex);
    const nearTarget = {
      x: endPoint.x + points[nearIndex].x - startPoint.x,
      y: endPoint.y + points[nearIndex].y - startPoint.y,
    };
    const farTarget = {
      x: endPoint.x + points[farIndex].x - startPoint.x,
      y: endPoint.y + points[farIndex].y - startPoint.y,
    };
    const deltaX = nearTarget.x - endPoint.x;
    const deltaY = nearTarget.y - endPoint.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const corner = {
      x: endPoint.x + deltaX / distance * sideLength,
      y: endPoint.y + deltaY / distance * sideLength,
    };
    const thirdPoint = equilateralOptions(endPoint, corner).reduce((best, option) => (
      distanceBetween(option, farTarget) < distanceBetween(best, farTarget)
        ? option
        : best
    ));

    return {
      nearIndex,
      farIndex,
      corner,
      thirdPoint,
      score: distanceBetween(corner, nearTarget) + distanceBetween(thirdPoint, farTarget),
    };
  });

  return placements.reduce((best, option) => (
    option.score < best.score ? option : best
  ), placements[0]);
}

function placementIsStableForPoints(placement, anchorIndex, startPoint, endPoint, sideLength) {
  if (!placement || !Number.isFinite(placement.corner.x) || !Number.isFinite(placement.thirdPoint.x)) {
    return false;
  }

  const minReleaseAngle = Math.PI / 6;
  const movedAngle = angleAtPoint(endPoint, startPoint, placement.corner);
  const sideTolerance = Math.max(0.75, sideLength * 0.03);
  const sides = [
    distanceBetween(endPoint, placement.corner),
    distanceBetween(placement.corner, placement.thirdPoint),
    distanceBetween(placement.thirdPoint, endPoint),
  ];
  const sideLengthsAreStable = sides.every((side) => (
    Math.abs(side - sideLength) <= sideTolerance
  ));

  return (
    placement.nearIndex !== anchorIndex
    && placement.farIndex !== anchorIndex
    && placement.nearIndex !== placement.farIndex
    && movedAngle >= minReleaseAngle
    && sideLengthsAreStable
  );
}

function simulateTriangleMove(points, anchorIndex, destination) {
  const startPoint = points[anchorIndex];
  const endPoint = pointInBounds(destination);
  const movementDistance = distanceBetween(startPoint, endPoint);
  const movementCircle = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };
  const candidates = circleIntersections(
    movementCircle,
    movementDistance / 2,
    endPoint,
    baseTriangleSideLength,
  );
  const otherIndexes = points
    .map((point, index) => index)
    .filter((index) => index !== anchorIndex);
  const placements = candidates.flatMap((corner) => {
    return otherIndexes.map((nearIndex) => {
      const farIndex = otherIndexes.find((index) => index !== nearIndex);
      const thirdOptions = equilateralOptions(endPoint, corner);
      const thirdPoint = thirdOptions.reduce((best, option) => {
        return distanceBetween(option, points[farIndex]) < distanceBetween(best, points[farIndex])
          ? option
          : best;
      }, thirdOptions[0]);

      return {
        nearIndex,
        farIndex,
        corner,
        thirdPoint,
        score: distanceBetween(corner, points[nearIndex]) + distanceBetween(thirdPoint, points[farIndex]),
      };
    });
  });
  const placement = placements.length > 0
    ? placements.reduce((best, option) => (
      option.score < best.score ? option : best
    ), placements[0])
    : fallbackPlacementForPoints(points, anchorIndex, endPoint, baseTriangleSideLength);
  const stablePlacement = placementIsStableForPoints(placement, anchorIndex, startPoint, endPoint, baseTriangleSideLength)
    ? placement
    : fallbackPlacementForPoints(points, anchorIndex, endPoint, baseTriangleSideLength);
  const nextPoints = clonePoints(points);

  nextPoints[anchorIndex] = endPoint;
  nextPoints[stablePlacement.nearIndex] = stablePlacement.corner;
  nextPoints[stablePlacement.farIndex] = stablePlacement.thirdPoint;

  return nextPoints;
}

function triangleHitsObstacles(points, obstacles = obstacleCenters()) {
  const radius = anchorRadius();

  return points.some((point) => (
    obstacles.some((obstacle) => circleIntersectsBox(point, radius, obstacle, obstacleSize))
  ));
}

function collectedMaskForPoints(points, collectPoints, mask) {
  const collectionRadius = anchorRadius() + spiralSize / 2;
  let nextMask = mask;

  collectPoints.forEach((collectPoint, index) => {
    if (nextMask & (1 << index)) {
      return;
    }

    if (points.some((point) => distanceBetween(point, collectPoint) <= collectionRadius)) {
      nextMask |= 1 << index;
    }
  });

  return nextMask;
}

function moveIsClearAndCollected(startPoints, endPoints, anchorIndex, collectPoints, mask, obstacles) {
  const dragSteps = 12;
  const settleSteps = 16;
  let nextMask = mask;

  for (let step = 1; step <= dragSteps; step += 1) {
    const progress = step / dragSteps;
    const sampledPoints = clonePoints(startPoints);

    sampledPoints[anchorIndex] = {
      x: startPoints[anchorIndex].x + (endPoints[anchorIndex].x - startPoints[anchorIndex].x) * progress,
      y: startPoints[anchorIndex].y + (endPoints[anchorIndex].y - startPoints[anchorIndex].y) * progress,
    };

    if (triangleHitsObstacles(sampledPoints, obstacles)) {
      return null;
    }

    nextMask = collectedMaskForPoints(sampledPoints, collectPoints, nextMask);
  }

  for (let step = 1; step <= settleSteps; step += 1) {
    const progress = step / settleSteps;
    const sampledPoints = startPoints.map((point, index) => {
      const start = index === anchorIndex ? endPoints[index] : point;
      const end = endPoints[index];

      return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
    });

    if (triangleHitsObstacles(sampledPoints, obstacles)) {
      return null;
    }

    nextMask = collectedMaskForPoints(sampledPoints, collectPoints, nextMask);
  }

  return nextMask;
}

function solverCandidateTargets(collectPoints) {
  const candidates = [];
  const seen = new Set();

  function addCandidate(point) {
    const bounded = pointInBounds(point);
    const key = `${Math.round(bounded.x)}:${Math.round(bounded.y)}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(bounded);
  }

  collectPoints.forEach((point) => {
    addCandidate(point);

    [24, 48].forEach((radius) => {
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * 2 * Math.PI;

        addCandidate({
          x: point.x + Math.cos(angle) * radius,
          y: point.y + Math.sin(angle) * radius,
        });
      }
    });
  });

  for (let row = 1; row <= solverGridRows; row += 1) {
    for (let column = 1; column <= solverGridColumns; column += 1) {
      addCandidate({
        x: gameplay.clientWidth * column / (solverGridColumns + 1),
        y: gameplay.clientHeight * row / (solverGridRows + 1),
      });
    }
  }

  return candidates;
}

function solverStateKey(points, mask) {
  return `${mask}|${points.map((point) => (
    `${Math.round(point.x / 12)}:${Math.round(point.y / 12)}`
  )).join("|")}`;
}

function calculateLevelMinimumMoves() {
  const collectPoints = collectCenters();

  if (collectPoints.length === 0 || !baseTriangleSideLength) {
    return null;
  }

  const targets = solverCandidateTargets(collectPoints);
  const allCollectedMask = (1 << collectPoints.length) - 1;
  const startPoints = assetNodes.map(nodePoint);
  const startMask = collectedMaskForPoints(startPoints, collectPoints, 0);

  function searchMinimumMoves(obstacles) {
    const queue = [{
      points: startPoints,
      mask: startMask,
      moves: 0,
    }];
    const visited = new Set([solverStateKey(startPoints, startMask)]);
    let cursor = 0;

    while (cursor < queue.length && cursor < solverMaxStates) {
      const state = queue[cursor];

      cursor += 1;

      if (state.mask === allCollectedMask) {
        return state.moves;
      }

      if (state.moves >= solverMaxDepth) {
        continue;
      }

      for (let anchorIndex = 0; anchorIndex < state.points.length; anchorIndex += 1) {
        for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
          const nextPoints = simulateTriangleMove(state.points, anchorIndex, targets[targetIndex]);
          const nextMask = moveIsClearAndCollected(state.points, nextPoints, anchorIndex, collectPoints, state.mask, obstacles);

          if (nextMask === null) {
            continue;
          }

          const key = solverStateKey(nextPoints, nextMask);

          if (visited.has(key)) {
            continue;
          }

          visited.add(key);
          queue.push({
            points: nextPoints,
            mask: nextMask,
            moves: state.moves + 1,
          });

          if (nextMask === allCollectedMask) {
            return state.moves + 1;
          }
        }
      }
    }

    return null;
  }

  const obstacleAwareMoves = searchMinimumMoves(obstacleCenters());

  if (obstacleAwareMoves !== null) {
    return obstacleAwareMoves;
  }

  const openBoardMoves = searchMinimumMoves([]);

  return openBoardMoves ?? Math.max(1, Math.ceil(collectPoints.length / assetNodes.length));
}

function resumeRotationAfterSettle() {
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    assetNodes.forEach((node) => node.classList.remove("settling"));
    triangleSettling = false;
    triangleReady = true;
    checkSpiralCollisions();
    if (pendingCloseCall) {
      pendingCloseCall = false;
      showCloseCall();
    }

    if (!draggedNode && !gameOver && !levelComplete) {
      rotationPaused = false;
      lastRotationTime = null;
    }
  }, settleDuration);
}

function settleTriangleFromHypotenuse(anchorNode) {
  const anchorIndex = assetNodes.indexOf(anchorNode);

  if (anchorIndex === -1 || !dragStartPoints) {
    return;
  }

  const startPoint = dragStartPoints[anchorIndex];
  const endPoint = nodePoint(anchorNode);
  const movementDistance = distanceBetween(startPoint, endPoint);
  const movementCircle = {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };
  let candidates = circleIntersections(
    movementCircle,
    movementDistance / 2,
    endPoint,
    dragStartSideLength,
  );

  const otherIndexes = assetNodes
    .map((node, index) => index)
    .filter((index) => index !== anchorIndex);
  const placements = candidates.flatMap((corner) => {
    return otherIndexes.map((nearIndex) => {
      const farIndex = otherIndexes.find((index) => index !== nearIndex);
      const thirdOptions = equilateralOptions(endPoint, corner);
      const thirdPoint = thirdOptions.reduce((best, option) => {
        return distanceBetween(option, dragStartPoints[farIndex]) < distanceBetween(best, dragStartPoints[farIndex])
          ? option
          : best;
      }, thirdOptions[0]);

      return {
        nearIndex,
        farIndex,
        corner,
        thirdPoint,
        score:
          distanceBetween(corner, dragStartPoints[nearIndex])
          + distanceBetween(thirdPoint, dragStartPoints[farIndex]),
      };
    });
  });
  const placement = placements.length > 0
    ? placements.reduce((best, option) => (
      option.score < best.score ? option : best
    ), placements[0])
    : fallbackEquilateralPlacement(anchorIndex, endPoint);
  const stablePlacement = placementIsStable(placement, anchorIndex, startPoint, endPoint)
    ? placement
    : fallbackEquilateralPlacement(anchorIndex, endPoint);

  [stablePlacement.nearIndex, stablePlacement.farIndex].forEach((index) => {
    assetNodes[index].classList.add("settling");
  });

  setNodePosition(assetNodes[stablePlacement.nearIndex], stablePlacement.corner);
  setNodePosition(assetNodes[stablePlacement.farIndex], stablePlacement.thirdPoint);

  resumeRotationAfterSettle();

  animateTriangleLinks();
}

function rotateTriangle(now) {
  if (lastRotationTime === null) {
    lastRotationTime = now;
  }

  const elapsedSeconds = (now - lastRotationTime) / 1000;
  lastRotationTime = now;

  if (!gameOver && !levelComplete && !rotationPaused && !draggedNode) {
    const points = assetNodes.map(nodePoint);
    const center = triangleCenter(points);
    const angle = triangleRotationRadiansPerSecond * elapsedSeconds;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);

    assetNodes.forEach((node, index) => {
      const point = points[index];
      const offsetX = point.x - center.x;
      const offsetY = point.y - center.y;

      setNodePosition(node, {
        x: center.x + offsetX * cosine - offsetY * sine,
        y: center.y + offsetX * sine + offsetY * cosine,
      });
    });

    updateTriangleLinks();
  }

  requestAnimationFrame(rotateTriangle);
}

function updateTriangleLinks() {
  const points = assetNodes.map(nodePoint);
  const pointRadius = anchorGlowRadius();
  const pairs = [
    [0, 1],
    [1, 2],
    [2, 0],
  ];

  triangleLinks.forEach((line, index) => {
    const [start, end] = pairs[index];
    const startPoint = points[start];
    const endPoint = points[end];
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance <= pointRadius * 2) {
      const midpointX = (startPoint.x + endPoint.x) / 2;
      const midpointY = (startPoint.y + endPoint.y) / 2;

      line.setAttribute("x1", midpointX);
      line.setAttribute("y1", midpointY);
      line.setAttribute("x2", midpointX);
      line.setAttribute("y2", midpointY);
      return;
    }

    const unitX = deltaX / distance;
    const unitY = deltaY / distance;

    line.setAttribute("x1", startPoint.x + unitX * pointRadius);
    line.setAttribute("y1", startPoint.y + unitY * pointRadius);
    line.setAttribute("x2", endPoint.x - unitX * pointRadius);
    line.setAttribute("y2", endPoint.y - unitY * pointRadius);
  });

  updateTriangleCenter(points);
  checkObstacleCollisions(points);
  checkSpiralCollisions(points);
}

function updateTriangleCenter(points = assetNodes.map(nodePoint)) {
  const center = triangleCenter(points);

  triangleCenterAnchor.style.left = `${center.x}px`;
  triangleCenterAnchor.style.top = `${center.y}px`;
}

function startAssetDrag(event) {
  if (!triangleReady || draggedNode || triangleSettling || levelComplete || gameOver) {
    return;
  }

  draggedNode = event.currentTarget.closest(".asset-node");

  if (!draggedNode) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  window.clearTimeout(settleTimer);
  draggedHandle = event.currentTarget;
  if (event.pointerId !== undefined) {
    draggedHandle.setPointerCapture?.(event.pointerId);
  }
  suppressNextGameplayClick = true;
  rotationPaused = true;
  triangleReady = false;
  lastRotationTime = null;
  dragStartPoints = assetNodes.map(nodePoint);
  dragStartSideLength = baseTriangleSideLength || sideLengthFrom(dragStartPoints);
  assetNodes.forEach((node, index) => {
    node.classList.remove("settling");
    setNodePosition(node, dragStartPoints[index]);
  });
  draggedNode.classList.add("dragging");
  moveAssetNodeFromInput(draggedNode, event);
}

function stopAssetDrag() {
  if (!draggedNode) {
    return;
  }

  const releasedNode = draggedNode;
  draggedNode.classList.remove("dragging");
  draggedNode = null;
  draggedHandle = null;
  playerMoves += 1;
  window.halcyonPlayerMoves = playerMoves;
  updateHud();
  triangleSettling = true;
  settleTriangleFromHypotenuse(releasedNode);
  dragStartPoints = null;
}

function freezeVideo(video, freezeAt) {
  video.pause();
  video.currentTime = freezeAt;
  video.classList.remove("active");
  video.classList.add("frozen");
}

function fadeInLayer(element) {
  element.classList.add("visible");
  element.style.opacity = "0";

  if (!element.animate) {
    element.style.opacity = "";
    return {
      finished: Promise.resolve(),
    };
  }

  const fade = element.animate(
    [
      { opacity: 0 },
      { opacity: 1 },
    ],
    {
      duration: lineFadeDuration,
      easing: "ease",
      fill: "forwards",
    },
  );

  fade.finished.then(() => {
    element.style.opacity = "";
  });

  return fade;
}

function playTriangleVideo(index) {
  const video = triangleVideos[index];
  const node = assetNodes[index];

  if (!video) {
    return;
  }

  const videoDuration = Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : 1.2;
  const freezeAt = Math.max(0, videoDuration - freezeOffsets[index]);
  let nextStarted = false;

  function finishVideo() {
    if (nextStarted) {
      return;
    }

    nextStarted = true;
    freezeVideo(video, freezeAt);

    if (index === triangleVideos.length - 1) {
      const legsFade = fadeInLayer(triangleLinksLayer);
      fadeInLayer(obstacleField);
      fadeInLayer(spiralField);

      legsFade.finished.then(() => {
        window.setTimeout(() => {
          if (!gameOver) {
            triangleReady = true;
            rotationPaused = false;
          }
        }, rotationStartDelay);
      }).catch(() => {
        if (!gameOver) {
          triangleReady = true;
          rotationPaused = false;
        }
      });
      return;
    }

    playTriangleVideo(index + 1);
  }

  video.currentTime = 0;
  video.playbackRate = introPlaybackRate;
  node.style.setProperty("--mask-shrink-duration", `${freezeAt / introPlaybackRate}s`);
  node.classList.add("mask-tight");
  video.classList.add("active");
  const playback = video.play();

  if (playback) {
    playback.catch(() => {
      window.setTimeout(finishVideo, 250);
    });
  }

  window.setTimeout(finishVideo, freezeAt / introPlaybackRate * 1000 + 350);

  video.addEventListener("timeupdate", () => {
    if (nextStarted || video.currentTime < freezeAt) {
      return;
    }

    finishVideo();
  });
}

function startTriangleTest() {
  const readyVideos = triangleVideos.map((video) => (
    video.readyState >= HTMLMediaElement.HAVE_METADATA
      ? Promise.resolve()
      : new Promise((resolve) => {
        const timeout = window.setTimeout(resolve, videoReadyTimeout);

        video.addEventListener("loadedmetadata", () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
      })
  ));

  Promise.all(readyVideos).then(() => {
    playTriangleVideo(0);
  });
}

function showLevelTitle() {
  levelTitle.textContent = `level ${currentLevel}`;
  levelTitle.classList.remove("showing");
  levelTitle.offsetWidth;
  levelTitle.classList.add("showing");

  return new Promise((resolve) => {
    window.setTimeout(() => {
      levelTitle.classList.remove("showing");
      resolve();
    }, levelTitleDuration);
  });
}

async function startGame(event) {
  if (gameStarted) {
    return;
  }

  event?.preventDefault();
  window.clearTimeout(restartTimer);
  gameStarted = true;
  playerMoves = 0;
  levelComplete = false;
  triangleSettling = false;
  triangleReady = false;
  gameOverCleanupStarted = false;
  scoreSubmitted = false;
  pendingCapturedSpirals.clear();
  pendingCloseCall = false;
  gameOverScreen.classList.remove("visible");
  levelCompleteScreen.classList.remove("visible");
  resetLevelVisualLayers();
  window.currentHalcyonLevel = currentLevel;
  window.halcyonPlayerMoves = playerMoves;
  startScreen.classList.add("hidden");
  gameplay.classList.remove("game-ended");
  gameplay.classList.add("started", "active");
  baseTriangleSideLength = sideLengthFrom(assetNodes.map(nodePoint));
  moveCursorToInput(event);
  startPlayAudio();
  await showLevelTitle();
  if (currentLevel === 1 || levelOneMinimumMoves === null) {
    levelOneMinimumMoves = Math.floor(randomBetween(levelOneMinimumMoveLow, levelOneMinimumMoveHigh + 1));
    window.halcyonLevelOneMinimumMoves = levelOneMinimumMoves;
  }
  generateObstacles();
  generateSpiralSprite();
  window.halcyonLevelMinimumMoves = minimumMovesForLevel(currentLevel);
  updateHud();
  updateTriangleLinks();
  requestAnimationFrame(() => {
    updateTriangleLinks();
  });
  requestAnimationFrame(rotateTriangle);
  startTriangleTest();
}

gameplay.addEventListener("pointermove", (event) => {
  if (!gameStarted || gameOver || levelComplete) {
    return;
  }

  if (eventIsTouch(event)) {
    event.preventDefault();
  }

  if (draggedNode) {
    moveAssetNodeFromInput(draggedNode, event);
  }

  if (document.pointerLockElement === gameplay) {
    moveLockedCursor(event.movementX, event.movementY);
    return;
  }

  if (!eventIsTouch(event)) {
    moveCursorToInput(event);
  }
});

gameplay.addEventListener("touchmove", (event) => {
  if (!gameStarted || gameOver || levelComplete) {
    return;
  }

  event.preventDefault();

  if (draggedNode) {
    moveAssetNodeFromInput(draggedNode, event);
  }

  moveCursorToInput(event);
}, { passive: false });

gameplay.addEventListener("pointerup", (event) => {
  if (eventIsTouch(event)) {
    event.preventDefault();
    handleGameplayAction(event);
  }
});

gameplay.addEventListener("click", (event) => {
  handleGameplayAction(event);
});

document.addEventListener("pointerlockchange", () => {
  gameplay.classList.toggle("active", document.pointerLockElement === gameplay);
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "t" || key === "w") {
    collisionTestKeys.add(key);
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (key === "t" || key === "w") {
    collisionTestKeys.delete(key);
  }
});

window.addEventListener("resize", () => {
  centerCursor();
  updateTriangleLinks();
  positionHomeAnchorBackdrop();
});
document.addEventListener("visibilitychange", handleAudioVisibilityChange);
assetNodes.forEach((node) => {
  const handle = node.querySelector(".asset-handle");

  handle.addEventListener("pointerdown", startAssetDrag);
  handle.addEventListener("touchstart", startAssetDrag, { passive: false });
});
playButton.addEventListener("click", startGame);
playButton.addEventListener("pointerup", startGame);
playButton.addEventListener("touchstart", startGame, { passive: false });
playButton.addEventListener("touchend", startGame, { passive: false });
againButton.addEventListener("click", restartGame);
againButton.addEventListener("pointerup", restartGame);
againButton.addEventListener("touchstart", restartGame, { passive: false });
scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (scoreSubmitted) {
    return;
  }

  scoreSubmitted = true;

  try {
    await submitHighScore(playerNameInput.value, finalScore);
    renderGameOverLeaderboard(await fetchTopThreeHighScores());
    scoreForm.hidden = true;
  } catch {
    renderGameOverLeaderboard(null);
  }
});
document.addEventListener("pointerup", stopAssetDrag);
document.addEventListener("touchend", stopAssetDrag);
document.addEventListener("touchcancel", stopAssetDrag);
freezeHomeAnchorSprite();
positionHomeAnchorBackdrop();
requestAnimationFrame(positionHomeAnchorBackdrop);
centerCursor();
updateTriangleLinks();
