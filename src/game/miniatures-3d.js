import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FACTIONS } from './constants.js';

const MODEL_PATHS = {
  great_cthulhu: '/assets/models/cthulhu.obj',
  nyarlathotep: '/assets/models/nyarlathotep.obj',
  hastur: '/assets/models/hastur.obj',
  king_in_yellow: '/assets/models/hastur.obj',
  shub_niggurath: '/assets/models/shub.obj',
  cultist: '/assets/models/cultist.obj',
  deep_one: '/assets/models/monster.obj',
  starspawn: '/assets/models/monster.obj',
  shoggoth: '/assets/models/monster.obj',
  flying_polyp: '/assets/models/monster.obj',
  hunting_horror: '/assets/models/monster.obj',
  nightgaunt: '/assets/models/monster.obj',
  dark_young: '/assets/models/shub.obj',
  ghoul: '/assets/models/monster.obj',
  byakhee: '/assets/models/monster.obj',
  king_in_yellow_avatar: '/assets/models/hastur.obj'
};

const loader = new OBJLoader();
const modelCache = {};

// Preload OBJ models
Object.entries(MODEL_PATHS).forEach(([key, path]) => {
  if (!modelCache[path]) {
    loader.load(path, (obj) => {
      modelCache[path] = obj;
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
      roughness: 0.22,
      metalness: 0.15,
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

    if (modelCache[modelPath]) {
      const clonedObj = modelCache[modelPath].clone(true);
      clonedObj.traverse((child) => {
        if (child.isMesh) {
          child.material = mat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      clonedObj.rotation.x = -Math.PI / 2;
      group.add(clonedObj);
    } else {
      loader.load(modelPath, (obj) => {
        modelCache[modelPath] = obj;
        const loadedObj = obj.clone(true);
        loadedObj.traverse((child) => {
          if (child.isMesh) {
            child.material = mat;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        loadedObj.rotation.x = -Math.PI / 2;
        group.add(loadedObj);
      });
    }

    return group;
  }

  static faceCameraAll(unitGroup, camera) {
    // 3D OBJ models do NOT face camera because they are 360° 3D meshes!
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
