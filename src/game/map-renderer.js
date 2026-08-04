import { MAP_REGIONS, FACTIONS, UNIT_ICONS, UNIT_IMAGES } from './constants.js';

export class MapRenderer {
  constructor(containerElement, gameState) {
    this.container = containerElement;
    this.gameState = gameState;
    this.svg = null;
    this.regionGroups = {};
    this.clickCallback = null;
  }

  init() {
    this.container.innerHTML = '';
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 1000 600');
    this.svg.setAttribute('id', 'game-map');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <clipPath id="circle-clip">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    `;
    this.svg.appendChild(defs);

    // Map Background Image (Antique Parchment World Map)
    const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    bgImage.setAttribute('href', '/assets/board/map.jpg');
    bgImage.setAttribute('x', '0');
    bgImage.setAttribute('y', '0');
    bgImage.setAttribute('width', '1000');
    bgImage.setAttribute('height', '600');
    bgImage.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    bgImage.setAttribute('opacity', '0.65');
    this.svg.appendChild(bgImage);

    const adjacencyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    adjacencyGroup.setAttribute('id', 'adjacency-lines');
    this.svg.appendChild(adjacencyGroup);

    const regionsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    regionsGroup.setAttribute('id', 'regions-group');
    this.svg.appendChild(regionsGroup);

    // Regions configuration from MAP_REGIONS constants
    const drawnLines = new Set();
    Object.entries(MAP_REGIONS).forEach(([regionId, config]) => {
      if (config.adj) {
        config.adj.forEach(adjId => {
          const adjConfig = MAP_REGIONS[adjId];
          if (!adjConfig) return;
          const lineId1 = `${regionId}-${adjId}`;
          const lineId2 = `${adjId}-${regionId}`;
          if (!drawnLines.has(lineId1) && !drawnLines.has(lineId2)) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', config.x * 10);
            line.setAttribute('y1', config.y * 6);
            line.setAttribute('x2', adjConfig.x * 10);
            line.setAttribute('y2', adjConfig.y * 6);
            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
            line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', '4 4');
            adjacencyGroup.appendChild(line);
            drawnLines.add(lineId1);
          }
        });
      }
    });

    Object.entries(MAP_REGIONS).forEach(([regionId, config]) => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('map-region', `region-${config.type}`);
      group.setAttribute('id', `region-${regionId}`);

      const shape = this._createRegionPath(regionId, config);
      group.appendChild(shape);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', config.x * 10);
      label.setAttribute('y', config.y * 6 + 25);
      label.setAttribute('text-anchor', 'middle');
      label.classList.add('region-label');
      label.textContent = config.name.toUpperCase();
      group.appendChild(label);

      const gateGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gateGroup.classList.add('gate-marker');
      gateGroup.style.display = 'none';
      
      const gateCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      gateCircle.setAttribute('cx', config.x * 10 - 20);
      gateCircle.setAttribute('cy', config.y * 6 - 15);
      gateCircle.setAttribute('r', '15');
      gateCircle.classList.add('gate-bg');
      gateGroup.appendChild(gateCircle);

      const gateImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      gateImg.setAttribute('href', '/assets/tokens/gate.jpg');
      gateImg.setAttribute('x', config.x * 10 - 35);
      gateImg.setAttribute('y', config.y * 6 - 30);
      gateImg.setAttribute('width', '30');
      gateImg.setAttribute('height', '30');
      gateGroup.appendChild(gateImg);
      
      group.appendChild(gateGroup);

      const unitsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      unitsGroup.classList.add('units-group');
      group.appendChild(unitsGroup);

      group.addEventListener('click', () => this._handleRegionClick(regionId));

      regionsGroup.appendChild(group);
      this.regionGroups[regionId] = {
        group,
        gateGroup,
        gateCircle,
        unitsGroup,
        config
      };
    });

    this.container.appendChild(this.svg);
  }

  updateRegion(regionId, regionState) {
    const rGroup = this.regionGroups[regionId];
    if (!rGroup) return;

    if (regionState && regionState.gate) {
      rGroup.gateGroup.style.display = 'block';
      let ownerColor = '#888';
      if (typeof regionState.gate.owner === 'number') {
        const player = this.gameState.getPlayer(regionState.gate.owner);
        if (player && FACTIONS[player.factionId]) {
          ownerColor = FACTIONS[player.factionId].color;
        }
      }
      rGroup.gateCircle.setAttribute('fill', ownerColor);
    } else {
      rGroup.gateGroup.style.display = 'none';
    }

    this._renderUnitsInRegion(rGroup.unitsGroup, regionId, regionState);
  }

  updateAllRegions() {
    if (!this.gameState) return;
    Object.keys(MAP_REGIONS).forEach(regionId => {
      const regionState = this.gameState.getRegionState(regionId);
      this.updateRegion(regionId, regionState);
    });
  }

  highlightRegions(regionIds, className) {
    regionIds.forEach(id => {
      if (this.regionGroups[id]) {
        this.regionGroups[id].group.classList.add(className);
      }
    });
  }

  clearHighlights() {
    Object.values(this.regionGroups).forEach(rg => {
      rg.group.classList.remove('valid-target', 'highlight', 'selected');
    });
  }

  selectRegion(regionId) {
    if (this.regionGroups[regionId]) {
      this.regionGroups[regionId].group.classList.add('selected');
    }
  }

  deselectAll() {
    Object.values(this.regionGroups).forEach(rg => {
      rg.group.classList.remove('selected');
    });
  }

  onRegionClick(callback) {
    this.clickCallback = callback;
  }

  offRegionClick(callback) {
    if (this.clickCallback === callback) {
      this.clickCallback = null;
    }
  }

  _handleRegionClick(regionId) {
    if (this.clickCallback) {
      this.clickCallback(regionId);
    }
  }

  _renderUnitsInRegion(unitsGroup, regionId, regionState) {
    unitsGroup.innerHTML = '';
    const config = this.regionGroups[regionId]?.config;
    if (!config || !regionState || !regionState.units) return;

    let xOffset = 0;
    let yOffset = -15;

    Object.entries(regionState.units).forEach(([playerIndexStr, units]) => {
      const pIdx = parseInt(playerIndexStr, 10);
      const player = this.gameState.getPlayer(pIdx);
      const faction = player ? FACTIONS[player.factionId] : null;
      const factionColor = faction ? faction.color : '#ffffff';

      const counts = {};
      units.forEach(u => {
        counts[u.unitType] = (counts[u.unitType] || 0) + 1;
      });

      Object.entries(counts).forEach(([uType, count]) => {
        const imgUrl = UNIT_IMAGES[uType] || '/assets/units/cultist.jpg';
        const uGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        uGroup.classList.add('unit-token');

        const tokenCx = config.x * 10 + 10 + xOffset;
        const tokenCy = config.y * 6 + yOffset;

        // Faction color ring
        const borderCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        borderCircle.setAttribute('cx', tokenCx);
        borderCircle.setAttribute('cy', tokenCy);
        borderCircle.setAttribute('r', '14');
        borderCircle.setAttribute('fill', 'none');
        borderCircle.setAttribute('stroke', factionColor);
        borderCircle.setAttribute('stroke-width', '2.5');
        borderCircle.setAttribute('filter', 'url(#glow)');
        uGroup.appendChild(borderCircle);

        // Unit Miniature Image
        const tokenImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        tokenImg.setAttribute('href', imgUrl);
        tokenImg.setAttribute('x', tokenCx - 12);
        tokenImg.setAttribute('y', tokenCy - 12);
        tokenImg.setAttribute('width', '24');
        tokenImg.setAttribute('height', '24');
        tokenImg.setAttribute('clip-path', 'url(#circle-clip)');
        uGroup.appendChild(tokenImg);

        // Quantity badge if > 1
        if (count > 1) {
          const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          badgeBg.setAttribute('cx', tokenCx + 10);
          badgeBg.setAttribute('cy', tokenCy - 10);
          badgeBg.setAttribute('r', '7');
          badgeBg.setAttribute('fill', '#ff1744');
          badgeBg.setAttribute('stroke', '#ffffff');
          badgeBg.setAttribute('stroke-width', '1');
          uGroup.appendChild(badgeBg);

          const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          badgeText.setAttribute('x', tokenCx + 10);
          badgeText.setAttribute('y', tokenCy - 7);
          badgeText.setAttribute('text-anchor', 'middle');
          badgeText.setAttribute('font-size', '9');
          badgeText.setAttribute('font-weight', 'bold');
          badgeText.setAttribute('fill', '#ffffff');
          badgeText.textContent = count;
          uGroup.appendChild(badgeText);
        }

        unitsGroup.appendChild(uGroup);
        xOffset += 26;
        if (xOffset > 60) {
          xOffset = 0;
          yOffset += 28;
        }
      });
    });
  }

  _createRegionPath(regionId, config) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const cx = config.x * 10;
    const cy = config.y * 6;
    const w = config.type === 'land' ? 100 : 120;
    const h = config.type === 'land' ? 80 : 90;
    const halfW = w / 2;
    const halfH = h / 2;

    let points;
    if (config.type === 'land') {
      points = [
        [cx, cy - halfH],
        [cx + halfW, cy - halfH * 0.4],
        [cx + halfW * 0.8, cy + halfH],
        [cx - halfW * 0.8, cy + halfH],
        [cx - halfW, cy - halfH * 0.4]
      ];
    } else {
      points = [
        [cx, cy - halfH],
        [cx + halfW * 0.9, cy - halfH * 0.5],
        [cx + halfW, cy + halfH * 0.5],
        [cx, cy + halfH],
        [cx - halfW, cy + halfH * 0.5],
        [cx - halfW * 0.9, cy - halfH * 0.5]
      ];
    }

    el.setAttribute('points', points.map(p => `${p[0]},${p[1]}`).join(' '));
    el.setAttribute('fill', config.type === 'land' ? '#1a2332' : '#0a1628');
    el.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
    el.setAttribute('stroke-width', '1.5');
    el.setAttribute('opacity', '0.9');

    return el;
  }

  destroy() {
    this.clickCallback = null;
    if (this.svg) {
      this.svg.remove();
    }
  }
}
