import { applyPosterizeToImage } from './posterize.js';
import { audioCtx, getBackgroundAudio } from './audio.js';
import { animateBirds, stopBirds } from './birds.js';
import { createPosterizeStream } from './posterize_stream.js';
import { parseGIF, decompressFrames } from 'https://cdn.jsdelivr.net/npm/gifuct-js@3.0.0/dist/gifuct.esm.js';

const scenes = [
  { // Scene 1: Landscape with birds
    image: 'cutscene_landscape.png',
    duration: 14000,
    fadeInClass: 'fade-in-long',
    onStart: (cs, canvas) => {
      if (posterizeInstance) posterizeInstance.setFogCoverage(0.45); // Set sky mask for cloud effect
      animateBirds(() => {
        // This onComplete might trigger a transition if the scene hasn't already.
        if (currentSceneIndex === 0) {
          transitionToScene(1);
        }
      });
    },
    onEnd: () => {
      stopBirds(false);
    }
  },
  { // Scene 2: Driving on the road
    image: 'cutscene_roadside.png',
    duration: 14000,
    animationClass: 'drive-zoom',
    onStart: (cs, canvas) => {
      const canvasWrapper = document.getElementById('cutscene-canvas-wrapper');
      let scale = 1.0;
      let lastTime = performance.now();
      const zoomSpeed = 0.1;
      const fogStartTime = performance.now();
      const fogDuration = 30000;

      function zoomLoop(currentTime) {
        if (currentSceneIndex !== 1) return; // Stop loop if scene changed
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        scale += zoomSpeed * deltaTime;
        if (canvasWrapper) canvasWrapper.style.transform = `scale(${scale})`;

        const fogElapsed = currentTime - fogStartTime;
        const fogProgress = Math.min(1.0, fogElapsed / fogDuration);
        const currentFogCoverage = 0.45 + (1.5 - 0.45) * fogProgress;
        if (posterizeInstance) posterizeInstance.setFogCoverage(currentFogCoverage);

        zoomRafId = requestAnimationFrame(zoomLoop);
      }
      zoomRafId = requestAnimationFrame(zoomLoop);
    },
    onEnd: () => {
      const canvasWrapper = document.getElementById('cutscene-canvas-wrapper');
      if (canvasWrapper) canvasWrapper.style.transform = `scale(1)`;
    }
  },
  { // Scene 3: The Green Gate (Animated GIF)
    image: 'cutscene_gate.png',
    gif: 'animated.gif',
    duration: 18000, // Longer, more pensive scene
    animationClass: 'gate-zoom',
    onStart: () => {
      // The animation is handled by CSS.
    },
    onEnd: () => {
      // This is the last scene for now. It could fade to black or loop.
    }
  }
];

let currentSceneIndex = -1;
let posterizeInstance = null;
let autoSkipTimeout = null;
let zoomRafId = null;
let isTransitioning = false;
let csElement = null;
let preloadedAssets = [];
let scene3Play = { stream: null, timer: null, frames: null, idx: 0 };

const skipCurrentScene = () => {
  if (currentSceneIndex < scenes.length - 1) {
    transitionToScene(currentSceneIndex + 1);
  }
};

async function transitionToScene(sceneIndex) {
  if (isTransitioning || sceneIndex === currentSceneIndex) return;
  isTransitioning = true;

  const canvas = document.getElementById('cutscene-canvas');
  const gifWrapper = document.getElementById('cutscene-gif-wrapper');
  csElement.removeEventListener('click', skipCurrentScene);
  if (autoSkipTimeout) clearTimeout(autoSkipTimeout);
  
  const isExitingScene2 = currentSceneIndex === 1;

  // For scenes other than scene 2, stop animations before fading.
  if (!isExitingScene2) {
    if (zoomRafId) {
        cancelAnimationFrame(zoomRafId);
        zoomRafId = null;
    }
    if (currentSceneIndex >= 0 && scenes[currentSceneIndex].onEnd) {
        scenes[currentSceneIndex].onEnd();
    }
  }
  
  // Fade out current scene. For scene 2, zoom continues during this fade.
  canvas.className = ''; // Clear all classes to trigger fade-out
  if (gifWrapper) gifWrapper.className = '';

  await new Promise(r => setTimeout(r, 2000));
  
  // Now that the screen is black, stop scene 2's zoom and run its cleanup.
  if (isExitingScene2) {
    if (zoomRafId) {
        cancelAnimationFrame(zoomRafId);
        zoomRafId = null;
    }
    if (currentSceneIndex >= 0 && scenes[currentSceneIndex].onEnd) {
        scenes[currentSceneIndex].onEnd();
    }
  }

  if (gifWrapper) gifWrapper.innerHTML = '';

  const flockContainer = document.getElementById('bird-flock');
  if (flockContainer && currentSceneIndex === 0) {
      flockContainer.innerHTML = '';
  }

  if (posterizeInstance) {
    try { posterizeInstance.cleanup(); } catch {}
    posterizeInstance = null;
  }
  
  if (scene3Play.timer) { clearTimeout(scene3Play.timer); scene3Play.timer = null; }
  if (scene3Play.stream) { try{ scene3Play.stream.cleanup(); }catch{} scene3Play.stream = null; }
  
  currentSceneIndex = sceneIndex;
  const scene = scenes[currentSceneIndex];
  const sceneAssets = preloadedAssets[currentSceneIndex];

  if (!sceneAssets || !sceneAssets.img) {
      console.error(`Scene ${currentSceneIndex + 1} assets not preloaded.`);
      isTransitioning = false;
      return;
  }
  
  if (scene.gif && sceneAssets.gif) {
    // --- Slideshow (GIF frames) with posterize shader ---
    canvas.style.display = 'block';
    const baseImg = sceneAssets.img;
    const { frames } = sceneAssets.gif; // [{bitmap, delay}]
    const w = baseImg.naturalWidth, h = baseImg.naturalHeight;
    posterizeInstance = null;
    scene3Play.stream = createPosterizeStream(canvas, w, h, 5.0, 0.12);
    scene3Play.stream.setFogCoverage(0.5); // top half sky
    scene3Play.frames = frames; scene3Play.idx = 0;
    const off = document.createElement('canvas'); off.width = w; off.height = h; const ctx = off.getContext('2d');
    if (scene.animationClass) canvas.classList.add(scene.animationClass);
    const step = () => {
      if (currentSceneIndex !== sceneIndex || !scene3Play.stream) return;
      const f = scene3Play.frames[scene3Play.idx]; ctx.clearRect(0,0,w,h);
      ctx.drawImage(baseImg,0,0,w,h); ctx.drawImage(f.bitmap,0,0);
      scene3Play.stream.updateFrame(off);
      scene3Play.idx = (scene3Play.idx + 1) % scene3Play.frames.length;
      scene3Play.timer = setTimeout(step, Math.max(40, f.delay));
    };
    requestAnimationFrame(() => {
      canvas.classList.add('reveal');
      if (scene.onStart) scene.onStart(csElement, canvas);
      step();
      if (currentSceneIndex < scenes.length - 1) {
        autoSkipTimeout = setTimeout(skipCurrentScene, scene.duration);
        csElement.addEventListener('click', skipCurrentScene, { once: true });
      }
      isTransitioning = false;
    });

  } else {
    // --- Canvas Scene Logic ---
    canvas.style.display = 'block';
    posterizeInstance = applyPosterizeToImage(canvas, sceneAssets.img, 5.0, 0.12);

    requestAnimationFrame(() => {
        canvas.classList.add('reveal');
        if (scene.fadeInClass) canvas.classList.add(scene.fadeInClass);
        if (scene.animationClass) canvas.classList.add(scene.animationClass);
        
        if (scene.onStart) scene.onStart(csElement, canvas);

        if (currentSceneIndex < scenes.length - 1) {
            autoSkipTimeout = setTimeout(skipCurrentScene, scene.duration);
            csElement.addEventListener('click', skipCurrentScene, { once: true });
        }
        isTransitioning = false;
    });
  }
}

async function preloadCutsceneAssets() {
  const promises = scenes.map(scene => {
    const imagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(`Failed to load ${scene.image}: ${err}`);
      img.src = scene.image;
    });

    if (scene.gif) {
      const gifFramesPromise = (async () => {
        const res = await fetch(scene.gif); const buf = await res.arrayBuffer();
        const gif = parseGIF(buf); const raw = decompressFrames(gif, true);
        // Build ImageBitmaps and delays
        const frames = await Promise.all(raw.map(async fr => {
          const c = document.createElement('canvas'); c.width = fr.dims.width; c.height = fr.dims.height;
          const cx = c.getContext('2d'); const id = cx.createImageData(fr.dims.width, fr.dims.height);
          id.data.set(fr.patch); cx.putImageData(id, 0, 0);
          const bm = await createImageBitmap(c);
          return { bitmap: bm, delay: (fr.delay || 8) * 10 }; // delay in ms
        }));
        return { frames };
      })();
      return Promise.all([imagePromise, gifFramesPromise]).then(([img, gif]) => ({ img, gif }));
    }

    return imagePromise.then(img => ({ img }));
  });
  return Promise.all(promises);
}

export async function startCutscene(){
  csElement = document.getElementById('cutscene');
  const loading = csElement.querySelector('.cutscene-loading');
  csElement.style.display = 'flex';
  loading.style.display = 'grid';
  
  try {
    preloadedAssets = await preloadCutsceneAssets();
  } catch (error) {
    console.error("Failed to preload cutscene assets:", error);
    loading.style.display = 'none'; // Hide loader on error too
    // Maybe show an error message to the user
    return;
  }
  loading.style.display = 'none';
  
  const bg = getBackgroundAudio();
  if (bg) { try { bg.pause(); } catch(e){} }
  
  const cutsceneAudio = new Audio('Distant Transmission - Sonauto.ai.ogg');
  const src = audioCtx.createMediaElementSource(cutsceneAudio);
  const g = audioCtx.createGain();
  g.gain.value = 0;
  src.connect(g).connect(audioCtx.destination);
  await audioCtx.resume();
  await cutsceneAudio.play().catch(()=>{});
  g.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 7);
  setTimeout(() => {
    g.gain.cancelScheduledValues(audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 7);
  }, (115 - 7) * 1000);

  currentSceneIndex = -1;
  isTransitioning = false;
  transitionToScene(0);
}