import THREE from './bootstrap.js';

// OrbitControls minimal, sans alias "that" pour "this"
class OrbitControls extends THREE.EventDispatcher {
    constructor(object, domElement) {
        super();

        this.object = object;
        this.domElement = domElement;
        this.enabled = true;
        this.target = new THREE.Vector3();
        this.minDistance = 0;
        this.maxDistance = Infinity;
        this.enableDamping = true;
        this.dampingFactor = 0.08;
        this.enableZoom = true;
        this.zoomSpeed = 1;
        this.enableRotate = true;
        this.rotateSpeed = 0.85;

        // États internes simplifiés
        let isDragging = false, lastX = 0, lastY = 0, phi = 0, theta = 0, radius = 20;

        const onPointerDown = (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        };
        const onPointerUp = () => { isDragging = false; };
        const onPointerMove = (e) => {
            if (!isDragging) return;
            const dx = (e.clientX - lastX) * 0.01 * this.rotateSpeed;
            const dy = (e.clientY - lastY) * 0.01 * this.rotateSpeed;
            theta -= dx;
            phi -= dy;
            phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi));
            lastX = e.clientX;
            lastY = e.clientY;
        };
        const onWheel = (e) => {
            radius *= (1 + e.deltaY * 0.001 * this.zoomSpeed);
            radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));
        };
        domElement.addEventListener('pointerdown', onPointerDown);
        domElement.addEventListener('pointerup', onPointerUp);
        domElement.addEventListener('pointerleave', onPointerUp);
        domElement.addEventListener('pointermove', onPointerMove);
        domElement.addEventListener('wheel', onWheel, { passive: false });

        // Boucle update (appelée à chaque frame)
        this.update = function () {
            const x = radius * Math.sin(phi) * Math.sin(theta);
            const y = radius * Math.cos(phi);
            const z = radius * Math.sin(phi) * Math.cos(theta);
            object.position.set(x, y, z).add(this.target);
            object.lookAt(this.target);
        };
        // Init à une position cam
        theta = Math.PI / 2;
        phi = Math.PI / 2.2;
        radius = object.position.length();
    }
}
export { OrbitControls };
