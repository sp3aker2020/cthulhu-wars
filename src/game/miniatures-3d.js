import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FACTIONS } from './constants.js';

const MODEL_PATHS = {
  great_cthulhu: '/assets/models/cthulhu.glb',
  nyarlathotep: '/assets/models/nyarlathotep.glb',
  hastur: '/assets/models/hastur.glb',
  king_in_yellow: '/assets/models/hastur.glb',
  shub_niggurath: '/assets/models/shub.glb',
  cultist: '/assets/models/cultist.glb',
  deep_one: '/assets/models/monster.glb',
  starspawn: '/assets/models/monster.glb',
  shoggoth: '/assets/models/monster.glb',
  flying_polyp: '/assets/models/monster.glb',
  hunting_horror: '/assets/models/monster.glb',
  nightgaunt: '/assets/models/monster.glb',
  dark_young: '/assets/models/shub.glb',
  ghoul: '/assets/models/monster.glb',
  byakhee: '/assets/models/monster.glb',
  king_in_yellow_avatar: '/assets/models/hastur.glb'
};

const loader = new GLTFLoader();
const modelCache = {};

// Preload models
Object.entries(MODEL_PATHS).forEach(([key, path]) => {
  if (!modelCache[path]) {
    loader.load(path, (gltf) => {
      modelCache[path] = gltf.scene;
    });
  }
});

export class MiniatureFactory {
  constructor() {
    this.materialsCache = {};
  }

  getPlasticMaterial(factionId) {
    if (this.materialsCache[factionId]) {
      return this.materialsCache[factionId];
    }

    const faction = FACTIONS[factionId];
    const hexColor = faction ? parseInt(faction.color.replace('#', '0x'), 16) : 0x888888;

    const material = new THREE.MeshPhysicalMaterial({
      color: hexColor,
      roughness: 0.2,
      metalness: 0.1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
      reflectivity: 0.7,
      emissive: hexColor,
      emissiveIntensity: 0.15,
      shadowSide: THREE.DoubleSide
    });

    this.materialsCache[factionId] = material;
    return material;
  }

  createMiniature(unitType, factionId) {
    const group = new THREE.Group();
    const mat = this.getPlasticMaterial(factionId);
    const modelPath = MODEL_PATHS[unitType] || MODEL_PATHS.cultist;

    const isGOO = ['great_cthulhu', 'nyarlathotep', 'hastur', 'king_in_yellow', 'shub_niggurath'].includes(unitType);

    // If preloaded GLTF scene is available, clone it!
    if (modelCache[modelPath]) {
      const clonedScene = modelCache[modelPath].clone(true);
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.material = mat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Add plastic pedestal base beneath GLB model if needed
      const baseRadius = isGOO ? 1.2 : 0.75;
      const baseHeight = isGOO ? 0.35 : 0.22;
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius, baseRadius * 1.12, baseHeight, 32),
        mat
      );
      baseMesh.position.y = baseHeight / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      clonedScene.position.y = baseHeight;
      group.add(clonedScene);
    } else {
      // Async load fallback if not yet cached
      const baseRadius = isGOO ? 1.2 : 0.75;
      const baseHeight = isGOO ? 0.35 : 0.22;
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius, baseRadius * 1.12, baseHeight, 32),
        mat
      );
      baseMesh.position.y = baseHeight / 2;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      loader.load(modelPath, (gltf) => {
        modelCache[modelPath] = gltf.scene;
        const loadedScene = gltf.scene.clone(true);
        loadedScene.traverse((child) => {
          if (child.isMesh) {
            child.material = mat;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        loadedScene.position.y = baseHeight;
        group.add(loadedScene);
      });
    }

    return group;
  }

  static faceCameraAll(unitGroup, camera) {
    // 3D GLB models do NOT need camera billboard rotation since they are full 3D meshes!
  }

  create3DGate(colorHex) {
    const group = new THREE.Group();
    const color = typeof colorHex === 'number' ? colorHex : 0x888888;

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x2e2e36,
      roughness: 0.75,
      metalness: 0.15
    });

    [-0.9, 0.9].forEach(px => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 2.4, 14),
        stoneMat
      );
      m.position.set(px, 1.2, 0);
      m.castShadow = true;
      group.add(m);
    });

    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.18, 12, 28, Math.PI),
      stoneMat
    );
    arch.position.set(0, 2.2, 0);
    arch.castShadow = true;
    group.add(arch);

    const portal = new THREE.Mesh(
      new THREE.CircleGeometry(0.82, 32),
      new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.1,
        metalness: 0.8,
        emissive: color,
        emissiveIntensity: 0.9,
        side: THREE.DoubleSide
      })
    );
    portal.position.set(0, 1.3, 0.02);
    group.add(portal);

    const pLight = new THREE.PointLight(color, 1.4, 6);
    pLight.position.set(0, 1.3, 0.3);
    group.add(pLight);

    return group;
  }
}
