import * as THREE from 'three';
import { MAP_REGIONS, FACTIONS, UNIT_IMAGES } from './constants.js';
import { MiniatureFactory } from './miniatures-3d.js';

export class MapRenderer3D {
  constructor(containerElement, gameState) {
    this.container = containerElement;
    this.gameState = gameState;
    this.miniFactory = new MiniatureFactory();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clickCallback = null;
    this.regionMeshes = {};
    this.unitGroup = null;
    this.gateGroup = null;
    this.highlightGroup = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isMouseDown = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.validRegions = new Set();
    this.animationFrameId = null;
    this.textures = {};
  }

  init() {
    this.container.innerHTML = '';

    // Create Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b14);
    this.scene.fog = new THREE.FogExp2(0x070b14, 0.015);

    const aspect = this.container.clientWidth / this.container.clientHeight || 16 / 9;
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    this.camera.position.set(0, 20, 18);
    this.camera.lookAt(this.cameraTarget);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth || 1000, this.container.clientHeight || 600);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
    dirLight.position.set(15, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const fillLight = new THREE.PointLight(0x448aff, 0.6, 50);
    fillLight.position.set(-20, 15, -10);
    this.scene.add(fillLight);

    // Load Textures
    const textureLoader = new THREE.TextureLoader();
    this.textures.board = textureLoader.load('/assets/board/map.jpg');
    this.textures.gate = textureLoader.load('/assets/tokens/gate.jpg');
    this.textures.elderSign = textureLoader.load('/assets/tokens/elder_sign.jpg');

    Object.entries(UNIT_IMAGES).forEach(([key, url]) => {
      this.textures[key] = textureLoader.load(url);
    });

    // 3D Table Surface
    const tableGeo = new THREE.PlaneGeometry(80, 60);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x120c08,
      roughness: 0.6,
      metalness: 0.1
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = -0.15;
    tableMesh.receiveShadow = true;
    this.scene.add(tableMesh);

    // 3D Game Board Plane
    const boardGeo = new THREE.PlaneGeometry(36, 21.6);
    const boardMat = new THREE.MeshStandardMaterial({
      map: this.textures.board,
      roughness: 0.4,
      metalness: 0.1
    });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.rotation.x = -Math.PI / 2;
    boardMesh.position.y = 0;
    boardMesh.receiveShadow = true;
    this.scene.add(boardMesh);

    // Groups
    this.unitGroup = new THREE.Group();
    this.gateGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();
    this.scene.add(this.unitGroup);
    this.scene.add(this.gateGroup);
    this.scene.add(this.highlightGroup);

    // Build 3D Region Colliders
    this._buildRegionColliders();

    // Event Listeners for Orbit / Camera & Raycasting
    this._setupControls();

    // Resize listener
    this._onResize = () => {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);

    // Start Animation Loop
    this._animate();
    this.updateAllRegions();
  }

  _map2DTo3D(x2d, y2d) {
    // 2D SVG map is (0..1000, 0..600). 3D board plane is 36 wide (-18..18), 21.6 deep (-10.8..10.8).
    const x3d = ((x2d / 1000) - 0.5) * 36;
    const z3d = ((y2d / 600) - 0.5) * 21.6;
    return { x: x3d, z: z3d };
  }

  _buildRegionColliders() {
    Object.entries(MAP_REGIONS).forEach(([regionId, config]) => {
      const pos = this._map2DTo3D(config.x * 10, config.y * 6);
      const geo = new THREE.CylinderGeometry(2.2, 2.2, 0.2, 16);
      const mat = new THREE.MeshBasicMaterial({ visible: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, 0.1, pos.z);
      mesh.userData = { regionId, config };
      this.scene.add(mesh);
      this.regionMeshes[regionId] = mesh;
    });
  }

  _setupControls() {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.isMouseDown = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      if (this.isMouseDown) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        // Rotate camera around origin
        const radius = Math.sqrt(this.camera.position.x ** 2 + this.camera.position.z ** 2);
        let theta = Math.atan2(this.camera.position.x, this.camera.position.z);
        theta -= deltaX * 0.005;

        this.camera.position.x = radius * Math.sin(theta);
        this.camera.position.z = radius * Math.cos(theta);
        this.camera.position.y = Math.max(10, Math.min(50, this.camera.position.y + deltaY * 0.05));
        this.camera.lookAt(this.cameraTarget);

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    });

    dom.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - this.previousMousePosition.x, e.clientY - this.previousMousePosition.y);
      this.isMouseDown = false;

      // Handle Click if mouse didn't drag far
      if (dist < 5) {
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(Object.values(this.regionMeshes));

        if (intersects.length > 0) {
          const hitRegion = intersects[0].object.userData.regionId;
          if (this.clickCallback) {
            this.clickCallback(hitRegion);
          }
        }
      }
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.position.y = Math.max(12, Math.min(55, this.camera.position.y + e.deltaY * 0.03));
      this.camera.lookAt(this.cameraTarget);
    }, { passive: false });
  }

  _animate() {
    this.animationFrameId = requestAnimationFrame(() => this._animate());

    // Animate glowing green rings
    const time = Date.now() * 0.003;
    this.highlightGroup.children.forEach(child => {
      if (child.userData.isRing) {
        child.scale.setScalar(1 + Math.sin(time) * 0.08);
      }
    });

    // Keep all miniature artwork billboards facing the camera
    if (this.unitGroup && this.camera) {
      MiniatureFactory.faceCameraAll(this.unitGroup, this.camera);
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateRegion(regionId, regionState) {
    this._updateGates();
    this._updateUnits();
  }

  updateAllRegions() {
    this._updateGates();
    this._updateUnits();
  }

  _updateGates() {
    // Clear old gates
    while (this.gateGroup.children.length > 0) {
      const obj = this.gateGroup.children.pop();
      if (obj.geometry) obj.geometry.dispose();
    }

    if (!this.gameState) return;

    Object.entries(MAP_REGIONS).forEach(([regionId, config]) => {
      const rState = this.gameState.getRegionState(regionId);
      if (rState && rState.gate) {
        const pos = this._map2DTo3D(config.x * 10 - 20, config.y * 6 - 15);

        let colorHex = 0x888888;
        if (typeof rState.gate.owner === 'number') {
          const player = this.gameState.getPlayer(rState.gate.owner);
          if (player && FACTIONS[player.factionId]) {
            colorHex = parseInt(FACTIONS[player.factionId].color.replace('#', '0x'), 16);
          }
        }

        const gate3D = this.miniFactory.create3DGate(colorHex);
        gate3D.position.set(pos.x, 0, pos.z);
        this.gateGroup.add(gate3D);
      }
    });
  }

  _updateUnits() {
    // Clear old units
    while (this.unitGroup.children.length > 0) {
      const obj = this.unitGroup.children.pop();
      if (obj.geometry) obj.geometry.dispose();
    }

    if (!this.gameState) return;

    Object.entries(MAP_REGIONS).forEach(([regionId, config]) => {
      const rState = this.gameState.getRegionState(regionId);
      if (!rState || !rState.units) return;

      const center = this._map2DTo3D(config.x * 10, config.y * 6);
      let offsetIndex = 0;

      Object.entries(rState.units).forEach(([playerIndexStr, units]) => {
        const pIdx = parseInt(playerIndexStr, 10);
        const player = this.gameState.getPlayer(pIdx);
        if (!player) return;

        const counts = {};
        units.forEach(u => { counts[u.unitType] = (counts[u.unitType] || 0) + 1; });

        Object.entries(counts).forEach(([uType, count]) => {
          const offsetX = (offsetIndex % 3 - 1) * 1.6;
          const offsetZ = Math.floor(offsetIndex / 3) * 1.6;
          const pos = { x: center.x + offsetX, z: center.z + offsetZ };

          const mini3D = this.miniFactory.createMiniature(uType, player.factionId);
          mini3D.position.set(pos.x, 0, pos.z);
          this.unitGroup.add(mini3D);

          offsetIndex++;
        });
      });
    });
  }

  highlightRegions(regionIds, className) {
    this.clearHighlights();

    regionIds.forEach(id => {
      const config = MAP_REGIONS[id];
      if (!config) return;
      this.validRegions.add(id);

      const pos = this._map2DTo3D(config.x * 10, config.y * 6);

      // Glowing Green 3D Target Ring
      const ringGeo = new THREE.RingGeometry(1.8, 2.4, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x69f0ae,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(pos.x, 0.12, pos.z);
      ringMesh.userData = { isRing: true, id };

      this.highlightGroup.add(ringMesh);

      // Spot light over valid region
      const spotLight = new THREE.PointLight(0x69f0ae, 1.5, 8);
      spotLight.position.set(pos.x, 3.5, pos.z);
      this.highlightGroup.add(spotLight);
    });
  }

  clearHighlights() {
    this.validRegions.clear();
    while (this.highlightGroup.children.length > 0) {
      const obj = this.highlightGroup.children.pop();
      if (obj.geometry) obj.geometry.dispose();
    }
  }

  selectRegion(regionId) {}
  deselectAll() {}

  onRegionClick(callback) {
    this.clickCallback = callback;
  }

  offRegionClick(callback) {
    if (this.clickCallback === callback) {
      this.clickCallback = null;
    }
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }
}
