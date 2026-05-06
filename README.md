# Visor 3D Anaglifo - Mixamo Animation Player 🎬

![Three.js](https://img.shields.io/badge/Three.js-r160-black?style=for-the-badge&logo=three.js)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript)
![WebGL](https://img.shields.io/badge/WebGL-Estereoscopía-red?style=for-the-badge&logo=webgl)

Este proyecto es un visualizador interactivo de modelos 3D que utiliza tecnología de **estereoscopía anaglifo** (rojo/cian) para generar una percepción de profundidad real en navegadores web. Desarrollado con **Three.js**, permite la visualización y control de animaciones complejas de Mixamo en un entorno virtual optimizado.

## 👤 Autor
**Luis Enrique Cabrera Garcia**  
*Estudiante de ITICS | Desarrollo de soluciones en ambientes virtuales*

---

## 🚀 Características Principales

- **Efecto Anaglifo Real:** Procesamiento de imagen mediante Shaders personalizados (GLSL) para modos de color, grises y negativo.
- **Control Estereoscópico:** Ajuste dinámico de la separación ocular y distancia focal para personalizar la convergencia del 3D.
- **Interfaz Glassmorphism:** UI moderna y translúcida que incluye un panel de control avanzado, botones de pantalla completa y monitor de rendimiento (FPS).
- **Gestión de Animaciones:** Carga asíncrona de múltiples archivos FBX con un sistema de transiciones suaves (fading) para evitar saltos visuales.
- **Guía de Uso Integrada:** Modal interactivo con pestañas que explica el funcionamiento de las lentes y la navegación en la escena.

## 👓 Guía de Visualización (Pop-Out Effect)

Para experimentar el efecto de que el modelo "salga" de la pantalla:
1. Utiliza lentes anaglifo **Rojo (Izquierdo) / Cian (Derecho)**.
2. Activa el modo **Anaglifo** en el panel de Controles.
3. Presiona el botón **🚀 ¡Que SALGA de pantalla!** para configurar automáticamente el paralaje negativo y la convergencia ideal.

## 🛠️ Tecnologías Utilizadas

- **Three.js (r160):** Motor principal para el renderizado de la escena, luces y cámaras.
- **FBXLoader:** Para la importación y parseo de modelos animados de Mixamo.
- **lil-gui:** Interfaz de control en tiempo real para parámetros estéreo e iluminación.
- **Stats.js:** Monitorización de rendimiento y cuadros por segundo.
- **CSS3 (Glassmorphism):** Estilos avanzados con desenfoque de fondo y bordes translúcidos.

## 📂 Estructura del Proyecto
```text
├── index.html      # Estructura principal y contenedores de UI
├── main.css        # Estilos de interfaz, loader y modal
├── main.js         # Lógica de Three.js, Shaders y eventos
└── models/         # Directorio de modelos .fbx (Mixamo)