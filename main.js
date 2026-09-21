import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Procedural Textures ---
function createWindowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; 
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 8; x < 512; x += 64) {
        for (let y = 8; y < 512; y += 128) {
            const gradient = ctx.createLinearGradient(x, y, x+48, y+112);
            gradient.addColorStop(0, '#7fb3d5');
            gradient.addColorStop(0.5, '#2980b9');
            gradient.addColorStop(1, '#1f618d');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, 48, 112);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+30, y); ctx.lineTo(x, y+30); ctx.fill();
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const textureLoader = new THREE.TextureLoader();
const groundTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/grasslight-big.jpg');
groundTex.wrapS = THREE.RepeatWrapping; groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(100, 100);
const roadTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/terrain/backgrounddetailed6.jpg');
roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(2, 50);
const towerTex = createWindowTexture();
towerTex.repeat.set(2, 6);
const tireTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/carbon/Carbon.png');
tireTex.wrapS = THREE.RepeatWrapping; tireTex.wrapT = THREE.RepeatWrapping; tireTex.repeat.set(4, 1);

// --- Setup Three.js & Post-Processing ---
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0xff5500);
scene.background = skyColor;
scene.fog = new THREE.FogExp2(0xff5500, 0.0035);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.body.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.5;
bloomPass.strength = 1.5; 
bloomPass.radius = 0.8;
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffaa55, 0x442211, 0.6);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffddaa, 3.5); 
dirLight.position.set(100, 50, 150);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.top = 200; dirLight.shadow.camera.bottom = -200;
dirLight.shadow.camera.left = -200; dirLight.shadow.camera.right = 200;
scene.add(dirLight);

const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
sunMesh.position.set(100, 80, 400); 
scene.add(sunMesh);

// --- Cannon.js ---
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -40, 0) });
const physicsMaterial = new CANNON.Material('standard');
world.addContactMaterial(new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, { friction: 0.1, restitution: 0.1 }));

// --- Ground & Road ---
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ map: groundTex, color: 0x3d5c20, roughness: 0.9 }));
groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);
const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 1000), new THREE.MeshStandardMaterial({ map: roadTex, color: 0x555555, roughness: 0.8 }));
roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.y = 0.15; roadMesh.position.z = 400; roadMesh.receiveShadow = true; scene.add(roadMesh);

const groundBody = new CANNON.Body({ mass: 0, material: physicsMaterial, shape: new CANNON.Plane() });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// --- The Engine ---
const engineGroup = new THREE.Group();
const engineMetal = new THREE.MeshStandardMaterial({ color: 0x1b3b24, roughness: 0.4, metalness: 0.8 }); 
const rustMetal = new THREE.MeshStandardMaterial({ color: 0x54261c, roughness: 0.7, metalness: 0.6 }); 
const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 4), rustMetal);
baseMesh.position.y = 0.15; baseMesh.castShadow = true; engineGroup.add(baseMesh);
const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 2.5), engineMetal);
blockMesh.position.y = 1.1; blockMesh.castShadow = true; engineGroup.add(blockMesh);
const flywheelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 64), new THREE.MeshStandardMaterial({ color: 0x050505 }));
flywheelMesh.rotation.z = Math.PI / 2; flywheelMesh.position.set(0.85, 1.1, 0); flywheelMesh.castShadow = true;
engineGroup.add(flywheelMesh);
engineGroup.position.x = -3.0; 
scene.add(engineGroup);

const engineBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(-3.0, 1.3, 0) });
engineBody.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 1.3, 2.0)));
world.addBody(engineBody);

// --- Tire (Monster Tire) ---
const tireRadius = 1.2;
const tireWidth = 0.8;
const tireStartPos = new CANNON.Vec3(0, tireRadius + 0.15, 0); 

const tireGroup = new THREE.Group();
const tireMesh = new THREE.Mesh(new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 64), new THREE.MeshStandardMaterial({ color: 0x111111, map: tireTex, roughness: 0.7 }));
tireMesh.rotation.z = Math.PI / 2; tireMesh.castShadow = true; tireGroup.add(tireMesh);
const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(tireRadius * 0.55, tireRadius * 0.55, tireWidth * 1.05, 32), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.1 }));
rimMesh.rotation.z = Math.PI / 2; tireGroup.add(rimMesh);
scene.add(tireGroup);

const tireBody = new CANNON.Body({ mass: 5000, material: physicsMaterial, position: tireStartPos.clone() });
tireBody.addShape(new CANNON.Sphere(tireRadius)); // Sphere for straight physics
tireBody.linearDamping = 0.01;
tireBody.angularDamping = 0.01;
world.addBody(tireBody);

// --- Indian Character ---
const manGroup = new THREE.Group();
const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.6 }); 
const shirtMat = new THREE.MeshStandardMaterial({ color: 0x8e24aa, roughness: 0.9 }); 
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), shirtMat);
bodyMesh.position.y = 1.6; bodyMesh.castShadow = true; manGroup.add(bodyMesh);
const headGroup = new THREE.Group();
const manHeadMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
const turbanMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 32), new THREE.MeshStandardMaterial({ color: 0xff3300, roughness: 0.8 }));
turbanMesh.position.y = 0.2; turbanMesh.scale.set(1, 0.8, 1);
headGroup.add(manHeadMesh); headGroup.add(turbanMesh);
headGroup.position.y = 2.5; manGroup.add(headGroup);
const armGroupL = new THREE.Group();
const armMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), skinMat); armMeshL.position.y = -0.4;
armGroupL.add(armMeshL); armGroupL.position.set(-0.55, 2.1, 0); manGroup.add(armGroupL);
const armGroupR = new THREE.Group();
const armMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), skinMat); armMeshR.position.y = -0.4;
armGroupR.add(armMeshR); armGroupR.position.set(0.55, 2.1, 0); manGroup.add(armGroupR);
manGroup.position.set(-4.5, 0, 0); // Moved left with engine
manGroup.rotation.y = Math.PI / 2;
bodyMesh.rotation.x = 0.3; headGroup.rotation.x = -0.2;
armGroupL.rotation.x = 1.0; armGroupL.rotation.z = -0.2;
armGroupR.rotation.x = 1.0; armGroupR.rotation.z = 0.2;
scene.add(manGroup);

// --- The Twin Towers (Solid Meshes instead of blocks) ---
const towerZ = 200;
const towerMeshes = [];
const solidTowerMat = new THREE.MeshStandardMaterial({ color: 0x99aacc, map: towerTex, roughness: 0.1, metalness: 0.9, envMapIntensity: 2.0 });

function buildTwinTowers() {
    towerMeshes.forEach(m => scene.remove(m));
    towerMeshes.length = 0;
    const geo = new THREE.BoxGeometry(8, 60, 8);
    
    const towerL = new THREE.Mesh(geo, solidTowerMat);
    towerL.position.set(-5, 30, towerZ);
    towerL.castShadow = true; towerL.receiveShadow = true;
    
    const towerR = new THREE.Mesh(geo, solidTowerMat);
    towerR.position.set(5, 30, towerZ);
    towerR.castShadow = true; towerR.receiveShadow = true;
    
    scene.add(towerL); scene.add(towerR);
    towerMeshes.push(towerL, towerR);
}
buildTwinTowers();

// --- Particle Systems ---
// 1. Engine Smoke (White/Grey thick smoke)
const smokeCount = 150;
const smokeGeo = new THREE.BufferGeometry();
const smokePos = new Float32Array(smokeCount * 3);
const smokeVel = [];
const smokeLife = new Float32Array(smokeCount);
for (let i = 0; i < smokeCount; i++) {
    smokePos[i*3] = 0; smokePos[i*3+1] = -100; smokePos[i*3+2] = 0;
    smokeVel.push(new THREE.Vector3());
    smokeLife[i] = 0;
}
smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
const texCanvas = document.createElement('canvas'); texCanvas.width = 64; texCanvas.height = 64;
const tCtx = texCanvas.getContext('2d');
const grad = tCtx.createRadialGradient(32,32,0, 32,32,32);
grad.addColorStop(0, 'rgba(200,200,200,1)'); grad.addColorStop(1, 'rgba(200,200,200,0)');
tCtx.fillStyle = grad; tCtx.fillRect(0,0,64,64);
const pTex = new THREE.CanvasTexture(texCanvas);

const smokeSystem = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
    size: 5.0, map: pTex, transparent: true, opacity: 1.0, depthWrite: false, color: 0xffdd88, blending: THREE.AdditiveBlending
}));
scene.add(smokeSystem);
let smokeIdx = 0;

function emitEngineSmoke(intensity) {
    for(let j=0; j<Math.floor(intensity); j++) {
        const idx = smokeIdx;
        const posAttr = smokeGeo.attributes.position;
        posAttr.setXYZ(idx, -1.5 + (Math.random()-0.5)*0.5, 1.2, (Math.random()-0.5)*0.5);
        smokeVel[idx].set(Math.random()*4, Math.random()*8+4, (Math.random()-0.5)*4);
        smokeLife[idx] = 0.5 + Math.random()*1.0; 
        posAttr.needsUpdate = true;
        smokeIdx = (smokeIdx + 1) % smokeCount;
    }
}

// 2. Cinematic Explosion (Fire & Debris)
const explosionCount = 1000;
const explGeo = new THREE.BufferGeometry();
const explPos = new Float32Array(explosionCount * 3);
const explVel = [];
const explLife = new Float32Array(explosionCount);
const explColors = new Float32Array(explosionCount * 3);
for (let i = 0; i < explosionCount; i++) {
    explPos[i*3] = 0; explPos[i*3+1] = -100; explPos[i*3+2] = 0;
    explVel.push(new THREE.Vector3());
    explLife[i] = 0;
    // Fiery orange/yellow
    explColors[i*3] = 1.0; explColors[i*3+1] = Math.random() * 0.6 + 0.2; explColors[i*3+2] = 0.0;
}
explGeo.setAttribute('position', new THREE.BufferAttribute(explPos, 3));
explGeo.setAttribute('color', new THREE.BufferAttribute(explColors, 3));

const explosionSystem = new THREE.Points(explGeo, new THREE.PointsMaterial({
    size: 3.5, map: pTex, transparent: true, opacity: 0.9, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending
}));
scene.add(explosionSystem);

function triggerExplosion() {
    towerMeshes.forEach(m => m.visible = false); // Hide towers!
    
    // Create massive explosion
    const posAttr = explGeo.attributes.position;
    for (let i = 0; i < explosionCount; i++) {
        // Start in the center of the towers
        posAttr.setXYZ(i, (Math.random()-0.5)*15, Math.random()*50, towerZ + (Math.random()-0.5)*15);
        // Expand rapidly outwards
        explVel[i].set((Math.random()-0.5)*150, (Math.random()-0.2)*150, (Math.random()-0.5)*150);
        explLife[i] = 2.0 + Math.random()*1.5; 
    }
    posAttr.needsUpdate = true;
    
    // Screen shake trigger
    explosionShakeTime = 1.5;
}

let explosionShakeTime = 0;

function updateParticles(dt) {
    const sPos = smokeGeo.attributes.position;
    for (let i = 0; i < smokeCount; i++) {
        if (smokeLife[i] > 0) {
            smokeLife[i] -= dt;
            sPos.setXYZ(i, sPos.getX(i) + smokeVel[i].x*dt, sPos.getY(i) + smokeVel[i].y*dt, sPos.getZ(i) + smokeVel[i].z*dt);
            if (smokeLife[i] <= 0) sPos.setXYZ(i, 0, -100, 0);
        }
    }
    sPos.needsUpdate = true;
    
    const ePos = explGeo.attributes.position;
    for (let i = 0; i < explosionCount; i++) {
        if (explLife[i] > 0) {
            explLife[i] -= dt;
            explVel[i].y -= 40 * dt; // gravity for debris
            ePos.setXYZ(i, ePos.getX(i) + explVel[i].x*dt, ePos.getY(i) + explVel[i].y*dt, ePos.getZ(i) + explVel[i].z*dt);
            if (explLife[i] <= 0) ePos.setXYZ(i, 0, -100, 0);
        }
    }
    ePos.needsUpdate = true;
}

// --- Game Logic ---
let isCharging = false;
let power = 0;
let gameState = 'ready'; 
let hasExploded = false;

const uiPowerBar = document.getElementById('power-bar');
const uiScore = document.getElementById('score');

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState === 'ready') {
        gameState = 'charging';
        isCharging = true;
        uiScore.innerText = "इंजन रगड़ रहा है 💨 (Engine Smoking)";
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isCharging) {
        launchTire();
    }
});

function launchTire() {
    isCharging = false;
    gameState = 'flying';
    uiScore.innerText = "ट्विन टावर्स को नष्ट करें!!! 🇮🇳"; 
    const forwardForce = power * 20000; 
    const upwardForce = power * 6000; 
    tireBody.applyImpulse(new CANNON.Vec3(0, upwardForce, forwardForce), tireBody.position);
    armGroupL.rotation.x = 1.0; armGroupR.rotation.x = 1.0;
}

// --- Animation Loop ---
const timeStep = 1 / 60;
let lastCallTime = performance.now();
let flyingTimer = 0;
let chargeTime = 0;

function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastCallTime) / 1000, 0.1); 
    lastCallTime = time;

    if (isCharging) {
        chargeTime += dt;
        power += 60 * dt; 
        if (power > 100) power = 100;
        
        flywheelMesh.rotation.x -= (power * 0.5) * dt;
        
        // Only shake visually during charge, keep physics body still
        tireGroup.position.set(
            tireStartPos.x + (Math.random() - 0.5) * (power/100) * 0.4,
            tireStartPos.y + (Math.random() - 0.5) * (power/100) * 0.4,
            tireStartPos.z + (Math.random() - 0.5) * (power/100) * 0.4
        );
        tireGroup.rotation.x += power * 1.5 * dt;
        
        manGroup.position.z = (Math.random() - 0.5) * 0.15 * (power/100);
        armGroupL.rotation.x = 1.0 + Math.sin(chargeTime * 40) * 0.4 * (power/100);
        armGroupR.rotation.x = 1.0 + Math.cos(chargeTime * 40) * 0.4 * (power/100);

        // Emit heavy smoke when charging
        if (power > 10) emitEngineSmoke(power * 0.1); 
    }
    
    updateParticles(dt);
    uiPowerBar.style.width = power + '%';
    world.step(timeStep, dt, 3);

    // CRITICAL: PERFECT VISUAL ROLLING
    if (!isCharging && (gameState === 'flying' || gameState === 'ended')) {
        tireGroup.position.copy(tireBody.position);
        
        // Force the visual tire to roll perfectly straight based on forward velocity
        // ignoring any physical tilting.
        const speed = tireBody.velocity.z;
        tireGroup.rotation.x += (speed / tireRadius) * dt;
        tireGroup.rotation.y = 0; // NEVER TILT
        tireGroup.rotation.z = 0; // NEVER TILT
        
        // Check for explosion trigger
        if (!hasExploded && tireBody.position.z > (towerZ - 15)) {
            hasExploded = true;
            triggerExplosion();
        }
        
    } else if (gameState === 'ready') {
        tireGroup.position.copy(tireStartPos);
        tireGroup.rotation.set(0,0,0);
        tireBody.position.copy(tireStartPos);
        tireBody.velocity.set(0,0,0);
        tireBody.angularVelocity.set(0,0,0);
        flywheelMesh.rotation.x = 0; 
        manGroup.position.z = 0;
    }

    // Cinematic Camera
    let camShakeX = 0, camShakeY = 0;
    if (explosionShakeTime > 0) {
        explosionShakeTime -= dt;
        const intensity = explosionShakeTime * 2.0;
        camShakeX = (Math.random() - 0.5) * intensity;
        camShakeY = (Math.random() - 0.5) * intensity;
    }

    if (gameState === 'ready' || gameState === 'charging') {
        if (isCharging) {
            camShakeX += (Math.random()-0.5) * (power/100) * 0.2;
            camShakeY += (Math.random()-0.5) * (power/100) * 0.2;
        }
        const targetPos = new THREE.Vector3(-9 + camShakeX, 4 + camShakeY, -9);
        camera.position.lerp(targetPos, 0.1);
        camera.lookAt(new THREE.Vector3(1, 1.5, 20));
    } else if (gameState === 'flying' || gameState === 'ended') {
        if(gameState === 'flying') flyingTimer += dt;
        
        const safeCameraZ = Math.min(tireBody.position.z - 25, 120); 
        const heightBoost = (tireBody.position.z > 80) ? (tireBody.position.z - 80) * 0.2 : 0;
        
        const targetPos = new THREE.Vector3(
            Math.max(-15, Math.min(15, tireBody.position.x * 0.3 - 12)) + camShakeX, 
            Math.max(8, tireBody.position.y + 6) + heightBoost + camShakeY, 
            safeCameraZ
        );
        camera.position.lerp(targetPos, 0.08); 
        
        const lookAtPos = new THREE.Vector3(
            tireBody.position.x * 0.5, 
            Math.max(4, tireBody.position.y * 0.5), 
            Math.min(tireBody.position.z + 20, 200) 
        );
        camera.lookAt(lookAtPos);

        const isStopped = tireBody.velocity.length() < 1.5 && tireBody.position.y < tireRadius * 2;
        if ((isStopped && flyingTimer > 4) || flyingTimer > 15) {
            gameState = 'ended';
            uiScore.innerText = "विनाश पूरा हुआ! रीसेट कर रहा है... ॐ"; 
            setTimeout(() => { resetGame(); }, 4000);
        }
    }

    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

function resetGame() {
    gameState = 'ready'; power = 0; flyingTimer = 0; chargeTime = 0; hasExploded = false;
    uiScore.innerText = "लॉन्च के लिए तैयार... ॐ";
    towerMeshes.forEach(m => m.visible = true);
    // Clear particles
    for (let i = 0; i < explosionCount; i++) explLife[i] = 0;
}

animate(performance.now());
