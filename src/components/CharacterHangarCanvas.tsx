import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CharacterConfig, WeaponId } from '../types/game';
import { buildCharacterMesh, CharacterRig } from '../three/models';
import {
  createStudioRenderer,
  detectSoftwareWebGL,
  disposeObjectTree,
  scheduleAfterDraw,
  setupStudioEnvironment,
} from '../three/webglUtils';

interface CharacterHangarCanvasProps {
  character: CharacterConfig;
  previewWeaponId: WeaponId;
}

export const CharacterHangarCanvas: React.FC<CharacterHangarCanvasProps> = ({
  character,
  previewWeaponId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rigRef = useRef<CharacterRig | null>(null);
  const charGroupRef = useRef<THREE.Group | null>(null);
  const autoRotateAngleRef = useRef(0.35);

  // Initialize WebGL scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    const isSoftwareGl = detectSoftwareWebGL();
    try {
      renderer = createStudioRenderer(container, isSoftwareGl);
    } catch {
      setWebglError(true);
      return;
    }

    const canvas = renderer.domElement;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f15);
    scene.fog = new THREE.FogExp2(0x0b0f15, 0.045);
    sceneRef.current = scene;

    const envTex = setupStudioEnvironment(renderer, scene);

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      60
    );
    camera.position.set(0.3, 1.55, 3.85);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.05, 0);
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 6.2;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.update();

    // Three-point Studio Lighting + Hemisphere fill
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.55);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.9);
    keyLight.position.set(3.5, 5.5, 4.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -2.5;
    keyLight.shadow.camera.right = 2.5;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -1;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    rimLight.position.set(-3.5, 3.2, -3.5);
    scene.add(rimLight);

    // Hangar Floor & Pedestal Turntable
    const hangarFloor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f141c, roughness: 0.72, metalness: 0.25 })
    );
    hangarFloor.rotation.x = -Math.PI / 2;
    hangarFloor.receiveShadow = true;
    scene.add(hangarFloor);

    const pedestalBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.3, 0.14, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.75 })
    );
    pedestalBase.position.y = 0.07;
    pedestalBase.receiveShadow = true;
    scene.add(pedestalBase);

    const pedestalRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.025, 10, 48),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.25,
      })
    );
    pedestalRing.rotation.x = Math.PI / 2;
    pedestalRing.position.y = 0.145;
    scene.add(pedestalRing);

    const charHolder = new THREE.Group();
    charHolder.position.y = 0.14;
    scene.add(charHolder);
    charGroupRef.current = charHolder;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let disposed = false;
    let isInteracting = false;
    controls.addEventListener('start', () => {
      isInteracting = true;
    });
    controls.addEventListener('end', () => {
      isInteracting = false;
    });

    const clock = new THREE.Clock();

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      if (rigRef.current) {
        if (!isInteracting) {
          autoRotateAngleRef.current += dt * 0.28;
        }
        rigRef.current.root.rotation.y = autoRotateAngleRef.current;
        // Subtle idle breathing
        rigRef.current.bodyGroup.position.y = Math.sin(elapsed * 2.2) * 0.012;
        rigRef.current.headGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.08;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        scheduleAfterDraw(renderer, (id) => {
          frameId = id;
        }, tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      disposeObjectTree(scene);
      envTex.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  // Rebuild operator mesh whenever customization or preview weapon changes
  useEffect(() => {
    const holder = charGroupRef.current;
    if (!holder) return;

    while (holder.children.length > 0) {
      const child = holder.children[0];
      holder.remove(child);
      disposeObjectTree(child);
    }

    const rig = buildCharacterMesh(
      character,
      previewWeaponId,
      character.weaponAttachments?.[previewWeaponId],
      character.weaponFinishes?.[previewWeaponId]
    );
    // Face slightly toward viewer initially (mesh faces -Z, so rotate PI to face +Z camera)
    rig.root.rotation.y = autoRotateAngleRef.current + Math.PI;
    autoRotateAngleRef.current = Math.PI - 0.35;
    rig.root.rotation.y = autoRotateAngleRef.current;
    holder.add(rig.root);
    rigRef.current = rig;
  }, [character, previewWeaponId]);

  if (webglError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0f15] text-slate-300 p-6 text-center">
        <p className="font-display text-xl font-semibold text-amber-400">Vista previa 3D suspendida</p>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          Tu navegador no pudo inicializar WebGL en este momento. Puedes seguir personalizando tu operador y comenzar la partida.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing touch-none-canvas" />;
};
