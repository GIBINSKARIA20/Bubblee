/**
 * bubble.js - Soft-Body Deformable Bubble Engine
 *
 * Simulates a realistic deformable soap bubble using:
 * - 48 radial spring-mass vertices
 * - Surface tension coupling between adjacent vertices
 * - Air pressure / volume preservation (squash causes opposite bulge)
 * - Screen boundary collision flattening
 * - Expressive facial animations (tracking pointer, reacting to pulls/pokes)
 * - Multi-stop iridescent soap film rendering with dynamic specular highlights
 */

class DeformableBubble {
  constructor(canvasWidth, canvasHeight) {
    this.numVertices = 48;
    this.vertices = [];
    this.baseRadius = Math.min(130, Math.min(canvasWidth, canvasHeight) * 0.18);
    this.radius = this.baseRadius;

    // Center position & physics
    this.x = canvasWidth / 2;
    this.y = canvasHeight / 2;
    this.vx = 0;
    this.vy = 0;

    // Ambient floating drift
    this.floatPhase = Math.random() * Math.PI * 2;
    this.floatSpeed = 0.02;

    // Soft-body physics constants
    this.springK = 0.045;       // Restoring force to target radius
    this.tensionK = 0.22;       // Coupling with neighbors (surface tension)
    this.damping = 0.92;        // Fluid velocity decay
    this.volumePressureK = 0.015; // Volume conservation bulge force

    // Stress & Poking mechanics
    this.stress = 0;             // 0 to 100%
    this.stressDecay = 0.18;     // Cooldown per frame
    this.maxPokesBeforeBurst = 14;
    this.recentPokes = 0;
    this.lastPokeTime = 0;

    // Drag & Stretch state
    this.isDragging = false;
    this.dragMode = null;       // 'center' (move) or 'edge' (stretch/pull)
    this.dragVertexIndex = -1;
    this.dragTargetX = 0;
    this.dragTargetY = 0;
    this.currentStretchRatio = 1.0;
    this.maxStretchRatio = 1.0;

    // State & Life
    this.isPopped = false;
    this.respawning = false;
    this.respawnProgress = 0;
    this.timeAlive = 0;
    this.showFace = true;
    this.gameMode = 'classic';   // 'classic', 'dodge', 'zen'
    this.theme = 'iridescent';   // 'iridescent', 'neon', 'sunset', 'cosmic', 'emerald'

    // Facial expressions
    this.blinkTimer = 180 + Math.random() * 120;
    this.isBlinking = false;
    this.lookX = 0; // -1 to 1
    this.lookY = 0;
    this.expression = 'idle';   // 'idle', 'curious', 'nervous', 'strained', 'panicking', 'relieved'

    this.initVertices();
  }

  /**
   * Initializes the 48 radial vertices around center
   */
  initVertices() {
    this.vertices = [];
    for (let i = 0; i < this.numVertices; i++) {
      const angle = (Math.PI * 2 * i) / this.numVertices;
      this.vertices.push({
        angle: angle,
        r: this.baseRadius,
        targetR: this.baseRadius,
        vr: 0,
        // Absolute Cartesian positions
        x: this.x + Math.cos(angle) * this.baseRadius,
        y: this.y + Math.sin(angle) * this.baseRadius,
        vx: 0,
        vy: 0
      });
    }
  }

  /**
   * Resize adaptation
   */
  resize(width, height) {
    this.baseRadius = Math.min(135, Math.min(width, height) * 0.18);
    // Keep in bounds
    this.x = Math.max(this.baseRadius + 20, Math.min(width - this.baseRadius - 20, this.x));
    this.y = Math.max(this.baseRadius + 20, Math.min(height - this.baseRadius - 20, this.y));
  }

  /**
   * Respawn sequence after pop
   */
  respawn(width, height) {
    this.isPopped = false;
    this.respawning = true;
    this.respawnProgress = 0;
    this.stress = 0;
    this.recentPokes = 0;
    this.currentStretchRatio = 1.0;
    this.x = width / 2 + (Math.random() - 0.5) * 80;
    this.y = height / 2 + (Math.random() - 0.5) * 80;
    this.vx = 0;
    this.vy = -1; // float up gently
    this.initVertices();

    if (window.bubbleAudio) {
      window.bubbleAudio.playRespawn();
    }
  }

  /**
   * Poke the bubble at (px, py)
   * Applies localized indentation, wave ripple, and stress
   */
  poke(px, py, particleManager) {
    if (this.isPopped || this.respawning) return;

    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);

    // Calculate angle of poke relative to center
    let pokeAngle = Math.atan2(dy, dx);
    if (pokeAngle < 0) pokeAngle += Math.PI * 2;

    const now = performance.now();
    if (now - this.lastPokeTime < 600) {
      this.recentPokes++;
    } else {
      this.recentPokes = Math.max(1, this.recentPokes - 1);
    }
    this.lastPokeTime = now;

    // Recoil bubble center away from poke
    const recoilForce = Math.min(5, 1.8 + this.recentPokes * 0.4);
    this.vx -= Math.cos(pokeAngle) * recoilForce;
    this.vy -= Math.sin(pokeAngle) * recoilForce;

    // Deform vertices around poke angle
    const influenceSpread = (Math.PI * 2) / 6; // 60 degrees spread
    const pushDepth = Math.min(this.baseRadius * 0.65, 24 + this.recentPokes * 6);

    for (let i = 0; i < this.numVertices; i++) {
      const v = this.vertices[i];
      let diffAngle = Math.abs(v.angle - pokeAngle);
      if (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;

      if (diffAngle < influenceSpread) {
        const falloff = Math.cos((diffAngle / influenceSpread) * (Math.PI / 2));
        // Push inward towards center
        v.r -= pushDepth * falloff;
        v.vr -= pushDepth * 0.4 * falloff;
      }
    }

    // Stress increase
    const stressAdd = 8 + this.recentPokes * 3.5;
    this.stress = Math.min(100, this.stress + stressAdd);

    // Audio
    if (window.bubbleAudio) {
      window.bubbleAudio.playPoke(Math.min(1, 0.4 + this.recentPokes * 0.08));
    }

    // Spawn baby bubbles on repeated poking
    if (this.recentPokes >= 3 && particleManager) {
      const spawnAngle = pokeAngle + Math.PI + (Math.random() - 0.5) * 0.8;
      const spawnX = this.x + Math.cos(spawnAngle) * (this.baseRadius * 0.9);
      const spawnY = this.y + Math.sin(spawnAngle) * (this.baseRadius * 0.9);
      const spawnSpeed = 2 + Math.random() * 3.5;
      particleManager.spawnBabyBubble(
        spawnX, spawnY,
        Math.cos(spawnAngle) * spawnSpeed,
        Math.sin(spawnAngle) * spawnSpeed - 1
      );

      if (window.bubbleAudio) {
        window.bubbleAudio.playMiniPop();
      }
    }

    // Check pop threshold
    if (this.gameMode !== 'zen' && (this.stress >= 100 || this.recentPokes > this.maxPokesBeforeBurst)) {
      this.pop(particleManager);
    }
  }

  /**
   * Start drag / pull interaction
   */
  startDrag(px, py) {
    if (this.isPopped || this.respawning) return;

    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);

    this.isDragging = true;
    this.dragTargetX = px;
    this.dragTargetY = py;

    // If grabbed near perimeter, it's a stretch/pull! If inside, it's a drag/carry.
    if (dist > this.baseRadius * 0.65) {
      this.dragMode = 'edge';
      // Find closest vertex
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < this.numVertices; i++) {
        const vx = this.x + Math.cos(this.vertices[i].angle) * this.vertices[i].r;
        const vy = this.y + Math.sin(this.vertices[i].angle) * this.vertices[i].r;
        const d = Math.hypot(px - vx, py - vy);
        if (d < closestDist) {
          closestDist = d;
          closestIdx = i;
        }
      }
      this.dragVertexIndex = closestIdx;
    } else {
      this.dragMode = 'center';
      this.dragOffsetX = dx;
      this.dragOffsetY = dy;
    }
  }

  /**
   * Continue dragging / pulling
   */
  updateDrag(px, py, particleManager) {
    if (!this.isDragging || this.isPopped) return;

    this.dragTargetX = px;
    this.dragTargetY = py;

    if (this.dragMode === 'center') {
      // Smoothly follow pointer with direct responsiveness and release momentum
      const targetX = px - this.dragOffsetX;
      const targetY = py - this.dragOffsetY;
      this.vx = (targetX - this.x) * 0.3;
      this.vy = (targetY - this.y) * 0.3;
      this.x += (targetX - this.x) * 0.4;
      this.y += (targetY - this.y) * 0.4;
    } else if (this.dragMode === 'edge' && this.dragVertexIndex >= 0) {
      // Stretch calculation
      const dx = px - this.x;
      const dy = py - this.y;
      const stretchDist = Math.hypot(dx, dy);
      const stretchRatio = stretchDist / this.baseRadius;
      this.currentStretchRatio = stretchRatio;
      if (stretchRatio > this.maxStretchRatio) {
        this.maxStretchRatio = parseFloat(stretchRatio.toFixed(2));
      }

      // Elastic pull on bubble center when stretching edge
      if (stretchDist > this.baseRadius) {
        const pullFactor = Math.min(3, (stretchDist - this.baseRadius) * 0.035);
        this.vx += (dx / stretchDist) * pullFactor;
        this.vy += (dy / stretchDist) * pullFactor;
      }

      // Add stress proportional to stretch strain
      if (stretchRatio > 1.35) {
        const strain = (stretchRatio - 1.35) * 0.85;
        this.stress = Math.min(100, this.stress + strain);

        if (window.bubbleAudio && Math.random() < 0.25) {
          window.bubbleAudio.playStretch(Math.min(1, (stretchRatio - 1) / 1.5));
        }
      }

      // Snap pop condition
      const snapThreshold = this.gameMode === 'zen' ? 999 : 2.55;
      if (stretchRatio >= snapThreshold || (this.gameMode !== 'zen' && this.stress >= 100)) {
        this.pop(particleManager);
      }
    }
  }

  /**
   * Release drag / pull
   */
  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Release rebound wobble
    if (this.dragMode === 'edge') {
      if (window.bubbleAudio && this.currentStretchRatio > 1.3) {
        window.bubbleAudio.playBounce(Math.min(1, this.currentStretchRatio * 0.4));
      }
    }

    this.dragMode = null;
    this.dragVertexIndex = -1;
    this.currentStretchRatio = 1.0;
  }

  /**
   * Pop the bubble!
   */
  pop(particleManager) {
    if (this.isPopped) return;
    this.isPopped = true;
    this.isDragging = false;
    this.stress = 0;

    if (window.bubbleAudio) {
      window.bubbleAudio.playPop();
    }

    if (particleManager) {
      particleManager.spawnPopBurst(this.x, this.y, this.baseRadius);
    }

    // Auto respawn after dramatic delay
    setTimeout(() => {
      this.respawn(window.innerWidth, window.innerHeight);
    }, 1500);
  }

  /**
   * Evasive steering for "Dodge" mode
   */
  applyDodge(pointerX, pointerY) {
    if (this.gameMode !== 'dodge' || this.isDragging || this.isPopped) return;

    const dx = this.x - pointerX;
    const dy = this.y - pointerY;
    const dist = Math.hypot(dx, dy);
    const dangerZone = this.baseRadius * 2.2;

    if (dist < dangerZone && dist > 1) {
      const force = (1 - dist / dangerZone) * 1.8;
      this.vx += (dx / dist) * force;
      this.vy += (dy / dist) * force;
    }
  }

  /**
   * Main physics step
   */
  update(width, height, pointerX, pointerY, particleManager) {
    this.timeAlive++;

    // Respawn animation
    if (this.respawning) {
      this.respawnProgress += 0.035;
      if (this.respawnProgress >= 1) {
        this.respawnProgress = 1;
        this.respawning = false;
      }
      this.radius = this.baseRadius * Math.sin((this.respawnProgress * Math.PI) / 2);
    } else if (!this.isPopped) {
      this.radius = this.baseRadius;
    }

    if (this.isPopped) return;

    // 1. Natural Ambient Float & Buoyancy
    this.floatPhase += this.floatSpeed;
    this.vx += Math.sin(this.floatPhase) * 0.05;
    this.vy += Math.cos(this.floatPhase * 0.8) * 0.04 - 0.02; // slight upward drift

    // 2. Center Velocity & Damping
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.94;
    this.vy *= 0.94;

    // 3. Dodge logic if in dodge mode
    this.applyDodge(pointerX, pointerY);

    // 4. Stress Cooldown
    if (!this.isDragging && this.recentPokes === 0) {
      const oldStress = this.stress;
      this.stress = Math.max(0, this.stress - this.stressDecay);
      if (oldStress > 60 && this.stress <= 20) {
        if (window.bubbleAudio) window.bubbleAudio.playSigh();
      }
    }

    // 5. Soft-Body Radial Spring Mesh Physics
    // Calculate current polygon area for volume conservation
    let currentArea = 0;
    for (let i = 0; i < this.numVertices; i++) {
      const nextIdx = (i + 1) % this.numVertices;
      const vi = this.vertices[i];
      const vn = this.vertices[nextIdx];
      const xi = Math.cos(vi.angle) * vi.r;
      const yi = Math.sin(vi.angle) * vi.r;
      const xn = Math.cos(vn.angle) * vn.r;
      const yn = Math.sin(vn.angle) * vn.r;
      currentArea += (xi * yn - xn * yi);
    }
    currentArea = Math.abs(currentArea * 0.5);
    const targetArea = Math.PI * this.radius * this.radius;
    const areaDelta = targetArea - currentArea; // positive if squashed/deflated

    // Vertex physics loop
    const n = this.numVertices;
    for (let i = 0; i < n; i++) {
      const v = this.vertices[i];
      const prev = this.vertices[(i - 1 + n) % n];
      const next = this.vertices[(i + 1) % n];

      // Radial restoring spring
      const springForce = (this.radius - v.r) * this.springK;

      // Surface tension coupling
      const tensionForce = ((prev.r + next.r) * 0.5 - v.r) * this.tensionK;

      // Air pressure expansion when squashed
      const pressureForce = (areaDelta / targetArea) * this.volumePressureK * this.radius;

      // Sum forces
      v.vr += springForce + tensionForce + pressureForce;

      // Damping
      v.vr *= this.damping;

      // Apply
      v.r += v.vr;

      // Safeguard radius
      v.r = Math.max(15, Math.min(this.radius * 3.2, v.r));
    }

    // 6. Handle Stretch Drag Pinned Vertices
    if (this.isDragging && this.dragMode === 'edge' && this.dragVertexIndex >= 0) {
      const targetIdx = this.dragVertexIndex;
      const dx = this.dragTargetX - this.x;
      const dy = this.dragTargetY - this.y;
      const targetDist = Math.hypot(dx, dy);

      // Pin nearest vertices with bell curve falloff
      const pinWidth = 8;
      for (let offset = -pinWidth; offset <= pinWidth; offset++) {
        const idx = (targetIdx + offset + n) % n;
        const weight = Math.cos((offset / pinWidth) * (Math.PI / 2));
        const goalR = this.radius + (targetDist - this.radius) * weight;
        this.vertices[idx].r += (goalR - this.vertices[idx].r) * 0.45;
      }
    }

    // 7. Screen Edge Collisions & Squash Flattening
    this.checkWallCollisions(width, height);

    // 8. Facial Expression & Gaze Update
    this.updateFace(pointerX, pointerY);
  }

  /**
   * Squashes vertices against window edges and preserves volume
   */
  checkWallCollisions(width, height) {
    const margin = 12;
    let hitWall = false;
    let maxSquashSpeed = 0;

    for (let i = 0; i < this.numVertices; i++) {
      const v = this.vertices[i];
      let worldX = this.x + Math.cos(v.angle) * v.r;
      let worldY = this.y + Math.sin(v.angle) * v.r;

      // Left edge
      if (worldX < margin) {
        const overlap = margin - worldX;
        worldX = margin;
        v.r -= overlap * Math.abs(Math.cos(v.angle));
        v.vr -= overlap * 0.2;
        hitWall = true;
      }
      // Right edge
      else if (worldX > width - margin) {
        const overlap = worldX - (width - margin);
        worldX = width - margin;
        v.r -= overlap * Math.abs(Math.cos(v.angle));
        v.vr -= overlap * 0.2;
        hitWall = true;
      }

      // Top edge
      if (worldY < margin + 60) { // top header clearance
        const overlap = (margin + 60) - worldY;
        worldY = margin + 60;
        v.r -= overlap * Math.abs(Math.sin(v.angle));
        v.vr -= overlap * 0.2;
        hitWall = true;
      }
      // Bottom edge
      else if (worldY > height - margin - 30) {
        const overlap = worldY - (height - margin - 30);
        worldY = height - margin - 30;
        v.r -= overlap * Math.abs(Math.sin(v.angle));
        v.vr -= overlap * 0.2;
        hitWall = true;
      }
    }

    // Center boundary clamping & bounce
    const pad = this.radius * 0.7;
    if (this.x - pad < margin) {
      this.x = margin + pad;
      if (Math.abs(this.vx) > 1.2) {
        maxSquashSpeed = Math.abs(this.vx);
        this.vx = -this.vx * 0.65;
      }
    } else if (this.x + pad > width - margin) {
      this.x = width - margin - pad;
      if (Math.abs(this.vx) > 1.2) {
        maxSquashSpeed = Math.abs(this.vx);
        this.vx = -this.vx * 0.65;
      }
    }

    if (this.y - pad < margin + 60) {
      this.y = margin + 60 + pad;
      if (Math.abs(this.vy) > 1.2) {
        maxSquashSpeed = Math.max(maxSquashSpeed, Math.abs(this.vy));
        this.vy = -this.vy * 0.65;
      }
    } else if (this.y + pad > height - margin - 30) {
      this.y = height - margin - 30 - pad;
      if (Math.abs(this.vy) > 1.2) {
        maxSquashSpeed = Math.max(maxSquashSpeed, Math.abs(this.vy));
        this.vy = -this.vy * 0.65;
      }
    }

    if (maxSquashSpeed > 2 && window.bubbleAudio) {
      window.bubbleAudio.playBounce(Math.min(1, maxSquashSpeed / 8));
      this.stress = Math.min(100, this.stress + maxSquashSpeed * 2);
    }
  }

  /**
   * Updates eyes gaze & emotional expression based on situation
   */
  updateFace(pointerX, pointerY) {
    // Eye gaze tracking
    const dx = pointerX - this.x;
    const dy = pointerY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      this.lookX = Math.max(-1, Math.min(1, (dx / dist) * Math.min(1, dist / 150)));
      this.lookY = Math.max(-1, Math.min(1, (dy / dist) * Math.min(1, dist / 150)));
    }

    // Blinking
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      if (this.blinkTimer <= -10) {
        this.isBlinking = false;
        this.blinkTimer = 140 + Math.random() * 160;
      }
    }

    // Determine mood
    if (this.stress >= 75 || this.currentStretchRatio > 2.0) {
      this.expression = 'panicking';
    } else if (this.stress >= 40 || this.currentStretchRatio > 1.5 || this.recentPokes >= 3) {
      this.expression = 'strained';
    } else if (dist < this.baseRadius * 1.5 && dist > 1) {
      this.expression = 'nervous';
    } else if (dist < this.baseRadius * 3.0) {
      this.expression = 'curious';
    } else {
      this.expression = 'idle';
    }
  }

  /**
   * Draw the deformable bubble with smooth Catmull-Rom spline,
   * iridescent soap film shader, specular highlights, and cute face.
   */
  draw(ctx) {
    if (this.isPopped) return;

    ctx.save();

    // Calculate vertex positions in world space
    const pts = [];
    for (let i = 0; i < this.numVertices; i++) {
      const v = this.vertices[i];
      pts.push({
        x: this.x + Math.cos(v.angle) * v.r,
        y: this.y + Math.sin(v.angle) * v.r
      });
    }

    // 1. Create Smooth Spline Path
    ctx.beginPath();
    this.drawSmoothContour(ctx, pts);
    ctx.closePath();

    // 2. Fill with Iridescent Soap Film
    this.fillIridescentFilm(ctx);

    // 3. Draw Rainbow Perimeter Rim
    this.drawRimGlow(ctx, pts);

    // 4. Draw Warping Specular Highlights (Gloss sheen)
    this.drawSpecularHighlights(ctx);

    // 5. Draw Cute Expressive Face
    if (this.showFace) {
      this.drawFace(ctx);
    }

    // 6. High Stress Shaking / Sweat Drops
    if (this.stress > 60) {
      this.drawStressSweat(ctx);
    }

    ctx.restore();
  }

  /**
   * Draws smooth closed curve through vertices using cubic Bezier midpoints
   */
  drawSmoothContour(ctx, pts) {
    const n = pts.length;
    if (n < 3) return;

    // Start midway between last and first
    const p0 = pts[0];
    const pLast = pts[n - 1];
    ctx.moveTo((pLast.x + p0.x) / 2, (pLast.y + p0.y) / 2);

    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
    }
  }

  /**
   * Translucent iridescent soap bubble gradient
   */
  fillIridescentFilm(ctx) {
    const r = this.radius;
    const time = performance.now() * 0.001;

    // Center offset for 3D sphere illusion
    const cx = this.x - r * 0.2;
    const cy = this.y - r * 0.2;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, this.x, this.y, r * 1.15);

    switch (this.theme) {
      case 'neon':
        grad.addColorStop(0, 'rgba(0, 242, 254, 0.35)');
        grad.addColorStop(0.5, 'rgba(79, 172, 254, 0.25)');
        grad.addColorStop(0.85, 'rgba(127, 0, 255, 0.45)');
        grad.addColorStop(1, 'rgba(255, 0, 128, 0.7)');
        break;

      case 'sunset':
        grad.addColorStop(0, 'rgba(255, 236, 179, 0.45)');
        grad.addColorStop(0.4, 'rgba(255, 138, 101, 0.3)');
        grad.addColorStop(0.75, 'rgba(240, 98, 146, 0.4)');
        grad.addColorStop(1, 'rgba(123, 31, 162, 0.65)');
        break;

      case 'cosmic':
        grad.addColorStop(0, 'rgba(224, 231, 255, 0.4)');
        grad.addColorStop(0.4, 'rgba(139, 92, 246, 0.3)');
        grad.addColorStop(0.8, 'rgba(236, 72, 153, 0.4)');
        grad.addColorStop(1, 'rgba(59, 130, 246, 0.65)');
        break;

      case 'emerald':
        grad.addColorStop(0, 'rgba(209, 250, 229, 0.4)');
        grad.addColorStop(0.45, 'rgba(52, 211, 153, 0.3)');
        grad.addColorStop(0.8, 'rgba(6, 182, 212, 0.4)');
        grad.addColorStop(1, 'rgba(30, 58, 138, 0.65)');
        break;

      case 'iridescent':
      default:
        // Classic rainbow soap bubble
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(0.3, 'rgba(186, 230, 253, 0.25)');
        grad.addColorStop(0.6, 'rgba(251, 207, 232, 0.3)');
        grad.addColorStop(0.82, 'rgba(254, 240, 138, 0.35)');
        grad.addColorStop(1, 'rgba(167, 139, 250, 0.6)');
        break;
    }

    ctx.fillStyle = grad;
    ctx.fill();
  }

  /**
   * Colorful edge perimeter glow
   */
  drawRimGlow(ctx, pts) {
    const time = performance.now() * 0.0015;
    const baseHue = (time * 40) % 360;

    // Pulsing danger red if critical stress
    if (this.stress > 70) {
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 + Math.sin(time * 12) * 0.35})`;
      ctx.lineWidth = 3.5;
    } else {
      ctx.strokeStyle = `hsla(${baseHue}, 85%, 80%, 0.75)`;
      ctx.lineWidth = 2.4;
    }
    ctx.stroke();
  }

  /**
   * Curved glossy reflection highlights (warps with movement)
   */
  drawSpecularHighlights(ctx) {
    const r = this.radius;

    // Top-left primary curved crescent highlight
    ctx.save();
    ctx.translate(this.x - r * 0.42, this.y - r * 0.42);
    ctx.rotate(-Math.PI / 4.2);

    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.38, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fill();

    // Tiny secondary white glint
    ctx.beginPath();
    ctx.arc(r * 0.35, 0, r * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    ctx.restore();

    // Bottom-right subtle reflection
    ctx.save();
    ctx.translate(this.x + r * 0.38, this.y + r * 0.38);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.28, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draws the cute interactive face with dynamic reactions
   */
  drawFace(ctx) {
    const r = this.radius;
    const faceX = this.x + this.lookX * 12;
    const faceY = this.y + this.lookY * 8;
    const eyeSpacing = r * 0.34;
    const eyeRadius = Math.max(5, r * 0.095);

    ctx.save();
    ctx.translate(faceX, faceY);

    // Left and right eye centers
    const leftEyeX = -eyeSpacing;
    const rightEyeX = eyeSpacing;
    const eyeY = -r * 0.06;

    // Draw Eyes based on expression
    if (this.isBlinking) {
      // Closed blinking eyes (- -)
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(leftEyeX - eyeRadius, eyeY);
      ctx.lineTo(leftEyeX + eyeRadius, eyeY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightEyeX - eyeRadius, eyeY);
      ctx.lineTo(rightEyeX + eyeRadius, eyeY);
      ctx.stroke();
    } else if (this.expression === 'strained') {
      // Squinting eyes (> <)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';

      // Left eye >
      ctx.beginPath();
      ctx.moveTo(leftEyeX - eyeRadius, eyeY - eyeRadius * 0.8);
      ctx.lineTo(leftEyeX + eyeRadius * 0.6, eyeY);
      ctx.lineTo(leftEyeX - eyeRadius, eyeY + eyeRadius * 0.8);
      ctx.stroke();

      // Right eye <
      ctx.beginPath();
      ctx.moveTo(rightEyeX + eyeRadius, eyeY - eyeRadius * 0.8);
      ctx.lineTo(rightEyeX - eyeRadius * 0.6, eyeY);
      ctx.lineTo(rightEyeX + eyeRadius, eyeY + eyeRadius * 0.8);
      ctx.stroke();
    } else if (this.expression === 'panicking') {
      // Wide shaky spinning dizzy spirals or huge alarmed pupils!
      const shakeX = (Math.random() - 0.5) * 3;
      const shakeY = (Math.random() - 0.5) * 3;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftEyeX + shakeX, eyeY + shakeY, eyeRadius * 1.5, 0, Math.PI * 2);
      ctx.arc(rightEyeX + shakeX, eyeY + shakeY, eyeRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(leftEyeX + shakeX + this.lookX * 3, eyeY + shakeY + this.lookY * 3, eyeRadius * 0.8, 0, Math.PI * 2);
      ctx.arc(rightEyeX + shakeX + this.lookX * 3, eyeY + shakeY + this.lookY * 3, eyeRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal / Nervous / Curious open expressive eyes
      const pupilScale = this.expression === 'nervous' ? 0.7 : 1.0;

      // Eye whites
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, eyeRadius * 1.25, 0, Math.PI * 2);
      ctx.arc(rightEyeX, eyeY, eyeRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Pupils tracking cursor
      const pupilOffsetMax = eyeRadius * 0.45;
      const px = this.lookX * pupilOffsetMax;
      const py = this.lookY * pupilOffsetMax;

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(leftEyeX + px, eyeY + py, eyeRadius * 0.75 * pupilScale, 0, Math.PI * 2);
      ctx.arc(rightEyeX + px, eyeY + py, eyeRadius * 0.75 * pupilScale, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine in pupils
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftEyeX + px - 2, eyeY + py - 2, eyeRadius * 0.3, 0, Math.PI * 2);
      ctx.arc(rightEyeX + px - 2, eyeY + py - 2, eyeRadius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cute Cheeks
    ctx.fillStyle = 'rgba(255, 118, 117, 0.45)';
    ctx.beginPath();
    ctx.arc(leftEyeX - eyeRadius * 0.6, eyeY + eyeRadius * 1.4, eyeRadius * 0.8, 0, Math.PI * 2);
    ctx.arc(rightEyeX + eyeRadius * 0.6, eyeY + eyeRadius * 1.4, eyeRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Cute Mouth
    const mouthY = eyeY + eyeRadius * 1.6;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';

    if (this.expression === 'panicking') {
      // Open screaming O mouth
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.ellipse(0, mouthY + 4, eyeRadius * 0.9, eyeRadius * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.expression === 'strained') {
      // Clenched wavy mouth
      ctx.beginPath();
      ctx.moveTo(-eyeRadius * 0.8, mouthY + 2);
      ctx.quadraticCurveTo(0, mouthY - 3, eyeRadius * 0.8, mouthY + 2);
      ctx.stroke();
    } else if (this.expression === 'nervous') {
      // Trembling line mouth
      ctx.beginPath();
      ctx.moveTo(-eyeRadius * 0.8, mouthY + 1);
      ctx.lineTo(-eyeRadius * 0.2, mouthY - 2);
      ctx.lineTo(eyeRadius * 0.2, mouthY + 2);
      ctx.lineTo(eyeRadius * 0.8, mouthY);
      ctx.stroke();
    } else {
      // Cheerful happy smile
      ctx.beginPath();
      ctx.arc(0, mouthY - 2, eyeRadius * 0.9, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Sweat drops when stressed
   */
  drawStressSweat(ctx) {
    const r = this.radius;
    const time = performance.now() * 0.005;
    const dropY = -r * 0.55 + Math.sin(time) * 4;
    const dropX = r * 0.42;

    ctx.save();
    ctx.translate(this.x + dropX, this.y + dropY);

    // Cute blue water drop
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(4, 0, 4, 4);
    ctx.arc(0, 4, 4, 0, Math.PI);
    ctx.quadraticCurveTo(-4, 0, 0, -6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

window.DeformableBubble = DeformableBubble;
