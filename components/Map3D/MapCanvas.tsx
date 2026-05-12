import { RobotPathMap } from '@/hooks/useRobotPaths';
import { RobotPoseMap } from '@/hooks/useRobotPoses';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MapPlane } from './MapPlane';
import { Robot3D } from './Robot3D';


// ─── helpers ────────────────────────────────────────────────────────────────

const getRandomColor = (): string => {
  const hue = Math.random() * 360;
  return `hsl(${hue}, ${70 + Math.random() * 20}%, ${50 + Math.random() * 15}%)`;
};

/** Shortest-path lerp for angles (radians). */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface MapRobot {
  name: string;
  x: number;
  z: number;
  color: string;
}

interface MapCanvasProps {
  robots?: MapRobot[];
  /** Live ROS poses keyed by bot name. Overrides static grid position when present. */
  livePoses?: RobotPoseMap;
  /** Live ROS paths keyed by bot name. Renders waypoints as colored lines. */
  livePaths?: RobotPathMap;

  onCallService?: (botName: string, targetX: number, targetY: number) => void;
}

const CAMERA_BOUNDS = {
  xMin: -8, xMax: 8,
  zMin: -4, zMax: 12,
  distanceMin: 3, distanceMax: 25,
};

// ─── component ───────────────────────────────────────────────────────────────

export const MapCanvas: React.FC<MapCanvasProps> = ({ robots = [], livePoses = {}, livePaths = {}, onCallService }) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const robotsRef = useRef<THREE.Group[]>([]);
  const robotDataRef = useRef<{ name: string; color: string }[]>([]);

  /** Current smoothed position/yaw for each robot (used by animation loop). */
  const smoothRef = useRef<{ x: number; z: number; yaw: number }[]>([]);

  /** Line objects for each robot path. */
  const pathLinesRef = useRef<THREE.Line[]>([]);

  /** Target position/yaw driven by livePoses prop (updated every render via ref). */
  const livePosesRef = useRef<RobotPoseMap>(livePoses);
  livePosesRef.current = livePoses;

  /** Paths driven by livePaths prop (updated every render via ref). */
  const livePathsRef = useRef<RobotPathMap>(livePaths);
  livePathsRef.current = livePaths;

  const initDoneRef = useRef(false);
  const clockRef = useRef(new THREE.Clock());

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRobotIndex, setSelectedRobotIndex] = useState<number | null>(null);
  const selectedIdxRef = useRef<number | null>(null);

  /** When true, next canvas click picks a target point for graph_search */
  const [globalPathMode, setGlobalPathMode] = useState(false);
  const globalPathModeRef = useRef(false);
  const globalPathBotRef = useRef<string | null>(null);

  const transitionRef = useRef({
    active: false,
    route: '',
    botId: '',
    targetPos: new THREE.Vector3(),
    targetLook: new THREE.Vector3(),
  });

  const handleTransition = (pathname: string, botId: string) => {
    const idx = selectedIdxRef.current;
    if (idx !== null && robotsRef.current[idx]) {
      const bot = robotsRef.current[idx];
      const yaw = bot.rotation.y;

      const offset = new THREE.Vector3(0, 0.4, -0.8);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      transitionRef.current = {
        active: true,
        route: pathname,
        botId,
        targetPos: bot.position.clone().add(offset),
        targetLook: bot.position.clone().add(new THREE.Vector3(0, 0.1, 0))
      };
    } else {
      router.push({ pathname: pathname as any, params: { id: botId } });
    }
  };

  const mockRobots: MapRobot[] = React.useMemo(
    () =>
      robots.length > 0
        ? robots
        : [
          { name: 'Bot-1', x: 4.2, z: 1.5, color: getRandomColor() },
        ],
    [robots],
  );

  // ── clone materials so we can mutate emissive per-robot ─────────────────
  const prepareRobotMaterials = (group: THREE.Group) => {
    group.traverse((child: any) => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m: any) => {
          const n = m.clone();
          if (!n.emissive) n.emissive = new THREE.Color(0x000000);
          return n;
        });
      } else if (child.material) {
        child.material = child.material.clone();
        if (!child.material.emissive)
          child.material.emissive = new THREE.Color(0x000000);
      }
    });
  };

  useEffect(() => {
    if (!containerRef.current || initDoneRef.current) return;
    initDoneRef.current = true;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xff8c69);
    scene.fog = new THREE.Fog(0xff8c69, 12, 45);
    sceneRef.current = scene;

    // Camera
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(-2.5, 2.5, 1.5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffbfa8, 0.2));
    const sun = new THREE.DirectionalLight(0xff5511, 1.8);
    sun.position.set(15, 5, 0); // Lower on the horizon
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4a3b69, 0.3); // Purple shadow fill
    fill.position.set(-10, 5, 10);
    scene.add(fill);

    // Sky
    const getPath = (tex: any) => typeof tex === 'string' ? tex : tex.uri || tex;
    const texLoader = new THREE.TextureLoader();

    const loadSkyTex = (img: any) => {
      const tex = texLoader.load(getPath(img));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    };

    const skyGeo = new THREE.BoxGeometry(500, 500, 500);
    const skyMats = [
      new THREE.MeshBasicMaterial({ map: loadSkyTex(require('@/assets/textures/skybox/px.png')), side: THREE.BackSide, fog: false, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: loadSkyTex(require('@/assets/textures/skybox/nx.png')), side: THREE.BackSide, fog: false, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: loadSkyTex(require('@/assets/textures/skybox/py.png')), side: THREE.BackSide, fog: false, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: loadSkyTex(require('@/assets/textures/skybox/ny.png')), side: THREE.BackSide, fog: false, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: loadSkyTex(require('@/assets/textures/skybox/pz.png')), side: THREE.BackSide, fog: false, depthWrite: false }),
      new THREE.MeshBasicMaterial({ map: loadSkyTex(require('@/assets/textures/skybox/nz.png')), side: THREE.BackSide, fog: false, depthWrite: false })
    ];
    const skyboxMesh = new THREE.Mesh(skyGeo, skyMats);
    skyboxMesh.renderOrder = -1;
    scene.add(skyboxMesh);

    // !!  Environment stars here (remove if performance is an issue)
    const environmentGroup = new THREE.Group();

    const groundColor = texLoader.load(getPath(require('@/assets/textures/grass/texture.jpg')));
    const groundNormal = texLoader.load(getPath(require('@/assets/textures/grass/normals.jpg')));
    [groundColor, groundNormal].forEach((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(60, 60);
      tex.anisotropy = 8;
    });
    groundColor.colorSpace = THREE.SRGBColorSpace;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({
        map: groundColor,
        normalMap: groundNormal,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.95,
        metalness: 0.0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    environmentGroup.add(ground);

    const objLoader = new OBJLoader();

    const loadObjWithTexture = (objAsset: any, textureAsset: any, scale = 1) => {
      const objPath = getPath(objAsset);
      const texture = texLoader.load(getPath(textureAsset));
      texture.colorSpace = THREE.SRGBColorSpace;

      return new Promise<THREE.Group>((resolve, reject) => {
        objLoader.load(
          objPath,
          (object) => {
            object.traverse((child: any) => {
              if (!child.isMesh) return;
              child.material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.85,
                metalness: 0.05,
              });
              child.castShadow = true;
              child.receiveShadow = true;
            });
            object.scale.set(scale, scale, scale);
            resolve(object as THREE.Group);
          },
          undefined,
          (error) => reject(error)
        );
      });
    };

    const loadObjWithMtl = (objAsset: any, mtlAsset: any, scale = 1) => {
      const objPath = getPath(objAsset);
      const mtlPath = getPath(mtlAsset);
      const mtlLoader = new MTLLoader();
      const localObjLoader = new OBJLoader();

      return new Promise<THREE.Group>((resolve, reject) => {
        mtlLoader.load(
          mtlPath,
          (materials) => {
            materials.preload();
            localObjLoader.setMaterials(materials);
            localObjLoader.load(
              objPath,
              (object) => {
                object.traverse((child: any) => {
                  if (!child.isMesh) return;
                  child.castShadow = true;
                  child.receiveShadow = true;
                });
                object.scale.set(scale, scale, scale);
                resolve(object as THREE.Group);
              },
              undefined,
              (error) => reject(error)
            );
          },
          undefined,
          (error) => reject(error)
        );
      });
    };

    const cloneAt = (model: THREE.Group, x: number, y: number, z: number, rotY = 0, scale = 1) => {
      const clone = model.clone(true);
      clone.position.set(x, y, z);
      clone.rotation.y = rotY;
      const baseScale = clone.scale.clone();
      clone.scale.set(baseScale.x * scale, baseScale.y * scale, baseScale.z * scale);
      clone.traverse((child: any) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
      });
      environmentGroup.add(clone);
    };

    const trackCenterX = -2.5;
    const trackCenterZ = -1.5;
    const trackHalfWidth = 8;
    const trackHalfDepth = 8;
    const trackMinX = trackCenterX - trackHalfWidth;
    const trackMaxX = trackCenterX + trackHalfWidth;
    const trackMinZ = trackCenterZ - trackHalfDepth;
    const trackMaxZ = trackCenterZ + trackHalfDepth;

    (async () => {
      try {
        const [barrierModel, buildingModel, houseModel, treeModel] = await Promise.all([
          loadObjWithTexture(
            require('@/assets/meshes/barrier/barrier.obj'),
            require('@/assets/textures/barrier.png'),
            1
          ),
          loadObjWithTexture(
            require('@/assets/meshes/building/building.obj'),
            require('@/assets/textures/building.png'),
            1.1
          ),
          loadObjWithTexture(
            require('@/assets/meshes/house/house.obj'),
            require('@/assets/textures/house.png'),
            0.9
          ),
          loadObjWithMtl(
            require('@/assets/meshes/tree/tree.obj'),
            require('@/assets/meshes/tree/tree.mtl'),
            0.8
          ),
        ]);

        const barrierOffset = 0.1;
        const barrierScale = 0.5;
        const barrierMinX = trackMinX - barrierOffset;
        const barrierMaxX = trackMaxX + barrierOffset;
        const barrierMinZ = trackMinZ - barrierOffset;
        const barrierMaxZ = trackMaxZ + barrierOffset;
        const targetSpacing = 3.0; // Adjust this to change barrier density
        const xLen = barrierMaxX - barrierMinX;
        const zLen = barrierMaxZ - barrierMinZ;

        // Calculate number of barriers per side (strictly excluding corners)
        const xCount = Math.max(1, Math.round(xLen / targetSpacing) - 1);
        const zCount = Math.max(1, Math.round(zLen / targetSpacing) - 1);

        // X-axis sides (Top and Bottom)
        for (let i = 1; i <= xCount; i++) {
          const t = i / (xCount + 1);
          const x = barrierMinX + xLen * t;
          cloneAt(barrierModel, x, 0.0, barrierMinZ, 0, barrierScale);
          cloneAt(barrierModel, x, 0.0, barrierMaxZ, Math.PI, barrierScale); // Flipped 180°
        }

        // Z-axis sides (Left and Right)
        for (let i = 1; i <= zCount; i++) {
          const t = i / (zCount + 1);
          const z = barrierMinZ + zLen * t;
          cloneAt(barrierModel, barrierMinX, 0.0, z, Math.PI / 2, barrierScale); // Rotated 90°
          cloneAt(barrierModel, barrierMaxX, 0.0, z, -Math.PI / 2, barrierScale); // Rotated -90°
        }

        const skylineZ = -36;
        for (let i = 0; i < 10; i++) {
          const x = -20 + i * 4.2;
          const scale = 1 + (i % 3) * 0.35;
          cloneAt(buildingModel, x, 0, skylineZ, 0, scale);
        }

        const houseSpots: Array<[number, number, number, number]> = [
          [-18.5, 0, 18.0, Math.PI * 0.25],
          [19.0, 0, 17.5, -Math.PI * 0.2],
          [17.5, 0, -18.0, Math.PI * 0.85],
        ];
        houseSpots.forEach(([x, y, z, rot]) => cloneAt(houseModel, x, y, z, rot, 1));

        const treeSpots: Array<[number, number, number]> = [
          [-9.5, 0, 15.0], [9.0, 0, 14.5], [-16.0, 0, 6.5], [15.5, 0, 5.5],
          [-14.5, 0, -13.5], [13.5, 0, -14.0], [2.5, 0, -19.0], [-4.0, 0, 18.5]
        ];
        treeSpots.forEach(([x, y, z]) => cloneAt(treeModel, x, y, z, Math.random() * Math.PI * 2, 1));
      } catch (error) {
        console.warn('Failed to load environment meshes:', error);
      }
    })();

    scene.add(environmentGroup);
    // !!  Environment ends here (remove if performance is an issue)

    scene.add(MapPlane());

    robotsRef.current = [];
    robotDataRef.current = [];
    smoothRef.current = [];
    pathLinesRef.current = [];

    mockRobots.forEach((robot) => {
      const group = Robot3D(
        robot.name,
        [-robot.x, 0.045, -robot.z],
        robot.color,
        (g) => prepareRobotMaterials(g),
      );
      prepareRobotMaterials(group);
      scene.add(group);
      robotsRef.current.push(group);
      robotDataRef.current.push({ name: robot.name, color: robot.color });
      smoothRef.current.push({ x: -robot.x, z: -robot.z, yaw: Math.PI });

      // Create glowing tube geometry for the path
      const tubeMaterial = new THREE.MeshStandardMaterial({
        color: robot.color,
        emissive: robot.color,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8,
        roughness: 0.2,
        metalness: 0.8,
      });
      const pathLine = new THREE.Mesh(new THREE.BufferGeometry(), tubeMaterial);
      pathLine.castShadow = true;
      scene.add(pathLine);
      pathLinesRef.current.push(pathLine);
    });

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-2.5, 0.05, -1.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.minDistance = CAMERA_BOUNDS.distanceMin;
    controls.maxDistance = CAMERA_BOUNDS.distanceMax;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false, downX = 0, downY = 0;

    const onMouseDown = (e: MouseEvent) => { isDragging = false; downX = e.clientX; downY = e.clientY; };
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (dx * dx + dy * dy > 16) isDragging = true;
    };
    const onMouseUp = () => { };

    // Invisible ground plane for picking global-path target points
    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    scene.add(groundPlane);

    const onCanvasClick = (e: MouseEvent) => {
      if (isDragging || !containerRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // ── Global Path mode: pick a world position then call graph_search ──
      if (globalPathModeRef.current && globalPathBotRef.current) {
        const groundHits = raycaster.intersectObject(groundPlane);
        if (groundHits.length > 0) {
          const pt = groundHits[0].point;
          // Invert the pose mapping: ros_x = -threejs_z * (6/10), ros_y = -threejs_x * (6/10)
          const rosX = -pt.z * (6 / 10);
          const rosY = -pt.x * (6 / 10);
          onCallService?.(globalPathBotRef.current, rosX, rosY);
        }
        globalPathModeRef.current = false;
        setGlobalPathMode(false);
        return;
      }

      // ── Normal robot selection ──
      const hits = raycaster.intersectObjects(robotsRef.current, true);
      let clicked = -1;
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        robotsRef.current.forEach((g, i) => {
          g.traverse((c: any) => { if (c === hitObj) clicked = i; });
        });
      }
      const idx = clicked === -1 ? null : clicked;
      selectedIdxRef.current = idx;
      setSelectedRobotIndex(idx);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // ── Animation loop 
    const LERP_POS = 0.08;
    const LERP_ROT = 0.10;

    const animate = () => {
      requestAnimationFrame(animate);

      const t = clockRef.current.getElapsedTime();

      robotsRef.current.forEach((group, idx) => {
        const data = robotDataRef.current[idx];
        const smooth = smoothRef.current[idx];
        const live = livePosesRef.current[data.name];
        const isSelected = idx === selectedIdxRef.current;

        const targetX = live ? -live.x : smooth.x;
        const targetZ = live ? -live.z : smooth.z;
        const targetYaw = live ? live.yaw + Math.PI : smooth.yaw;

        smooth.x = smooth.x + (targetX - smooth.x) * LERP_POS;
        smooth.z = smooth.z + (targetZ - smooth.z) * LERP_POS;
        smooth.yaw = lerpAngle(smooth.yaw, targetYaw, LERP_ROT);

        group.position.x = smooth.x;
        group.position.z = smooth.z;
        group.rotation.y = smooth.yaw;

        // Update path from ROS
        const pathLine = pathLinesRef.current[idx] as any as THREE.Mesh;
        const rosPath = livePathsRef.current[data.name];
        if (rosPath && rosPath.waypoints.length > 1) {
          // Convert waypoints to Three.js Vector3 points
          const points = rosPath.waypoints.map((wp) => new THREE.Vector3(-wp.x, 0.05, -wp.z));
          const curve = new THREE.CatmullRomCurve3(points);
          const geometry = new THREE.TubeGeometry(curve, Math.max(2, points.length * 2), 0.015, 6, false);
          pathLine.geometry.dispose();
          pathLine.geometry = geometry;
          pathLine.visible = true;
        } else {
          pathLine.visible = false;
        }

        // Highlight
        const pulseIntensity = isSelected
          ? 0.6 + 0.4 * Math.sin(t * 4)
          : 0;

        group.traverse((child: any) => {
          if (!child.isMesh || !child.material) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            if (mat?.emissive) {
              if (isSelected) {
                mat.emissive.set(data.color);
                mat.emissiveIntensity = pulseIntensity;
              } else {
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
              }
            }
          });
        });
      });

      skyboxMesh.position.copy(camera.position);

      if (transitionRef.current.active) {
        controls.enabled = false;
        camera.position.lerp(transitionRef.current.targetPos, 0.02);
        controls.target.lerp(transitionRef.current.targetLook, 0.02);
        camera.lookAt(controls.target);

        if (camera.position.distanceTo(transitionRef.current.targetPos) < 0.1) {
          transitionRef.current.active = false;
          router.push({ pathname: transitionRef.current.route as any, params: { id: transitionRef.current.botId } });
        }
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      if (!containerRef.current) return;
      const nw = containerRef.current.clientWidth;
      const nh = containerRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      // Cleanup path lines
      pathLinesRef.current.forEach((line) => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        sceneRef.current?.remove(line);
      });

      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      controls.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  useEffect(() => { selectedIdxRef.current = selectedRobotIndex; }, [selectedRobotIndex]);
  useEffect(() => { globalPathModeRef.current = globalPathMode; }, [globalPathMode]);

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(console.error);
      setIsFullscreen(false);
    }
  };

  const selectedBot =
    selectedRobotIndex !== null ? robotDataRef.current[selectedRobotIndex] : null;
  const selectedPose =
    selectedBot ? livePoses[selectedBot.name] : null;
  const selectedPath =
    selectedBot ? livePaths[selectedBot.name] : null;
  const hasPath = !!selectedPath && selectedPath.waypoints.length > 1;

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          cursor: globalPathMode ? 'crosshair' : 'default',
        }}
      />

      <button
        onClick={handleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 110,
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          padding: '6px 10px',
          fontSize: 18,
          lineHeight: 1,
          backdropFilter: 'blur(6px)',
          transition: 'background 0.2s',
        }}
      >
        {isFullscreen ? '✕' : '⛶'}
      </button>

      {selectedBot && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '14px 18px',
            background: 'rgba(10,10,20,0.85)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${selectedBot.color}55`,
            borderRadius: 12,
            color: '#fff',
            zIndex: 100,
            minWidth: 220,
            boxShadow: `0 0 20px ${selectedBot.color}33`,
            transition: 'box-shadow 0.3s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: selectedBot.color,
                display: 'inline-block',
                boxShadow: `0 0 6px ${selectedBot.color}`,
              }}
            />
            <strong style={{ fontSize: 14, fontFamily: 'SilkscreenBold, monospace' }}>{selectedBot.name}</strong>
          </div>
          {selectedPose ? (
            <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'Silkscreen, monospace' }}>
              <span>X: {selectedPose.x.toFixed(3)} m</span>
              <span>Z: {selectedPose.z.toFixed(3)} m</span>
              <span>Yaw: {((selectedPose.yaw * 180) / Math.PI).toFixed(1)}°</span>
            </div>
          ) : (
            <div style={{ fontSize: 11, opacity: 0.5, fontFamily: 'Silkscreen, monospace' }}>No live pose data</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => handleTransition('/details/[id]/(tabs)/lanefollowing', selectedBot.name)}
              style={{ flex: 1, padding: '8px', background: selectedBot.color, color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12, fontFamily: 'SilkscreenBold, monospace' }}
            >
              Lane Follow
            </button>
            <button
              onClick={() => handleTransition('/details/[id]/(tabs)/drive', selectedBot.name)}
              style={{ flex: 1, padding: '8px', background: 'transparent', color: selectedBot.color, border: `1px solid ${selectedBot.color}`, borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 12, fontFamily: 'SilkscreenBold, monospace' }}
            >
              Drive
            </button>
          </div>

          {/* Global Path button */}
          <button
            disabled={hasPath}
            onClick={() => {
              if (hasPath) return;
              globalPathBotRef.current = selectedBot.name;
              globalPathModeRef.current = true;
              setGlobalPathMode(true);
            }}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '8px',
              background: globalPathMode ? selectedBot.color : (hasPath ? 'transparent' : 'transparent'),
              color: globalPathMode ? '#000' : (hasPath ? 'rgba(255,255,255,0.3)' : selectedBot.color),
              border: `1px solid ${hasPath ? 'rgba(255,255,255,0.3)' : selectedBot.color}`,
              borderRadius: 6,
              cursor: hasPath ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: 12,
              fontFamily: 'SilkscreenBold, monospace',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {hasPath ? 'Path Active' : (globalPathMode ? 'Click target on map…' : 'Global Path')}
          </button>

          <div
            style={{ marginTop: 12, cursor: 'pointer', fontSize: 11, opacity: 0.5, textAlign: 'center', fontFamily: 'Silkscreen, monospace' }}
            onClick={() => { setSelectedRobotIndex(null); selectedIdxRef.current = null; }}
          >
            tap to deselect
          </div>
        </div>
      )}
    </>
  );
};