// Screen 2: hub-and-spoke spring layout of every video in the selected year.
// d3-force simulation, driven manually (not its internal timer) so we can
// pause it while inactive. Canvas-rendered, quadtree-based hit testing.

import { clamp, hashColor } from './utils.js';
import { canvasFont, formatYear, formatCount } from './i18n.js';
import { showTooltip, hideTooltip } from './tooltip.js';

// Pulls nodes toward the centroid of their own artist group each tick, so
// videos from the same group drift together and settle in the same area.
function forceCluster(nodes, strength) {
  return (alpha) => {
    const centroids = new Map();
    for (const n of nodes) {
      if (n.isHub) continue;
      let c = centroids.get(n.clusterKey);
      if (!c) {
        c = { x: 0, y: 0, count: 0 };
        centroids.set(n.clusterKey, c);
      }
      c.x += n.x;
      c.y += n.y;
      c.count++;
    }
    for (const c of centroids.values()) {
      c.x /= c.count;
      c.y /= c.count;
    }
    for (const n of nodes) {
      if (n.isHub) continue;
      const c = centroids.get(n.clusterKey);
      n.vx -= (n.x - c.x) * strength * alpha;
      n.vy -= (n.y - c.y) * strength * alpha;
    }
  };
}

export class VideoView {
  constructor(config) {
    this.config = config;
    this.width = 0;
    this.height = 0;
    this.nodes = [];
    this.links = [];
    this.hub = null;
    this.hovered = null;
    this.pointer = { x: -9999, y: -9999, down: false, downX: 0, downY: 0 };
    this.simulation = null;
    this.entryT0 = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (!this.hub) return;

    const c = this.config;
    this.hub.x = this.hub.fx = width / 2;
    this.hub.y = this.hub.fy = height / 2;
    this.hub.radius = c.hubRadius;
    for (const n of this.nodes) n.radius = c.nodeRadius;

    if (this.simulation) {
      this.simulation
        .force('link')
        .distance(c.linkDistance);
      this.simulation.force('collide', d3.forceCollide((d) => d.radius + c.collidePadding));
      this.simulation.force('x', d3.forceX(width / 2).strength(0.02));
      this.simulation.force('y', d3.forceY(height / 2).strength(0.02));
      this.simulation.alpha(Math.max(this.simulation.alpha(), 0.3));
    }
  }

  setYear(yearData) {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const c = this.config;

    this.hub = {
      id: 'hub',
      isHub: true,
      x: cx,
      y: cy,
      fx: cx,
      fy: cy,
      radius: c.hubRadius,
      year: yearData.year,
      count: yearData.count,
      color: yearData.color,
    };

    // Group videos by artist so nodes from the same group get a shared
    // color and an initial position in the same area of the layout.
    const artists = Array.from(new Set(yearData.videos.map((v) => v.artist)));
    const artistAngle = new Map(artists.map((a, i) => [a, (i / artists.length) * Math.PI * 2]));
    const artistColor = new Map(artists.map((a) => [a, hashColor(a)]));

    this.nodes = yearData.videos.map((v, i) => {
      const angle = artistAngle.get(v.artist) + (Math.random() - 0.5) * 0.4;
      const r = 4 + Math.random() * 10;
      return {
        id: i,
        video: v,
        isHub: false,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        radius: c.nodeRadius,
        color: artistColor.get(v.artist),
        clusterKey: v.artist,
      };
    });

    this.links = this.nodes.map((n) => ({ source: this.hub, target: n }));

    const allNodes = [this.hub, ...this.nodes];

    this.simulation = d3
      .forceSimulation(allNodes)
      .alphaDecay(c.videoAlphaDecay)
      .velocityDecay(c.videoVelocityDecay)
      .force(
        'link',
        d3.forceLink(this.links).distance(c.linkDistance).strength(c.linkStrength)
      )
      .force('charge', d3.forceManyBody().strength(-c.chargeStrength).theta(0.85))
      .force('collide', d3.forceCollide((d) => d.radius + c.collidePadding))
      .force('x', d3.forceX(cx).strength(0.02))
      .force('y', d3.forceY(cy).strength(0.02))
      .force('cluster', forceCluster(allNodes, c.clusterStrength))
      .stop();

    this.simulation.alpha(1);
    this.hovered = null;
    hideTooltip();
  }

  // --- pointer handling -----------------------------------------------

  handleMouseMove(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  handleMouseDown(x, y) {
    this.pointer.down = true;
    this.pointer.downX = x;
    this.pointer.downY = y;
  }

  handleMouseUp(x, y) {
    this.pointer.down = false;
    const target = this.hovered;
    if (target && !target.isHub && target.video.hasLink) {
      window.open(target.video.link, '_blank', 'noopener');
    }
  }

  handleMouseLeave() {
    this.pointer.x = -9999;
    this.pointer.y = -9999;
    this.hovered = null;
    hideTooltip();
  }

  // --- simulation update ------------------------------------------------

  update() {
    if (!this.simulation) return;
    if (this.simulation.alpha() > this.simulation.alphaMin()) {
      this.simulation.tick();
    }

    // Hit-test once per frame using the simulation's internal quadtree
    // (built each tick by the many-body force) instead of scanning nodes.
    const found = this.simulation.find(this.pointer.x, this.pointer.y, this.config.nodeRadius + 6);
    if (found !== this.hovered) {
      this.hovered = found;
      if (found && !found.isHub) {
        showTooltip(found.video, this.pointer.x, this.pointer.y);
      } else {
        hideTooltip();
      }
    } else if (found && !found.isHub) {
      showTooltip(found.video, this.pointer.x, this.pointer.y);
    }
  }

  // --- rendering ----------------------------------------------------

  render(ctx) {
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(155, 91, 255, 0.18)';
    ctx.beginPath();
    for (const l of this.links) {
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
    }
    ctx.stroke();

    for (const n of this.nodes) {
      const isHover = n === this.hovered;
      const r = n.radius * (isHover ? 1.35 : 1);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.video.hasLink ? n.color : 'rgba(138, 138, 160, 0.6)';
      ctx.fill();
      if (isHover) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    // hub, flat-filled in the same color as the year ball it was opened from
    ctx.beginPath();
    ctx.arc(this.hub.x, this.hub.y, this.hub.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.hub.color;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#06060a';
    ctx.font = canvasFont('display', 800, clamp(this.hub.radius * 0.5, 14, 30));
    ctx.fillText(formatYear(this.hub.year), this.hub.x, this.hub.y - this.hub.radius * 0.18);
    ctx.font = canvasFont('body', 500, clamp(this.hub.radius * 0.22, 10, 15));
    ctx.fillText(formatCount(this.hub.count), this.hub.x, this.hub.y + this.hub.radius * 0.32);
  }

  cursorStyle() {
    if (!this.hovered) return 'default';
    if (this.hovered.isHub) return 'default';
    return this.hovered.video.hasLink ? 'pointer' : 'default';
  }
}
