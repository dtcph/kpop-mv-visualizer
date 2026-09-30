// Screen 1: one physics ball per year (Matter.js rigid bodies + a custom
// center force field + mouse-push interaction). Canvas-rendered.

import { clamp, lerp, easeOutCubic, makeYearColorScale, makeRadiusScale, makeGlowSprite, colorWithAlpha } from './utils.js';

const { Engine, Bodies, Body, World, Query } = Matter;

export class YearView {
  constructor(config) {
    this.config = config;
    this.width = 0;
    this.height = 0;
    this.balls = []; // { year, count, videos, body, radius, color, sprite, opacity, scale }
    this.hovered = null;
    this.pointer = { x: -9999, y: -9999, vx: 0, vy: 0, lastX: -9999, lastY: -9999, down: false, downX: 0, downY: 0, moved: false };
    this.selecting = null; // { ball, t0, from:{x,y,r}, to:{x,y,r} }
    this.onSelectYear = null; // callback(yearData) set by main.js

    this.engine = Engine.create();
    this.engine.gravity.x = 0;
    this.engine.gravity.y = 0;
    this.engine.gravity.scale = 0;
    this.engine.positionIterations = 12;
    this.engine.velocityIterations = 10;
  }

  // (Re)builds bodies from year data. Called once at startup and every time
  // we return from the video view so balls "re-appear" and settle fresh.
  setData(years) {
    this.years = years;
    this.counts = years.map((y) => y.count);
    this.colorScale = makeYearColorScale(years[0].year, years[years.length - 1].year);
    this.radiusScale = makeRadiusScale(this.counts, this.config.minBallRadius, this.config.maxBallRadius);
    this._rebuildBodies();
  }

  _rebuildBodies() {
    World.clear(this.engine.world, false);
    this.balls = [];
    const cx = this.width / 2;
    const cy = this.height / 2;
    const spawnR = Math.min(this.width, this.height) * 0.42;

    for (const y of this.years) {
      const radius = this.radiusScale(y.count);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spawnR;
      const x = cx + Math.cos(angle) * dist;
      const yPos = cy + Math.sin(angle) * dist;
      const color = this.colorScale(y.year);

      const body = Bodies.circle(x, yPos, radius, {
        restitution: this.config.ballRestitution,
        frictionAir: this.config.ballFrictionAir,
        friction: 0,
        density: 0.001,
      });
      World.add(this.engine.world, body);

      this.balls.push({
        year: y.year,
        count: y.count,
        videos: y.videos,
        body,
        radius,
        color,
        sprite: makeGlowSprite(color, radius),
        opacity: 1,
        scale: 1,
      });
    }
    this.selecting = null;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.balls.length) this._rescaleBalls();
  }

  // Recomputes radii from the (possibly changed) responsive config without
  // discarding physics state, and re-centers the target force.
  _rescaleBalls() {
    this.radiusScale = makeRadiusScale(this.counts, this.config.minBallRadius, this.config.maxBallRadius);
    for (const b of this.balls) {
      const newRadius = this.radiusScale(b.count);
      const factor = newRadius / b.radius;
      if (Number.isFinite(factor) && factor > 0) {
        Body.scale(b.body, factor, factor);
      }
      b.radius = newRadius;
      b.sprite = makeGlowSprite(b.color, newRadius);
    }
  }

  // --- pointer handling -----------------------------------------------

  handleMouseMove(x, y) {
    const p = this.pointer;
    if (p.lastX > -9000) {
      const rawVx = x - p.lastX;
      const rawVy = y - p.lastY;
      p.vx = lerp(p.vx, rawVx, 0.35);
      p.vy = lerp(p.vy, rawVy, 0.35);
    }
    p.lastX = x;
    p.lastY = y;
    p.x = x;
    p.y = y;
    if (p.down && !p.moved) {
      if (Math.hypot(x - p.downX, y - p.downY) > 6) p.moved = true;
    }
  }

  handleMouseDown(x, y) {
    this.pointer.down = true;
    this.pointer.moved = false;
    this.pointer.downX = x;
    this.pointer.downY = y;
  }

  handleMouseUp(x, y) {
    this.pointer.down = false;
    if (!this.pointer.moved && !this.selecting) {
      const ball = this._ballAt(x, y);
      if (ball) this._selectYear(ball);
    }
  }

  handleMouseLeave() {
    this.pointer.x = -9999;
    this.pointer.y = -9999;
    this.pointer.lastX = -9999;
    this.pointer.lastY = -9999;
    this.pointer.vx = 0;
    this.pointer.vy = 0;
  }

  _ballAt(x, y) {
    for (const b of this.balls) {
      const dx = x - b.body.position.x;
      const dy = y - b.body.position.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) return b;
    }
    return null;
  }

  _selectYear(ball) {
    this.selecting = {
      ball,
      t0: performance.now(),
      from: { x: ball.body.position.x, y: ball.body.position.y, r: ball.radius },
      to: { x: this.width / 2, y: this.height / 2, r: this.config.hubRadius },
    };
  }

  // --- simulation update ------------------------------------------------

  update(dtMs) {
    if (this.selecting) {
      this._updateSelecting();
      return;
    }

    this._applyCenterForce();
    this._applyMousePush();

    const clampedDt = clamp(dtMs, 4, 32);
    Engine.update(this.engine, clampedDt);

    // hover detection (slow hover = highlight only)
    this.hovered = this._ballAt(this.pointer.x, this.pointer.y);
  }

  _applyCenterForce() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const k = this.config.centerForceStrength;
    for (const b of this.balls) {
      const dx = cx - b.body.position.x;
      const dy = cy - b.body.position.y;
      Body.applyForce(b.body, b.body.position, {
        x: dx * k * b.body.mass,
        y: dy * k * b.body.mass,
      });
    }
  }

  _applyMousePush() {
    const p = this.pointer;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed < this.config.pushSpeedThreshold) return;
    const ball = this._ballAt(p.x, p.y);
    if (!ball) return;

    const dirX = p.vx / speed;
    const dirY = p.vy / speed;
    const magnitude = Math.min(speed * this.config.pushScale, this.config.pushMaxImpulse);
    Body.setVelocity(ball.body, {
      x: ball.body.velocity.x + dirX * magnitude,
      y: ball.body.velocity.y + dirY * magnitude,
    });
  }

  _updateSelecting() {
    const s = this.selecting;
    const t = clamp((performance.now() - s.t0) / this.config.selectTransitionMs, 0, 1);
    const e = easeOutCubic(t);

    s.ball.body.position.x = lerp(s.from.x, s.to.x, e);
    s.ball.body.position.y = lerp(s.from.y, s.to.y, e);
    s.ball.scale = lerp(1, s.to.r / s.from.r, e);

    for (const b of this.balls) {
      if (b === s.ball) continue;
      b.opacity = 1 - e;
      b.scale = lerp(1, 0.3, e);
    }

    if (t >= 1 && this.onSelectYear) {
      const ball = s.ball;
      this.selecting = null;
      this.onSelectYear({ year: ball.year, count: ball.count, videos: ball.videos, color: ball.color });
    }
  }

  // --- rendering ----------------------------------------------------

  render(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    // draw biggest first so smaller balls (and their labels) stay visible on top
    const drawOrder = this.selecting ? this.balls : [...this.balls].sort((a, b) => b.radius - a.radius);
    for (const b of drawOrder) {
      if (b.opacity <= 0.01) continue;
      const r = b.radius * b.scale;
      const drawSize = b.sprite.size * (r / b.radius);

      ctx.globalAlpha = b.opacity;
      ctx.drawImage(
        b.sprite.canvas,
        b.body.position.x - drawSize / 2,
        b.body.position.y - drawSize / 2,
        drawSize,
        drawSize
      );

      if (b === this.hovered && !this.selecting) {
        ctx.globalAlpha = b.opacity * 0.9;
        ctx.lineWidth = 2;
        ctx.strokeStyle = colorWithAlpha('#ffffff', 0.8);
        ctx.beginPath();
        ctx.arc(b.body.position.x, b.body.position.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = b.opacity;
      this._drawLabel(ctx, b, r);
    }
    ctx.globalAlpha = 1;
  }

  _drawLabel(ctx, b, r) {
    const yearSize = clamp(r * 0.42, 9, 34);
    const countSize = clamp(r * 0.22, 7, 15);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#06060a';
    ctx.font = `800 ${yearSize}px Unbounded, sans-serif`;
    ctx.fillText(String(b.year), b.body.position.x, b.body.position.y - countSize * 0.6);
    ctx.font = `500 ${countSize}px Inter, sans-serif`;
    ctx.fillText(`${b.count} videos`, b.body.position.x, b.body.position.y + yearSize * 0.55);
  }

  // cursor state for main.js to apply to the canvas element
  cursorStyle() {
    if (this.selecting) return 'default';
    return this.hovered ? 'pointer' : 'default';
  }
}
