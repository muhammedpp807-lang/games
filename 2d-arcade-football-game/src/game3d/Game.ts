import * as THREE from 'three';
import { World } from './world';
import { createCar } from './car';
import { Vehicle, type CarInput } from './vehicle';
import { Traffic } from './traffic';
import { Environment } from './environment';
import { driveAudio } from './audio3d';
import { QUALITY_PRESETS, type GameSettings, type HudState } from './settings';

export type CameraMode = 'chase' | 'far' | 'hood' | 'cinematic';

export interface GameCallbacks {
  onHud?: (h: HudState) => void;
  onReady?: () => void;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world: World;
  env: Environment;
  car: Vehicle;
  carModel: ReturnType<typeof createCar>;
  traffic: Traffic;
  envMap: THREE.Texture | null = null;

  input: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  keys = new Set<string>();
  camMode: CameraMode = 'chase';
  private camPos = new THREE.Vector3(0, 6, -12);
  private camLook = new THREE.Vector3();
  private camShake = 0;
  private accum = 0;
  private raf = 0;
  private last = 0;
  paused = true;
  running = false;
  settings: GameSettings;
  private horn = false;
  private hornTimer = 0;
  private gearSound = 1;
  private lastHud = 0;
  private fogNear = new THREE.Vector3();
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, settings: GameSettings, private cb: GameCallbacks = {}) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: settings.quality !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = settings.shadows !== 'off';
    this.renderer.shadowMap.type = settings.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.setClearColor(0x0a1018);

    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.4, 2600);

    this.world = new World(settings.quality);
    this.scene.add(this.world.group);

    this.env = new Environment(this.renderer, this.scene, this.world, settings);
    this.envMap = Environment.buildEnvMap(this.renderer, this.env.skyMat);
    this.scene.environment = this.envMap;

    this.car = new Vehicle();
    this.carModel = createCar(this.envMap);
    this.scene.add(this.carModel.group);
    this.car.reset(new THREE.Vector3(-280, 0.8, -35), Math.PI / 2);

    // headlights
    const headL = new THREE.SpotLight(0xf2f6ff, 0, 90, 0.55, 0.45, 1.4);
    const headR = new THREE.SpotLight(0xf2f6ff, 0, 90, 0.55, 0.45, 1.4);
    headL.position.set(0.6, 0.6, 2.2);
    headR.position.set(-0.6, 0.6, 2.2);
    headL.target.position.set(1.2, -0.6, 22);
    headR.target.position.set(-1.2, -0.6, 22);
    this.carModel.group.add(headL, headL.target, headR, headR.target);
    this.headLights = [headL, headR];

    this.traffic = new Traffic(this.scene, this.world, settings.trafficDensity, settings.quality);

    this.car.onCollision = (imp) => {
      driveAudio.impact(imp);
      this.camShake = Math.min(1.4, imp * 0.09);
    };

    this.applySettings(settings);
    this.resize();
    this.cb.onReady?.();
  }

  headLights: THREE.SpotLight[] = [];

  applySettings(s: GameSettings) {
    this.settings = s;
    const preset = QUALITY_PRESETS[s.quality];
    const scale = s.renderScale * (window.devicePixelRatio > 1.5 ? 1 : 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * scale * preset.renderScale);
    this.renderer.shadowMap.enabled = s.shadows !== 'off';
    const size = s.shadows === 'high' ? 2048 : s.shadows === 'medium' ? 1024 : s.shadows === 'low' ? 512 : 0;
    if (size) {
      this.env.sun.shadow.mapSize.set(size, size);
      this.env.sun.shadow.map?.dispose();
      this.env.sun.shadow.map = null;
    }
    this.env.sun.castShadow = s.shadows !== 'off';
    this.env.setWeather(s.weather);
    this.scene.fog = this.env.fog;
    driveAudio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    this.resize();
  }

  setCameraMode(m: CameraMode) {
    this.camMode = m;
  }
  cycleCamera() {
    const order: CameraMode[] = ['chase', 'far', 'hood', 'cinematic'];
    this.camMode = order[(order.indexOf(this.camMode) + 1) % order.length];
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running || this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (!this.paused) this.tick(dt);
      else this.updateVisualsOnly(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.env.dispose(this.scene);
    this.renderer.dispose();
  }

  /* ---------------- input ---------------- */
  handleKey(code: string, down: boolean) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    if (!down) return;
    if (code === 'KeyC') this.cycleCamera();
    if (code === 'KeyR') this.car.recover(this.world);
    if (code === 'KeyH') this.horn = true;
    if (code === 'KeyL') this.lightsOn = !this.lightsOn;
  }

  lightsOn = false;

  private readInput() {
    const k = this.keys;
    const throttle = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    const brake = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    const left = k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0;
    const right = k.has('KeyD') || k.has('ArrowRight') ? 1 : 0;
    this.input.throttle = this.touch.throttle || throttle;
    this.input.brake = this.touch.brake || brake;
    this.input.steer = THREE.MathUtils.clamp(this.touch.steer + (right - left), -1, 1);
    this.input.handbrake = this.touch.handbrake || k.has('Space');
    if (this.touch.reset) {
      this.touch.reset = false;
      this.car.recover(this.world);
    }
    if (this.touch.cam) {
      this.touch.cam = false;
      this.cycleCamera();
    }
  }

  touch = { steer: 0, throttle: 0, brake: 0, handbrake: false, reset: false, cam: false };

  /* ---------------- simulation ---------------- */
  private tick(dt: number) {
    this.readInput();

    // fixed-step physics
    const step = 1 / 120;
    this.accum += dt;
    let iterations = 0;
    while (this.accum >= step && iterations < 6) {
      const prevGear = this.car.gear;
      this.car.update(step, this.input, this.world, this.settings);
      if (prevGear !== this.car.gear && this.settings.sfx > 0) driveAudio.shift();
      this.accum -= step;
      iterations++;
    }
    if (iterations >= 6) this.accum = 0;

    this.traffic.collide(this.car.pos, 2.3, (n, _pos) => {
      if (n > 0.25) {
        this.car.vel.multiplyScalar(0.72);
        this.car.damage = Math.min(100, this.car.damage + n * 3);
        this.camShake = Math.min(1.1, n * 0.5);
        driveAudio.impact(n * 6);
      }
    });

    const playerVel = new THREE.Vector3();
    this.traffic.update(dt, this.car.pos, playerVel.set(this.car.vel.x, 0, this.car.vel.z));

    this.env.update(dt, this.scene, this.settings);
    this.updateVisualsOnly(dt);
    this.updateAudio(dt);
    this.emitHud(dt);
  }

  private updateVisualsOnly(dt: number) {
    // sync car model
    this.carModel.group.position.copy(this.car.pos);
    this.carModel.group.quaternion.copy(this.car.quat);
    this.carModel.wheels.forEach((w, i) => {
      const vw = this.car.wheels[i];
      const steerTarget = i < 2 ? this.car.steerAngle : 0;
      w.steer.rotation.y += (steerTarget - w.steer.rotation.y) * Math.min(1, dt * 14);
      w.spin.rotation.x = vw.spin;
      // suspension travel: wheel hangs from the spring at (rest - compression)
      w.steer.position.y = -(0.4 - vw.compression);
    });

    // body roll & dive visual
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.quat);
    const accel = this.car.vel.clone().sub(this.prevVel).length() / Math.max(dt, 0.001);
    this.prevVel.copy(this.car.vel);
    const pitch = THREE.MathUtils.clamp(-accel * 0.0016 * Math.sign(this.car.vel.dot(fwd)), -0.05, 0.05);
    this.carModel.body.rotation.x += (pitch - this.carModel.body.rotation.x) * Math.min(1, dt * 6);
    const localLat = new THREE.Vector3(1, 0, 0).applyQuaternion(this.car.quat).dot(this.car.vel);
    const roll = THREE.MathUtils.clamp(localLat * 0.0045, -0.06, 0.06);
    this.carModel.body.rotation.z += (roll - this.carModel.body.rotation.z) * Math.min(1, dt * 6);

    // lights
    const night = 1 - this.env.state.light;
    const lightsActive = this.lightsOn || night > 0.35;
    this.headLights.forEach((h) => (h.intensity = lightsActive ? 260 : 0));
    this.carModel.headMat.emissiveIntensity = lightsActive ? 2.6 : 0.25;
    const braking = this.input.brake > 0.05;
    this.carModel.brakeMat.emissiveIntensity = braking ? 3.2 : lightsActive ? 0.9 : 0.18;
    const reversing = this.car.gear === -1 || (this.car.vel.dot(fwd) < -0.5);
    this.carModel.reverseMat.emissiveIntensity = reversing ? 2.4 : 0;

    // shadow frustum follows the car
    this.env.sun.target.position.copy(this.car.pos);
    this.env.sun.target.updateMatrixWorld();

    this.updateCamera(dt);
  }

  private prevVel = new THREE.Vector3();

  private updateCamera(dt: number) {
    const carPos = this.car.pos;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.quat);
    const speed = this.car.speed;
    let desired = new THREE.Vector3();
    let lookAt = new THREE.Vector3();
    let lerpRate = 4;

    if (this.camMode === 'chase' || this.camMode === 'far' || this.camMode === 'cinematic') {
      const base = this.camMode === 'far' ? this.settings.camDistance * 1.9 : this.camMode === 'cinematic' ? 10.5 : this.settings.camDistance;
      const height = this.camMode === 'cinematic' ? 3.6 : 2.55 + speed * 0.014;
      const back = base + speed * 0.055;
      const flatFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      // camera swings with steering for a dynamic feel
      const swing = THREE.MathUtils.clamp(this.car.steerAngle * (0.6 + speed * 0.03), -0.5, 0.5);
      const rotated = flatFwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -swing * 0.55);
      desired.copy(carPos).addScaledVector(rotated, -back).setY(carPos.y + height);
      lookAt.copy(carPos).addScaledVector(flatFwd, 6 + speed * 0.12).setY(carPos.y + 1.15);
      lerpRate = (3.2 + speed * 0.06) * (0.6 + 0.6 * this.settings.camSensitivity);
      if (this.camMode === 'cinematic') {
        const t = performance.now() * 0.00035;
        desired.add(new THREE.Vector3(Math.sin(t) * 5.5, Math.sin(t * 1.7) * 1.4, Math.cos(t * 0.8) * 5.5));
      }
    } else {
      // hood / cockpit view
      const seat = new THREE.Vector3(-0.4, 0.42, 0.15).applyQuaternion(this.car.quat).add(carPos);
      desired.copy(seat);
      lookAt.copy(seat).addScaledVector(fwd, 12).setY(seat.y + 0.2);
      lerpRate = 22;
    }

    // camera collision: pull in front of any building between car and camera
    if (this.camMode !== 'hood') {
      const dir = desired.clone().sub(carPos);
      const dist = dir.length();
      dir.normalize();
      const hit = this.raycastBoxes(carPos, dir, dist);
      if (hit < dist) {
        desired.copy(carPos).addScaledVector(dir, Math.max(1.6, hit - 0.6));
        desired.y = Math.max(desired.y, this.world.heightAt(desired.x, desired.z) + 1.1);
      }
    }
    const groundY = this.world.heightAt(desired.x, desired.z) + (this.camMode === 'hood' ? 0.1 : 0.75);
    if (desired.y < groundY) desired.y = groundY;

    const k = 1 - Math.exp(-lerpRate * dt);
    this.camPos.lerp(desired, k);
    this.camLook.lerp(lookAt, 1 - Math.exp(-(lerpRate * 1.6) * dt));

    // shake
    this.camShake = Math.max(0, this.camShake - dt * 2.4);
    const shakeAmp = this.camShake * 0.22 + (this.car.slipAmount * speed * 0.0016);
    this.camera.position.copy(this.camPos);
    if (shakeAmp > 0.0005) {
      this.camera.position.x += (Math.random() - 0.5) * shakeAmp;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmp;
      this.camera.position.z += (Math.random() - 0.5) * shakeAmp;
    }
    this.camera.lookAt(this.camLook);
    const targetFov = (this.camMode === 'hood' ? 72 : 60) + Math.min(16, speed * 0.24);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
    this.fogNear.copy(this.camPos);
  }

  private rayRay = new THREE.Ray();
  private raycastBoxes(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
    this.rayRay.set(origin, dir);
    const box = new THREE.Box3();
    const hitPoint = new THREE.Vector3();
    let best = maxDist;
    const boxes = this.world.nearColliders(origin.x + dir.x * maxDist * 0.5, origin.z + dir.z * maxDist * 0.5);
    for (const b of boxes) {
      box.min.set(b.x0, b.y0, b.z0);
      box.max.set(b.x1, b.y1, b.z1);
      if (this.rayRay.intersectBox(box, hitPoint)) {
        const d = hitPoint.distanceTo(origin);
        if (d < best) best = d;
      }
    }
    return best;
  }

  private updateAudio(dt: number) {
    this.hornTimer -= dt;
    if (this.horn) {
      driveAudio.horn(true);
      this.horn = false;
      this.hornTimer = 0.4;
    }
    const load = this.input.throttle * 0.7 + this.car.rpm / 8600 * 0.3;
    driveAudio.updateEngine(
      this.car.rpm,
      load,
      this.car.speed,
      this.car.drifting ? Math.min(1, this.car.slipAmount) : 0,
      this.env.wetAmount,
      !this.paused,
      this.settings.master <= 0.001,
    );
    if (this.car.gear !== this.gearSound) this.gearSound = this.car.gear;
  }

  private emitHud(dt: number) {
    this.lastHud += dt;
    if (this.lastHud < 0.06) return;
    this.lastHud = 0;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.quat);
    this.cb.onHud?.({
      speed: Math.max(0, this.car.vel.dot(fwd) * 3.6),
      rpm: this.car.rpm,
      gear: this.car.gear,
      maxRpm: 8600,
      fuel: this.car.fuel,
      damage: this.car.damage,
      handbrake: this.input.handbrake,
      lightsOn: this.lightsOn || this.env.state.light < 0.5,
      reverse: this.car.gear === -1,
      x: this.car.pos.x,
      z: this.car.pos.z,
      heading: Math.atan2(fwd.x, fwd.z),
      gearLabel: this.car.gear === -1 ? 'R' : this.car.gear === 0 ? 'N' : String(this.car.gear),
      odometer: this.car.odometer,
      drifting: this.car.drifting,
    });
  }

  /* ---------------- helpers for UI ---------------- */
  minimapGeometry() {
    return this.world.mapGeometry();
  }
  playerPos() {
    return { x: this.car.pos.x, z: this.car.pos.z, heading: Math.atan2(this.car.forward.x, this.car.forward.z) };
  }
  trafficPositions() {
    return this.traffic.cars.map((c) => ({ x: c.obj.position.x, z: c.obj.position.z }));
  }
}
