import * as THREE from './vendor/three.module.js';
import { OBJLoader } from './vendor/OBJLoader.js';

const canvas = document.getElementById('introCanvas');
const section = document.getElementById('introSection');
const overlay = document.querySelector('.intro-overlay');
const chapters = [...document.querySelectorAll('.intro-chapter')];
const story = document.getElementById('introStory');
const scrollPrompt = document.getElementById('introScrollPrompt');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp;
const ramp = (value, start, end) => THREE.MathUtils.smoothstep(value, start, end);

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0x050508);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050508, 0.028);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const logo = await new OBJLoader().loadAsync('assets/logo.obj');
  const bounds = new THREE.Box3().setFromObject(logo);
  const center = bounds.getCenter(new THREE.Vector3());
  const extent = bounds.getSize(new THREE.Vector3());
  const scale = 2.6 / Math.max(extent.x, extent.y, extent.z);
  const core = new THREE.Group();
  logo.position.copy(center).multiplyScalar(-scale);
  logo.scale.setScalar(scale);
  core.add(logo);
  scene.add(core);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x647377, metalness: 0.7, roughness: 0.32,
    transparent: true, side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x9fe5de, transparent: true, opacity: 0.28 });
  const surface = [];
  logo.updateMatrixWorld(true);
  logo.traverse(child => {
    if (!child.isMesh) return;
    child.material = metal;
    child.geometry.computeVertexNormals();
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 28), edgeMaterial);
    child.add(edges);
    const positions = child.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      surface.push(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld));
    }
  });
  if (!surface.length) throw new Error('Logo OBJ has no mesh vertices');
  scene.add(new THREE.HemisphereLight(0xadcfcf, 0x121318, 1.4));
  const key = new THREE.DirectionalLight(0xd4eee9, 4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xf0b76b, 28, 20);
  rim.position.set(3, 1, -2);
  scene.add(rim);

  const count = 14000;
  const origin = new Float32Array(count * 3);
  const circuit = new Float32Array(count * 3);
  const pixels = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const columns = 160;
  const rows = Math.ceil(count / columns);
  for (let index = 0; index < count; index++) {
    const vertex = surface[index % surface.length];
    vertex.toArray(origin, index * 3);
    const route = index % 80;
    const distance = Math.floor(index / 80) / Math.ceil(count / 80);
    const angle = route / 80 * Math.PI * 2;
    const radius = 0.6 + distance * 8;
    circuit[index * 3] = Math.round(Math.cos(angle) * radius * 3) / 3;
    circuit[index * 3 + 1] = Math.round(Math.sin(angle) * radius * 3) / 3;
    circuit[index * 3 + 2] = -0.8 - distance * 1.5;
    const horizontal = index % columns / (columns - 1);
    const vertical = Math.floor(index / columns) / (rows - 1);
    const mountain = Math.sin(horizontal * 9) * 0.12 + Math.sin(horizontal * 23) * 0.045;
    const horizon = 0.48 + mountain;
    pixels[index * 3] = (horizontal - 0.5) * 15;
    pixels[index * 3 + 1] = (vertical - 0.5) * 8;
    pixels[index * 3 + 2] = vertical < horizon
      ? -2 + (vertical / horizon) * 1.4 + Math.sin(horizontal * 18 + vertical * 12) * 0.3
      : -4 - (vertical - horizon) * 5;
    seeds[index] = (Math.sin(index * 127.1 + 311.7) * 43758.5453) % 1;
    seeds[index] = Math.abs(seeds[index]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(origin, 3));
  geometry.setAttribute('aCircuit', new THREE.BufferAttribute(circuit, 3));
  geometry.setAttribute('aPixel', new THREE.BufferAttribute(pixels, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 }, uTime: { value: 0 }, uResolution: { value: 1 },
      uLogoRotation: { value: new THREE.Matrix4() },
    },
    vertexShader: `
      attribute vec3 aCircuit;
      attribute vec3 aPixel;
      attribute float aSeed;
      uniform float uProgress;
      uniform float uTime;
      uniform float uResolution;
      uniform mat4 uLogoRotation;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float unfold = smoothstep(0.12 + aSeed * 0.08, 0.48 + aSeed * 0.08, uProgress);
        float resolve = smoothstep(0.52 + aSeed * 0.06, 0.86 + aSeed * 0.06, uProgress);
        vec3 source = (uLogoRotation * vec4(position, 1.0)).xyz;
        vec3 point = mix(source, aCircuit, unfold);
        point = mix(point, aPixel, resolve);
        float signal = pow(0.5 + 0.5 * sin(length(aCircuit.xy) * 2.2 - uTime * 1.8 + aSeed * 2.0), 8.0);
        vec4 viewPos = modelViewMatrix * vec4(point, 1.0);
        gl_Position = projectionMatrix * viewPos;
        gl_PointSize = clamp(uResolution * mix(0.014, 0.022, resolve) / max(-viewPos.z, 1.0), 1.0, 5.5);
        vec3 traceColor = mix(vec3(0.16, 0.62, 0.62), vec3(0.95, 0.63, 0.29), step(0.83, aSeed));
        float elevation = aPixel.y / 8.0 + 0.5;
        float horizon = 0.48 + sin((aPixel.x / 15.0 + 0.5) * 9.0) * 0.12 + sin((aPixel.x / 15.0 + 0.5) * 23.0) * 0.045;
        vec3 terrain = mix(vec3(0.09, 0.24, 0.28), vec3(0.48, 0.73, 0.66), elevation);
        vec3 sky = mix(vec3(0.55, 0.35, 0.19), vec3(0.04, 0.09, 0.16), smoothstep(horizon, 1.0, elevation));
        vec3 imageColor = mix(terrain, sky, step(horizon, elevation));
        vColor = mix(traceColor * (0.8 + signal * 1.5), imageColor * 1.5, resolve);
        vAlpha = mix(0.12, 0.6 + signal * 0.35, unfold) * (0.65 + aSeed * 0.35);
        vAlpha *= 1.0 - smoothstep(0.95, 1.0, uProgress) * 0.55;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 point = abs(gl_PointCoord - 0.5);
        float edge = max(point.x, point.y);
        float alpha = (1.0 - smoothstep(0.3, 0.5, edge)) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
  const particles = new THREE.Points(geometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  const routes = [];
  for (let route = 0; route < 40; route++) {
    const angle = route / 40 * Math.PI * 2;
    let previous = new THREE.Vector3(Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, -1);
    for (let segment = 1; segment < 18; segment++) {
      const next = new THREE.Vector3(
        Math.round(Math.cos(angle) * (0.8 + segment * 0.45) * 3) / 3,
        Math.round(Math.sin(angle) * (0.8 + segment * 0.45) * 3) / 3, -1 - segment * 0.05,
      );
      const elbow = new THREE.Vector3(next.x, previous.y, previous.z);
      routes.push(previous.x, previous.y, previous.z, elbow.x, elbow.y, elbow.z);
      routes.push(elbow.x, elbow.y, elbow.z, next.x, next.y, next.z);
      previous = next;
    }
  }
  const routeGeometry = new THREE.BufferGeometry();
  routeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(routes, 3));
  const routeMaterial = new THREE.LineBasicMaterial({ color: 0x347978, transparent: true, opacity: 0, depthWrite: false });
  scene.add(new THREE.LineSegments(routeGeometry, routeMaterial));

  let target = 0;
  let progress = 0;
  let previousTime = 0;
  const pointer = new THREE.Vector2();
  function updateScroll() {
    const rect = section.getBoundingClientRect();
    target = clamp(-rect.top / Math.max(section.offsetHeight - innerHeight, 1), 0, 1);
    if (overlay) {
      overlay.style.opacity = 1 - ramp(target, 0.96, 1);
      overlay.style.visibility = rect.bottom > 0 && rect.top < innerHeight ? 'visible' : 'hidden';
    }
    const activeChapter = target < 0.29 ? 0 : target < 0.64 ? 1 : 2;
    chapters.forEach((chapter, index) => {
      const active = index === activeChapter;
      chapter.classList.toggle('is-active', active);
      chapter.setAttribute('aria-hidden', String(!active));
      chapter.inert = !active;
    });
    if (story) story.style.setProperty('--story-progress', String(target));
    if (scrollPrompt) scrollPrompt.style.visibility = target < 0.03 ? 'visible' : 'hidden';
  }
  function resize() {
    const width = canvas.clientWidth || innerWidth;
    const height = canvas.clientHeight || innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    particleMaterial.uniforms.uResolution.value = height * renderer.getPixelRatio();
    updateScroll();
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', event => {
    pointer.set(event.clientX / innerWidth - 0.5, event.clientY / innerHeight - 0.5);
  }, { passive: true });
  resize();
  renderer.setAnimationLoop(timestamp => {
    const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.1) : 1 / 60;
    previousTime = timestamp;
    progress += (target - progress) * (motion.matches ? 1 : 1 - Math.exp(-delta * 7));
    const time = motion.matches ? 0 : timestamp / 1000;
    const unfold = ramp(progress, 0.12, 0.55);
    const resolve = ramp(progress, 0.52, 0.92);
    core.rotation.set(0.12 + Math.sin(time * 0.16) * 0.05, time * 0.08 + progress * 0.7, 0.05);
    core.updateMatrix();
    particleMaterial.uniforms.uLogoRotation.value.copy(core.matrix);
    particleMaterial.uniforms.uProgress.value = progress;
    particleMaterial.uniforms.uTime.value = time;
    metal.opacity = 1 - ramp(progress, 0.15, 0.4);
    metal.depthWrite = metal.opacity > 0.8;
    edgeMaterial.opacity = (1 - unfold) * 0.3;
    core.visible = progress < 0.55;
    routeMaterial.opacity = ramp(progress, 0.18, 0.4) * (1 - ramp(progress, 0.52, 0.8)) * 0.4;
    const distance = camera.aspect < 1 ? 8.3 : 6;
    camera.position.set(
      motion.matches ? 0 : pointer.x * 0.35 * (1 - resolve),
      (1 - resolve) * 0.4 + (motion.matches ? 0 : pointer.y * 0.15),
      distance + unfold * 4 - resolve * 1.5,
    );
    camera.lookAt(0, 0, -resolve * 1.5);
    if (section.getBoundingClientRect().bottom > 0 && !document.hidden) renderer.render(scene, camera);
  });
}

if (canvas && section) {
  start().catch(error => {
    console.error('Cinematic intro failed:', error);
    section.style.height = '0';
    if (overlay) overlay.style.display = 'none';
  });
}