import * as THREE from '../js/vendor/three.module.js';
import { OBJLoader } from '../js/vendor/OBJLoader.js';
import { configureScene, createLogoMaterials } from '../js/scene-style.js';

const chapters = [...document.querySelectorAll('[data-chapter]')];
const links = [...document.querySelectorAll('.chapter-nav a')];
const pause = document.getElementById('pauseMotion');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
pause.checked = motion.matches;
let active = 0;
let selectedStage = 0;

const investigations = {
  visual: { nodes: ['Frame capture', 'Render pass', 'Source reference', 'API event'], note: 'Follow an unexpected pixel back to the code and resource state that produced it.' },
  timing: { nodes: ['Frame-time trace', 'Queue submission', 'Synchronization', 'GPU counters'], note: 'Connect a timing spike to submission behavior and measurements on the target device.' },
  legacy: { nodes: ['Authorized binary', 'Candidate engine patterns', 'Reconstructed interfaces', 'Reference behavior'], note: 'Keep inferred engine structures linked to evidence, with uncertainty recorded for review.' }
};
document.querySelectorAll('[name="symptom"]').forEach(input => input.addEventListener('change', () => {
  const investigation = investigations[input.value];
  document.querySelectorAll('#evidencePath li').forEach((node,index) => { node.textContent = investigation.nodes[index]; });
  document.getElementById('evidenceNote').textContent = investigation.note;
}));

const stages = [
  { label:'RECOVER THE ORIGINAL', nodes:['Authorized game materials','Engine & rendering patterns','Verified behavior baseline'], title:'Understand before changing.', summary:'Agents would connect authorized source or binaries, asset formats, and reference captures. Engineers verify reconstructed interfaces and original behavior.', evidence:'A legacy-system map with code references, rendering assumptions, and unresolved questions.', gate:'Review the baseline and confirm the scope before implementation.', status:'Unknown behavior stays explicitly marked for investigation.' },
  { label:'ESTABLISH COMPATIBILITY', nodes:['Platform & runtime adaptation','Modern graphics backend','Playable compatibility baseline'], title:'Make the original work on the target.', summary:'Map graphics calls, shaders, and platform dependencies to a modern backend. Check input and simulation timing as well as rendering behavior.', evidence:'A porting plan, reviewable patches, and representative replay cases linked to the original.', gate:'Approve compatibility checks before introducing visual enhancements.', status:'Vulkan / Direct3D 12 / Metal: choose a backend for the actual target.' },
  { label:'EXTEND THE CAPABILITIES', nodes:['Compatibility mode retained','Resolution / HDR / frame pacing','Scoped enhancement proposal'], title:'Explore what the platform makes possible.', summary:'Propose resolution scaling, HDR output, or frame-pacing improvements where the engine allows. Review content precision, UI scaling, visual intent, and GPU cost separately.', evidence:'An enhancement proposal with tradeoffs and a targeted validation plan.', gate:'Engineer approval is required before protected changes or device runs.', status:'Optional upgrades, not assumed improvements. Approval gate remains closed.' },
  { label:'VALIDATE BOTH MODES', nodes:['Original-behavior comparisons','Enhanced-mode review & timings','Engineer release decision'], title:'Bring evidence to the release review.', summary:'Compare compatibility mode with the original and enhanced output with approved visual goals. Distinguish intentional differences from regressions.', evidence:'Build logs, image comparisons, API reports, replay results, and target frame-time measurements.', gate:'Engineers assess agreed tolerances, budgets, and known limitations.', status:'Compare results against agreed visual tolerances and frame-time budgets.' }
];
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => {
  selectedStage = Number(button.dataset.stage);
  const stage = stages[selectedStage];
  document.querySelectorAll('[data-stage]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
  document.getElementById('mapLabel').textContent = stage.label;
  document.querySelectorAll('#migrationNodes li').forEach((node,index) => { node.textContent = stage.nodes[index]; });
  for (const [id,key] of Object.entries({stageTitle:'title',stageSummary:'summary',stageEvidence:'evidence',stageGate:'gate',mapStatus:'status'})) document.getElementById(id).textContent = stage[key];
}));

function updateChapter() {
  const focus = innerHeight * 0.45;
  active = chapters.reduce((best,chapter,index) => chapter.getBoundingClientRect().top <= focus ? index : best, 0);
  links.forEach((link,index) => index === active ? link.setAttribute('aria-current','step') : link.removeAttribute('aria-current'));
  document.getElementById('chapterCount').textContent = `0${active + 1} / 04`;
}
window.addEventListener('scroll',updateChapter,{passive:true});
window.addEventListener('resize',updateChapter);
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,button,textarea,select,a') || !['ArrowDown','ArrowUp','PageDown','PageUp'].includes(event.key)) return;
  const next = Math.max(0,Math.min(chapters.length-1,active + (['ArrowDown','PageDown'].includes(event.key) ? 1 : -1)));
  event.preventDefault();
  chapters[next].scrollIntoView({behavior:motion.matches ? 'instant' : 'smooth'});
});
motion.addEventListener('change',()=>{pause.checked=motion.matches;});
updateChapter();

async function startScene() {
  const renderer = new THREE.WebGLRenderer({canvas:document.getElementById('pitchScene'),antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const scene = new THREE.Scene();
  configureScene(renderer, scene);
  const camera = new THREE.PerspectiveCamera(40,1,0.1,100);
  camera.position.set(0,0,10);
  const logo = await new OBJLoader().loadAsync('../assets/logo.obj');
  const bounds = new THREE.Box3().setFromObject(logo);
  const center = bounds.getCenter(new THREE.Vector3());
  const extent = bounds.getSize(new THREE.Vector3());
  const scale = 3.3/Math.max(extent.x,extent.y,extent.z);
  logo.position.copy(center).multiplyScalar(-scale);
  logo.scale.setScalar(scale);
  const core = new THREE.Group();
  core.add(logo);
  core.position.set(2.2,0,0);
  scene.add(core);
  const { metal: material, edges } = createLogoMaterials();
  logo.traverse(child=>{
    if(!child.isMesh)return;
    child.material=material;
    child.add(new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry,28),edges));
  });
  const points=[];
  for(let row=0;row<34;row++)for(let column=0;column<65;column++)points.push((column-32)*0.24,-1.9+Math.sin(column*0.18)*0.12,(row-17)*0.3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  const field=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x80bdff,size:0.022,transparent:true,opacity:0.45}));
  scene.add(field);
  const circuit=new THREE.Group();
  for(let index=0;index<6;index++){
    const horizontal=1.1+index*0.5;
    const vertices=[new THREE.Vector3(horizontal,-2,0),new THREE.Vector3(horizontal,index*0.3-0.5,0),new THREE.Vector3(4,index*0.3-0.5,-1)];
    circuit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:index%2?0x00d4ff:0x80bdff,transparent:true,opacity:0.5})));
  }
  scene.add(circuit);
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  window.addEventListener('resize',resize);
  resize();
  const clock=new THREE.Clock();
  let time=0;
  renderer.setAnimationLoop(()=>{
    const delta=Math.min(clock.getDelta(),0.1);
    if(document.hidden)return;
    if(!pause.checked)time+=delta;
    core.rotation.y=1.05+Math.sin(time*0.22)*0.28+active*0.22;
    core.rotation.x=Math.sin(time*0.15)*0.06;
    core.position.x=innerWidth<600?0.3:innerWidth<900?1.4:2.2;
    core.position.y=active===0?0.1:0.35;
    const targetScale=(active===0?1:active===3?0.5:0.7)*(innerWidth<600?0.6:1);
    if(pause.checked)core.scale.setScalar(targetScale);
    else core.scale.lerp(new THREE.Vector3(targetScale,targetScale,targetScale),0.06);
    material.opacity=active===0?1:0.35;
    field.position.z=(time*0.12)%0.3;
    circuit.rotation.y=Math.sin(time*0.1)*0.08;
    circuit.position.y=active===3?selectedStage*0.08:0;
    renderer.render(scene,camera);
  });
}
startScene().catch(error=>{document.body.classList.add('scene-error');console.error('Pitch scene unavailable:',error);});