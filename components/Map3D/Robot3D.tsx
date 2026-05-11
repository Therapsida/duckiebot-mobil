import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

let modelPromise: Promise<THREE.Group> | null = null;

const loadDuckiebotModel = async (): Promise<THREE.Group> => {
  if (modelPromise) return modelPromise;

  const duckiebotOBJ = require('@/assets/meshes/duckiebot/duckiebot.obj');
  const duckiebotMTL = require('@/assets/meshes/duckiebot/duckiebot.mtl');
  
  const objPath = typeof duckiebotOBJ === 'string' ? duckiebotOBJ : duckiebotOBJ.uri || duckiebotOBJ;
  const mtlPath = typeof duckiebotMTL === 'string' ? duckiebotMTL : duckiebotMTL.uri || duckiebotMTL;

  modelPromise = new Promise((resolve, reject) => {
    // Load materials first
    mtlLoader.load(
      mtlPath,
      (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        
        // Then load OBJ
        objLoader.load(
          objPath,
          (object) => {
            const model = object as THREE.Group;
            model.scale.set(1.5, 1.5, 1.5);
            resolve(model);
          },
          undefined,
          (error) => {
            console.error('Failed to load duckiebot OBJ:', error);
            reject(error);
          }
        );
      },
      undefined,
      (error) => {
        console.error('Failed to load duckiebot MTL:', error);
        reject(error);
      }
    );
  });

  return modelPromise;
};

export const Robot3D = (
  name: string,
  position: [number, number, number],
  color: string = '#FFD700',
  modelLoaded?: (group: THREE.Group) => void
): THREE.Group => {
  const group = new THREE.Group();
  group.position.set(...position);

  // Try to load the GLB model
  loadDuckiebotModel()
    .then((model) => {
      const clonedModel = model.clone();
      group.add(clonedModel);
      modelLoaded?.(group);
    })
    .catch(() => {
      // Fallback: create simple cylinder if model fails to load
      const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.1;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const coneGeo = new THREE.ConeGeometry(0.12, 0.16, 8);
      const coneMat = new THREE.MeshStandardMaterial({ color: '#FF0000' });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.z = -0.24;
      cone.position.y = 0.16;
      cone.castShadow = true;
      group.add(cone);
    });

  // Name label (sprite)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = 'bold 24px Silkscreen';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 40);

  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
  const label = new THREE.Sprite(labelMat);
  label.position.y = 0.3;
  label.scale.set(0.5, 0.125, 1);
  group.add(label);

  return group;
};
