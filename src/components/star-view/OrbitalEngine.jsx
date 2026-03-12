import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";

const PLANET_LABELS = {
  essence: "Essence",
  moment: "Moments",
  family: "Family",
  interest: "Interests",
  event: "Events",
  featured: "Featured",
  lovenote: "Love Notes",
  story: "Stories",
  trip: "Trips",
};

const VIEW_INCLINATION = 0.45;

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateOrbits(count, personSeed) {
  const rng = seededRandom(personSeed || 42);

  const baseEccentricities = [0.06, 0.14, 0.08, 0.18, 0.10, 0.20, 0.07, 0.16, 0.12];
  const baseRotations = [5, 50, 110, 165, 230, 290, 35, 80, 150];

  const minRadius = 0.18;
  const maxRadius = 0.48;
  const radiusStep = count > 1 ? (maxRadius - minRadius) / (count - 1) : 0;

  const orbits = [];
  for (let i = 0; i < count; i++) {
    const semiMajorBase = minRadius + i * radiusStep;
    const semiMajor = semiMajorBase + (rng() - 0.5) * 0.005;

    const ecc = baseEccentricities[i % baseEccentricities.length] + (rng() - 0.5) * 0.04;
    const eccentricity = Math.max(0.03, Math.min(0.22, ecc));

    const semiMinor = semiMajor * Math.sqrt(1 - eccentricity * eccentricity);
    const focalDist = Math.sqrt(semiMajor * semiMajor - semiMinor * semiMinor);

    const rotation = baseRotations[i % baseRotations.length] + (rng() - 0.5) * 35;

    const baseInclinations = [5, -30, 18, -12, 35, -25, 8, -40, 20];
    const inclination = baseInclinations[i % baseInclinations.length] + (rng() - 0.5) * 10;

    const speed = 0.06 / (1 + i * 0.3) + rng() * 0.005;

    const goldenAngle = 2.399963;
    const phase = i * goldenAngle + (rng() - 0.5) * 0.2;

    orbits.push({
      semiMajor,
      semiMinor,
      eccentricity,
      focalDist,
      rotation,
      inclination,
      speed,
      phase,
    });
  }
  return orbits;
}

function getOrbitPosition3D(angle, orbit, scale) {
  const a = orbit.semiMajor * scale;
  const b = orbit.semiMinor * scale;
  const f = orbit.focalDist * scale;
  const rotRad = (orbit.rotation * Math.PI) / 180;
  const inclRad = (orbit.inclination * Math.PI) / 180;

  const ox = a * Math.cos(angle) - f;
  const oy = b * Math.sin(angle);

  const rx = ox * Math.cos(rotRad) - oy * Math.sin(rotRad);
  const ry = ox * Math.sin(rotRad) + oy * Math.cos(rotRad);

  const ry3d = ry * Math.cos(inclRad);

  const screenX = rx;
  const screenY = ry3d * VIEW_INCLINATION;

  const z = Math.sin(angle + orbit.rotation * Math.PI / 180) * Math.cos(inclRad * 0.5);

  return { x: screenX, y: screenY, z };
}

function generateEllipsePath(orbit, scale, steps = 160) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const { x, y } = getOrbitPosition3D(angle, orbit, scale);
    points.push(`${x},${y}`);
  }
  return `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(" ") + " Z";
}

export default function OrbitalEngine({
  planets = [],
  onPlanetHover,
  onPlanetFocus,
  isMobile = false,
  containerSize,
  personSeed,
  zoom = 1,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(null);
  const planetRefs = useRef([]);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);
  const positionsRef = useRef([]);
  const [, forceUpdate] = useState(0);
  const frameCountRef = useRef(0);

  const size = containerSize || (isMobile ? 380 : 900);
  const orbitScale = size * 0.9 * zoom;
  const cx = size / 2;
  const cy = size / 2;
  const basePlanetSize = isMobile ? 56 : 90;
  const planetSize = Math.round(basePlanetSize * zoom);

  const resolvedOrbits = useMemo(() => {
    return generateOrbits(planets.length, personSeed);
  }, [planets.length, personSeed]);

  const orbitPaths = useMemo(() => {
    return resolvedOrbits.map(o => generateEllipsePath(o, orbitScale));
  }, [resolvedOrbits, orbitScale]);

  const animate = useCallback((timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) / 1000;

    const rawPositions = resolvedOrbits.map((orbit, i) => {
      const angle = orbit.phase + elapsed * orbit.speed;
      return getOrbitPosition3D(angle, orbit, orbitScale);
    });

    const minDist = planetSize * 1.15;
    const adjustedPositions = rawPositions.map(p => ({ x: p.x, y: p.y, z: p.z }));
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < adjustedPositions.length; i++) {
        for (let j = i + 1; j < adjustedPositions.length; j++) {
          const dx = adjustedPositions[j].x - adjustedPositions[i].x;
          const dy = adjustedPositions[j].y - adjustedPositions[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist && dist > 0.1) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            adjustedPositions[i].x -= nx * overlap;
            adjustedPositions[i].y -= ny * overlap;
            adjustedPositions[j].x += nx * overlap;
            adjustedPositions[j].y += ny * overlap;
          }
        }
      }
    }

    adjustedPositions.forEach((pos, i) => {
      positionsRef.current[i] = pos;

      const el = planetRefs.current[i];
      if (el) {
        const depthNorm = (pos.z + 1) / 2;
        const baseScale = 0.7 + depthNorm * 0.5;
        const baseOpacity = 0.45 + depthNorm * 0.55;
        el.style.left = `${cx + pos.x - planetSize / 2}px`;
        el.style.top = `${cy + pos.y - planetSize / 2}px`;
        el.style.zIndex = Math.round(depthNorm * 100);
        el._depthNorm = depthNorm;
        el._baseScale = baseScale;
        el._baseOpacity = baseOpacity;
      }
    });

    frameCountRef.current++;
    if (frameCountRef.current % 10 === 0) {
      forceUpdate(c => c + 1);
    }

    animRef.current = requestAnimationFrame(animate);
  }, [resolvedOrbits, cx, cy, planetSize, orbitScale]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  const handleHover = useCallback((index) => {
    setHoveredIndex(index);
    if (onPlanetHover) onPlanetHover(index !== null ? planets[index] : null, index);
  }, [onPlanetHover, planets]);

  const handleFocus = useCallback((index) => {
    setFocusedIndex(prev => prev === index ? null : index);
    if (onPlanetFocus) onPlanetFocus(index !== null ? planets[index] : null, index);
  }, [onPlanetFocus, planets]);

  const hasSelection = hoveredIndex !== null || focusedIndex !== null;
  const activeIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        width={size}
        height={size}
        viewBox={`${-cx} ${-cy} ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {orbitPaths.map((path, i) => {
          const isActive = activeIndex === i;
          const isDimmed = hasSelection && !isActive;
          return (
            <path
              key={i}
              d={path}
              fill="none"
              stroke={isActive ? "rgba(251, 191, 36, 0.35)" : "rgba(180, 175, 140, 0.09)"}
              strokeWidth={isActive ? 1.4 : 0.5}
              strokeDasharray={isActive ? "none" : "3 8"}
              style={{
                opacity: isDimmed ? 0.04 : 1,
                transition: "stroke 0.3s, opacity 0.3s, stroke-width 0.3s",
              }}
            />
          );
        })}
      </svg>

      {planets.map((planet, index) => {
        const pos = positionsRef.current[index];
        const depthNorm = pos ? (pos.z + 1) / 2 : 0.5;
        const baseScale = 0.7 + depthNorm * 0.5;
        const baseOpacity = 0.45 + depthNorm * 0.55;

        const isActive = activeIndex === index;
        const isDimmed = hasSelection && !isActive;

        const scale = isActive ? baseScale * 1.2 : isDimmed ? baseScale * 0.85 : baseScale;
        const opacity = isDimmed ? baseOpacity * 0.35 : baseOpacity;

        const label = PLANET_LABELS[planet.type] || planet.key || `Planet ${index + 1}`;

        return (
          <div
            key={planet.key || index}
            ref={el => { planetRefs.current[index] = el; }}
            className="absolute cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-full"
            role="button"
            tabIndex={0}
            aria-label={label}
            style={{
              left: pos ? cx + pos.x - planetSize / 2 : cx - planetSize / 2,
              top: pos ? cy + pos.y - planetSize / 2 : cy - planetSize / 2,
              width: planetSize,
              height: planetSize,
              transform: `scale(${scale})`,
              opacity,
              zIndex: Math.round(depthNorm * 100),
              transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
            }}
            onMouseEnter={() => handleHover(index)}
            onMouseLeave={() => handleHover(null)}
            onClick={() => handleFocus(index)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleFocus(index);
              }
            }}
            onFocus={() => handleHover(index)}
            onBlur={() => handleHover(null)}
          >
            {planet.render
              ? planet.render({ isActive, opacity, scale })
              : (
                <div
                  className="w-full h-full rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 p-2 flex flex-col items-center justify-center text-center shadow-lg shadow-black/20"
                  style={{
                    borderColor: isActive ? "rgba(251,191,36,0.5)" : undefined,
                  }}
                >
                  {planet.icon && <div className="mb-1 flex-shrink-0">{planet.icon}</div>}
                  {planet.label && (
                    <span className="text-[10px] font-semibold text-slate-200 leading-tight">{planet.label}</span>
                  )}
                  {planet.content && (
                    <span className="text-[9px] text-slate-400 leading-tight line-clamp-2 mt-0.5">{planet.content}</span>
                  )}
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
}
