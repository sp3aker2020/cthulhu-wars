import * as THREE from 'three';
import { FACTIONS, UNIT_IMAGES } from './constants.js';

/**
 * Loads a JPG/PNG image, strips the near-black background using canvas,
 * and returns a THREE.CanvasTexture with a transparent background.
 * Optimised for studio-style miniature photography (pure black backdrops).
 */
function loadTransparentTexture(url) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];

      // Perceived luminance of the pixel
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < 30) {
        // Pure black → fully transparent
        d[i + 3] = 0;
      } else if (lum < 60) {
        // Dark fringe → soft feathered edge
        d[i + 3] = Math.round(((lum - 30) / 30) * 255);
      }
      // All other pixels keep their full alpha (255)
    }

    ctx.putImageData(imgData, 0, 0);
    texture.needsUpdate = true;
  };
  img.src = url;
  return texture;
}

/** Cache so each image is only processed once */
const _textureCache = {};
function getCachedTexture(url) {
  if (!_textureCache[url]) {
    _textureCache[url] = loadTransparentTexture(url);
  }
  return _textureCache[url];
}

// ─────────────────────────────────────────────────────────────
// MiniatureFactory
// ─────────────────────────────────────────────────────────────

export class MiniatureFactory {
  constructor() {}

  /**
   * Creates a complete 3D miniature group:
   *   • A faction-coloured painted plastic base (cylinder)
   *   • A camera-facing billboard plane showing the miniature artwork
   */
  createMiniature(unitType, factionId) {
    const group = new THREE.Group();

    const faction     = FACTIONS[factionId];
    const hexColor    = faction ? parseInt(faction.color.replace('#', '0x'), 16) : 0x888888;
    const isGOO       = ['great_cthulhu', 'nyarlathotep', 'hastur', 'king_in_yellow', 'shub_niggurath'].includes(unitType);

    const baseRadius  = isGOO ? 1.3  : 0.75;
    const baseHeight  = isGOO ? 0.4  : 0.25;
    const billHeight  = isGOO ? 5.2  : 3.0;
    const billWidth   = billHeight * 0.82; // approximate aspect ratio of the source images

    // ── 1. Painted plastic base ──────────────────────────────
    const baseMat = new THREE.MeshPhysicalMaterial({
      color:              hexColor,
      roughness:          0.25,
      metalness:          0.05,
      clearcoat:          0.5,
      clearcoatRoughness: 0.15,
      emissive:           hexColor,
      emissiveIntensity:  0.12,
    });

    const baseGeo  = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.12, baseHeight, 40);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y  = baseHeight / 2;
    baseMesh.castShadow  = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Base rim highlight ring
    const rimGeo  = new THREE.TorusGeometry(baseRadius * 1.06, 0.06, 8, 40);
    const rimMat  = new THREE.MeshPhysicalMaterial({
      color:             hexColor,
      roughness:         0.1,
      metalness:         0.9,
      emissive:          hexColor,
      emissiveIntensity: 0.4,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x   = Math.PI / 2;
    rimMesh.position.y   = baseHeight;
    group.add(rimMesh);

    // ── 2. Miniature artwork billboard ──────────────────────
    const imgUrl    = UNIT_IMAGES[unitType] ?? UNIT_IMAGES['cultist'];
    const texture   = getCachedTexture(imgUrl);
    const billMat   = new THREE.MeshBasicMaterial({
      map:         texture,
      transparent: true,
      alphaTest:   0.05,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });

    const billGeo  = new THREE.PlaneGeometry(billWidth, billHeight);
    const billboard = new THREE.Mesh(billGeo, billMat);
    // Position so the bottom of the plane sits at the top of the base
    billboard.position.y = baseHeight + billHeight / 2;
    billboard.userData.isBillboard = true;
    group.add(billboard);

    // Store camera-facing callback data on the group
    group.userData.billboard = billboard;

    return group;
  }

  /**
   * Call once per frame (or at least after camera moves) to make all
   * billboard sprites face the camera.
   */
  static faceCameraAll(unitGroup, camera) {
    unitGroup.children.forEach(mini => {
      const bb = mini.userData.billboard;
      if (bb) {
        bb.lookAt(camera.position);
      }
    });
  }

  /**
   * 3D stone archway gate with glowing inner portal disc.
   */
  create3DGate(colorHex) {
    const group    = new THREE.Group();
    const color    = typeof colorHex === 'number' ? colorHex : 0x888888;

    const stoneMat = new THREE.MeshStandardMaterial({
      color:     0x2e2e36,
      roughness: 0.75,
      metalness: 0.15,
    });
    const glowMat  = new THREE.MeshStandardMaterial({
      color:             color,
      roughness:         0.1,
      metalness:         0.8,
      emissive:          color,
      emissiveIntensity: 0.8,
      side:              THREE.DoubleSide,
    });

    // Two pillars
    [-0.9, 0.9].forEach(px => {
      const geo  = new THREE.CylinderGeometry(0.18, 0.24, 2.4, 14);
      const mesh = new THREE.Mesh(geo, stoneMat);
      mesh.position.set(px, 1.2, 0);
      mesh.castShadow = true;
      group.add(mesh);
    });

    // Top arch
    const archGeo  = new THREE.TorusGeometry(0.9, 0.18, 12, 28, Math.PI);
    const archMesh = new THREE.Mesh(archGeo, stoneMat);
    archMesh.position.set(0, 2.2, 0);
    archMesh.castShadow = true;
    group.add(archMesh);

    // Glowing portal disc
    const portalGeo  = new THREE.CircleGeometry(0.82, 32);
    const portalMesh = new THREE.Mesh(portalGeo, glowMat);
    portalMesh.position.set(0, 1.3, 0.02);
    group.add(portalMesh);

    // Portal light
    const pLight = new THREE.PointLight(color, 1.4, 6);
    pLight.position.set(0, 1.3, 0.3);
    group.add(pLight);

    return group;
  }
}
