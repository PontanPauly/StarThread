import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { getStarVisuals, DEFAULT_STAR_PROFILE } from '@/lib/starConfig';

const textureLoader = new THREE.TextureLoader();
const textureCache = {};
function getStarTexture(shapeId) {
  const key = shapeId || 'classic';
  if (!textureCache[key]) {
    const tex = textureLoader.load(`/textures/star_${key}.png?v=3`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    textureCache[key] = tex;
  }
  return textureCache[key];
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D starMap;
  uniform vec3 tintColor;
  uniform vec3 glowColor;
  uniform float brightness;
  uniform float globalOpacity;
  uniform float opacityBreath;
  uniform float isHovered;
  uniform float time;
  uniform float uniqueOffset;

  varying vec2 vUv;

  // --- Noise functions for procedural effects ---
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t = time + uniqueOffset * 100.0;
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float ang = atan(center.y, center.x);

    // --- Slow texture rotation (unique per star) ---
    float rotSpeed = 0.05 + uniqueOffset * 0.03;
    float rotAngle = t * rotSpeed;
    float ca = cos(rotAngle);
    float sa = sin(rotAngle);
    vec2 rotUv = vec2(center.x * ca - center.y * sa, center.x * sa + center.y * ca) + 0.5;

    vec4 tex = texture2D(starMap, rotUv);
    float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));

    // --- Plasma turbulence layer (FBM distortion over surface) ---
    vec2 turbUv = rotUv * 4.0 + vec2(t * 0.08, t * 0.06);
    float turb = fbm(turbUv + uniqueOffset * 7.0);
    float turb2 = fbm(turbUv * 1.5 - vec2(t * 0.12, t * 0.1) + uniqueOffset * 13.0);
    float plasmaMix = turb * 0.6 + turb2 * 0.4;
    lum *= 0.7 + plasmaMix * 0.6;

    // --- Multi-frequency breathing pulse ---
    float pulse1 = 0.82 + 0.18 * sin(t * 0.5 + uniqueOffset * 6.28);
    float pulse2 = 0.9 + 0.1 * sin(t * 1.7 + uniqueOffset * 12.0);
    float pulse3 = 0.95 + 0.05 * sin(t * 4.1 + uniqueOffset * 25.0);
    float pulse = pulse1 * pulse2 * pulse3;
    lum *= pulse;

    // --- Hot spots: random bright flares on surface ---
    float hotspot1 = pow(noise(rotUv * 8.0 + vec2(t * 0.3, t * 0.2) + uniqueOffset * 5.0), 3.0);
    float hotspot2 = pow(noise(rotUv * 6.0 - vec2(t * 0.25, t * 0.15) + uniqueOffset * 11.0), 3.0);
    float hotspots = (hotspot1 + hotspot2) * smoothstep(0.4, 0.1, dist);
    lum += hotspots * 0.35;

    // --- Coronal wisps: tendrils extending from the edges ---
    float coronaDist = smoothstep(0.15, 0.48, dist);
    float wispAngle1 = sin(ang * 3.0 + t * 0.4 + uniqueOffset * 20.0) * 0.5 + 0.5;
    float wispAngle2 = sin(ang * 5.0 - t * 0.6 + uniqueOffset * 30.0) * 0.5 + 0.5;
    float wispAngle3 = sin(ang * 7.0 + t * 0.3 + uniqueOffset * 40.0) * 0.5 + 0.5;
    float wisps = (wispAngle1 * 0.5 + wispAngle2 * 0.3 + wispAngle3 * 0.2);
    vec2 circularCoord = vec2(cos(ang), sin(ang)) * dist * 6.0;
    float wispNoise = fbm(circularCoord + t * 0.15 + uniqueOffset * 3.0);
    wisps *= wispNoise;
    float coronaIntensity = wisps * coronaDist * exp(-pow((dist - 0.3) * 3.0, 2.0));

    // --- Color composition ---
    float coreMask = smoothstep(0.32, 0.03, dist);
    float glowMask = smoothstep(0.5, 0.1, dist);

    // Chromatic shift - color temperature varies over time and radius
    float colorShift = sin(t * 0.25 + dist * 5.0 + uniqueOffset * 50.0) * 0.5 + 0.5;
    vec3 hotColor = tintColor * 1.3;
    vec3 tint = mix(glowColor, tintColor, coreMask);
    tint = mix(tint, hotColor, colorShift * 0.2 * coreMask);

    // Ensure minimum luminance so no star is invisible
    lum = max(lum, 0.4);

    // Hot spots burn brighter (whiter)
    vec3 col = tint * lum;
    col += vec3(1.0, 0.95, 0.8) * hotspots * 0.35 * smoothstep(0.35, 0.05, dist);

    // Corona wisps in glow color
    vec3 coronaColor = mix(glowColor, tintColor, 0.3) * 2.0;
    col += coronaColor * coronaIntensity * 1.2 * pulse;

    // --- Hover effects ---
    float hovGlow = isHovered * 0.35 * glowMask;
    col += tint * hovGlow;
    float hovCorona = isHovered * coronaIntensity * 0.5;
    col += coronaColor * hovCorona;

    // --- Outer atmospheric glow (soft halo) ---
    float innerGlow = exp(-dist * dist / 0.015) * 1.0 * pulse;
    float outerGlow = exp(-dist * dist / 0.045) * 0.55 * pulse;
    col += tintColor * innerGlow * brightness;
    col += glowColor * outerGlow * brightness;

    float effectiveBrightness = max(brightness, 1.0);
    col *= effectiveBrightness;

    // --- Alpha with hard circular cutoff (no visible square) ---
    float circleMask = smoothstep(0.5, 0.35, dist);
    float alpha = lum * opacityBreath * globalOpacity * circleMask;
    alpha += coronaIntensity * 0.75 * opacityBreath * globalOpacity * circleMask;
    alpha += (innerGlow + outerGlow) * 0.85 * opacityBreath * globalOpacity * smoothstep(0.5, 0.4, dist);
    alpha *= (1.0 + isHovered * 0.35);

    if (alpha < 0.005) discard;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const ANIM_MODE = {
  'steady': 0,
  'gentle-pulse': 1,
  'twinkle': 2,
  'breathing': 3,
  'dancing': 4,
};

function computeOpacityBreath(elapsedTime, uniqueOffset, mode) {
  const t = elapsedTime + uniqueOffset * 100;
  switch (mode) {
    case 0:
      return 1.0;
    case 1: {
      return 0.82 + 0.18 * Math.sin(t * 0.8);
    }
    case 2: {
      const n1 = Math.sin(t * 7.3 + uniqueOffset * 137.5);
      const n2 = Math.sin(t * 13.1 + uniqueOffset * 59.3);
      const n3 = Math.sin(t * 19.7 + uniqueOffset * 23.7);
      const n4 = Math.cos(t * 11.3 + uniqueOffset * 83.1);
      const n5 = Math.sin(t * 29.3 + uniqueOffset * 41.9);
      const flicker = (n1 * 0.25 + n2 * 0.2 + n3 * 0.2 + n4 * 0.2 + n5 * 0.15) * 0.5 + 0.5;
      return 0.35 + flicker * 0.65;
    }
    case 3: {
      const breath = Math.sin(t * 0.4) * 0.5 + 0.5;
      return 0.55 + breath * 0.45;
    }
    case 4: {
      const pulse = Math.sin(t * 2.0) * 0.2;
      const burst = Math.pow(Math.max(Math.sin(t * 0.9), 0), 4) * 0.4;
      return 0.6 + pulse + burst;
    }
    default:
      return 1.0;
  }
}

function StarLabel({ name, isVisible, labelOpacity = 1 }) {
  if (!name || !isVisible) return null;
  return (
    <Html position={[0, -1.2, 0]} center style={{ pointerEvents: 'none' }}>
      <div style={{
        color: '#fff',
        fontSize: '11px',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        textShadow: '0 0 8px rgba(255,255,255,0.5)',
        whiteSpace: 'nowrap',
        opacity: 0.9 * labelOpacity,
        transition: 'opacity 0.3s ease',
      }}>
        {name}
      </div>
    </Html>
  );
}


export default function Star({
  position = [0, 0, 0],
  starProfile = DEFAULT_STAR_PROFILE,
  personId = 'default',
  personName = '',
  isHovered: isHoveredProp,
  hoveredIdRef,
  isFocused = false,
  isMemorial = false,
  globalOpacity = 1,
  globalOpacityRef,
  globalScale = 1,
  animated = true,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef(null);
  const meshRef = useRef(null);
  const timeRef = useRef(0);
  const hoverRef = useRef(0);
  const scaleRef = useRef(null);

  const visuals = useMemo(() => {
    return getStarVisuals(starProfile, personId);
  }, [starProfile, personId]);

  const uniqueOffset = useMemo(() => {
    let h = 0;
    const str = String(personId);
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return (Math.abs(h) % 1000) / 1000;
  }, [personId]);

  const animKey = starProfile?.animation || 'gentle-pulse';
  const animMode = useMemo(() => ANIM_MODE[animKey] ?? 1, [animKey]);

  const shapeId = visuals.shape?.id || 'classic';
  const starTexture = useMemo(() => getStarTexture(shapeId), [shapeId]);

  const material = useMemo(() => {
    const c = visuals.colors;
    const memorialBlue = new THREE.Color('#8888ff');
    const toVec3 = (arr, fallbackHex) => {
      if (arr && arr.length === 3) {
        let col = new THREE.Color(arr[0], arr[1], arr[2]);
        if (isMemorial) col.lerp(memorialBlue, 0.5);
        return new THREE.Vector3(col.r, col.g, col.b);
      }
      let col = new THREE.Color(fallbackHex || '#ffffff');
      if (isMemorial) col.lerp(memorialBlue, 0.5);
      return new THREE.Vector3(col.r, col.g, col.b);
    };

    const effectiveBrightness = isMemorial ? visuals.brightness * 0.6 : visuals.brightness;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        starMap: { value: starTexture },
        tintColor: { value: toVec3(c.body, c.primary) },
        glowColor: { value: toVec3(c.edge, c.secondary) },
        brightness: { value: effectiveBrightness },
        globalOpacity: { value: isMemorial ? 0.6 : 1.0 },
        opacityBreath: { value: 1.0 },
        isHovered: { value: 0.0 },
        time: { value: 0 },
        uniqueOffset: { value: uniqueOffset },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [visuals, uniqueOffset, starTexture, isMemorial]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  const baseScale = visuals.scale * globalScale;
  const isHoveredSelfRef = useRef(false);
  const [showLabel, setShowLabel] = useState(false);
  const prevShowLabel = useRef(false);

  if (scaleRef.current === null) {
    scaleRef.current = baseScale;
  }

  const hitboxScale = 0.6 * baseScale;

  useFrame((state, delta) => {
    if (animated) {
      timeRef.current += delta;
      material.uniforms.time.value = timeRef.current;
      const opacityBreath = computeOpacityBreath(state.clock.elapsedTime, uniqueOffset, animMode);
      material.uniforms.opacityBreath.value = opacityBreath;
    }
    material.uniforms.globalOpacity.value = globalOpacityRef ? globalOpacityRef.current : globalOpacity;

    const isHovered = isHoveredProp !== undefined ? isHoveredProp : (hoveredIdRef ? hoveredIdRef.current === personId : false);
    isHoveredSelfRef.current = isHovered;

    const hoverTarget = (isHovered || isFocused) ? 1.0 : 0.0;
    const hoverSpeed = hoverTarget > hoverRef.current ? 8.0 : 5.0;
    hoverRef.current += (hoverTarget - hoverRef.current) * Math.min(1, hoverSpeed * delta);
    if (Math.abs(hoverRef.current - hoverTarget) < 0.001) hoverRef.current = hoverTarget;
    material.uniforms.isHovered.value = hoverRef.current;

    let targetScale = visuals.scale * globalScale;
    if (isFocused) targetScale = visuals.scale * 1.3 * globalScale;
    else if (isHovered) targetScale = visuals.scale * 1.2 * globalScale;
    
    const scaleSpeed = targetScale > scaleRef.current ? 8.0 : 5.0;
    scaleRef.current += (targetScale - scaleRef.current) * Math.min(1, scaleSpeed * delta);
    if (Math.abs(scaleRef.current - targetScale) < 0.001) scaleRef.current = targetScale;

    if (meshRef.current) {
      const s = scaleRef.current / baseScale;
      meshRef.current.scale.set(s, s, 1);
      meshRef.current.lookAt(state.camera.position);
    }
    
    const shouldShow = isHovered || isFocused;
    if (shouldShow !== prevShowLabel.current) {
      prevShowLabel.current = shouldShow;
      setShowLabel(shouldShow);
    }
  });

  const baseGeoSize = 1.2 * baseScale;

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

  const haloMaterial = useMemo(() => {
    if (!isMemorial) return null;
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color('#8888ff'),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [isMemorial]);

  useEffect(() => {
    return () => {
      if (haloMaterial) haloMaterial.dispose();
    };
  }, [haloMaterial]);

  return (
    <group ref={groupRef} position={position}>
      <StarLabel name={personName} isVisible={showLabel} />

      <mesh ref={meshRef}>
        <planeGeometry args={[baseGeoSize, baseGeoSize, 16, 16]} />
        <primitive object={material} attach="material" />
      </mesh>

      {isMemorial && haloMaterial && (
        <mesh rotation={[0, 0, 0]}>
          <ringGeometry args={[baseGeoSize * 0.55, baseGeoSize * 0.65, 64]} />
          <primitive object={haloMaterial} attach="material" />
        </mesh>
      )}

      <mesh visible={false} {...pointerHandlers}>
        <sphereGeometry args={[hitboxScale, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export function StarInstanced({ stars, onStarClick, onStarHover, hoveredId, hoveredIdRef, focusedId, globalOpacity = 1, globalOpacityRef, globalScale = 1, animated = true }) {
  return (
    <group>
      {stars.map((star) => (
        <Star
          key={star.id}
          position={star.position}
          starProfile={star.starProfile}
          personId={star.id}
          personName={star.person?.name || star.person?.first_name || ''}
          isHovered={hoveredId != null ? hoveredId === star.id : undefined}
          hoveredIdRef={hoveredIdRef}
          isFocused={focusedId === star.id}
          isMemorial={!!star.person?.is_memorial}
          globalOpacity={globalOpacity}
          globalOpacityRef={globalOpacityRef}
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
