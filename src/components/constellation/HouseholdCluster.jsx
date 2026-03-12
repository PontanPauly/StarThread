import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

const HOUSEHOLD_COLORS = [
  { primary: '#8B5CF6', secondary: '#D946EF', glow: '#C4B5FD' },
  { primary: '#F97316', secondary: '#FCD34D', glow: '#FED7AA' },
  { primary: '#10B981', secondary: '#2DD4BF', glow: '#6EE7B7' },
  { primary: '#EC4899', secondary: '#FB7185', glow: '#FBCFE8' },
  { primary: '#3B82F6', secondary: '#818CF8', glow: '#BFDBFE' },
  { primary: '#F59E0B', secondary: '#F97316', glow: '#FDE68A' },
  { primary: '#06B6D4', secondary: '#22D3EE', glow: '#A5F3FC' },
  { primary: '#EF4444', secondary: '#F97316', glow: '#FECACA' },
  { primary: '#A855F7', secondary: '#EC4899', glow: '#E9D5FF' },
  { primary: '#14B8A6', secondary: '#3B82F6', glow: '#99F6E4' },
  { primary: '#E11D48', secondary: '#BE123C', glow: '#FFE4E6' },
  { primary: '#7C3AED', secondary: '#2563EB', glow: '#DDD6FE' },
  { primary: '#059669', secondary: '#10B981', glow: '#A7F3D0' },
  { primary: '#DB2777', secondary: '#9333EA', glow: '#FBD0E8' },
  { primary: '#0EA5E9', secondary: '#6366F1', glow: '#BAE6FD' },
  { primary: '#D97706', secondary: '#DC2626', glow: '#FEF3C7' },
  { primary: '#8B5CF6', secondary: '#06B6D4', glow: '#DDD6FE' },
  { primary: '#F43F5E', secondary: '#F59E0B', glow: '#FFE4E6' },
  { primary: '#6366F1', secondary: '#A855F7', glow: '#E0E7FF' },
  { primary: '#0D9488', secondary: '#059669', glow: '#CCFBF1' },
];

const seededRandom = (seed) => {
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const x = Math.sin(hash) * 10000;
  return x - Math.floor(x);
};

function SimpleNebulaCore({ color, glowColor, scale, isHovered }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 coreColor;
        uniform vec3 glowColor;
        uniform float time;
        uniform float hoverBoost;
        varying vec2 vUv;
        
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
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          float n = noise(vUv * 4.0 + time * 0.05);
          
          float core = smoothstep(0.5, 0.0, dist);
          core = pow(core, 1.5);
          core *= (0.8 + n * 0.2);
          
          float pulse = 0.95 + sin(time * 0.4) * 0.05;
          
          vec3 color = mix(glowColor, coreColor, pow(dist * 2.0, 0.7));
          color *= (1.0 + hoverBoost * 0.3);
          
          float alpha = core * pulse * (0.7 + hoverBoost * 0.3);
          alpha = clamp(alpha, 0.0, 1.0);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        coreColor: { value: new THREE.Color(color) },
        glowColor: { value: new THREE.Color(glowColor) },
        time: { value: 0 },
        hoverBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [color, glowColor]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
    material.uniforms.time.value = state.clock.elapsedTime;
    material.uniforms.hoverBoost.value = THREE.MathUtils.lerp(
      material.uniforms.hoverBoost.value,
      isHovered ? 1 : 0,
      0.1
    );
  });
  
  return (
    <mesh ref={meshRef} raycast={() => null}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function SimpleOuterGlow({ color, scale, isHovered }) {
  const meshRef = useRef();
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float hoverBoost;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          float glow = smoothstep(0.5, 0.0, dist);
          glow = pow(glow, 3.0);
          
          float alpha = glow * (0.15 + hoverBoost * 0.15);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        color: { value: new THREE.Color(color) },
        hoverBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [color]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
    material.uniforms.hoverBoost.value = THREE.MathUtils.lerp(
      material.uniforms.hoverBoost.value,
      isHovered ? 1 : 0,
      0.1
    );
  });
  
  return (
    <mesh ref={meshRef} raycast={() => null}>
      <planeGeometry args={[scale, scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function MemberStars({ memberCount, scale, seed, color }) {
  const pointsRef = useRef();
  
  const { positions, colors, sizes, phases } = useMemo(() => {
    const count = Math.min(memberCount, 20);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const pha = new Float32Array(count);
    
    const starColor = new THREE.Color(color);
    const innerRadius = scale * 0.15;
    const outerRadius = scale * 0.35;
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + seededRandom(seed + '-angle-' + i) * 0.5;
      const radiusMix = seededRandom(seed + '-r-' + i);
      const radius = innerRadius + radiusMix * (outerRadius - innerRadius);
      
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = Math.sin(angle) * radius * 0.7;
      pos[i * 3 + 2] = (seededRandom(seed + '-z-' + i) - 0.5) * scale * 0.1;
      
      col[i * 3] = starColor.r;
      col[i * 3 + 1] = starColor.g;
      col[i * 3 + 2] = starColor.b;
      
      siz[i] = 2.5 + seededRandom(seed + '-size-' + i) * 1.5;
      pha[i] = seededRandom(seed + '-phase-' + i) * Math.PI * 2;
    }
    
    return { positions: pos, colors: col, sizes: siz, phases: pha };
  }, [memberCount, scale, seed, color]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 starColor;
        attribute float size;
        attribute float phase;
        uniform float time;
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vColor = starColor;
          float twinkle = 0.7 + 0.3 * sin(time * 0.5 + phase);
          vAlpha = twinkle;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center);
          
          float core = 1.0 - smoothstep(0.0, 0.2, dist);
          float glow = 1.0 - smoothstep(0.0, 0.5, dist);
          glow = pow(glow, 2.0);
          
          vec3 color = vColor * (core * 2.0 + glow);
          float alpha = (core + glow * 0.5) * vAlpha;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);
  
  useFrame((state) => {
    material.uniforms.time.value = state.clock.elapsedTime;
  });
  
  if (memberCount === 0) return null;
  
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-starColor" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-phase" count={phases.length} array={phases} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function BillboardNebulaClouds({ colors, scale, seed }) {
  const groupRef = useRef();
  const planesRef = useRef([]);
  
  const planeCount = 10;
  
  const planeConfigs = useMemo(() => {
    const configs = [];
    for (let i = 0; i < planeCount; i++) {
      configs.push({
        rotationZ: seededRandom(seed + '-cloud-rot-' + i) * Math.PI * 2,
        scaleOffset: 0.85 + seededRandom(seed + '-cloud-scale-' + i) * 0.3,
        positionOffset: [
          (seededRandom(seed + '-cloud-px-' + i) - 0.5) * scale * 0.15,
          (seededRandom(seed + '-cloud-py-' + i) - 0.5) * scale * 0.1,
          (seededRandom(seed + '-cloud-pz-' + i) - 0.5) * scale * 0.15,
        ],
        phaseOffset: seededRandom(seed + '-cloud-phase-' + i) * Math.PI * 2,
        rotationSpeed: 0.02 + seededRandom(seed + '-cloud-rotspeed-' + i) * 0.03,
      });
    }
    return configs;
  }, [seed, scale]);
  
  const cloudMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 cloudColor;
        uniform vec3 glowColor;
        uniform float time;
        uniform float phaseOffset;
        varying vec2 vUv;
        
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
          float f = 0.0;
          float w = 0.5;
          for (int i = 0; i < 4; i++) {
            f += w * noise(p);
            p *= 2.0;
            w *= 0.5;
          }
          return f;
        }
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          vec2 animatedUv = vUv + vec2(
            sin(time * 0.03 + phaseOffset) * 0.02,
            cos(time * 0.02 + phaseOffset) * 0.02
          );
          
          float cloud = fbm(animatedUv * 3.0 + time * 0.01);
          cloud = pow(cloud, 1.5);
          
          float radialFade = smoothstep(0.5, 0.1, dist);
          cloud *= radialFade;
          
          float pulse = 0.9 + sin(time * 0.3 + phaseOffset) * 0.1;
          cloud *= pulse;
          
          vec3 color = mix(cloudColor, glowColor, cloud * 0.5);
          
          float alpha = cloud * 0.08;
          alpha = clamp(alpha, 0.0, 0.1);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        cloudColor: { value: new THREE.Color(colors.primary) },
        glowColor: { value: new THREE.Color(colors.glow) },
        time: { value: 0 },
        phaseOffset: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [colors]);
  
  const materials = useMemo(() => {
    return planeConfigs.map((config) => {
      const mat = cloudMaterial.clone();
      mat.uniforms.phaseOffset.value = config.phaseOffset;
      return mat;
    });
  }, [cloudMaterial, planeConfigs]);

  useEffect(() => {
    return () => {
      cloudMaterial.dispose();
      materials.forEach((mat) => mat.dispose());
    };
  }, [cloudMaterial, materials]);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    planesRef.current.forEach((plane, i) => {
      if (plane) {
        plane.lookAt(state.camera.position);
        plane.rotation.z = planeConfigs[i].rotationZ + time * planeConfigs[i].rotationSpeed;
      }
    });
    
    materials.forEach((mat) => {
      mat.uniforms.time.value = time;
    });
  });
  
  return (
    <group ref={groupRef}>
      {planeConfigs.map((config, i) => (
        <mesh
          key={i}
          ref={(el) => (planesRef.current[i] = el)}
          position={config.positionOffset}
          raycast={() => null}
        >
          <planeGeometry args={[scale * 1.5 * config.scaleOffset, scale * 1.5 * config.scaleOffset]} />
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

const POINT_LIGHT_COLORS = ['#FF8C42', '#FF6B9D', '#60A5FA'];

function ColoredPointLights({ scale, seed }) {
  const lightsRef = useRef([]);
  
  const lightConfigs = useMemo(() => {
    const configs = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + seededRandom(seed + '-light-angle-' + i) * 0.5;
      const radius = scale * 0.2 + seededRandom(seed + '-light-rad-' + i) * scale * 0.1;
      configs.push({
        position: [
          Math.cos(angle) * radius,
          (seededRandom(seed + '-light-y-' + i) - 0.5) * scale * 0.2,
          Math.sin(angle) * radius,
        ],
        color: POINT_LIGHT_COLORS[i],
        phaseOffset: seededRandom(seed + '-light-phase-' + i) * Math.PI * 2,
        baseIntensity: 0.3 + seededRandom(seed + '-light-int-' + i) * 0.2,
      });
    }
    return configs;
  }, [seed, scale]);
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    lightsRef.current.forEach((light, i) => {
      if (light) {
        const config = lightConfigs[i];
        const pulse = 0.8 + Math.sin(time * 0.5 + config.phaseOffset) * 0.2;
        light.intensity = config.baseIntensity * pulse;
      }
    });
  });
  
  return (
    <group>
      {lightConfigs.map((config, i) => (
        <pointLight
          key={i}
          ref={(el) => (lightsRef.current[i] = el)}
          position={config.position}
          color={config.color}
          intensity={config.baseIntensity}
          distance={scale * 2}
          decay={2}
        />
      ))}
    </group>
  );
}

function HouseholdLabel({ name, isHovered }) {
  if (!isHovered) return null;
  
  return (
    <Html center style={{ pointerEvents: 'none' }} position={[0, 2.5, 0]}>
      <div 
        className="px-3 py-1.5 rounded-lg whitespace-nowrap"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
    </Html>
  );
}

function StarMapPointVisual({ starClass, isHovered, memberCount }) {
  const coreRef = useRef();
  const haloRef = useRef();
  const flaresRef = useRef();
  const currentHover = useRef(0);

  const brightness = starClass?.brightness || 1.0;
  const coreColor = starClass?.colors?.core || '#FFFFFF';
  const innerColor = starClass?.colors?.inner || '#FFD700';
  const outerColor = starClass?.colors?.outer || '#FFA500';
  const glowColor = starClass?.colors?.glow || '#FF8C00';

  const starScale = 0.35 + Math.min(memberCount, 10) * 0.02;

  const coolHaloColor = useMemo(() => {
    const base = new THREE.Color(glowColor);
    const cool = new THREE.Color('#88CCEE');
    return base.clone().lerp(cool, 0.4);
  }, [glowColor]);

  const coreMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 coreColor;
        uniform vec3 innerColor;
        uniform float time;
        uniform float hoverBoost;
        uniform float brightness;
        varying vec2 vUv;

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

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          float n = noise(vUv * 5.0 + time * 0.08);

          float core = 1.0 - smoothstep(0.0, 0.12, dist);
          float inner = 1.0 - smoothstep(0.0, 0.35, dist);
          inner = pow(inner, 2.0);

          float breathe = 0.85 + sin(time * 0.4) * 0.1 + sin(time * 0.27) * 0.05;

          vec3 color = mix(innerColor, coreColor, core);
          color += n * 0.08 * innerColor;

          float intensity = (core * 1.8 + inner * 0.7) * brightness * breathe;
          intensity *= (1.0 + hoverBoost * 0.5);
          color *= intensity;

          float alpha = (core * 0.9 + inner * 0.6) * breathe;
          alpha *= (0.75 + n * 0.15);
          alpha *= (1.0 + hoverBoost * 0.3);
          float edge = 1.0 - smoothstep(0.4, 0.5, dist);
          alpha *= edge;
          alpha = clamp(alpha, 0.0, 0.95);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        coreColor: { value: new THREE.Color(coreColor) },
        innerColor: { value: new THREE.Color(innerColor) },
        time: { value: 0 },
        hoverBoost: { value: 0 },
        brightness: { value: brightness },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [coreColor, innerColor, brightness]);

  const flareMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 flareColor;
        uniform float time;
        uniform float hoverBoost;
        uniform float brightness;
        varying vec2 vUv;

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

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          float angle = atan(center.y, center.x);

          float rotation = time * 0.06;
          float rotAngle = angle - rotation;

          float flare1 = pow(abs(cos(rotAngle * 2.0)), 40.0);
          float flare2 = pow(abs(cos(rotAngle * 2.0 + 1.2)), 55.0);
          float flare3 = pow(abs(cos(rotAngle * 3.0 + 0.7)), 35.0);

          float len1 = exp(-dist * 3.0);
          float len2 = exp(-dist * 4.5);
          float len3 = exp(-dist * 5.0);

          float flare = flare1 * len1 * 0.6 + flare2 * len2 * 0.3 + flare3 * len3 * 0.25;

          float flicker = 0.85 + noise(vec2(angle * 3.0, time * 0.3)) * 0.15;
          float edgeFlicker = 0.8 + noise(vec2(dist * 8.0 + time * 0.5, angle * 2.0)) * 0.2;
          flare *= flicker * edgeFlicker;

          float baseOpacity = 0.3 + hoverBoost * 0.5;
          float alpha = flare * baseOpacity * brightness;
          float edge = 1.0 - smoothstep(0.4, 0.5, dist);
          alpha *= edge;
          if (alpha < 0.003) discard;

          vec3 color = flareColor * (1.0 + hoverBoost * 0.3);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        flareColor: { value: new THREE.Color(coreColor) },
        time: { value: 0 },
        hoverBoost: { value: 0 },
        brightness: { value: brightness },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [coreColor, brightness]);

  const haloMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 haloColor;
        uniform float time;
        uniform float hoverBoost;
        varying vec2 vUv;

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          float halo = 1.0 - smoothstep(0.0, 0.45, dist);
          halo = pow(halo, 3.0);

          float pulse = 0.8 + sin(time * 0.3) * 0.12 + sin(time * 0.19) * 0.08;

          float edge = 1.0 - smoothstep(0.4, 0.5, dist);
          float alpha = halo * pulse * (0.2 + hoverBoost * 0.2) * edge;

          gl_FragColor = vec4(haloColor, alpha);
        }
      `,
      uniforms: {
        haloColor: { value: coolHaloColor },
        time: { value: 0 },
        hoverBoost: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [coolHaloColor]);

  useEffect(() => {
    return () => {
      coreMaterial.dispose();
      flareMaterial.dispose();
      haloMaterial.dispose();
    };
  }, [coreMaterial, flareMaterial, haloMaterial]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    coreMaterial.uniforms.time.value = t;
    flareMaterial.uniforms.time.value = t;
    haloMaterial.uniforms.time.value = t;

    currentHover.current = THREE.MathUtils.lerp(
      currentHover.current,
      isHovered ? 1 : 0,
      0.1
    );
    coreMaterial.uniforms.hoverBoost.value = currentHover.current;
    flareMaterial.uniforms.hoverBoost.value = currentHover.current;
    haloMaterial.uniforms.hoverBoost.value = currentHover.current;

    if (coreRef.current) coreRef.current.lookAt(state.camera.position);
    if (flaresRef.current) flaresRef.current.lookAt(state.camera.position);
    if (haloRef.current) haloRef.current.lookAt(state.camera.position);
  });

  return (
    <group>
      <mesh ref={haloRef} raycast={() => null}>
        <planeGeometry args={[starScale * 5, starScale * 5]} />
        <primitive object={haloMaterial} attach="material" />
      </mesh>

      <mesh ref={flaresRef} raycast={() => null}>
        <planeGeometry args={[starScale * 6, starScale * 6]} />
        <primitive object={flareMaterial} attach="material" />
      </mesh>

      <mesh ref={coreRef} raycast={() => null}>
        <planeGeometry args={[starScale * 1.4, starScale * 1.4]} />
        <primitive object={coreMaterial} attach="material" />
      </mesh>

      <pointLight
        color={innerColor}
        intensity={brightness * 0.15 * (1 + currentHover.current * 0.3)}
        distance={8}
        decay={2}
      />
    </group>
  );
}

function SystemAura({ starClass, memberCount, householdColor, scale = 1.0, seedKey = '' }) {
  const ringRef = useRef();
  const primaryColor = householdColor?.primary || starClass?.colors?.glow || '#FFD700';
  const secondaryColor = householdColor?.secondary || starClass?.colors?.inner || '#FFD700';

  const seed = useMemo(() => {
    let h = 0;
    const s = seedKey + primaryColor + secondaryColor;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return Math.abs(h % 10000) * 0.0001;
  }, [seedKey, primaryColor, secondaryColor]);

  const auraRadius = (6.0 + Math.min(memberCount, 8) * 0.8) * 3.8 * scale;

  const auraMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        uniform float time;
        uniform float seed;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p, vec2 off) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 6; i++) {
            v += a * noise(p + off);
            p = rot * p * 2.05 + vec2(1.7, -1.3);
            a *= 0.47;
          }
          return v;
        }

        float ridgeNoise(vec2 p, vec2 off) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.75, 0.66, -0.66, 0.75);
          for (int i = 0; i < 5; i++) {
            float n = noise(p + off);
            n = 1.0 - abs(n * 2.0 - 1.0);
            n = pow(n, 1.6);
            v += a * n;
            p = rot * p * 2.1 + vec2(-0.8, 1.5);
            a *= 0.45;
          }
          return v;
        }

        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);

          float angle = atan(center.y, center.x);
          vec2 seedOff1 = vec2(seed * 137.3, seed * 259.7);
          vec2 seedOff2 = vec2(seed * 83.1 + 50.0, seed * 191.4 + 30.0);
          vec2 seedOff3 = vec2(seed * 47.9 + 100.0, seed * 313.2 + 70.0);

          float stretchX = 0.6 + seed * 0.8;
          float stretchY = 0.6 + fract(seed * 7.13) * 0.8;
          float rot = seed * 6.283 + fract(seed * 3.7) * 3.14;
          float cs = cos(rot);
          float sn = sin(rot);
          vec2 stretched = center * vec2(stretchX, stretchY);
          vec2 p = vec2(stretched.x * cs - stretched.y * sn, stretched.x * sn + stretched.y * cs);

          float warp1 = fbm(p * 2.0 + time * 0.008, seedOff1);
          float warp2 = fbm(p * 2.0 + vec2(5.2, 1.3) + time * 0.006, seedOff2);
          vec2 warpedP = p + vec2(warp1 - 0.5, warp2 - 0.5) * 0.45;

          float domainWarp2a = fbm(warpedP * 2.5 + time * 0.005, seedOff3);
          float domainWarp2b = fbm(warpedP * 2.5 + vec2(8.1, 3.7) + time * 0.004, seedOff1 + 50.0);
          vec2 finalP = warpedP + vec2(domainWarp2a - 0.5, domainWarp2b - 0.5) * 0.25;

          float gasLayer1 = fbm(finalP * 3.0 + time * 0.01, seedOff1);
          float gasLayer2 = fbm(finalP * 5.0 - time * 0.007, seedOff2);
          float filaments = ridgeNoise(finalP * 4.0 + time * 0.003, seedOff3);

          float warpedDist = length(finalP);

          float edgeDissolveNoise = gasLayer1 * 0.4 + gasLayer2 * 0.3 + filaments * 0.3;
          float noisyDist = dist * 2.0 - edgeDissolveNoise * 1.1;
          float coreMask = 1.0 - smoothstep(0.05, 0.55, noisyDist);
          float midWisp = (1.0 - smoothstep(0.2, 1.0, noisyDist)) * edgeDissolveNoise * 0.6;
          float outerWisp = (1.0 - smoothstep(0.4, 1.8, noisyDist)) * edgeDissolveNoise * 0.35;
          float farWisp = (1.0 - smoothstep(0.6, 2.2, dist * 2.0)) * pow(edgeDissolveNoise, 1.5) * 0.2;
          float dissolveMask = max(max(coreMask, midWisp), max(outerWisp, farWisp));

          float densityCore = gasLayer1 * 0.5 + gasLayer2 * 0.3 + filaments * 0.2;

          float brightFilaments = smoothstep(0.5, 0.75, filaments) * dissolveMask * 0.35;
          float denseGas = pow(gasLayer1, 1.5) * coreMask * 0.4;
          float diffuseGas = gasLayer2 * dissolveMask * 0.15;
          float coreGlow = (1.0 - smoothstep(0.0, 0.3, warpedDist)) * 0.15;

          float voids = smoothstep(0.2, 0.5, gasLayer2 * gasLayer1);
          float voidMask = mix(0.25, 1.0, voids);

          float totalAlpha = (brightFilaments + denseGas + diffuseGas + coreGlow) * voidMask * dissolveMask;

          float radialFade = 1.0 - smoothstep(0.3, 0.5, dist);
          totalAlpha *= radialFade;

          float pulse = 0.92 + sin(time * 0.08 + seed * 20.0) * 0.05 + sin(time * 0.05 + seed * 8.0) * 0.03;
          totalAlpha *= pulse;

          float colorMix1 = smoothstep(0.1, 0.5, warpedDist + gasLayer1 * 0.3);
          float colorMix2 = smoothstep(0.3, 0.7, filaments);
          vec3 baseColor = mix(color2, color1, colorMix1);
          baseColor = mix(baseColor, color3, colorMix2 * 0.4);
          baseColor += brightFilaments * color1 * 0.5;
          baseColor *= 1.0 + densityCore * 0.3;

          if (totalAlpha < 0.002) discard;
          gl_FragColor = vec4(baseColor, totalAlpha);
        }
      `,
      uniforms: {
        color1: { value: new THREE.Color(primaryColor) },
        color2: { value: new THREE.Color(secondaryColor) },
        color3: { value: new THREE.Color(primaryColor).lerp(new THREE.Color(secondaryColor), 0.3).offsetHSL(0.15, 0.1, 0.15) },
        time: { value: 0 },
        seed: { value: seed },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [primaryColor, secondaryColor, seed]);

  useEffect(() => {
    return () => auraMaterial.dispose();
  }, [auraMaterial]);

  useFrame((state) => {
    auraMaterial.uniforms.time.value = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.lookAt(state.camera.position);
    }
  });

  return (
    <mesh ref={ringRef} raycast={() => null}>
      <planeGeometry args={[auraRadius * 2, auraRadius * 2]} />
      <primitive object={auraMaterial} attach="material" />
    </mesh>
  );
}

export function StarMapCluster({
  position,
  household,
  memberCount = 0,
  starClass,
  isHovered = false,
  isSystemView = false,
  onClick,
  onPointerOver,
  onPointerOut,
  showLabels = true,
  householdColor,
}) {
  const groupRef = useRef();
  const currentScale = useRef(1);

  const hitboxRadius = 3.5;

  useFrame(() => {
    if (groupRef.current) {
      const targetScale = isHovered ? 1.15 : 1;
      currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale, 0.08);
      groupRef.current.scale.setScalar(currentScale.current);
    }
  });

  const groupHandlers = isSystemView ? {} : {
    onClick: (e) => {
      e.stopPropagation();
      onClick?.(household);
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      document.body.style.cursor = 'pointer';
      onPointerOver?.(household?.id);
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto';
      onPointerOut?.();
    },
  };

  return (
    <group
      ref={groupRef}
      position={position}
      {...groupHandlers}
    >
      {!isSystemView && (
        <mesh visible={false}>
          <sphereGeometry args={[hitboxRadius, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export default function HouseholdCluster({
  position,
  household,
  memberCount = 0,
  colorIndex = 0,
  isHovered = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const groupRef = useRef();
  const currentScale = useRef(1);
  
  const colors = HOUSEHOLD_COLORS[colorIndex % HOUSEHOLD_COLORS.length];
  const baseScale = 1.0 + Math.min(memberCount, 10) * 0.08;
  
  useFrame(() => {
    if (groupRef.current) {
      const targetScale = isHovered ? 1.25 : 1;
      currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale, 0.08);
      groupRef.current.scale.setScalar(currentScale.current);
    }
  });
  
  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(household);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        onPointerOver?.(household?.id);
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
        onPointerOut?.();
      }}
    >
      <SimpleOuterGlow 
        color={colors.secondary} 
        scale={baseScale * 2.0}
        isHovered={isHovered}
      />
      
      
      <ColoredPointLights
        scale={baseScale}
        seed={`${household?.id}-lights`}
      />
      
      <MemberStars
        memberCount={memberCount}
        scale={baseScale}
        seed={`${household?.id}-members`}
        color={colors.glow}
      />
      
      <HouseholdLabel 
        name={household?.name || 'Unknown'} 
        isHovered={isHovered}
      />
      
      <mesh>
        <sphereGeometry args={[baseScale * 0.4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export { HOUSEHOLD_COLORS, SystemAura };
