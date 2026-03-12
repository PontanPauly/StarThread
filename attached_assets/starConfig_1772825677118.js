export const CORE_SHAPES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional radiant star',
    geometry: 'sphere',
    pointCount: 4,
    pointSharpness: 0.5,
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    description: 'Explosive burst of light',
    geometry: 'sphere',
    pointCount: 8,
    pointSharpness: 0.8,
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    description: 'Cloudy gas effect',
    geometry: 'cloud',
    pointCount: 0,
    pointSharpness: 0,
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal',
    description: 'Crystalline faceted gem',
    geometry: 'icosahedron',
    pointCount: 6,
    pointSharpness: 0.9,
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    description: 'Rhythmic pulsing orb',
    geometry: 'sphere',
    pointCount: 0,
    pointSharpness: 0,
  },
  spiral: {
    id: 'spiral',
    name: 'Spiral',
    description: 'Rotating spiral arms',
    geometry: 'spiral',
    pointCount: 2,
    pointSharpness: 0.3,
  },
  ring: {
    id: 'ring',
    name: 'Ring',
    description: 'Saturn-like rings',
    geometry: 'ring',
    pointCount: 0,
    pointSharpness: 0,
  },
  cluster: {
    id: 'cluster',
    name: 'Cluster',
    description: 'Multiple small stars',
    geometry: 'cluster',
    pointCount: 5,
    pointSharpness: 0.4,
  },
};

export const COLOR_PALETTES = {
  celestial: {
    id: 'celestial',
    name: 'Celestial Blue',
    primary: '#60A5FA',
    secondary: '#1E40AF',
    glow: '#BFDBFE',
  },
  solar: {
    id: 'solar',
    name: 'Solar Gold',
    primary: '#FBBF24',
    secondary: '#B45309',
    glow: '#FEF3C7',
  },
  ember: {
    id: 'ember',
    name: 'Ember Orange',
    primary: '#FB923C',
    secondary: '#9A3412',
    glow: '#FED7AA',
  },
  rose: {
    id: 'rose',
    name: 'Rose Pink',
    primary: '#F472B6',
    secondary: '#9D174D',
    glow: '#FCE7F3',
  },
  violet: {
    id: 'violet',
    name: 'Violet Dream',
    primary: '#A78BFA',
    secondary: '#5B21B6',
    glow: '#DDD6FE',
  },
  mint: {
    id: 'mint',
    name: 'Mint Green',
    primary: '#34D399',
    secondary: '#065F46',
    glow: '#A7F3D0',
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic White',
    primary: '#E2E8F0',
    secondary: '#7DD3FC',
    glow: '#F8FAFC',
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby Red',
    primary: '#F87171',
    secondary: '#7F1D1D',
    glow: '#FECACA',
  },
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    primary: '#FBBF77',
    secondary: '#78350F',
    glow: '#FEF3C7',
  },
  teal: {
    id: 'teal',
    name: 'Ocean Teal',
    primary: '#2DD4BF',
    secondary: '#134E4A',
    glow: '#99F6E4',
  },
  indigo: {
    id: 'indigo',
    name: 'Deep Indigo',
    primary: '#818CF8',
    secondary: '#312E81',
    glow: '#C7D2FE',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Blend',
    primary: '#F97316',
    secondary: '#991B1B',
    glow: '#FFEDD5',
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
    intensity: 0.9,
    radius: 1.8,
    falloff: 'linear',
    pulsing: false,
  },
  'pulsing-aura': {
    id: 'pulsing-aura',
    name: 'Pulsing Aura',
    intensity: 0.7,
    radius: 3.0,
    falloff: 'smooth',
    pulsing: true,
  },
  flame: {
    id: 'flame',
    name: 'Flame',
    intensity: 0.85,
    radius: 2.2,
    falloff: 'exponential',
    pulsing: true,
  },
  mist: {
    id: 'mist',
    name: 'Ethereal Mist',
    intensity: 0.4,
    radius: 4.0,
    falloff: 'smooth',
    pulsing: false,
  },
  sparkle: {
    id: 'sparkle',
    name: 'Sparkle',
    intensity: 1.0,
    radius: 1.5,
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

export function getStarVisuals(starProfile, personId = 'default') {
  const profile = { ...DEFAULT_STAR_PROFILE, ...starProfile };
  
  const shape = CORE_SHAPES[profile.shape] || CORE_SHAPES.classic;
  const palette = COLOR_PALETTES[profile.colorPalette] || COLOR_PALETTES.celestial;
  const glow = GLOW_STYLES[profile.glowStyle] || GLOW_STYLES['soft-halo'];
  const animation = ANIMATION_PATTERNS[profile.animation] || ANIMATION_PATTERNS['gentle-pulse'];
  const sizeModifier = SIZE_MODIFIERS[profile.size] || SIZE_MODIFIERS.standard;
  
  const colors = profile.customColor ? {
    primary: profile.customColor,
    secondary: profile.customColor,
    glow: profile.customColor,
  } : palette;
  
  const seed = personId;
  const uniqueOffset = seededRandom(seed);
  const animationDelay = uniqueOffset * 5;
  const rotationOffset = uniqueOffset * Math.PI * 2;
  
  return {
    shape: {
      ...shape,
      rotationOffset,
    },
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      glow: colors.glow,
    },
    glow: {
      intensity: glow.intensity * (0.4 + profile.brightness * 0.6),
      radius: glow.radius * sizeModifier.glowScale,
      falloff: glow.falloff,
      pulsing: glow.pulsing,
    },
    animation: {
      ...animation,
      delay: animationDelay,
    },
    scale: sizeModifier.scale,
    brightness: profile.brightness,
    uniqueOffset,
  };
}

export function generateRandomStarProfile(personId = null) {
  const seed = personId || `${Date.now()}-${Math.random()}`;
  
  return {
    shape: pickRandom(CORE_SHAPES, seed + '-shape'),
    colorPalette: pickRandom(COLOR_PALETTES, seed + '-color'),
    glowStyle: pickRandom(GLOW_STYLES, seed + '-glow'),
    animation: pickRandom(ANIMATION_PATTERNS, seed + '-anim'),
    size: pickRandom(SIZE_MODIFIERS, seed + '-size'),
    brightness: 0.6 + seededRandom(seed + '-bright') * 0.4,
    customColor: null,
  };
}

export function getAncestorStarProfile(personId) {
  return {
    shape: 'nova',
    colorPalette: 'amber',
    glowStyle: 'mist',
    animation: 'breathing',
    size: 'grand',
    brightness: 0.7,
    customColor: null,
  };
}

export function getChildStarProfile(personId) {
  const seed = personId || `child-${Date.now()}`;
  return {
    shape: pickRandom({ classic: 1, pulse: 1, cluster: 1 }, seed),
    colorPalette: pickRandom({ mint: 1, rose: 1, celestial: 1, violet: 1 }, seed),
    glowStyle: 'sparkle',
    animation: 'twinkle',
    size: 'compact',
    brightness: 0.9,
    customColor: null,
  };
}
