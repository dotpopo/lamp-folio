import * as THREE from "three";

const PAPER = 0xf6f2e8;
const INK = 0x191970;
const BLUE = 0x2b2bd6;

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BLUE);

const camera = new THREE.PerspectiveCamera(31, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0.1, 0.2, 6.7);
camera.lookAt(0.55, -0.42, 0);

/* ---------- cel shading ramp: flat paper, two ink steps ---------- */

const ramp = new THREE.DataTexture(new Uint8Array([150, 218, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter;
ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

const paper = new THREE.MeshToonMaterial({ color: PAPER, gradientMap: ramp });
const paperFlat = new THREE.MeshBasicMaterial({ color: PAPER });
const ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/* ---------- helpers ---------- */

function roughen(geometry, amount = 0.006) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = Math.sin(x * 91.7 + y * 47.3 + z * 73.1) * 43758.5453;
    const n = (h - Math.floor(h) - 0.5) * amount;
    pos.setXYZ(i, x + nrm.getX(i) * n, y + nrm.getY(i) * n, z + nrm.getZ(i) * n);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function part(geometry, material, outline = 1.045) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outline) {
    const shell = new THREE.Mesh(geometry, ink);
    if (typeof outline === "number") shell.scale.setScalar(outline);
    else shell.scale.set(outline[0], outline[1], outline[2]);
    shell.castShadow = false;
    shell.receiveShadow = false;
    mesh.add(shell);
  }
  return mesh;
}

function armMesh(length, radius) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 18, 1, false);
  geometry.translate(0, length / 2, 0);
  roughen(geometry, 0.004);
  return part(geometry, paper, [1.2, 1, 1.2]);
}

// a coil of wire wrapped around an arm, built along local +Y so it rides the joint
function springMesh(y0, y1, turns, radius) {
  const points = [];
  const steps = turns * 18;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, y0 + (y1 - y0) * t, Math.sin(a) * radius));
  }
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, 0.0048, 5, false),
    paper,
  );
  mesh.castShadow = true;
  return mesh;
}

/* ---------- backdrop, planet, moon, stars ---------- */

function backdropTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(170, 150, 30, 256, 256, 400);
  g.addColorStop(0, "#4343ec");
  g.addColorStop(0.5, "#2d2dd8");
  g.addColorStop(1, "#1e1eaa");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 28),
  new THREE.MeshBasicMaterial({ map: backdropTexture() }),
);
backdrop.position.set(0, 0, -7);
scene.add(backdrop);

const PLANET = { center: new THREE.Vector3(1.9, -3.9, -0.9), radius: 3.24 };

const planet = new THREE.Mesh(
  roughen(new THREE.SphereGeometry(PLANET.radius, 128, 80), 0.012),
  new THREE.MeshToonMaterial({ color: PAPER, gradientMap: ramp }),
);
planet.position.copy(PLANET.center);
planet.receiveShadow = true;
scene.add(planet);

const craterInk = new THREE.MeshBasicMaterial({ color: 0x3535c8, transparent: true, opacity: 0.2 });

[
  [0.3, 1.5, 1.0, 0.2, 0.7],
  [-0.55, 1.9, 1.2, 0.13, 0.6],
  [0.85, 2.2, 0.55, 0.16, 0.75],
  [0.1, 2.6, 0.5, 0.1, 0.55],
  [0.2, 1.15, 2.35, 0.17, 0.62],
  [-0.85, 1.55, 1.9, 0.13, 0.5],
  [0.45, 0.55, 2.75, 0.22, 0.55],
  [-0.7, 0.75, 2.6, 0.15, 0.45],
].forEach(([x, y, z, radius, arc]) => {
  const normal = new THREE.Vector3(x, y, z).normalize();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.007, 4, 32, Math.PI * arc), craterInk);
  ring.position.copy(PLANET.center).addScaledVector(normal, PLANET.radius + 0.005);
  ring.lookAt(PLANET.center);
  ring.rotateZ(radius * 7);
  scene.add(ring);
});

const moon = part(new THREE.SphereGeometry(0.24, 32, 24), paperFlat, 1.1);
moon.position.set(2.78, 1.58, -2.7);
moon.castShadow = false;
scene.add(moon);

const starPositions = [];
for (let i = 0; i < 40; i += 1) {
  starPositions.push(-4.2 + Math.random() * 8.4, -0.6 + Math.random() * 3.6, -3.4);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeo,
  new THREE.PointsMaterial({ color: PAPER, size: 0.038, sizeAttenuation: true, transparent: true, opacity: 0.8 }),
);
scene.add(stars);

/* ---------- the lamp: base, two jointed arms, head ---------- */

const BASE = new THREE.Vector3(1.35, -1.14, 0.6);
const SHOULDER = new THREE.Vector3(1.35, -0.98, 0.6);
const PIVOT = new THREE.Vector3(1.92, 0.52, 0.6); // rest position of the head joint
const ARM_LOW = 0.849;
const ARM_HIGH = 0.789;
const REST_REACH = Math.hypot(PIVOT.x - SHOULDER.x, PIVOT.y - SHOULDER.y);
const REST_ANGLE = Math.atan2(PIVOT.y - SHOULDER.y, PIVOT.x - SHOULDER.x);

const stand = new THREE.Group();
scene.add(stand);

const baseGeo = roughen(new THREE.CylinderGeometry(0.36, 0.4, 0.12, 40, 1), 0.005);
const base = part(baseGeo, paper, 1.05);
base.position.copy(BASE).add(new THREE.Vector3(0, 0.06, 0));
stand.add(base);

const collarGeo = roughen(new THREE.CylinderGeometry(0.24, 0.28, 0.07, 32, 1), 0.004);
const collar = part(collarGeo, paper, 1.06);
collar.position.copy(BASE).add(new THREE.Vector3(0, 0.15, 0));
stand.add(collar);

const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: 0x2a2a9a, transparent: true, opacity: 0.45 }));
rim.rotation.x = Math.PI / 2;
rim.position.copy(BASE).add(new THREE.Vector3(0, 0.122, 0));
stand.add(rim);

// the whole stem leans and twists from the shoulder, like a body bending at the waist
const spine = new THREE.Group();
spine.position.copy(SHOULDER);
stand.add(spine);

const spinePose = { pitch: 0, pitchVel: 0 };

const lowerJoint = new THREE.Group();
spine.add(lowerJoint);
lowerJoint.add(armMesh(ARM_LOW, 0.052));
lowerJoint.add(springMesh(0.2, ARM_LOW - 0.05, 13, 0.058));

const shoulderCap = part(new THREE.SphereGeometry(0.072, 22, 16), paper, 1.08);
lowerJoint.add(shoulderCap);

const elbowJoint = part(new THREE.SphereGeometry(0.085, 24, 18), paper, 1.08);
elbowJoint.position.set(0, ARM_LOW, 0);
lowerJoint.add(elbowJoint);

const upperJoint = new THREE.Group();
upperJoint.position.set(0, ARM_LOW, 0);
lowerJoint.add(upperJoint);
upperJoint.add(armMesh(ARM_HIGH, 0.045));
upperJoint.add(springMesh(0.16, ARM_HIGH - 0.05, 14, 0.052));

const head = new THREE.Group();
head.position.set(0, ARM_HIGH, 0);
upperJoint.add(head);

const hinge = part(new THREE.SphereGeometry(0.07, 24, 18), paper, 1.08);
head.add(hinge);

const shadeGeo = new THREE.CylinderGeometry(0.42, 0.11, 0.52, 44, 1, true);
shadeGeo.rotateX(Math.PI / 2);
shadeGeo.translate(0, 0, 0.3);
roughen(shadeGeo, 0.005);

const shade = part(shadeGeo, paper, 1.055);
shade.castShadow = false;
head.add(shade);

const lip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.014, 6, 56), paperFlat);
lip.position.set(0, 0, 0.56);
lip.castShadow = true;
head.add(lip);

const neckGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.14, 20, 1);
neckGeo.rotateX(Math.PI / 2);
neckGeo.translate(0, 0, 0.07);
neckGeo.computeVertexNormals();
head.add(part(neckGeo, paper, [1.14, 1.14, 1]));

const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), paperFlat);
bulb.position.set(0, 0, 0.38);
head.add(bulb);

// a visible cone so the beam reads in the air: one surface, alpha fades with distance
function beamFade() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgb(0,0,0)");
  g.addColorStop(0.45, "rgb(82,82,82)");
  g.addColorStop(1, "rgb(255,255,255)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function beamTexture() {
  const W = 512;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const cx = W / 2;

  // one row per scanline: the cone widens toward the far end and every row fades
  // out sideways on its own, so the silhouette has no hard edge anywhere
  for (let y = 0; y < H; y += 1) {
    const t = y / H;
    const half = W * (0.5 - 0.44 * t) * 0.98;
    const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.22, "rgba(255,255,255,0.3)");
    g.addColorStop(0.5, "rgba(255,255,255,0.92)");
    g.addColorStop(0.78, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - half, y, half * 2, 1);
  }

  ctx.globalCompositeOperation = "destination-in";
  const along = ctx.createLinearGradient(0, 0, 0, H);
  along.addColorStop(0, "rgba(0,0,0,0)");
  along.addColorStop(0.35, "rgba(0,0,0,0.16)");
  along.addColorStop(0.7, "rgba(0,0,0,0.55)");
  along.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, W, H);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// a flat card that always turns its face to the camera, so the bright core
// sits exactly on the beam axis instead of drifting to one side of a cone shell
const beamGeometry = new THREE.PlaneGeometry(1.75, 7.2);
beamGeometry.rotateX(Math.PI / 2);
beamGeometry.translate(0, 0, 0.58 + 3.6);

const beam = new THREE.Mesh(
  beamGeometry,
  new THREE.MeshBasicMaterial({
    map: beamTexture(),
    color: 0xccd6ff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
beam.renderOrder = 2;
head.add(beam);

const cameraLocal = new THREE.Vector3();

function billboardBeam() {
  head.updateMatrixWorld();
  cameraLocal.copy(camera.position);
  head.worldToLocal(cameraLocal);
  beam.rotation.z = Math.atan2(cameraLocal.x, -cameraLocal.y);
}

/* ---------- dust motes drifting inside the beam ---------- */

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const DUST = 96;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST * 3);
const dustAngle = new Float32Array(DUST);
const dustSpread = new Float32Array(DUST);
const dustZ = new Float32Array(DUST);
const dustSpeed = new Float32Array(DUST);

function seedDust(i, z) {
  dustAngle[i] = Math.random() * Math.PI * 2;
  dustSpread[i] = Math.pow(Math.random(), 0.8);
  dustZ[i] = z;
  dustSpeed[i] = 0.18 + Math.random() * 0.55;
}

for (let i = 0; i < DUST; i += 1) seedDust(i, 0.6 + Math.random() * 6.2);
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));

const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    map: dotTexture(),
    color: 0xdfe6ff,
    size: 0.032,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
head.add(dust);

function updateDust(dt) {
  const array = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST; i += 1) {
    dustZ[i] += dustSpeed[i] * dt;
    if (dustZ[i] > 7.2) seedDust(i, 0.6);

    const spread = 0.16 + (dustZ[i] - 0.58) * 0.4;
    const radius = dustSpread[i] * spread;
    array[i * 3] = Math.cos(dustAngle[i]) * radius;
    array[i * 3 + 1] = Math.sin(dustAngle[i]) * radius;
    array[i * 3 + 2] = dustZ[i];
  }
  dustGeo.attributes.position.needsUpdate = true;
}

/* ---------- light ---------- */

const hemi = new THREE.HemisphereLight(0xbcbcff, 0x272778, 1.7);
scene.add(hemi);

const moonLight = new THREE.DirectionalLight(0xf2f3ff, 2.1);
moonLight.position.set(3.4, 4.6, 3.6);
moonLight.target.position.set(0.9, -0.7, 0.2);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.radius = 4;
moonLight.shadow.camera.left = -2.8;
moonLight.shadow.camera.right = 2.8;
moonLight.shadow.camera.top = 2.8;
moonLight.shadow.camera.bottom = -2.8;
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 14;
moonLight.shadow.bias = -0.0006;
moonLight.shadow.normalBias = 0.02;
scene.add(moonLight);
scene.add(moonLight.target);

/* ---------- aiming ---------- */

const REST = new THREE.Vector3(-1.9, 1.95, PIVOT.z);
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PIVOT.z);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const wanted = REST.clone();
const aimed = REST.clone();
const armAim = REST.clone();
const headAim = REST.clone();
const headAimVel = new THREE.Vector3();
const hit = new THREE.Vector3();


function onPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );

  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(aimPlane, hit)) return;

  hit.x = THREE.MathUtils.clamp(hit.x, PIVOT.x - 7, PIVOT.x - 0.7);
  hit.y = THREE.MathUtils.clamp(hit.y, PIVOT.y - 3.2, PIVOT.y + 2.6);
  hit.z = PIVOT.z;

  wanted.copy(hit);
}

window.addEventListener("pointermove", onPointer, { passive: true });
window.addEventListener("pointerdown", onPointer, { passive: true });

// the arm leans and bends toward wherever the head is looking
const spineInv = new THREE.Matrix4();
const spineLocal = new THREE.Vector3();

const armPose = { lean: 0, leanVel: 0, reach: 0, reachVel: 0 };
armPose.reach = REST_REACH;
let leanScale = 1;
let clock = 0;

function solveArm(point, dt) {
  spine.updateMatrix();
  spineInv.copy(spine.matrix).invert();
  spineLocal.copy(point).applyMatrix4(spineInv);

  // how high the cursor sits above the shoulder: + is up, - is down
  const rise = THREE.MathUtils.clamp(
    Math.atan2(spineLocal.y, Math.abs(spineLocal.x)),
    -0.7,
    0.7,
  );

  // looking down swings the stem out over the desk, looking up rocks it back;
  // looking far extends the arm, looking near folds it, so the silhouette
  // keeps changing instead of holding one angle. Even at rest it breathes.
  const breath = Math.sin(clock * 1.3) * 0.02 + Math.sin(clock * 0.47) * 0.012;
  const leanWanted =
    THREE.MathUtils.clamp((0.42 - rise) * 1.15, -0.32, 0.62) * leanScale + breath;
  const reachWanted = REST_REACH * (1 - 0.25 * Math.min(1, Math.abs(leanWanted) / 0.62));

  armPose.leanVel += (leanWanted - armPose.lean) * 70 * dt - armPose.leanVel * 9 * dt;
  armPose.lean += armPose.leanVel * dt;
  armPose.reachVel += (reachWanted - armPose.reach) * 120 * dt - armPose.reachVel * 13 * dt;
  armPose.reach += armPose.reachVel * dt;

  const angle = REST_ANGLE + armPose.lean;
  const px = Math.cos(angle) * armPose.reach;
  const py = Math.sin(angle) * armPose.reach;

  const raw = Math.hypot(px, py);
  const d = THREE.MathUtils.clamp(raw, Math.abs(ARM_LOW - ARM_HIGH) + 0.01, ARM_LOW + ARM_HIGH - 0.01);
  const ux = px / raw;
  const uy = py / raw;

  const along = (ARM_LOW * ARM_LOW - ARM_HIGH * ARM_HIGH + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(0, ARM_LOW * ARM_LOW - along * along));

  const ex = ux * along + uy * out;
  const ey = uy * along - ux * out;

  lowerJoint.rotation.z = Math.atan2(-ex, ey);
  upperJoint.rotation.z = Math.atan2(-(px - ex), py - ey) - lowerJoint.rotation.z;
}

const timer = new THREE.Timer();
timer.connect(document);

function tick() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  clock += dt;

  aimed.lerp(wanted, 1 - Math.pow(0.0012, dt));
  armAim.lerp(wanted, 1 - Math.pow(0.05, dt));

  // the whole stem also tips forward or sways back a little while it tracks
  const lift = THREE.MathUtils.clamp((armAim.y - SHOULDER.y - 1.15) / 1.4, -1, 1);
  const pitchWanted = -0.12 * lift;

  spinePose.pitchVel += (pitchWanted - spinePose.pitch) * 46 * dt - spinePose.pitchVel * 10 * dt;
  spinePose.pitch += spinePose.pitchVel * dt;
  spine.rotation.set(spinePose.pitch, 0, 0);

  solveArm(armAim, dt);

  // the head swings after the cursor instead of snapping to it, so it reads
  // as curious rather than robotic
  headAimVel.x += ((aimed.x - headAim.x) * 240 - headAimVel.x * 18) * dt;
  headAimVel.y += ((aimed.y - headAim.y) * 240 - headAimVel.y * 18) * dt;
  headAim.x += headAimVel.x * dt;
  headAim.y += headAimVel.y * dt;

  head.lookAt(headAim);
  billboardBeam();
  updateDust(dt);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(tick);

function frameScene() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;

  moon.visible = aspect >= 1;

  if (aspect < 1) {
    camera.fov = 38;
    camera.position.set(0.5, 0.95, 9.1);
    camera.lookAt(0.9, -1.02, 0);
    leanScale = 0.5; // a narrow screen can't spare the reach
  } else {
    // hold the horizontal field of view steady, so tall windows don't zoom into the planet
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(31) / 2) * 1.78;
    camera.fov = (2 * Math.atan(halfWidth / aspect) * 180) / Math.PI;
    camera.position.set(0.1, 0.2, 6.7);
    camera.lookAt(0.55, -0.42, 0);
    leanScale = 1;
  }

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

frameScene();
window.addEventListener("resize", frameScene);
