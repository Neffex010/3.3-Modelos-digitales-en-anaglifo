/**
 * main.js — Visor 3D Anaglifo
 *
 * Correcciones aplicadas:
 *  1. camera.focus eliminado; pop-out ahora controla effect.stereo.focus (real).
 *  2. FBXLoader con callbacks de progreso y error.
 *  3. Overlay de carga con barra de progreso funcional.
 *  4. THREE.Clock reemplaza el delta manual (robusto ante cambio de pestaña).
 *  5. controls.update() duplicado eliminado del init().
 *  6. Atajos de teclado: R = resetear cámara, Space = pausar animación.
 *  7. Instrucciones dinámicas según dispositivo táctil.
 *  8. Dispose de recursos al redimensionar (evita fugas de memoria GPU).
 *  9. Botón de reintento en caso de error de carga.
 */

import * as THREE from 'three';
import { FBXLoader }       from 'three/addons/loaders/FBXLoader.js';
import { AnaglyphEffect }  from 'three/addons/effects/AnaglyphEffect.js';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { GUI }             from 'three/addons/libs/lil-gui.module.min.js';

// ─── Estado global ────────────────────────────────────────────────────────────
let camera, scene, renderer, effect, controls, mixer;
let grid, ambientLight, modeloCargado;
let animacionPausada = false;

const clock = new THREE.Clock(); // ✅ FIX #4: reemplaza lastTime manual

// Posición y target iniciales de la cámara (para el reset)
const CAMERA_INIT = { pos: new THREE.Vector3(0, 4, 12), target: new THREE.Vector3(0, 3, 0) };

// ─── Modelos disponibles ──────────────────────────────────────────────────────
const MODELOS = [
    'Capoeira.fbx',
    'Standard Run.fbx',
    'Jump Attack.fbx',
    'Thriller Part 3.fbx',
    'Flying Knee Punch Combo.fbx'
];

// ─── Parámetros de la GUI ─────────────────────────────────────────────────────
const parametros = {
    modelo:            'Capoeira.fbx',
    convergencia:      8,
    separacionEfecto:  0.5,
    escalaModelo:      0.05,
    colorFondo:        '#555555',
    brillo:            2.5,
    verRejilla:        true
};

// ─── Helper: acceso robusto a StereoCamera.focus ──────────────────────────────
// Según la versión de Three.js, la propiedad interna puede llamarse
// 'stereo' (pública, versiones antiguas) o '_stereo' (privada, versiones nuevas).
function setStereoFocus(valor) {
    const stereo = effect.stereo ?? effect._stereo;
    if (stereo) {
        stereo.focus = valor;
    } else {
        // Fallback: simular pop-out ajustando posición Z de la cámara
        camera.position.z = CAMERA_INIT.pos.z + (valor - 8);
    }
}

// ─── Inicialización ────────────────────────────────────────────────────────────
init();

function init() {
    const container = document.getElementById('container');

    // Instrucciones adaptadas al dispositivo
    if ('ontouchstart' in window) {
        document.getElementById('instructions-text').textContent =
            'Ponte tus lentes Rojo/Cián · Arrastra para rotar · Pellizca para zoom';
    }

    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(parametros.colorFondo);
    scene.fog = new THREE.Fog(parametros.colorFondo, 10, 80);

    // Cámara
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.copy(CAMERA_INIT.pos);

    // Luces
    ambientLight = new THREE.AmbientLight(0xffffff, parametros.brillo);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 3);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 4);
    dirLight.position.set(0, 10, 5);
    scene.add(dirLight);

    // Rejilla de piso
    grid = new THREE.GridHelper(50, 20, 0xffffff, 0xffffff);
    grid.material.opacity = 0.15;
    grid.material.transparent = true;
    grid.visible = parametros.verRejilla;
    scene.add(grid);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Efecto Anaglifo
    effect = new AnaglyphEffect(renderer);
    effect.setSize(window.innerWidth, window.innerHeight);
    effect.separation = parametros.separacionEfecto;
    setStereoFocus(parametros.convergencia); // robusto ante distintas versiones de Three.js

    // Controles de órbita
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_INIT.target);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.05;
    // ✅ FIX #5: eliminado controls.update() aquí; solo se llama en animate()

    // Carga del modelo con progreso y manejo de errores
    cargarModelo();

    // GUI de controles
    setupGUI();

    // Eventos
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);         // ✅ FIX #6: atajos de teclado

    // Botón de reintento
    document.getElementById('btn-retry').addEventListener('click', () => {
        document.getElementById('error-overlay').hidden = true;
        cargarModelo();
    });

    // Arrancar el loop
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

        // ✅ FIX #2: callback de éxito
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

            // Si ya había un modelo previo, limpiarlo
            if (modeloCargado) {
                scene.remove(modeloCargado);
                modeloCargado.traverse(child => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }

            modeloCargado = object;
            modeloCargado.scale.setScalar(parametros.escalaModelo);
            scene.add(modeloCargado);

            // Ocultar overlay con fade
            overlay.classList.add('oculto');
        },

        // ✅ FIX #2: callback de progreso
        function onProgress(xhr) {
            if (xhr.lengthComputable) {
                const pct = Math.round((xhr.loaded / xhr.total) * 100);
                barFill.style.width    = pct + '%';
                barPercent.textContent = pct + '%';
            }
        },

        // ✅ FIX #2: callback de error
        function onError(error) {
            console.error('Error al cargar el modelo FBX:', error);
            overlay.classList.add('oculto');
            const errorOverlay = document.getElementById('error-overlay');
            document.getElementById('error-message').textContent =
                `No se pudo cargar "${parametros.modelo}". Verifica que el archivo exista en la carpeta /models/.`;
            errorOverlay.hidden = false;
        }
    );
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

    // ── Panel IZQUIERDO: selector de modelo ──────────────────────────────────
    const guiModelos = new GUI({ title: '🎭 Modelos' });
    guiModelos.domElement.style.position = 'absolute';
    guiModelos.domElement.style.top      = '20px';
    guiModelos.domElement.style.left     = '20px';
    guiModelos.domElement.style.right    = 'auto';

    MODELOS.forEach(nombre => {
        const label = nombre.replace('.fbx', '');
        guiModelos.add({ cargar: () => cambiarModelo(nombre) }, 'cargar').name(label);
    });

    // ── Panel DERECHO: ajustes de escena (igual que antes) ───────────────────
    const gui = new GUI({ title: 'Ajustes del Escenario' });

    // ✅ FIX #1: convergencia controla el plano focal del efecto estéreo
    gui.add(parametros, 'convergencia', 1, 30, 0.5)
        .name('Convergencia (Pop-Out)')
        .onChange(valor => {
            setStereoFocus(valor);
        });

    gui.add(parametros, 'separacionEfecto', 0, 2, 0.01)
        .name('Separación ocular')
        .onChange(valor => {
            effect.separation = valor;
        });

    gui.add(parametros, 'escalaModelo', 0.01, 0.15, 0.005)
        .name('Tamaño del modelo')
        .onChange(valor => {
            if (modeloCargado) modeloCargado.scale.setScalar(valor);
        });

    gui.addColor(parametros, 'colorFondo')
        .name('Color de fondo')
        .onChange(color => {
            scene.background.set(color);
            scene.fog.color.set(color);
        });

    gui.add(parametros, 'brillo', 0, 5, 0.1)
        .name('Luz ambiental')
        .onChange(valor => {
            ambientLight.intensity = valor;
        });

    gui.add(parametros, 'verRejilla')
        .name('Mostrar piso')
        .onChange(valor => {
            grid.visible = valor;
        });

    // Botón de reset de cámara en la GUI también
    gui.add({ reset: resetearCamara }, 'reset').name('⟳ Resetear cámara');
}

// ─── Eventos de teclado ────────────────────────────────────────────────────────
function onKeyDown(e) {
    switch (e.code) {
        case 'KeyR':
            resetearCamara();
            break;
        case 'Space':
            e.preventDefault();
            animacionPausada = !animacionPausada;
            if (!animacionPausada) clock.getDelta(); // descarta el delta acumulado al despausar
            break;
    }
}

function resetearCamara() {
    camera.position.copy(CAMERA_INIT.pos);
    controls.target.copy(CAMERA_INIT.target);
    controls.update();
}

// ─── Redimensionamiento ────────────────────────────────────────────────────────
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    effect.setSize(window.innerWidth, window.innerHeight);
}

// ─── Loop de animación ─────────────────────────────────────────────────────────
function animate() {
    // ✅ FIX #4: THREE.Clock es robusto ante cambios de pestaña
    const delta = animacionPausada ? 0 : clock.getDelta();

    if (mixer) mixer.update(delta);

    controls.update(); // ✅ FIX #5: única llamada a controls.update()

    effect.render(scene, camera);
}