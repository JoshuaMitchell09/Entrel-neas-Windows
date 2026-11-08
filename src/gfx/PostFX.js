import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Gradación final (después del tonemapping): contraste suave, viñeta, aberración cromática leve y grano.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.28 }, uGrain: { value: 0.025 }, uCA: { value: 0.0012 }, uLift: { value: new THREE.Vector3(0, 0, 0) }, uSat: { value: 1.06 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uCA, uSat; uniform vec3 uLift; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c; c.r = texture2D(tDiffuse, vUv + d * uCA * r2 * 8.0).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - d * uCA * r2 * 8.0).b;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat);
      c = c + uLift * (1.0 - c);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18); // curva S suave
      c *= 1.0 - uVig * smoothstep(0.12, 0.65, r2 * 1.6);
      c += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class PostFX {
  constructor(game) {
    this.game = game; this.enabled = false; this.composer = null;
  }
  setup() {
    const g = this.game, q = g.settings.q, r = g.renderer;
    this.composer?.dispose?.();
    this.enabled = q.bloom;
    if (!this.enabled) { this.composer = null; return; }
    const size = r.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q.antialias ? 4 : 0 });
    const c = (this.composer = new EffectComposer(r, rt));
    c.setPixelRatio(r.getPixelRatio()); c.setSize(size.x, size.y);
    this.render = new RenderPass(g.scene, g.camera); c.addPass(this.render);
    this.gtao = null;
    if (q.shadows >= 2) { this.gtao = new GTAOPass(g.scene, g.camera, size.x, size.y); this.gtao.blendIntensity = 0.85; c.addPass(this.gtao); }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.55, 0.88); c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader); c.addPass(this.grade);
    this.configure();
  }
  configure() {
    if (!this.composer) return;
    const env = this.game.env, night = env.time === 'night', sunset = env.time === 'sunset';
    this.bloom.strength = night ? 0.45 : sunset ? 0.4 : 0.22; this.bloom.threshold = night ? 0.93 : 0.92; this.bloom.radius = night ? 0.65 : 0.5;
    const u = this.grade.uniforms;
    u.uLift.value.set(...(night ? [0.0, 0.01, 0.03] : sunset ? [0.03, 0.01, 0.0] : [0.0, 0.0, 0.01]));
    u.uSat.value = env.weather === 'rain' ? 0.92 : sunset ? 1.12 : 1.06;
  }
  resize(w, h, pr) { if (!this.composer) return; this.composer.setPixelRatio(pr); this.composer.setSize(w, h); this.gtao?.setSize?.(w * pr, h * pr); }
  draw(camera) {
    if (!this.composer) { this.game.renderer.render(this.game.scene, camera); return; }
    this.render.camera = camera; if (this.gtao) this.gtao.camera = camera;
    this.grade.uniforms.uTime.value = performance.now() * 0.001 % 100;
    this.composer.render();
  }
}
