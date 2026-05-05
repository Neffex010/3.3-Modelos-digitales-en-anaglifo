import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui';

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
scene.fog = new THREE.Fog(0x446688, 10, 60);

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
dirLight.shadow.camera.left = -10;
dirLight.shadow.camera.right = 10;
dirLight.shadow.camera.top = 10;
dirLight.shadow.camera.bottom = -10;
scene.add(dirLight);

const backLight = new THREE.PointLight(0xaaccff, 4, 20);
backLight.position.set(-5, 2, -5);
scene.add(backLight);

// ---------- SUELO CON TEXTURA DE TABLERO ----------
const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
const ctx = canvas.getContext('2d');
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
const checkerTexture = new THREE.CanvasTexture(canvas);
checkerTexture.wrapS = THREE.RepeatWrapping;
checkerTexture.wrapT = THREE.RepeatWrapping;
checkerTexture.repeat.set(4, 4);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ map: checkerTexture, roughness: 0.8, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(20, 20, 0x88aacc, 0x446677);
scene.add(gridHelper);

// ---------- CÁMARAS ESTÉREO Y RENDER TARGETS ----------
let eyeSep = 0.064;

const cameraLeft  = camera.clone();
const cameraRight = camera.clone();

const rtLeft  = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    colorSpace: THREE.SRGBColorSpace
});
const rtRight = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    colorSpace: THREE.SRGBColorSpace
});

// ---------- SHADER ANAGLIFO CON 3 MODOS ----------
// mode 0 → Color    (canales RGB directos — máximo color)
// mode 1 → Grises   (luminancia BT.601  — mejor efecto 3D)
// mode 2 → Negativo (grises con ojos invertidos)
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

        // Pesos perceptuales ITU-R BT.601
        const vec3 luma = vec3(0.299, 0.587, 0.114);

        void main() {
            vec4 left  = texture2D(tDiffuseLeft,  vUv);
            vec4 right = texture2D(tDiffuseRight, vUv);

            if (mode == 0) {
                // COLOR: conserva canales RGB originales de cada ojo
                // Ojo izquierdo → rojo | Ojo derecho → cian (verde + azul)
                gl_FragColor = vec4(left.r, right.g, right.b, 1.0);

            } else if (mode == 1) {
                // GRISES: luminancia ponderada, mejor profundidad 3D
                float lumL = dot(left.rgb,  luma);
                float lumR = dot(right.rgb, luma);
                gl_FragColor = vec4(lumL, lumR, lumR, 1.0);

            } else {
                // NEGATIVO EN GRISES: ojos invertidos
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

// ---------- CARGA DE MODELOS ----------
const loader = new FBXLoader();
const modelsCache = {};
let currentModel = null;
let currentMixer = null;
let currentAnimationSpeed = 1.0;
const clock = new THREE.Clock();

function loadAllModels() {
    const loadPromises = MODEL_FILES.map(filename => new Promise((resolve, reject) => {
        loader.load(MODELS_PATH + filename, (fbx) => {
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
            fbx.position.set(0, 0, 0);
            const mixer = new THREE.AnimationMixer(fbx);
            if (fbx.animations && fbx.animations.length) {
                fbx.animations.forEach(clip => mixer.clipAction(clip).play());
            }
            fbx.visible = false;
            scene.add(fbx);
            modelsCache[filename] = { model: fbx, mixer };
            console.log(`✔ ${filename} cargado`);
            resolve();
        }, undefined, error => {
            console.error(`✘ Error cargando ${filename}:`, error);
            reject(error);
        });
    }));
    return Promise.all(loadPromises);
}

function switchModel(filename) {
    if (currentModel) {
        currentModel.visible = false;
        if (currentMixer) currentMixer.time = 0;
    }
    const entry = modelsCache[filename];
    if (!entry) {
        console.warn(`Modelo ${filename} no encontrado`);
        return;
    }
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

// ---------- GUI ----------
const guiSettings = {
    anaglifo:         true,
    eyeSeparation:    eyeSep,
    modoAnaglifo:    'Color',   // Color | Grises | Negativo
    animSpeed:        1.0,
    scale:            0.01,
    posX:             0,
    posY:             0,
    posZ:             0,
    ambientIntensity: ambientLight.intensity,
    exposure:         1.0
};

// Mapa etiqueta → valor de uniform
const modeMap = { 'Color': 0, 'Grises': 1, 'Negativo': 2 };

const gui = new GUI({ title: 'Controles', width: 300 });
gui.close();

gui.add(guiSettings, 'anaglifo').name('Activar Anaglifo');

const stereoFolder = gui.addFolder('Estéreo');
stereoFolder
    .add(guiSettings, 'eyeSeparation', 0, 1, 0.001)
    .name('Separación ocular')
    .onChange(v => eyeSep = v);

// Control para que el usuario elija el modo anaglifo
stereoFolder
    .add(guiSettings, 'modoAnaglifo', ['Color', 'Grises', 'Negativo'])
    .name('Modo anaglifo')
    .onChange(val => {
        quadMesh.material.uniforms.mode.value = modeMap[val];
    });

const lightFolder = gui.addFolder('Iluminación / Brillo');
lightFolder
    .add(guiSettings, 'ambientIntensity', 0, 5, 0.1)
    .name('Brillo ambiental')
    .onChange(v => ambientLight.intensity = v);
lightFolder
    .add(guiSettings, 'exposure', 0.1, 3, 0.1)
    .name('Exposición (modo normal)')
    .onChange(v => renderer.toneMappingExposure = v);

const modelFolder = gui.addFolder('Modelo');
modelFolder
    .add(guiSettings, 'scale', 0.001, 0.1, 0.001)
    .name('Escala')
    .onChange(v => { if (currentModel) currentModel.scale.set(v, v, v); });
modelFolder
    .add(guiSettings, 'posX', -5, 5, 0.01)
    .name('Pos X')
    .onChange(v => { if (currentModel) currentModel.position.x = v; });
modelFolder
    .add(guiSettings, 'posY', -5, 5, 0.01)
    .name('Pos Y')
    .onChange(v => { if (currentModel) currentModel.position.y = v; });
modelFolder
    .add(guiSettings, 'posZ', -5, 5, 0.01)
    .name('Pos Z')
    .onChange(v => { if (currentModel) currentModel.position.z = v; });
modelFolder
    .add({ reset: () => {
        if (currentModel) {
            currentModel.scale.set(0.01, 0.01, 0.01);
            currentModel.position.set(0, 0, 0);
            guiSettings.scale = 0.01;
            guiSettings.posX  = 0;
            guiSettings.posY  = 0;
            guiSettings.posZ  = 0;
            updateAllGUIControllers();
        }
    }}, 'reset')
    .name('Reiniciar pos/esc');

gui.add(guiSettings, 'animSpeed', 0, 2, 0.01)
    .name('Velocidad anim.')
    .onChange(v => currentAnimationSpeed = v);

function updateAllGUIControllers() {
    gui.controllersRecursive().forEach(c => c.updateDisplay());
}

// ---------- BUCLE DE ANIMACIÓN ----------
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta() * currentAnimationSpeed;
    if (currentMixer) currentMixer.update(delta);
    controls.update();

    if (guiSettings.anaglifo) {
        // Cámaras con convergencia correcta hacia el target (toe-in)
        const worldDir = new THREE.Vector3();
        camera.getWorldDirection(worldDir);

        const rightDir = new THREE.Vector3()
            .crossVectors(worldDir, camera.up)
            .normalize();

        cameraLeft.copy(camera);
        cameraLeft.position.addScaledVector(rightDir, -eyeSep / 2);
        cameraLeft.lookAt(controls.target);

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

// ---------- AJUSTE DE TAMAÑO ----------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    rtLeft.setSize(window.innerWidth, window.innerHeight);
    rtRight.setSize(window.innerWidth, window.innerHeight);
});

// ---------- INICIO ----------
const selectElement = document.getElementById('model-select');
selectElement.addEventListener('change', e => switchModel(e.target.value));

// Iniciar en modo Color
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