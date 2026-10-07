import * as THREE from 'three';
import type { World } from './world';
import type { GameSettings } from './settings';

export interface CarInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  handbrake: boolean;
}

const GEARS = [3.55, 2.35, 1.78, 1.42, 1.15, 0.95, 0.8];
const FINAL = 3.42;
const REDLINE = 8600;
const IDLE = 950;

interface WheelState {
  anchor: THREE.Vector3;
  radius: number;
  rest: number;
  travel: number;
  spin: number;
  steerMax: number;
  driven: number; // 0..1 share of axle torque
  brakeShare: number;
  contact: boolean;
  compression: number;
  load: number;
  slip: number;
  contactPoint: THREE.Vector3;
  contactNormal: THREE.Vector3;
  surface: number; // grip multiplier
}

export class Vehicle {
  pos = new THREE.Vector3();
  quat = new THREE.Quaternion();
  vel = new THREE.Vector3();
  angVel = new THREE.Vector3();

  mass = 1580;
  invMass = 1 / 1580;
  inertia = new THREE.Vector3(3100, 3500, 720);

  rpm = IDLE;
  gear = 1;
  shiftTimer = 0;
  autoBox = true;
  odometer = 0;
  fuel = 100;
  damage = 0;
  drifting = false;
  slipAmount = 0;
  wheelSpinVisual: number[] = [0, 0, 0, 0];
  steerAngle = 0;
  lastImpact = 0;

  wheels: WheelState[] = [];
  onCollision?: (impulse: number) => void;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  constructor() {
    const mk = (x: number, z: number, steerMax: number, driven: number, brakeShare: number): WheelState => ({
      anchor: new THREE.Vector3(x, -0.1, z),
      radius: 0.36,
      rest: 0.4,
      travel: 0.26,
      spin: 0,
      steerMax,
      driven,
      brakeShare,
      contact: false,
      compression: 0,
      load: 0,
      slip: 0,
      contactPoint: new THREE.Vector3(),
      contactNormal: new THREE.Vector3(0, 1, 0),
      surface: 1,
    });
    this.wheels = [
      mk(0.83, 1.36, 1, 0.2, 0.6),
      mk(-0.83, 1.36, 1, 0.2, 0.6),
      mk(0.83, -1.36, 0, 0.3, 0.4),
      mk(-0.83, -1.36, 0, 0.3, 0.4),
    ];
    this.reset(new THREE.Vector3(0, 0.6, 0), 0);
  }

  get speed() {
    return this.vel.length();
  }
  get speedKmh() {
    return this.vel.length() * 3.6;
  }
  get forward() {
    return this.tmpA.set(0, 0, 1).applyQuaternion(this.quat);
  }

  reset(p: THREE.Vector3, heading: number) {
    this.pos.copy(p);
    this.pos.y = Math.max(p.y, 0.72);
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.rpm = IDLE;
    this.gear = 1;
    this.wheels.forEach((w) => {
      w.spin = 0;
      w.compression = 0;
      w.load = 0;
    });
  }

  private torqueCurve(r: number) {
    const x = THREE.MathUtils.clamp(r / REDLINE, 0, 1.05);
    // flat, torquey V12 curve
    return 780 * (0.55 + 0.75 * Math.sin(Math.PI * Math.min(1, 0.18 + x * 0.95)));
  }

  update(dt: number, input: CarInput, world: World, settings: GameSettings) {
    const up = this.tmpB.set(0, 1, 0).applyQuaternion(this.quat).clone();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat);
    const n = new THREE.Vector3();

    const speed = this.vel.length();
    const gripMul = 1 - 0.28 * (world.isWet ? 0.35 : 0);
    const surfaceMu = world.isWet ? 0.74 : 1.02;

    /* ---------- steering (speed sensitive) ---------- */
    const steerLimit = 0.58 * (1 - 0.66 * THREE.MathUtils.clamp(speed / 62, 0, 1));
    const target = input.steer * steerLimit * (0.75 + 0.25 * settings.steerSensitivity);
    const rate = 5.5 + 3.5 * (1 - THREE.MathUtils.clamp(speed / 50, 0, 1));
    this.steerAngle += THREE.MathUtils.clamp(target - this.steerAngle, -rate * dt, rate * dt);

    /* ---------- transmission ---------- */
    const ratio = GEARS[this.gear - 1] * FINAL;
    const avgSpin = (this.wheels[2].spin + this.wheels[3].spin) / 2;
    const wheelRpm = (avgSpin * ratio * 60) / (2 * Math.PI);
    let targetRpm = Math.abs(wheelRpm);
    if (this.gear === -1) targetRpm = Math.abs((avgSpin * 3.3 * FINAL * 60) / (2 * Math.PI));
    // clutch slip at low speed so the car creeps like a real automatic
    this.rpm += (Math.max(IDLE, Math.min(REDLINE + 250, targetRpm)) - this.rpm) * Math.min(1, dt * 9);
    if (this.shiftTimer > 0) this.shiftTimer -= dt;

    const throttle = input.throttle;
    let engineTorque = this.torqueCurve(this.rpm) * throttle;
    engineTorque -= (this.rpm / 60) * 26 * (1 - throttle); // engine braking
    if (this.shiftTimer > 0) engineTorque *= 0.12;

    // automatic gearbox
    if (this.autoBox && this.shiftTimer <= 0) {
      if (this.gear > 0 && this.rpm > 8050 && this.gear < GEARS.length) {
        this.gear++;
        this.shiftTimer = 0.28;
      } else if (this.gear > 1 && this.rpm < 2450) {
        this.gear--;
        this.shiftTimer = 0.22;
      }
    }

    const axleTorque = engineTorque * ratio * 0.9;
    const brakeInput = input.brake;
    const handbrake = input.handbrake;

    /* ---------- per-wheel solve ---------- */
    const force = new THREE.Vector3();
    const torque = new THREE.Vector3();
    let slipTotal = 0;

    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const anchorWorld = this.tmpA.copy(w.anchor).applyQuaternion(this.quat).add(this.pos).clone();
      const gh = world.heightAt(anchorWorld.x, anchorWorld.z);
      const dist = anchorWorld.y - gh;
      const rayLen = w.rest + w.radius;
      w.contact = dist < rayLen;
      if (!w.contact) {
        w.compression = Math.max(0, w.compression - dt * 4);
        w.load = 0;
        w.slip = 0;
        w.spin += (this.rpm / 60) * ((2 * Math.PI) / ratio) * dt * 0.2;
        continue;
      }
      const compression = Math.min(w.travel, rayLen - dist);
      w.compression = compression;
      const contactPoint = anchorWorld.clone().addScaledVector(up, -(rayLen - compression));
      w.contactPoint.copy(contactPoint);
      world.normalAt(anchorWorld.x, anchorWorld.z, n);
      w.contactNormal.copy(n);

      // suspension spring + damper
      const pointVel = this.vel.clone().add(this.tmpC.copy(this.angVel).cross(this.tmpA.copy(contactPoint).sub(this.pos)));
      const springVel = -pointVel.dot(up);
      let fs = 62000 * compression + 5200 * springVel;
      fs = Math.max(0, fs);

      // anti-roll bar — compares against the partner wheel on the same axle
      const partner = i % 2 === 0 ? i + 1 : i - 1;
      const pc = this.wheels[partner].compression;
      fs += (i % 2 === 0 ? 1 : -1) * 26000 * (compression - pc) * 0.5;
      fs = Math.max(0, fs);
      w.load = fs;

      // tire frame
      const steerRot = this.tmpQ.setFromAxisAngle(up, w.steerMax ? this.steerAngle : 0);
      const wFwd = fwd.clone().applyQuaternion(steerRot);
      wFwd.addScaledVector(n, -wFwd.dot(n)).normalize();
      const wSide = new THREE.Vector3().crossVectors(n, wFwd).normalize();

      const cv = this.vel.clone().add(this.tmpC.copy(this.angVel).cross(this.tmpA.copy(contactPoint).sub(this.pos)));
      const vLong = cv.dot(wFwd);
      const vLat = cv.dot(wSide);

      // longitudinal slip
      const nominal = Math.max(Math.abs(vLong), 1.4);
      const slipRatio = (w.spin * w.radius - vLong) / nominal;
      // lateral slip
      const slipAngle = Math.atan2(vLat, Math.max(Math.abs(vLong), 1.2));

      const mu = surfaceMu * w.surface * gripMul * (handbrake && !w.steerMax ? 0.72 : 1);
      const B_l = 9.2, C_l = 1.55;
      const B_t = 11.5, C_t = 1.45;
      let Fy = -mu * fs * Math.sin(C_l * Math.atan(B_l * slipAngle));
      let Fx = mu * fs * Math.sin(C_t * Math.atan(B_t * slipRatio));

      // friction circle
      const mag = Math.hypot(Fx, Fy);
      const maxF = mu * fs * 1.08;
      let slipping = false;
      if (mag > maxF && mag > 0) {
        const s = maxF / mag;
        Fx *= s;
        Fy *= s;
        slipping = true;
      }
      w.slip = slipping ? Math.min(1, (mag - maxF) / (maxF + 1) + 0.35) : Math.min(1, Math.abs(slipAngle) * 1.4);
      slipTotal += w.slip;

      const f = wFwd.multiplyScalar(Fx).add(wSide.multiplyScalar(Fy)).add(up.clone().multiplyScalar(fs));
      force.add(f);
      this.tmpC.copy(contactPoint).sub(this.pos);
      torque.add(this.tmpC.clone().cross(f));

      // wheel spin integration
      const driveT = axleTorque * w.driven;
      let brakeT = 4600 * brakeInput * w.brakeShare;
      if (handbrake && !w.steerMax) brakeT += 5200;
      let net = driveT - Fx * w.radius;
      if (Math.abs(w.spin) > 0.4) net -= Math.sign(w.spin) * brakeT;
      else net -= brakeT * 0.6;
      w.spin += (net / 1.7) * dt;
      if (handbrake && !w.steerMax) w.spin *= 1 - Math.min(0.9, dt * 12);
      w.spin = THREE.MathUtils.clamp(w.spin, -140, 140);
      this.wheelSpinVisual[i] = w.spin;
    }

    this.slipAmount = slipTotal / 4;
    this.drifting = this.slipAmount > 0.28 && speed > 6;

    /* ---------- gravity ---------- */
    force.y -= this.mass * 9.81;

    /* ---------- aerodynamics ---------- */
    if (speed > 0.2) {
      const dir = this.vel.clone().normalize();
      const drag = 0.5 * 1.2 * 0.74 * speed * speed;
      force.addScaledVector(dir, -drag);
      force.addScaledVector(dir, -0.014 * this.mass * 9.81 * Math.min(1, speed / 3));
      force.addScaledVector(up, -0.5 * 1.2 * 1.45 * speed * speed * 0.55); // downforce
    }

    /* ---------- integrate ---------- */
    this.vel.addScaledVector(force, this.invMass * dt);
    const qInv = this.tmpQ.copy(this.quat).invert();
    const localT = torque.clone().applyQuaternion(qInv);
    const localW = this.angVel.clone().applyQuaternion(qInv);
    localW.x += (localT.x / this.inertia.x) * dt;
    localW.y += (localT.y / this.inertia.y) * dt;
    localW.z += (localT.z / this.inertia.z) * dt;
    localW.multiplyScalar(1 - Math.min(0.4, 1.6 * dt));
    this.angVel.copy(localW).applyQuaternion(this.quat);

    this.pos.addScaledVector(this.vel, dt);
    const w = this.angVel;
    const dq = new THREE.Quaternion(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(this.quat);
    this.quat.x += dq.x;
    this.quat.y += dq.y;
    this.quat.z += dq.z;
    this.quat.w += dq.w;
    this.quat.normalize();

    this.odometer += speed * dt;
    this.fuel = Math.max(0, this.fuel - dt * (0.006 + throttle * 0.05 * (this.rpm / REDLINE)));

    /* ---------- collisions ---------- */
    this.resolveCollisions(world, dt);
  }

  private corners: THREE.Vector3[] = [
    new THREE.Vector3(-0.98, 0.1, -2.3),
    new THREE.Vector3(0.98, 0.1, -2.3),
    new THREE.Vector3(-0.98, 0.1, 2.3),
    new THREE.Vector3(0.98, 0.1, 2.3),
    new THREE.Vector3(-0.98, 1.0, -2.3),
    new THREE.Vector3(0.98, 1.0, -2.3),
    new THREE.Vector3(-0.98, 1.0, 2.3),
    new THREE.Vector3(0.98, 1.0, 2.3),
    new THREE.Vector3(-0.98, 0.5, 0),
    new THREE.Vector3(0.98, 0.5, 0),
  ];

  private resolveCollisions(world: World, _dt: number) {
    const boxes = world.nearColliders(this.pos.x, this.pos.z);
    if (!boxes.length && !this.outside) return;
    const restitution = 0.24;
    for (const c of this.corners) {
      const p = c.clone().applyQuaternion(this.quat).add(this.pos);
      for (const b of boxes) {
        if (p.y < b.y0 || p.y > b.y1) continue;
        if (p.x < b.x0 || p.x > b.x1 || p.z < b.z0 || p.z > b.z1) continue;
        // penetration depths on each axis
        const pxp = b.x1 - p.x;
        const pxn = p.x - b.x0;
        const pzp = b.z1 - p.z;
        const pzn = p.z - b.z0;
        const minPen = Math.min(pxp, pxn, pzp, pzn);
        const nrm = new THREE.Vector3();
        if (minPen === pxp) nrm.set(1, 0, 0);
        else if (minPen === pxn) nrm.set(-1, 0, 0);
        else if (minPen === pzp) nrm.set(0, 0, 1);
        else nrm.set(0, 0, -1);

        this.pos.addScaledVector(nrm, minPen * 0.9);

        const r = p.clone().sub(this.pos);
        const vAt = this.vel.clone().add(this.angVel.clone().cross(r));
        const vn = vAt.dot(nrm);
        if (vn < 0) {
          const rn = r.clone().cross(nrm);
          const inv = this.invMass + (rn.x * rn.x) / this.inertia.x + (rn.y * rn.y) / this.inertia.y + (rn.z * rn.z) / this.inertia.z;
          const j = (-(1 + restitution) * vn) / inv;
          this.vel.addScaledVector(nrm, j * this.invMass);
          this.angVel.addScaledVector(rn, j);
          // friction
          const tangent = vAt.clone().addScaledVector(nrm, -vn);
          if (tangent.lengthSq() > 1e-4) {
            tangent.normalize();
            const vt = vAt.dot(tangent);
            const rt = r.clone().cross(tangent);
            const invT =
              this.invMass + (rt.x * rt.x) / this.inertia.x + (rt.y * rt.y) / this.inertia.y + (rt.z * rt.z) / this.inertia.z;
            let jt = -vt / invT;
            const maxJ = 0.65 * Math.abs(j);
            jt = THREE.MathUtils.clamp(jt, -maxJ, maxJ);
            this.vel.addScaledVector(tangent, jt * this.invMass);
            this.angVel.addScaledVector(rt, jt);
          }
          const impact = Math.abs(vn);
          if (impact > 1.6) {
            this.damage = Math.min(100, this.damage + impact * 1.4);
            this.lastImpact = impact;
            this.onCollision?.(impact);
          }
          this.angVel.multiplyScalar(0.86);
        }
      }
    }
    // map boundary
    const fixed = world.clamp(this.pos);
    this.outside = !world.drivable(this.pos.x, this.pos.z);
    if (fixed) {
      this.pos.x = fixed.x;
      this.pos.z = fixed.z;
      const toFixed = new THREE.Vector3(fixed.x - this.pos.x, 0, fixed.z - this.pos.z);
      void toFixed;
      this.vel.x *= 0.2;
      this.vel.z *= 0.2;
    }
    if (this.pos.y < -6) {
      this.reset(new THREE.Vector3(0, 1, 0), 0);
    }
  }

  outside = false;

  /** Flips the car upright at the closest road position. */
  recover(world: World) {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const x of [-420, -350, -280, -210, -140, -70, 0, 70, 140, 210, 280, 350, 420]) {
      for (const z of [-385, -315, -245, -175, -105, -35, 35, 105, 175, 245, 315, 385]) {
        const d = (x - this.pos.x) ** 2 + (z - this.pos.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = new THREE.Vector3(x, 0.7, z);
        }
      }
    }
    if (world.drivable(this.pos.x, this.pos.z) && bestD > 1) {
      best = new THREE.Vector3(this.pos.x, world.heightAt(this.pos.x, this.pos.z) + 0.7, this.pos.z);
    }
    const p = best ?? new THREE.Vector3(0, 0.7, 0);
    const heading = Math.atan2(this.forward.x, this.forward.z);
    this.reset(p, heading);
  }
}
