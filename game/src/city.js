// Bahia Verde itself: a sun-soaked port city on a road grid, built once from
// a seed. Ground is one canvas texture (roads, sidewalks, crosswalks, parks,
// beach); buildings, palms and lamps are instanced meshes so the whole city
// costs a handful of draw calls; landmarks are distinct buildings the missions
// point at. Exports the collision boxes and the layout the minimap draws.
import * as THREE from 'three';
import { ROADS, WORLD, PLACES } from './config.js';
import { pick, range, rangeInt } from './random.js';

const BUILDING_COLORS = [0xe8b48c, 0xd98a7a, 0xf2d8a0, 0xa8c8d8, 0xc9a0c8, 0xf0e6d2, 0x9fc8a8, 0xe8a0a0];
const LANDMARK_COLORS = {
  garage: 0xd96a3b,
  cafe: 0xe8c84a,
  safehouse: 0x7a9e7e,
  bank: 0xb8a88a,
  alley: 0x8a7a9e,
  hospital: 0xe8e8e8,
};

// Canvas y for a world z: the ground plane's texture top (v=1) sits at -z.
function canvasY(z) {
  return ((z + WORLD.half) / (WORLD.half * 2)) * 1024;
}
function canvasX(x) {
  return ((x + WORLD.half) / (WORLD.half * 2)) * 1024;
}

function groundTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const g = canvas.getContext('2d');
  // Sidewalk base.
  g.fillStyle = '#b3a98f';
  g.fillRect(0, 0, 1024, 1024);
  // Beach sand along the south edge.
  g.fillStyle = '#e6cf9e';
  g.fillRect(0, canvasY(WORLD.beachZ), 1024, 1024 - canvasY(WORLD.beachZ));
  // Roads: dark asphalt bands on every centreline.
  const halfRoad = (WORLD.roadWidth / 2 / (WORLD.half * 2)) * 1024;
  g.fillStyle = '#33373d';
  for (const road of ROADS) {
    g.fillRect(0, canvasY(road) - halfRoad, 1024, halfRoad * 2);
    g.fillRect(canvasX(road) - halfRoad, 0, halfRoad * 2, 1024);
  }
  // Centre dashes.
  g.fillStyle = '#e8c84a';
  for (const road of ROADS) {
    for (let t = -WORLD.half + 8; t < WORLD.half; t += 16) {
      g.fillRect(canvasX(t), canvasY(road) - 1.5, 10, 3);
      g.fillRect(canvasX(road) - 1.5, canvasY(t), 3, 10);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = '#e8e8e8';
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (let i = -3; i <= 3; i += 1) {
        g.fillRect(canvasX(rx + i * 2.4) - 1.4, canvasY(rz) - halfRoad + 1, 2.8, 3);
        g.fillRect(canvasX(rx + i * 2.4) - 1.4, canvasY(rz) + halfRoad - 4, 2.8, 3);
      }
    }
  }
  // A few blocks are parks: soft green lots with a path.
  g.fillStyle = '#7fae6a';
  for (let i = 0; i < 6; i += 1) {
    const bx = pick(random, [-150, -90, -30, 30, 90, 150]);
    const bz = pick(random, [-150, -90, -30, 30, 90, 150]);
    g.fillRect(canvasX(bx - 20), canvasY(bz - 20), 98, 98);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f5efe0';
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 14; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = Math.random() < 0.35;
      g.fillStyle = lit ? '#ffd98a' : '#3a4a5a';
      g.fillRect(8 + col * 20, 8 + row * 18, 12, 11);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCity(scene, random) {
  const colliders = [];
  const buildings = [];
  const landmarks = {};
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture(random) }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Ocean beyond the beach, a flat blue sheet that meets the sand.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, 260),
    new THREE.MeshLambertMaterial({ color: 0x2f7fb8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.15, WORLD.oceanZ + 130);
  scene.add(ocean);

  // A distant skyline across the water so the horizon is not empty.
  const skyline = new THREE.Mesh(
    new THREE.BoxGeometry(420, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0x8a9ab0 }),
  );
  skyline.position.set(0, 8, 330);
  scene.add(skyline);

  // Blocks: which block centres exist, and which are special.
  const blockCentres = [];
  for (const bx of [-150, -90, -30, 30, 90, 150]) {
    for (const bz of [-150, -90, -30, 30, 90, 150]) blockCentres.push([bx, bz]);
  }
  const special = {
    '-150,-150': 'garage',
    '90,-90': 'cafe',
    '-90,90': 'safehouse',
    '150,30': 'bank',
    '150,-150': 'alley',
    '-150,30': 'hospital',
  };
  const parkBlocks = new Set();
  while (parkBlocks.size < 5) {
    const b = pick(random, blockCentres);
    if (!special[`${b[0]},${b[1]}`]) parkBlocks.add(`${b[0]},${b[1]}`);
  }

  // Regular buildings: 1-3 per ordinary block, instanced.
  const spots = [];
  for (const [bx, bz] of blockCentres) {
    const key = `${bx},${bz}`;
    if (special[key] || parkBlocks.has(key)) continue;
    const count = rangeInt(random, 1, 3);
    for (let i = 0; i < count; i += 1) {
      const w = range(random, 12, 20);
      const d = range(random, 12, 20);
      const h = range(random, 8, 34);
      const x = bx + range(random, -12, 12);
      const z = bz + range(random, -12, 12);
      spots.push({ x, z, w, d, h, color: pick(random, BUILDING_COLORS) });
    }
  }
  const buildingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ map: windowTexture() }),
    spots.length,
  );
  spots.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.h / 2, spot.z);
    dummy.scale.set(spot.w, spot.h, spot.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    buildingMesh.setMatrixAt(i, dummy.matrix);
    buildingMesh.setColorAt(i, color.setHex(spot.color));
    colliders.push({ minX: spot.x - spot.w / 2, maxX: spot.x + spot.w / 2, minZ: spot.z - spot.d / 2, maxZ: spot.z + spot.d / 2 });
    buildings.push({ x: spot.x, z: spot.z, w: spot.w, d: spot.d });
  });
  buildingMesh.instanceMatrix.needsUpdate = true;
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
  scene.add(buildingMesh);

  // Landmark buildings: one tall, distinct block each, with a coloured roof cap.
  for (const [key, name] of Object.entries(special)) {
    const [bx, bz] = key.split(',').map(Number);
    const h = name === 'bank' ? 30 : name === 'hospital' ? 26 : 16;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(24, h, 24),
      new THREE.MeshLambertMaterial({ color: LANDMARK_COLORS[name], map: windowTexture() }),
    );
    mesh.position.set(bx, h / 2, bz);
    scene.add(mesh);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(25, 1.2, 25),
      new THREE.MeshLambertMaterial({ color: LANDMARK_COLORS[name], emissive: LANDMARK_COLORS[name], emissiveIntensity: 0.25 }),
    );
    cap.position.set(bx, h + 0.6, bz);
    scene.add(cap);
    colliders.push({ minX: bx - 12, maxX: bx + 12, minZ: bz - 12, maxZ: bz + 12 });
    buildings.push({ x: bx, z: bz, w: 24, d: 24 });
    landmarks[name] = { x: bx, z: bz };
  }

  // The docks: a pier of crates and a hut on the sand, south of the last road.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(30, 1, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  pier.position.set(PLACES.docks.x, 0.5, 198);
  scene.add(pier);
  for (let i = 0; i < 5; i += 1) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: pick(random, [0xc8a04a, 0x7a8a9e, 0xa85a4a]) }),
    );
    crate.position.set(PLACES.docks.x - 10 + i * 5, 1.2, 194 + (i % 2) * 3);
    crate.rotation.y = range(random, 0, 1);
    scene.add(crate);
    colliders.push({ minX: crate.position.x - 1.2, maxX: crate.position.x + 1.2, minZ: crate.position.z - 1.2, maxZ: crate.position.z + 1.2 });
  }
  landmarks.docks = { x: PLACES.docks.x, z: PLACES.docks.z };

  // Palm trees along the beach and in the parks.
  const palmSpots = [];
  for (let x = -190; x <= 190; x += 18) palmSpots.push({ x, z: 196 + range(random, -2, 4) });
  for (const key of parkBlocks) {
    const [bx, bz] = key.split(',').map(Number);
    for (let i = 0; i < 3; i += 1) palmSpots.push({ x: bx + range(random, -16, 16), z: bz + range(random, -16, 16) });
  }
  const trunkMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
    palmSpots.length,
  );
  const canopyMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(3.2, 4.5, 7),
    new THREE.MeshLambertMaterial({ color: 0x3f8f4f }),
    palmSpots.length,
  );
  palmSpots.forEach((spot, i) => {
    dummy.position.set(spot.x, 3.5, spot.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0.12);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(spot.x, 8.2, spot.z);
    dummy.updateMatrix();
    canopyMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  scene.add(trunkMesh);
  scene.add(canopyMesh);

  // Lamp posts at intersections.
  const lampSpots = [];
  for (const rx of ROADS) {
    for (const rz of ROADS) lampSpots.push({ x: rx + 9, z: rz + 9 });
  }
  const poleMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 5.5, 5),
    new THREE.MeshLambertMaterial({ color: 0x2a2d33 }),
    lampSpots.length,
  );
  const lampMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.45, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    lampSpots.length,
  );
  lampSpots.forEach((spot, i) => {
    dummy.position.set(spot.x, 2.75, spot.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(spot.x, 5.6, spot.z);
    dummy.updateMatrix();
    lampMesh.setMatrixAt(i, dummy.matrix);
  });
  poleMesh.instanceMatrix.needsUpdate = true;
  lampMesh.instanceMatrix.needsUpdate = true;
  scene.add(poleMesh);
  scene.add(lampMesh);

  // Sun, sky and haze.
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.2);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 1.1));
  scene.background = new THREE.Color(0x9ec8e8);
  scene.fog = new THREE.Fog(0xa8c8d8, 180, 420);

  return {
    colliders,
    buildings,
    landmarks,
    layout: {
      roads: ROADS,
      buildings,
      parks: [...parkBlocks].map((k) => k.split(',').map(Number)),
      beachZ: WORLD.beachZ,
      landmarks: PLACES,
    },
  };
}
