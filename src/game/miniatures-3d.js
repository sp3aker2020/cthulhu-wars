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
      roughness: 0.22,
      metalness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      emissive: hexColor,
      emissiveIntensity: 0.25,
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

    const baseRadius = isGOO ? 1.3 : 0.8;
    const baseHeight = isGOO ? 0.38 : 0.25;
    const billHeight = isGOO ? 5.4 : 3.4;
    const billWidth = billHeight * 0.82;

    // 1. Heavy Molded 3D Faction Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.15, baseHeight, 32);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Glowing Metallic Faction Rim Ring
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Gold rim frame
      roughness: 0.1,
      metalness: 0.95,
      emissive: hexColor,
      emissiveIntensity: 0.3
    });
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(baseRadius * 1.05, 0.07, 8, 32),
      rimMat
    );
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = baseHeight + 0.01;
    group.add(rimMesh);

    // Faction-colored Point Light to make painted miniature pop
    const pLight = new THREE.PointLight(hexColor, isGOO ? 2.4 : 1.6, isGOO ? 10 : 6);
    pLight.position.set(0, baseHeight + 0.6, 0.6);
    group.add(pLight);

    // 2. Standing 3D Metallic Plaque Standee
    const plaqueGroup = new THREE.Group();
    plaqueGroup.position.y = baseHeight + billHeight / 2;

    // Outer Metallic Frame Bezel
    const frameGeo = new THREE.BoxGeometry(billWidth + 0.15, billHeight + 0.15, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.3,
      metalness: 0.8
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    plaqueGroup.add(frameMesh);

    // High-Res Painted Miniature Artwork Face
    const imgUrl = UNIT_IMAGES[unitType] || UNIT_IMAGES.cultist;
    const texture = getTexture(imgUrl);

    const faceMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    });

    const faceGeo = new THREE.PlaneGeometry(billWidth, billHeight);
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = 0.05;
    plaqueGroup.add(faceMesh);

    // Back Face Duplicate for 360° visibility
    const backMesh = new THREE.Mesh(faceGeo, faceMat);
    backMesh.rotation.y = Math.PI;
    backMesh.position.z = -0.05;
    plaqueGroup.add(backMesh);

    group.add(plaqueGroup);
    group.userData = { isMiniature: true, billboard: plaqueGroup };
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
