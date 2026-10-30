/**
 * particles.js - Particle Systems
 * Handles:
 * - Floating interactive baby bubbles (spawned from repeated poking)
 * - Explosive pop debris and iridescent splash droplets
 * - Shockwave rings and comic pop text
 * - Ambient floating soap sheen motes
 */

class MiniBubble {
  constructor(x, y, vx, vy, radius = null) {
    this.x = x;
    this.y = y;
    this.vx = vx || (Math.random() - 0.5) * 3;
    this.vy = vy || -(1.5 + Math.random() * 2.5); // float up
    this.radius = radius || (8 + Math.random() * 14);
    this.baseRadius = this.radius;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.05 + Math.random() * 0.05;
    this.alpha = 0.85;
    this.life = 0;
    this.maxLife = 240 + Math.random() * 180; // frames
    this.isPopped = false;
    this.hueShift = Math.random() * 360;
  }

  update(width, height) {
    this.life++;
    this.wobblePhase += this.wobbleSpeed;

    // Physics
    this.x += this.vx + Math.sin(this.wobblePhase) * 0.6;
    this.y += this.vy;
    this.vy *= 0.99; // slight air friction
    this.vx *= 0.98;

    // Upward buoyancy
    this.vy -= 0.04;

    // Bounce off walls
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = Math.abs(this.vx) * 0.8;
    } else if (this.x + this.radius > width) {
      this.x = width - this.radius;
      this.vx = -Math.abs(this.vx) * 0.8;
    }

    // Fade near top or death
    if (this.y < -this.radius || this.life > this.maxLife) {
      this.isPopped = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const wobbleY = Math.sin(this.wobblePhase) * 0.15;
    const wobbleX = -wobbleY;
    const rx = this.radius * (1 + wobbleX);
    const ry = this.radius * (1 + wobbleY);

    // Bubble body gradient (translucent soap shine)
    const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, rx * 0.1, 0, 0, rx);
    grad.addColorStop(0, `hsla(${(this.hueShift + 60) % 360}, 90%, 95%, 0.7)`);
    grad.addColorStop(0.5, `hsla(${(this.hueShift + 180) % 360}, 80%, 75%, 0.3)`);
    grad.addColorStop(0.85, `hsla(${this.hueShift}, 85%, 65%, 0.4)`);
    grad.addColorStop(1, `hsla(${(this.hueShift + 240) % 360}, 90%, 80%, 0.8)`);

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border iridescent rim
    ctx.strokeStyle = `hsla(${this.hueShift}, 90%, 85%, 0.7)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Specular highlight
    ctx.beginPath();
    ctx.ellipse(-rx * 0.4, -ry * 0.4, rx * 0.35, ry * 0.18, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    ctx.restore();
  }

  isHit(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= (this.radius + 12) * (this.radius + 12);
  }
}

class SplashParticle {
  constructor(x, y, vx, vy, color, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size || (2 + Math.random() * 4);
    this.alpha = 1;
    this.decay = 0.02 + Math.random() * 0.03;
    this.gravity = 0.12;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.96;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ShockwaveRing {
  constructor(x, y, maxRadius = 140, color = 'rgba(165, 243, 252, 0.8)') {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxRadius = maxRadius;
    this.color = color;
    this.alpha = 0.9;
    this.isDone = false;
  }

  update() {
    this.radius += (this.maxRadius - this.radius) * 0.18 + 2;
    this.alpha *= 0.88;
    if (this.alpha < 0.02 || this.radius >= this.maxRadius) {
      this.isDone = true;
    }
  }

  draw(ctx) {
    if (this.isDone) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3.5 * this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class PopTextEffect {
  constructor(x, y, text = 'POP!') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.scale = 0.5;
    this.alpha = 1.0;
    this.isDone = false;
    this.rotation = (Math.random() - 0.5) * 0.4;
  }

  update() {
    this.scale += (1.4 - this.scale) * 0.2;
    this.y -= 0.8;
    this.alpha -= 0.025;
    if (this.alpha <= 0) {
      this.isDone = true;
    }
  }

  draw(ctx) {
    if (this.isDone) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);
    ctx.globalAlpha = Math.max(0, this.alpha);

    ctx.font = 'bold 36px Fredoka, Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glowing outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 6;
    ctx.strokeText(this.text, 0, 0);

    // Rainbow fill
    const grad = ctx.createLinearGradient(-30, -20, 30, 20);
    grad.addColorStop(0, '#ff758c');
    grad.addColorStop(0.5, '#f5af19');
    grad.addColorStop(1, '#00f2fe');
    ctx.fillStyle = grad;
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }
}

class AmbientMote {
  constructor(width, height) {
    this.reset(width, height, true);
  }

  reset(width, height, randomY = false) {
    this.x = Math.random() * width;
    this.y = randomY ? Math.random() * height : height + 10;
    this.radius = 1.5 + Math.random() * 3.5;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = -(0.3 + Math.random() * 0.7);
    this.alpha = 0.15 + Math.random() * 0.35;
    this.phase = Math.random() * Math.PI * 2;
    this.hue = Math.random() * 360;
  }

  update(width, height) {
    this.phase += 0.02;
    this.x += this.vx + Math.sin(this.phase) * 0.3;
    this.y += this.vy;

    if (this.y < -10 || this.x < -10 || this.x > width + 10) {
      this.reset(width, height, false);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = `hsla(${this.hue}, 80%, 75%, 0.8)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleManager {
  constructor() {
    this.miniBubbles = [];
    this.splashParticles = [];
    this.shockwaves = [];
    this.popTexts = [];
    this.ambientMotes = [];
    this.showAmbient = true;
  }

  initAmbient(width, height, count = 30) {
    this.ambientMotes = [];
    for (let i = 0; i < count; i++) {
      this.ambientMotes.push(new AmbientMote(width, height));
    }
  }

  spawnBabyBubble(x, y, vx, vy) {
    const bubble = new MiniBubble(x, y, vx, vy);
    this.miniBubbles.push(bubble);
    return bubble;
  }

  spawnPopBurst(x, y, radius = 100) {
    // 1. Shockwaves
    this.shockwaves.push(new ShockwaveRing(x, y, radius * 1.8, 'rgba(165, 243, 252, 0.95)'));
    this.shockwaves.push(new ShockwaveRing(x, y, radius * 2.3, 'rgba(255, 182, 193, 0.75)'));

    // 2. Comic POP text
    const popPhrases = ['POP!', 'OUCH!', 'SPLASH!', 'BOOM!', 'NOOO!'];
    const phrase = popPhrases[Math.floor(Math.random() * popPhrases.length)];
    this.popTexts.push(new PopTextEffect(x, y - 20, phrase));

    // 3. Droplets
    const dropletCount = 50 + Math.floor(Math.random() * 20);
    const colors = [
      '#a5f3fc', '#fbcfe8', '#fef08a', '#c7d2fe', '#67e8f9', '#ffffff'
    ];

    for (let i = 0; i < dropletCount; i++) {
      const angle = (Math.PI * 2 * i) / dropletCount + (Math.random() - 0.5) * 0.3;
      const speed = 3 + Math.random() * 9;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 4.5;
      this.splashParticles.push(new SplashParticle(x, y, vx, vy, color, size));
    }

    // 4. Few rogue mini baby bubbles scattered
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      this.spawnBabyBubble(
        x + Math.cos(angle) * 20,
        y + Math.sin(angle) * 20,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd - 1
      );
    }
  }

  checkMiniBubbleHit(x, y) {
    for (let i = this.miniBubbles.length - 1; i >= 0; i--) {
      const b = this.miniBubbles[i];
      if (b.isHit(x, y)) {
        b.isPopped = true;
        // Mini splash
        for (let j = 0; j < 8; j++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 3;
          this.splashParticles.push(new SplashParticle(
            b.x, b.y,
            Math.cos(ang) * spd, Math.sin(ang) * spd,
            '#e0f2fe', 2
          ));
        }
        this.shockwaves.push(new ShockwaveRing(b.x, b.y, b.radius * 2, 'rgba(255, 255, 255, 0.7)'));
        return true;
      }
    }
    return false;
  }

  update(width, height) {
    // Mini bubbles
    for (let i = this.miniBubbles.length - 1; i >= 0; i--) {
      const b = this.miniBubbles[i];
      b.update(width, height);
      if (b.isPopped) {
        this.miniBubbles.splice(i, 1);
      }
    }

    // Splash particles
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const p = this.splashParticles[i];
      p.update();
      if (p.alpha <= 0) {
        this.splashParticles.splice(i, 1);
      }
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.update();
      if (s.isDone) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Pop texts
    for (let i = this.popTexts.length - 1; i >= 0; i--) {
      const t = this.popTexts[i];
      t.update();
      if (t.isDone) {
        this.popTexts.splice(i, 1);
      }
    }

    // Ambient motes
    if (this.showAmbient) {
      for (const m of this.ambientMotes) {
        m.update(width, height);
      }
    }
  }

  draw(ctx) {
    // Ambient motes (drawn behind or in front)
    if (this.showAmbient) {
      for (const m of this.ambientMotes) {
        m.draw(ctx);
      }
    }

    // Mini bubbles
    for (const b of this.miniBubbles) {
      b.draw(ctx);
    }

    // Splash particles
    for (const p of this.splashParticles) {
      p.draw(ctx);
    }

    // Shockwaves
    for (const s of this.shockwaves) {
      s.draw(ctx);
    }

    // Pop texts
    for (const t of this.popTexts) {
      t.draw(ctx);
    }
  }

  clear() {
    this.miniBubbles = [];
    this.splashParticles = [];
    this.shockwaves = [];
    this.popTexts = [];
  }
}

window.ParticleManager = ParticleManager;

