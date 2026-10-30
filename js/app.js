/**
 * app.js - Main Application Controller
 * Coordinates:
 * - Canvas sizing with HiDPI support
 * - Pointer and Touch event dispatcher (Poke, Drag, Stretch)
 * - Game Loop (physics simulation, particle updates, rendering)
 * - HUD state (stress bar, stats counter, survive timer)
 * - Settings, modals, themes, and audio unlock
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('bubbleCanvas');
  const ctx = canvas.getContext('2d');

  // DOM Elements
  const stressPercent = document.getElementById('stressPercent');
  const stressBarFill = document.getElementById('stressBarFill');
  const bubbleMood = document.getElementById('bubbleMood');
  const pokeCountElem = document.getElementById('pokeCount');
  const stretchMaxElem = document.getElementById('stretchMax');
  const miniBubblesCountElem = document.getElementById('miniBubblesCount');
  const surviveTimerElem = document.getElementById('surviveTimer');
  const hintTextElem = document.getElementById('hintText');

  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');
  const resetBtn = document.getElementById('resetBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const helpBtn = document.getElementById('helpBtn');
  const settingsModal = document.getElementById('settingsModal');
  const helpModal = document.getElementById('helpModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');
  const gotItBtn = document.getElementById('gotItBtn');
  const audioBanner = document.getElementById('audioBanner');
  const dismissAudioPrompt = document.getElementById('dismissAudioPrompt');

  const toggleFaceInput = document.getElementById('toggleFace');
  const toggleSoundInput = document.getElementById('toggleSound');
  const toggleParticlesInput = document.getElementById('toggleParticles');

  // Core Instances
  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = window.devicePixelRatio || 1;

  const particleManager = new ParticleManager();
  particleManager.initAmbient(width, height, 32);

  const bubble = new DeformableBubble(width, height);

  // Interaction State
  let pointerX = width / 2;
  let pointerY = height / 2;
  let isPointerDown = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerDownTime = 0;
  let totalPokes = 0;
  let babyBubblesSpawned = 0;
  let surviveStartTime = Date.now();

  /**
   * Resize Canvas with Retina/HiDPI scaling
   */
  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    bubble.resize(width, height);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  /**
   * Audio Unlock on First Gesture
   */
  function unlockAudio() {
    if (window.bubbleAudio) {
      window.bubbleAudio.resume();
      if (audioBanner) {
        audioBanner.classList.add('hidden');
      }
    }
  }

  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  if (dismissAudioPrompt) {
    dismissAudioPrompt.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
    });
  }

  /**
   * Pointer Coordinates Helper
   */
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Pointer Down:
   * Checks if clicking mini bubble, or starting drag / stretch on main bubble
   */
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    const pos = getCanvasCoords(e);
    pointerX = pos.x;
    pointerY = pos.y;
    pointerDownX = pos.x;
    pointerDownY = pos.y;
    pointerDownTime = performance.now();
    isPointerDown = true;

    // Check if popping a mini baby bubble first
    if (particleManager.checkMiniBubbleHit(pos.x, pos.y)) {
      if (window.bubbleAudio) window.bubbleAudio.playMiniPop();
      return;
    }

    // Check hit on main bubble
    const dx = pos.x - bubble.x;
    const dy = pos.y - bubble.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= bubble.baseRadius * 1.35) {
      bubble.startDrag(pos.x, pos.y);
    }
  });

  /**
   * Pointer Move:
   * Updates drag, stretch, or hover tracking
   */
  window.addEventListener('pointermove', (e) => {
    const pos = getCanvasCoords(e);
    pointerX = pos.x;
    pointerY = pos.y;

    if (isPointerDown) {
      if (bubble.isDragging) {
        bubble.updateDrag(pos.x, pos.y, particleManager);
      }
    }
  });

  /**
   * Pointer Up:
   * Determines if it was a quick poke or end of drag
   */
  window.addEventListener('pointerup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    const pos = getCanvasCoords(e);
    const duration = performance.now() - pointerDownTime;
    const moveDist = Math.hypot(pos.x - pointerDownX, pos.y - pointerDownY);

    // If fast click / tap: Treat as a POKE!
    if (duration < 350 && moveDist < 32) {
      const dx = pos.x - bubble.x;
      const dy = pos.y - bubble.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= bubble.baseRadius * 1.45) {
        totalPokes++;
        pokeCountElem.textContent = totalPokes;
        bubble.poke(pos.x, pos.y, particleManager);
        showHint('Ouch! Poking squishes and wobbles the bubble!');
      }
    }

    bubble.endDrag();
  });

  canvas.addEventListener('pointercancel', () => {
    isPointerDown = false;
    bubble.endDrag();
  });

  /**
   * Dynamic Hint Toaster
   */
  let hintTimeout = null;
  function showHint(text) {
    if (!hintTextElem) return;
    hintTextElem.textContent = text;
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => {
      hintTextElem.textContent = 'Click & drag to move • Pull edge to stretch • Poke to squish!';
    }, 3200);
  }

  /**
   * UI HUD Updates
   */
  function updateHUD() {
    // Stress Bar & Percentage
    const stressVal = Math.round(bubble.stress);
    stressPercent.textContent = `${stressVal}%`;
    stressBarFill.style.width = `${stressVal}%`;

    // Mood status text and color
    if (bubble.isPopped) {
      bubbleMood.textContent = '💥 POPPED! Respawning...';
      bubbleMood.style.color = '#ef4444';
      stressBarFill.style.background = '#ef4444';
    } else if (stressVal >= 75) {
      bubbleMood.textContent = 'Mood: Panicked! Please Stop!';
      bubbleMood.style.color = '#ef4444';
      stressBarFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)';
    } else if (stressVal >= 40) {
      bubbleMood.textContent = 'Mood: Feeling Strained & Wobbly';
      bubbleMood.style.color = '#f59e0b';
      stressBarFill.style.background = 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)';
    } else {
      bubbleMood.textContent = 'Mood: Happy & Safe 🫧';
      bubbleMood.style.color = '#34d399';
      stressBarFill.style.background = 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)';
    }

    // Stretch max
    stretchMaxElem.textContent = `${bubble.maxStretchRatio.toFixed(1)}x`;

    // Baby bubbles count
    babyBubblesCountElem.textContent = particleManager.miniBubbles.length;

    // Survival timer
    const elapsedSec = Math.floor((Date.now() - surviveStartTime) / 1000);
    surviveTimerElem.textContent = `${elapsedSec}s`;
  }

  /**
   * Main Render & Physics Game Loop (60+ FPS)
   */
  function gameLoop() {
    // 1. Clear Canvas with slight alpha trail or pristine clear
    ctx.clearRect(0, 0, width, height);

    // 2. Update Physics
    bubble.update(width, height, pointerX, pointerY, particleManager);
    particleManager.update(width, height);

    // 3. Render Layers
    particleManager.draw(ctx);
    bubble.draw(ctx);

    // 4. Update HUD
    updateHUD();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  /**
   * Sound Toggle Controls
   */
  function toggleAudio() {
    if (!window.bubbleAudio) return;
    const isNowMuted = !window.bubbleAudio.isMuted;
    window.bubbleAudio.setMuted(isNowMuted);
    updateAudioUI(isNowMuted);
  }

  function updateAudioUI(isMuted) {
    soundIcon.textContent = isMuted ? '🔇' : '🔊';
    if (toggleSoundInput) toggleSoundInput.checked = !isMuted;
  }

  soundToggleBtn.addEventListener('click', () => {
    unlockAudio();
    toggleAudio();
  });

  if (toggleSoundInput) {
    toggleSoundInput.addEventListener('change', (e) => {
      unlockAudio();
      window.bubbleAudio.setMuted(!e.target.checked);
      updateAudioUI(!e.target.checked);
    });
  }

  /**
   * Face and Particle Settings Toggles
   */
  if (toggleFaceInput) {
    toggleFaceInput.addEventListener('change', (e) => {
      bubble.showFace = e.target.checked;
    });
  }

  if (toggleParticlesInput) {
    toggleParticlesInput.addEventListener('change', (e) => {
      particleManager.showAmbient = e.target.checked;
    });
  }

  /**
   * Mode Selection
   */
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode');
      bubble.gameMode = mode;

      if (mode === 'dodge') {
        showHint('🏃 Survival Mode: The bubble tries to dodge your cursor!');
      } else if (mode === 'zen') {
        showHint('🧘 Zen Mode: Unpoppable bubble! Stretch to infinity.');
      } else {
        showHint('🫧 Classic Mode: Balanced physics and pop strain.');
      }
    });
  });

  /**
   * Theme Chips Selection
   */
  const themeChips = document.querySelectorAll('.theme-chip');
  themeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      themeChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const theme = chip.getAttribute('data-theme');
      bubble.theme = theme;
      showHint(`Applied ${chip.textContent.trim()} theme!`);
    });
  });

  /**
   * Reset / Respawn Button
   */
  function resetBubble() {
    bubble.respawn(width, height);
    particleManager.clear();
    particleManager.initAmbient(width, height, 32);
    surviveStartTime = Date.now();
    showHint('✨ Spawned a fresh, happy bubble!');
  }

  resetBtn.addEventListener('click', () => {
    unlockAudio();
    resetBubble();
  });

  /**
   * Modals: Settings & Help
   */
  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
  }

  settingsBtn.addEventListener('click', () => openModal(settingsModal));
  closeSettingsBtn.addEventListener('click', () => closeModal(settingsModal));

  helpBtn.addEventListener('click', () => openModal(helpModal));
  closeHelpBtn.addEventListener('click', () => closeModal(helpModal));
  if (gotItBtn) gotItBtn.addEventListener('click', () => closeModal(helpModal));

  [settingsModal, helpModal].forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });

  /**
   * Keyboard Shortcuts
   */
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      toggleAudio();
    } else if (e.key === 'r' || e.key === 'R') {
      resetBubble();
    } else if (e.key === 'Escape') {
      closeModal(settingsModal);
      closeModal(helpModal);
    } else if (e.key === '?') {
      openModal(helpModal);
    }
  });
});
