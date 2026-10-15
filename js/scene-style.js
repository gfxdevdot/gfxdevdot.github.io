import * as THREE from './vendor/three.module.js';

export function configureScene(renderer, scene) {
  renderer.setClearColor(0x050508);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  scene.fog = new THREE.FogExp2(0x050508, 0.028);
  scene.add(new THREE.HemisphereLight(0xadcfff, 0x121318, 1.4));
  const key = new THREE.DirectionalLight(0xd4e5ff, 4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xefbb7e, 28, 20);
  rim.position.set(3, 1, -2);
  scene.add(rim);
}

export function createLogoMaterials() {
  return {
    metal: new THREE.MeshStandardMaterial({
      color: 0x647387, metalness: 0.7, roughness: 0.32,
      transparent: true, side: THREE.DoubleSide,
    }),
    edges: new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.28 }),
  };
}