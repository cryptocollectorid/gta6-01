// Cars: one mesh factory (body, cabin, wheels, lights) and two drivers —
// the player's arcade car and the traffic that fills the roads. Traffic
// follows the road grid, turns at intersections and queues behind the car
// ahead; the player car is a simple arcade model with handbrake drift.
import * as THREE from 'three';
import { CAR, ROADS, TRAFFIC, WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';

const TRAFFIC_COLORS = [0xc8c8c8, 0x3a6ab8, 0xb83a3a, 0x3a8a5a, 0xe8d84a, 0x8a5ab8, 0xd8d8d8, 0x2a2d33];

export function createCarMesh(colorHex) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x14161a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.08, -0.25);
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.5), paint);
  nose.position.set(0, 0.45, 2.3);
  group.add(nose);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyre);
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const head = new THREE.MeshBasicMaterial({ color: 0xfff2b8 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), head);
    lamp.position.set(x, 0.55, 2.56);
    group.add(lamp);
  }
  const tail = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), tail);
    lamp.position.set(x, 0.55, -2.24);
    group.add(lamp);
  }
  group.userData.wheels = wheels;
  return group;
}

// Circle (x,z,r) against the city's building boxes. Returns the push-out.
export function collideCircle(pos, radius, colliders) {
  let pushed = false;
  for (const box of colliders) {
    const cx = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    pushed = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = cx + (dx / dist) * radius;
      pos.z = cz + (dz / dist) * radius;
    } else {
      // Centre inside the box: push out along the smallest overlap.
      const left = pos.x - box.minX;
      const right = box.maxX - pos.x;
      const top = pos.z - box.minZ;
      const bottom = box.maxZ - pos.z;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = box.minX - radius;
      else if (min === right) pos.x = box.maxX + radius;
      else if (min === top) pos.z = box.minZ - radius;
      else pos.z = box.maxZ + radius;
    }
  }
  return pushed;
}

export function clampToWorld(pos, margin) {
  const limit = WORLD.half - margin;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}

export class PlayerCar {
  constructor(scene, colorHex) {
    this.mesh = createCarMesh(colorHex);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 0, -30);
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.active = false; // the player is inside when true
  }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.06;
    for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
  }

  // move: {forward, strafe} from input; handbrake: boolean.
  update(dt, move, handbrake, colliders, otherCars) {
    const forward = move.forward;
    if (forward > 0) this.speed += CAR.accel * dt;
    else if (forward < 0) {
      this.speed += this.speed > 0.5 ? -CAR.brake * dt : -CAR.reverseAccel * dt;
    } else {
      this.speed -= Math.sign(this.speed) * CAR.drag * 2.4 * dt;
      if (Math.abs(this.speed) < 0.4) this.speed = 0;
    }
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    const speedRatio = Math.min(1, Math.abs(this.speed) / 14);
    const targetSteer = move.strafe * (this.speed >= 0 ? 1 : -1);
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
    let turn = CAR.turnRate * this.steer * speedRatio;
    if (handbrake) {
      turn *= 1.6;
      this.speed *= Math.max(0, 1 - 0.9 * dt);
    }
    this.heading += turn * dt;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x = nx;
    this.pos.z = nz;
    if (collideCircle(this.pos, CAR.radius, colliders)) {
      this.speed *= 0.45;
      this.sync();
      return { crashed: true, impact: Math.abs(this.speed) };
    }
    for (const other of otherCars) {
      if (!other.active) continue;
      const dx = this.pos.x - other.pos.x;
      const dz = this.pos.z - other.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < CAR.radius * 2 && dist > 0.01) {
        const push = (CAR.radius * 2 - dist) / 2;
        this.pos.x += (dx / dist) * push;
        this.pos.z += (dz / dist) * push;
        this.speed *= 0.8;
        return { crashed: true, impact: Math.abs(this.speed), hitCar: other };
      }
    }
    clampToWorld(this.pos, 4);
    this.sync();
    return { crashed: false };
  }
}

class TrafficCar {
  constructor(scene, random, colliders) {
    this.mesh = createCarMesh(pick(random, TRAFFIC_COLORS));
    scene.add(this.mesh);
    this.colliders = colliders;
    this.active = true;
    this.speed = range(random, TRAFFIC.speedMin, TRAFFIC.speedMax);
    this.currentSpeed = this.speed;
    this.axis = random() < 0.5 ? 'x' : 'z';
    this.dir = random() < 0.5 ? 1 : -1;
    this.road = pick(random, ROADS);
    this.lane = (random() < 0.5 ? -1 : 1) * 3.5;
    if (this.axis === 'x') {
      this.pos = new THREE.Vector3(range(random, -190, 190), 0, this.road + this.lane);
    } else {
      this.pos = new THREE.Vector3(this.road + this.lane, 0, range(random, -190, 190));
    }
    this.heading = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }

  update(dt, carsAhead) {
    // Slow down for the car ahead in the same lane; speed up when something
    // fast is right behind — traffic gets out of the way instead of letting
    // the player pin itself to its bumper.
    let targetSpeed = this.speed;
    for (const other of carsAhead) {
      if (other === this || !other.active) continue;
      const dx = other.pos.x - this.pos.x;
      const dz = other.pos.z - this.pos.z;
      const ahead = this.axis === 'x' ? dx * this.dir : dz * this.dir;
      const lateral = this.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 9 && lateral < 3) targetSpeed = 0;
      if (ahead < 0 && ahead > -8 && lateral < 3 && other.speed > this.currentSpeed) targetSpeed = Math.max(targetSpeed, 17);
    }
    if (targetSpeed === 0) this.currentSpeed = Math.max(0, this.currentSpeed - 22 * dt);
    else this.currentSpeed += (targetSpeed - this.currentSpeed) * Math.min(1, dt * 2);
    const step = this.currentSpeed * dt;
    if (this.axis === 'x') this.pos.x += this.dir * step;
    else this.pos.z += this.dir * step;
    // At an intersection, sometimes turn onto the crossing road.
    const along = this.axis === 'x' ? this.pos.x : this.pos.z;
    const nearRoad = ROADS.some((r) => Math.abs(along - r) < 1.2);
    if (nearRoad && Math.random() < 0.004) {
      this.axis = this.axis === 'x' ? 'z' : 'x';
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.lane = (Math.random() < 0.5 ? -1 : 1) * 3.5;
      const cross = this.axis === 'x' ? this.pos.z : this.pos.x;
      const nearest = ROADS.reduce((a, b) => (Math.abs(b - cross) < Math.abs(a - cross) ? b : a));
      if (this.axis === 'x') this.pos.z = nearest + this.lane;
      else this.pos.x = nearest + this.lane;
      this.heading = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    }
    // Wrap around the far edge so traffic never runs out.
    if (this.pos.x > 205) this.pos.x = -205;
    if (this.pos.x < -205) this.pos.x = 205;
    if (this.pos.z > 205) this.pos.z = -205;
    if (this.pos.z < -205) this.pos.z = 205;
    this.sync();
  }

  // The player steals this car: it stops and becomes the player's.
  steal() {
    this.active = false;
    this.mesh.visible = false;
    return { x: this.pos.x, z: this.pos.z, heading: this.heading };
  }

  respawn(random) {
    this.active = true;
    this.mesh.visible = true;
    this.axis = random() < 0.5 ? 'x' : 'z';
    this.dir = random() < 0.5 ? 1 : -1;
    this.road = pick(random, ROADS);
    this.lane = (random() < 0.5 ? -1 : 1) * 3.5;
    if (this.axis === 'x') this.pos.set(range(random, -190, 190), 0, this.road + this.lane);
    else this.pos.set(this.road + this.lane, 0, range(random, -190, 190));
    this.heading = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
    this.sync();
  }
}

export function createTraffic(scene, random, colliders) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) cars.push(new TrafficCar(scene, random, colliders));
  // Parked cars along the kerb, free to take without heat.
  const parked = [];
  for (let i = 0; i < TRAFFIC.parked; i += 1) {
    const car = new TrafficCar(scene, random, colliders);
    car.speed = 0;
    const road = pick(random, ROADS);
    if (random() < 0.5) car.pos.set(range(random, -180, 180), 0, road + 6.2);
    else car.pos.set(road + 6.2, 0, range(random, -180, 180));
    car.heading = random() < 0.5 ? 0 : Math.PI / 2;
    car.sync();
    parked.push(car);
  }
  return { moving: cars, parked };
}
