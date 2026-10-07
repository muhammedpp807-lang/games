import * as THREE from 'three';
import type { World } from './world';
import type { GameSettings, Weather } from './settings';

export type Phase = 'night' | 'sunrise' | 'day' | 'sunset';

export interface EnvState {
  time: number;
  phase: Phase;
  sunDir: THREE.Vector3;
  light: number; // 0 night .. 1 day
  fogColor: THREE.Color;
  fogDensity: number;
}

const skyVert = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const skyFrag = `
varying vec3 vDir;
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunSize;
uniform float stars;
uniform float cloud;
uniform float time;
uniform float wet;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y*0.5+0.5, 0.0, 1.0);
  vec3 col = mix(bottom, horizon, smoothstep(0.42, 0.55, h));
  col = mix(col, top, smoothstep(0.52, 0.95, h));

  // sun glow
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * pow(sd, sunSize) * 1.6;
  col += sunColor * pow(sd, 4.0) * 0.22;

  // stars
  if (stars > 0.01 && d.y > -0.02) {
    vec2 sp = d.xz / max(0.15, d.y + 0.35) * 60.0;
    float s = hash(floor(sp));
    float tw = 0.5 + 0.5*sin(time*2.0 + s*30.0);
    col += vec3(step(0.9955, s)) * stars * tw * smoothstep(0.0, 0.3, d.y);
  }

  // clouds
  float cl = fbm(d.xz / max(0.2, d.y + 0.28) * 1.6 + vec2(time*0.006, time*0.003));
  cl = smoothstep(0.52 - cloud*0.34, 0.86, cl);
  float shade = 0.55 + 0.45 * max(0.0, dot(normalize(sunDir), d));
  col = mix(col, mix(vec3(0.32,0.34,0.38), vec3(1.02,1.0,0.98), shade) * (0.55+0.45*(1.0-stars)), cl * (0.35 + cloud*0.65));

  col = mix(col, col*0.72 + vec3(0.03,0.035,0.04), wet*0.6);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Environment {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  sky: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  get skyMat() {
    return this.mat;
  }
  fog: THREE.FogExp2;
  state: EnvState;
  time: number;
  rain: THREE.Points | null = null;
  rainVel: Float32Array | null = null;
  lampLights: THREE.PointLight[] = [];


  constructor(_renderer: THREE.WebGLRenderer, scene: THREE.Scene, private world: World, settings: GameSettings) {
    this.time = settings.timeOfDay;

    this.mat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f6ec4) },
        horizon: { value: new THREE.Color(0x9fc4e8) },
        bottom: { value: new THREE.Color(0x5a5f66) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunColor: { value: new THREE.Color(0xfff3d0) },
        sunSize: { value: 900 },
        stars: { value: 0 },
        cloud: { value: 0.15 },
        time: { value: 0 },
        wet: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 24, 16), this.mat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    world.sky = this.sky;

    this.fog = new THREE.FogExp2(0x9fc4e8, 0.0011);
    scene.fog = this.fog;

    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
    this.sun.castShadow = true;
    const s = 95;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9fc4e8, 0x3a3d40, 0.65);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(this.ambient);

    // pooled street lamps that follow the player at night
    for (let i = 0; i < 5; i++) {
      const p = new THREE.PointLight(0xffd9a0, 0, 46, 2);
      p.position.set(0, -100, 0);
      scene.add(p);
      this.lampLights.push(p);
    }

    this.state = {
      time: this.time,
      phase: 'day',
      sunDir: new THREE.Vector3(0, 1, 0),
      light: 1,
      fogColor: new THREE.Color(0x9fc4e8),
      fogDensity: 0.0011,
    };
    this.update(0, scene, settings);
  }

  setWeather(w: Weather) {
    this.targetWeather = w;
  }
  targetWeather: Weather = 'clear';
  wetAmount = 0;

  update(dt: number, scene: THREE.Scene, settings: GameSettings) {
    if (settings.autoTime) {
      this.time = (this.time + dt * 0.045) % 24;
    } else {
      this.time = settings.timeOfDay;
    }
    settings.timeOfDay = this.time;

    const t = this.time;
    // sun elevation: 0 at 6h, peak at 12h, 0 at 18h
    const dayAngle = ((t - 6) / 12) * Math.PI;
    const elev = Math.sin(dayAngle);
    const azim = (t / 24) * Math.PI * 2 - Math.PI * 0.5;
    const sunDir = new THREE.Vector3(Math.cos(azim) * 0.55, Math.max(-0.35, elev), Math.sin(azim) * 0.82).normalize();
    const light = THREE.MathUtils.clamp(elev * 2.2 + 0.12, 0, 1);

    let phase: Phase = 'night';
    if (elev > 0.28) phase = 'day';
    else if (elev > 0) phase = t < 12 ? 'sunrise' : 'sunset';

    const sunrise = phase === 'sunrise' ? 1 - Math.abs(elev) / 0.28 : 0;
    const sunset = phase === 'sunset' ? 1 - Math.abs(elev) / 0.28 : 0;
    const golden = Math.max(sunrise, sunset);

    const top = new THREE.Color().setHSL(0.6, 0.75, THREE.MathUtils.lerp(0.045, 0.42, light));
    const horizon = new THREE.Color().setHSL(
      THREE.MathUtils.lerp(0.62, 0.07, golden * 0.85),
      THREE.MathUtils.lerp(0.5, 0.85, golden),
      THREE.MathUtils.lerp(0.05, 0.66, light),
    );
    const bottom = new THREE.Color().setHSL(0.6, 0.3, THREE.MathUtils.lerp(0.02, 0.3, light));
    if (golden > 0) horizon.lerp(new THREE.Color(0xff8b3d), golden * 0.8);

    // weather blending
    const targetWet = this.targetWeather === 'rain' ? 1 : 0;
    this.wetAmount += (targetWet - this.wetAmount) * Math.min(1, dt * 0.25);
    this.world.isWet = this.wetAmount > 0.35;
    const cloud = this.targetWeather === 'clear' ? 0.14 : this.targetWeather === 'cloudy' ? 0.72 : this.targetWeather === 'rain' ? 0.95 : 0.55;
    const fogBase = this.targetWeather === 'fog' ? 0.016 : this.targetWeather === 'rain' ? 0.0055 : this.targetWeather === 'cloudy' ? 0.0022 : 0.0011;

    this.mat.uniforms.top.value.copy(top);
    this.mat.uniforms.horizon.value.copy(horizon);
    this.mat.uniforms.bottom.value.copy(bottom);
    this.mat.uniforms.sunDir.value.copy(sunDir);
    this.mat.uniforms.sunColor.value.copy(new THREE.Color().setHSL(0.1, golden * 0.75, THREE.MathUtils.lerp(0.6, 0.85, light)));
    this.mat.uniforms.sunSize.value = THREE.MathUtils.lerp(1500, 300, golden) * (this.targetWeather === 'clear' ? 1 : 0.35);
    this.mat.uniforms.stars.value = (1 - light) * (this.targetWeather === 'clear' ? 1 : 0.15);
    this.mat.uniforms.cloud.value += (cloud - this.mat.uniforms.cloud.value) * Math.min(1, dt * 0.3);
    this.mat.uniforms.time.value += dt;
    this.mat.uniforms.wet.value = this.wetAmount;

    const sunColor = new THREE.Color().setHSL(0.11, golden * 0.6, 1);
    this.sun.color.copy(sunColor);
    this.sun.intensity = 3.1 * light * (1 - this.mat.uniforms.cloud.value * 0.55);
    this.hemi.intensity = THREE.MathUtils.lerp(0.12, 0.72, light);
    this.hemi.color.copy(horizon);
    this.ambient.intensity = THREE.MathUtils.lerp(0.06, 0.2, light);

    const fogColor = horizon.clone().lerp(new THREE.Color(0x0a0f18), 1 - light);
    this.fog.color.copy(fogColor);
    this.fog.density = fogBase + this.wetAmount * 0.004;

    this.sun.position.copy(sunDir).multiplyScalar(240).add(new THREE.Vector3(0, 20, 0));
    this.sky.position.set(this.sun.target.position.x, 0, this.sun.target.position.z);
    this.sky.updateMatrix();

    this.state = { time: t, phase, sunDir, light, fogColor, fogDensity: this.fog.density };

    // street lamps at night
    const night = 1 - light;
    this.world.lampHeadMat.emissiveIntensity = night * 2.4;
    this.updateLampLights(night);
    this.updateRain(dt, scene, settings, night);
    void this.world;
  }

  private lastLampPos = new THREE.Vector3(9999, 0, 9999);
  private updateLampLights(night: number) {
    const p = this.sun.target.position;
    if (p.distanceToSquared(this.lastLampPos) > 9) {
      this.lastLampPos.copy(p);
      const lamps = this.world.lamps;
      const scored = lamps
        .map((l) => ({ l, d: (l.x - p.x) ** 2 + (l.z - p.z) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, this.lampLights.length);
      this.lampLights.forEach((pl, i) => {
        const l = scored[i];
        if (!l) {
          pl.intensity = 0;
          return;
        }
        pl.position.set(l.l.x, 8.4, l.l.z);
        pl.intensity = night * 42;
      });
    } else {
      this.lampLights.forEach((pl) => (pl.intensity = night * 42));
    }
  }

  private updateRain(dt: number, scene: THREE.Scene, settings: GameSettings, night: number) {
    const wantRain = this.targetWeather === 'rain' && settings.effects > 0.25;
    if (wantRain && !this.rain) {
      const count = Math.floor(2600 * settings.effects);
      const pos = new Float32Array(count * 3);
      this.rainVel = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 120;
        pos[i * 3 + 1] = Math.random() * 60;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
        this.rainVel[i] = 26 + Math.random() * 22;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({
        color: 0xbfd8ef,
        size: 0.16,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: true,
      });
      this.rain = new THREE.Points(geo, m);
      this.rain.frustumCulled = false;
      scene.add(this.rain);
    } else if (!wantRain && this.rain) {
      scene.remove(this.rain);
      this.rain.geometry.dispose();
      (this.rain.material as THREE.Material).dispose();
      this.rain = null;
    }
    if (this.rain && this.rainVel) {
      const arr = this.rain.geometry.attributes.position.array as Float32Array;
      const c = this.sun.target.position;
      for (let i = 0; i < this.rainVel.length; i++) {
        arr[i * 3 + 1] -= this.rainVel[i] * dt;
        arr[i * 3] += dt * 3.4;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3] = c.x + (Math.random() - 0.5) * 120;
          arr[i * 3 + 1] = 50 + Math.random() * 14;
          arr[i * 3 + 2] = c.z + (Math.random() - 0.5) * 120;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      (this.rain.material as THREE.PointsMaterial).opacity = 0.3 + night * 0.35;
    }
  }

  /** Ground-projection PMREM environment for PBR reflections. */
  /** Renders the live sky shader into a PMREM probe for PBR reflections. */
  static buildEnvMap(renderer: THREE.WebGLRenderer, skyMat: THREE.ShaderMaterial) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tmpScene = new THREE.Scene();
    const clone = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat);
    tmpScene.add(clone);
    const rt = pmrem.fromScene(tmpScene, 0.05);
    pmrem.dispose();
    clone.geometry.dispose();
    return rt.texture;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.sky, this.sun, this.hemi, this.ambient);
    if (this.rain) scene.remove(this.rain);
    this.lampLights.forEach((l) => scene.remove(l));
  }
}
