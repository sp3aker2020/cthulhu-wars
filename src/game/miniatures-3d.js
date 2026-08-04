import * as THREE from 'three';
import { FACTIONS } from './constants.js';

/**
 * Factory class for creating True 3D Molded Plastic Figurine Models for Cthulhu Wars.
 */
export class MiniatureFactory {
  constructor() {
    this.materialsCache = {};
  }

  /**
   * Returns a high-specular PBR plastic material in faction color.
   */
  getPlasticMaterial(factionId) {
    if (this.materialsCache[factionId]) {
      return this.materialsCache[factionId];
    }

    const faction = FACTIONS[factionId];
    const hexColor = faction ? parseInt(faction.color.replace('#', '0x'), 16) : 0x888888;

    const material = new THREE.MeshPhysicalMaterial({
      color: hexColor,
      roughness: 0.22,
      metalness: 0.1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.1,
      reflectivity: 0.6,
      emissive: hexColor,
      emissiveIntensity: 0.08,
      shadowSide: THREE.DoubleSide
    });

    this.materialsCache[factionId] = material;
    return material;
  }

  /**
   * Creates a 3D plastic figurine for a specified unit type & faction.
   */
  createMiniature(unitType, factionId) {
    const group = new THREE.Group();
    const mat = this.getPlasticMaterial(factionId);

    const isGOO = unitType === 'great_cthulhu' || unitType === 'nyarlathotep' || unitType === 'hastur' || unitType === 'king_in_yellow' || unitType === 'shub_niggurath';
    const baseRadius = isGOO ? 1.1 : 0.65;
    const baseHeight = isGOO ? 0.35 : 0.22;

    // 1. 3D Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.15, baseHeight, 32);
    const baseMesh = new THREE.Mesh(baseGeo, mat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Build 3D Figurine Mesh on Top of Base
    const figGroup = new THREE.Group();
    figGroup.position.y = baseHeight;

    switch (unitType) {
      case 'great_cthulhu':
        this._buildCthulhuMesh(figGroup, mat);
        break;
      case 'nyarlathotep':
        this._buildNyarlathotepMesh(figGroup, mat);
        break;
      case 'hastur':
      case 'king_in_yellow':
        this._buildHasturMesh(figGroup, mat);
        break;
      case 'shub_niggurath':
        this._buildShubMesh(figGroup, mat);
        break;
      case 'cultist':
        this._buildCultistMesh(figGroup, mat);
        break;
      default:
        this._buildMonsterMesh(figGroup, mat, unitType);
        break;
    }

    group.add(figGroup);
    return group;
  }

  // ========== 3D GEOMETRY BUILDERS ==========

  _buildCthulhuMesh(group, mat) {
    // Body Torso
    const bodyGeo = new THREE.CylinderGeometry(0.7, 0.4, 2.2, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 1.1;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Head Bulge
    const headGeo = new THREE.SphereGeometry(0.65, 16, 16);
    headGeo.scale(1, 1.2, 1);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 2.4, 0.1);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Face Tentacles (drooping down)
    for (let i = -3; i <= 3; i++) {
      const angle = (i / 3) * 0.8;
      const tentGeo = new THREE.TorusGeometry(0.35, 0.08, 8, 16, Math.PI);
      const tentMesh = new THREE.Mesh(tentGeo, mat);
      tentMesh.rotation.y = angle;
      tentMesh.rotation.x = Math.PI / 2 + 0.3;
      tentMesh.position.set(Math.sin(angle) * 0.25, 2.0, 0.55 + Math.cos(angle) * 0.1);
      tentMesh.castShadow = true;
      group.add(tentMesh);
    }

    // Bat Wings (Left & Right)
    [-1, 1].forEach(side => {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.quadraticCurveTo(side * 1.5, 1.2, side * 2.2, 2.4);
      wingShape.quadraticCurveTo(side * 1.4, 1.5, side * 1.6, 0.5);
      wingShape.quadraticCurveTo(side * 0.8, 0.3, 0, 0);

      const extrudeSettings = { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 };
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      const wingMesh = new THREE.Mesh(wingGeo, mat);
      wingMesh.position.set(0, 1.4, -0.2);
      wingMesh.rotation.y = side * -0.2;
      wingMesh.castShadow = true;
      group.add(wingMesh);
    });

    // Muscular Arms
    [-1, 1].forEach(side => {
      const armGeo = new THREE.CylinderGeometry(0.18, 0.14, 1.2, 12);
      const armMesh = new THREE.Mesh(armGeo, mat);
      armMesh.position.set(side * 0.75, 1.6, 0.3);
      armMesh.rotation.z = side * -0.4;
      armMesh.rotation.x = 0.4;
      armMesh.castShadow = true;
      group.add(armMesh);
    });
  }

  _buildNyarlathotepMesh(group, mat) {
    // Columnar Slender Body
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.7, 2.6, 16);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 1.3;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Towering Central Head Tentacle
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.4, 0),
      new THREE.Vector3(0.3, 3.2, 0.2),
      new THREE.Vector3(-0.2, 3.8, 0.4),
      new THREE.Vector3(0, 4.2, 0.1)
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.25, 10, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, mat);
    tubeMesh.castShadow = true;
    group.add(tubeMesh);

    // Surrounding Arm Tentacles
    for (let a = 0; a < 5; a++) {
      const angle = (a / 5) * Math.PI * 2;
      const tCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 0.3, 1.2, Math.sin(angle) * 0.3),
        new THREE.Vector3(Math.cos(angle) * 0.8, 1.8, Math.sin(angle) * 0.8),
        new THREE.Vector3(Math.cos(angle) * 1.1, 2.4, Math.sin(angle) * 1.1)
      ]);
      const tGeo = new THREE.TubeGeometry(tCurve, 12, 0.12, 8, false);
      const tMesh = new THREE.Mesh(tGeo, mat);
      tMesh.castShadow = true;
      group.add(tMesh);
    }
  }

  _buildHasturMesh(group, mat) {
    // Tattered Hooded Robe
    const robeGeo = new THREE.ConeGeometry(0.85, 2.6, 16);
    const robeMesh = new THREE.Mesh(robeGeo, mat);
    robeMesh.position.y = 1.3;
    robeMesh.castShadow = true;
    group.add(robeMesh);

    // Hood
    const hoodGeo = new THREE.SphereGeometry(0.55, 16, 16);
    hoodGeo.scale(0.9, 1.1, 1);
    const hoodMesh = new THREE.Mesh(hoodGeo, mat);
    hoodMesh.position.set(0, 2.5, 0.1);
    hoodMesh.castShadow = true;
    group.add(hoodMesh);

    // Lower Robe Tentacles
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const ringGeo = new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI);
      const ringMesh = new THREE.Mesh(ringGeo, mat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.rotation.z = angle;
      ringMesh.position.set(Math.cos(angle) * 0.6, 0.2, Math.sin(angle) * 0.6);
      ringMesh.castShadow = true;
      group.add(ringMesh);
    }
  }

  _buildShubMesh(group, mat) {
    // Beast Body
    const bodyGeo = new THREE.SphereGeometry(0.9, 16, 16);
    bodyGeo.scale(1.2, 0.9, 1.4);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 1.1;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Horned Head
    const headGeo = new THREE.ConeGeometry(0.5, 0.9, 12);
    headGeo.rotateX(Math.PI / 3);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 1.6, 0.8);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Branching Antlers/Horns
    [-0.35, 0.35].forEach(x => {
      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 1.8, 0.8),
        new THREE.Vector3(x * 1.8, 2.5, 0.9),
        new THREE.Vector3(x * 2.2, 3.1, 0.6)
      ]);
      const hornGeo = new THREE.TubeGeometry(hornCurve, 12, 0.09, 8, false);
      const hornMesh = new THREE.Mesh(hornGeo, mat);
      hornMesh.castShadow = true;
      group.add(hornMesh);
    });

    // 4 Legs
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([lx, lz]) => {
      const legGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10);
      const legMesh = new THREE.Mesh(legGeo, mat);
      legMesh.position.set(lx, 0.45, lz);
      legMesh.castShadow = true;
      group.add(legMesh);
    });
  }

  _buildCultistMesh(group, mat) {
    // Hooded Body
    const bodyGeo = new THREE.ConeGeometry(0.45, 1.5, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 0.75;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Hood
    const hoodGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const hoodMesh = new THREE.Mesh(hoodGeo, mat);
    hoodMesh.position.set(0, 1.45, 0.05);
    hoodMesh.castShadow = true;
    group.add(hoodMesh);

    // Held Tome / Book
    const bookGeo = new THREE.BoxGeometry(0.35, 0.4, 0.12);
    const bookMesh = new THREE.Mesh(bookGeo, mat);
    bookMesh.position.set(0, 0.95, 0.32);
    bookMesh.rotation.x = 0.3;
    bookMesh.castShadow = true;
    group.add(bookMesh);
  }

  _buildMonsterMesh(group, mat, unitType) {
    // Generic Monster Figurine with Type Accents
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.55, 1.7, 12);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 0.85;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const headGeo = new THREE.SphereGeometry(0.38, 12, 12);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 1.6, 0.1);
    headMesh.castShadow = true;
    group.add(headMesh);
  }

  /**
   * Builds a 3D Eldritch Gate Archway.
   */
  create3DGate(colorHex) {
    const group = new THREE.Group();
    const color = typeof colorHex === 'number' ? colorHex : 0x888888;

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3d,
      roughness: 0.7,
      metalness: 0.2
    });

    const portalMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.1,
      metalness: 0.9,
      emissive: color,
      emissiveIntensity: 0.6,
      side: THREE.DoubleSide
    });

    // 2 Arch Pillars
    [-0.9, 0.9].forEach(px => {
      const pillarGeo = new THREE.CylinderGeometry(0.18, 0.24, 2.2, 12);
      const pillarMesh = new THREE.Mesh(pillarGeo, stoneMat);
      pillarMesh.position.set(px, 1.1, 0);
      pillarMesh.castShadow = true;
      group.add(pillarMesh);
    });

    // Top Arch Ring
    const archGeo = new THREE.TorusGeometry(0.9, 0.18, 12, 24, Math.PI);
    const archMesh = new THREE.Mesh(archGeo, stoneMat);
    archMesh.position.set(0, 2.1, 0);
    archMesh.castShadow = true;
    group.add(archMesh);

    // Glowing Inner Portal Disc
    const portalGeo = new THREE.CircleGeometry(0.85, 24);
    const portalMesh = new THREE.Mesh(portalGeo, portalMat);
    portalMesh.position.set(0, 1.2, 0);
    group.add(portalMesh);

    // Portal PointLight
    const pLight = new THREE.PointLight(color, 1.2, 5);
    pLight.position.set(0, 1.2, 0.2);
    group.add(pLight);

    return group;
  }
}
