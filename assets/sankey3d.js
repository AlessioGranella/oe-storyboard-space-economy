/* Scena 6 · «Ogni euro attraversa la filiera»: €1 diventa un flusso di particelle che si divide in tre colonne
   olografiche (PIL, Occupati, Gettito). three.js 0.160 con bagliore. Guidata dal tempo della scena:
   la pagina mette .play sul frame e qui si riparte da zero; fuori da .play si disegna lo stato finale. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const host = document.getElementById('s6holo');
const frame = host.closest('.frame');
const DUR = parseFloat(frame.dataset.dur);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const LIME = new THREE.Color(css('--lime-400') || '#B9FF69');
const B200 = new THREE.Color(css('--bluette-200') || '#B991FF');
const NOTTE = new THREE.Color('#05060F');

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
catch (e) { throw e; }
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
frame.classList.add('has-holo3');

const scene = new THREE.Scene();
scene.background = NOTTE;
scene.fog = new THREE.Fog(NOTTE, 30, 90);
const camera = new THREE.PerspectiveCamera(34, 16 / 9, .05, 200);

const cl = x => Math.min(1, Math.max(0, x));
const sm = (a, b, t) => { const k = cl((t - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
let seed = 23; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

/* ── la Terra di notte sotto la scena, con atmosfera e stelle ── */
const R = 30, CENTRO = new THREE.Vector3(1.5, -R - 1.2, 0);
const L = new THREE.TextureLoader();
const terraMat = new THREE.ShaderMaterial({
  uniforms: { giorno: { value: L.load('assets/3d/terra-giorno.jpg') }, luci: { value: L.load('assets/3d/terra-luci.jpg') }, rim: { value: new THREE.Color(0x3d6bff) } },
  vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform sampler2D giorno; uniform sampler2D luci; uniform vec3 rim; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vec3 d=texture2D(giorno,vUv).rgb; float l=dot(texture2D(luci,vUv).rgb,vec3(.299,.587,.114)); vec3 c=d*vec3(.05,.07,.14)+vec3(1.,.74,.38)*pow(l,1.2)*2.2; float f=pow(1.-max(dot(vN,vV),0.),7.); c+=rim*f*.55; gl_FragColor=vec4(c,1.); }',
  fog: false
});
const terra = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), terraMat);
terra.position.copy(CENTRO); terra.rotation.set(.62, -1.85, 0); scene.add(terra);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.025, 128, 96), new THREE.ShaderMaterial({
  uniforms: { c: { value: new THREE.Color(0x4f7dff) } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float d=dot(vN,vV); float a=pow(clamp(1.+d,0.,1.),6.)*smoothstep(0.,.2,-d); gl_FragColor=vec4(c,a*1.3); }',
  side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false
}));
atmo.position.copy(CENTRO); scene.add(atmo);
{ const g = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 2600; i++) { const u = rnd() * 2 - 1, a = rnd() * 6.283, r = 120; sp.push(r * Math.sqrt(1 - u * u) * Math.cos(a), Math.abs(r * u) * .9 + 5, r * Math.sqrt(1 - u * u) * Math.sin(a)); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .12, transparent: true, opacity: .8, fog: false }))); }
const suolo = (x, z) => CENTRO.y + Math.sqrt(R * R - (x - CENTRO.x) ** 2 - z * z);

/* ── la sorgente: €1 come nucleo luminoso ── */
const SRC = new THREE.Vector3(-7.4, 2.6, 0);
const nucleo = new THREE.Mesh(new THREE.SphereGeometry(.2, 48, 32), new THREE.MeshBasicMaterial({ color: LIME }));
nucleo.position.copy(SRC); scene.add(nucleo);
const guscio = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshBasicMaterial({ color: LIME, wireframe: true, transparent: true, opacity: .55 }));
guscio.position.copy(SRC); scene.add(guscio);
const anelloS = new THREE.Mesh(new THREE.TorusGeometry(.8, .01, 8, 128), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .8 }));
anelloS.position.copy(SRC); scene.add(anelloS);

/* ── il percorso: tronco fino allo snodo della filiera, poi tre rami ── */
const HUB = new THREE.Vector3(-3.4, 2.4, 0);
const DEST = [[.2, -1.4], [3.2, 0], [6.2, 1.4]].map(p => new THREE.Vector3(p[0], suolo(p[0], p[1]), p[1]));
const tronco = new THREE.CatmullRomCurve3([SRC.clone(), new THREE.Vector3(-6.0, 2.8, .3), new THREE.Vector3(-4.6, 2.3, -.2), HUB.clone()]);
const rami = DEST.map(d => new THREE.CatmullRomCurve3([HUB.clone(), new THREE.Vector3(HUB.x + (d.x - HUB.x) * .35, 2.2, d.z * .4), new THREE.Vector3(d.x - .5, d.y + 1.4, d.z * .95), new THREE.Vector3(d.x, d.y + .05, d.z)]));
const T_RAMO = [3.6, 5.8, 8.0];                        // il ramo si apre sulla parola della voce

/* tracce del percorso: linee sottili */
const traccia = (c, op) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(160)), new THREE.LineBasicMaterial({ color: LIME, transparent: true, opacity: op })); scene.add(l); return l; };
const lTronco = traccia(tronco, .35);
const lRami = rami.map(c => traccia(c, .3));

/* snodo della filiera: un anello di piccoli nodi */
const snodo = new THREE.Group(); snodo.position.copy(HUB); scene.add(snodo);
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2;
  const n = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .07), new THREE.MeshBasicMaterial({ color: i % 3 ? B200 : LIME }));
  n.position.set(0, Math.cos(a) * .55, Math.sin(a) * .55); snodo.add(n);
}
const snodoAnello = new THREE.Mesh(new THREE.TorusGeometry(.55, .008, 6, 96), new THREE.MeshBasicMaterial({ color: B200, transparent: true, opacity: .6 }));
snodoAnello.rotation.y = Math.PI / 2; snodo.add(snodoAnello);

/* ── le tre colonne olografiche ── */
const H = 3.4;                                          // stessa altezza: i valori veri arrivano dalla stima
const colonne = DEST.map((d, i) => {
  const g = new THREE.Group(); g.position.copy(d); scene.add(g);
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(.16, .3, 1, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  corpo.position.y = .5; g.add(corpo);
  const fili = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xF2FFE0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  fili.position.y = .5; g.add(fili);
  const cima = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0xF2FFE0 }));
  cima.rotation.x = Math.PI / 2; g.add(cima);
  const base = new THREE.Mesh(new THREE.CircleGeometry(.6, 64), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  base.rotation.x = -Math.PI / 2; base.position.y = .01; g.add(base);
  const onda = new THREE.Mesh(new THREE.RingGeometry(.74, .78, 96), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, side: THREE.DoubleSide }));
  onda.rotation.x = -Math.PI / 2; onda.position.y = .02; g.add(onda);
  return { g, corpo, fili, cima, base, onda, t: T_RAMO[i] + 1.1 };
});

/* ── particelle: escono da €1, corrono nel tronco e poi nel loro ramo ── */
const N = 2400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
const P = []; const bianco = new THREE.Color('#F2FFE0');
for (let i = 0; i < N; i++) {
  P.push({ b: i % 3, ph: rnd(), sp: .16 + rnd() * .1, jx: (rnd() - .5) * .16, jy: (rnd() - .5) * .16, jz: (rnd() - .5) * .16 });
  const c = rnd() < .25 ? bianco : LIME; col.set([c.r, c.g, c.b], i * 3);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
const punti = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .045, vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(punti);
const v = new THREE.Vector3();

/* ── etichette HTML sopra le colonne e su €1 ── */
const NOMI = [['PIL', '€[x]'], ['Occupati', '[N]'], ['Gettito', '€[x] mld']];
const etichette = NOMI.map(n => { const e = document.createElement('div'); e.className = 'h3-lbl'; e.innerHTML = '<span>' + n[0] + '</span><b>' + n[1] + '</b>'; host.appendChild(e); return e; });
const euro = document.createElement('div'); euro.className = 'h3-euro'; euro.textContent = '€1'; host.appendChild(euro);

/* ── post: bagliore ── */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .6, .45, .32);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
function proietta(p, el, dy) {
  v.copy(p).project(camera);
  el.style.left = ((v.x + 1) / 2 * host.clientWidth) + 'px';
  el.style.top = ((1 - v.y) / 2 * host.clientHeight + (dy || 0)) + 'px';
}

const guarda = new THREE.Vector3();
function draw(t) {
  /* camera: parte addosso a €1, lo segue lungo il flusso, poi arretra e sale per mostrare le colonne */
  const k1 = sm(.3, 4.2, t), k2 = sm(3.2, 10.5, t);
  camera.position.set(lerp(lerp(-10.2, -6.0, k1), .6, k2), lerp(lerp(3.2, 3.6, k1), 5.4, k2), lerp(lerp(3.8, 5.2, k1), 14.2, k2));
  guarda.set(lerp(lerp(-7.4, -4.2, k1), 1.2, k2), lerp(2.5, 1.0, k2), 0);
  terra.rotation.y = -1.85 + t * .006;
  camera.lookAt(guarda);

  /* sorgente */
  const acc = sm(.1, .9, t);
  nucleo.scale.setScalar(.2 + .8 * acc + Math.sin(t * 3) * .04);
  guscio.rotation.set(t * .4, t * .6, 0); guscio.material.opacity = .55 * acc;
  anelloS.rotation.set(Math.PI / 2 + Math.sin(t * .7) * .3, t * .8, 0); anelloS.material.opacity = .8 * acc;
  snodo.rotation.x = t * .5; snodo.scale.setScalar(sm(1.6, 2.6, t) + .001);
  lTronco.material.opacity = .35 * sm(1, 2.2, t);
  lRami.forEach((l, i) => { l.material.opacity = .3 * sm(T_RAMO[i] - .4, T_RAMO[i] + .4, t); });

  /* particelle */
  for (let i = 0; i < N; i++) {
    const q = P[i];
    const start = q.b === 0 ? 1.0 : 1.0;
    const age = t - start - q.ph * 3.2;                       // escono a scaglioni
    if (age < 0) { pos[i * 3 + 1] = -50; continue; }
    const u = (age * q.sp) % 1.4;                            // 0–.5 tronco, .5–1 ramo, poi rientra
    const ramoAperto = t > T_RAMO[q.b];
    if (u < .5 || !ramoAperto) { tronco.getPoint(Math.min(1, (u % .5) * 2), v); }
    else if (u < 1) { rami[q.b].getPoint((u - .5) * 2, v); }
    else { const c = colonne[q.b].g.position; const k = (u - 1) / .4; v.set(c.x + Math.cos(i) * .12, c.y + k * H * .95, c.z + Math.sin(i) * .12); }
    pos[i * 3] = v.x + q.jx; pos[i * 3 + 1] = v.y + q.jy; pos[i * 3 + 2] = v.z + q.jz;
  }
  pGeo.attributes.position.needsUpdate = true;

  /* colonne: crescono quando arrivano le particelle */
  colonne.forEach((c, i) => {
    const k = sm(c.t, c.t + 1.6, t);
    const h = Math.max(.001, H * k);
    c.corpo.scale.y = h; c.corpo.position.y = h / 2;
    c.fili.scale.y = h; c.fili.position.y = h / 2; c.fili.material.opacity = .9 * cl(k * 3);
    c.cima.position.y = h; c.cima.material.opacity = k;
    c.base.material.opacity = .45 * sm(c.t - .8, c.t, t);
    const ph = t > c.t ? ((t - c.t) % 2) / 2 : 0;
    c.onda.scale.setScalar(1 + ph * 2.2); c.onda.material.opacity = t > c.t ? .8 * (1 - ph) : 0;
    c.g.rotation.y = t * .3;
    const e = etichette[i];
    proietta(new THREE.Vector3(c.g.position.x, h + .55, c.g.position.z), e);
    e.style.opacity = sm(c.t + .6, c.t + 1.4, t).toFixed(3);
  });
  proietta(new THREE.Vector3(SRC.x, SRC.y - .55, 0), euro, 0); euro.style.transform = 'translate(-50%,0)';
  euro.style.opacity = (sm(.4, 1.2, t) * (1 - sm(3.6, 5, t))).toFixed(3);
  bloom.strength = .5 + .25 * sm(8, 11, t);
  composer.render();
}

let playing = false, t0 = 0, raf = 0;
function loop() { draw(Math.min((performance.now() - t0) / 1000, DUR)); if (playing) raf = requestAnimationFrame(loop); }
new MutationObserver(recs => {
  const on = frame.classList.contains('play');
  const restarted = recs.some(r => !/(^|\s)play(\s|$)/.test(r.oldValue || ''));
  if (on && (!playing || restarted)) { playing = true; t0 = performance.now(); cancelAnimationFrame(raf); loop(); }
  if (!on && playing) { playing = false; cancelAnimationFrame(raf); draw(DUR); }
}).observe(frame, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
new ResizeObserver(() => { resize(); if (!playing) draw(DUR); }).observe(host);
resize(); draw(DUR);
window.__holo6 = { draw, DUR };
