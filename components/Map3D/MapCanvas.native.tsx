import { RobotPathMap } from '@/hooks/useRobotPaths';
import { RobotPoseMap } from '@/hooks/useRobotPoses';
import { Asset } from 'expo-asset';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useRouter } from 'expo-router';
import { loadAsync } from 'expo-three';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─── types ────────────────────────────────────────────────────────────────────

interface MapRobot { name: string; x: number; z: number; color: string; }
interface MapCanvasProps {
  robots?: MapRobot[];
  livePoses?: RobotPoseMap;
  livePaths?: RobotPathMap;
  /**
   * Called when the user activates Global Path mode and taps a point on the map.
   * Receives the ROS-frame target coordinates to send to the graph_search service.
   */
  onCallService?: (botName: string, targetX: number, targetY: number) => void;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

// ─── asset declarations (top-level for Metro) ─────────────────────────────────

const TEX: Record<string, Record<string, any>> = {
  straight: { color: require('@/assets/textures/straight/texture.jpg'), mr: require('@/assets/textures/straight/metallic_roughness.jpg') },
  '3way_left': { color: require('@/assets/textures/3way_left/texture.jpg'), mr: require('@/assets/textures/3way_left/metallic_roughness.jpg') },
  '3way_right': { color: require('@/assets/textures/3way_right/texture.jpg'), mr: require('@/assets/textures/3way_right/metallic_roughness.jpg') },
  curve_left: { color: require('@/assets/textures/curve_left/texture.jpg'), mr: require('@/assets/textures/curve_left/metallic_roughness.jpg') },
  curve_right: { color: require('@/assets/textures/curve_right/texture.jpg'), mr: require('@/assets/textures/curve_right/metallic_roughness.jpg') },
  asphalt: { color: require('@/assets/textures/asphalt/texture.jpg'), mr: require('@/assets/textures/asphalt/metallic_roughness.jpg') },
  grass: { color: require('@/assets/textures/grass/texture.jpg'), mr: require('@/assets/textures/grass/metallic_roughness.jpg') },
};
const GLB_MOD = require('@/assets/meshes/duckiebot/duckiebot.glb');

const ROAD_LAYOUT: [string, number][][] = [
  [['curve_right', 0], ['straight', 90], ['3way_left', 90], ['straight', 90], ['curve_left', 0]],
  [['straight', 0], ['asphalt', 0], ['straight', 0], ['asphalt', 0], ['straight', 0]],
  [['curve_left', 180], ['straight', 90], ['3way_right', 90], ['straight', 90], ['curve_right', 180]],
];
const COLS = 15, ROWS = 15, TILE_SZ = 1;
const ROAD_COLS = 5, ROAD_ROWS = 3;
const ROAD_COL_OFFSET = Math.floor((COLS - ROAD_COLS) / 2);
const ROAD_ROW_OFFSET = Math.floor((ROWS - ROAD_ROWS) / 2);

function getTileAt(row: number, col: number): [string, number] {
  const rr = row - ROAD_ROW_OFFSET, rc = col - ROAD_COL_OFFSET;
  if (rr >= 0 && rr < ROAD_ROWS && rc >= 0 && rc < ROAD_COLS) return ROAD_LAYOUT[rr][rc];
  const grassRots = [0, 90, 180, 270];
  return ['grass', grassRots[(row * 7919 + col * 6271) % grassRots.length]];
}

// ─── async asset helpers ──────────────────────────────────────────────────────

async function loadTex(mod: number): Promise<THREE.Texture> {
  const tex = (await loadAsync(mod)) as THREE.Texture;
  tex.flipY = false; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true; return tex;
}

async function buildSkyboxAsync(scene: THREE.Scene) {
  try {
    const skyboxImages = [
      require('@/assets/textures/skybox/skyRight.png'), // px
      require('@/assets/textures/skybox/skyLeft.png'),  // nx
      require('@/assets/textures/skybox/skyUp.png'),    // py
      require('@/assets/textures/skybox/skyDown.png'),  // ny
      require('@/assets/textures/skybox/skyFront.png'), // pz
      require('@/assets/textures/skybox/skyBack.png'),  // nz
    ];

    const loadSkyTex = async (mod: number) => {
      const tex = (await loadAsync(mod)) as THREE.Texture;
      tex.flipY = false;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      return tex;
    };

    const materials = await Promise.all(skyboxImages.map(async (img) => {
      const tex = await loadSkyTex(img);
      return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
    }));

    const skyboxGeo = new THREE.BoxGeometry(500, 500, 500);
    const skybox = new THREE.Mesh(skyboxGeo, materials);
    skybox.name = 'Skybox';
    skybox.renderOrder = -1;
    scene.add(skybox);
  } catch (err) {
    console.warn('Failed to load skybox:', err);
  }
}

async function buildMapAsync(scene: THREE.Scene) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const [key, rotDeg] = getTileAt(row, col);
      const src = TEX[key] || TEX['grass'];
      let mat: THREE.MeshStandardMaterial;
      try {
        const [c, mr] = await Promise.all([loadTex(src.color), loadTex(src.mr)]);
        mat = new THREE.MeshStandardMaterial({ map: c, metalnessMap: mr, roughnessMap: mr, metalness: 0.1, roughness: 0.8 });
      } catch {
        mat = new THREE.MeshStandardMaterial({ color: key === 'grass' ? 0x3a7d2c : (key === 'asphalt' ? 0x1c1c1c : 0x2a2a2a), roughness: 0.9 });
      }
      const geo = new THREE.PlaneGeometry(TILE_SZ, TILE_SZ); geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((col - (ROAD_COL_OFFSET + 4)) * TILE_SZ - TILE_SZ / 2, 0, (row - (ROAD_ROW_OFFSET + 2)) * TILE_SZ - TILE_SZ / 2);
      mesh.rotation.y = (rotDeg * Math.PI) / 180; mesh.receiveShadow = true; scene.add(mesh);
    }
  }
}

let modelCache: THREE.Group | null = null;
let modelLoadPromise: Promise<THREE.Group> | null = null;
const gltfLoader = new GLTFLoader();

async function loadModelGeometry(): Promise<THREE.Group> {
  if (modelCache) return modelCache;
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    const asset = Asset.fromModule(GLB_MOD); await asset.downloadAsync();
    const result = await new Promise<any>((res, rej) =>
      gltfLoader.load(asset.localUri ?? asset.uri, res, undefined, rej));
    const model: THREE.Group = result.scene ?? result;
    model.scale.set(1.5, 1.5, 1.5);
    model.traverse((c: any) => { if (c.isMesh) c.castShadow = true; });
    modelCache = model; return model;
  })().catch((err) => { modelLoadPromise = null; throw err; });
  return modelLoadPromise;
}

async function buildRobotGroup(pos: [number, number, number], color: string): Promise<THREE.Group> {
  const grp = new THREE.Group(); grp.position.set(...pos);
  try {
    const src = await loadModelGeometry();
    const clone = src.clone();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.45, metalness: 0.35, emissive: new THREE.Color(0) });
    clone.traverse((c: any) => { if (c.isMesh) { c.material = mat.clone(); c.castShadow = true; } });
    grp.add(clone);
  } catch {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 24), new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.4, metalness: 0.4, emissive: new THREE.Color(0) }));
    body.position.y = 0.06; body.castShadow = true; grp.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: new THREE.Color(0) }));
    nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.06, -0.24); grp.add(nose);
  }
  return grp;
}

// ─── defaults ─────────────────────────────────────────────────────────────────

const FALLBACK: MapRobot[] = [
  { name: 'Bot-1', x: 4.2, z: 1.5, color: '#e54d2e' },
];

// ─── component ────────────────────────────────────────────────────────────────

export const MapCanvas: React.FC<MapCanvasProps> = ({ robots = [], livePoses = {}, livePaths = {}, onCallService }) => {
  const router = useRouter();
  const bots = robots.length > 0 ? robots : FALLBACK;

  const robotsRef = useRef<THREE.Group[]>([]);
  const robotDataRef = useRef<{ name: string; color: string }[]>([]);
  const smoothRef = useRef<{ x: number; z: number; yaw: number }[]>([]);
  const pathLinesRef = useRef<THREE.Line[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const livePosesRef = useRef<RobotPoseMap>(livePoses); livePosesRef.current = livePoses;
  const livePathsRef = useRef<RobotPathMap>(livePaths); livePathsRef.current = livePaths;
  const clockRef = useRef(new THREE.Clock());
  const vpRef = useRef({ w: 1, h: 1 });

  // ── smooth orbit via lerp (matches OrbitControls.enableDamping) ────────────
  const camTheta = useRef(Math.PI / 4); const tgtTheta = useRef(Math.PI / 4);
  const camPhi = useRef(1.1); const tgtPhi = useRef(1.1);
  const camRadius = useRef(3); const tgtRadius = useRef(3);
  const camTarget = useRef(new THREE.Vector3(-2.5, 0.5, -1.5));

  // gesture state
  const gestStartTheta = useRef(0); const gestStartPhi = useRef(0);
  const tapMoved = useRef(false); const tapStart = useRef({ x: 0, y: 0 });
  const pinchBase = useRef(1);

  const [selIdx, setSelIdx] = useState<number | null>(null);
  const selIdxRef = useRef<number | null>(null);

  /** When true, next tap picks a target point for graph_search */
  const [globalPathMode, setGlobalPathMode] = useState(false);
  const globalPathModeRef = useRef(false);
  const globalPathBotRef = useRef<string | null>(null);

  // Ground plane for picking (added once the GL context exists)
  const groundPlaneRef = useRef<THREE.Mesh | null>(null);

  const transitionRef = useRef({
    active: false,
    route: '',
    botId: '',
    targetRadius: 1.5,
    targetPhi: 1.2,
    targetPos: new THREE.Vector3(),
  });

  const handleTransition = (pathname: string, botId: string) => {
    const idx = selIdxRef.current;
    if (idx !== null && robotsRef.current[idx]) {
      const bot = robotsRef.current[idx];

      tgtRadius.current = 1.5;
      tgtPhi.current = 1.2;

      transitionRef.current = {
        active: true,
        route: pathname,
        botId,
        targetRadius: 1.5,
        targetPhi: 1.2,
        targetPos: bot.position.clone(),
      };
    } else {
      router.push({ pathname: pathname as any, params: { id: botId } });
    }
  };

  // ── GL context ──────────────────────────────────────────────────────────────

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    vpRef.current = { w: W, h: H };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xff8c69);
    scene.fog = new THREE.Fog(0xff8c69, 12, 45);

    buildSkyboxAsync(scene);

    // Invisible ground plane for global-path target picking
    const groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
    );
    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);
    groundPlaneRef.current = groundPlane;

    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1000);
    camera.position.set(-2.5, 2.5, 1.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: { width: W, height: H, style: {}, addEventListener: () => { }, removeEventListener: () => { }, clientHeight: H, clientWidth: W } as any,
      context: gl as any,
    });
    renderer.setSize(W, H); renderer.shadowMap.enabled = true;

    scene.add(new THREE.AmbientLight(0xffbfa8, 0.4));
    const sun = new THREE.DirectionalLight(0xff5511, 1.2);
    sun.position.set(15, 3, -10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x4a3b69, 0.6); fill.position.set(-10, 5, 10); scene.add(fill);

    buildMapAsync(scene).catch(console.error);

    robotsRef.current = []; robotDataRef.current = []; smoothRef.current = []; pathLinesRef.current = [];

    // ── animation loop (starts immediately so map is visible) ─────────────────
    const LERP_POS = 0.08, LERP_ROT = 0.10, CAM_DAMP = 0.12;
    let lastF = performance.now();

    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min((performance.now() - lastF) / 1000, 0.05); lastF = performance.now();
      const t = clockRef.current.getElapsedTime();

      const currentDamp = transitionRef.current.active ? 0.02 : CAM_DAMP;
      camTheta.current += (tgtTheta.current - camTheta.current) * currentDamp;
      camPhi.current += (tgtPhi.current - camPhi.current) * currentDamp;
      camRadius.current += (tgtRadius.current - camRadius.current) * currentDamp;

      if (transitionRef.current.active) {
        camTarget.current.lerp(transitionRef.current.targetPos, 0.02);

        if (camTarget.current.distanceTo(transitionRef.current.targetPos) < 0.1 && Math.abs(camRadius.current - transitionRef.current.targetRadius) < 0.2) {
          transitionRef.current.active = false;
          router.push({ pathname: transitionRef.current.route as any, params: { id: transitionRef.current.botId } });
        }
      } else {
        camTarget.current.lerp(new THREE.Vector3(-2.5, 0.5, -1.5), CAM_DAMP * 0.5);
      }

      const r = camRadius.current, ph = camPhi.current, th = camTheta.current, tg = camTarget.current;
      camera.position.set(tg.x + r * Math.sin(ph) * Math.sin(th), tg.y + r * Math.cos(ph), tg.z + r * Math.sin(ph) * Math.cos(th));
      camera.lookAt(tg);

      robotsRef.current.forEach((group, idx) => {
        if (!robotDataRef.current[idx] || !smoothRef.current[idx]) return;
        const data = robotDataRef.current[idx];
        const smooth = smoothRef.current[idx];
        const live = livePosesRef.current[data.name];
        const isSelected = idx === selIdxRef.current;

        smooth.x += ((live ? -live.x : smooth.x) - smooth.x) * LERP_POS;
        smooth.z += ((live ? -live.z : smooth.z) - smooth.z) * LERP_POS;
        smooth.yaw = lerpAngle(smooth.yaw, live ? live.yaw + Math.PI : smooth.yaw, LERP_ROT);
        group.position.x = smooth.x; group.position.z = smooth.z; group.rotation.y = smooth.yaw;

        // Path line
        const pathLine = pathLinesRef.current[idx] as any as THREE.Mesh;
        const rosPath = livePathsRef.current?.[data.name];
        if (pathLine) {
          if (rosPath && rosPath.waypoints.length > 1) {
            const pts = rosPath.waypoints.map((wp) => new THREE.Vector3(-wp.x, 0.05, -wp.z));
            const curve = new THREE.CatmullRomCurve3(pts);
            const geometry = new THREE.TubeGeometry(curve, Math.max(2, pts.length * 2), 0.015, 6, false);
            pathLine.geometry.dispose();
            pathLine.geometry = geometry;
            pathLine.visible = true;
          } else { pathLine.visible = false; }
        }

        // Emissive highlight (same as web: pulseIntensity logic)
        const pulseIntensity = isSelected ? 0.6 + 0.4 * Math.sin(t * 4) : 0;
        group.traverse((child: any) => {
          if (!child.isMesh || !child.material) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            if (!mat?.emissive) return;
            if (isSelected) { mat.emissive.set(data.color); mat.emissiveIntensity = pulseIntensity; }
            else { mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; }
          });
        });
      });

      // Center skybox on camera
      const sky = scene.getObjectByName('Skybox');
      if (sky) sky.position.copy(camera.position);

      renderer.render(scene, camera);
      (gl as any).endFrameEXP();
    };
    animate();

    // Load robots in background — added to scene as each resolves
    bots.forEach(async (bot, idx) => {
      try {
        const grp = await buildRobotGroup([-bot.x, 0.045, -bot.z], bot.color);
        scene.add(grp);
        robotsRef.current[idx] = grp;
        robotDataRef.current[idx] = { name: bot.name, color: bot.color };
        smoothRef.current[idx] = { x: -bot.x, z: -bot.z, yaw: Math.PI };

        // Path line -> glowing tube
        const tubeMat = new THREE.MeshStandardMaterial({
          color: bot.color, emissive: bot.color, emissiveIntensity: 1.5,
          transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0.8
        });
        const pathLine = new THREE.Mesh(new THREE.BufferGeometry(), tubeMat);
        pathLine.visible = false;
        scene.add(pathLine);
        pathLinesRef.current[idx] = pathLine;
      } catch (err) { console.error(`[MapCanvas] ${bot.name} failed:`, err); }
    });
  };

  // ── gestures ────────────────────────────────────────────────────────────────
  // Pan = orbit. Uses translationX/Y from gesture start (clean, no drift).
  const pan = Gesture.Pan().runOnJS(true)
    .onStart((e) => {
      gestStartTheta.current = tgtTheta.current;
      gestStartPhi.current = tgtPhi.current;
      tapMoved.current = false;
      tapStart.current = { x: e.x, y: e.y };
    })
    .onUpdate((e) => {
      if (Math.abs(e.translationX) > 4 || Math.abs(e.translationY) > 4) tapMoved.current = true;
      tgtTheta.current = gestStartTheta.current - e.translationX * 0.005;
      tgtPhi.current = Math.max(0.15, Math.min(Math.PI / 2, gestStartPhi.current + e.translationY * 0.005));
    })
    .onEnd(() => {
      if (!tapMoved.current && cameraRef.current) {
        const { w, h } = vpRef.current;
        const nx = (tapStart.current.x / w) * 2 - 1, ny = -(tapStart.current.y / h) * 2 + 1;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(nx, ny), cameraRef.current);

        // ── Global Path mode: pick a ground point ──
        if (globalPathModeRef.current && globalPathBotRef.current && groundPlaneRef.current) {
          const groundHits = ray.intersectObject(groundPlaneRef.current);
          if (groundHits.length > 0) {
            const pt = groundHits[0].point;
            // Invert pose mapping: ros_x = -threejs_z*(6/10), ros_y = -threejs_x*(6/10)
            const rosX = -pt.z * (6 / 10);
            const rosY = -pt.x * (6 / 10);
            onCallService?.(globalPathBotRef.current, rosX, rosY);
          }
          globalPathModeRef.current = false;
          setGlobalPathMode(false);
          return;
        }

        // ── Normal robot selection ──
        const hits = ray.intersectObjects(robotsRef.current, true);
        let hi = -1;
        if (hits.length > 0) { const obj = hits[0].object; robotsRef.current.forEach((g, i) => g.traverse((c) => { if (c === obj) hi = i; })); }
        const next = hi === -1 ? null : hi;
        selIdxRef.current = next; setSelIdx(next);
      }
    });

  const pinch = Gesture.Pinch().runOnJS(true)
    .onStart(() => { pinchBase.current = tgtRadius.current; })
    .onUpdate((e) => {
      tgtRadius.current = Math.max(3, Math.min(15, pinchBase.current / e.scale));
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const selBot = selIdx !== null ? (robotDataRef.current[selIdx] ?? null) : null;
  const selPose = selBot ? livePoses[selBot.name] : null;
  const selPath = selBot ? livePaths[selBot.name] : null;
  const hasPath = !!selPath && selPath.waypoints.length > 1;

  return (
    <GestureHandlerRootView style={s.root}>
      <GestureDetector gesture={composed}>
        <GLView style={s.gl} onContextCreate={onContextCreate} />
      </GestureDetector>

      {selBot && (
        <View style={[s.panel, { borderColor: selBot.color + '55', shadowColor: selBot.color }]}>
          <View style={s.row}>
            <View style={[s.dot, { backgroundColor: selBot.color, shadowColor: selBot.color }]} />
            <Text style={s.name}>{selBot.name}</Text>
          </View>
          {selPose ? (
            <View style={s.vals}>
              <Text style={s.val}>X: {selPose.x.toFixed(3)} m</Text>
              <Text style={s.val}>Z: {selPose.z.toFixed(3)} m</Text>
              <Text style={s.val}>Yaw: {((selPose.yaw * 180) / Math.PI).toFixed(1)}°</Text>
            </View>
          ) : <Text style={s.dim}>No live pose data</Text>}

          <View style={s.buttonRow}>
            <TouchableOpacity
              style={[s.buttonPrimary, { backgroundColor: selBot.color }]}
              onPress={() => handleTransition('/details/[id]/(tabs)/lanefollowing', selBot.name)}
            >
              <Text style={[s.buttonText, { color: '#000' }]}>Lane Follow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.buttonSecondary, { borderColor: selBot.color }]}
              onPress={() => handleTransition('/details/[id]/(tabs)/drive', selBot.name)}
            >
              <Text style={[s.buttonText, { color: selBot.color }]}>Drive</Text>
            </TouchableOpacity>
          </View>

          {/* Global Path button */}
          <TouchableOpacity
            disabled={hasPath}
            style={[
              s.buttonGlobalPath,
              {
                borderColor: hasPath ? 'rgba(255,255,255,0.3)' : selBot.color,
                backgroundColor: globalPathMode ? selBot.color : 'transparent',
                opacity: hasPath ? 0.5 : 1,
              },
            ]}
            onPress={() => {
              if (hasPath) return;
              globalPathBotRef.current = selBot.name;
              globalPathModeRef.current = true;
              setGlobalPathMode(true);
            }}
          >
            <Text style={[s.buttonText, { color: hasPath ? 'rgba(255,255,255,0.3)' : (globalPathMode ? '#000' : selBot.color) }]}>
              {hasPath ? '🚫 Path Active' : (globalPathMode ? '🎯 Tap target on map…' : '🗺 Global Path')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { selIdxRef.current = null; setSelIdx(null); }} style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={s.desel}>tap to deselect</Text>
          </TouchableOpacity>
        </View>
      )}
    </GestureHandlerRootView>
  );
};

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#dce8f0' },
  gl: { flex: 1 },
  panel: { position: 'absolute', top: 16, alignSelf: 'center', padding: 14, backgroundColor: 'rgba(10,10,20,0.85)', borderRadius: 12, borderWidth: 1, minWidth: 220, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  name: { color: '#fff', fontWeight: 'bold', fontSize: 14, fontFamily: 'SilkscreenBold' },
  vals: { gap: 3 },
  val: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Silkscreen' },
  dim: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'Silkscreen' },
  desel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Silkscreen' },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  buttonPrimary: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { flex: 1, padding: 8, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  buttonGlobalPath: { marginTop: 8, padding: 8, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: 'bold', fontSize: 12, fontFamily: 'SilkscreenBold' },
});
