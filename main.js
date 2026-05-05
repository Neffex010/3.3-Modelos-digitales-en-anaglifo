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
scene.background = new THREE.Color(0x111122);
scene.fog = new THREE.Fog(0x111122, 10, 50);

// Cámara base (centro) – se usa para los controles, pero renderizaremos con dos cámaras desplazadas
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(5, 3, 8);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controles de órbita (actúan sobre la cámara base)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// ---------- ILUMINACIÓN ----------
const ambientLight = new THREE.AmbientLight(0x404066);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
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
const backLight = new THREE.PointLight(0x4466ff, 1, 20);
backLight.position.set(-5, 2, -5);
scene.add(backLight);

// Suelo
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.8, metalness: 0.2 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);
const gridHelper = new THREE.GridHelper(20, 20, 0x336699, 0x224466);
scene.add(gridHelper);

// ---------- CÁMARAS ESTÉREO ----------
let eyeSep = 0.064;           // separación interocular por defecto
let currentAnaglyphMode = 'positive'; // 'positive' o 'negative'

// Cámaras izquierda y derecha (clonadas de la base y desplazadas)
const cameraLeft = camera.clone();
const cameraRight = camera.clone();

// Render targets para izquierda y derecha
const rtWidth = window.innerWidth;
const rtHeight = window.innerHeight;
const rtLeft = new THREE.WebGLRenderTarget(rtWidth, rtHeight);
const rtRight = new THREE.WebGLRenderTarget(rtWidth, rtHeight);

// Shader de composición final (anaglifo configurable)
const anaglyphShader = {
    uniforms: {
        tDiffuseLeft: { value: rtLeft.texture },
        tDiffuseRight: { value: rtRight.texture },
        mode: { value: 0 }       // 0 = positive (rojo izq, cian der), 1 = negative (cian izq, rojo der)
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
        void main() {
            vec4 leftColor = texture2D(tDiffuseLeft, vUv);
            vec4 rightColor = texture2D(tDiffuseRight, vUv);
            float r, g, b;
            if (mode == 0) {
                // Positivo: izquierda -> rojo, derecha -> cian
                r = leftColor.r;
                g = rightColor.g;
                b = rightColor.b;
            } else {
                // Negativo: izquierda -> cian, derecha -> rojo
                r = rightColor.r;
                g = leftColor.g;
                b = leftColor.b;
            }
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};

// Escena y cámara para el plano que combina las texturas
const quadScene = new THREE.Scene();
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial(anaglyphShader)
);
quadScene.add(quadMesh);

// ---------- MODELOS FBX ----------
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
            if (fbx.animations && fbx.animations.length > 0) {
                fbx.animations.forEach(clip => mixer.clipAction(clip).play());
            }
            fbx.visible = false;
            scene.add(fbx);
            modelsCache[filename] = { model: fbx, mixer };
            resolve();
        }, undefined, error => { console.error(error); reject(error); });
    }));
    return Promise.all(loadPromises);
}

function switchModel(filename) {
    if (currentModel) {
        currentModel.visible = false;
        if (currentMixer) currentMixer.time = 0;
    }
    const entry = modelsCache[filename];
    if (!entry) return;
    entry.model.visible = true;
    currentModel = entry.model;
    currentMixer = entry.mixer;

    guiSettings.scale = currentModel.scale.x;
    guiSettings.posX = currentModel.position.x;
    guiSettings.posY = currentModel.position.y;
    guiSettings.posZ = currentModel.position.z;
    updateAllGUIControllers();

    const box = new THREE.Box3().setFromObject(entry.model);
    controls.target.copy(box.getCenter(new THREE.Vector3()));
    controls.update();
}

// ---------- GUI ----------
const guiSettings = {
    anaglifo: true,
    eyeSeparation: eyeSep,
    animSpeed: 1.0,
    scale: 0.01,
    posX: 0,
    posY: 0,
    posZ: 0,
    mode: 'Positivo'   // 'Positivo' o 'Negativo'
};

const gui = new GUI({ title: 'Controles', width: 300 });
gui.close();

gui.add(guiSettings, 'anaglifo').name('Activar Anaglifo');
const anaglyphFolder = gui.addFolder('Estéreo');
anaglyphFolder.add(guiSettings, 'eyeSeparation', 0, 1, 0.001).name('Separación ocular').onChange(val => {
    eyeSep = val;
});
anaglyphFolder.add(guiSettings, 'mode', ['Positivo', 'Negativo']).name('Modo').onChange(val => {
    currentAnaglyphMode = val === 'Positivo' ? 'positive' : 'negative';
    quadMesh.material.uniforms.mode.value = currentAnaglyphMode === 'positive' ? 0 : 1;
});

const modelFolder = gui.addFolder('Modelo');
modelFolder.add(guiSettings, 'scale', 0.001, 0.1, 0.001).name('Escala').onChange(val => {
    if (currentModel) currentModel.scale.set(val, val, val);
});
modelFolder.add(guiSettings, 'posX', -5, 5, 0.01).name('Pos X').onChange(val => { if (currentModel) currentModel.position.x = val; });
modelFolder.add(guiSettings, 'posY', -5, 5, 0.01).name('Pos Y').onChange(val => { if (currentModel) currentModel.position.y = val; });
modelFolder.add(guiSettings, 'posZ', -5, 5, 0.01).name('Pos Z').onChange(val => { if (currentModel) currentModel.position.z = val; });
modelFolder.add({ reset: () => {
    if (currentModel) {
        currentModel.scale.set(0.01, 0.01, 0.01);
        currentModel.position.set(0, 0, 0);
        guiSettings.scale = 0.01; guiSettings.posX = 0; guiSettings.posY = 0; guiSettings.posZ = 0;
        updateAllGUIControllers();
    }
} }, 'reset').name('Reiniciar');

gui.add(guiSettings, 'animSpeed', 0, 2, 0.01).name('Velocidad anim.').onChange(val => currentAnimationSpeed = val);

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
        // Calcular desplazamiento lateral basado en eyeSep y orientación de la cámara
        const rightOffset = camera.getWorldDirection(new THREE.Vector3())
            .cross(camera.up)
            .normalize()
            .multiplyScalar(eyeSep / 2);
        
        cameraLeft.copy(camera).position.add(rightOffset);
        cameraRight.copy(camera).position.sub(rightOffset);

        // Renderizar vistas izquierda y derecha
        renderer.setRenderTarget(rtLeft);
        renderer.render(scene, cameraLeft);
        renderer.setRenderTarget(rtRight);
        renderer.render(scene, cameraRight);

        // Renderizar composición final al canvas
        renderer.setRenderTarget(null);
        renderer.render(quadScene, quadCamera);
    } else {
        // Render normal
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
selectElement.addEventListener('change', (e) => switchModel(e.target.value));

// Inicializar el uniform de modo
quadMesh.material.uniforms.mode.value = 0; // positivo por defecto

loadAllModels().then(() => {
    console.log('✅ Modelos cargados');
    switchModel(selectElement.value);
    animate();
}).catch(err => {
    console.error('❌ Error:', err);
});