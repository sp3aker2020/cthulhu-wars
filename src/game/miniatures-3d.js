import * as THREE from 'three';
import { FACTIONS, UNIT_IMAGES } from './constants.js';

const textureLoader = new THREE.TextureLoader();
const textureCache = {};

function getTexture(url) {
  if (!textureCache[url]) {
    const tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache[url] = tex;
  }
  return textureCache[url];
}

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
      roughness: 0.25,
      metalness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      emissive: hexColor,
      emissiveIntensity: 0.2,
      shadowSide: THREE.DoubleSide
    });

    this.materialsCache[factionId] = material;
    return material;
  }

  createMiniature(unitType, factionId) {
    const group = new THREE.Group();
    const faction = FACTIONS[factionId];
    const hexColor = faction ? parseInt(faction.color.replace('#', '0x'), 16) : 0x888888;
    const baseMat = this.getPlasticMaterial(factionId);

    const isGOO = ['great_cthulhu', 'nyarlathotep', 'hastur', 'king_in_yellow', 'shub_niggurath'].includes(unitType);

    const baseRadius = isGOO ? 1.25 : 0.75;
    const baseHeight = isGOO ? 0.35 : 0.22;
    const billHeight = isGOO ? 5.2 : 3.2;
    const billWidth = billHeight * 0.85;

    // 1. 3D Faction Plastic Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.12, baseHeight, 32);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Glowing Metallic Faction Rim Ring
    const rimMat = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.15,
      metalness: 0.85,
      emissive: hexColor,
      emissiveIntensity: 0.4
    });
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(baseRadius * 1.05, 0.06, 8, 32),
      rimMat
    );
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = baseHeight + 0.01;
    group.add(rimMesh);

    // 2. Standing Miniature Artwork Billboard
    const imgUrl = UNIT_IMAGES[unitType] || UNIT_IMAGES.cultist;
    const texture = getTexture(imgUrl);

    const billMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const billGeo = new THREE.PlaneGeometry(billWidth, billHeight);
    const billboard = new THREE.Mesh(billGeo, billMat);
    billboard.position.y = baseHeight + billHeight / 2;
    group.add(billboard);

    group.userData = { isMiniature: true, billboard };
    return group;
  }

  static faceCameraAll(unitGroup, camera) {
    if (!unitGroup || !camera) return;
    unitGroup.children.forEach(mini => {
      if (mini.userData && mini.userData.billboard) {
        mini.userData.billboard.rotation.y = Math.atan2(
          camera.position.x - mini.position.x,
          camera.position.z - mini.position.z
        );
      }
    });
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
