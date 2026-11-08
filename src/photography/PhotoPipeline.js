import * as THREE from 'three';
import { kelvinToRGB } from '../core/MathUtil.js';

/*
 * Render fotográfico.
 *  - Visor en vivo: escena -> RT HDR con profundidad -> postproceso (DoF, exposición, WB, ruido) -> pantalla.
 *  - Captura: N sub-fotogramas durante el tiempo de obturación (objetos en movimiento + paneo + trepidación)
 *    acumulados => desenfoque de movimiento real; luego DoF físico según distancia de enfoque, focal y apertura.
 */
const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
#include <packing>
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float cameraNear, cameraFar, uFocus, uFocal, uAperture, uSensorH, uMaxCoc, uGain, uNoise, uTime, uVignette, uRain, uSat, uContrast, uDofOn;
uniform vec2 uRes; uniform vec3 uWB; uniform float uSamples;
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
// Círculo de confusión (diámetro en píxeles) a partir de la óptica física
float cocPx(float zMeters){
  float f = uFocal; float s = max(uFocus * 1000.0, f * 1.01); float d = max(zMeters * 1000.0, f * 1.01);
  float A = f / uAperture;
  float c = abs(A * f * (d - s) / (d * (s - f))); // mm sobre el sensor
  return min(c / uSensorH * uRes.y, uMaxCoc);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x){ const float a=2.51; const float b=0.03; const float c=2.43; const float d=0.59; const float e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 px = 1.0 / uRes;
  vec3 col;
  float zc = viewZ(vUv);
  float coc = uDofOn > 0.5 ? cocPx(zc) : 0.0;
  if (coc < 0.6) col = texture2D(tColor, vUv).rgb;
  else {
    vec3 acc = vec3(0.0); float wsum = 0.0;
    float R = coc * 0.5;
    const float GA = 2.39996323;
    for (int i = 0; i < 48; i++) {
      if (float(i) >= uSamples) break;
      float fi = float(i) + 0.5;
      float r = sqrt(fi / uSamples) * R; float a = fi * GA;
      vec2 off = vec2(cos(a), sin(a)) * r * px;
      vec2 suv = vUv + off;
      float zs = viewZ(suv);
      float cs = cocPx(zs) * 0.5;
      // Un vecino desenfocado que está delante puede "derramarse" sobre este píxel
      float w = (zs < zc ? smoothstep(r - 1.0, r + 1.0, cs) : 1.0);
      w = max(w, 0.02);
      acc += texture2D(tColor, suv).rgb * w; wsum += w;
    }
    col = acc / max(wsum, 1e-4);
  }
  col *= uWB * uGain;
  // Contraste/saturación de la cámara (perfil "deportes")
  vec3 t = aces(col);
  float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
  t = mix(vec3(l), t, uSat);
  t = clamp((t - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec3 srgb = toSRGB(t);
  // Ruido de ISO (más visible en sombras) + croma
  float n = hash(vUv * uRes + uTime * 61.0) - 0.5; float n2 = hash(vUv * uRes * 1.37 + uTime * 17.0) - 0.5; float n3 = hash(vUv * uRes * 0.73 + uTime * 7.0) - 0.5;
  float lum = dot(srgb, vec3(0.299, 0.587, 0.114));
  float amp = uNoise * (1.25 - lum);
  srgb += vec3(n) * amp + vec3(n2, n3 * 0.5, -n2) * amp * 0.45;
  // Viñeta óptica
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  srgb *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
  // Gotas de lluvia en el frente del lente
  if (uRain > 0.0) {
    vec2 g = vUv * vec2(9.0, 6.0); vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float h = hash(id + 3.1);
    if (h < 0.35 * uRain) { vec2 c = vec2(hash(id) - 0.5, hash(id + 1.7) - 0.5) * 0.5; float d = length(f - c);
      float drop = smoothstep(0.22, 0.05, d) * 0.6; srgb = mix(srgb, srgb * 1.1 + 0.08, drop); }
  }
  gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}`;
const ACC_FRAG = `varying vec2 vUv; uniform sampler2D tSrc; uniform float uW; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uW, uW); }`;

export class PhotoPipeline {
  constructor(game) {
    this.game = game; this.renderer = game.renderer;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad); this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.post = new THREE.ShaderMaterial({ vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tColor: { value: null }, tDepth: { value: null }, cameraNear: { value: 0.1 }, cameraFar: { value: 2000 }, uFocus: { value: 10 }, uFocal: { value: 50 },
        uAperture: { value: 4 }, uSensorH: { value: 24 }, uMaxCoc: { value: 30 }, uGain: { value: 1 }, uNoise: { value: 0 }, uTime: { value: 0 }, uVignette: { value: 0.25 },
        uRain: { value: 0 }, uSat: { value: 1.08 }, uContrast: { value: 1.04 }, uRes: { value: new THREE.Vector2(1, 1) }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uSamples: { value: 24 }, uDofOn: { value: 1 } } });
    this.acc = new THREE.ShaderMaterial({ vertexShader: POST_VERT, fragmentShader: ACC_FRAG, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, uniforms: { tSrc: { value: null }, uW: { value: 1 } } });
    this.live = null; this.photoCam = new THREE.PerspectiveCamera(30, 1.5, 0.1, 2000);
  }
  makeRT(w, h, depth, samples = 0, type = THREE.HalfFloatType) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type, samples, colorSpace: THREE.LinearSRGBColorSpace });
    if (depth) { rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; }
    return rt;
  }
  ensureLive(w, h) {
    if (this.live && this.live.width === w && this.live.height === h) return;
    this.live?.dispose(); this.live = this.makeRT(w, h, true);
  }
  // Ganancia de exposición, balance de blancos y ruido según ajustes de cámara.
  setOptics(u, s) {
    u.uFocus.value = s.focusDist; u.uFocal.value = s.focal; u.uAperture.value = s.aperture; u.uSensorH.value = 24 / s.crop;
    u.uGain.value = s.gain; u.uNoise.value = s.noiseAmp; u.uRain.value = s.rainOnLens ? 1 : 0;
    const scene = kelvinToRGB(6500), wb = kelvinToRGB(s.wbK);
    const g = [scene[0] / wb[0], scene[1] / wb[1], scene[2] / wb[2]];
    u.uWB.value.set(g[0] / g[1], 1, g[2] / g[1]);
  }
  renderLive(scene, camera, settings) {
    const r = this.renderer, size = r.getDrawingBufferSize(new THREE.Vector2());
    this.ensureLive(size.x, size.y);
    const prevTM = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.live); r.render(scene, camera);
    const u = this.post.uniforms;
    this.setOptics(u, settings);
    u.tColor.value = this.live.texture; u.tDepth.value = this.live.depthTexture;
    u.cameraNear.value = camera.near; u.cameraFar.value = camera.far; u.uRes.value.set(size.x, size.y);
    u.uTime.value = performance.now() * 0.001; u.uMaxCoc.value = 26; u.uSamples.value = 20; u.uVignette.value = 0.18; u.uDofOn.value = 1;
    // El visor fotográfico usa su propia ganancia: compensar la exposición del render principal
    this.quad.material = this.post;
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
    r.toneMapping = prevTM;
  }
  /*
   * Captura real de una fotografía.
   *  s: ajustes ópticos; cam: {position, quaternion, angVel(Vector3 rad/s en espacio cámara), shake[] }
   *  dyn: [{obj, vel}] objetos en movimiento.
   */
  capture(scene, s, cam, dyn, crowd, W, H, nSamples) {
    const r = this.renderer;
    const pc = this.photoCam;
    pc.fov = s.vfov; pc.aspect = W / H; pc.near = 0.1; pc.far = 2000; pc.updateProjectionMatrix();
    const rtS = this.makeRT(W, H, false, 4), rtA = this.makeRT(W, H, false, 0, THREE.HalfFloatType), rtM = this.makeRT(W, H, true), rtO = this.makeRT(W, H, false, 0, THREE.UnsignedByteType);
    const prevTM = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
    const saved = dyn.map((d) => d.obj.position.clone());
    const t0 = crowd ? crowd.uniforms.uTime.value : 0;
    const q0 = cam.quaternion.clone(), e = new THREE.Euler(), qd = new THREE.Quaternion();
    const setAt = (tau) => {
      dyn.forEach((d, i) => { d.obj.position.copy(saved[i]).addScaledVector(d.vel, tau); d.obj.updateMatrixWorld(true); });
      if (crowd) crowd.uniforms.uTime.value = t0 + tau;
      // Paneo (velocidad angular del fotógrafo) + trepidación de la mano
      const sh = cam.shakeAt(tau);
      e.set(-cam.angVel.y * tau + sh.y, -cam.angVel.x * tau + sh.x, 0, 'XYZ');
      qd.setFromEuler(e);
      pc.position.copy(cam.position); pc.quaternion.copy(q0).multiply(qd); pc.updateMatrixWorld(true);
    };
    r.setRenderTarget(rtA); r.setClearColor(0x000000, 0); r.clear();
    const N = Math.max(1, nSamples);
    this.acc.uniforms.uW.value = 1 / N; this.quad.material = this.acc;
    for (let i = 0; i < N; i++) {
      const tau = N === 1 ? s.shutter * 0.5 : ((i + 0.5) / N) * s.shutter;
      setAt(tau);
      r.setRenderTarget(rtS); r.render(scene, pc);
      this.acc.uniforms.tSrc.value = rtS.texture;
      r.setRenderTarget(rtA); r.autoClear = false; r.render(this.quadScene, this.quadCam); r.autoClear = true;
    }
    setAt(s.shutter * 0.5); r.setRenderTarget(rtM); r.render(scene, pc);
    // Postproceso final
    const u = this.post.uniforms; this.setOptics(u, s);
    u.tColor.value = rtA.texture; u.tDepth.value = rtM.depthTexture; u.cameraNear.value = pc.near; u.cameraFar.value = pc.far;
    u.uRes.value.set(W, H); u.uTime.value = Math.random() * 100; u.uMaxCoc.value = Math.max(30, H * 0.045); u.uSamples.value = 48; u.uVignette.value = 0.22; u.uDofOn.value = 1;
    this.quad.material = this.post;
    r.setRenderTarget(rtO); r.render(this.quadScene, this.quadCam);
    const px = new Uint8Array(W * H * 4); r.readRenderTargetPixels(rtO, 0, 0, W, H, px);
    r.setRenderTarget(null); r.toneMapping = prevTM; r.setClearColor(0x000000, 1);
    // Restaurar el estado del mundo
    dyn.forEach((d, i) => { d.obj.position.copy(saved[i]); d.obj.updateMatrixWorld(true); });
    if (crowd) crowd.uniforms.uTime.value = t0;
    [rtS, rtA, rtM, rtO].forEach((t) => { t.depthTexture?.dispose(); t.dispose(); });
    // Volcar a canvas (invirtiendo Y)
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    return { canvas, pixels: img.data, W, H };
  }
}
