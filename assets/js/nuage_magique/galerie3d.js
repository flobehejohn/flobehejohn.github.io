// galerie3d.js --------------------------------------------------------------
import { OrbitControls } from './OrbitControls.js';
import THREE from './bootstrap.js'; // <-- CORRECTION IMPORT

let scene3d, camera3d, renderer3d, controls3d;

export function initGalerie3D(containerId = 'cloud-bg') {
    /* ---------- conteneur ---------- */
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[galerie3d.js] Container #${containerId} introuvable`);
        return;
    }
    container.style.position ??= 'relative';

    /* ---------- scène & camera ---------- */
    scene3d = new THREE.Scene();
    scene3d.background = null;                // rendu transparent

    camera3d = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera3d.position.set(0, 0, 8);

    /* ---------- renderer ---------- */
    renderer3d = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer3d.outputColorSpace = THREE.SRGBColorSpace;                 // rendu correct sur écrans modernes
    renderer3d.setPixelRatio(Math.min(window.devicePixelRatio, 2));     // retina friendly
    renderer3d.setSize(window.innerWidth, window.innerHeight);

    Object.assign(renderer3d.domElement.style, {
        position: 'absolute',
        inset: '0',                           // top/left/bottom/right = 0
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',                // nécessaire pour OrbitControls
        zIndex: 3
    });
    container.appendChild(renderer3d.domElement);

    /* ---------- contrôles souris ---------- */
    controls3d = new OrbitControls(camera3d, renderer3d.domElement);
    controls3d.enableZoom = false;
    controls3d.enablePan  = false;
    controls3d.dampingFactor = 0.08;
    controls3d.minDistance = 6;
    controls3d.maxDistance = 15;

    /* ---------- lumières ---------- */
    scene3d.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dlight = new THREE.DirectionalLight(0xffffff, 0.8);
    dlight.position.set(5, 5, 10);
    scene3d.add(dlight);

    /* ---------- galerie (3 meshes) ---------- */
    const mat  = new THREE.MeshStandardMaterial({ color: 0x6cc6f9, metalness: 0.3, roughness: 0.5 });

    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat.clone());
    mesh1.position.x = -2.5;
    scene3d.add(mesh1);

    const mesh2 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 32), mat.clone());
    scene3d.add(mesh2);

    const mesh3 = new THREE.Mesh(new THREE.TorusKnotGeometry(0.7, 0.25, 90, 16), mat.clone());
    mesh3.position.x = 2.5;
    scene3d.add(mesh3);

    /* ---------- animation ---------- */
    const clock = new THREE.Clock();
    function animate3d() {
        requestAnimationFrame(animate3d);
        const t = clock.getElapsedTime();

        mesh1.rotation.y = t * 0.8;
        mesh2.rotation.x = t * 0.8;
        mesh3.rotation.z = t * 0.8;

        controls3d.update();
        renderer3d.render(scene3d, camera3d);
    }
    animate3d();

    /* ---------- resize ---------- */
    window.addEventListener('resize', () => {
        camera3d.aspect = window.innerWidth / window.innerHeight;
        camera3d.updateProjectionMatrix();
        renderer3d.setSize(window.innerWidth, window.innerHeight);
    });
}
