import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CarModel {
  group: THREE.Group;
  body: THREE.Group;
  wheels: { steer: THREE.Group; spin: THREE.Group }[];
  brakeMat: THREE.MeshStandardMaterial;
  reverseMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  indicatorMats: THREE.MeshStandardMaterial[];
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  wheelRadius: number;
}

/** Side profile helper → extruded, bevelled hull. */
function hull(pts: [number, number][], width: number, bevel: number) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    steps: 1,
  });
  g.translate(0, 0, -width / 2);
  g.rotateY(Math.PI / 2); // profile x (length) → world z, extrusion z (width) → world x
  g.computeVertexNormals();
  return g;
}

const mat = {
  carbon: new THREE.MeshPhysicalMaterial({ color: 0x0d0e10, metalness: 0.85, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.6, roughness: 0.45 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.05, roughness: 0.92 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x15171b, metalness: 0.9, roughness: 0.26 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.18 }),
  caliper: new THREE.MeshStandardMaterial({ color: 0xd11f2b, metalness: 0.4, roughness: 0.4 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x8f1620, metalness: 0.1, roughness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.3, roughness: 0.6 }),
};

export function createCar(envMap: THREE.Texture | null): CarModel {
  const group = new THREE.Group();
  const body = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xb1121c,
    metalness: 0.62,
    roughness: 0.19,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    envMap,
    envMapIntensity: 1.5,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a1016,
    metalness: 0.35,
    roughness: 0.06,
    transparent: true,
    opacity: 0.62,
    envMap,
    envMapIntensity: 2.2,
    clearcoat: 1,
  });

  // ---- main hull (paint) ----
  const lowerHull = hull(
    [
      [-2.34, 0.16],
      [-2.36, 0.74],
      [-2.0, 0.88],
      [-1.15, 0.93],
      [0.92, 0.93],
      [1.82, 0.7],
      [2.3, 0.56],
      [2.38, 0.26],
      [1.72, 0.13],
      [-1.72, 0.13],
    ],
    1.92,
    0.06,
  );
  const hullMesh = new THREE.Mesh(lowerHull, paint);
  hullMesh.castShadow = true;
  body.add(hullMesh);

  // ---- glass canopy ----
  const canopy = hull(
    [
      [-1.12, 0.9],
      [-0.98, 1.29],
      [0.12, 1.31],
      [0.98, 0.9],
    ],
    1.66,
    0.04,
  );
  const canopyMesh = new THREE.Mesh(canopy, glass);
  canopyMesh.castShadow = true;
  body.add(canopyMesh);

  // ---- carbon roof panel + hood vents ----
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.12), mat.carbon);
  roof.position.set(0, 1.31, -0.43);
  body.add(roof);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 1.15), mat.carbon);
  hood.position.set(0, 0.7, 1.5);
  hood.rotation.x = -0.06;
  body.add(hood);

  // side intakes
  [-1, 1].forEach((s) => {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 1.0), mat.carbon);
    intake.position.set(s * 0.94, 0.62, -0.55);
    body.add(intake);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.14), mat.carbon);
    mirror.position.set(s * 1.06, 0.98, 0.42);
    body.add(mirror);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.1), mat.trim);
    skirt.position.set(s * 0.96, 0.2, -0.1);
    body.add(skirt);
  });

  // ---- front fascia ----
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.5), mat.carbon);
  splitter.position.set(0, 0.17, 2.15);
  body.add(splitter);
  [-1, 1].forEach((s) => {
    const canard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), mat.carbon);
    canard.position.set(s * 0.72, 0.34, 2.1);
    canard.rotation.z = s * 0.16;
    body.add(canard);
  });

  const headMat = new THREE.MeshStandardMaterial({ color: 0xdfe9f5, emissive: new THREE.Color(0xdceaff), emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.4 });
  [-1, 1].forEach((s) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.1), headMat);
    hl.position.set(s * 0.6, 0.62, 2.3);
    hl.rotation.y = s * 0.24;
    hl.rotation.z = s * -0.12;
    body.add(hl);
    const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.1), headMat);
    hl2.position.set(s * 0.36, 0.5, 2.3);
    body.add(hl2);
  });
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.12), mat.dark);
  grille.position.set(0, 0.34, 2.34);
  body.add(grille);

  // ---- rear ----
  const wingStruts: THREE.BufferGeometry[] = [];
  [-1, 1].forEach((s) => {
    const g = new THREE.BoxGeometry(0.1, 0.34, 0.16);
    g.translate(s * 0.62, 1.06, -1.86);
    wingStruts.push(g);
  });
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.06, 0.42), mat.carbon);
  wing.position.set(0, 1.24, -1.86);
  wing.rotation.x = 0.12;
  wing.castShadow = true;
  body.add(wing);
  body.add(new THREE.Mesh(mergeGeometries(wingStruts)!, mat.carbon));

  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0d10, emissive: new THREE.Color(0xff1a1a), emissiveIntensity: 0.25, roughness: 0.35 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.1), brakeMat);
  tail.position.set(0, 0.76, -2.34);
  body.add(tail);
  [-1, 1].forEach((s) => {
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), brakeMat);
    t2.position.set(s * 0.82, 0.6, -2.34);
    body.add(t2);
  });
  const reverseMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0 });
  [-1, 1].forEach((s) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.08), reverseMat);
    r.position.set(s * 0.5, 0.48, -2.36);
    body.add(r);
  });
  [-1, 1].forEach((s) => {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), mat.chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(s * 0.34, 0.34, -2.32);
    body.add(ex);
  });
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.36), mat.carbon);
  diffuser.position.set(0, 0.22, -2.2);
  body.add(diffuser);

  // ---- interior ----
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.4), mat.dark);
  dash.position.set(0, 0.9, 0.5);
  body.add(dash);
  [-1, 1].forEach((s) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.44), mat.seat);
    seat.position.set(s * 0.4, 0.92, -0.35);
    seat.rotation.x = -0.12;
    body.add(seat);
  });
  const wheelRimInterior = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 6, 16), mat.dark);
  wheelRimInterior.position.set(-0.4, 0.92, 0.32);
  wheelRimInterior.rotation.x = 1.1;
  body.add(wheelRimInterior);

  body.position.y = -0.7; // profile y is measured from the ground
  group.add(body);

  // ---- wheels ----
  const R = 0.36;
  const tireGeo = new THREE.CylinderGeometry(R, R, 0.32, 22, 1);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(R * 0.68, R * 0.68, 0.24, 18, 1);
  rimGeo.rotateZ(Math.PI / 2);
  const discGeo = new THREE.CylinderGeometry(R * 0.58, R * 0.58, 0.05, 16, 1);
  discGeo.rotateZ(Math.PI / 2);
  const spokeGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.BoxGeometry(0.07, R * 1.24, 0.09);
    s.translate(0, 0, 0.14);
    s.rotateX((i / 5) * Math.PI * 2);
    spokeGeos.push(s);
  }
  const spokes = mergeGeometries(spokeGeos)!;
  const hub = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 10);
  hub.rotateZ(Math.PI / 2);

  const tire = new THREE.Mesh(tireGeo, mat.rubber);
  const rim = new THREE.Mesh(mergeGeometries([rimGeo, spokes, hub])!, mat.rim);
  const disc = new THREE.Mesh(discGeo, mat.caliper);

  const wheels: { steer: THREE.Group; spin: THREE.Group }[] = [];
  const anchors: [number, number][] = [
    [0.83, 1.36],
    [-0.83, 1.36],
    [0.83, -1.36],
    [-0.83, -1.36],
  ];
  anchors.forEach(([x, z]) => {
    const steer = new THREE.Group();
    steer.position.set(x, -0.1, z);
    const spin = new THREE.Group();
    const t = tire.clone();
    const r = rim.clone();
    const d = disc.clone();
    t.castShadow = true;
    spin.add(t, r, d);
    steer.add(spin);
    group.add(steer);
    wheels.push({ steer, spin });
  });

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = false;
    }
  });

  return { group, body, wheels, brakeMat, reverseMat, headMat, indicatorMats: [], paint, glass, wheelRadius: R };
}

/* ---------------- traffic vehicle (lightweight) ---------------- */
export function createTrafficCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.32 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x0d141b, metalness: 0.5, roughness: 0.12, transparent: true, opacity: 0.8 });
  const rub = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });

  const lowerHull = hull(
    [
      [-2.1, 0.2],
      [-2.12, 0.72],
      [-1.5, 0.8],
      [-0.6, 0.84],
      [0.9, 0.82],
      [1.9, 0.62],
      [2.14, 0.3],
      [1.6, 0.16],
      [-1.6, 0.16],
    ],
    1.82,
    0.05,
  );
  const b = new THREE.Mesh(lowerHull, paint);
  b.castShadow = true;
  g.add(b);
  const canopy = hull(
    [
      [-0.7, 0.84],
      [-0.6, 1.2],
      [0.5, 1.2],
      [0.95, 0.84],
    ],
    1.6,
    0.03,
  );
  g.add(new THREE.Mesh(canopy, glassM));

  const tailMat = new THREE.MeshStandardMaterial({ color: 0x2a0c0e, emissive: new THREE.Color(0xff2020), emissiveIntensity: 0.5 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.08), tailMat);
  tail.position.set(0, 0.66, -2.1);
  g.add(tail);
  const headM = new THREE.MeshStandardMaterial({ color: 0xe8eef5, emissive: new THREE.Color(0xdceaff), emissiveIntensity: 0.6 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.08), headM);
  head.position.set(0, 0.6, 2.1);
  g.add(head);

  const tireGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12);
  tireGeo.rotateZ(Math.PI / 2);
  [
    [0.82, 1.3],
    [-0.82, 1.3],
    [0.82, -1.3],
    [-0.82, -1.3],
  ].forEach(([x, z]) => {
    const w = new THREE.Mesh(tireGeo, rub);
    w.position.set(x, -0.42, z);
    g.add(w);
  });
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  return g;
}
