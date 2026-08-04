export const FACTIONS = {
  cthulhu: {
    id: 'cthulhu',
    name: 'Great Cthulhu',
    color: '#00c853',
    colorDark: '#00892e',
    colorLight: '#69f0ae',
    startRegion: 'south_pacific',
    description: 'Masters of the oceans.',
    units: {
      cultist: { id: 'cultist', name: 'Cultist', count: 6, combat: 0, cost: 1, type: 'cultist' },
      deep_one: { id: 'deep_one', name: 'Deep One', count: 4, combat: 1, cost: 1, type: 'monster' },
      shoggoth: { id: 'shoggoth', name: 'Shoggoth', count: 2, combat: 2, cost: 2, type: 'monster' },
      starspawn: { id: 'starspawn', name: 'Starspawn', count: 2, combat: 3, cost: 3, type: 'monster' }
    },
    greatOldOnes: {
      great_cthulhu: {
        id: 'great_cthulhu',
        name: 'Great Cthulhu',
        combat: 6,
        awakenCost: 10,
        reAwakenCost: 4,
        requirements: 'Controlled Gate in Ocean area'
      }
    },
    spellbooks: {
      absorb: {
        id: 'absorb',
        name: 'Absorb',
        type: 'pre_battle',
        unlock: 'Kill/Devour 1 unit',
        description: 'Eliminate own units with Shoggoth for +3 dice each'
      },
      devolve: {
        id: 'devolve',
        name: 'Devolve',
        type: 'ongoing',
        unlock: 'Control 3 Ocean Gates',
        description: 'Replace Cultists with Deep Ones'
      },
      dreams: {
        id: 'dreams',
        name: 'Dreams',
        type: 'action',
        cost: 3,
        unlock: 'First Doom Phase',
        description: 'Replace enemy Cultist with yours'
      },
      submerge: {
        id: 'submerge',
        name: 'Submerge',
        type: 'action',
        cost: '0/1',
        unlock: 'Awaken Cthulhu',
        description: 'Remove from Ocean, redeploy anywhere'
      },
      y_ha_nthlei: {
        id: 'y_ha_nthlei',
        name: 'Y\'ha-nthlei',
        type: 'ongoing',
        unlock: 'Kill/Devour 2 in one battle',
        description: '+1 Power per enemy Ocean Gate'
      },
      regeneration: {
        id: 'regeneration',
        name: 'Regeneration',
        type: 'post_battle',
        unlock: 'Have 5 Spellbooks',
        description: 'Starspawn absorbs 2 hits'
      }
    }
  },
  crawling_chaos: {
    id: 'crawling_chaos',
    name: 'Crawling Chaos',
    color: '#448aff',
    colorDark: '#1565c0',
    colorLight: '#82b1ff',
    startRegion: 'asia',
    description: 'The messenger of the Outer Gods.',
    units: {
      cultist: { id: 'cultist', name: 'Cultist', count: 6, combat: 0, cost: 1, type: 'cultist' },
      nightgaunt: { id: 'nightgaunt', name: 'Nightgaunt', count: 3, combat: 0, cost: 1, type: 'monster' },
      flying_polyp: { id: 'flying_polyp', name: 'Flying Polyp', count: 3, combat: 1, cost: 2, type: 'monster' },
      hunting_horror: { id: 'hunting_horror', name: 'Hunting Horror', count: 2, combat: 2, cost: 2, type: 'monster' }
    },
    greatOldOnes: {
      nyarlathotep: {
        id: 'nyarlathotep',
        name: 'Nyarlathotep',
        combat: 'dynamic_spellbooks',
        awakenCost: 10,
        requirements: 'Controlled Gate'
      }
    },
    spellbooks: {
      abduct: { 
        id: 'abduct', 
        name: 'Abduct', 
        type: 'pre_battle', 
        unlock: 'Capture a Cultist', 
        description: 'Nightgaunt eliminates itself and one enemy monster/cultist' 
      },
      emissary: { 
        id: 'emissary', 
        name: 'Emissary of the Outer Gods', 
        type: 'ongoing', 
        unlock: 'Awaken Nyarlathotep', 
        description: 'Gain 1 Power for each GOO in play' 
      },
      invisibility: { 
        id: 'invisibility', 
        name: 'Invisibility', 
        type: 'ongoing', 
        unlock: 'Nyarlathotep in battle', 
        description: 'Flying Polyps immune to first hit' 
      },
      madness: { 
        id: 'madness', 
        name: 'Madness', 
        type: 'post_battle', 
        unlock: 'Control a gate in enemy start area', 
        description: 'Assign routes for enemy retreats' 
      },
      seek_and_destroy: { 
        id: 'seek_and_destroy', 
        name: 'Seek and Destroy', 
        type: 'action', 
        unlock: 'Enemy GOO awakens', 
        description: 'Move Hunting Horrors to battle' 
      },
      thousand_forms: { 
        id: 'thousand_forms', 
        name: 'Thousand Forms', 
        type: 'action', 
        unlock: 'First Doom Phase', 
        description: 'Cost 0 action to summon Nyarlathotep forms' 
      }
    }
  },
  yellow_sign: {
    id: 'yellow_sign',
    name: 'Yellow Sign',
    color: '#ffd600',
    colorDark: '#c7a500',
    colorLight: '#ffff00',
    startRegion: 'europe',
    description: 'Have you seen the Yellow Sign?',
    units: {
      cultist: { id: 'cultist', name: 'Cultist', count: 6, combat: 0, cost: 1, type: 'cultist' },
      undead: { id: 'undead', name: 'Undead', count: 6, combat: 'dynamic_scaling', cost: 1, type: 'monster' },
      byakhee: { id: 'byakhee', name: 'Byakhee', count: 4, combat: 1, cost: 2, type: 'monster' }
    },
    greatOldOnes: {
      king_in_yellow: {
        id: 'king_in_yellow',
        name: 'King in Yellow',
        combat: 0,
        awakenCost: 4,
        requirements: 'Gate with no enemy GOO'
      },
      hastur: {
        id: 'hastur',
        name: 'Hastur',
        combat: 'dynamic_ritual_cost',
        awakenCost: 10,
        requirements: 'King in Yellow in play + Gate'
      }
    },
    spellbooks: {
      desecrate: { 
        id: 'desecrate', 
        name: 'Desecrate', 
        type: 'action', 
        unlock: 'Awaken King in Yellow', 
        description: 'Create Desecration token' 
      },
      screaming_dead: { 
        id: 'screaming_dead', 
        name: 'Screaming Dead', 
        type: 'ongoing', 
        unlock: 'Awaken Hastur', 
        description: 'Move King in Yellow with Undead' 
      },
      shriek: { 
        id: 'shriek', 
        name: 'Shriek of the Byakhee', 
        type: 'action', 
        unlock: 'Desecrate a region', 
        description: 'Move Byakhee anywhere' 
      },
      he_who_is_not_named: { 
        id: 'he_who_is_not_named', 
        name: 'He Who Is Not To Be Named', 
        type: 'ongoing', 
        unlock: 'First Doom Phase', 
        description: 'Hastur combats dynamically' 
      },
      passion: { 
        id: 'passion', 
        name: 'Passion', 
        type: 'ongoing', 
        unlock: 'Have 5 Spellbooks', 
        description: 'Gain Elder Signs for combat' 
      },
      zingaya: { 
        id: 'zingaya', 
        name: 'Zingaya', 
        type: 'action', 
        unlock: 'Kill/Devour 2 in one battle', 
        description: 'Convert enemy Cultist to Undead' 
      }
    }
  },
  black_goat: {
    id: 'black_goat',
    name: 'Black Goat',
    color: '#ff1744',
    colorDark: '#c4001d',
    colorLight: '#ff616f',
    startRegion: 'africa',
    description: 'The Woods of Shub-Niggurath.',
    units: {
      cultist: { id: 'cultist', name: 'Cultist', count: 6, combat: 0, cost: 1, type: 'cultist' },
      ghoul: { id: 'ghoul', name: 'Ghoul', count: 2, combat: 1, cost: 1, type: 'monster' },
      mi_go: { id: 'mi_go', name: 'Mi-Go', count: 3, combat: 1, cost: 2, type: 'monster' },
      dark_young: { id: 'dark_young', name: 'Dark Young', count: 3, combat: 2, cost: 3, type: 'monster' }
    },
    greatOldOnes: {
      shub_niggurath: {
        id: 'shub_niggurath',
        name: 'Shub-Niggurath',
        combat: 'dynamic_gates_cultists',
        awakenCost: 8,
        sacrificeCost: 2,
        requirements: 'Sacrifice 2 Cultists at Gate'
      }
    },
    spellbooks: {
      thousand_young_sb: { 
        id: 'thousand_young_sb', 
        name: 'Thousand Young', 
        type: 'ongoing', 
        unlock: 'Awaken Shub-Niggurath', 
        description: 'Dark Young act as Gates' 
      },
      frenzy: { 
        id: 'frenzy', 
        name: 'Frenzy', 
        type: 'ongoing', 
        unlock: 'Control 4 Gates', 
        description: 'Cultists get 1 combat die' 
      },
      red_sign: { 
        id: 'red_sign', 
        name: 'Red Sign', 
        type: 'ongoing', 
        unlock: 'First Doom Phase', 
        description: 'Dark Young protect Cultists' 
      },
      necrophagy: { 
        id: 'necrophagy', 
        name: 'Necrophagy', 
        type: 'post_battle', 
        unlock: 'Share region with enemy', 
        description: 'Ghouls can move and inflict hits' 
      },
      sacrifice_sb: { 
        id: 'sacrifice_sb', 
        name: 'Sacrifice', 
        type: 'ongoing', 
        unlock: 'Kill/Devour 2 in one battle', 
        description: 'Sacrifice Cultists for Power' 
      },
      blood_sacrifice: { 
        id: 'blood_sacrifice', 
        name: 'Blood Sacrifice', 
        type: 'action', 
        unlock: 'Have 5 Spellbooks', 
        description: 'Sacrifice Cultists for Elder Signs' 
      }
    }
  }
};

export const MAP_REGIONS = {
  north_america: { id: 'north_america', name: 'North America', type: 'land', x: 20, y: 28, adj: ['south_america', 'north_pacific', 'north_atlantic', 'arctic_ocean'] },
  south_america: { id: 'south_america', name: 'South America', type: 'land', x: 28, y: 58, adj: ['north_america', 'south_pacific', 'south_atlantic', 'north_atlantic'] },
  europe: { id: 'europe', name: 'Europe', type: 'land', x: 50, y: 25, adj: ['asia', 'africa', 'north_atlantic', 'arctic_ocean'] },
  africa: { id: 'africa', name: 'Africa', type: 'land', x: 52, y: 52, adj: ['europe', 'asia', 'south_atlantic', 'indian_ocean', 'north_atlantic'] },
  asia: { id: 'asia', name: 'Asia', type: 'land', x: 72, y: 28, adj: ['europe', 'africa', 'north_pacific', 'indian_ocean', 'arctic_ocean'] },
  australia: { id: 'australia', name: 'Australia', type: 'land', x: 82, y: 65, adj: ['south_pacific', 'indian_ocean'] },
  antarctica: { id: 'antarctica', name: 'Antarctica', type: 'land', x: 50, y: 88, adj: ['south_pacific', 'south_atlantic', 'indian_ocean'] },
  north_pacific: { id: 'north_pacific', name: 'North Pacific', type: 'ocean', x: 8, y: 38, adj: ['north_america', 'asia', 'south_pacific', 'arctic_ocean'] },
  south_pacific: { id: 'south_pacific', name: 'South Pacific', type: 'ocean', x: 10, y: 68, adj: ['south_america', 'australia', 'antarctica', 'north_pacific', 'indian_ocean'] },
  north_atlantic: { id: 'north_atlantic', name: 'North Atlantic', type: 'ocean', x: 38, y: 35, adj: ['north_america', 'south_america', 'europe', 'africa', 'arctic_ocean', 'south_atlantic'] },
  south_atlantic: { id: 'south_atlantic', name: 'South Atlantic', type: 'ocean', x: 40, y: 65, adj: ['south_america', 'africa', 'antarctica', 'north_atlantic', 'indian_ocean'] },
  indian_ocean: { id: 'indian_ocean', name: 'Indian Ocean', type: 'ocean', x: 68, y: 58, adj: ['africa', 'asia', 'australia', 'antarctica', 'south_atlantic', 'south_pacific'] },
  arctic_ocean: { id: 'arctic_ocean', name: 'Arctic Ocean', type: 'ocean', x: 50, y: 8, adj: ['north_america', 'europe', 'asia', 'north_pacific', 'north_atlantic'] }
};

export const GAME_CONFIG = {
  STARTING_POWER: 8,
  STARTING_CULTISTS: 6,
  GATE_BUILD_COST: 3,
  RECRUIT_COST: 1,
  MOVE_COST_PER_UNIT: 1,
  BATTLE_COST: 1,
  CAPTURE_COST: 1,
  RITUAL_STARTING_COST: 5,
  DOOM_VICTORY_THRESHOLD: 30,
  POWER_PER_CULTIST: 1,
  POWER_PER_GATE: 2,
  POWER_PER_ABANDONED_GATE: 1,
  DOOM_PER_GATE: 1,
  MAX_ELDER_SIGN_VALUE: 3,
  ELDER_SIGN_POOL: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]
};

export const UNIT_ICONS = {
  cultist: '👤',
  deep_one: '🐟',
  shoggoth: '🫧',
  starspawn: '⭐',
  nightgaunt: '🦇',
  flying_polyp: '👁️',
  hunting_horror: '🐉',
  undead: '💀',
  byakhee: '🦅',
  ghoul: '🧟',
  mi_go: '🪲',
  dark_young: '🌳',
  great_cthulhu: '🐙',
  nyarlathotep: '🎭',
  king_in_yellow: '👑',
  hastur: '🌀',
  shub_niggurath: '🐐'
};

export const UNIT_IMAGES = {
  cultist: '/assets/units/cultist_art.jpg',
  great_cthulhu: '/assets/units/cthulhu_art.jpg',
  nyarlathotep: '/assets/units/nyarlathotep_art.jpg',
  hastur: '/assets/units/hastur_art.jpg',
  king_in_yellow: '/assets/units/hastur_art.jpg',
  shub_niggurath: '/assets/units/shub_art.jpg',
  deep_one: '/assets/units/cultist_art.jpg',
  starspawn: '/assets/units/cultist_art.jpg',
  shoggoth: '/assets/units/cultist_art.jpg',
  flying_polyp: '/assets/units/nyarlathotep_art.jpg',
  hunting_horror: '/assets/units/nyarlathotep_art.jpg',
  nightgaunt: '/assets/units/nyarlathotep_art.jpg',
  dark_young: '/assets/units/shub_art.jpg',
  ghoul: '/assets/units/shub_art.jpg',
  byakhee: '/assets/units/hastur_art.jpg',
  king_in_yellow_avatar: '/assets/units/hastur_art.jpg'
};

export const PHASE_NAMES = {
  SETUP: 'Setup',
  GATHER_POWER: 'Gather Power',
  FIRST_PLAYER: 'First Player',
  ACTION: 'Action Phase',
  DOOM: 'Doom Phase',
  GAME_OVER: 'Game Over'
};

