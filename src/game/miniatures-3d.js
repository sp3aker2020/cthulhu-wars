import * as THREE from 'three';
import { FACTIONS } from './constants.js';

/**
 * Factory class for generating 3D Molded Plastic Miniature Models matching Tabletop Simulator.
 */
export class MiniatureFactory {
  constructor() {
    this.materialsCache = {};
  }

  /**
   * Returns a high-gloss PBR plastic material matching Tabletop Simulator plastic game pieces.
   */
  getPlasticMaterial(factionId) {
    if (this.materialsCache[factionId]) {
      return this.materialsCache[factionId];
    }

    const faction = FACTIONS[factionId];
    const hexColor = faction ? parseInt(faction.color.replace('#', '0x'), 16) : 0x00c853;

    const material = new THREE.MeshPhysicalMaterial({
      color: hexColor,
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
      reflectivity: 0.75,
      emissive: hexColor,
      emissiveIntensity: 0.1,
      shadowSide: THREE.DoubleSide
    });

    this.materialsCache[factionId] = material;
    return material;
  }

  /**
   * Creates a 3D molded plastic miniature model for a unit type & faction.
   */
  createMiniature(unitType, factionId) {
    const group = new THREE.Group();
    const mat = this.getPlasticMaterial(factionId);

    const isGOO = ['great_cthulhu', 'nyarlathotep', 'hastur', 'king_in_yellow', 'shub_niggurath'].includes(unitType);
    const baseRadius = isGOO ? 1.25 : 0.75;
    const baseHeight = isGOO ? 0.38 : 0.22;

    // 1. Molded Faction Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.14, baseHeight, 36);
    const baseMesh = new THREE.Mesh(baseGeo, mat);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // 2. Molded 3D Plastic Sculpture
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
        this._buildMonsterMesh(figGroup, mat);
        break;
    }

    group.add(figGroup);
    return group;
  }

  // ========== 3D GEOMETRY BUILDERS ==========

  _buildCthulhuMesh(group, mat) {
    // Muscular Torso
    const bodyGeo = new THREE.CylinderGeometry(0.75, 0.45, 2.4, 20);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 1.2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.7, 20, 20);
    headGeo.scale(1, 1.25, 1);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 2.6, 0.1);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    group.add(headMesh);

    // Face Tentacles
    for (let i = -3; i <= 3; i++) {
      const angle = (i / 3) * 0.85;
      const tentGeo = new THREE.TorusGeometry(0.38, 0.09, 10, 20, Math.PI);
      const tentMesh = new THREE.Mesh(tentGeo, mat);
      tentMesh.rotation.y = angle;
      tentMesh.rotation.x = Math.PI / 2 + 0.35;
      tentMesh.position.set(Math.sin(angle) * 0.28, 2.15, 0.6 + Math.cos(angle) * 0.1);
      tentMesh.castShadow = true;
      group.add(tentMesh);
    }

    // 3D Bat Wings (Left & Right)
    [-1, 1].forEach(side => {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.quadraticCurveTo(side * 1.6, 1.3, side * 2.4, 2.6);
      wingShape.quadraticCurveTo(side * 1.5, 1.6, side * 1.8, 0.6);
      wingShape.quadraticCurveTo(side * 0.9, 0.3, 0, 0);

      const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03 };
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
      const wingMesh = new THREE.Mesh(wingGeo, mat);
      wingMesh.position.set(0, 1.5, -0.2);
      wingMesh.rotation.y = side * -0.25;
      wingMesh.castShadow = true;
      group.add(wingMesh);
    });

    // Muscular Arms
    [-1, 1].forEach(side => {
      const armGeo = new THREE.CylinderGeometry(0.2, 0.15, 1.3, 14);
      const armMesh = new THREE.Mesh(armGeo, mat);
      armMesh.position.set(side * 0.8, 1.75, 0.35);
      armMesh.rotation.z = side * -0.45;
      armMesh.rotation.x = 0.45;
      armMesh.castShadow = true;
      group.add(armMesh);
    });
  }

  _buildNyarlathotepMesh(group, mat) {
    // Serpentine Body Column
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.75, 2.8, 20);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 1.4;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Towering Head Tentacle Stalk
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.6, 0),
      new THREE.Vector3(0.35, 3.4, 0.25),
      new THREE.Vector3(-0.25, 4.1, 0.45),
      new THREE.Vector3(0, 4.6, 0.1)
    ]);
    const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.28, 12, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, mat);
    tubeMesh.castShadow = true;
    group.add(tubeMesh);

    // Sprawling Arm Tentacles
    for (let a = 0; a < 6; a++) {
      const angle = (a / 6) * Math.PI * 2;
      const tCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 0.35, 1.3, Math.sin(angle) * 0.35),
        new THREE.Vector3(Math.cos(angle) * 0.9, 2.0, Math.sin(angle) * 0.9),
        new THREE.Vector3(Math.cos(angle) * 1.25, 2.7, Math.sin(angle) * 1.25)
      ]);
      const tGeo = new THREE.TubeGeometry(tCurve, 16, 0.13, 10, false);
      const tMesh = new THREE.Mesh(tGeo, mat);
      tMesh.castShadow = true;
      group.add(tMesh);
    }
  }

  _buildHasturMesh(group, mat) {
    // Tattered Robe Cone
    const robeGeo = new THREE.ConeGeometry(0.9, 2.8, 20);
    const robeMesh = new THREE.Mesh(robeGeo, mat);
    robeMesh.position.y = 1.4;
    robeMesh.castShadow = true;
    robeMesh.receiveShadow = true;
    group.add(robeMesh);

    // Hood
    const hoodGeo = new THREE.SphereGeometry(0.6, 18, 18);
    hoodGeo.scale(0.9, 1.15, 1);
    const hoodMesh = new THREE.Mesh(hoodGeo, mat);
    hoodMesh.position.set(0, 2.7, 0.1);
    hoodMesh.castShadow = true;
    group.add(hoodMesh);

    // Lower Robe Drapes
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const ringGeo = new THREE.TorusGeometry(0.32, 0.09, 10, 18, Math.PI);
      const ringMesh = new THREE.Mesh(ringGeo, mat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.rotation.z = angle;
      ringMesh.position.set(Math.cos(angle) * 0.65, 0.22, Math.sin(angle) * 0.65);
      ringMesh.castShadow = true;
      group.add(ringMesh);
    }
  }

  _buildShubMesh(group, mat) {
    // Beast Body
    const bodyGeo = new THREE.SphereGeometry(0.95, 18, 18);
    bodyGeo.scale(1.25, 0.95, 1.45);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 1.2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Horned Head
    const headGeo = new THREE.ConeGeometry(0.55, 0.95, 14);
    headGeo.rotateX(Math.PI / 3);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 1.7, 0.85);
    headMesh.castShadow = true;
    group.add(headMesh);

    // Branching Antlers
    [-0.38, 0.38].forEach(x => {
      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 1.9, 0.85),
        new THREE.Vector3(x * 1.85, 2.6, 0.95),
        new THREE.Vector3(x * 2.3, 3.25, 0.65)
      ]);
      const hornGeo = new THREE.TubeGeometry(hornCurve, 14, 0.1, 10, false);
      const hornMesh = new THREE.Mesh(hornGeo, mat);
      hornMesh.castShadow = true;
      group.add(hornMesh);
    });

    // 4 Legs
    [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]].forEach(([lx, lz]) => {
      const legGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.95, 12);
      const legMesh = new THREE.Mesh(legGeo, mat);
      legMesh.position.set(lx, 0.48, lz);
      legMesh.castShadow = true;
      group.add(legMesh);
    });
  }

  _buildCultistMesh(group, mat) {
    // Robed Body
    const bodyGeo = new THREE.ConeGeometry(0.48, 1.6, 14);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 0.8;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Hood
    const hoodGeo = new THREE.SphereGeometry(0.32, 14, 14);
    const hoodMesh = new THREE.Mesh(hoodGeo, mat);
    hoodMesh.position.set(0, 1.52, 0.05);
    hoodMesh.castShadow = true;
    group.add(hoodMesh);

    // Unholy Tome held in hands
    const bookGeo = new THREE.BoxGeometry(0.38, 0.42, 0.14);
    const bookMesh = new THREE.Mesh(bookGeo, mat);
    bookMesh.position.set(0, 1.0, 0.35);
    bookMesh.rotation.x = 0.35;
    bookMesh.castShadow = true;
    group.add(bookMesh);
  }

  _buildMonsterMesh(group, mat) {
    const bodyGeo = new THREE.CylinderGeometry(0.42, 0.58, 1.8, 14);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.position.y = 0.9;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    const headGeo = new THREE.SphereGeometry(0.4, 14, 14);
    const headMesh = new THREE.Mesh(headGeo, mat);
    headMesh.position.set(0, 1.7, 0.1);
    headMesh.castShadow = true;
    group.add(headMesh);
  }

  static faceCameraAll(unitGroup, camera) {
    // 3D molded plastic miniatures do NOT need billboard rotation as they are 360° 3D meshes!
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
