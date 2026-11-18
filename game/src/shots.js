// The four screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// sets the real game state (positions, wanted level, mission) and returns how
// many fixed steps the main loop should run forward plus an autopilot input,
// so the frame is what a short stretch of real play looks like. The cover
// (1-start) is the title screen over the city; the others show driving,
// a police chase and a mission, each with the HUD and minimap on screen.
import { PLACES } from './config.js';

function hideMenu() {
  const menu = document.getElementById('menu-overlay');
  if (menu) menu.style.display = 'none';
}

export function stageShot(name, G) {
  const { playerCar, player, missions, wanted, police } = G;
  hideMenu();
  if (name === 'drive') {
    G.screen = 'play';
    missions.start(0);
    player.inCar = true;
    player.mesh.visible = false;
    playerCar.place(0, -56.5, Math.PI / 2);
    playerCar.active = true;
    playerCar.speed = 18;
    return { steps: 150, autopilot: { forward: 1, strafe: 0 } };
  }
  if (name === 'chase') {
    G.screen = 'play';
    missions.start(2);
    wanted.set(3);
    player.inCar = true;
    player.mesh.visible = false;
    playerCar.place(-40, 3.5, Math.PI / 2);
    playerCar.active = true;
    playerCar.speed = 30;
    // Clear the chase corridor (the road ahead of the player) so the frame is
    // a chase, not a traffic jam: any traffic car near it moves far west.
    // Cars on other roads can still turn in, so the corridor is wide.
    for (const car of [...G.traffic.moving, ...G.traffic.parked]) {
      if (!car.active) continue;
      const inCorridor = car.pos.x > -100 && car.pos.x < 200 && Math.abs(car.pos.z) < 40;
      if (inCorridor) {
        car.pos.set(-170 + G.random() * 40, 0, -120 + 3.5);
        car.axis = 'x';
        car.dir = 1;
        car.heading = Math.PI / 2;
        car.sync();
      }
    }
    // Three police cars closing in from behind and the side — close enough
    // to be in the frame when it is taken, far enough that the chase is
    // still moving (they top out just under the player's speed).
    police.cars[0].spawn(-70, 3.5);
    police.cars[1].spawn(-62, -28);
    police.cars[2].spawn(-52, 32);
    // A camera ahead of the car looking back at it, so the frame shows the
    // player car head-on with the police closing in behind it — the chase
    // itself — instead of a plain chase cam that hides the pursuers.
    G.camSide = 3.0;
    return { steps: 150, autopilot: { forward: 1, strafe: 0 } };
  }
  if (name === 'mission') {
    G.screen = 'play';
    missions.start(1);
    missions.stepIndex = 1;
    missions.placeBeacon();
    player.inCar = false;
    player.mesh.visible = true;
    // On foot at the docks, just outside the grab radius: the beacon and the
    // objective show, and the step does not complete while staging.
    player.pos.set(PLACES.docks.x - 9, 0, PLACES.docks.z - 4);
    player.heading = Math.atan2(PLACES.docks.x - player.pos.x, PLACES.docks.z - player.pos.z);
    G.camYaw = player.heading + Math.PI;
    return { steps: 90, autopilot: { forward: 0, strafe: 0 } };
  }
  // start: the title screen over a high view of the city.
  G.screen = 'title';
  const menu = document.getElementById('menu-overlay');
  if (menu) menu.style.display = 'flex';
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn && !window.localStorage.getItem('bahia-verde-save-v1')) {
    continueBtn.style.display = 'none';
  }
  G.camera.position.set(120, 85, 150);
  G.camera.lookAt(0, 0, 0);
  return { steps: 0, autopilot: null };
}
