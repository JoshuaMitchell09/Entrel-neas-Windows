import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { kelvinToRGB, clamp, lerp } from '../core/MathUtil.js';
import { cloudTexture } from '../gfx/Textures.js';

/*
 * Ambiente con ciclo continuo por hora del día (sol, cielo, color de la luz, niebla, nubes,
 * encendido gradual de focos y luces urbanas) y clima.
 * Expone parámetros físicos para la simulación fotográfica:
 *  - sceneEV: valor de exposición (EV100) correcto para la escena (sol + focos).
 *  - lightK: temperatura de color de la luz dominante.
 */
export const TIME_PRESETS = {
  day: { label: 'Tarde soleada', hour: 15.0, kickoff: 15 * 60 },
  sunset: { label: 'Atardecer', hour: 17.6, kickoff: 17 * 60 + 30 },
  night: { label: 'Noche', hour: 20.0, kickoff: 20 * 60 },
  cycle: { label: 'Ciclo real (atardecer → noche)', hour: 16.6, kickoff: 17 * 60 + 5, dynamic: true },
};
// Claves por hora: elevación/azimut del sol, temperatura, intensidades, EV solar, exposición, niebla, cielo, focos, nocturnidad.
const KEYS = [
  { h: 6.0, elev: -6, az: 95, K: 3000, sunI: 0.2, hemi: 0.3, ev: 9, exp: 1.0, fog: 0x7a7c8c, turb: 4, ray: 1.5, flood: 1, night: 0.5, cloud: 0xb39aa8 },
  { h: 8.0, elev: 22, az: 105, K: 4600, sunI: 2.6, hemi: 1.0, ev: 13.8, exp: 0.66, fog: 0xc8d4e0, turb: 5, ray: 1.5, flood: 0, night: 0, cloud: 0xfff4ea },
  { h: 13.0, elev: 64, az: 190, K: 5700, sunI: 3.3, hemi: 1.25, ev: 14.8, exp: 0.62, fog: 0xbfd3e6, turb: 6, ray: 1.2, flood: 0, night: 0, cloud: 0xffffff },
  { h: 16.0, elev: 36, az: 235, K: 5300, sunI: 3.1, hemi: 1.15, ev: 14.3, exp: 0.64, fog: 0xc3d2df, turb: 6.5, ray: 1.4, flood: 0, night: 0, cloud: 0xfffaf2 },
  { h: 17.3, elev: 12, az: 250, K: 4200, sunI: 2.6, hemi: 0.9, ev: 12.6, exp: 0.75, fog: 0xe8c3a0, turb: 8, ray: 2.2, flood: 0.25, night: 0, cloud: 0xffd2b0 },
  { h: 17.8, elev: 4, az: 255, K: 3300, sunI: 2.0, hemi: 0.7, ev: 11.3, exp: 0.88, fog: 0xe0a888, turb: 10, ray: 3, flood: 0.7, night: 0.15, cloud: 0xffa98f },
  { h: 18.15, elev: -3, az: 258, K: 2900, sunI: 0.35, hemi: 0.35, ev: 9.6, exp: 0.98, fog: 0x6a5a70, turb: 6, ray: 1.5, flood: 1, night: 0.55, cloud: 0x8a6a8a },
  { h: 18.6, elev: -14, az: 262, K: 5200, sunI: 0, hemi: 0.14, ev: 4, exp: 1.05, fog: 0x101622, turb: 2, ray: 0.3, flood: 1, night: 1, cloud: 0x1a1f2a },
  { h: 24.0, elev: -40, az: 300, K: 5200, sunI: 0, hemi: 0.12, ev: 3, exp: 1.05, fog: 0x0d121c, turb: 2, ray: 0.3, flood: 1, night: 1, cloud: 0x151a24 },
];
export const WEATHER_PRESETS = {
  clear: { label: 'Despejado', evShift: 0, cloud: 0, rain: 0 },
  cloudy: { label: 'Nublado', evShift: -1.6, cloud: 0.7, rain: 0 },
  rain: { label: 'Lluvia', evShift: -2.4, cloud: 1, rain: 1 },
};
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function sampleKeys(h) {
  h = clamp(h, KEYS[0].h, KEYS[KEYS.length - 1].h);
  let i = 0; while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const o = {};
  for (const k of ['elev', 'az', 'K', 'sunI', 'hemi', 'ev', 'exp', 'turb', 'ray', 'flood', 'night']) o[k] = lerp(a[k], b[k], t);
  o.fog = _c1.set(a.fog).lerp(_c2.set(b.fog), t).getHex();
  o.cloud = _c1.set(a.cloud).lerp(_c2.set(b.cloud), t).getHex();
  return o;
}

export class Environment {
  constructor(game) {
    this.game = game; this.scene = game.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.sky = new Sky(); this.sky.scale.setScalar(4000); this.group.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.group.add(this.sun); this.group.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5040, 0.8); this.group.add(this.hemi);
    this.flood = []; this.floodGroup = new THREE.Group(); this.group.add(this.floodGroup);
    this.rain = null; this.time = 'day'; this.weather = 'clear'; this.hour = 15; this.dynamic = false;
    this.shadowCenter = new THREE.Vector3(); this.sunDir = new THREE.Vector3(0, 1, 0);
    this.pmrem = new THREE.PMREMGenerator(game.renderer); this.envRT = null; this.envHour = -99; this.envNight = -1;
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1900, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
    this.clouds.renderOrder = -1; this.group.add(this.clouds);
    this.scene.fog = new THREE.Fog(0xbfd3e6, 280, 2600);
    this.registry = []; this.floodFactor = 0; this.nightFactor = 0; this.lights = [];
  }
  // Materiales/objetos que cambian con la noche o con el encendido de focos (vallas LED, lámparas, ventanas…).
  register(obj, prop, dayVal, nightVal, by = 'night') { const r = { obj, prop, dayVal, nightVal, by }; this.registry.push(r); this.applyEntry(r); return r; }
  clearRegistry() { this.registry = []; }
  applyEntry(r) {
    const f = r.by === 'flood' ? this.floodFactor : this.nightFactor;
    if (r.prop === 'visible') r.obj.visible = f > 0.5;
    else r.obj[r.prop] = lerp(r.dayVal, r.nightVal, f);
  }
  buildEnvMap() {
    const es = new THREE.Scene(), night = this.nightFactor > 0.6;
    if (!night) {
      const sky = new Sky(); sky.scale.setScalar(1000);
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
      sky.material.uniforms.sunPosition.value.copy(this.sunDir); es.add(sky);
      const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshBasicMaterial({ color: this.weather === 'rain' ? 0x1e2a1e : 0x2f4a2a }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -5; es.add(ground);
    } else {
      es.background = new THREE.Color(0x070a12);
      const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 2.0) });
      for (const p of this.lights.slice(0, 16)) { const b = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 14), lm); b.position.copy(p).multiplyScalar(0.8); es.add(b); }
      const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 24), new THREE.MeshBasicMaterial({ color: 0x1d3a1d })); ground.rotation.x = -Math.PI / 2; ground.position.y = -2; es.add(ground);
    }
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(es, 0.03);
    this.scene.environment = this.envRT.texture;
    es.traverse((o) => { o.geometry?.dispose(); });
    this.envHour = this.hour; this.envNight = night;
  }
  // time: 'day' | 'sunset' | 'night' | 'cycle'  ·  opts.hour fuerza una hora concreta.
  configure(time, weather, stadiumLights = [], opts = {}) {
    const T = TIME_PRESETS[time] || TIME_PRESETS.day, W = WEATHER_PRESETS[weather];
    this.weather = weather; this.W = W; this.lights = stadiumLights; this.dynamic = !!(T.dynamic || opts.dynamic);
    const q = this.game.settings.q;
    this.floodGroup.clear(); this.flood = [];
    if (stadiumLights.length) {
      const fK = kelvinToRGB(5200); this.floodColor = new THREE.Color(fK[0], fK[1], fK[2]).multiplyScalar(1 / Math.max(...fK));
      // Máx. 4 focos reales: se agrupan las fuentes por cuadrante (misma energía total).
      const quads = new Map();
      for (const p of stadiumLights) { const k = (p.x >= 0 ? 1 : 0) + (p.z >= 0 ? 2 : 0); if (!quads.has(k)) quads.set(k, []); quads.get(k).push(p); }
      this.floodPer = 1.35 * Math.min(1.15, Math.sqrt(stadiumLights.length / 4)) * 900;
      for (const arr of quads.values()) {
        const p = arr.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / arr.length);
        const s = new THREE.SpotLight(this.floodColor, 0, 260, 0.62, 0.6, 1.6);
        s.position.copy(p); s.target.position.set(p.x * 0.1, 0, p.z * 0.1); s.castShadow = false;
        this.floodGroup.add(s); this.floodGroup.add(s.target); this.flood.push(s);
      }
    }
    this.floodEV = stadiumLights.length > 6 ? 9.8 : 9.2;
    // Sombras
    this.sun.castShadow = q.shadows > 0;
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const cam = this.sun.shadow.camera, ext = 90;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext; cam.near = 1; cam.far = 500; cam.updateProjectionMatrix();
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    // Lluvia
    if (this.rain) { this.group.remove(this.rain); this.rain.geometry.dispose(); this.rain = null; }
    if (W.rain > 0) this.rain = this.makeRain();
    this.wet = W.rain > 0;
    this.cloudCov = weather === 'rain' ? 0.95 : weather === 'cloudy' ? 0.8 : 0.42;
    this.setHour(opts.hour ?? T.hour, true);
  }
  setHour(h, force = false) {
    if (!force && Math.abs(h - this.hour) < 0.004) return;
    this.hour = h;
    const S = sampleKeys(h), W = this.W || WEATHER_PRESETS.clear;
    const u = this.sky.material.uniforms;
    u.turbidity.value = S.turb + W.cloud * 8; u.rayleigh.value = S.ray * (1 - W.cloud * 0.6);
    u.mieCoefficient.value = 0.005 + W.cloud * 0.02; u.mieDirectionalG.value = 0.8;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - S.elev), THREE.MathUtils.degToRad(S.az));
    u.sunPosition.value.copy(sunDir);
    this.sky.visible = S.elev > -9;
    this.scene.background = S.elev > -9 ? null : new THREE.Color(0x05080f);
    this.floodFactor = this.lights.length ? clamp(S.flood + (this.weather === 'rain' ? 0.4 : 0), 0, 1) : 0;
    this.nightFactor = S.night;
    // Sol vs. "sol" de los focos (direccional para las sombras nocturnas)
    const sunRGB = kelvinToRGB(S.K), cloudDim = 1 - W.cloud * 0.75;
    const sunI = S.sunI * cloudDim, floodShadowI = this.floodFactor * 1.6 * (1 - Math.min(1, S.sunI / 1.2));
    if (sunI >= floodShadowI || !this.lights.length) {
      this.sunDir = S.elev > 1 ? sunDir : sunDir.clone().setY(Math.max(0.05, sunDir.y)).normalize();
      this.sun.color.setRGB(sunRGB[0], sunRGB[1], sunRGB[2]).multiplyScalar(1 / Math.max(...sunRGB)); this.sun.intensity = sunI;
    } else {
      this.sunDir = new THREE.Vector3(0.35, 1, 0.45).normalize(); this.sun.color.copy(this.floodColor); this.sun.intensity = floodShadowI + sunI * 0.3;
    }
    this.hemi.intensity = S.hemi * (1 + W.cloud * 0.25) * 0.6;
    this.hemi.color.set(S.night > 0.6 ? 0x4a5a80 : S.elev < 15 ? 0xffc9a0 : 0xbfd8ff);
    if (W.cloud > 0.5) this.hemi.color.lerp(new THREE.Color(0xc8ccd2), 0.6);
    for (const s of this.flood) s.intensity = this.floodPer * this.floodFactor;
    // Exposición física: suma de luz solar + focos
    const sunEV = S.ev + W.evShift * (S.night > 0.6 ? 0.25 : 1);
    const floodLux = this.floodFactor ? Math.pow(2, this.floodEV) * this.floodFactor : 0;
    this.sceneEV = Math.log2(Math.pow(2, sunEV) + floodLux) + (this.weather === 'rain' && S.night > 0.6 ? -0.4 : 0);
    const sunShare = Math.pow(2, sunEV) / (Math.pow(2, sunEV) + floodLux);
    this.lightK = sunShare > 0.5 ? (this.weather !== 'clear' ? 6200 : S.K) : 5200;
    this.exposure = S.exp * Math.pow(2, -W.evShift * (S.night > 0.6 ? 0.05 : 0.18));
    this.game.renderer.toneMappingExposure = this.exposure;
    // Niebla y nubes
    const fogC = W.cloud > 0.5 ? (S.night > 0.6 ? 0x0d1118 : 0x9aa3ab) : S.fog;
    this.scene.fog.color.set(fogC);
    this.scene.fog.near = this.weather === 'rain' ? 60 : 280; this.scene.fog.far = this.weather === 'rain' ? 420 : lerp(2600, 1700, S.night);
    const cm = this.clouds.material, sunsetTone = S.elev < 15 && S.night < 0.6;
    const tex = cloudTexture(this.cloudCov, sunsetTone ? 9 : 3); if (cm.map !== tex) { cm.map = tex; cm.needsUpdate = true; }
    cm.color.set(W.cloud > 0.5 && S.night < 0.6 ? 0xb9c0c8 : S.cloud); cm.opacity = lerp(1, 0.55, S.night);
    // Etiqueta discreta (la usan HUD, postproceso, evaluación de contraluz)
    const label = S.night > 0.6 ? 'night' : S.elev < 15 ? 'sunset' : 'day';
    const changed = label !== this.time; this.time = label;
    for (const r of this.registry) this.applyEntry(r);
    if (force || Math.abs(this.hour - this.envHour) > 0.15 || (S.night > 0.6) !== this.envNight) this.buildEnvMap();
    this.scene.environmentIntensity = lerp(this.time === 'sunset' ? 0.5 : 0.6, 0.22, S.night);
    if (changed) this.game.events?.emit('env:label', label);
  }
  makeRain() {
    const N = 9000, pos = new Float32Array(N * 6), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80;
      pos.set([x, y, z, x + 0.02, y - 0.55, z + 0.05], i * 6);
      seed[i * 2] = seed[i * 2 + 1] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xaabbcc) } },
      vertexShader: `attribute float seed; uniform float uTime; uniform vec3 uCenter; varying float vA;
        void main(){ vec3 p = position; float fall = mod(p.y - uTime * (16.0 + seed*6.0), 40.0);
          p.y = fall; p.x = mod(p.x - uCenter.x + 40.0, 80.0) - 40.0 + uCenter.x; p.z = mod(p.z - uCenter.z + 40.0, 80.0) - 40.0 + uCenter.z;
          p.y += uCenter.y - 10.0; vA = 0.25 + seed*0.35;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`,
    });
    const rain = new THREE.LineSegments(g, m); rain.frustumCulled = false; this.group.add(rain);
    return rain;
  }
  update(dt, cameraPos, time, hour) {
    if (this.dynamic && hour !== undefined) this.setHour(hour);
    const c = this.shadowCenter.set(Math.round(cameraPos.x / 8) * 8, 0, Math.round(cameraPos.z / 8) * 8);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 200);
    this.clouds.rotation.y = time * 0.002;
    if (this.rain) { this.rain.material.uniforms.uTime.value = time; this.rain.material.uniforms.uCenter.value.copy(cameraPos); }
  }
}
