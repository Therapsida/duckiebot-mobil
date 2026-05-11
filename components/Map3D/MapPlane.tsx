import * as THREE from 'three';

// Tile configuration: each tile is 0.6m × 0.6m in the real world
const TILE_SIZE = 1;           // 1 unit = 0.6m

// Large plane dimensions
const COLS = 15;
const ROWS = 15;

// Original road layout (5 cols × 3 rows), will be placed at the centre
const ROAD_COLS = 5;
const ROAD_ROWS = 3;

const ROAD_LAYOUT: [string, number][][] = [
  [['curve_right', 0], ['straight', 90], ['3way_left', 90], ['straight', 90], ['curve_left', 0]],
  [['straight', 0], ['asphalt', 0], ['straight', 0], ['asphalt', 0], ['straight', 0]],
  [['curve_left', 180], ['straight', 90], ['3way_right', 90], ['straight', 90], ['curve_right', 180]],
];

// Offsets so the road block sits at the centre of the large grid
const ROAD_COL_OFFSET = Math.floor((COLS - ROAD_COLS) / 2);
const ROAD_ROW_OFFSET = Math.floor((ROWS - ROAD_ROWS) / 2);

interface TileTextures {
  color: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
  metallic: THREE.Texture;
  occlusion: THREE.Texture;
  emissive: THREE.Texture;
}

const textureCache: Map<string, TileTextures> = new Map();
const textureLoader = new THREE.TextureLoader();

// Static texture asset imports
const textureAssets: Record<string, Record<string, any>> = {
  'straight': {
    color: require('@/assets/textures/straight/texture.jpg'),
    normal: require('@/assets/textures/straight/normals.jpg'),
    mr: require('@/assets/textures/straight/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/straight/occlusion.jpg'),
    emissive: require('@/assets/textures/straight/emissive.jpg'),
  },
  '3way_left': {
    color: require('@/assets/textures/3way_left/texture.jpg'),
    normal: require('@/assets/textures/3way_left/normals.jpg'),
    mr: require('@/assets/textures/3way_left/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/3way_left/occlusion.jpg'),
    emissive: require('@/assets/textures/3way_left/emissive.jpg'),
  },
  '3way_right': {
    color: require('@/assets/textures/3way_right/texture.jpg'),
    normal: require('@/assets/textures/3way_right/normals.jpg'),
    mr: require('@/assets/textures/3way_right/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/3way_right/occlusion.jpg'),
    emissive: require('@/assets/textures/3way_right/emissive.jpg'),
  },
  'curve_left': {
    color: require('@/assets/textures/curve_left/texture.jpg'),
    normal: require('@/assets/textures/curve_left/normals.jpg'),
    mr: require('@/assets/textures/curve_left/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/curve_left/occlusion.jpg'),
    emissive: require('@/assets/textures/curve_left/emissive.jpg'),
  },
  'curve_right': {
    color: require('@/assets/textures/curve_right/texture.jpg'),
    normal: require('@/assets/textures/curve_right/normals.jpg'),
    mr: require('@/assets/textures/curve_right/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/curve_right/occlusion.jpg'),
    emissive: require('@/assets/textures/curve_right/emissive.jpg'),
  },
  'asphalt': {
    color: require('@/assets/textures/asphalt/texture.jpg'),
    normal: require('@/assets/textures/asphalt/normals.jpg'),
    mr: require('@/assets/textures/asphalt/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/asphalt/occlusion.jpg'),
    emissive: require('@/assets/textures/asphalt/emissive.jpg'),
  },
  'grass': {
    color: require('@/assets/textures/grass/texture.jpg'),
    normal: require('@/assets/textures/grass/normals.jpg'),
    mr: require('@/assets/textures/grass/metallic_roughness.jpg'),
    occlusion: require('@/assets/textures/grass/occlusion.jpg'),
    emissive: require('@/assets/textures/grass/emissive.jpg'),
  },
};

const getPath = (tex: any) => typeof tex === 'string' ? tex : tex.uri || tex;

const loadTileTextures = (folderName: string): TileTextures => {
  if (textureCache.has(folderName)) {
    return textureCache.get(folderName)!;
  }

  const assets = textureAssets[folderName] || textureAssets['grass'];

  const color = textureLoader.load(getPath(assets.color));
  const normal = textureLoader.load(getPath(assets.normal));
  const mr = textureLoader.load(getPath(assets.mr));
  const occlusion = textureLoader.load(getPath(assets.occlusion));
  const emissive = textureLoader.load(getPath(assets.emissive));

  // Configure texture filtering
  [color, normal, mr, occlusion, emissive].forEach((tex) => {
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
  });

  const textures: TileTextures = {
    color,
    normal,
    roughness: mr,
    metallic: mr,
    occlusion,
    emissive
  };

  textureCache.set(folderName, textures);
  return textures;
};

/**
 * Returns the tile type and rotation for the given grid position.
 * Road tiles are placed at the centre; everything else is grass.
 */
function getTileAt(row: number, col: number): [string, number] {
  const roadRow = row - ROAD_ROW_OFFSET;
  const roadCol = col - ROAD_COL_OFFSET;

  if (
    roadRow >= 0 && roadRow < ROAD_ROWS &&
    roadCol >= 0 && roadCol < ROAD_COLS
  ) {
    return ROAD_LAYOUT[roadRow][roadCol];
  }

  // Randomly rotate grass tiles so it doesn't look too uniform
  const grassRotations = [0, 90, 180, 270];
  const hash = (row * 7919 + col * 6271) % grassRotations.length;
  return ['grass', grassRotations[hash]];
}

export const MapPlane = (): THREE.Group => {
  const group = new THREE.Group();

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const tileGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
      tileGeometry.rotateX(-Math.PI / 2);

      // Get texture folder and rotation for this tile
      const [folderName, rotationDegrees] = getTileAt(row, col);
      const textures = loadTileTextures(folderName);

      const rotationRadians = (rotationDegrees * Math.PI) / 180;

      const material = new THREE.MeshStandardMaterial({
        map: textures.color,
        normalMap: textures.normal,
        normalScale: new THREE.Vector2(1, 1),
        metalnessMap: textures.metallic,
        roughnessMap: textures.roughness,
        metalness: 0.1,
        roughness: 0.8,
        aoMap: textures.occlusion,
        aoMapIntensity: 1.0,
        emissiveMap: textures.emissive,
      });

      const mesh = new THREE.Mesh(tileGeometry, material);
      mesh.position.set(
        (col - (ROAD_COL_OFFSET + 4)) * TILE_SIZE - TILE_SIZE / 2,
        0,
        (row - (ROAD_ROW_OFFSET + 2)) * TILE_SIZE - TILE_SIZE / 2
      );
      mesh.rotation.y = rotationRadians;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  return group;
};
