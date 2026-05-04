/**
 * main.js — Visor 3D Anaglifo (Versión Profesional Definitiva)
 */

import * as THREE from 'three';
import { FBXLoader }       from 'three/addons/loaders/FBXLoader.js';
import { AnaglyphEffect }  from 'three/addons/effects/AnaglyphEffect.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { GUI }             from 'three/addons/libs/lil-gui.module.min.js';

// ─── Estado global ────────────────────────────────────────────────────────────
let camera, scene, renderer, effect, controls, mixer;
let grid, ambientLight, modeloCargado, guiGlobal;
let animacionPausada = false;

const clock = new THREE.Clock(); 

// Posición y target iniciales de la cámara (para el reset)
const CAMERA_INIT = { 
    pos: new THREE.Vector3(0, 3, 10), 
    target: new THREE.Vector3(0, 3, 0),
    fov: 60
};

// ─── Modelos disponibles (Asegúrate de que existan en la carpeta /models/) ───
const MODELOS = [
    'Capoeira.fbx',
    'Standard Run.fbx',
    'Jump Attack.fbx',
    'Thriller Part 3.fbx',
    'Flying Knee Punch Combo.fbx'
];

// ─── Valores por Defecto (Para el botón de Reset) ────────────────────────────
const PARAMETROS_DEFAULT = {
    modelo:            'Capoeira.fbx',
    // Efecto 3D
    profundidad3D:     10,    // 10 = Neutro
    separacionFija:    0.064, // Separación base ocular
    // Cámara
    fov:               60,
    zoomVisual:        1,
    alturaCamara:      3,
    // Entorno
    escalaModelo:      0.05,
    colorFondo:        '#555555',
    brillo:            2.5,
    verRejilla:        true
};

// Objeto reactivo que la GUI modificará
const parametros = JSON.parse(JSON.stringify(PARAMETROS_DEFAULT));

// ─── Inicialización ────────────────────────────────────────────────────────────
init();

function init() {
    const container = document.getElementById('container');

    if ('ontouchstart' in window) {
        document.getElementById('instructions-text').textContent =
            'Ponte tus lentes Rojo/Cián · Arrastra para rotar · Pellizca para zoom';
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(parametros.colorFondo);
    scene.fog = new THREE.Fog(parametros.colorFondo, 10, 80);

    camera = new THREE.PerspectiveCamera(parametros.fov, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.copy(CAMERA_INIT.pos);

    ambientLight = new THREE.AmbientLight(0xffffff, parametros.brillo);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 3);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 4);
    dirLight.position.set(0, 10, 5);
    scene.add(dirLight);

    grid = new THREE.GridHelper(50, 20, 0xffffff, 0xffffff);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    grid.visible = parametros.verRejilla;
    scene.add(grid);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    effect = new AnaglyphEffect(renderer);
    effect.setSize(window.innerWidth, window.innerHeight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_INIT.target);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.05;

    cargarModelo();
    setupGUI();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);

    document.getElementById('btn-retry').addEventListener('click', () => {
        document.getElementById('error-overlay').hidden = true;
        cargarModelo();
    });

    renderer.setAnimationLoop(animate);
}

// ─── Carga del modelo ──────────────────────────────────────────────────────────
function cargarModelo() {
    const overlay    = document.getElementById('loading-overlay');
    const barFill    = document.getElementById('loader-bar');
    const barPercent = document.getElementById('loader-percent');

    overlay.classList.remove('oculto');

    const loader = new FBXLoader();

    loader.load(
        `models/${parametros.modelo}`,
        function onLoad(object) {
            if (object.animations && object.animations.length > 0) {
                mixer = new THREE.AnimationMixer(object);
                mixer.clipAction(object.animations[0]).play();
            }

            object.traverse(child => {
                if (child.isMesh) {
                    child.castShadow    = true;
                    child.receiveShadow = true;
                }
            });

            if (modeloCargado) {
                scene.remove(modeloCargado);
                modeloCargado.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
            }

            modeloCargado = object;
            modeloCargado.scale.setScalar(parametros.escalaModelo);
            scene.add(modeloCargado);

            overlay.classList.add('oculto');
        },
        function onProgress(xhr) {
            if (xhr.lengthComputable) {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                barFill.style.width    = pct + '%';
                barPercent.textContent = pct + '%';
            }
        },
        function onError(error) {
            console.error('Error al cargar el modelo FBX:', error);
            overlay.classList.add('oculto');
            document.getElementById('error-message').textContent =
                `No se pudo cargar "${parametros.modelo}". Verifica que el archivo exista en la carpeta /models/.`;
            document.getElementById('error-overlay').hidden = false;
        }
    );
}

// ─── Actualizar Matriz de Cámara ───────────────────────────────────────────────
function actualizarCamaraOptica() {
    const direccion = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(direccion, parametros.profundidad3D);
    
    camera.zoom = (parametros.profundidad3D / 10) * parametros.zoomVisual; 
    
    camera.position.y = parametros.alturaCamara;
    controls.target.y = parametros.alturaCamara;

    camera.fov = parametros.fov;
    camera.updateProjectionMatrix();
    controls.update();
}

// ─── GUI de controles ──────────────────────────────────────────────────────────
function cambiarModelo(nombre) {
    parametros.modelo = nombre;
    if (mixer) {
        mixer.stopAllAction();
        mixer = null;
    }
    cargarModelo();
}

function setupGUI() {
    const guiModelos = new GUI({ title: '🎭 Modelos' });
    guiModelos.domElement.style.position = 'absolute';
    guiModelos.domElement.style.top      = '20px';
    guiModelos.domElement.style.left     = '20px';
    guiModelos.domElement.style.right    = 'auto';

    MODELOS.forEach(nombre => {
        const label = nombre.replace('.fbx', '');
        guiModelos.add({ cargar: () => cambiarModelo(nombre) }, 'cargar').name(label);
    });

    guiGlobal = new GUI({ title: 'Ajustes del Escenario', width: 320 });

    const folder3D = guiGlobal.addFolder('Efecto Anaglifo (Rojo/Cián)');
    folder3D.add(parametros, 'profundidad3D', 4, 25, 0.5)
        .name('Intensidad (Pop-Out)')
        .onChange(actualizarCamaraOptica);
    
    // Al cambiar este valor, se aplica directamente en el loop animate()
    folder3D.add(parametros, 'separacionFija', 0.0, 0.15, 0.001)
        .name('Separación Ocular Fina');

    const folderCamara = guiGlobal.addFolder('Controles de Cámara');
    folderCamara.add(parametros, 'fov', 30, 120, 1)
        .name('Campo de Visión (FOV)')
        .onChange(actualizarCamaraOptica);
    folderCamara.add(parametros, 'zoomVisual', 0.5, 3, 0.1)
        .name('Zoom Lente')
        .onChange(actualizarCamaraOptica);
    folderCamara.add(parametros, 'alturaCamara', 0, 8, 0.1)
        .name('Altura de Enfoque')
        .onChange(actualizarCamaraOptica);

    const folderEntorno = guiGlobal.addFolder('Entorno Visual');
    folderEntorno.add(parametros, 'escalaModelo', 0.01, 0.15, 0.005)
        .name('Tamaño del modelo')
        .onChange(valor => {
            if (modeloCargado) modeloCargado.scale.setScalar(valor);
        });
    folderEntorno.addColor(parametros, 'colorFondo')
        .name('Color de fondo')
        .onChange(color => {
            scene.background.set(color);
            scene.fog.color.set(color);
        });
    folderEntorno.add(parametros, 'brillo', 0, 5, 0.1)
        .name('Luz ambiental')
        .onChange(valor => {
            ambientLight.intensity = valor;
        });
    folderEntorno.add(parametros, 'verRejilla')
        .name('Mostrar piso')
        .onChange(valor => {
            grid.visible = valor;
        });

    guiGlobal.add({ reset: resetearTodo }, 'reset').name('🔄 Restaurar Ajustes por Defecto');
    
    folder3D.open();
    folderCamara.close();
}

// ─── Reset General ─────────────────────────────────────────────────────────────
function resetearTodo() {
    Object.assign(parametros, PARAMETROS_DEFAULT);

    scene.background.set(parametros.colorFondo);
    scene.fog.color.set(parametros.colorFondo);
    ambientLight.intensity = parametros.brillo;
    grid.visible = parametros.verRejilla;
    if (modeloCargado) modeloCargado.scale.setScalar(parametros.escalaModelo);

    camera.position.copy(CAMERA_INIT.pos);
    controls.target.copy(CAMERA_INIT.target);
    actualizarCamaraOptica(); 

    guiGlobal.controllersRecursive().forEach(controlador => {
        controlador.updateDisplay();
    });
}

// ─── Eventos de teclado ────────────────────────────────────────────────────────
function onKeyDown(e) {
    switch (e.code) {
        case 'KeyR':
            resetearTodo();
            break;
        case 'Space':
            e.preventDefault();
            animacionPausada = !animacionPausada;
            if (!animacionPausada) clock.getDelta(); 
            break;
    }
}

// ─── Redimensionamiento ────────────────────────────────────────────────────────
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    effect.setSize(window.innerWidth, window.innerHeight);
}

// ─── Loop de animación ─────────────────────────────────────────────────────────
function animate() {
    const delta = animacionPausada ? 0 : clock.getDelta();

    if (mixer) mixer.update(delta);

    controls.update(); 

    // INYECCIÓN OBLIGATORIA: Fuerza a Three.js a usar nuestra separación en cada fotograma
    const stereo = effect.stereo ?? effect._stereo;
    if (stereo) stereo.eyeSep = parametros.separacionFija;

    effect.render(scene, camera);
}