import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import * as THREE from 'three';

/**
 * AlchemicalLabBackground — Handles both the 2D Phaser background
 * and the 3D Three.js environment for the shelves and props.
 */
export const AlchemicalLabBackground: React.FC<{ signalLevel?: number }> = ({ signalLevel = 0 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);
  const sceneRef     = useRef<any>(null);
  
  // Three.js refs
  const threeRef     = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    props: { obj: THREE.Object3D, type: string, baseIntensity: number }[];
    pointLight: THREE.PointLight;
    halo3D: THREE.Mesh;
    animationId: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const el = containerRef.current;

    let game: Phaser.Game | null = null;

    // ── 1. Initialize Phaser (2D Background) ──
    const initPhaser = async () => {
      const { default: PhaserLib } = await import('phaser');
      const { AlchemicalLabScene } = await import('./scenes/AlchemicalLabScene');
      if (!el || gameRef.current) return;

      const config = {
        type: PhaserLib.WEBGL,
        parent: el,
        width: el.offsetWidth  || window.innerWidth,
        height: el.offsetHeight || window.innerHeight,
        backgroundColor: '#010305',
        transparent: false,
        antialias: true,
        powerPreference: 'low-power',
        fps: { target: 30, forceSetTimeOut: false },
        scene: [AlchemicalLabScene],
        input: { mouse: false, touch: false, keyboard: false, gamepad: false },
      };

      game = new PhaserLib.Game(config);

      game.events.once('ready', () => {
        const scene = game?.scene.getScene('AlchemicalLabScene');
        sceneRef.current = scene;
        
        const canvas = el.querySelector('canvas');
        if (canvas) {
          canvas.style.position = 'absolute';
          canvas.style.inset    = '0';
          canvas.style.width    = '100%';
          canvas.style.height   = '100%';
          canvas.style.display  = 'block';
          canvas.style.zIndex   = '0'; // Behind 3D
        }
      });

      gameRef.current = game;
    };

    // ── 2. Initialize Three.js (3D Shelves & Props) ──
    const initThree = () => {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 2, 10);
      camera.lookAt(0, 2, 0);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.zIndex = '1'; // Above Phaser, below UI
      el.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0x00cfc8, 1, 20);
      pointLight.position.set(0, 5, 0);
      scene.add(pointLight);

      const props3D: any[] = [];

      // Materials
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2d241c, roughness: 0.7, metalness: 0.5 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x8b6b23, roughness: 0.3, metalness: 0.9 });
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.1 });
      const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.4 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1, roughness: 0.2 });

      // Shelf Builder
      const createShelf = (x: number, isLeft: boolean) => {
        const pillarGeo = new THREE.BoxGeometry(0.5, 8, 2);
        const pillar = new THREE.Mesh(pillarGeo, shelfMat);
        pillar.position.set(x + (isLeft ? -0.5 : 0.5), 2, 0);
        scene.add(pillar);

        for (let i = 0; i < 3; i++) {
          const y = -1 + i * 2.5;
          const plankGeo = new THREE.BoxGeometry(2.5, 0.2, 2);
          const plank = new THREE.Mesh(plankGeo, shelfMat);
          plank.position.set(x, y, 0);
          scene.add(plank);
          
          const trimGeo = new THREE.BoxGeometry(2.6, 0.25, 0.1);
          const trim = new THREE.Mesh(trimGeo, trimMat);
          trim.position.set(x, y, 1.05);
          scene.add(trim);

          // Populate Props
          if (i === 0) { // Bottom: Flasks
            const colors = [0x00cfc8, 0x9944ff];
            for(let j=0; j<2; j++) {
              const px = x + (j === 0 ? -0.5 : 0.5);
              const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), glassMat);
              body.position.set(px, y + 0.3, 0.5);
              scene.add(body);

              const liquidMat = new THREE.MeshStandardMaterial({ 
                color: colors[j], emissive: colors[j], emissiveIntensity: 0.5, transparent: true, opacity: 0.8 
              });
              const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), liquidMat);
              liquid.position.set(px, y + 0.3, 0.5);
              scene.add(liquid);
              props3D.push({ obj: liquid, type: 'flask', baseIntensity: 0.5 });
              
              const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.4, 16), glassMat);
              neck.position.set(px, y + 0.7, 0.5);
              scene.add(neck);
            }
          } else if (i === 1) { // Middle: Tomes (symmetric on both sides)
            for(let j=0; j<3; j++) {
              const book = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.2), darkMetal);
              book.position.set(x - 0.4 + j*0.3, y + 0.6, 0.5);
              book.rotation.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
              scene.add(book);
            }
          } else if (i === 2) { // Top: Crystal Orb (symmetric on both sides)
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.2, 32), goldMat);
            base.position.set(x, y + 0.1, 0.5);
            scene.add(base);

            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), glassMat);
            orb.position.set(x, y + 0.7, 0.5);
            scene.add(orb);

            const coreMat = new THREE.MeshStandardMaterial({ color: 0x9944ff, emissive: 0x9944ff, emissiveIntensity: 0.8 });
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), coreMat);
            core.position.set(x, y + 0.7, 0.5);
            scene.add(core);
            props3D.push({ obj: core, type: 'orb', baseIntensity: 0.8 });
          }
        }
      };

      // Calculate X positions based on screen ratio (approximate placement)
      const isWide = window.innerWidth > 1400;
      createShelf(isWide ? -6.5 : -5.5, true);
      createShelf(isWide ? 6.5 : 5.5, false);

      // Renaissance Halo (3D Torus)
      const haloGeo = new THREE.TorusGeometry(4, 0.05, 16, 100);
      const haloMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0xc9a227, emissiveIntensity: 0.5 });
      const halo3D = new THREE.Mesh(haloGeo, haloMat);
      halo3D.position.set(0, 3.5, -3); // Placed slightly behind UI
      scene.add(halo3D);

      const renderLoop = () => {
        const id = requestAnimationFrame(renderLoop);
        renderer.render(scene, camera);
        if (threeRef.current) threeRef.current.animationId = id;
      };
      
      const resizeHandler = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', resizeHandler);

      renderLoop();

      threeRef.current = { renderer, scene, camera, props: props3D, pointLight, halo3D, animationId: 0 };
    };

    void initPhaser();
    initThree();

    return () => {
      game?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.animationId);
        window.removeEventListener('resize', () => {});
        if (threeRef.current.renderer.domElement.parentNode) {
          threeRef.current.renderer.domElement.parentNode.removeChild(threeRef.current.renderer.domElement);
        }
        threeRef.current.renderer.dispose();
      }
    };
  }, []);

  useEffect(() => {
    // Sync React state to Phaser
    if (sceneRef.current) {
      sceneRef.current.updateState({ signalLevel });
    }
    
    // Sync React state to Three.js
    if (threeRef.current) {
      const { props, pointLight, halo3D } = threeRef.current;
      const t = performance.now() * 0.001;
      
      halo3D.rotation.z = t * 0.5;
      halo3D.rotation.y = Math.sin(t * 0.3) * 0.2;
      (halo3D.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + signalLevel * 1.5;

      pointLight.intensity = 0.8 + signalLevel * 2.5;
      pointLight.position.x = Math.sin(t * 0.5) * 5;

      props.forEach(prop => {
        const mat = prop.obj.material as THREE.MeshStandardMaterial;
        if (prop.type === 'orb') {
          prop.obj.position.y = 0.7 + Math.sin(t * 2) * 0.05; 
          mat.emissiveIntensity = prop.baseIntensity + Math.sin(t * 5) * 0.2;
        } else if (prop.type === 'flask') {
          mat.emissiveIntensity = prop.baseIntensity + signalLevel * 0.5;
        } else if (prop.type === 'resonator') {
          const scale = 1 + signalLevel * 0.5;
          prop.obj.scale.set(scale, scale, scale);
          mat.emissiveIntensity = prop.baseIntensity + signalLevel * 2.0;
        } else if (prop.type === 'monitor') {
          mat.emissiveIntensity = prop.baseIntensity + (Math.random() > 0.95 ? 0.3 : 0);
        }
      });
    }
  }, [signalLevel]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    />
  );
};
