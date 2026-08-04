import * as THREE from 'three';
import { FACTIONS, UNIT_IMAGES } from './constants.js';

// ── Texture cache ──────────────────────────────────────────────
const _loader  = new THREE.TextureLoader();
const _cache   = {};

function getTex(url) {
  if (!_cache[url]) {
    const t = _loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    _cache[url]  = t;
  }
  return _cache[url];
}

// ─────────────────────────────────────────────────────────────
// MiniatureFactory
// ─────────────────────────────────────────────────────────────

export class MiniatureFactory {
  constructor() {}

  /**
   * Create a full miniature group:
   *   • faction-coloured plastic circular base
   *   • vertical billboard plane with the pre-processed transparent PNG
   */
  createMiniature(unitType, factionId) {
    const group = new THREE.Group();

    const faction  = FACTIONS[factionId];
    const hexColor = faction ? parseInt(faction.color.replace('#', '0x'), 16) : 0x888888;

    const isGOO     = ['great_cthulhu','nyarlathotep','hastur','king_in_yellow','shub_niggurath'].includes(unitType);
    const baseR     = isGOO ? 1.3  : 0.8;
    const baseH     = isGOO ? 0.4  : 0.25;
    const billH     = isGOO ? 5.5  : 3.2;
    const billW     = billH * 0.85;

    // ── Plastic base ──────────────────────────────────────────
    const baseMat = new THREE.MeshPhysicalMaterial({
      color:              hexColor,
      roughness:          0.25,
      metalness:          0.05,
      clearcoat:          0.6,
      clearcoatRoughness: 0.12,
      emissive:           hexColor,
      emissiveIntensity:  0.15,
    });

    const baseMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(baseR, baseR * 1.12, baseH, 40),
      baseMat
    );
    baseMesh.position.y   = baseH / 2;
    baseMesh.castShadow   = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Thin glowing rim ring
    const rimMesh = new THREE.Mesh(
      new THREE.TorusGeometry(baseR * 1.06, 0.055, 8, 40),
      new THREE.MeshPhysicalMaterial({
        color:             hexColor,
        roughness:         0.08,
        metalness:         0.95,
        emissive:          hexColor,
        emissiveIntensity: 0.5,
      })
    );
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y  = baseH + 0.01;
    group.add(rimMesh);

    // ── Artwork billboard ─────────────────────────────────────
    const imgUrl = UNIT_IMAGES[unitType] ?? UNIT_IMAGES['cultist'];
    const tex    = getTex(imgUrl);

    const billMat = new THREE.MeshBasicMaterial({
      map:        tex,
      transparent: true,
      alphaTest:   0.08,        // discard near-transparent (feathered edge) fragments
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });

    const billboard = new THREE.Mesh(
      new THREE.PlaneGeometry(billW, billH),
      billMat
    );
    // Centre the bottom of the billboard at the top of the base
    billboard.position.y          = baseH + billH / 2;
    billboard.userData.isBillboard = true;
    group.add(billboard);

    group.userData.billboard = billboard;
    return group;
  }

  /**
   * Call once per animation frame to keep all billboards facing the camera.
   */
  static faceCameraAll(unitGroup, camera) {
    unitGroup.children.forEach(mini => {
      const bb = mini.userData && mini.userData.billboard;
      if (bb) {
        // Face the camera on Y-axis only (don't tilt up/down)
        const cp = camera.position;
        const mp = mini.position;
        bb.rotation.y = Math.atan2(cp.x - mp.x, cp.z - mp.z);
      }
    });
  }

  // ── 3D Gate Archway ────────────────────────────────────────
  create3DGate(colorHex) {
    const group    = new THREE.Group();
    const color    = typeof colorHex === 'number' ? colorHex : 0x888888;

    const stoneMat = new THREE.MeshStandardMaterial({
      color:     0x2e2e36,
      roughness: 0.75,
      metalness: 0.15,
    });

    // Two stone pillars
    [-0.9, 0.9].forEach(px => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 2.4, 14),
        stoneMat
      );
      m.position.set(px, 1.2, 0);
      m.castShadow = true;
      group.add(m);
    });

    // Top arch
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.18, 12, 28, Math.PI),
      stoneMat
    );
    arch.position.set(0, 2.2, 0);
    arch.castShadow = true;
    group.add(arch);

    // Glowing portal disc
    const portal = new THREE.Mesh(
      new THREE.CircleGeometry(0.82, 32),
      new THREE.MeshStandardMaterial({
        color:             color,
        roughness:         0.1,
        metalness:         0.8,
        emissive:          color,
        emissiveIntensity: 0.9,
        side:              THREE.DoubleSide,
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
