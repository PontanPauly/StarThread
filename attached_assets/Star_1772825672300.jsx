import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

// ============================================================================
// TEXTURE
// ============================================================================

const createGlowTexture = () => {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const center = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy) / center;
      const alpha = Math.max(0, 1 - dist * dist);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.floor(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

const glowTexture = createGlowTexture();

// ============================================================================
// SHARED GLSL NOISE + UTILITY LIBRARY
// ============================================================================

const noiseLib = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m*m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  float fbm(vec2 p, int oct) {
    float sum = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 7; i++) {
      if (i >= oct) break;
      sum += snoise(p * freq) * amp;
      freq *= 2.1;
      amp *= 0.48;
    }
    return sum;
  }
  
  float ridgedNoise(vec2 p) { return 1.0 - abs(snoise(p)); }
  
  float ridgedFbm(vec2 p, int oct) {
    float sum = 0.0, amp = 0.5, freq = 1.0;
    for (int i = 0; i < 5; i++) {
      if (i >= oct) break;
      sum += ridgedNoise(p * freq) * amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum;
  }
  
  // Organic edge — creates irregular, wispy boundaries
  float organicEdge(vec2 center, float baseRadius, float time, float uniqueOffset) {
    float angle = atan(center.y, center.x);
    float edgeNoise1 = snoise(vec2(angle * 2.5 + uniqueOffset * 10.0, time * 0.15)) * 0.04;
    float edgeNoise2 = snoise(vec2(angle * 5.0 - uniqueOffset * 5.0, time * 0.25)) * 0.03;
    float edgeNoise3 = snoise(vec2(angle * 9.0 + time * 0.08, uniqueOffset * 3.0)) * 0.015;
    float shapeWarp = snoise(vec2(angle * 1.5 + uniqueOffset * 8.0, 0.3)) * 0.03;
    float irregularRadius = baseRadius + edgeNoise1 + edgeNoise2 + edgeNoise3 + shapeWarp;
    return min(irregularRadius, 0.28);
  }
  
  // Universal edge fade — smooth falloff to zero at plane edges
  float universalEdgeFade(float dist) {
    float fade = 1.0 - smoothstep(0.25, 0.42, dist);
    return fade * fade;
  }
`;

// ============================================================================
// FRAGMENT SHADERS — NMS-style luminous cores with layered atmospheric depth
//
// Design principles:
//   - Gaussian falloffs (exp(-d^2*k)) for natural light distribution
//   - Pinpoint center (k=2500+) for overexposed HDR look
//   - Color gradient: white center -> primary color -> glow color at edges
//   - No hardcoded brightness shimmer — animation system handles modulation
// ============================================================================

// Style 1: Nebula — Turbulent multi-color clouds with bright stellar core
const nebulaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * 0.25 + uniqueOffset * 10.0;
    
    // Organic boundary with tendrils
    float edgeRadius = organicEdge(center, 0.28, t, uniqueOffset);
    
    float tendrils = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      float tendrilAngle = i * 0.785 + uniqueOffset * 6.28 + t * 0.05;
      float angleDiff = abs(mod(angle - tendrilAngle + 3.14159, 6.28318) - 3.14159);
      float tendrilWidth = 0.15 + snoise(vec2(i, uniqueOffset)) * 0.1;
      float tendril = exp(-angleDiff * angleDiff / (tendrilWidth * tendrilWidth));
      float tendrilLength = 0.35 + snoise(vec2(i * 2.0, t * 0.1)) * 0.15;
      tendril *= smoothstep(tendrilLength + 0.1, tendrilLength * 0.5, dist);
      tendrils += tendril * 0.3;
    }
    
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.1, edgeRadius + 0.15, dist);
    edgeFade = max(edgeFade, tendrils);
    if (edgeFade < 0.01) discard;
    
    vec2 wUv = center * (4.0 + styleVariant * 2.0);
    
    // Warping
    float warpX = fbm(wUv + t * 0.08, 5);
    float warpY = fbm(wUv + vec2(5.2, 1.3) + t * 0.1, 5);
    vec2 warped = wUv + vec2(warpX, warpY) * (0.4 + styleVariant * 0.4);
    float warpX2 = fbm(warped * 0.7 + t * 0.05, 3);
    float warpY2 = fbm(warped * 0.7 + vec2(3.1, 7.2) + t * 0.06, 3);
    warped += vec2(warpX2, warpY2) * 0.25;
    
    // Structure
    float largeStructure = fbm(warped * 0.4 + t * 0.03, 6);
    float medStructure = fbm(warped * 1.2 + t * 0.06, 5);
    float fineDetail = fbm(warped * 3.0 + t * 0.12, 4);
    float structure = largeStructure * 0.45 + medStructure * 0.35 + fineDetail * 0.2;
    structure = structure * 0.5 + 0.5;
    
    float filaments = ridgedFbm(warped * 1.5 + t * 0.08, 4);
    float filaments2 = ridgedFbm(warped * 2.5 - t * 0.06, 3);
    float filamentGlow = pow(filaments, 1.8) * 0.6 + pow(filaments2, 2.2) * 0.4;
    
    // NMS-style stellar core embedded in nebula
    float pinpoint = exp(-dist * dist * 2500.0);
    float hotCore = exp(-dist * dist * 350.0);
    float innerGlow = exp(-dist * dist * 50.0);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.96);
    vec3 hotYellow = vec3(1.0, 0.92, 0.6);
    vec3 hotPink = vec3(1.0, 0.45, 0.65);
    vec3 electricBlue = vec3(0.35, 0.55, 1.0);
    vec3 deepPurple = vec3(0.55, 0.2, 0.85);
    vec3 cyan = vec3(0.3, 0.85, 0.95);
    
    float zone1 = fbm(warped * 0.8 + t * 0.04, 4) * 0.5 + 0.5;
    float zone2 = fbm(warped * 1.0 + vec2(5.0, 9.0) + t * 0.05, 4) * 0.5 + 0.5;
    
    vec3 nebulaColor = primaryColor;
    nebulaColor = mix(nebulaColor, electricBlue, smoothstep(0.3, 0.65, zone1) * 0.55);
    nebulaColor = mix(nebulaColor, deepPurple, smoothstep(0.35, 0.75, zone2) * 0.5);
    nebulaColor = mix(nebulaColor, hotPink, filamentGlow * 0.4);
    nebulaColor = mix(nebulaColor, cyan, pow(filaments, 2.0) * 0.4);
    
    // Compose: stellar core sits above nebula
    vec3 finalColor = nebulaColor * (structure * 0.55 + filamentGlow * 0.9 + tendrils * 0.5);
    finalColor += hotWhite * pinpoint * 3.0;
    finalColor += hotYellow * hotCore * 1.5;
    finalColor += mix(primaryColor, hotWhite, 0.5) * innerGlow * 0.8;
    finalColor += hotWhite * pow(filaments, 3.5) * 0.35;
    finalColor += cyan * pow(filaments2, 3.0) * 0.25;
    finalColor *= brightness;
    
    float alpha = pinpoint + hotCore * 0.8 + innerGlow * 0.4;
    alpha += (structure * 0.4 + filamentGlow * 0.85 + tendrils * 0.6) * edgeFade;
    alpha *= universalEdgeFade(dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.6);
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 2: Classic — NMS-style radiant star with tight luminous core
const classicShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float rayCount;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time + uniqueOffset * 10.0;
    
    // === NMS-STYLE LAYERED CORE ===
    // Layer 1: Blazing pinpoint — near-white, very small, overexposed
    float pinpoint = exp(-dist * dist * 3000.0);
    
    // Layer 2: Hot core — tight bright region
    float hotCore = exp(-dist * dist * 400.0);
    
    // Layer 3: Inner corona — where primary color appears
    float innerCorona = exp(-dist * dist * 60.0);
    
    // Layer 4: Outer corona with noise variation
    float coronaNoise = snoise(vec2(angle * 3.0 + uniqueOffset * 5.0, t * 0.12)) * 0.025;
    float outerCorona = exp(-pow(dist / (0.18 + coronaNoise), 2.0));
    
    // Layer 5: Atmospheric envelope — very wide, faint
    float haloNoise = snoise(vec2(angle * 2.0, t * 0.08)) * 0.04;
    float atmosphere = exp(-pow(dist / (0.35 + haloNoise), 1.8));
    
    // Soft diffraction rays
    float rays = 0.0;
    float numRays = rayCount;
    for (float i = 0.0; i < 8.0; i++) {
      if (i >= numRays) break;
      float rayAngle = i * 6.28318 / numRays + uniqueOffset * 3.14159;
      float rayLengthVar = 0.6 + snoise(vec2(i, uniqueOffset * 10.0)) * 0.4;
      float angleDiff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
      float spikeIntensity = exp(-angleDiff * angleDiff * 30.0);
      spikeIntensity *= exp(-dist * (4.5 / rayLengthVar));
      spikeIntensity *= (0.85 + snoise(vec2(dist * 5.0, i + t * 0.15)) * 0.15);
      rays += spikeIntensity * 0.12;
    }
    
    // === COLOR COMPOSITION ===
    vec3 hotWhite = vec3(1.0, 0.99, 0.96);
    vec3 warmWhite = vec3(1.0, 0.95, 0.85);
    
    vec3 finalColor = vec3(0.0);
    finalColor += hotWhite * pinpoint * 3.5;
    finalColor += warmWhite * hotCore * 1.8;
    finalColor += mix(primaryColor, hotWhite, 0.45) * innerCorona * 1.0;
    finalColor += mix(primaryColor, glowColor, 0.3) * outerCorona * 0.5;
    finalColor += glowColor * 0.5 * atmosphere * 0.15;
    finalColor += mix(glowColor, hotWhite, 0.35) * rays;
    finalColor *= brightness;
    
    float alpha = pinpoint + hotCore * 0.9 + innerCorona * 0.5 + outerCorona * 0.25 + atmosphere * 0.06 + rays * 0.25;
    alpha *= universalEdgeFade(dist);
    alpha = clamp(alpha, 0.0, 1.0);
    
    if (alpha < 0.003) discard;
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 3: Plasma — Swirling energy with luminous core
const plasmaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * (0.7 + styleVariant * 0.4) + uniqueOffset * 10.0;
    
    // Organic boundary
    float edgeRadius = organicEdge(center, 0.28, t, uniqueOffset);
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.12, edgeRadius + 0.12, dist);
    if (edgeFade < 0.01) discard;
    
    // Plasma tendrils
    float plasmaTendrils = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
      float tAngle = i * 1.047 + t * 0.2 + uniqueOffset * 3.0;
      float tNoise = snoise(vec2(i, t * 0.1)) * 0.5;
      float angleDiff = abs(mod(angle - tAngle + 3.14159, 6.28318) - 3.14159);
      float tendril = exp(-angleDiff * angleDiff / 0.08);
      tendril *= smoothstep(0.5 + tNoise, 0.1, dist);
      plasmaTendrils += tendril * 0.25;
    }
    
    // Swirling plasma patterns
    float swirl1 = sin(angle * (3.0 + styleVariant * 2.0) + dist * 12.0 - t * 2.2);
    float swirl2 = sin(angle * (5.0 + styleVariant) - dist * 9.0 + t * 1.7);
    float swirl3 = sin(angle * 7.0 + dist * 6.0 - t * 0.9);
    float plasmaPattern = swirl1 * 0.4 + swirl2 * 0.35 + swirl3 * 0.25;
    plasmaPattern += fbm(vec2(angle * 6.0, dist * 12.0 + t), 5) * 0.5;
    
    // Electric arcs
    float arcs = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
      float arcAngle = i * 1.047 + t * (0.25 + i * 0.05) + uniqueOffset * 6.28;
      float arcDist = 0.12 + sin(t * 1.8 + i * 1.2) * 0.06;
      vec2 arcPos = vec2(cos(arcAngle), sin(arcAngle)) * arcDist;
      float arc = exp(-length(center - arcPos) * 35.0);
      arc *= 0.7 + 0.3 * sin(t * 6.0 + i * 3.0);
      arcs += arc;
    }
    
    // NMS-style core
    float pinpoint = exp(-dist * dist * 2500.0);
    float hotCore = exp(-dist * dist * 350.0);
    float corona = exp(-dist * dist * 40.0);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.98, 0.96);
    vec3 hotBlue = vec3(0.6, 0.85, 1.0);
    vec3 plasmaColor = mix(primaryColor, secondaryColor, plasmaPattern * 0.5 + 0.5);
    plasmaColor = mix(plasmaColor, hotBlue, arcs * 0.6);
    plasmaColor = mix(plasmaColor, glowColor, corona * 0.3);
    
    float intensity = (plasmaPattern * 0.25 + 0.75) * (1.0 - dist * 1.2);
    intensity += arcs * 0.7 + plasmaTendrils;
    
    vec3 finalColor = plasmaColor * intensity;
    finalColor += hotWhite * pinpoint * 3.5;
    finalColor += hotWhite * hotCore * 1.5;
    finalColor += mix(primaryColor, hotWhite, 0.4) * corona * 0.6;
    finalColor += hotWhite * arcs * 0.35;
    finalColor *= brightness;
    
    float alpha = pinpoint + hotCore * 0.8 + corona * 0.4;
    alpha += (intensity * 0.5 + plasmaTendrils * 0.5) * edgeFade;
    alpha *= universalEdgeFade(dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.65);
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 4: Crystal — Geometric facets with luminous gem core
const crystalShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * 0.4 + uniqueOffset * 10.0;
    
    // Organic outer glow
    float glowRadius = organicEdge(center, 0.32, t, uniqueOffset);
    float outerGlow = 1.0 - smoothstep(0.0, glowRadius, dist);
    outerGlow = pow(outerGlow, 2.5) * 0.4;
    
    // Crystal facets
    float facets = 6.0 + floor(styleVariant * 4.0);
    float facetAngle = mod(angle + t * 0.08, 6.28318 / facets);
    float facetCenter = 3.14159 / facets;
    float facetEdge = abs(facetAngle - facetCenter) / facetCenter;
    facetEdge = 1.0 - pow(facetEdge, 0.5);
    
    float innerAngle = mod(angle - t * 0.05, 6.28318 / (facets * 2.0));
    float innerEdge = abs(innerAngle - 3.14159 / (facets * 2.0));
    innerEdge = 1.0 - smoothstep(0.0, 0.25, innerEdge);
    
    float crystalRadius = 0.28 + snoise(vec2(angle * facets, uniqueOffset * 5.0)) * 0.03;
    float crystalBody = 1.0 - smoothstep(crystalRadius - 0.05, crystalRadius + 0.02, dist);
    
    // NMS-style gem core
    float pinpoint = exp(-dist * dist * 2000.0);
    float hotCore = exp(-dist * dist * 300.0);
    
    // Fire inside
    float fire = sin(angle * 8.0 + dist * 15.0 + t * 2.0) * 0.5 + 0.5;
    fire *= sin(angle * 5.0 - dist * 10.0 - t * 1.5) * 0.5 + 0.5;
    fire = pow(fire, 2.0) * crystalBody;
    
    // Sparkle flashes
    float sparkle = 0.0;
    for (float i = 0.0; i < 10.0; i++) {
      float sparkAngle = i * 0.628318 + t * 0.15 + uniqueOffset * 6.28;
      float sp = pow(max(cos(angle - sparkAngle), 0.0), 80.0);
      sp *= exp(-dist * 5.0);
      sp *= 0.4 + 0.6 * sin(t * 4.5 + i * 2.3);
      sparkle += sp;
    }
    
    // Iridescence
    float iridescence = sin(angle * 4.0 + dist * 12.0 + t * 0.8) * 0.5 + 0.5;
    vec3 iriColor = mix(primaryColor, secondaryColor, iridescence);
    
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 fireColor = vec3(1.0, 0.7, 0.4);
    
    vec3 gemColor = iriColor;
    gemColor += facetEdge * 0.2 * glowColor * crystalBody;
    gemColor += innerEdge * 0.15 * secondaryColor * crystalBody;
    gemColor = mix(gemColor, fireColor, fire * 0.5);
    gemColor += hotWhite * sparkle * 0.6;
    
    vec3 glowColor2 = mix(primaryColor, glowColor, 0.5);
    gemColor = mix(glowColor2, gemColor, crystalBody + 0.3);
    
    float gemIntensity = 0.5 + facetEdge * 0.25 + fire * 0.4 + sparkle * 0.4 + outerGlow;
    
    vec3 finalColor = gemColor * gemIntensity;
    finalColor += hotWhite * pinpoint * 3.5;
    finalColor += mix(primaryColor, hotWhite, 0.6) * hotCore * 1.4;
    finalColor *= brightness;
    
    float alpha = pinpoint + hotCore * 0.7 + 0.55 * crystalBody + facetEdge * 0.2 + sparkle * 0.3 + outerGlow;
    alpha *= universalEdgeFade(dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.7);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 5: Pulse — Rippling rings emanating from a luminous core
const pulseShader = `
  uniform vec3 primaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * (1.2 + styleVariant * 0.6) + uniqueOffset * 10.0;
    
    // Organic boundary
    float edgeRadius = organicEdge(center, 0.3, t, uniqueOffset);
    float edgeFade = 1.0 - smoothstep(edgeRadius - 0.15, edgeRadius + 0.15, dist);
    if (edgeFade < 0.01) discard;
    
    // NMS-style core
    float pulseFreq = 2.0 + styleVariant;
    float coreBreath = sin(t * pulseFreq) * 0.005;
    float pinpoint = exp(-dist * dist * 2500.0);
    float hotCore = exp(-dist * dist * 350.0);
    float innerGlow = exp(-pow(dist / (0.1 + coreBreath), 2.0));
    
    // Rippling rings with organic distortion
    float rings = 0.0;
    float ringCount = 4.0 + styleVariant * 2.0;
    for (float i = 0.0; i < 7.0; i++) {
      if (i >= ringCount) break;
      float ringPhase = t * 1.5 - i * 0.4;
      float ringRadius = fract(ringPhase * 0.25) * 0.45;
      float ringDistort = snoise(vec2(angle * 3.0 + i, t * 0.2)) * 0.03;
      float distortedDist = dist + ringDistort;
      float ringWidth = 0.012 + i * 0.002;
      float ring = 1.0 - smoothstep(0.0, ringWidth, abs(distortedDist - ringRadius));
      float ringFade = 1.0 - fract(ringPhase * 0.25) * 1.8;
      ring *= max(ringFade, 0.0);
      ring *= 0.7 + 0.3 * sin(t * 3.0 + i * 1.5);
      rings += ring;
    }
    
    // Outer halo
    float haloNoise = snoise(vec2(angle * 2.0, t * 0.1)) * 0.06;
    float halo = exp(-pow(dist / (0.35 + haloNoise), 2.5));
    halo *= 0.75 + 0.25 * sin(t * pulseFreq * 0.6);
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 ringColor = mix(glowColor, hotWhite, 0.35);
    
    vec3 finalColor = vec3(0.0);
    finalColor += hotWhite * pinpoint * 3.5;
    finalColor += mix(primaryColor, hotWhite, 0.5) * hotCore * 1.8;
    finalColor += primaryColor * innerGlow * 0.6;
    finalColor += mix(primaryColor, glowColor, 0.4) * halo * 0.3;
    finalColor += ringColor * rings * 0.85;
    finalColor *= brightness;
    
    float alpha = pinpoint + hotCore * 0.8 + innerGlow * 0.4 + halo * 0.15 + rings * 0.6;
    alpha *= edgeFade;
    alpha *= universalEdgeFade(dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.65);
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// Style 6: Nova — Explosive burst with chaotic rays from a blazing core
const novaShader = `
  uniform vec3 primaryColor;
  uniform vec3 secondaryColor;
  uniform vec3 glowColor;
  uniform float time;
  uniform float brightness;
  uniform float uniqueOffset;
  uniform float styleVariant;
  uniform float globalOpacity;
  varying vec2 vUv;
  
  ${noiseLib}
  
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  
  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);
    float t = time * 0.4 + uniqueOffset * 10.0;
    
    // Very organic, chaotic boundary
    float edgeRadius = organicEdge(center, 0.26, t, uniqueOffset);
    float chaos = snoise(vec2(angle * 5.0, t * 0.3)) * 0.08;
    chaos += snoise(vec2(angle * 11.0, t * 0.5)) * 0.04;
    edgeRadius += chaos;
    
    // NMS-style blazing core — nova should be the brightest
    float pinpoint = exp(-dist * dist * 4000.0);
    float hotCore = exp(-dist * dist * 500.0);
    float coreHalo = exp(-dist * dist * 80.0);
    
    // Explosive rays with varying lengths
    float rays = 0.0;
    float numRays = 12.0 + styleVariant * 12.0;
    for (float i = 0.0; i < 28.0; i++) {
      if (i >= numRays) break;
      float rayAngle = hash(i + uniqueOffset * 100.0) * 6.28318;
      float rayLength = 0.2 + hash(i * 2.0 + uniqueOffset * 50.0) * 0.25;
      float rayWidth = 0.008 + hash(i * 3.0) * 0.02;
      float rayBrightness = 0.4 + hash(i * 4.0) * 0.6;
      float rayNoise = snoise(vec2(dist * 8.0, i + t * 0.5)) * 0.4;
      
      float angleDiff = abs(mod(angle - rayAngle + 3.14159, 6.28318) - 3.14159);
      float rayIntensity = 1.0 - smoothstep(0.0, rayWidth * (1.0 + rayNoise), angleDiff);
      rayIntensity *= 1.0 - smoothstep(0.02, rayLength, dist);
      rayIntensity *= rayBrightness;
      rayIntensity *= 0.6 + 0.4 * sin(t * (1.5 + hash(i) * 2.5) + i * 1.2);
      rays += rayIntensity;
    }
    
    // Shockwave ring
    float shockPhase = fract(t * 0.25);
    float shockRadius = shockPhase * 0.5;
    float shockNoise = snoise(vec2(angle * 4.0, t)) * 0.02;
    float shock = 1.0 - smoothstep(0.0, 0.015, abs(dist - shockRadius + shockNoise));
    shock *= max(1.0 - shockPhase * 1.3, 0.0);
    
    // Debris particles
    float debris = 0.0;
    for (float i = 0.0; i < 18.0; i++) {
      float debrisAngle = hash(i + 0.5 + uniqueOffset) * 6.28318;
      float debrisDist = 0.06 + hash(i * 1.7) * 0.3;
      debrisDist *= 0.6 + 0.4 * sin(t * 1.5 + i * 0.8);
      vec2 debrisPos = vec2(cos(debrisAngle), sin(debrisAngle)) * debrisDist;
      float d = exp(-length(center - debrisPos) * 40.0);
      d *= 0.5 + 0.5 * sin(t * 4.0 + i * 2.5);
      debris += d;
    }
    
    // Nebula background
    float nebula = fbm(vec2(angle * 3.0, dist * 8.0 + t * 0.5), 4) * 0.5 + 0.5;
    nebula *= 1.0 - smoothstep(0.1, 0.45, dist);
    nebula = pow(nebula, 1.5) * 0.35;
    
    // Colors
    vec3 hotWhite = vec3(1.0, 0.99, 0.97);
    vec3 hotYellow = vec3(1.0, 0.92, 0.55);
    
    vec3 finalColor = vec3(0.0);
    finalColor += hotWhite * pinpoint * 4.0;
    finalColor += mix(hotWhite, hotYellow, 0.3) * hotCore * 2.0;
    finalColor += mix(primaryColor, hotWhite, 0.4) * coreHalo * 0.8;
    finalColor += mix(glowColor, hotYellow, 0.35) * rays * 0.85;
    finalColor += mix(secondaryColor, hotWhite, 0.4) * shock * 0.7;
    finalColor += hotWhite * debris * 0.45;
    finalColor += mix(primaryColor, secondaryColor, nebula) * nebula;
    finalColor *= brightness;
    
    float alpha = pinpoint + hotCore * 0.9 + coreHalo * 0.4;
    alpha += rays * 0.5 + shock * 0.45 + debris * 0.4 + nebula * 0.5;
    float novaEdgeFade = 1.0 - smoothstep(edgeRadius - 0.1, edgeRadius + 0.15, dist);
    novaEdgeFade = max(novaEdgeFade, rays * 0.7 + debris * 0.5);
    alpha *= novaEdgeFade;
    alpha *= universalEdgeFade(dist);
    alpha = pow(clamp(alpha, 0.0, 1.0), 0.6);
    
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(finalColor * globalOpacity, alpha * globalOpacity);
  }
`;

// ============================================================================
// VERTEX SHADER + MAPS
// ============================================================================

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STYLE_SHADERS = {
  nebula: nebulaShader,
  classic: classicShader,
  plasma: plasmaShader,
  crystal: crystalShader,
  pulse: pulseShader,
  nova: novaShader,
};

const SHAPE_TO_STYLE = {
  classic: 'classic',
  nova: 'nova',
  nebula: 'nebula',
  crystal: 'crystal',
  pulse: 'pulse',
  spiral: 'plasma',
  ring: 'pulse',
  cluster: 'nebula',
};

// ============================================================================
// ANIMATION SYSTEM — Computes per-frame brightness modulation on JS side
//
// Instead of just speeding up time, each mode changes the CHARACTER:
//   steady      — constant brightness, patterns barely evolve
//   gentle      — slow sinusoidal breathing
//   twinkle     — rapid stochastic scintillation (like atmospheric shimmer)
//   breathing   — deep slow breath
//   dancing     — dramatic pulsing with intensity bursts
// ============================================================================

const ANIM_TIME_SCALE = {
  'steady': 0.15,
  'gentle-pulse': 0.4,
  'twinkle': 0.8,
  'breathing': 0.35,
  'dancing': 1.5,
};

const ANIM_MODE = {
  'steady': 0,
  'gentle-pulse': 1,
  'twinkle': 2,
  'breathing': 3,
  'dancing': 4,
};

function computeAnimBrightness(elapsedTime, uniqueOffset, mode) {
  const t = elapsedTime + uniqueOffset * 100;
  switch (mode) {
    case 0: // steady
      return 1.0;
    case 1: { // gentle — subtle sinusoidal
      return 0.92 + 0.08 * Math.sin(t * 1.2);
    }
    case 2: { // twinkle — stochastic scintillation
      const n1 = Math.sin(t * 7.3 + uniqueOffset * 137.5);
      const n2 = Math.sin(t * 13.1 + uniqueOffset * 59.3);
      const n3 = Math.sin(t * 19.7 + uniqueOffset * 23.7);
      const n4 = Math.cos(t * 11.3 + uniqueOffset * 83.1);
      const n5 = Math.sin(t * 29.3 + uniqueOffset * 41.9);
      const flicker = (n1 * 0.25 + n2 * 0.2 + n3 * 0.2 + n4 * 0.2 + n5 * 0.15) * 0.5 + 0.5;
      return 0.55 + flicker * 0.55;
    }
    case 3: { // breathing — deep slow cycle
      const breath = Math.sin(t * 0.6) * 0.5 + 0.5;
      return 0.75 + breath * 0.3;
    }
    case 4: { // dancing — dramatic pulses with bursts
      const pulse = Math.sin(t * 2.5) * 0.2;
      const burst = Math.pow(Math.max(Math.sin(t * 1.3), 0), 4) * 0.35;
      return 0.8 + pulse + burst;
    }
    default:
      return 1.0;
  }
}

// ============================================================================
// STAR SPRITE — Main body with shape-specific fragment shader
// ============================================================================

function StarSprite({ colors, scale, brightness, uniqueOffset, shapeId, globalOpacity = 1, frozen = false, timeScale = 1, animMode = 1 }) {
  const meshRef = useRef(null);
  const timeRef = useRef(uniqueOffset * 100);
  const frozenTime = useMemo(() => uniqueOffset * 50, [uniqueOffset]);
  const baseBrightness = brightness;
  
  const styleKey = SHAPE_TO_STYLE[shapeId] || 'classic';
  const fragmentShader = STYLE_SHADERS[styleKey];
  
  const material = useMemo(() => {
    const styleVariant = (uniqueOffset * 5) % 1;
    const rayCount = 4 + Math.floor(uniqueOffset * 8);
    
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        primaryColor: { value: new THREE.Color(colors.primary) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: frozen ? frozenTime : 0 },
        brightness: { value: baseBrightness * 1.4 },
        uniqueOffset: { value: uniqueOffset },
        styleVariant: { value: styleVariant },
        rayCount: { value: rayCount },
        globalOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, baseBrightness, uniqueOffset, fragmentShader, frozen, frozenTime]);
  
  useFrame((state, delta) => {
    if (!frozen) {
      timeRef.current += delta * timeScale;
      material.uniforms.time.value = timeRef.current;
      // Animate brightness based on animation mode
      const animBright = computeAnimBrightness(state.clock.elapsedTime, uniqueOffset, animMode);
      material.uniforms.brightness.value = baseBrightness * 1.4 * animBright;
    }
    material.uniforms.globalOpacity.value = globalOpacity;
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spriteSize = 1.6 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[spriteSize, spriteSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ============================================================================
// OUTER GLOW — Multi-layer atmospheric glow, configurable by glowStyle
// ============================================================================

function OuterGlow({ colors, scale, intensity, uniqueOffset, globalOpacity = 1, frozen = false, timeScale = 1, animMode = 1, glowRadius = 1.0, glowFalloff = 2.5 }) {
  const meshRef = useRef(null);
  const timeRef = useRef(uniqueOffset * 100);
  const frozenTime = useMemo(() => uniqueOffset * 50, [uniqueOffset]);
  const baseIntensity = intensity;
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 secondaryColor;
        uniform float time;
        uniform float intensity;
        uniform float uniqueOffset;
        uniform float globalOpacity;
        uniform float falloffPow;
        varying vec2 vUv;
        
        ${noiseLib}
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);
          
          // Multi-layer glow with configurable falloff
          float innerGlow = exp(-pow(dist / 0.12, falloffPow));
          float midGlow = exp(-pow(dist / 0.22, falloffPow));
          float outerGlow = exp(-pow(dist / 0.38, falloffPow + 0.5));
          
          // Organic variation
          float edgeNoise = snoise(vec2(angle * 2.5 + uniqueOffset * 8.0, time * 0.1)) * 0.15 + 0.85;
          float glow = innerGlow * 0.45 + midGlow * 0.35 + outerGlow * 0.2;
          glow *= edgeNoise;
          
          // Color transitions
          vec3 innerColor = glowColor;
          vec3 midColor = mix(glowColor, secondaryColor, 0.4);
          vec3 outerColor = mix(secondaryColor * 0.7, vec3(0.15, 0.2, 0.35), 0.3);
          
          vec3 color = mix(innerColor, midColor, smoothstep(0.0, 0.2, dist));
          color = mix(color, outerColor, smoothstep(0.15, 0.4, dist));
          
          float alpha = glow * intensity * 0.55 * globalOpacity;
          alpha *= universalEdgeFade(dist);
          
          if (alpha < 0.003) discard;
          
          gl_FragColor = vec4(color * globalOpacity, alpha);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        time: { value: frozen ? frozenTime : 0 },
        intensity: { value: intensity },
        uniqueOffset: { value: uniqueOffset },
        globalOpacity: { value: 1.0 },
        falloffPow: { value: glowFalloff },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity, uniqueOffset, frozen, frozenTime, glowFalloff]);
  
  useFrame((state, delta) => {
    if (!frozen) {
      timeRef.current += delta * timeScale;
      material.uniforms.time.value = timeRef.current;
      // Glow breathes with animation
      const animBright = computeAnimBrightness(state.clock.elapsedTime, uniqueOffset, animMode);
      material.uniforms.intensity.value = baseIntensity * animBright;
    }
    material.uniforms.globalOpacity.value = globalOpacity;
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const glowSize = (3.0 + glowRadius * 0.5) * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[glowSize, glowSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ============================================================================
// ATMOSPHERIC HAZE — Very wide, faint glow bleeding into space
// ============================================================================

function AtmosphericHaze({ colors, scale, intensity, uniqueOffset, globalOpacity = 1, frozen = false, timeScale = 1 }) {
  const meshRef = useRef(null);
  const timeRef = useRef(uniqueOffset * 100);
  const frozenTime = useMemo(() => uniqueOffset * 50, [uniqueOffset]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 secondaryColor;
        uniform float time;
        uniform float intensity;
        uniform float uniqueOffset;
        uniform float globalOpacity;
        varying vec2 vUv;
        
        ${noiseLib}
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);
          
          float haze = exp(-pow(dist / 0.32, 1.8));
          
          float breath = 0.85 + 0.15 * sin(time * 0.5 + uniqueOffset * 3.0);
          
          float wisp1 = snoise(vec2(angle * 2.0 + time * 0.05, dist * 3.0)) * 0.2 + 0.8;
          float wisp2 = snoise(vec2(angle * 4.0 - time * 0.03, dist * 6.0 + uniqueOffset * 5.0)) * 0.15 + 0.85;
          haze *= wisp1 * wisp2;
          
          vec3 color = mix(glowColor, secondaryColor * 0.6, dist * 1.5);
          color = mix(color, vec3(0.2, 0.3, 0.5), smoothstep(0.2, 0.45, dist) * 0.3);
          
          float alpha = haze * intensity * breath * 0.25 * globalOpacity;
          alpha *= 1.0 - smoothstep(0.35, 0.5, dist);
          
          if (alpha < 0.002) discard;
          
          gl_FragColor = vec4(color * globalOpacity, alpha);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        secondaryColor: { value: new THREE.Color(colors.secondary) },
        time: { value: frozen ? frozenTime : 0 },
        intensity: { value: intensity },
        uniqueOffset: { value: uniqueOffset },
        globalOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity, uniqueOffset, frozen, frozenTime]);
  
  useFrame((state, delta) => {
    if (!frozen) {
      timeRef.current += delta * timeScale;
      material.uniforms.time.value = timeRef.current;
    }
    material.uniforms.globalOpacity.value = globalOpacity;
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const hazeSize = 5.0 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[hazeSize, hazeSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ============================================================================
// DIFFRACTION SPIKES — Subtle light rays from bright stars
// ============================================================================

function DiffractionSpikes({ colors, scale, intensity, uniqueOffset, globalOpacity = 1, frozen = false, timeScale = 1 }) {
  const meshRef = useRef(null);
  const timeRef = useRef(uniqueOffset * 100);
  const frozenTime = useMemo(() => uniqueOffset * 50, [uniqueOffset]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float time;
        uniform float intensity;
        uniform float uniqueOffset;
        uniform float globalOpacity;
        varying vec2 vUv;
        
        ${noiseLib}
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);
          
          // 4-point diffraction spike pattern
          float spike = 1.0 - smoothstep(0.0, 0.12, abs(sin(angle * 2.0 + uniqueOffset)));
          spike *= 1.0 - smoothstep(0.0, 0.12, abs(cos(angle * 2.0 + uniqueOffset)));
          float spikeFalloff = exp(-dist * 4.0);
          spike *= spikeFalloff;
          
          // Fainter 6-point secondary spikes
          float spike2 = 1.0 - smoothstep(0.0, 0.15, abs(sin(angle * 3.0 + uniqueOffset * 0.7)));
          spike2 *= exp(-dist * 5.0) * 0.4;
          spike += spike2;
          
          float shimmer = 0.9 + 0.1 * sin(time * 2.0 + dist * 10.0 + uniqueOffset * 8.0);
          spike *= shimmer;
          
          float breakup = snoise(vec2(angle * 8.0, dist * 4.0 + time * 0.1)) * 0.2 + 0.8;
          spike *= breakup;
          
          float alpha = spike * intensity * 0.35 * globalOpacity;
          alpha *= 1.0 - smoothstep(0.35, 0.5, dist);
          
          if (alpha < 0.003) discard;
          
          vec3 color = mix(glowColor, vec3(1.0), 0.3);
          
          gl_FragColor = vec4(color * globalOpacity, alpha);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: frozen ? frozenTime : 0 },
        intensity: { value: intensity },
        uniqueOffset: { value: uniqueOffset },
        globalOpacity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors, intensity, uniqueOffset, frozen, frozenTime]);
  
  useFrame((state, delta) => {
    if (!frozen) {
      timeRef.current += delta * timeScale;
      material.uniforms.time.value = timeRef.current;
    }
    material.uniforms.globalOpacity.value = globalOpacity;
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });
  
  const spikeSize = 4.0 * scale;
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[spikeSize, spikeSize, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ============================================================================
// STAR LABEL
// ============================================================================

function StarLabel({ name, isVisible }) {
  if (!isVisible || !name) return null;
  
  return (
    <Html
      position={[0, 0.5, 0]}
      center
      style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(59, 130, 246, 0.85))',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(8px)',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          letterSpacing: '0.5px',
          transform: 'translateY(-20px)',
        }}
      >
        {name}
      </div>
    </Html>
  );
}

// ============================================================================
// GLOW STYLE MAPS — translate glowStyle names into shader parameters
// ============================================================================

const GLOW_FALLOFF_MAP = {
  'soft-halo': 2.0,
  'sharp-rays': 3.5,
  'pulsing-aura': 2.0,
  'flame': 2.8,
  'mist': 1.5,
  'sparkle': 3.5,
};

const GLOW_RADIUS_MAP = {
  'soft-halo': 1.0,
  'sharp-rays': 0.6,
  'pulsing-aura': 1.3,
  'flame': 0.9,
  'mist': 1.6,
  'sparkle': 0.5,
};

// ============================================================================
// MAIN STAR COMPONENT
//
// Layer composition (inside -> out):
//   1. StarSprite        — shape-specific shader with NMS core (1.6x scale)
//   2. OuterGlow         — atmospheric color glow (3.0-3.5x scale)
//   3. AtmosphericHaze   — ALWAYS visible, faint wide glow (5.0x scale)
//   4. DiffractionSpikes — visible for bright stars + hover (4.0x scale)
// ============================================================================

export default function Star({ 
  position = [0, 0, 0],
  starProfile = DEFAULT_STAR_PROFILE,
  personId = 'default',
  personName = '',
  isHovered = false,
  isFocused = false,
  globalOpacity = 1,
  globalScale = 1,
  animated = true,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef(null);
  
  const visuals = useMemo(() => {
    return getStarVisuals(starProfile, personId);
  }, [starProfile, personId]);
  
  const uniqueOffset = useMemo(() => {
    let hash = 0;
    const str = String(personId);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash % 1000) / 1000;
  }, [personId]);
  
  const shapeId = starProfile?.shape || visuals.shape?.id || 'classic';
  const animKey = starProfile?.animation || 'gentle-pulse';
  const glowStyleKey = starProfile?.glowStyle || 'soft-halo';
  
  const timeScale = useMemo(() => ANIM_TIME_SCALE[animKey] ?? 0.4, [animKey]);
  const animMode = useMemo(() => ANIM_MODE[animKey] ?? 1, [animKey]);
  
  const glowFalloff = GLOW_FALLOFF_MAP[glowStyleKey] || 2.0;
  const glowRadiusMult = GLOW_RADIUS_MAP[glowStyleKey] || 1.0;
  
  const activeScale = useMemo(() => {
    let base = visuals.scale;
    if (isFocused) base = visuals.scale * 2.2;
    else if (isHovered) base = visuals.scale * 2.0;
    return base * globalScale;
  }, [isHovered, isFocused, visuals.scale, globalScale]);
  
  // Glow intensity: decoupled from brightness — even dim stars glow
  const baseGlowIntensity = visuals.glow?.intensity || 0.7;
  const activeIntensity = useMemo(() => {
    const dimFloor = 0.35;
    const base = Math.max(baseGlowIntensity, dimFloor);
    if (isFocused) return base * 1.8;
    if (isHovered) return base * 1.6;
    return base;
  }, [isHovered, isFocused, baseGlowIntensity]);
  
  // Diffraction spikes: always for bright stars, enhanced on hover
  const starBrightness = visuals.brightness || 0.8;
  const showSpikes = isHovered || isFocused || starBrightness > 0.7;
  const spikeIntensity = (isHovered || isFocused)
    ? activeIntensity * 0.5
    : activeIntensity * 0.15 * starBrightness;
  
  // Atmospheric haze: ALWAYS visible, enhanced on hover
  const hazeIntensity = (isHovered || isFocused)
    ? activeIntensity * 0.5
    : activeIntensity * 0.2;
  
  const hitboxScale = 0.7 * activeScale;
  const frozen = !animated;
  
  const pointerHandlers = {
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
      onPointerOver?.(e);
    },
    onPointerOut: (e) => {
      document.body.style.cursor = 'default';
      onPointerOut?.(e);
    },
    onClick: (e) => {
      e.stopPropagation();
      onClick?.(e);
    },
  };
  
  return (
    <group ref={groupRef} position={position}>
      <StarLabel name={personName} isVisible={isHovered || isFocused} />
      
      {/* Layer 4 (outermost): Atmospheric haze — always visible */}
      <AtmosphericHaze
        colors={visuals.colors}
        scale={frozen ? activeScale * 0.6 : activeScale}
        intensity={hazeIntensity}
        uniqueOffset={uniqueOffset}
        globalOpacity={globalOpacity}
        frozen={frozen}
        timeScale={timeScale}
      />
      
      {/* Layer 3: Diffraction spikes */}
      {showSpikes && (
        <DiffractionSpikes
          colors={visuals.colors}
          scale={frozen ? activeScale * 0.7 : activeScale}
          intensity={spikeIntensity}
          uniqueOffset={uniqueOffset}
          globalOpacity={globalOpacity}
          frozen={frozen}
          timeScale={timeScale}
        />
      )}
      
      {/* Layer 2: Outer glow — always visible, style-configurable */}
      <OuterGlow
        colors={visuals.colors}
        scale={frozen ? activeScale * 0.8 : activeScale}
        intensity={activeIntensity * 0.65}
        uniqueOffset={uniqueOffset}
        globalOpacity={globalOpacity}
        frozen={frozen}
        timeScale={timeScale}
        animMode={animMode}
        glowRadius={glowRadiusMult}
        glowFalloff={glowFalloff}
      />
      
      {/* Layer 1 (innermost): Star sprite — shape-specific shader */}
      <StarSprite
        colors={visuals.colors}
        scale={frozen ? activeScale * 0.8 : activeScale}
        brightness={visuals.brightness}
        uniqueOffset={uniqueOffset}
        shapeId={shapeId}
        globalOpacity={globalOpacity}
        frozen={frozen}
        timeScale={timeScale}
        animMode={animMode}
      />
      
      {/* Invisible hitbox */}
      <mesh visible={false} {...pointerHandlers}>
        <sphereGeometry args={[hitboxScale, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

// ============================================================================
// STAR INSTANCED
// ============================================================================

export function StarInstanced({ stars, onStarClick, onStarHover, hoveredId, focusedId, globalOpacity = 1, globalScale = 1, animated = true }) {
  return (
    <group>
      {stars.map((star) => (
        <Star
          key={star.id}
          position={star.position}
          starProfile={star.starProfile}
          personId={star.id}
          personName={star.person?.name || star.person?.first_name || ''}
          isHovered={hoveredId === star.id}
          isFocused={focusedId === star.id}
          globalOpacity={globalOpacity}
          globalScale={globalScale}
          animated={animated}
          onClick={(e) => {
            e.stopPropagation();
            onStarClick?.(star);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onStarHover?.(star.id);
          }}
          onPointerOut={() => onStarHover?.(null)}
        />
      ))}
    </group>
  );
}
