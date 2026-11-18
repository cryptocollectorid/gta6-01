// The wanted system and the Bahia Verde police. Stars rise with crime and
// fall when the player stays quiet and out of sight. Police cars spawn at the
// edge of the city, chase the player, ram the car, and bust the player when
// they catch them slow. No police car ever shoots.
import * as THREE from 'three';
import { POLICE, ROADS, WANTED } from './config.js';
import { createCarMesh } from './vehicles.js';
import { pick, range } from './random.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.quietTimer = 0;
    this.decayTimer = 0;
  }

  add(amount) {
    this.stars = Math.min(WANTED.max, this.stars + amount);
    this.quietTimer = 0;
    this.decayTimer = 0;
  }

  set(amount) {
    this.stars = Math.min(WANTED.max, Math.max(0, amount));
    this.quietTimer = 0;
    this.decayTimer = 0;
  }

  clear() {
    this.stars = 0;
    this.quietTimer = 0;
    this.decayTimer = 0;
  }

  update(dt, policeNear) {
    if (this.stars === 0) return;
    this.quietTimer += dt;
    if (this.quietTimer < WANTED.quietSeconds || policeNear) return;
    this.decayTimer += dt;
    if (this.decayTimer >= WANTED.decaySeconds) {
      this.stars -= 1;
      this.decayTimer = 0;
    }
  }
}

class PoliceCar {
  constructor(scene) {
    this.mesh = createCarMesh(0x1a2a4a);
    // A light bar on the roof: the one thing that says police at a glance.
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a3a }),
    );
    bar.position.set(0, 1.45, -0.25);
    this.mesh.add(bar);
    const bar2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2a6aff }),
    );
    bar2.position.set(0.45, 1.45, -0.25);
    this.mesh.add(bar2);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.speed = 0;
    this.active = false;
    this.mesh.visible = false;
    this.flash = 0;
  }

  spawn(x, z) {
    this.pos.set(x, 0, z);
    this.heading = Math.atan2(-x, -z);
    this.speed = 10;
    this.active = true;
    this.mesh.visible = true;
  }

  despawn() {
    this.active = false;
    this.mesh.visible = false;
    this.speed = 0;
  }

  update(dt, target, colliders) {
    if (!this.active) return;
    this.flash += dt * 10;
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const maxSpeed = POLICE.maxSpeed + 2;
    this.speed = Math.min(maxSpeed, this.speed + POLICE.accel * dt);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    // Police bounce off buildings rather than clipping through them.
    for (const box of colliders) {
      const cx = Math.max(box.minX, Math.min(this.pos.x, box.maxX));
      const cz = Math.max(box.minZ, Math.min(this.pos.z, box.maxZ));
      const ddx = this.pos.x - cx;
      const ddz = this.pos.z - cz;
      if (ddx * ddx + ddz * ddz < 1.7 * 1.7) {
        this.heading += Math.PI * 0.5;
        this.speed *= 0.6;
      }
    }
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    // Flash the light bar red/blue.
    const bars = this.mesh.children.filter((c) => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 1.4);
    if (bars[0]) bars[0].material.color.setHex(Math.sin(this.flash) > 0 ? 0xff2a3a : 0x550000);
    if (bars[1]) bars[1].material.color.setHex(Math.sin(this.flash) > 0 ? 0x001155 : 0x2a6aff);
  }
}

export class Police {
  constructor(scene) {
    this.cars = [];
    for (let i = 0; i < POLICE.maxCars; i += 1) this.cars.push(new PoliceCar(scene));
    this.bustTimer = 0;
  }

  // Keep the number of active police cars in step with the wanted level.
  update(dt, target, targetSpeed, wanted, colliders, random) {
    const want = Math.min(POLICE.maxCars, wanted);
    let active = 0;
    for (const car of this.cars) if (car.active) active += 1;
    if (active < want) {
      const idle = this.cars.find((c) => !c.active);
      if (idle) {
        // Spawn on a road at the edge of the city, away from the player.
        const road = pick(random, ROADS);
        const edge = pick(random, [-190, 190]);
        if (random() < 0.5) idle.spawn(edge, road);
        else idle.spawn(road, edge);
      }
    } else if (active > want) {
      const extra = this.cars.find((c) => c.active);
      if (extra) extra.despawn();
    }
    let near = false;
    for (const car of this.cars) {
      if (!car.active) continue;
      car.update(dt, target, colliders);
      const dist = Math.hypot(car.pos.x - target.x, car.pos.z - target.z);
      if (dist < 50) near = true;
      if (dist > 260) car.despawn();
    }
    // Busted: a police car is on top of the player while they are slow.
    if (wanted > 0 && targetSpeed < POLICE.bustSpeed) {
      for (const car of this.cars) {
        if (!car.active) continue;
        const dist = Math.hypot(car.pos.x - target.x, car.pos.z - target.z);
        if (dist < POLICE.bustRadius) {
          this.bustTimer += dt;
          if (this.bustTimer >= POLICE.bustTime) {
            this.bustTimer = 0;
            return { busted: true, near };
          }
        }
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt);
    }
    return { busted: false, near };
  }

  // A police car ramming the player's car: slow the player down hard, but
  // only once per police car per moment — a ram every frame would pin the car.
  ramCheck(playerPos, playerCar) {
    for (const car of this.cars) {
      if (!car.active) continue;
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - 0.016);
      const dist = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (dist < 3.4 && car.speed > 5 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        if (playerCar) playerCar.speed *= 0.9;
        return true;
      }
    }
    return false;
  }

  clear() {
    for (const car of this.cars) car.despawn();
    this.bustTimer = 0;
  }
}
