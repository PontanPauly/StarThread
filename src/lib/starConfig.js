const SHAPE_MIGRATION = {
  pulse: 'classic',
  spiral: 'nova',
  ring: 'crystal',
  cluster: 'nebula',
};

const GLOW_MIGRATION = {
  flame: 'pulsing-aura',
  mist: 'soft-halo',
};

function migrateShape(shape) {
  return SHAPE_MIGRATION[shape] || shape;
}

function migrateGlow(glow) {
  return GLOW_MIGRATION[glow] || glow;
}

export const CORE_SHAPES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Balanced radiance — visible surface with moderate corona',
    flareCount: 5,
    flareLength: 0.15,
    haloEmphasis: 1.0,
    coronaScale: 1.0,
    coreCompactness: 1.0,
    surfaceTurbulence: 1.0,
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    description: 'Explosive burst — roiling surface, fiery corona, intense hot spots',
    flareCount: 8,
    flareLength: 0.2,
    haloEmphasis: 0.8,
    coronaScale: 1.3,
    coreCompactness: 1.0,
    surfaceTurbulence: 1.8,
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal',
    description: 'Precise gem — smooth tight core, hard edge, minimal atmosphere',
    flareCount: 4,
    flareLength: 0.05,
    haloEmphasis: 0.6,
    coronaScale: 0.5,
    coreCompactness: 1.0,
    surfaceTurbulence: 0.15,
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    description: 'Dreamy cloud — soft diffuse core, massive fiery atmosphere',
    flareCount: 2,
    flareLength: 0.06,
    haloEmphasis: 1.4,
    coronaScale: 1.3,
    coreCompactness: 1.0,
    surfaceTurbulence: 0.6,
  },
};

export const COLOR_PALETTES = {
  celestial: {
    id: 'celestial',
    name: 'Celestial Blue',
    primary: '#60A5FA',
    secondary: '#1E40AF',
    glow: '#BFDBFE',
    center: [200,225,255],
    body: [150,200,255],
    edge: [60,140,255],
    glowRgb: [30,100,220],
    deep: [15,50,140],
  },
  solar: {
    id: 'solar',
    name: 'Solar Gold',
    primary: '#FBBF24',
    secondary: '#B45309',
    glow: '#FEF3C7',
    center: [255,250,200],
    body: [255,235,140],
    edge: [255,200,50],
    glowRgb: [220,160,20],
    deep: [140,90,10],
  },
  ember: {
    id: 'ember',
    name: 'Ember Orange',
    primary: '#FB923C',
    secondary: '#9A3412',
    glow: '#FED7AA',
    center: [255,240,200],
    body: [255,200,120],
    edge: [255,140,40],
    glowRgb: [220,100,15],
    deep: [140,55,8],
  },
  rose: {
    id: 'rose',
    name: 'Rose Pink',
    primary: '#F472B6',
    secondary: '#9D174D',
    glow: '#FCE7F3',
    center: [255,220,235],
    body: [255,170,210],
    edge: [255,100,170],
    glowRgb: [200,50,120],
    deep: [120,25,65],
  },
  violet: {
    id: 'violet',
    name: 'Violet Dream',
    primary: '#A78BFA',
    secondary: '#5B21B6',
    glow: '#DDD6FE',
    center: [230,220,255],
    body: [190,160,255],
    edge: [130,80,240],
    glowRgb: [80,40,180],
    deep: [40,20,100],
  },
  mint: {
    id: 'mint',
    name: 'Mint Green',
    primary: '#34D399',
    secondary: '#065F46',
    glow: '#A7F3D0',
    center: [233,255,114],
    body: [220,255,110],
    edge: [140,255,35],
    glowRgb: [100,210,15],
    deep: [60,140,8],
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic White',
    primary: '#E2E8F0',
    secondary: '#7DD3FC',
    glow: '#F8FAFC',
    center: [245,250,255],
    body: [220,235,255],
    edge: [160,200,250],
    glowRgb: [110,160,220],
    deep: [50,80,130],
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby Red',
    primary: '#F87171',
    secondary: '#7F1D1D',
    glow: '#FECACA',
    center: [255,230,220],
    body: [255,160,140],
    edge: [255,80,65],
    glowRgb: [200,40,30],
    deep: [120,20,15],
  },
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    primary: '#FBBF77',
    secondary: '#78350F',
    glow: '#FEF3C7',
    center: [255,248,210],
    body: [255,220,150],
    edge: [255,180,70],
    glowRgb: [200,130,25],
    deep: [120,70,10],
  },
  teal: {
    id: 'teal',
    name: 'Ocean Teal',
    primary: '#2DD4BF',
    secondary: '#134E4A',
    glow: '#99F6E4',
    center: [210,255,245],
    body: [120,240,220],
    edge: [40,200,175],
    glowRgb: [15,150,130],
    deep: [8,80,70],
  },
  indigo: {
    id: 'indigo',
    name: 'Deep Indigo',
    primary: '#818CF8',
    secondary: '#312E81',
    glow: '#C7D2FE',
    center: [220,225,255],
    body: [150,160,255],
    edge: [80,90,230],
    glowRgb: [40,50,180],
    deep: [20,25,100],
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Blend',
    primary: '#F97316',
    secondary: '#991B1B',
    glow: '#FFEDD5',
    center: [255,240,210],
    body: [255,180,100],
    edge: [255,110,30],
    glowRgb: [200,60,15],
    deep: [130,30,10],
  },
};

export const GLOW_STYLES = {
  'soft-halo': {
    id: 'soft-halo',
    name: 'Soft Halo',
    intensity: 0.6,
    radius: 2.5,
    falloff: 'smooth',
    pulsing: false,
  },
  'sharp-rays': {
    id: 'sharp-rays',
    name: 'Sharp Rays',
    intensity: 0.8,
    radius: 2.5,
    falloff: 'linear',
    pulsing: false,
  },
  'pulsing-aura': {
    id: 'pulsing-aura',
    name: 'Pulsing Aura',
    intensity: 0.7,
    radius: 2.5,
    falloff: 'smooth',
    pulsing: true,
  },
  sparkle: {
    id: 'sparkle',
    name: 'Sparkle',
    intensity: 0.9,
    radius: 2.5,
    falloff: 'sharp',
    pulsing: true,
  },
};

export const ANIMATION_PATTERNS = {
  steady: {
    id: 'steady',
    name: 'Steady',
    speed: 0,
    amplitude: 0,
    type: 'none',
  },
  'gentle-pulse': {
    id: 'gentle-pulse',
    name: 'Gentle Pulse',
    speed: 0.5,
    amplitude: 0.15,
    type: 'pulse',
  },
  twinkle: {
    id: 'twinkle',
    name: 'Twinkle',
    speed: 1.2,
    amplitude: 0.3,
    type: 'twinkle',
  },
  breathing: {
    id: 'breathing',
    name: 'Breathing',
    speed: 0.3,
    amplitude: 0.2,
    type: 'breath',
  },
  dancing: {
    id: 'dancing',
    name: 'Dancing',
    speed: 0.8,
    amplitude: 0.25,
    type: 'dance',
  },
};

export const SIZE_MODIFIERS = {
  compact: {
    id: 'compact',
    name: 'Compact',
    scale: 0.7,
    glowScale: 0.8,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    scale: 1.0,
    glowScale: 1.0,
  },
  grand: {
    id: 'grand',
    name: 'Grand',
    scale: 1.4,
    glowScale: 1.3,
  },
};

export const DEFAULT_STAR_PROFILE = {
  shape: 'classic',
  colorPalette: 'celestial',
  glowStyle: 'soft-halo',
  animation: 'gentle-pulse',
  size: 'standard',
  brightness: 0.8,
  customColor: null,
};

const seededRandom = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

const pickRandom = (obj, seed) => {
  const keys = Object.keys(obj);
  const index = Math.floor(seededRandom(seed) * keys.length);
  return keys[index];
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 200, g: 200, b: 200 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => {
    const hex = Math.round(Math.max(0, Math.min(255, v))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function computeHaloColor(primaryColor) {
  const rgb = hexToRgb(primaryColor);
  const warmth = (rgb.r * 2 + rgb.g - rgb.b) / (255 * 3);

  if (warmth > 0.4) {
    const r = rgb.r * 0.5 + 100;
    const g = rgb.g * 0.4 + 140;
    const b = rgb.b * 0.3 + 200;
    return rgbToHex(r, g, b);
  }

  const r = rgb.r * 0.6 + 120;
  const g = rgb.g * 0.5 + 130;
  const b = rgb.b * 0.4 + 160;
  return rgbToHex(r, g, b);
}

export function getStarVisuals(starProfile, personId = 'default') {
  const profile = { ...DEFAULT_STAR_PROFILE, ...starProfile };

  const migratedShape = migrateShape(profile.shape);
  const migratedGlow = migrateGlow(profile.glowStyle);

  const shape = CORE_SHAPES[migratedShape] || CORE_SHAPES.classic;
  const palette = COLOR_PALETTES[profile.colorPalette] || COLOR_PALETTES.celestial;
  const glow = GLOW_STYLES[migratedGlow] || GLOW_STYLES['soft-halo'];
  const animation = ANIMATION_PATTERNS[profile.animation] || ANIMATION_PATTERNS['gentle-pulse'];
  const sizeModifier = SIZE_MODIFIERS.standard;

  const isCustom = !!profile.customColor;
  const colors = isCustom ? {
    primary: profile.customColor,
    secondary: profile.customColor,
    glow: profile.customColor,
  } : palette;

  const seed = personId;
  const uniqueOffset = seededRandom(seed);
  const animationDelay = uniqueOffset * 5;

  const brightnessJitter = (seededRandom(seed + '-bjitter') - 0.5) * 0.24;
  const finalBrightness = Math.max(0.5, Math.min(1.0, profile.brightness + brightnessJitter));

  const haloColor = computeHaloColor(colors.primary);

  const rgb255to01 = (arr) => arr ? [arr[0]/255, arr[1]/255, arr[2]/255] : null;

  let zones;
  if (isCustom) {
    const c = hexToRgb(profile.customColor);
    const base = [c.r, c.g, c.b];
    zones = {
      center: [Math.min(255, c.r*0.9+50), Math.min(255, c.g*0.9+50), Math.min(255, c.b*0.9+50)],
      body: base,
      edge: [c.r*0.7, c.g*0.7, c.b*0.7],
      glowRgb: [c.r*0.5, c.g*0.5, c.b*0.5],
      deep: [c.r*0.3, c.g*0.3, c.b*0.3],
    };
  } else {
    zones = {
      center: palette.center || [255,255,255],
      body: palette.body || [200,200,200],
      edge: palette.edge || [150,150,150],
      glowRgb: palette.glowRgb || [100,100,100],
      deep: palette.deep || [50,50,50],
    };
  }

  return {
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      glow: colors.glow,
      halo: haloColor,
      center: rgb255to01(zones.center),
      body: rgb255to01(zones.body),
      edge: rgb255to01(zones.edge),
      glowZone: rgb255to01(zones.glowRgb),
      deep: rgb255to01(zones.deep),
    },
    scale: sizeModifier.scale,
    brightness: finalBrightness,
    flareCount: shape.flareCount,
    flareLength: shape.flareLength,
    haloEmphasis: shape.haloEmphasis,
    coronaScale: shape.coronaScale ?? 1.0,
    coreCompactness: shape.coreCompactness ?? 1.0,
    surfaceTurbulence: shape.surfaceTurbulence ?? 1.0,
    uniqueOffset,
    glow: {
      intensity: glow.intensity * (0.4 + finalBrightness * 0.6),
      radius: glow.radius * sizeModifier.glowScale,
      falloff: glow.falloff,
      pulsing: glow.pulsing,
    },
    animation: {
      ...animation,
      delay: animationDelay,
    },
    shape: {
      ...shape,
      rotationOffset: uniqueOffset * Math.PI * 2,
    },
  };
}

export function generateRandomStarProfile(personId = null) {
  const seed = personId || `${Date.now()}-${Math.random()}`;

  return {
    shape: pickRandom(CORE_SHAPES, seed + '-shape'),
    colorPalette: pickRandom(COLOR_PALETTES, seed + '-color'),
    glowStyle: pickRandom(GLOW_STYLES, seed + '-glow'),
    animation: pickRandom(ANIMATION_PATTERNS, seed + '-anim'),
    size: 'standard',
    brightness: 0.6 + seededRandom(seed + '-bright') * 0.4,
    customColor: null,
  };
}

export function getAncestorStarProfile(personId) {
  return {
    shape: 'nova',
    colorPalette: 'amber',
    glowStyle: 'soft-halo',
    animation: 'breathing',
    size: 'standard',
    brightness: 0.7,
    customColor: null,
  };
}

export function getChildStarProfile(personId) {
  const seed = personId || `child-${Date.now()}`;
  return {
    shape: pickRandom({ classic: 1, crystal: 1, nebula: 1 }, seed),
    colorPalette: pickRandom({ mint: 1, rose: 1, celestial: 1, violet: 1 }, seed),
    glowStyle: 'sparkle',
    animation: 'twinkle',
    size: 'standard',
    brightness: 0.9,
    customColor: null,
  };
}
