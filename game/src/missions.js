// The story: five jobs for Mama Rosa, fixer of Bahia Verde. Each job is a
// list of steps — get in a car, reach a place, grab something on foot, lose
// the heat, settle a score — with a glowing beacon marking the target. The
// player is Rex Marlowe, a getaway driver who owes Rosa one favour too many.
import * as THREE from 'three';
import { PLACES } from './config.js';

const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Job 1 — First Wheels',
    briefing: 'Rosa needs wheels and you need work. Take any car on the street — parked ones are free, moving ones draw eyes — and bring it to my garage.',
    reward: 150,
    steps: [
      { type: 'enterCar', text: 'Get in a car (E)' },
      { type: 'goto', place: 'garage', radius: 10, inCar: true, text: "Drive to Rosa's Garage" },
    ],
  },
  {
    id: 'the-pickup',
    title: 'Job 2 — The Pickup',
    briefing: 'A crate came in on the night boat and the docks are crawling with harbour cops. Drive down, grab the package on foot, and bring it to my cafe. Quietly.',
    reward: 300,
    steps: [
      { type: 'goto', place: 'docks', radius: 12, inCar: true, text: 'Drive to the Port Docks' },
      { type: 'grab', place: 'docks', radius: 6, text: 'Get out and grab the package' },
      { type: 'goto', place: 'cafe', radius: 10, inCar: true, text: "Deliver the package to Mama Rosa's Cafe" },
    ],
  },
  {
    id: 'hot-pursuit',
    title: 'Job 3 — Hot Pursuit',
    briefing: 'The Venn crew tipped the police about you. Two stars and counting. Shake them — get clean, no stars at all — then lay low at the safehouse.',
    reward: 400,
    onStart: { wanted: 2 },
    steps: [
      { type: 'loseHeat', text: 'Lose the heat — get to zero stars' },
      { type: 'goto', place: 'safehouse', radius: 10, text: 'Reach the Safehouse' },
    ],
  },
  {
    id: 'payback',
    title: 'Job 4 — Payback',
    briefing: 'Dario Venn sent three of his boys to lean on Rosa. Go to the alley, settle it — fists or the pistol, your call — then bring yourself back to the garage in one piece.',
    reward: 500,
    steps: [
      { type: 'goto', place: 'alley', radius: 10, text: 'Go to Venn Alley' },
      { type: 'defeat', count: 3, text: 'Deal with the three Venn thugs' },
      { type: 'goto', place: 'garage', radius: 10, text: "Get back to Rosa's Garage" },
    ],
  },
  {
    id: 'the-big-score',
    title: 'Job 5 — The Big Score',
    briefing: 'The bank on the square moves its cash at noon and the vault door sticks. Drive there, walk in, take the bag — and when the alarm goes up, drive like the whole city is behind you. Because it will be.',
    reward: 1000,
    steps: [
      { type: 'goto', place: 'bank', radius: 12, inCar: true, text: 'Drive to Bahia Verde Bank' },
      { type: 'grab', place: 'bank', radius: 6, text: 'Get out and grab the cash' },
      { type: 'goto', place: 'safehouse', radius: 10, text: 'Escape to the Safehouse — three stars!' },
    ],
  },
];

export class MissionSystem {
  constructor(scene) {
    this.scene = scene;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.dwell = 0;
    this.done = false;
    this.active = false;
    // The beacon: a glowing column and a spinning diamond over the target.
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beaconRing = ring;
    this.beaconRing.visible = false;
    scene.add(this.beaconRing);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd24a }),
    );
    this.beaconDiamond = diamond;
    this.beaconDiamond.visible = false;
    scene.add(this.beaconDiamond);
    this.pulse = 0;
  }

  get mission() {
    return MISSIONS[this.missionIndex] ?? null;
  }

  get step() {
    const mission = this.mission;
    return mission ? mission.steps[this.stepIndex] ?? null : null;
  }

  start(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.dwell = 0;
    this.done = false;
    this.active = true;
    const mission = this.mission;
    this.placeBeacon();
    return mission;
  }

  // Where a step's marker sits: the approach point in front of the building
  // when one is defined, else the place itself.
  stepPos(step) {
    const place = PLACES[step.place];
    return place.approach ?? place;
  }

  placeBeacon() {
    const step = this.step;
    if (!step || !step.place) {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
      this.beaconDiamond.visible = false;
      return;
    }
    const place = this.stepPos(step);
    this.beacon.position.set(place.x, 30, place.z);
    this.beaconRing.position.set(place.x, 0.15, place.z);
    this.beaconDiamond.position.set(place.x, 9, place.z);
    this.beacon.visible = true;
    this.beaconRing.visible = true;
    this.beaconDiamond.visible = true;
  }

  targetPos() {
    const step = this.step;
    if (!step || !step.place) return null;
    return this.stepPos(step);
  }

  objectiveText() {
    if (this.done) return 'Story complete — Bahia Verde is yours. Free roam.';
    const step = this.step;
    const mission = this.mission;
    if (!mission || !step) return '';
    return `${mission.title}: ${step.text}`;
  }

  // ctx: { inCar, pos:{x,z}, wanted, thugsDown, thugsNeeded, dt }
  // Returns events: { stepDone, missionDone, message, setWanted }.
  update(dt, ctx) {
    const events = {};
    if (!this.active || this.done) return events;
    this.pulse += dt;
    if (this.beacon.visible) {
      this.beacon.material.opacity = 0.16 + Math.sin(this.pulse * 3) * 0.06;
      this.beaconDiamond.rotation.y += dt * 1.5;
      this.beaconDiamond.position.y = 9 + Math.sin(this.pulse * 2) * 0.8;
    }
    const step = this.step;
    if (!step) return events;
    let done = false;
    if (step.type === 'enterCar') {
      done = ctx.inCar;
    } else if (step.type === 'goto' || step.type === 'onFoot' || step.type === 'grab') {
      const place = this.stepPos(step);
      const dist = Math.hypot(ctx.pos.x - place.x, ctx.pos.z - place.z);
      const inCarOk = step.inCar === undefined || step.inCar === ctx.inCar;
      if (dist < step.radius && inCarOk) {
        if (step.type === 'grab') {
          this.dwell += dt;
          if (this.dwell >= 1.5) done = true;
        } else {
          done = true;
        }
      } else {
        this.dwell = 0;
      }
    } else if (step.type === 'loseHeat') {
      done = ctx.wanted === 0;
    } else if (step.type === 'defeat') {
      done = ctx.thugsDown >= step.count;
    }
    if (!done) return events;
    this.dwell = 0;
    this.stepIndex += 1;
    events.stepDone = true;
    const mission = this.mission;
    if (this.stepIndex >= mission.steps.length) {
      events.missionDone = true;
      events.reward = mission.reward;
      events.message = `${mission.title} complete — +$${mission.reward}`;
      this.missionIndex += 1;
      this.stepIndex = 0;
      if (this.missionIndex >= MISSIONS.length) {
        this.done = true;
        this.active = false;
        this.beacon.visible = false;
        this.beaconRing.visible = false;
        this.beaconDiamond.visible = false;
        events.message = `STORY COMPLETE — all five jobs done. +$${mission.reward}`;
        return events;
      }
      const next = this.mission;
      if (next.onStart) events.setWanted = next.onStart.wanted;
      events.nextMission = next;
    } else {
      this.placeBeacon();
    }
    return events;
  }
}

export function missionCount() {
  return MISSIONS.length;
}
