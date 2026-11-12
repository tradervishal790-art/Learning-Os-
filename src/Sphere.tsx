import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Sphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    // The sphere is 4 units wide. On a tall, narrow phone screen the default distance (5) is too
    // close and crops its sides, so pull the camera back until the whole sphere fits across.
    const fitCamera = (aspect: number) => {
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.z = Math.max(5, 4.6 / (2 * halfFov * aspect));
    };
    fitCamera(width / height);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    // 3x phone screens would render 9 pixels per CSS pixel for a thin wireframe: cap at 2x.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Sphere
    const geometry = new THREE.IcosahedronGeometry(2, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Points
    const pointsGeometry = new THREE.IcosahedronGeometry(2, 1);
    const pointsMaterial = new THREE.PointsMaterial({
      color: 0xa855f7,
      size: 0.05,
      transparent: true,
      opacity: 0.9,
    });
    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(points);

    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    // Touch screens have no hover pointer, so the cursor-follow tilt only exists with a mouse.
    if (finePointer) window.addEventListener('mousemove', handleMouseMove);

    // Track the frame id so we can cancel it on unmount — without this the
    // render loop keeps running (and burning CPU) even after the component
    // is gone, e.g. when the user navigates from landing -> onboarding.
    let frameId = 0;
    const renderFrame = () => {
      points.rotation.x = sphere.rotation.x;
      points.rotation.y = sphere.rotation.y;
      renderer.render(scene, camera);
    };
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      sphere.rotation.x += 0.002;
      sphere.rotation.y += 0.003;

      sphere.rotation.y += mouseX * 0.001;
      sphere.rotation.x += mouseY * 0.001;

      renderFrame();
    };
    const start = () => {
      if (reduceMotion || frameId) return;
      frameId = requestAnimationFrame(animate);
    };
    const stop = () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
    };
    // Reduced motion: a single still frame. Otherwise spin, but pause while the tab is hidden.
    renderFrame();
    start();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      fitCamera(w / h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (!frameId) renderFrame();
    };
    const handleVisibility = () => (document.hidden ? stop() : start());
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}