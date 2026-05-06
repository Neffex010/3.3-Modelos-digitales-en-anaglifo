import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import Stats from 'three/addons/libs/stats.module.js';

// ---------- CONFIGURACIÓN ----------
const MODEL_FILES = [
    'Capoeira.fbx',
    'Flying Knee Punch Combo.fbx',
    'Jump Attack.fbx',
    'Standard Run.fbx',
    'Thriller Part 3.fbx'
];
const MODELS_PATH = 'models/';

// ---------- ESCENA, CÁMARA BASE ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x446688);
scene.fog = new THREE.FogExp2(0x446688, 0.04); // niebla exponencial, más realista

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(5, 3, 8);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// ---------- ILUMINACIÓN ----------
const ambientLight = new THREE.AmbientLight(0xffffff, 3.0);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 4.0);
dirLight.position.set(10, 15, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left  = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top   = 10;
dirLight.shadow.camera.bottom = -10;
scene.add(dirLight);

const backLight = new THREE.PointLight(0xaaccff, 4, 20);
backLight.position.set(-5, 2, -5);
scene.add(backLight);

// Luz de relleno frontal para iluminar primer plano
const frontLight = new THREE.PointLight(0xffeedd, 2.5, 15);
frontLight.position.set(0, 3, 6);
scene.add(frontLight);

// ---------- SUELO CON TEXTURA DE TABLERO ----------
const canvas2d = document.createElement('canvas');
canvas2d.width = 512; canvas2d.height = 512;
const ctx = canvas2d.getContext('2d');
ctx.fillStyle = '#8899aa';
ctx.fillRect(0, 0, 512, 512);
const sq = 64;
for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
        if ((i + j) % 2 === 0) {
            ctx.fillStyle = '#556677';
            ctx.fillRect(i * sq, j * sq, sq, sq);
        }
    }
}
const checkerTexture = new THREE.CanvasTexture(canvas2d);
checkerTexture.wrapS = THREE.RepeatWrapping;
checkerTexture.wrapT = THREE.RepeatWrapping;
checkerTexture.repeat.set(4, 4);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ map: checkerTexture, roughness: 0.8, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(30, 30, 0x88aacc, 0x446677);
scene.add(gridHelper);

// ============================================================
// ELEMENTOS DE PROFUNDIDAD
// ============================================================

// ---------- A) PILARES DE FONDO (parallax positivo - hacia adentro) ----------
const pillarGeo = new THREE.CylinderGeometry(0.25, 0.3, 5, 12);
const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x334455, roughness: 0.9, metalness: 0.2
});
const pillarPositions = [
    [-5, 0, -6], [5, 0, -6],
    [-8, 0, -10], [8, 0, -10],
    [-3, 0, -12], [3, 0, -12]
];
pillarPositions.forEach(([x, y, z]) => {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(x, 2.5, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);

    // capitel encima
    const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.2, 0.7),
        pillarMat
    );
    cap.position.set(x, 5.1, z);
    scene.add(cap);
});

// ---------- B) ARCOS DE FONDO (más profundidad visual) ----------
const archMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.95 });
[[-5, -6], [5, -6]].forEach(([x, z]) => {
    // barra horizontal del arco
    const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 10.5),
        archMat
    );
    bar.position.set(x, 5.1, z + 2.5);
    scene.add(bar);
});

// ---------- C) ESFERAS DE PRIMER PLANO (parallax negativo - salen de pantalla) ----------
// Estas esferas están ENTRE la cámara y el modelo → efecto de salir
const foregroundSpheres = [];
const fgSphereData = [
    { pos: [-1.8, 0.4, 4.5], color: 0xff3333, r: 0.12 },
    { pos: [ 1.8, 0.6, 4.2], color: 0x33aaff, r: 0.10 },
    { pos: [-0.5, 1.8, 4.8], color: 0xffcc00, r: 0.08 },
    { pos: [ 0.8, 0.3, 5.0], color: 0x44ff88, r: 0.09 },
    { pos: [-1.0, 1.2, 3.8], color: 0xff66cc, r: 0.11 },
];
fgSphereData.forEach(({ pos, color, r }) => {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.5
        })
    );
    mesh.position.set(...pos);
    mesh.castShadow = true;
    scene.add(mesh);
    foregroundSpheres.push({ mesh, baseY: pos[1], phase: Math.random() * Math.PI * 2 });
});

// ---------- D) ANILLOS FLOTANTES EN PRIMER PLANO ----------
const ringGeo = new THREE.TorusGeometry(0.3, 0.04, 12, 40);
const ringData = [
    { pos: [2.5, 1.5, 4.0], color: 0xffaa00 },
    { pos: [-2.2, 2.0, 3.5], color: 0x00ccff },
];
const floatingRings = [];
ringData.forEach(({ pos, color }) => {
    const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.2 })
    );
    mesh.position.set(...pos);
    scene.add(mesh);
    floatingRings.push({ mesh, baseY: pos[1], phase: Math.random() * Math.PI * 2 });
});

// ---------- E) PLATAFORMA ELEVADA bajo el personaje ----------
const platformGeo = new THREE.CylinderGeometry(1.2, 1.5, 0.2, 24);
const platformMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.7, metalness: 0.4 });
const platform = new THREE.Mesh(platformGeo, platformMat);
platform.position.set(0, 0.1, 0);
platform.receiveShadow = true;
platform.castShadow = true;
scene.add(platform);

// Borde luminoso de la plataforma
const edgeLight = new THREE.PointLight(0x4488ff, 2.0, 3);
edgeLight.position.set(0, 0.3, 0);
scene.add(edgeLight);

// ---------- F) PARTÍCULAS DE POLVO FLOTANTE ----------
const PARTICLE_COUNT = 300;
const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const particleSpeeds = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Distribuidas en todo el volumen de la escena, incluso en primer plano
    positions[i * 3 + 0] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    particleSpeeds[i] = 0.002 + Math.random() * 0.004;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMat = new THREE.PointsMaterial({
    color: 0xaaccff,
    size: 0.06,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    sizeAttenuation: true
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// ---------- G) OBJETOS DE MEDIA DISTANCIA (cubos decorativos) ----------
const cubeGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0x5577aa, roughness: 0.6, metalness: 0.5 });
const floatingCubes = [];
[
    [-3, 1.5, -2], [3.5, 2.0, -3], [-4, 3.0, -4], [4, 1.0, -2],
].forEach(([x, y, z]) => {
    const mesh = new THREE.Mesh(cubeGeo, cubeMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);
    floatingCubes.push({ mesh, baseY: y, phase: Math.random() * Math.PI * 2 });
});

// ============================================================
// RENDER TARGETS Y CÁMARAS ESTÉREO
// ============================================================
let eyeSep = 0.064;
let focalDistance = 6.0; // distancia al plano de convergencia

const cameraLeft  = camera.clone();
const cameraRight = camera.clone();

const rtLeft  = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    colorSpace: THREE.SRGBColorSpace
});
const rtRight = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    colorSpace: THREE.SRGBColorSpace
});

// ============================================================
// SHADER ANAGLIFO — 3 MODOS
// mode 0 → Color    (RGB directo)
// mode 1 → Grises   (luminancia BT.601)
// mode 2 → Negativo (grises, ojos invertidos)
// ============================================================
const anaglyphShader = {
    uniforms: {
        tDiffuseLeft:  { value: rtLeft.texture  },
        tDiffuseRight: { value: rtRight.texture },
        mode:          { value: 0 }
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tDiffuseLeft;
        uniform sampler2D tDiffuseRight;
        uniform int mode;
        const vec3 luma = vec3(0.299, 0.587, 0.114);
        void main() {
            vec4 left  = texture2D(tDiffuseLeft,  vUv);
            vec4 right = texture2D(tDiffuseRight, vUv);
            if (mode == 0) {
                // COLOR: máximo color, ojo izq → rojo, ojo der → cian
                gl_FragColor = vec4(left.r, right.g, right.b, 1.0);
            } else if (mode == 1) {
                // GRISES: mejor profundidad 3D
                float lumL = dot(left.rgb,  luma);
                float lumR = dot(right.rgb, luma);
                gl_FragColor = vec4(lumL, lumR, lumR, 1.0);
            } else {
                // NEGATIVO: para lentes invertidas (cian/rojo)
                float lumL = dot(left.rgb,  luma);
                float lumR = dot(right.rgb, luma);
                gl_FragColor = vec4(lumR, lumL, lumL, 1.0);
            }
        }
    `
};

const quadScene  = new THREE.Scene();
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadMesh   = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial(anaglyphShader)
);
quadScene.add(quadMesh);

// ============================================================
// CARGA DE MODELOS FBX
// ============================================================
const loader = new FBXLoader();
const modelsCache = {};
let currentModel = null;
let currentMixer  = null;
let currentAnimationSpeed = 1.0;
const clock = new THREE.Clock();

function loadAllModels() {
    const promises = MODEL_FILES.map(filename => new Promise((resolve, reject) => {
        loader.load(MODELS_PATH + filename, fbx => {
            fbx.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.roughness = 0.6;
                        child.material.metalness = 0.1;
                    }
                }
            });
            fbx.scale.set(0.01, 0.01, 0.01);
            fbx.position.set(0, 0.2, 0); // sobre la plataforma
            const mixer = new THREE.AnimationMixer(fbx);
            if (fbx.animations?.length) {
                fbx.animations.forEach(clip => mixer.clipAction(clip).play());
            }
            fbx.visible = false;
            scene.add(fbx);
            modelsCache[filename] = { model: fbx, mixer };
            console.log(`✔ ${filename} cargado`);
            resolve();
        }, undefined, err => {
            console.error(`✘ Error cargando ${filename}:`, err);
            reject(err);
        });
    }));
    return Promise.all(promises);
}

function switchModel(filename) {
    if (currentModel) {
        currentModel.visible = false;
        if (currentMixer) currentMixer.time = 0;
    }
    const entry = modelsCache[filename];
    if (!entry) { console.warn(`Modelo ${filename} no encontrado`); return; }
    entry.model.visible = true;
    currentModel = entry.model;
    currentMixer = entry.mixer;

    guiSettings.scale = currentModel.scale.x;
    guiSettings.posX  = currentModel.position.x;
    guiSettings.posY  = currentModel.position.y;
    guiSettings.posZ  = currentModel.position.z;
    updateAllGUIControllers();

    const box = new THREE.Box3().setFromObject(entry.model);
    controls.target.copy(box.getCenter(new THREE.Vector3()));
    controls.update();
}

// ============================================================
// GUI
// ============================================================
const guiSettings = {
    // --- Render ---
    anaglifo:        true,
    modoAnaglifo:   'Color',          // Color | Grises | Negativo

    // --- Estéreo ---
    eyeSeparation:   eyeSep,
    focalDistance:   focalDistance,   // plano de convergencia

    // --- Escena 3D ---
    modo3D:         'Completo',       // Completo | Solo primer plano | Solo fondo | Sin elementos
    particulas:      true,
    esferasFlotantes: true,
    pilares:         true,
    cubesFlotantes:  true,
    plataforma:      true,
    fogDensity:      0.04,

    // --- Iluminación ---
    ambientIntensity: ambientLight.intensity,
    exposure:         1.0,

    // --- Modelo ---
    animSpeed: 1.0,
    scale: 0.01,
    posX: 0, posY: 0.2, posZ: 0
};

// Mapas de modo → valor uniform
const modeMap = { 'Color': 0, 'Grises': 1, 'Negativo': 2 };

// Grupos de objetos para modos 3D
const groupForeground = [
    ...foregroundSpheres.map(s => s.mesh),
    ...floatingRings.map(r => r.mesh)
];
const groupBackground = [
    ...scene.children.filter(c => c.isMesh && pillarPositions.some(
        ([x,,z]) => Math.abs(c.position.x - x) < 0.5 && Math.abs(c.position.z - z) < 0.5
    ))
];
const groupMid = floatingCubes.map(c => c.mesh);

function applyModo3D(modo) {
    const showAll        = modo === 'Completo';
    const showFront      = modo === 'Completo' || modo === 'Solo primer plano';
    const showBack       = modo === 'Completo' || modo === 'Solo fondo';
    const showMid        = modo === 'Completo' || modo === 'Media distancia';
    const showNone       = modo === 'Sin elementos';

    groupForeground.forEach(m => m.visible = showNone ? false : showFront);
    groupMid.forEach(m => m.visible = showNone ? false : showMid);
    particles.visible  = showNone ? false : guiSettings.particulas;
    platform.visible   = showNone ? false : guiSettings.plataforma;
    edgeLight.visible  = showNone ? false : guiSettings.plataforma;
}

const gui = new GUI({ title: 'Controles', width: 310 });
gui.close();

// --- ANAGLIFO ---
const anaFolder = gui.addFolder('🎬 Anaglifo');
anaFolder.add(guiSettings, 'anaglifo').name('Activar Anaglifo');
anaFolder
    .add(guiSettings, 'modoAnaglifo', ['Color', 'Grises', 'Negativo'])
    .name('Modo anaglifo')
    .onChange(val => { quadMesh.material.uniforms.mode.value = modeMap[val]; });

// --- ESTÉREO ---
const stereoFolder = gui.addFolder('👓 Estéreo');
stereoFolder
    .add(guiSettings, 'eyeSeparation', 0.01, 0.2, 0.001)
    .name('Separación ocular')
    .onChange(v => eyeSep = v);
stereoFolder
    .add(guiSettings, 'focalDistance', 1, 15, 0.1)
    .name('Distancia focal (convergencia)')
    .onChange(v => {
        focalDistance = v;
        // Actualizar el target de controles al plano focal
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        controls.target.copy(camera.position).addScaledVector(dir, focalDistance);
        controls.update();
    });

// --- MODOS 3D ---
const depth3DFolder = gui.addFolder('🎲 Profundidad 3D');
depth3DFolder
    .add(guiSettings, 'modo3D', [
        'Completo',
        'Solo primer plano',
        'Solo fondo',
        'Media distancia',
        'Sin elementos'
    ])
    .name('Modo de escena 3D')
    .onChange(applyModo3D);

depth3DFolder
    .add(guiSettings, 'particulas')
    .name('Partículas de polvo')
    .onChange(v => { particles.visible = v; });

depth3DFolder
    .add(guiSettings, 'esferasFlotantes')
    .name('Esferas primer plano')
    .onChange(v => { foregroundSpheres.forEach(s => s.mesh.visible = v); floatingRings.forEach(r => r.mesh.visible = v); });

depth3DFolder
    .add(guiSettings, 'pilares')
    .name('Pilares de fondo')
    .onChange(v => {
        scene.children.forEach(c => {
            if (c.isMesh && pillarPositions.some(([x,,z]) =>
                Math.abs(c.position.x - x) < 0.5 && Math.abs(c.position.z - z) < 0.5))
                c.visible = v;
        });
    });

depth3DFolder
    .add(guiSettings, 'cubesFlotantes')
    .name('Cubos de media distancia')
    .onChange(v => floatingCubes.forEach(c => c.mesh.visible = v));

depth3DFolder
    .add(guiSettings, 'plataforma')
    .name('Plataforma luminosa')
    .onChange(v => { platform.visible = v; edgeLight.visible = v; });

depth3DFolder
    .add(guiSettings, 'fogDensity', 0, 0.15, 0.005)
    .name('Densidad niebla')
    .onChange(v => { scene.fog.density = v; });

// --- ILUMINACIÓN ---
const lightFolder = gui.addFolder('💡 Iluminación');
lightFolder
    .add(guiSettings, 'ambientIntensity', 0, 5, 0.1)
    .name('Brillo ambiental')
    .onChange(v => ambientLight.intensity = v);
lightFolder
    .add(guiSettings, 'exposure', 0.1, 3, 0.1)
    .name('Exposición (modo normal)')
    .onChange(v => renderer.toneMappingExposure = v);

// --- MODELO ---
const modelFolder = gui.addFolder('🧍 Modelo');
modelFolder
    .add(guiSettings, 'animSpeed', 0, 2, 0.01)
    .name('Velocidad animación')
    .onChange(v => currentAnimationSpeed = v);
modelFolder
    .add(guiSettings, 'scale', 0.001, 0.1, 0.001)
    .name('Escala')
    .onChange(v => { if (currentModel) currentModel.scale.set(v, v, v); });
modelFolder
    .add(guiSettings, 'posX', -5, 5, 0.01).name('Pos X')
    .onChange(v => { if (currentModel) currentModel.position.x = v; });
modelFolder
    .add(guiSettings, 'posY', -1, 5, 0.01).name('Pos Y')
    .onChange(v => { if (currentModel) currentModel.position.y = v; });
modelFolder
    .add(guiSettings, 'posZ', -5, 5, 0.01).name('Pos Z')
    .onChange(v => { if (currentModel) currentModel.position.z = v; });
modelFolder
    .add({ reset: () => {
        if (currentModel) {
            currentModel.scale.set(0.01, 0.01, 0.01);
            currentModel.position.set(0, 0.2, 0);
            guiSettings.scale = 0.01;
            guiSettings.posX = 0; guiSettings.posY = 0.2; guiSettings.posZ = 0;
            updateAllGUIControllers();
        }
    }}, 'reset').name('Reiniciar pos/esc');

function updateAllGUIControllers() {
    gui.controllersRecursive().forEach(c => c.updateDisplay());
}

// ============================================================
// BUCLE DE ANIMACIÓN
// ============================================================
let elapsed = 0;

function animate() {
    requestAnimationFrame(animate);
    stats.update();

    const delta = clock.getDelta();
    elapsed += delta;
    const animDelta = delta * currentAnimationSpeed;

    if (currentMixer) currentMixer.update(animDelta);
    controls.update();

    // -- Animar esferas flotantes de primer plano --
    foregroundSpheres.forEach(({ mesh, baseY, phase }) => {
        mesh.position.y = baseY + Math.sin(elapsed * 1.5 + phase) * 0.12;
        mesh.rotation.y += delta * 0.8;
    });

    // -- Animar anillos --
    floatingRings.forEach(({ mesh, baseY, phase }) => {
        mesh.position.y = baseY + Math.sin(elapsed * 1.2 + phase) * 0.15;
        mesh.rotation.x += delta * 0.5;
        mesh.rotation.z += delta * 0.3;
    });

    // -- Animar cubos de media distancia --
    floatingCubes.forEach(({ mesh, baseY, phase }) => {
        mesh.position.y = baseY + Math.sin(elapsed * 0.8 + phase) * 0.2;
        mesh.rotation.x += delta * 0.4;
        mesh.rotation.y += delta * 0.6;
    });

    // -- Animar partículas (deriva suave hacia arriba y rebote) --
    const pos = particleGeo.attributes.position;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos.array[i * 3 + 1] += particleSpeeds[i];
        if (pos.array[i * 3 + 1] > 7) {
            pos.array[i * 3 + 1] = 0;
        }
    }
    pos.needsUpdate = true;

    // -- Pulso del borde de plataforma --
    edgeLight.intensity = 1.5 + Math.sin(elapsed * 2.5) * 0.8;

    // -- Render anaglifo o normal --
    if (guiSettings.anaglifo) {
        const worldDir = new THREE.Vector3();
        camera.getWorldDirection(worldDir);
        const rightDir = new THREE.Vector3()
            .crossVectors(worldDir, camera.up)
            .normalize();

        // Ojo izquierdo — toe-in hacia controls.target
        cameraLeft.copy(camera);
        cameraLeft.position.addScaledVector(rightDir, -eyeSep / 2);
        cameraLeft.lookAt(controls.target);

        // Ojo derecho
        cameraRight.copy(camera);
        cameraRight.position.addScaledVector(rightDir, eyeSep / 2);
        cameraRight.lookAt(controls.target);

        renderer.setRenderTarget(rtLeft);
        renderer.render(scene, cameraLeft);

        renderer.setRenderTarget(rtRight);
        renderer.render(scene, cameraRight);

        renderer.setRenderTarget(null);
        renderer.render(quadScene, quadCamera);
    } else {
        renderer.render(scene, camera);
    }
}

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    rtLeft.setSize(window.innerWidth, window.innerHeight);
    rtRight.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// INICIO
// ============================================================
const selectElement = document.getElementById('model-select');
selectElement.addEventListener('change', e => switchModel(e.target.value));

quadMesh.material.uniforms.mode.value = 0;

loadAllModels()
    .then(() => {
        console.log('✅ Todos los modelos listos');
        switchModel(selectElement.value);
        animate();
    })
    .catch(err => {
        console.error('❌ Fallo en carga de modelos:', err);
        animate();
    });

// ============================================================
// MONITOR DE RENDIMIENTO (FPS)
// ============================================================
const stats = new Stats();
// Lo posicionamos abajo a la derecha para que no estorbe
stats.dom.style.position = 'absolute';
stats.dom.style.bottom = '20px';
stats.dom.style.right = '20px';
stats.dom.style.top = 'auto'; // Quitamos el top por defecto
stats.dom.style.left = 'auto';
document.body.appendChild(stats.dom);

// ============================================================
// BOTONES EXTRA (Pantalla Completa y Ayuda)
// ============================================================
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnHelp = document.getElementById('btn-help');
const helpModal = document.getElementById('help-modal');
const closeModal = document.getElementById('close-modal');

// Lógica de Pantalla Completa
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        btnFullscreen.innerHTML = '<i class="fas fa-compress"></i>'; // Cambia ícono
        btnFullscreen.title = "Salir de Pantalla Completa";
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            btnFullscreen.innerHTML = '<i class="fas fa-expand"></i>'; // Restaura ícono
            btnFullscreen.title = "Pantalla Completa";
        }
    }
});

// Lógica de Ventana Modal de Ayuda
btnHelp.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
    helpModal.classList.add('hidden');
});

// Cerrar modal haciendo clic afuera del contenido
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.classList.add('hidden');
    }
});