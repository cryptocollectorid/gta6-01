// Bahia Verde — tuning constants. One place for every number the rest of the
// game reads, so balancing is an edit here and not a hunt through systems.
export const WORLD = {
  half: 210, // playable world spans [-210, 210] on x and z
  roadPitch: 60, // distance between road centrelines
  roadWidth: 14,
  blockSize: 46, // 60 - 14
  beachZ: 192, // sand starts here (south edge)
  oceanZ: 208, // water plane starts here
};

export const ROADS = [-180, -120, -60, 0, 60, 120, 180];

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 10,
  radius: 0.6,
  health: 100,
  punchDamage: 34,
  punchRange: 2.4,
  punchArc: 1.9, // radians, half-angle in front
  punchCooldown: 0.45,
  shootDamage: 50,
  shootRange: 42,
  shootCone: 0.42, // radians off the camera forward
  ammoMax: 12,
};

export const CAR = {
  accel: 15,
  brake: 34,
  reverseAccel: 10,
  maxSpeed: 40,
  maxReverse: 11,
  turnRate: 2.1, // rad/s at full lock, scaled by speed
  radius: 1.7,
  drag: 0.55,
};

export const TRAFFIC = {
  count: 14,
  parked: 6,
  speedMin: 8,
  speedMax: 13,
};

export const PEDS = {
  count: 22,
  speedMin: 1.1,
  speedMax: 2.1,
};

export const POLICE = {
  maxCars: 4,
  accel: 17,
  maxSpeed: 36,
  bustRadius: 4.2,
  bustSpeed: 2.6, // player must be slower than this to be busted
  bustTime: 1.2, // seconds inside the radius while slow
};

export const WANTED = {
  stealMoving: 1,
  hitPed: 2,
  shoot: 1,
  ramPolice: 1,
  quietSeconds: 15, // no crime for this long before stars start to fall
  decaySeconds: 8, // one star per this many quiet seconds
  max: 5,
};

// Named places in Bahia Verde. All original: a sun-soaked port city on the
// Verde coast, its own streets, its own people, nothing borrowed from any
// commercial game. `approach` is the spot in front of the building where a
// job's marker sits — the building itself is solid, so the marker must be
// reachable from the street.
export const PLACES = {
  start: { x: 0, z: -30, label: 'Calle Sol' },
  garage: { x: -150, z: -150, approach: { x: -150, z: -126 }, label: "Rosa's Garage" },
  cafe: { x: 90, z: -90, approach: { x: 90, z: -66 }, label: "Mama Rosa's Cafe" },
  safehouse: { x: -90, z: 90, approach: { x: -90, z: 66 }, label: 'The Safehouse' },
  bank: { x: 150, z: 30, approach: { x: 126, z: 30 }, label: 'Bahia Verde Bank' },
  docks: { x: 30, z: 186, label: 'Port Docks' },
  alley: { x: 150, z: -150, approach: { x: 150, z: -126 }, label: 'Venn Alley' },
  hospital: { x: -150, z: 30, label: 'St. Marina Hospital' },
};

export const SAVE_KEY = 'bahia-verde-save-v1';
export const STEP = 1 / 60;
