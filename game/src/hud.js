// The HUD: DOM readouts (cash, wanted stars, health, speed, objective, toasts,
// crosshair) plus a live minimap drawn on a 2D canvas — roads, buildings,
// the player arrow, cars, police and the mission target.
import { WORLD } from './config.js';

export function createHud(doc) {
  const cashEl = doc.getElementById('cash');
  const objectiveEl = doc.getElementById('objective');
  const starsEl = doc.getElementById('stars');
  const healthFill = doc.getElementById('health-fill');
  const speedEl = doc.getElementById('speed');
  const toastEl = doc.getElementById('toast');
  const hintEl = doc.getElementById('hint');
  const crosshairEl = doc.getElementById('crosshair');
  const minimap = doc.getElementById('minimap');
  const mctx = minimap.getContext('2d');
  let toastTimer = null;

  const SIZE = 180;
  const scale = SIZE / (WORLD.half * 2);
  function mapX(x) { return (x + WORLD.half) * scale; }
  function mapZ(z) { return (z + WORLD.half) * scale; }

  return {
    setCash(cash) {
      cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
    },
    setStars(stars) {
      starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      starsEl.classList.toggle('hot', stars > 0);
    },
    setHealth(health) {
      healthFill.style.width = `${Math.max(0, Math.min(100, health))}%`;
      healthFill.classList.toggle('low', health < 30);
    },
    setSpeed(speedKmh, inCar) {
      speedEl.textContent = inCar ? `${Math.round(Math.abs(speedKmh))} km/h` : '';
    },
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    setHint(text) {
      hintEl.textContent = text;
    },
    showCrosshair(show) {
      crosshairEl.style.display = show ? 'block' : 'none';
    },
    toast(message, seconds = 3) {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), seconds * 1000);
    },
    drawMinimap(state) {
      const { layout, player, cars, police, target } = state;
      mctx.clearRect(0, 0, SIZE, SIZE);
      mctx.fillStyle = '#20242c';
      mctx.fillRect(0, 0, SIZE, SIZE);
      // Ocean strip at the bottom (south).
      mctx.fillStyle = '#2f7fb8';
      mctx.fillRect(0, mapZ(WORLD.beachZ), SIZE, SIZE - mapZ(WORLD.beachZ));
      mctx.fillStyle = '#e6cf9e';
      mctx.fillRect(0, mapZ(WORLD.beachZ) - 3, SIZE, 3);
      // Roads.
      mctx.strokeStyle = '#4a505c';
      mctx.lineWidth = 4;
      for (const road of layout.roads) {
        mctx.beginPath();
        mctx.moveTo(0, mapZ(road));
        mctx.lineTo(SIZE, mapZ(road));
        mctx.stroke();
        mctx.beginPath();
        mctx.moveTo(mapX(road), 0);
        mctx.lineTo(mapX(road), SIZE);
        mctx.stroke();
      }
      // Buildings.
      mctx.fillStyle = '#6a707c';
      for (const b of layout.buildings) {
        mctx.fillRect(mapX(b.x - b.w / 2), mapZ(b.z - b.d / 2), b.w * scale, b.d * scale);
      }
      // Mission target.
      if (target) {
        const tx = mapX(target.x);
        const tz = mapZ(target.z);
        mctx.fillStyle = '#ffd24a';
        mctx.beginPath();
        mctx.moveTo(tx, tz - 7);
        mctx.lineTo(tx + 6, tz);
        mctx.lineTo(tx, tz + 7);
        mctx.lineTo(tx - 6, tz);
        mctx.closePath();
        mctx.fill();
      }
      // Traffic cars.
      mctx.fillStyle = '#c8c8c8';
      for (const car of cars) {
        if (!car.active) continue;
        mctx.fillRect(mapX(car.pos.x) - 1.5, mapZ(car.pos.z) - 1.5, 3, 3);
      }
      // Police.
      for (const car of police) {
        if (!car.active) continue;
        mctx.fillStyle = '#ff3a4a';
        mctx.beginPath();
        mctx.arc(mapX(car.pos.x), mapZ(car.pos.z), 3, 0, Math.PI * 2);
        mctx.fill();
      }
      // Player arrow.
      const px = mapX(player.x);
      const pz = mapZ(player.z);
      mctx.save();
      mctx.translate(px, pz);
      mctx.rotate(player.heading);
      mctx.fillStyle = '#ffffff';
      mctx.beginPath();
      mctx.moveTo(0, -6);
      mctx.lineTo(4.5, 5);
      mctx.lineTo(-4.5, 5);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
    },
  };
}
