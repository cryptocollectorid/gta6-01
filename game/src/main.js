// Bahia Verde — boot, loop and the rules that tie the systems together.
// Screens: title, mission card, play, paused, busted, wasted, story complete.
// The player is Rex Marlowe, a getaway driver working off a debt to Mama Rosa.
// ?seed=N fixes the city; ?shot=start|drive|chase|mission stages a screenshot
// scene instead of running the loop and sets window.__shotReady.
import * as THREE from 'three';
import { CAR, PLACES, PLAYER, STEP, WORLD } from './config.js';
import { createRandom, pick, range } from './random.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { createCity } from './city.js';
import { PlayerCar, clampToWorld, collideCircle, createTraffic } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { Police, Wanted } from './police.js';
import { MissionSystem } from './missions.js';
import { Combat } from './combat.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const city = createCity(scene, random);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud(document);
const wanted = new Wanted();
const police = new Police(scene);
const missions = new MissionSystem(scene);
const combat = new Combat(scene);
const traffic = createTraffic(scene, random, city.colliders);
const peds = createPedestrians(scene, random);
const playerCar = new PlayerCar(scene, 0xe86a2a);
playerCar.place(PLACES.start.x, PLACES.start.z - 6, 0);

// Rex on foot: a simple figure in a white shirt and jeans.
function createPlayerMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf0e8d8 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a880 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x3a5a8a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), shirt);
  torso.position.y = 1.1;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
  cap.position.y = 1.86;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), jeans);
  legL.position.set(-0.16, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), jeans);
  legR.position.set(0.16, 0.38, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

const G = {
  scene, camera, renderer, city, input, audio, hud, wanted, police, missions, combat,
  traffic, peds, playerCar, random,
  screen: 'title',
  player: {
    mesh: createPlayerMesh(),
    pos: new THREE.Vector3(PLACES.start.x, 0, PLACES.start.z),
    heading: 0,
    health: PLAYER.health,
    ammo: PLAYER.ammoMax,
    inCar: false,
    walkPhase: 0,
    lastHurt: -99,
  },
  cash: 0,
  camYaw: Math.PI,
  camDist: 9,
  carCamYaw: Math.PI,
  dragOffset: 0,
  camSide: 0, // extra chase-cam orbit for staged shots (0 in normal play)
  time: 0,
  shotHeatTimer: 0,
  pendingWanted: null,
  defeatSpawned: false,
  punchQueued: false,
  autopilot: null,
  pickups: [],
};
scene.add(G.player.mesh);

// Cash pickups: gold spins scattered on the sidewalks, +$25 each.
const pickupGeo = new THREE.OctahedronGeometry(0.7);
const pickupMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
function spawnPickup() {
  const mesh = new THREE.Mesh(pickupGeo, pickupMat);
  const road = pick(random, [-180, -120, -60, 0, 60, 120, 180]);
  if (random() < 0.5) mesh.position.set(range(random, -180, 180), 1, road + 9.5);
  else mesh.position.set(road + 9.5, 1, range(random, -180, 180));
  scene.add(mesh);
  return mesh;
}
for (let i = 0; i < 8; i += 1) G.pickups.push(spawnPickup());

function announce(message) {
  statusEl.textContent = message;
}

function show(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'flex' : 'none';
}

function refreshHud() {
  const hudEl = document.getElementById('hud');
  if (hudEl) hudEl.style.display = G.screen === 'title' ? 'none' : 'block';
  hud.setCash(G.cash);
  hud.setStars(wanted.stars);
  hud.setHealth(G.player.health);
  hud.setObjective(missions.objectiveText());
  hud.setSpeed(G.player.inCar ? playerCar.speed * 3.6 : 0, G.player.inCar);
  hud.showCrosshair(!G.player.inCar && G.screen === 'play');
}

function saveGame() {
  writeSave({ cash: G.cash, missionIndex: missions.missionIndex, health: G.player.health });
}

function respawnAtHospital() {
  G.player.pos.set(PLACES.hospital.x, 0, PLACES.hospital.z + 16);
  G.player.heading = 0;
  G.player.health = PLAYER.health;
  G.player.ammo = PLAYER.ammoMax;
  G.player.inCar = false;
  playerCar.place(PLACES.hospital.x + 8, PLACES.hospital.z + 16, 0);
  wanted.clear();
  police.clear();
  G.camYaw = Math.PI;
  refreshHud();
}

function enterCar() {
  const p = G.player.pos;
  // The player's own parked ride is free to get back into.
  if (!playerCar.active) {
    const dist = Math.hypot(playerCar.pos.x - p.x, playerCar.pos.z - p.z);
    if (dist < 4.5) {
      playerCar.active = true;
      G.player.inCar = true;
      G.player.mesh.visible = false;
      audio.radio(true);
      refreshHud();
      return true;
    }
  }
  let best = null;
  let bestDist = 4.5;
  for (const car of [...traffic.moving, ...traffic.parked]) {
    if (!car.active) continue;
    const dist = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
    if (dist < bestDist) {
      best = car;
      bestDist = dist;
    }
  }
  if (!best) return false;
  const wasMoving = best.speed > 0;
  const spot = best.steal();
  playerCar.place(spot.x, spot.z, spot.heading);
  playerCar.active = true;
  G.player.inCar = true;
  G.player.mesh.visible = false;
  audio.radio(true);
  if (wasMoving) {
    wanted.add(1);
    hud.toast('Car stolen in traffic! +1 star', 2.5);
  } else {
    hud.toast('You took a parked car', 2);
  }
  refreshHud();
  return true;
}

function exitCar() {
  const side = { x: Math.cos(playerCar.heading), z: -Math.sin(playerCar.heading) };
  G.player.pos.set(playerCar.pos.x + side.x * 2.5, 0, playerCar.pos.z + side.z * 2.5);
  G.player.heading = playerCar.heading;
  G.player.inCar = false;
  G.player.mesh.visible = true;
  audio.radio(false);
  audio.engine(false, 0);
  refreshHud();
}

function updatePlayerOnFoot(dt) {
  const move = G.autopilot ? { forward: G.autopilot.forward, strafe: G.autopilot.strafe || 0 } : input.move();
  const f = { x: -Math.sin(G.camYaw), z: -Math.cos(G.camYaw) };
  const r = { x: -f.z, z: f.x };
  let vx = f.x * move.forward + r.x * move.strafe;
  let vz = f.z * move.forward + r.z * move.strafe;
  const len = Math.hypot(vx, vz);
  const sprint = input.sprint();
  if (len > 0.01) {
    vx /= len;
    vz /= len;
    const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    G.player.pos.x += vx * speed * dt;
    G.player.pos.z += vz * speed * dt;
    const targetHeading = Math.atan2(vx, vz);
    let diff = targetHeading - G.player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.player.heading += diff * Math.min(1, dt * 12);
    G.player.walkPhase += dt * (sprint ? 13 : 9);
  }
  collideCircle(G.player.pos, PLAYER.radius, city.colliders);
  clampToWorld(G.player.pos, 2);
  const mesh = G.player.mesh;
  mesh.position.set(G.player.pos.x, 0, G.player.pos.z);
  mesh.rotation.y = G.player.heading;
  const swing = len > 0.01 ? Math.sin(G.player.walkPhase) * 0.55 : 0;
  mesh.userData.legL.rotation.x = swing;
  mesh.userData.legR.rotation.x = -swing;
}

function updateCamera(dt) {
  const drag = input.takeDrag();
  const wheel = input.takeWheel();
  if (G.player.inCar) {
    G.dragOffset += drag.x * 0.005;
    G.dragOffset *= Math.max(0, 1 - dt * 1.2);
    const targetYaw = playerCar.heading + Math.PI + G.dragOffset + (G.camSide || 0);
    let diff = targetYaw - G.carCamYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.carCamYaw += diff * Math.min(1, dt * 5);
    // A staged side camera stands further off so street furniture (lamps)
    // does not fill the frame.
    const dist = G.camSide ? 14 : 11.5;
    const height = G.camSide ? 6.2 : 4.6;
    const cx = playerCar.pos.x + Math.sin(G.carCamYaw) * dist;
    const cz = playerCar.pos.z + Math.cos(G.carCamYaw) * dist;
    camera.position.set(cx, height, cz);
    camera.lookAt(playerCar.pos.x + Math.sin(playerCar.heading) * 6, 1.6, playerCar.pos.z + Math.cos(playerCar.heading) * 6);
  } else {
    G.camYaw -= drag.x * 0.005;
    G.camDist = Math.max(5, Math.min(13, G.camDist + wheel * 0.005));
    const cx = G.player.pos.x + Math.sin(G.camYaw) * G.camDist;
    const cz = G.player.pos.z + Math.cos(G.camYaw) * G.camDist;
    camera.position.set(cx, 5.0, cz);
    camera.lookAt(G.player.pos.x, 1.6, G.player.pos.z);
  }
}

function updatePickups(dt) {
  const p = G.player.inCar ? playerCar.pos : G.player.pos;
  for (const mesh of G.pickups) {
    mesh.rotation.y += dt * 2;
    mesh.position.y = 1 + Math.sin(G.time * 3 + mesh.position.x) * 0.25;
    if (Math.hypot(mesh.position.x - p.x, mesh.position.z - p.z) < 2.6) {
      G.cash += 25;
      audio.cash();
      hud.setCash(G.cash);
      const road = pick(random, [-180, -120, -60, 0, 60, 120, 180]);
      if (random() < 0.5) mesh.position.set(range(random, -180, 180), 1, road + 9.5);
      else mesh.position.set(road + 9.5, 1, range(random, -180, 180));
    }
  }
}

function updateWorld(dt) {
  G.time += dt;
  G.shotHeatTimer = Math.max(0, G.shotHeatTimer - dt);
  const allCars = [...traffic.moving, ...traffic.parked, playerCar];
  for (const car of traffic.moving) car.update(dt, allCars);
  // Player car physics and collisions.
  if (G.player.inCar) {
    const move = G.autopilot ? { forward: G.autopilot.forward, strafe: G.autopilot.strafe || 0 } : input.move();
    const handbrake = G.autopilot ? !!G.autopilot.handbrake : input.handbrake();
    const result = playerCar.update(dt, move, handbrake, city.colliders, allCars);
    if (result.crashed) audio.crash();
    if (result.hitCar && result.hitCar.mesh && result.hitCar !== playerCar) {
      // Ramming a police car draws heat.
      if (police.cars.some((pc) => pc.mesh === result.hitCar.mesh)) wanted.add(1);
    }
    audio.engine(true, Math.abs(playerCar.speed) / CAR.maxSpeed);
    // Running over a pedestrian is the fastest way to five stars.
    for (const ped of peds) {
      if (!ped.alive) continue;
      const dist = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
      if (dist < 2.3 && Math.abs(playerCar.speed) > 3) {
        ped.knockDown();
        wanted.add(2);
        hud.toast('You hit a pedestrian! +2 stars', 3);
        audio.crash();
      }
    }
  } else {
    audio.engine(false, 0);
    updatePlayerOnFoot(dt);
  }
  for (const ped of peds) ped.update(dt, allCars, random);
  // Combat: punch, shoot, thugs.
  const actions = {
    punch: false,
    shoot: false,
    cameraDir: { x: -Math.sin(G.camYaw), z: -Math.cos(G.camYaw) },
    playerPos: G.player.pos,
    ammo: G.player.ammo,
  };
  const pending = G.punchQueued;
  G.punchQueued = false;
  if (pending) actions.punch = true;
  if (input.takeClick() && !G.player.inCar) actions.shoot = true;
  if (actions.shoot && G.player.ammo > 0) {
    audio.gunshot();
    if (G.shotHeatTimer <= 0) {
      wanted.add(1);
      G.shotHeatTimer = 5;
    }
  }
  const combatResult = combat.update(dt, actions);
  if (actions.punch && combatResult.hit) audio.punch();
  if (actions.shoot && combatResult.hit) hud.toast('Hit!', 1);
  if (actions.shoot) G.player.ammo = Math.max(0, G.player.ammo - combatResult.ammoUsed);
  if (combatResult.damageToPlayer > 0) {
    G.player.health -= combatResult.damageToPlayer;
    G.player.lastHurt = G.time;
    if (G.player.health <= 0) {
      G.screen = 'wasted';
      show('wasted-overlay', true);
      audio.busted();
      return;
    }
  }
  if (G.time - G.player.lastHurt > 5 && G.player.health < PLAYER.health) {
    G.player.health = Math.min(PLAYER.health, G.player.health + 3 * dt);
  }
  // Police + wanted.
  const targetPos = G.player.inCar ? playerCar.pos : G.player.pos;
  const targetSpeed = G.player.inCar ? Math.abs(playerCar.speed) : 0;
  const policeResult = police.update(dt, targetPos, targetSpeed, wanted.stars, city.colliders, random);
  if (policeResult.busted) {
    const lost = Math.min(G.cash, Math.max(100, Math.floor(G.cash * 0.1)));
    G.cash -= lost;
    G.screen = 'busted';
    document.getElementById('busted-lost').textContent = `You lost $${lost}.`;
    show('busted-overlay', true);
    audio.busted();
    return;
  }
  const policeNear = policeResult.near;
  wanted.update(dt, policeNear);
  audio.siren(wanted.stars > 0 && policeNear);
  if (police.ramCheck(targetPos, G.player.inCar ? playerCar : null)) audio.crash();
  // Missions.
  const step = missions.step;
  if (step && step.type === 'defeat' && !G.defeatSpawned) {
    const alley = PLACES.alley.approach ?? PLACES.alley;
    combat.spawnThugs(alley, step.count, random);
    G.defeatSpawned = true;
    hud.toast('The Venn boys are here. Settle it.', 3);
  }
  if (step && step.type !== 'defeat') G.defeatSpawned = false;
  const missionEvents = missions.update(dt, {
    inCar: G.player.inCar,
    pos: G.player.inCar ? playerCar.pos : G.player.pos,
    wanted: wanted.stars,
    thugsDown: combat.thugsDown,
    thugsNeeded: step && step.count ? step.count : 0,
  });
  if (missionEvents.stepDone && missions.mission && missions.mission.id === 'the-big-score' && missions.stepIndex === 2) {
    // The vault grab trips the alarm on the way out.
    wanted.set(3);
    hud.toast('ALARM! Three stars — run!', 3);
  }
  if (missionEvents.missionDone) {
    G.cash += missionEvents.reward;
    audio.jingle();
    hud.toast(missionEvents.message, 4);
    saveGame();
    if (missions.done) {
      G.screen = 'complete';
      show('complete-overlay', true);
      document.getElementById('complete-cash').textContent = `$${G.cash.toLocaleString('en-US')}`;
      return;
    }
    if (missionEvents.setWanted !== undefined) G.pendingWanted = missionEvents.setWanted;
    showMissionCard(missions.mission);
    return;
  }
  updatePickups(dt);
  updateCamera(dt);
  refreshHud();
  hud.drawMinimap({
    layout: city.layout,
    player: { x: targetPos.x, z: targetPos.z, heading: G.player.inCar ? playerCar.heading : G.player.heading },
    cars: [...traffic.moving, ...traffic.parked],
    police: police.cars,
    target: missions.targetPos(),
  });
}

function showMissionCard(mission) {
  G.screen = 'card';
  document.getElementById('card-title').textContent = mission.title;
  document.getElementById('card-brief').textContent = mission.briefing;
  document.getElementById('card-reward').textContent = `Reward: $${mission.reward}`;
  show('card-overlay', true);
  announce(`${mission.title}. ${mission.briefing}`);
}

function acceptCard() {
  show('card-overlay', false);
  const mission = missions.start(missions.missionIndex);
  if (G.pendingWanted !== null) {
    wanted.set(G.pendingWanted);
    G.pendingWanted = null;
  }
  G.screen = 'play';
  announce(`${mission.title} started.`);
  refreshHud();
}

function startGame(fromSave) {
  show('menu-overlay', false);
  if (fromSave) {
    const save = loadSave();
    if (save) {
      G.cash = save.cash;
      G.player.health = save.health || PLAYER.health;
      missions.missionIndex = Math.min(save.missionIndex, 5);
      if (missions.missionIndex >= 5) {
        missions.done = true;
        missions.active = false;
      }
    }
  } else {
    clearSave();
    G.cash = 0;
    G.player.health = PLAYER.health;
    missions.missionIndex = 0;
  }
  combat.clear();
  wanted.clear();
  police.clear();
  G.player.ammo = PLAYER.ammoMax;
  G.player.inCar = false;
  G.player.mesh.visible = true;
  G.player.pos.set(PLACES.start.x, 0, PLACES.start.z);
  G.player.heading = 0;
  playerCar.place(PLACES.start.x, PLACES.start.z - 6, 0);
  playerCar.active = false;
  if (missions.mission) showMissionCard(missions.mission);
  else G.screen = 'play';
  refreshHud();
}

function runShot(name) {
  const plan = stageShot(name, G);
  G.autopilot = plan.autopilot || null;
  for (let i = 0; i < plan.steps && G.screen === 'play'; i += 1) updateWorld(STEP);
  G.autopilot = null;
  // The title shot keeps the high orbit camera stageShot set; play shots use
  // the chase/orbit camera.
  if (G.screen === 'play') updateCamera(0.016);
  refreshHud();
  if (G.screen === 'play') {
    hud.drawMinimap({
      layout: city.layout,
      player: { x: (G.player.inCar ? playerCar.pos : G.player.pos).x, z: (G.player.inCar ? playerCar.pos : G.player.pos).z, heading: G.player.inCar ? playerCar.heading : G.player.heading },
      cars: [...traffic.moving, ...traffic.parked],
      police: police.cars,
      target: missions.targetPos(),
    });
  }
  renderer.render(scene, camera);
  window.__shotReady = true;
}

function runGame() {
  const continueBtn = document.getElementById('continue-btn');
  if (!loadSave()) continueBtn.style.display = 'none';
  document.getElementById('new-btn').addEventListener('click', () => { audio.unlock(); startGame(false); });
  continueBtn.addEventListener('click', () => { audio.unlock(); startGame(true); });
  document.getElementById('card-btn').addEventListener('click', () => { audio.unlock(); acceptCard(); });
  document.getElementById('resume-btn').addEventListener('click', () => {
    show('pause-overlay', false);
    G.screen = 'play';
  });
  document.getElementById('busted-btn').addEventListener('click', () => {
    show('busted-overlay', false);
    respawnAtHospital();
    G.screen = 'play';
  });
  document.getElementById('wasted-btn').addEventListener('click', () => {
    show('wasted-overlay', false);
    respawnAtHospital();
    // The job that got you wasted starts over from its first step.
    missions.start(missions.missionIndex);
    G.screen = 'play';
  });
  document.getElementById('complete-btn').addEventListener('click', () => {
    show('complete-overlay', false);
    G.screen = 'play';
  });
  document.getElementById('save-btn').addEventListener('click', () => {
    saveGame();
    hud.toast('Progress saved', 2);
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.screen = 'paused';
      show('pause-overlay', true);
      announce('Paused.');
    }
  });

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_PUNCH) G.punchQueued = true;
    if (actions & ACTION_SAVE && G.screen === 'play') {
      saveGame();
      hud.toast('Progress saved', 2);
    }
    if (G.screen === 'title') {
      // Slow orbit over the city behind the title.
      const t = now / 1000;
      camera.position.set(Math.sin(t * 0.05) * 140, 70, Math.cos(t * 0.05) * 140);
      camera.lookAt(0, 0, 0);
      // The city still lives behind the menu.
      while (accumulator >= STEP) {
        for (const car of traffic.moving) car.update(STEP, [...traffic.moving, ...traffic.parked]);
        for (const ped of peds) ped.update(STEP, [...traffic.moving, ...traffic.parked], random);
        accumulator -= STEP;
      }
    } else if (G.screen === 'card' && (actions & ACTION_CONFIRM)) {
      acceptCard();
    } else if (G.screen === 'play') {
      if (actions & ACTION_PAUSE) {
        G.screen = 'paused';
        show('pause-overlay', true);
        announce('Paused.');
      } else if (actions & ACTION_ENTER_CAR) {
        if (G.player.inCar) exitCar();
        else enterCar();
      }
      while (accumulator >= STEP && G.screen === 'play') {
        updateWorld(STEP);
        accumulator -= STEP;
      }
      if (G.screen !== 'play') accumulator = 0;
    } else if (G.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      show('pause-overlay', false);
      G.screen = 'play';
    }
    renderer.render(scene, camera);
  }
  announce('Bahia Verde. Press Enter or click New Game to start.');
  refreshHud();
  requestAnimationFrame(frame);
}

// Debug handle for play-testing (read the live state from the console or a
// test driver). Harmless in play: it only exposes the running game object.
window.__bahia = G;

if (shot) runShot(shot);
else runGame();
