import { $, $$, createElement, show, hide, addClass, removeClass } from '../utils/dom.js';
import { FACTIONS, MAP_REGIONS, UNIT_ICONS, PHASE_NAMES, GAME_CONFIG } from '../game/constants.js';

export class UIController {
  constructor(gameState, mapRenderer) {
    this.gameState = gameState;
    this.mapRenderer = mapRenderer;
    this._actionResolver = null;
    this._regionResolver = null;
    this._toastTimeout = null;
  }

  init() {
    this.gameState.on('phaseChange', () => this.updateHeader());
    this.gameState.on('turnChange', () => this.updateHeader());
    this.gameState.on('powerChange', () => this.updateFactionPanel());
    this.gameState.on('doomChange', () => this.updateFactionPanel());
    this.gameState.on('unitPlaced', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('unitsMoved', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('unitKilled', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('unitRemoved', () => { this.mapRenderer.updateAllRegions(); this.updateFactionPanel(); });
    this.gameState.on('gateBuilt', () => this.mapRenderer.updateAllRegions());
    this.gameState.on('gateAbandoned', () => this.mapRenderer.updateAllRegions());
    this.gameState.on('spellbookUnlocked', () => this.updateFactionPanel());
    this.gameState.on('logEntry', (data) => this.addLogEntry(data));
    this.gameState.on('gooAwakened', () => this.updateFactionPanel());

    const rulebookBtn = $('#rulebook-btn');
    if (rulebookBtn) {
      rulebookBtn.addEventListener('click', () => this.showRulebookModal());
    }
  }

  // ========== HEADER ==========
  updateHeader() {
    const state = this.gameState.state;
    const player = this.gameState.getCurrentPlayer();
    const faction = player ? FACTIONS[player.factionId] : null;
    const roundEl = $('#round-counter');
    const phaseEl = $('#phase-indicator');
    const playerEl = $('#current-player');
    if (roundEl) roundEl.textContent = `Round ${state.round}`;
    if (phaseEl) phaseEl.textContent = PHASE_NAMES[state.phase] || state.phase;
    if (playerEl && faction) {
      playerEl.innerHTML = `<span class="player-dot" style="background:${faction.color};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></span> ${faction.name}`;
    }
  }

  // ========== FACTION PANEL ==========
  updateFactionPanel() {
    const pi = this.gameState.state.currentPlayerIndex;
    const player = this.gameState.getPlayer(pi);
    if (!player) return;
    const faction = FACTIONS[player.factionId];

    this._renderPlayerTabs(pi);

    const powerFill = $('#power-fill');
    const powerValue = $('#power-value');
    if (powerFill) powerFill.style.width = `${Math.min(100, (player.power / 30) * 100)}%`;
    if (powerFill) powerFill.style.background = `linear-gradient(90deg, ${faction.colorDark}, ${faction.color})`;
    if (powerValue) powerValue.textContent = player.power;

    const doomFill = $('#doom-fill');
    const doomValue = $('#doom-value');
    if (doomFill) doomFill.style.width = `${Math.min(100, (player.doom / GAME_CONFIG.DOOM_VICTORY_THRESHOLD) * 100)}%`;
    if (doomValue) doomValue.textContent = player.doom;

    this._renderUnitRoster(player, faction);
    this._renderSpellbooks(player, faction);
  }

  _renderPlayerTabs(activeIndex) {
    const container = $('#player-tabs');
    if (!container) return;
    container.innerHTML = '';
    this.gameState.state.players.forEach((p, i) => {
      const faction = FACTIONS[p.factionId];
      const tab = createElement('button', {
        class: `player-tab ${i === activeIndex ? 'active' : ''}`,
        style: i === activeIndex ? `border-bottom-color: ${faction.color}; color: ${faction.color}` : '',
        click: () => this._showPlayerInfo(i)
      }, [faction.name.split(' ')[0]]);
      container.appendChild(tab);
    });
  }

  _showPlayerInfo(playerIndex) {
    const player = this.gameState.getPlayer(playerIndex);
    const faction = FACTIONS[player.factionId];
    this._renderPlayerTabs(playerIndex);
    const powerFill = $('#power-fill');
    const powerValue = $('#power-value');
    if (powerFill) { powerFill.style.width = `${Math.min(100, (player.power / 30) * 100)}%`; powerFill.style.background = `linear-gradient(90deg, ${faction.colorDark}, ${faction.color})`; }
    if (powerValue) powerValue.textContent = player.power;
    const doomFill = $('#doom-fill');
    const doomValue = $('#doom-value');
    if (doomFill) doomFill.style.width = `${Math.min(100, (player.doom / GAME_CONFIG.DOOM_VICTORY_THRESHOLD) * 100)}%`;
    if (doomValue) doomValue.textContent = player.doom;
    this._renderUnitRoster(player, faction);
    this._renderSpellbooks(player, faction);
  }

  _renderUnitRoster(player, faction) {
    const container = $('#unit-roster');
    if (!container) return;
    container.innerHTML = '';
    
    const onMap = {};
    for (const units of Object.values(player.units)) {
      for (const u of units) {
        onMap[u.unitType] = (onMap[u.unitType] || 0) + 1;
      }
    }
    
    const allUnitTypes = Object.keys(faction.units || {});
    for (const unitKey of allUnitTypes) {
      const unitDef = faction.units[unitKey];
      const mapCount = onMap[unitKey] || 0;
      const poolCount = player.pool[unitKey] || 0;
      const maxCount = unitDef.count || unitDef.maxPool || 6;
      const card = createElement('div', { class: 'unit-card' }, [
        createElement('div', { class: 'unit-icon' }, [UNIT_ICONS[unitKey] || '?']),
        createElement('div', { class: 'unit-name' }, [unitDef.name]),
        createElement('div', { class: 'unit-count mono' }, [`${mapCount}/${maxCount}`]),
      ]);
      container.appendChild(card);
    }
    
    const goos = faction.greatOldOne ? [faction.greatOldOne] : (faction.greatOldOnes ? Object.values(faction.greatOldOnes) : []);
    goos.forEach(goo => {
      const isAwakened = goo.id === 'hastur' ? player.hasturAwakened : player.greatOldOneAwakened;
      const gooCard = createElement('div', { class: `unit-card ${isAwakened ? 'awakened' : ''}` }, [
        createElement('div', { class: 'unit-icon' }, [UNIT_ICONS[goo.id] || '🐙']),
        createElement('div', { class: 'unit-name' }, [goo.name]),
        createElement('div', { class: 'unit-count mono' }, [isAwakened ? 'ON MAP' : 'SLEEPING']),
      ]);
      if (isAwakened) gooCard.style.borderColor = faction.color;
      container.appendChild(gooCard);
    });
  }

  _renderSpellbooks(player, faction) {
    const container = $('#spellbook-list');
    if (!container) return;
    container.innerHTML = '';
    const spellbookList = Array.isArray(faction.spellbooks) ? faction.spellbooks : Object.values(faction.spellbooks || {});
    
    spellbookList.forEach((sb, i) => {
      const unlocked = player.spellbooksUnlocked[i];
      const item = createElement('div', { class: `spellbook-item ${unlocked ? 'unlocked' : 'locked'}` }, [
        createElement('span', { class: 'spellbook-icon' }, [unlocked ? '🔓' : '🔒']),
        createElement('div', {}, [
          createElement('div', { class: 'spellbook-name' }, [sb.name]),
          createElement('div', { class: 'spellbook-condition', style: 'font-size:0.7rem;opacity:0.6' }, [sb.unlock || sb.unlockCondition]),
        ]),
      ]);
      if (unlocked) item.style.borderLeftColor = faction.color;
      container.appendChild(item);
    });
  }

  // ========== ACTION BAR ==========
  updateActionBar(playerIndex, availableActions) {
    const bar = $('#action-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const actions = [
      { id: 'move', icon: '🚶', label: 'Move', cost: '1/unit' },
      { id: 'battle', icon: '⚔️', label: 'Battle', cost: '1' },
      { id: 'build_gate', altId: 'buildGate', icon: '🏗️', label: 'Gate', cost: '3' },
      { id: 'recruit', icon: '👤', label: 'Recruit', cost: '1' },
      { id: 'summon', icon: '👹', label: 'Summon', cost: 'var' },
      { id: 'awaken', icon: '🐙', label: 'Awaken', cost: 'var' },
      { id: 'capture', icon: '🔗', label: 'Capture', cost: '1' },
      { id: 'pass', icon: '⏭️', label: 'Pass', cost: '0' },
    ];
    for (const action of actions) {
      const available = availableActions.includes(action.id) || (action.altId && availableActions.includes(action.altId));
      const btn = createElement('button', {
        class: `action-btn ${action.id === 'pass' ? 'pass-btn' : ''} ${!available ? 'disabled' : ''}`,
        disabled: !available,
        click: () => { 
          if (this._actionResolver) { 
            this._actionResolver(action.id); 
            this._actionResolver = null; 
          } 
        },
      }, [
        createElement('span', { class: 'action-icon' }, [action.icon]),
        createElement('span', { class: 'action-label' }, [action.label]),
        createElement('span', { class: 'action-cost mono' }, [action.cost]),
      ]);
      bar.appendChild(btn);
    }
  }

  // ========== PROMPT METHODS ==========
  
  async promptActionSelection(playerIndex, availableActions) {
    this.updateActionBar(playerIndex, availableActions);
    return new Promise(resolve => { this._actionResolver = resolve; });
  }

  async promptRegionSelection(validRegionIds, message) {
    this.showToast(`👉 ${message} (Click a highlighted green region)`, null);
    this.mapRenderer.clearHighlights();
    this.mapRenderer.highlightRegions(validRegionIds, 'valid-target');
    
    return new Promise(resolve => {
      let escHandler = null;
      
      const handler = (regionId) => {
        if (validRegionIds.includes(regionId)) {
          this.mapRenderer.clearHighlights();
          this.mapRenderer.offRegionClick(handler);
          if (escHandler) document.removeEventListener('keydown', escHandler);
          resolve(regionId);
        } else {
          this.showToast(`⚠️ Invalid selection! Please click a highlighted green region.`, null);
        }
      };
      
      escHandler = (e) => {
        if (e.key === 'Escape') {
          this.mapRenderer.clearHighlights();
          this.mapRenderer.offRegionClick(handler);
          document.removeEventListener('keydown', escHandler);
          resolve(null);
        }
      };
      
      document.addEventListener('keydown', escHandler);
      this.mapRenderer.onRegionClick(handler);
    });
  }

  async promptUnitSelection(units, message, maxSelect) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(units); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, [message]));
      
      const selected = new Set();
      const unitButtons = [];
      
      for (const unit of units) {
        const uType = unit.unitType || unit.type || 'unit';
        const btn = createElement('button', {
          class: 'unit-select-btn',
          click: () => {
            if (selected.has(unit.id)) {
              selected.delete(unit.id);
              removeClass(btn, 'selected');
            } else if (selected.size < maxSelect) {
              selected.add(unit.id);
              addClass(btn, 'selected');
            }
            confirmBtn.disabled = selected.size === 0;
          }
        }, [
          createElement('span', { class: 'unit-icon' }, [UNIT_ICONS[uType] || '?']),
          createElement('span', {}, [(unit.name || uType).replace(/_/g, ' ')]),
        ]);
        unitButtons.push(btn);
        container.appendChild(btn);
      }
      
      const selectAllBtn = createElement('button', { class: 'btn', click: () => {
        units.forEach(u => selected.add(u.id));
        unitButtons.forEach(b => addClass(b, 'selected'));
        confirmBtn.disabled = false;
      }}, ['Select All']);
      
      const confirmBtn = createElement('button', { class: 'btn start-btn', disabled: true, click: () => {
        removeClass(modal, 'active');
        resolve(units.filter(u => selected.has(u.id)));
      }}, ['Confirm']);
      
      const cancelBtn = createElement('button', { class: 'btn', click: () => {
        removeClass(modal, 'active');
        resolve(null);
      }}, ['Cancel']);
      
      const btnRow = createElement('div', { style: 'display:flex;gap:8px;margin-top:16px;justify-content:center' }, [selectAllBtn, confirmBtn, cancelBtn]);
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptConfirmation(message) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(true); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, [message]));
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center' });
      btnRow.appendChild(createElement('button', { class: 'btn start-btn', click: () => { removeClass(modal, 'active'); resolve(true); } }, ['Yes']));
      btnRow.appendChild(createElement('button', { class: 'btn', click: () => { removeClass(modal, 'active'); resolve(false); } }, ['No']));
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptChooseDirection() {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(1); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, ['Choose Turn Direction']));
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center' });
      btnRow.appendChild(createElement('button', { class: 'btn start-btn', click: () => { removeClass(modal, 'active'); resolve(1); } }, ['↻ Clockwise']));
      btnRow.appendChild(createElement('button', { class: 'btn', click: () => { removeClass(modal, 'active'); resolve(-1); } }, ['↺ Counter-Clockwise']));
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  async promptChoosePlayer(playerIndices, message) {
    return new Promise(resolve => {
      const modal = $('#selection-modal');
      if (!modal) { resolve(playerIndices[0]); return; }
      modal.innerHTML = '';
      addClass(modal, 'active');
      const container = createElement('div', { class: 'selection-container glass' });
      container.appendChild(createElement('h3', {}, [message]));
      const btnRow = createElement('div', { style: 'display:flex;gap:12px;margin-top:20px;justify-content:center;flex-wrap:wrap' });
      for (const pi of playerIndices) {
        const p = this.gameState.getPlayer(pi);
        const f = FACTIONS[p.factionId];
        btnRow.appendChild(createElement('button', { 
          class: 'btn', 
          style: `border-color:${f.color};color:${f.color}`,
          click: () => { removeClass(modal, 'active'); resolve(pi); } 
        }, [f.name]));
      }
      container.appendChild(btnRow);
      modal.appendChild(container);
    });
  }

  // ========== PHASE BANNER ==========
  async showPhaseBanner(phaseName) {
    const banner = $('#phase-banner');
    if (!banner) return;
    banner.textContent = phaseName;
    show(banner);
    banner.style.animation = 'none';
    banner.offsetHeight;
    banner.style.animation = 'fade-in 0.3s ease-out';
    await new Promise(r => setTimeout(r, 1200));
    banner.style.animation = 'fade-out 0.4s ease-in forwards';
    await new Promise(r => setTimeout(r, 400));
    hide(banner);
  }

  // ========== TOAST ==========
  showToast(message, factionId) {
    const existing = $('.toast');
    if (existing) existing.remove();
    const faction = factionId ? FACTIONS[factionId] : null;
    const toast = createElement('div', { class: 'toast' }, [message]);
    if (faction) toast.style.borderLeftColor = faction.color;
    document.body.appendChild(toast);
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      addClass(toast, 'fading');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ========== GAME LOG ==========
  addLogEntry(data) {
    const log = $('#game-log');
    if (!log) return;
    const entryMsg = typeof data === 'string' ? data : data.msg;
    const factionId = typeof data === 'string' ? null : data.factionId;
    const faction = factionId ? FACTIONS[factionId] : null;
    const entry = createElement('div', { class: 'log-entry' });
    if (faction) {
      entry.innerHTML = `<span class="log-faction" style="color:${faction.color}">${faction.name}:</span> ${entryMsg}`;
    } else {
      entry.textContent = entryMsg;
    }
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  // ========== COMBAT MODAL ==========
  async showCombatModal(battleResult) {
    const modal = $('#combat-modal');
    if (!modal) return;
    addClass(modal, 'active');
    
    const attackerFaction = FACTIONS[this.gameState.getPlayer(battleResult.attacker.playerIndex).factionId];
    const defenderFaction = FACTIONS[this.gameState.getPlayer(battleResult.defender.playerIndex).factionId];
    const region = MAP_REGIONS[battleResult.regionId];
    
    modal.innerHTML = `
      <div class="combat-container glass">
        <div class="combat-header">⚔️ Battle in ${region ? region.name : battleResult.regionId} ⚔️</div>
        <div class="combat-sides">
          <div class="combat-side attacker" style="border-top:3px solid ${attackerFaction.color}">
            <h4 style="color:${attackerFaction.color}">${attackerFaction.name} (Attacker)</h4>
            <div class="combat-units">${battleResult.attacker.units.map(u => UNIT_ICONS[u.unitType] || '👤').join(' ')}</div>
            <div class="combat-dice-count mono">${battleResult.attacker.dice} dice</div>
            <div id="attacker-dice" class="dice-area">
              ${battleResult.attacker.rolls.map(r => `<span class="die ${r === 6 ? 'kill' : r >= 4 ? 'pain' : 'miss'}">${r}</span>`).join('')}
            </div>
          </div>
          <div class="vs-divider" style="display:flex;align-items:center;font-size:2rem;opacity:0.3">VS</div>
          <div class="combat-side defender" style="border-top:3px solid ${defenderFaction.color}">
            <h4 style="color:${defenderFaction.color}">${defenderFaction.name} (Defender)</h4>
            <div class="combat-units">${battleResult.defender.units.map(u => UNIT_ICONS[u.unitType] || '👤').join(' ')}</div>
            <div class="combat-dice-count mono">${battleResult.defender.dice} dice</div>
            <div id="defender-dice" class="dice-area">
              ${battleResult.defender.rolls.map(r => `<span class="die ${r === 6 ? 'kill' : r >= 4 ? 'pain' : 'miss'}">${r}</span>`).join('')}
            </div>
          </div>
        </div>
        <div id="combat-results" class="combat-results" style="margin-top:16px;text-align:center">
          <div><span style="color:${attackerFaction.color}">${attackerFaction.name}</span> inflicts: <strong>${battleResult.attackerKills} Kills</strong>, <strong>${battleResult.attackerPains} Pains</strong></div>
          <div><span style="color:${defenderFaction.color}">${defenderFaction.name}</span> inflicts: <strong>${battleResult.defenderKills} Kills</strong>, <strong>${battleResult.defenderPains} Pains</strong></div>
        </div>
        <div style="text-align:center;margin-top:16px">
          <button id="combat-continue" class="btn start-btn">Continue</button>
        </div>
      </div>
    `;
    
    const continueBtn = document.getElementById('combat-continue');
    await new Promise(resolve => { continueBtn.onclick = () => { removeClass(modal, 'active'); resolve(); }; });
  }

  // ========== END SCREEN ==========
  showEndScreen(results) {
    const screen = $('#end-screen');
    if (!screen) return;
    addClass(screen, 'active');
    const winner = results.find(r => r.winner);
    const winnerFaction = winner ? FACTIONS[winner.factionId] : null;
    
    let scoresHTML = results.map(r => {
      const f = FACTIONS[r.factionId];
      return `<div class="score-row ${r.winner ? 'winner' : ''}" style="${r.winner ? `background:${f.color}15` : ''}">
        <span style="color:${f.color}">${f.name}</span>
        <span class="mono">${r.visibleDoom} + ${r.elderSignTotal} = ${r.finalDoom}${!r.eligible ? ' (DISQUALIFIED)' : ''}</span>
      </div>`;
    }).join('');
    
    screen.innerHTML = `
      <div class="end-container glass">
        <div class="winner-title" style="color:${winnerFaction?.color || '#fff'}">
          ${winnerFaction ? `${UNIT_ICONS[winnerFaction.greatOldOne?.id || 'great_cthulhu'] || '🏆'} ${winnerFaction.name} Wins! ${UNIT_ICONS[winnerFaction.greatOldOne?.id || 'great_cthulhu'] || '🏆'}` : 'No Winner!'}
        </div>
        <div class="final-scores">
          <div class="score-header" style="display:flex;justify-content:space-between;padding:8px;opacity:0.5;font-size:0.8rem">
            <span>Faction</span><span>Doom + Elder Signs = Total</span>
          </div>
          ${scoresHTML}
        </div>
        <button class="btn play-again-btn start-btn" onclick="location.reload()">Play Again</button>
      </div>
    `;
  }

  // ========== RULEBOOK MODAL ==========
  showRulebookModal() {
    const modal = $('#rulebook-modal');
    if (!modal) return;
    addClass(modal, 'active');
    modal.style.display = 'grid';
    modal.innerHTML = `
      <div class="rulebook-container glass">
        <div class="rulebook-header">
          <h2>📜 Cthulhu Wars — Rules & Strategy Guide</h2>
          <button class="rulebook-close" id="close-rulebook">&times;</button>
        </div>
        <div class="rulebook-body">
          <section class="rule-section">
            <h3>🏆 Objective & Winning</h3>
            <p>To win Cthulhu Wars, you must reach <strong>30 Doom Points</strong> AND unlock <strong>ALL 6 Spellbooks</strong>. If you reach 30 Doom without 6 spellbooks, you cannot win until your 6th spellbook is unlocked.</p>
          </section>
          <section class="rule-section">
            <h3>⚡ Turn Phases</h3>
            <ul>
              <li><strong>1. Gather Power:</strong> Gain Power for Cultists (1), Gates (2), Abandoned Gates (1). Half-Power Catch-up rule applies.</li>
              <li><strong>2. First Player:</strong> Player with highest Power chooses turn direction.</li>
              <li><strong>3. Action Phase:</strong> Take turns spending Power to perform 1 Action at a time until all pass.</li>
              <li><strong>4. Doom Phase:</strong> Score +1 Doom per Gate, perform Ritual of Annihilation, draw Elder Signs.</li>
            </ul>
          </section>
          <section class="rule-section">
            <h3>🎮 Actions & Costs</h3>
            <ul>
              <li><strong>MOVE (1 Power / unit):</strong> Move units from a region to an adjacent region.</li>
              <li><strong>BUILD GATE (3 Power):</strong> Build an Eldritch Gate where you have a Cultist & no gate.</li>
              <li><strong>RECRUIT (1 Power):</strong> Recruit a Cultist at any controlled Gate.</li>
              <li><strong>SUMMON (1-3 Power):</strong> Summon Monsters at a controlled Gate.</li>
              <li><strong>AWAKEN (10 Power):</strong> Awaken your Great Old One (Cthulhu, Nyarlathotep, Hastur, Shub).</li>
              <li><strong>CAPTURE (1 Power):</strong> Capture an undefended enemy Cultist in a region where you have a Monster/GOO.</li>
              <li><strong>BATTLE (1 Power):</strong> Roll combat dice against enemies in the same territory.</li>
              <li><strong>PASS (0 Power):</strong> Pass turn for the rest of the Action Phase.</li>
            </ul>
          </section>
        </div>
      </div>
    `;
    const closeBtn = $('#close-rulebook');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.style.display = 'none';
        removeClass(modal, 'active');
      };
    }
  }

  // ========== FULL UI REFRESH ==========
  updateUI() {
    this.updateHeader();
    this.updateFactionPanel();
    this.mapRenderer.updateAllRegions();
  }
}
