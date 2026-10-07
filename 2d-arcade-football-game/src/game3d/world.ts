import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Quality } from './settings';

/* ============================================================
   CITY PLAN — derived from the supplied map reference:
   dense Manhattan-style grid, red suspension bridge to the west,
   container port with gantry cranes to the north-west,
   airport with runway to the east, warehouses to the south-west,
   bay water surrounding the plate.
   ============================================================ */

export const PITCH = 70;
export const ROAD_W = 16;
export const NX = 13;
export const NZ = 12;

export const xRoad: number[] = [];
export const zRoad: number[] = [];
for (let i = 0; i < NX; i++) xRoad.push(-420 + i * PITCH);
for (let j = 0; j < NZ; j++) zRoad.push(-385 + j * PITCH);

export const PLATE = { x0: -442, x1: 442, z0: -407, z1: 407 };
export const BRIDGE = { x0: -1090, x1: -442, halfW: 14 };
export const PORT = { x0: -430, x1: -50, z0: -640, z1: -407 };
export const AIRPORT = { x0: 442, x1: 800, z0: -320, z1: 320 };
export const INDUSTRIAL = { x0: -430, x1: -60, z0: 407, z1: 630 };

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

interface InstRec {
  matrix: THREE.Matrix4;
}

export type District = 'downtown' | 'mid' | 'low' | 'park' | 'industrial' | 'port' | 'airport';

const CELL = 90;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function districtAt(i: number, j: number): District {
  if (i <= 1 && j <= 2) return 'port';
  if (i >= NX - 2) return 'airport';
  if (i <= 2 && j >= NZ - 3) return 'industrial';
  const nx = i / (NX - 1) - 0.5;
  const nz = j / (NZ - 1) - 0.5;
  const d = Math.hypot(nx * 2.1, nz * 2.1);
  const h = rng(i * 977 + j * 331 + 7)();
  if (d < 0.42) return h < 0.12 ? 'park' : 'downtown';
  if (d < 0.85) return h < 0.16 ? 'park' : 'mid';
  return h < 0.14 ? 'park' : 'low';
}

export function bridgeHeight(x: number) {
  if (x > BRIDGE.x1) return 0;
  const t = THREE.MathUtils.clamp((BRIDGE.x1 - x) / (BRIDGE.x1 - BRIDGE.x0), 0, 1);
  const ramp = THREE.MathUtils.clamp((BRIDGE.x1 - x) / 80, 0, 1);
  return 46 * Math.pow(Math.sin(Math.PI * t), 0.85) * ramp;
}

export class World {
  group = new THREE.Group();
  colliders: Box[] = [];
  grid = new Map<string, number[]>();
  lamps: THREE.Vector3[] = [];
  districts: District[][] = [];
  minimapDirty = true;
  private cellSize = CELL;
  sun!: THREE.DirectionalLight;
  buildingMats: THREE.MeshStandardMaterial[] = [];

  constructor(quality: Quality) {
    this.buildDistricts();
    this.buildGround();
    this.buildRoads();
    this.buildBlocks(quality);
    this.buildBridge();
    this.buildPort();
    this.buildAirport();
    this.buildIndustrial();
    this.buildLamps();
  }

  /* ---------------- terrain queries ---------------- */
  heightAt(x: number, z: number) {
    if (x < BRIDGE.x1 && Math.abs(z) <= BRIDGE.halfW + 2) return bridgeHeight(x);
    return 0;
  }

  normalAt(x: number, z: number, out: THREE.Vector3) {
    const d = 2.5;
    const hL = this.heightAt(x - d, z);
    const hR = this.heightAt(x + d, z);
    const hD = this.heightAt(x, z - d);
    const hU = this.heightAt(x, z + d);
    return out.set(hL - hR, 2 * d, hD - hU).normalize();
  }

  rects: { x0: number; x1: number; z0: number; z1: number }[] = [
    { x0: PLATE.x0, x1: PLATE.x1, z0: PLATE.z0, z1: PLATE.z1 },
    { x0: BRIDGE.x0, x1: BRIDGE.x1, z0: -BRIDGE.halfW, z1: BRIDGE.halfW },
    { x0: PORT.x0, x1: PORT.x1, z0: PORT.z0, z1: PORT.z1 },
    { x0: PLATE.x0 - 40, x1: -230, z0: PORT.z1, z1: PORT.z1 + 40 },
    { x0: AIRPORT.x0, x1: AIRPORT.x1, z0: AIRPORT.z0, z1: AIRPORT.z1 },
    { x0: 330, x1: AIRPORT.x0 + 40, z0: -25, z1: 25 },
    { x0: INDUSTRIAL.x0, x1: INDUSTRIAL.x1, z0: INDUSTRIAL.z0, z1: INDUSTRIAL.z1 },
    { x0: -280, x1: -230, z0: PLATE.z1, z1: INDUSTRIAL.z0 + 20 },
  ];

  drivable(x: number, z: number) {
    for (const r of this.rects) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
    return false;
  }

  /** Keeps the vehicle inside the drivable map area. */
  clamp(pos: THREE.Vector3) {
    if (this.drivable(pos.x, pos.z)) return null;
    let best: { x: number; z: number; d: number } | null = null;
    for (const r of this.rects) {
      const cx = THREE.MathUtils.clamp(pos.x, r.x0, r.x1);
      const cz = THREE.MathUtils.clamp(pos.z, r.z0, r.z1);
      const d = (cx - pos.x) ** 2 + (cz - pos.z) ** 2;
      if (!best || d < best.d) best = { x: cx, z: cz, d };
    }
    if (!best) return null;
    return new THREE.Vector3(best.x, this.heightAt(best.x, best.z), best.z);
  }

  /* ---------------- content ---------------- */
  private buildDistricts() {
    for (let i = 0; i < NX - 1; i++) {
      const row: District[] = [];
      for (let j = 0; j < NZ - 1; j++) row.push(districtAt(i, j));
      this.districts.push(row);
    }
  }

  private tex(draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  private buildGround() {
    // bay water
    const waterTex = this.tex((c, w, h) => {
      c.fillStyle = '#123a52';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) {
        c.fillStyle = `rgba(${120 + Math.random() * 80},${190 + Math.random() * 60},230,${Math.random() * 0.25})`;
        c.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 26, 1.5);
      }
    }, 512, 512);
    waterTex.repeat.set(60, 60);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(4200, 4200),
      new THREE.MeshStandardMaterial({
        map: waterTex,
        color: 0x2f6f8f,
        roughness: 0.08,
        metalness: 0.5,
        transparent: true,
        opacity: 0.96,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.55;
    this.group.add(water);

    // city plate (concrete base)
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE.x1 - PLATE.x0, 1.4, PLATE.z1 - PLATE.z0),
      new THREE.MeshStandardMaterial({ color: 0x8b8f92, roughness: 0.92, metalness: 0.02 }),
    );
    plate.position.set((PLATE.x0 + PLATE.x1) / 2, -0.7, (PLATE.z0 + PLATE.z1) / 2);
    plate.receiveShadow = true;
    this.group.add(plate);

    for (const r of [
      { x0: PORT.x0, x1: PORT.x1, z0: PORT.z0, z1: PORT.z1 },
      { x0: AIRPORT.x0, x1: AIRPORT.x1, z0: AIRPORT.z0, z1: AIRPORT.z1 },
      { x0: INDUSTRIAL.x0, x1: INDUSTRIAL.x1, z0: INDUSTRIAL.z0, z1: INDUSTRIAL.z1 },
      { x0: PLATE.x0 - 40, x1: -230, z0: PORT.z1, z1: PORT.z1 + 40 },
      { x0: 330, x1: AIRPORT.x0 + 40, z0: -25, z1: 25 },
      { x0: -280, x1: -230, z0: PLATE.z1, z1: INDUSTRIAL.z0 + 20 },
    ]) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(r.x1 - r.x0, 1.4, r.z1 - r.z0),
        new THREE.MeshStandardMaterial({ color: 0x84888b, roughness: 0.94 }),
      );
      m.position.set((r.x0 + r.x1) / 2, -0.7, (r.z0 + r.z1) / 2);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  private buildRoads() {
    const asphalt = this.tex((c, w, h) => {
      c.fillStyle = '#3b3d40';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) {
        const g = 40 + Math.random() * 45;
        c.fillStyle = `rgba(${g},${g},${g + 3},${Math.random() * 0.5})`;
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // edge lines
      c.fillStyle = 'rgba(235,235,225,0.85)';
      c.fillRect(10, 0, 4, h);
      c.fillRect(w - 14, 0, 4, h);
      // centre dashes
      for (let y = 0; y < h; y += 64) {
        c.fillStyle = 'rgba(245,215,80,0.9)';
        c.fillRect(w / 2 - 3, y, 6, 38);
      }
    }, 256, 256);
    asphalt.wrapT = THREE.RepeatWrapping;

    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.72, metalness: 0.05 });
    const geos: THREE.BufferGeometry[] = [];

    const addStrip = (x: number, z: number, len: number, alongX: boolean, w = ROAD_W) => {
      const g = new THREE.PlaneGeometry(w, len, 1, 1);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * (len / 26));
      g.rotateX(-Math.PI / 2);
      if (alongX) g.rotateY(Math.PI / 2);
      g.translate(x, 0.02, z);
      geos.push(g);
    };

    for (let j = 0; j < NZ; j++) addStrip(0, zRoad[j], PLATE.x1 - PLATE.x0, true);
    for (let i = 0; i < NX; i++) addStrip(xRoad[i], 0, PLATE.z1 - PLATE.z0, false);

    // connectors to the port / airport / industrial extensions
    addStrip((PORT.x0 + PORT.x1) / 2, (PORT.z1 + PLATE.z0) / 2 + 6, 60, false, 14);
    addStrip((AIRPORT.x0 + PLATE.x1) / 2 + 6, 0, 110, true, 14);
    addStrip(-255, (PLATE.z1 + INDUSTRIAL.z0) / 2, 70, false, 14);
    addStrip((PORT.x0 + PORT.x1) / 2, PORT.z1 - 20, PORT.x1 - PORT.x0, true, 14);
    addStrip((AIRPORT.x0 + 30), 0, AIRPORT.z1 - AIRPORT.z0, false, 14);

    const roads = new THREE.Mesh(mergeGeometries(geos)!, roadMat);
    roads.receiveShadow = true;
    this.group.add(roads);
  }

  private buildBlocks(quality: Quality) {
    const rand = rng(20260117);
    const facade = (cols: number, rows: number, base: string, glass: boolean) =>
      this.tex((c, w, h) => {
        c.fillStyle = base;
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
          c.fillRect(Math.random() * w, Math.random() * h, 3, 3);
        }
        const cw = w / cols;
        const ch = h / rows;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const lit = Math.random();
            const px = x * cw + cw * 0.18;
            const py = y * ch + ch * 0.2;
            const pw = cw * 0.64;
            const ph = ch * 0.5;
            if (glass) {
              c.fillStyle = lit > 0.55 ? '#bfe3f5' : lit > 0.3 ? '#8fb6c9' : '#5d7f92';
            } else {
              c.fillStyle = lit > 0.72 ? '#ffe6a8' : '#2b3540';
            }
            c.fillRect(px, py, pw, ph);
            c.strokeStyle = 'rgba(0,0,0,0.35)';
            c.lineWidth = 1;
            c.strokeRect(px, py, pw, ph);
          }
        }
      }, 256, 256);

    const compose = (cx: number, cy: number, cz: number, w: number, h: number, d: number, ry = 0) => {
      const m = new THREE.Matrix4();
      m.compose(
        new THREE.Vector3(cx, cy, cz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
        new THREE.Vector3(w, h, d),
      );
      return m;
    };

    const classes: { list: InstRec[]; mat: THREE.MeshStandardMaterial }[] = [
      {
        list: [],
        mat: new THREE.MeshStandardMaterial({ map: facade(10, 22, '#6d7a86', true), roughness: 0.18, metalness: 0.72, emissive: 0x22262c, emissiveIntensity: 0 }),
      },
      {
        list: [],
        mat: new THREE.MeshStandardMaterial({ map: facade(7, 10, '#8d8577', false), roughness: 0.68, metalness: 0.08, emissive: 0x2a2415, emissiveIntensity: 0 }),
      },
      {
        list: [],
        mat: new THREE.MeshStandardMaterial({ map: facade(5, 4, '#a08b76', false), roughness: 0.82, metalness: 0.04, emissive: 0x33230f, emissiveIntensity: 0 }),
      },
    ];
    this.buildingMats = classes.map((c) => c.mat);

    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);

    const sidewalkGeos: THREE.BufferGeometry[] = [];
    const grassGeos: THREE.BufferGeometry[] = [];
    const trunkGeos: THREE.BufferGeometry[] = [];
    const leafGeos: THREE.BufferGeometry[] = [];
    const roofGeos: THREE.BufferGeometry[] = [];

    for (let i = 0; i < NX - 1; i++) {
      for (let j = 0; j < NZ - 1; j++) {
        const d = this.districts[i][j];
        const bx0 = xRoad[i] + ROAD_W / 2 + 1.5;
        const bx1 = xRoad[i + 1] - ROAD_W / 2 - 1.5;
        const bz0 = zRoad[j] + ROAD_W / 2 + 1.5;
        const bz1 = zRoad[j + 1] - ROAD_W / 2 - 1.5;

        if (d === 'park') {
          const g = new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0);
          g.rotateX(-Math.PI / 2);
          g.translate((bx0 + bx1) / 2, 0.14, (bz0 + bz1) / 2);
          grassGeos.push(g);
          // trees
          for (let t = 0; t < 16; t++) {
            const tx = bx0 + rand() * (bx1 - bx0);
            const tz = bz0 + rand() * (bz1 - bz0);
            const s = 0.8 + rand() * 0.8;
            const trunk = new THREE.CylinderGeometry(0.35, 0.5, 3.4, 5);
            trunk.translate(tx, 1.7, tz);
            trunkGeos.push(trunk);
            const leaf = new THREE.IcosahedronGeometry(2.6 * s, 0);
            leaf.scale(1, 1.15, 1);
            leaf.translate(tx, 3.2 + 2.4 * s, tz);
            leafGeos.push(leaf);
          }
          continue;
        }

        // sidewalk base
        const sw = new THREE.BoxGeometry(bx1 - bx0 + 4, 0.28, bz1 - bz0 + 4);
        sw.translate((bx0 + bx1) / 2, 0.14, (bz0 + bz1) / 2);
        sidewalkGeos.push(sw);

        if (d === 'port' || d === 'airport') continue;

        if (d === 'industrial') {
          const n = 1 + Math.floor(rand() * 2);
          for (let k = 0; k < n; k++) {
            const w = (bx1 - bx0) * (0.4 + rand() * 0.3);
            const dd = (bz1 - bz0) * (0.4 + rand() * 0.3);
            const cx = bx0 + w / 2 + rand() * (bx1 - bx0 - w);
            const cz = bz0 + dd / 2 + rand() * (bz1 - bz0 - dd);
            const h = 7 + rand() * 6;
            classes[2].list.push({ matrix: compose(cx, 0.28, cz, w, h, dd, rand() * 0.3 - 0.15) });
            this.addCollider({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - dd / 2, z1: cz + dd / 2, y0: 0, y1: h });
            const roof = new THREE.CylinderGeometry(w * 0.42, w * 0.42, dd, 12, 1, false, 0, Math.PI);
            roof.rotateX(Math.PI / 2);
            roof.rotateY(Math.PI / 2);
            roof.translate(cx, 0.28 + h, cz);
            roofGeos.push(roof);
          }
          continue;
        }

        const cls = d === 'downtown' ? 0 : d === 'mid' ? 1 : 2;
        const cells = d === 'downtown' ? 1 : d === 'mid' ? 2 : 3;
        const step = (bx1 - bx0) / cells;
        const stepZ = (bz1 - bz0) / cells;
        for (let a = 0; a < cells; a++) {
          for (let b = 0; b < cells; b++) {
            if (rand() < 0.12) continue;
            const pad = 1.4;
            const w = step - pad * 2;
            const dd = stepZ - pad * 2;
            const cx = bx0 + step * a + step / 2;
            const cz = bz0 + stepZ * b + stepZ / 2;
            let h: number;
            if (d === 'downtown') h = 46 + rand() * 88;
            else if (d === 'mid') h = 18 + rand() * 34;
            else h = 8 + rand() * 14;
            classes[cls].list.push({ matrix: compose(cx, 0.28, cz, w, h, dd) });
            this.addCollider({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - dd / 2, z1: cz + dd / 2, y0: 0, y1: h });
            if (d !== 'downtown' && rand() < 0.5) {
              const r = new THREE.BoxGeometry(w * 0.5, 1.6, dd * 0.5);
              r.translate(cx, 0.28 + h + 0.8, cz);
              roofGeos.push(r);
            }
          }
        }
      }
    }

    const swMat = new THREE.MeshStandardMaterial({ color: 0x9d9f9f, roughness: 0.9 });
    const swMesh = new THREE.Mesh(mergeGeometries(sidewalkGeos)!, swMat);
    swMesh.receiveShadow = true;
    this.group.add(swMesh);

    if (grassGeos.length) {
      const grass = new THREE.Mesh(
        mergeGeometries(grassGeos)!,
        new THREE.MeshStandardMaterial({ color: 0x5f8f45, roughness: 0.95 }),
      );
      grass.receiveShadow = true;
      this.group.add(grass);
    }
    if (roofGeos.length) {
      const roofs = new THREE.Mesh(
        mergeGeometries(roofGeos)!,
        new THREE.MeshStandardMaterial({ color: 0x6f7376, roughness: 0.85 }),
      );
      roofs.castShadow = quality !== 'low';
      this.group.add(roofs);
    }
    if (trunkGeos.length) {
      const trunks = new THREE.Mesh(
        mergeGeometries(trunkGeos)!,
        new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.95 }),
      );
      this.group.add(trunks);
      const leaves = new THREE.Mesh(
        mergeGeometries(leafGeos)!,
        new THREE.MeshStandardMaterial({ color: 0x3f7a33, roughness: 0.9, flatShading: true }),
      );
      leaves.castShadow = quality !== 'low';
      this.group.add(leaves);
    }

    classes.forEach((c) => {
      if (!c.list.length) return;
      const im = new THREE.InstancedMesh(box, c.mat, c.list.length);
      c.list.forEach((rec, idx) => {
        im.setMatrixAt(idx, rec.matrix);
        const shade = 0.8 + ((idx * 37) % 23) / 55;
        im.setColorAt(idx, new THREE.Color(shade, shade, shade));
      });
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = quality !== 'low';
      im.receiveShadow = quality === 'high' || quality === 'ultra';
      im.instanceMatrix.needsUpdate = true;
      this.group.add(im);
    });
  }

  private addCollider(b: Box) {
    const idx = this.colliders.push(b) - 1;
    const cx0 = Math.floor(b.x0 / this.cellSize);
    const cx1 = Math.floor(b.x1 / this.cellSize);
    const cz0 = Math.floor(b.z0 / this.cellSize);
    const cz1 = Math.floor(b.z1 / this.cellSize);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = `${cx},${cz}`;
        const arr = this.grid.get(k);
        if (arr) arr.push(idx);
        else this.grid.set(k, [idx]);
      }
  }

  nearColliders(x: number, z: number): Box[] {
    const out: Box[] = [];
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const arr = this.grid.get(`${cx + a},${cz + b}`);
        if (arr) for (const i of arr) if (!out.includes(this.colliders[i])) out.push(this.colliders[i]);
      }
    return out;
  }

  /* ---------------- bridge ---------------- */
  private buildBridge() {
    const red = new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.55, metalness: 0.35 });
    const g = new THREE.Group();
    const segs = 64;
    const len = BRIDGE.x1 - BRIDGE.x0;
    const deckGeos: THREE.BufferGeometry[] = [];
    for (let s = 0; s < segs; s++) {
      const xa = BRIDGE.x0 + (len * s) / segs;
      const xb = BRIDGE.x0 + (len * (s + 1)) / segs;
      const ha = bridgeHeight(xa);
      const hb = bridgeHeight(xb);
      const w = BRIDGE.halfW * 2;
      const box = new THREE.BoxGeometry(Math.hypot(xb - xa, hb - ha), 1.1, w);
      box.rotateZ(Math.atan2(hb - ha, xb - xa));
      box.translate((xa + xb) / 2, (ha + hb) / 2 - 0.55, 0);
      deckGeos.push(box);
    }
    const deck = new THREE.Mesh(mergeGeometries(deckGeos)!, new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.8 }));
    deck.castShadow = true;
    deck.receiveShadow = true;
    g.add(deck);

    // railings (also act as soft walls)
    [-1, 1].forEach((side) => {
      const railGeos: THREE.BufferGeometry[] = [];
      for (let s = 0; s < segs; s++) {
        const xa = BRIDGE.x0 + (len * s) / segs;
        const xb = BRIDGE.x0 + (len * (s + 1)) / segs;
        const ha = bridgeHeight(xa);
        const hb = bridgeHeight(xb);
        const b = new THREE.BoxGeometry(Math.hypot(xb - xa, hb - ha), 1.3, 0.5);
        b.rotateZ(Math.atan2(hb - ha, xb - xa));
        b.translate((xa + xb) / 2, (ha + hb) / 2 + 0.65, side * (BRIDGE.halfW - 0.4));
        railGeos.push(b);
      }
      g.add(new THREE.Mesh(mergeGeometries(railGeos)!, red));
      this.addCollider({
        x0: BRIDGE.x0,
        x1: BRIDGE.x1,
        z0: side * BRIDGE.halfW - 0.6,
        z1: side * BRIDGE.halfW + 0.6,
        y0: 0,
        y1: 60,
      });
    });

    // towers + cables
    [BRIDGE.x0 + 60, BRIDGE.x1 - 200].forEach((tx) => {
      const th = bridgeHeight(tx) + 62;
      [-1, 1].forEach((side) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(7, th, 3.4), red);
        leg.position.set(tx, th / 2 - 1, side * (BRIDGE.halfW - 1.6));
        leg.castShadow = true;
        g.add(leg);
      });
      const top = new THREE.Mesh(new THREE.BoxGeometry(4, 3, BRIDGE.halfW * 2), red);
      top.position.set(tx, th, 0);
      g.add(top);
      this.addCollider({ x0: tx - 4, x1: tx + 4, z0: -BRIDGE.halfW - 1, z1: -BRIDGE.halfW + 1.5, y0: 0, y1: th });
      this.addCollider({ x0: tx - 4, x1: tx + 4, z0: BRIDGE.halfW - 1.5, z1: BRIDGE.halfW + 1, y0: 0, y1: th });
    });

    const cableMat = new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.5, metalness: 0.4 });
    [-1, 1].forEach((side) => {
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 40; s++) {
        const x = BRIDGE.x0 + (len * s) / 40;
        const h = bridgeHeight(x);
        const t1 = (BRIDGE.x0 + 60 - x) / (BRIDGE.x1 - (BRIDGE.x0 + 60));
        const t2 = (BRIDGE.x1 - 200 - x) / (BRIDGE.x1 - (BRIDGE.x0 + 60));
        const sag = Math.max(0, 1 - Math.abs(t1) * 1.0) + Math.max(0, 1 - Math.abs(t2));
        pts.push(new THREE.Vector3(x, h + 58 * Math.min(1, Math.max(0.05, sag)) + 4, side * (BRIDGE.halfW - 1.6)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.35, 5), cableMat);
      g.add(cable);
      for (let s = 2; s < 40; s += 2) {
        const x = BRIDGE.x0 + (len * s) / 40;
        const hh = bridgeHeight(x);
        const cp = curve.getPoint(s / 40);
        const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, Math.max(0.4, cp.y - hh), 4), cableMat);
        hang.position.set(x, (cp.y + hh) / 2, side * (BRIDGE.halfW - 1.6));
        g.add(hang);
      }
    });

    // end barrier
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(2, 3, BRIDGE.halfW * 2), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.7 }));
    barrier.position.set(BRIDGE.x0 + 1, bridgeHeight(BRIDGE.x0 + 1) + 1.5, 0);
    g.add(barrier);
    this.addCollider({ x0: BRIDGE.x0, x1: BRIDGE.x0 + 3, z0: -BRIDGE.halfW, z1: BRIDGE.halfW, y0: 0, y1: 80 });

    this.group.add(g);
  }

  /* ---------------- port ---------------- */
  private buildPort() {
    const g = new THREE.Group();
    const rand = rng(88);
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.4 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.1 });
    const contMats: THREE.Matrix4[] = [];
    const contColors: THREE.Color[] = [];
    const unit = new THREE.BoxGeometry(1, 1, 1);
    unit.translate(0, 0.5, 0);
    const cM = new THREE.Matrix4();

    for (let row = 0; row < 14; row++) {
      for (let c = 0; c < 26; c++) {
        if (rand() < 0.22) continue;
        const stack = 1 + Math.floor(rand() * 3);
        const x = PORT.x0 + 30 + c * 14;
        const z = PORT.z0 + 40 + row * 15;
        for (let s = 0; s < stack; s++) {
          contMats.push(
            cM.clone().compose(
              new THREE.Vector3(x, 0.4 + s * 2.95, z),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.05),
              new THREE.Vector3(12.4, 2.9, 4.6),
            ),
          );
          const palette = [0xc0392b, 0x2e86c1, 0x2874a6, 0xd68910, 0x7f8c8d, 0x1e8449];
          contColors.push(new THREE.Color(palette[Math.floor(rand() * palette.length)]));
        }
      }
    }
    const containers = new THREE.InstancedMesh(unit, boxMat, contMats.length);
    contMats.forEach((mm, i) => {
      containers.setMatrixAt(i, mm);
      containers.setColorAt(i, contColors[i]);
    });
    if (containers.instanceColor) containers.instanceColor.needsUpdate = true;
    containers.castShadow = true;
    this.group.add(containers);

    // gantry cranes
    for (let k = 0; k < 4; k++) {
      const cx = PORT.x0 + 60 + k * 105;
      const cz = PORT.z0 + 22;
      const frame = new THREE.Group();
      [-1, 1].forEach((s) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 46, 2.4), craneMat);
        leg.position.set(s * 11, 23, 0);
        leg.castShadow = true;
        frame.add(leg);
      });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 2.6, 3), craneMat);
      beam.position.set(0, 46, 0);
      beam.castShadow = true;
      frame.add(beam);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 44), craneMat);
      boom.position.set(0, 47, 16);
      frame.add(boom);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 4.4), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.5 }));
      cab.position.set(0, 38, 6);
      frame.add(cab);
      frame.position.set(cx, 0, cz);
      g.add(frame);
      this.addCollider({ x0: cx - 13, x1: cx + 13, z0: cz - 1.4, z1: cz + 1.4, y0: 0, y1: 46 });
    }
    this.group.add(g);
  }

  /* ---------------- airport ---------------- */
  private buildAirport() {
    const g = new THREE.Group();
    const runwayTex = this.tex((c, w, h) => {
      c.fillStyle = '#33363a';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const v = 40 + Math.random() * 40;
        c.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.4})`;
        c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      c.fillStyle = 'rgba(240,240,240,0.85)';
      for (let x = 20; x < w; x += 70) c.fillRect(x, h / 2 - 3, 40, 6);
      c.fillStyle = 'rgba(240,240,240,0.5)';
      c.fillRect(0, 8, w, 3);
      c.fillRect(0, h - 11, w, 3);
    }, 512, 256);
    runwayTex.repeat.set(6, 1);
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 120),
      new THREE.MeshStandardMaterial({ map: runwayTex, roughness: 0.75 }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(600, 0.04, 0);
    runway.receiveShadow = true;
    g.add(runway);

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 300),
      new THREE.MeshStandardMaterial({ color: 0x6e7276, roughness: 0.85 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(478, 0.04, 0);
    apron.receiveShadow = true;
    g.add(apron);

    const terminal = new THREE.Mesh(
      new THREE.BoxGeometry(54, 16, 120),
      new THREE.MeshStandardMaterial({ color: 0xb9c2c8, roughness: 0.35, metalness: 0.4 }),
    );
    terminal.position.set(452, 8, 0);
    terminal.castShadow = true;
    g.add(terminal);
    this.addCollider({ x0: 425, x1: 479, z0: -60, z1: 60, y0: 0, y1: 16 });

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 6.5, 38, 12),
      new THREE.MeshStandardMaterial({ color: 0xd5dbe0, roughness: 0.5, metalness: 0.3 }),
    );
    tower.position.set(470, 19, 110);
    tower.castShadow = true;
    g.add(tower);
    const cab = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 6, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x2f3b4a, roughness: 0.25, metalness: 0.6 }),
    );
    cab.position.set(470, 42, 110);
    g.add(cab);
    this.addCollider({ x0: 462, x1: 478, z0: 102, z1: 118, y0: 0, y1: 38 });
    this.group.add(g);
  }

  /* ---------------- industrial district ---------------- */
  private buildIndustrial() {
    const g = new THREE.Group();
    const rand = rng(4242);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    unit.translate(0, 0.5, 0);
    const ware = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.7, metalness: 0.2 });
    const geos: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 9; k++) {
      const w = 60 + rand() * 40;
      const d = 34 + rand() * 22;
      const x = INDUSTRIAL.x0 + 60 + (k % 3) * 120 + rand() * 20;
      const z = INDUSTRIAL.z0 + 60 + Math.floor(k / 3) * 70 + rand() * 14;
      const gg = unit.clone();
      gg.scale(w, 11, d);
      gg.translate(x, 0.2, z);
      geos.push(gg);
      this.addCollider({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: 0, y1: 11 });
      const roof = new THREE.CylinderGeometry(w * 0.5, w * 0.5, d, 14, 1, false, 0, Math.PI);
      roof.rotateX(Math.PI / 2);
      roof.rotateY(Math.PI / 2);
      roof.translate(x, 11.2, z);
      geos.push(roof);
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos)!, ware);
    mesh.castShadow = true;
    g.add(mesh);

    // silos
    const siloMat = new THREE.MeshStandardMaterial({ color: 0xe3e6e8, roughness: 0.4, metalness: 0.35 });
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 26, 14), siloMat);
      s.position.set(INDUSTRIAL.x0 + 40 + k * 15, 13, INDUSTRIAL.z1 - 30);
      s.castShadow = true;
      g.add(s);
      this.addCollider({ x0: s.position.x - 6, x1: s.position.x + 6, z0: s.position.z - 6, z1: s.position.z + 6, y0: 0, y1: 26 });
    }
    this.group.add(g);
  }

  /* ---------------- street lamps ---------------- */
  private buildLamps() {
    const pole = new THREE.CylinderGeometry(0.16, 0.22, 9, 6);
    pole.translate(0, 4.5, 0);
    const arm = new THREE.BoxGeometry(2.2, 0.18, 0.18);
    arm.translate(1.1, 9, 0);
    const head = new THREE.BoxGeometry(1.5, 0.32, 0.7);
    head.translate(2, 8.8, 0);
    const geo = mergeGeometries([pole, arm])!;
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.6, metalness: 0.6 });
    this.lampHeadMat = new THREE.MeshStandardMaterial({
      color: 0x2a2d31,
      emissive: new THREE.Color(0xffe4b0),
      emissiveIntensity: 0,
      roughness: 0.4,
    });

    const pos: THREE.Vector3[] = [];
    const step = 70;
    for (let i = 0; i < NX; i++) {
      for (let z = PLATE.z0 + 20; z < PLATE.z1; z += step) {
        pos.push(new THREE.Vector3(xRoad[i] + ROAD_W / 2 + 1.2, 0, z));
      }
    }
    for (let j = 0; j < NZ; j++) {
      for (let x = PLATE.x0 + 20; x < PLATE.x1; x += step) {
        if (Math.abs(((x - PLATE.x0) % step) - 35) < 1) continue;
        pos.push(new THREE.Vector3(x, 0, zRoad[j] + ROAD_W / 2 + 1.2));
      }
    }
    const poles = new THREE.InstancedMesh(geo, this.lampMat, pos.length);
    const heads = new THREE.InstancedMesh(head, this.lampHeadMat, pos.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    pos.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i % 2 === 0 ? 0 : Math.PI) + (i % 3) * 0.4);
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
    });
    poles.castShadow = false;
    this.group.add(poles);
    this.group.add(heads);
    this.lamps = pos;
    this.lampCount = pos.length;
  }

  lampMat!: THREE.MeshStandardMaterial;
  lampHeadMat!: THREE.MeshStandardMaterial;
  lampCount = 0;
  isWet = false;
  sky!: THREE.Mesh;

  /* ---------------- lights for the minimap ---------------- */
  mapGeometry() {
    return { xRoad, zRoad, PLATE, BRIDGE, PORT, AIRPORT, INDUSTRIAL, districts: this.districts, NX, NZ };
  }
}
