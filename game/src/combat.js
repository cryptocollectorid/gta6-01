// Combat on foot: the pistol and the fists, and the Venn thugs who come for
// the player in Job 4. Thugs walk at the player and swing when close; the
// player punches (F) or shoots (click) — a shot is a hitscan check against
// the nearest thug inside the camera's cone.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { pick } from './random.js';

const THUG_SHIRTS = [0x8a2a2a, 0x5a2a8a, 0x2a4a8a];

function createThugMesh(shirtHex) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc89070 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirt);
  torso.position.y = 1.1;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), dark);
  legL.position.set(-0.17, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), dark);
  legR.position.set(0.17, 0.38, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), shirt);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), shirt);
  armR.position.set(0.48, 1.15, 0);
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armR = armR;
  return group;
}

class Thug {
  constructor(scene, x, z, random) {
    this.mesh = createThugMesh(pick(random, THUG_SHIRTS));
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.health = 100;
    this.alive = true;
    this.speed = 3.4;
    this.attackCooldown = 0;
    this.walkPhase = 0;
    this.sync();
  }

  sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    const swing = Math.sin(this.walkPhase) * 0.45;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      this.mesh.rotation.z = Math.PI / 2;
      this.mesh.position.y = 0.3;
    }
    return !this.alive;
  }

  update(dt, playerPos) {
    if (!this.alive) return 0;
    this.attackCooldown -= dt;
    this.walkPhase += dt * 7;
    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    let damage = 0;
    if (dist > 1.9) {
      this.pos.x += (dx / dist) * this.speed * dt;
      this.pos.z += (dz / dist) * this.speed * dt;
    } else if (this.attackCooldown <= 0) {
      this.attackCooldown = 1.0;
      this.mesh.userData.armR.rotation.x = -1.6;
      damage = 8;
      window.setTimeout(() => { this.mesh.userData.armR.rotation.x = 0; }, 180);
    }
    this.sync();
    return damage;
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.thugs = [];
    this.thugsDown = 0;
    this.punchCooldown = 0;
  }

  spawnThugs(pos, count, random) {
    this.clear();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      this.thugs.push(new Thug(this.scene, pos.x + Math.cos(angle) * 6, pos.z + Math.sin(angle) * 6, random));
    }
    this.thugsDown = 0;
  }

  clear() {
    for (const thug of this.thugs) thug.dispose(this.scene);
    this.thugs = [];
    this.thugsDown = 0;
  }

  // actions: { punch, shoot, cameraDir:{x,z}, playerPos, ammo }
  // Returns { damageToPlayer, ammoUsed, thugDown, hit }.
  update(dt, actions) {
    const result = { damageToPlayer: 0, ammoUsed: 0, thugDown: 0, hit: false };
    this.punchCooldown -= dt;
    for (const thug of this.thugs) {
      if (thug.alive) result.damageToPlayer += thug.update(dt, actions.playerPos);
    }
    if (actions.punch && this.punchCooldown <= 0) {
      this.punchCooldown = PLAYER.punchCooldown;
      for (const thug of this.thugs) {
        if (!thug.alive) continue;
        const dx = thug.pos.x - actions.playerPos.x;
        const dz = thug.pos.z - actions.playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > PLAYER.punchRange) continue;
        const angle = Math.atan2(dx, dz);
        const facing = Math.atan2(actions.cameraDir.x, actions.cameraDir.z);
        let diff = angle - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < PLAYER.punchArc) {
          result.hit = true;
          if (thug.damage(PLAYER.punchDamage)) {
            this.thugsDown += 1;
            result.thugDown += 1;
          }
          break;
        }
      }
    }
    if (actions.shoot && actions.ammo > 0) {
      result.ammoUsed = 1;
      let best = null;
      let bestScore = Infinity;
      for (const thug of this.thugs) {
        if (!thug.alive) continue;
        const dx = thug.pos.x - actions.playerPos.x;
        const dz = thug.pos.z - actions.playerPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > PLAYER.shootRange) continue;
        const angle = Math.atan2(dx, dz);
        const facing = Math.atan2(actions.cameraDir.x, actions.cameraDir.z);
        let diff = angle - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const score = Math.abs(diff) * 10 + dist * 0.01;
        if (Math.abs(diff) < PLAYER.shootCone && score < bestScore) {
          best = thug;
          bestScore = score;
        }
      }
      if (best) {
        result.hit = true;
        if (best.damage(PLAYER.shootDamage)) {
          this.thugsDown += 1;
          result.thugDown += 1;
        }
      }
    }
    return result;
  }
}
