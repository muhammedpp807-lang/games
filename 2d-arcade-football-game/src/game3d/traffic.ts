import * as THREE from 'three';
import { createTrafficCar } from './car';
import { PLATE, ROAD_W, World, xRoad, zRoad } from './world';

interface Agent {
  obj: THREE.Group;
  i: number;
  j: number;
  dir: 0 | 1 | 2 | 3; // +x, +z, -x, -z
  t: number; // progress along the current edge 0..1
  speed: number;
  desired: number;
  stopped: boolean;
}

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export class Traffic {
  cars: Agent[] = [];
  peds: { mesh: THREE.Object3D; x: number; z: number; dir: number; speed: number; phase: number }[] = [];
  group = new THREE.Group();
  cycle = 0;
  private bounds = { i: 0, j: 0 };

  constructor(scene: THREE.Scene, private world: World, density: number, quality: string) {
    const colors = [0x2b3a55, 0x8e8e93, 0xb0b4b8, 0x1f1f22, 0x7a1f1f, 0x1f4d3a, 0x9a7b2f, 0x3c4b6b, 0xd8d8d8, 0x5a2d82];
    const count = Math.round(THREE.MathUtils.clamp(20 * density, 6, 34));
    for (let k = 0; k < count; k++) {
      const car = createTrafficCar(colors[k % colors.length]);
      const i = Math.floor(Math.random() * (xRoad.length - 1));
      const j = Math.floor(Math.random() * (zRoad.length - 1));
      const dir = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
      const a: Agent = {
        obj: car,
        i,
        j,
        dir,
        t: Math.random(),
        speed: 8 + Math.random() * 9,
        desired: 9 + Math.random() * 10,
        stopped: false,
      };
      this.cars.push(a);
      this.group.add(car);
    }
    scene.add(this.group);

    this.bounds = { i: xRoad.length - 1, j: zRoad.length - 1 };

    // pedestrians on the sidewalks of the central blocks
    const pedCount = quality === 'low' ? 14 : 30;
    const pedGeo = new THREE.CapsuleGeometry(0.22, 0.9, 4, 8);
    pedGeo.translate(0, 0.85, 0);
    const pedMesh = new THREE.InstancedMesh(
      pedGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
      pedCount,
    );
    const m = new THREE.Matrix4();
    for (let p = 0; p < pedCount; p++) {
      const alongX = Math.random() < 0.5;
      const line = alongX ? zRoad[Math.floor(Math.random() * zRoad.length)] : xRoad[Math.floor(Math.random() * xRoad.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = alongX ? PLATE.x0 + Math.random() * (PLATE.x1 - PLATE.x0) : line + side * (ROAD_W / 2 + 1.6);
      const z = alongX ? line + side * (ROAD_W / 2 + 1.6) : PLATE.z0 + Math.random() * (PLATE.z1 - PLATE.z0);
      this.peds.push({ mesh: pedMesh, x, z, dir: Math.random() * Math.PI * 2, speed: 0.9 + Math.random() * 0.8, phase: Math.random() * 6 });
      pedMesh.setColorAt(p, new THREE.Color().setHSL(Math.random(), 0.45, 0.55));
    }
    void m;
    pedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(pedMesh);
    this.pedMesh = pedMesh;
  }

  pedMesh!: THREE.InstancedMesh;

  private lightGreen(i: number, j: number) {
    const phase = ((i + j) % 2) * 0.5;
    return (this.cycle + phase) % 1 < 0.46;
  }

  private nodePos(i: number, j: number) {
    const ii = THREE.MathUtils.clamp(i, 0, xRoad.length - 1);
    const jj = THREE.MathUtils.clamp(j, 0, zRoad.length - 1);
    return new THREE.Vector3(xRoad[ii], 0, zRoad[jj]);
  }

  update(dt: number, player: THREE.Vector3, playerVel: THREE.Vector3) {
    this.cycle = (this.cycle + dt / 16) % 1;

    for (const a of this.cars) {
      const from = this.nodePos(a.i, a.j);
      const d = DIRS[a.dir];
      const ni = a.i + d[0];
      const nj = a.j + d[1];
      const to = this.nodePos(ni, nj);
      const len = Math.max(1, from.distanceTo(to));

      // desired position with right-hand lane offset
      const lane = new THREE.Vector3(-d[1], 0, d[0]).multiplyScalar(4.2);
      const p = from.clone().lerp(to, a.t).add(lane);
      p.y = 0;
      a.obj.position.copy(p);
      const heading = Math.atan2(d[0], d[1]);
      a.obj.rotation.y = heading;

      // --- decide speed ---
      let target = a.desired;

      // traffic light at the node ahead
      const distToNode = (1 - a.t) * len;
      const green = this.lightGreen(ni, nj);
      if (!green && distToNode < 16 && distToNode > 1) {
        target = Math.min(target, Math.max(0, (distToNode - 4) * 0.85));
        a.stopped = true;
      } else {
        a.stopped = false;
      }

      // keep distance from other traffic ahead
      for (const b of this.cars) {
        if (b === a) continue;
        const dx = b.obj.position.x - a.obj.position.x;
        const dz = b.obj.position.z - a.obj.position.z;
        const along = dx * d[0] + dz * d[1];
        const side = Math.abs(dx * -d[1] + dz * d[0]);
        if (along > 0 && along < 13 && side < 3.2) {
          target = Math.min(target, Math.max(0, b.speed * 0.85 + (along - 8) * 0.8));
        }
      }

      // react to the player's car
      const pdx = player.x - a.obj.position.x;
      const pdz = player.z - a.obj.position.z;
      const pAlong = pdx * d[0] + pdz * d[1];
      const pSide = Math.abs(pdx * -d[1] + pdz * d[0]);
      const pSpeed = playerVel.length();
      if (pAlong > 0 && pAlong < 16 && pSide < 3.4) {
        target = Math.min(target, Math.max(0, pSpeed * 0.9 + (pAlong - 9) * 0.9));
      }

      a.speed += THREE.MathUtils.clamp(target - a.speed, -14 * dt, 5 * dt);
      a.speed = Math.max(0, a.speed);
      a.t += (a.speed * dt) / len;

      if (a.t >= 1) {
        a.t = 0;
        a.i = THREE.MathUtils.clamp(ni, 0, this.bounds.i);
        a.j = THREE.MathUtils.clamp(nj, 0, this.bounds.j);
        // choose a new direction: prefer straight, never reverse
        const options: number[] = [];
        for (let k = 0; k < 4; k++) {
          if ((k + 2) % 4 === a.dir) continue;
          const ti = a.i + DIRS[k][0];
          const tj = a.j + DIRS[k][1];
          if (ti < 0 || ti > this.bounds.i || tj < 0 || tj > this.bounds.j) continue;
          const weight = k === a.dir ? 6 : 1;
          for (let w = 0; w < weight; w++) options.push(k);
        }
        a.dir = (options.length ? options[Math.floor(Math.random() * options.length)] : (a.dir + 2) % 4) as 0 | 1 | 2 | 3;
      }
    }

    // pedestrians
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    this.peds.forEach((p, idx) => {
      p.x += Math.cos(p.dir) * p.speed * dt;
      p.z += Math.sin(p.dir) * p.speed * dt;
      if (!this.world.drivable(p.x, p.z) || Math.random() < 0.002) p.dir += Math.PI * (0.5 + Math.random());
      p.phase += dt * p.speed * 5;
      const bob = Math.abs(Math.sin(p.phase)) * 0.06;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -p.dir + Math.PI / 2);
      m.compose(new THREE.Vector3(p.x, bob, p.z), q, s);
      this.pedMesh.setMatrixAt(idx, m);
    });
    this.pedMesh.instanceMatrix.needsUpdate = true;
  }

  /** Simple impulse response so the player can knock traffic. */
  collide(player: THREE.Vector3, radius: number, applyImpact: (n: number, pos: THREE.Vector3) => void) {
    for (const a of this.cars) {
      const dx = a.obj.position.x - player.x;
      const dz = a.obj.position.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d < radius + 2.1 && d > 0.001) {
        const push = (radius + 2.1 - d) * 0.75;
        a.obj.position.x -= (dx / d) * push;
        a.obj.position.z -= (dz / d) * push;
        a.speed *= 0.35;
        applyImpact(push, a.obj.position);
      }
    }
  }
}
