import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';

// ---------- CONFIGURACIÓN ----------
const MODEL_FILES = [
    'Capoeira.fbx',
    'Flying Knee Punch Combo.fbx',
    'Jump Attack.fbx',
    'Standard Run.fbx',
    'Thriller Part 3.fbx'
];

const MODELS_PATH = 'models/';

// ---------- ESCENA, CÁMARA, RENDERER ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122); // fondo oscuro azulado
scene.fog = new THREE.Fog(0x111122, 10, 50);

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
document.body.appendChild(renderer.domElement);

// Efecto Anaglifo (rojo/cian)
const effect = new AnaglyphEffect(renderer);
effect.setSize(window.innerWidth, window.innerHeight);

// Controles de órbita (sobre la cámara principal)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// ---------- ILUMINACIÓN ----------
// Luz ambiente suave
const ambientLight = new THREE.AmbientLight(0x404066);
scene.add(ambientLight);

// Luz principal direccional con sombras
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

// Luz de relleno (atrás)
const backLight = new THREE.PointLight(0x4466ff, 1, 20);
backLight.position.set(-5, 2, -5);
scene.add(backLight);

// ---------- SUELO (para referencia de profundidad) ----------
const groundGeometry = new THREE.PlaneGeometry(20, 20);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x223344,
    roughness: 0.8,
    metalness: 0.2,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// Rejilla decorativa
const gridHelper = new THREE.GridHelper(20, 20, 0x336699, 0x224466);
gridHelper.position.y = 0;
scene.add(gridHelper);

// ---------- CARGA DE MODELOS FBX ----------
const loader = new FBXLoader();
const modelsCache = {};          // clave: nombre de archivo, valor: { model, mixer, animations }
let currentModel = null;        // referencia al grupo activo
let currentMixer = null;        // mixer activo
const clock = new THREE.Clock();

// Función para cargar todos los modelos y guardarlos ocultos
function loadAllModels() {
    const loadPromises = MODEL_FILES.map((filename) => {
        return new Promise((resolve, reject) => {
            loader.load(
                MODELS_PATH + filename,
                (fbx) => {
                    // Preparar el modelo
                    fbx.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            // Mejorar materiales para que se vean bien con poca luz
                            if (child.material) {
                                child.material.roughness = 0.6;
                                child.material.metalness = 0.1;
                            }
                        }
                    });

                    // Ajustar escala y posición (los modelos de Mixamo suelen ser grandes)
                    fbx.scale.set(0.01, 0.01, 0.01);
                    fbx.position.set(0, 0, 0);

                    // Animaciones
                    const mixer = new THREE.AnimationMixer(fbx);
                    if (fbx.animations && fbx.animations.length > 0) {
                        fbx.animations.forEach((clip) => {
                            mixer.clipAction(clip).play();
                        });
                    }

                    // Ocultar por defecto
                    fbx.visible = false;
                    scene.add(fbx);

                    modelsCache[filename] = {
                        model: fbx,
                        mixer: mixer,
                        animations: fbx.animations,
                    };

                    resolve();
                },
                undefined,
                (error) => {
                    console.error(`Error cargando ${filename}:`, error);
                    reject(error);
                }
            );
        });
    });

    return Promise.all(loadPromises);
}

// Cambiar el modelo visible según selección
function switchModel(filename) {
    // Ocultar modelo anterior
    if (currentModel) {
        currentModel.visible = false;
        // No detenemos el mixer anterior, se pausa al ocultar
        if (currentMixer) {
            currentMixer.time = 0; // reiniciar la animación
        }
    }

    const entry = modelsCache[filename];
    if (!entry) return;

    // Mostrar nuevo modelo
    entry.model.visible = true;
    currentModel = entry.model;
    currentMixer = entry.mixer;

    // Ajustar cámara para que encuadre el nuevo modelo (opcional)
    const box = new THREE.Box3().setFromObject(entry.model);
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    controls.update();
}

// ---------- INTERFAZ DE USUARIO ----------
const selectElement = document.getElementById('model-select');
selectElement.addEventListener('change', (event) => {
    switchModel(event.target.value);
});

// ---------- BUCLE DE ANIMACIÓN ----------
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Actualizar mixer del modelo activo
    if (currentMixer) {
        currentMixer.update(delta);
    }

    // Actualizar controles
    controls.update();

    // Renderizar con efecto anaglifo
    effect.render(scene, camera);
}

// ---------- REDIMENSIONAR VENTANA ----------
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    effect.setSize(window.innerWidth, window.innerHeight);
}

// ---------- INICIO ----------
loadAllModels()
    .then(() => {
        console.log('✅ Todos los modelos cargados');
        // Seleccionar el modelo por defecto
        const defaultModel = selectElement.value;
        if (modelsCache[defaultModel]) {
            switchModel(defaultModel);
        }
        // Iniciar bucle
        animate();
    })
    .catch((error) => {
        console.error('❌ Error al cargar los modelos:', error);
        // Mostrar mensaje en pantalla
        const errorMsg = document.createElement('div');
        errorMsg.style.position = 'absolute';
        errorMsg.style.top = '50%';
        errorMsg.style.left = '50%';
        errorMsg.style.transform = 'translate(-50%, -50%)';
        errorMsg.style.color = 'red';
        errorMsg.style.fontSize = '20px';
        errorMsg.textContent = 'Error al cargar los modelos. Revisa la ruta.';
        document.body.appendChild(errorMsg);
    });