// Pedestrians: people walking the sidewalks of Bahia Verde. They stroll along
// block edges, turn at corners, and scatter when a car comes at them. Hit one
// with a car and the city notices — that is two wanted stars.
import * as THREE from 'three';
import { PEDS, ROADS } from './config.js';
import { pick, range } from './random.js';

const SHIRTS = [0xe86a6a, 0x6aa8e8, 0x6ae88a, 0xe8d84a, 0xc86ae8, 0xe8e8e8, 0x8a6a4a, 0x4ad8d8];

function createPedMesh(shirtHex) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a880 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), dark);
  legL.position.set(-0.14, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), dark);
  legR.position.set(0.14, 0.35, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

class Pedestrian {
  constructor(scene, random) {
    this.mesh = createPedMesh(pick(random, SHIRTS));
    scene.add(this.mesh);
    this.speed = range(random, PEDS.speedMin, PEDS.speedMax);
    this.alive = true;
    this.downTimer = 0;
    this.walkPhase = range(random, 0, Math.PI * 2);
    this.respawn(random);
  }

  respawn(random) {
    // Stand on a sidewalk: just off a road, along a block edge.
    const road = pick(random, ROADS);
    const along = range(random, -180, 180);
    if (random() < 0.5) {
      this.pos = new THREE.Vector3(along, 0, road + 9.5);
      this.heading = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      this.axis = 'x';
      this.dir = this.heading === Math.PI / 2 ? 1 : -1;
    } else {
      this.pos = new THREE.Vector3(road + 9.5, 0, along);
      this.heading = random() < 0.5 ? 0 : Math.PI;
      this.axis = 'z';
      this.dir = this.heading === 0 ? 1 : -1;
    }
    this.alive = true;
    this.downTimer = 0;
    this.mesh.visible = true;
    this.mesh.rotation.set(0, this.heading, 0);
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
  }

  // A car is coming at them: run away from the road.
  fleeFrom(x, z) {
    const dx = this.pos.x - x;
    const dz = this.pos.z - z;
    const dist = Math.hypot(dx, dz) || 1;
    this.pos.x += (dx / dist) * 3;
    this.pos.z += (dz / dist) * 3;
  }

  knockDown() {
    this.alive = false;
    this.downTimer = 10;
    this.mesh.rotation.z = Math.PI / 2;
  }

  update(dt, cars, random) {
    if (!this.alive) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this.respawn(random);
      return;
    }
    this.walkPhase += dt * 6;
    const step = this.speed * dt;
    if (this.axis === 'x') this.pos.x += this.dir * step;
    else this.pos.z += this.dir * step;
    // Turn at the end of the block, or at a random corner.
    const along = this.axis === 'x' ? this.pos.x : this.pos.z;
    if (Math.abs(along) > 185 || Math.random() < 0.001) {
      this.axis = this.axis === 'x' ? 'z' : 'x';
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.heading = this.axis === 'x' ? (this.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.dir > 0 ? 0 : Math.PI);
      // Snap onto the nearest sidewalk of the new axis.
      const cross = this.axis === 'x' ? this.pos.z : this.pos.x;
      const nearest = ROADS.reduce((a, b) => (Math.abs(b - cross) < Math.abs(a - cross) ? b : a));
      if (this.axis === 'x') this.pos.z = nearest + 9.5;
      else this.pos.x = nearest + 9.5;
    }
    for (const car of cars) {
      if (!car.active) continue;
      const dist = Math.hypot(car.pos.x - this.pos.x, car.pos.z - this.pos.z);
      if (dist < 6) this.fleeFrom(car.pos.x, car.pos.z);
    }
    this.sync();
  }
}

export function createPedestrians(scene, random) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) peds.push(new Pedestrian(scene, random));
  return peds;
}
