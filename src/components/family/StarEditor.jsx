import React, { useState, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Star as StarIcon, Shuffle, Check, Flame, Heart, X, Plus } from "lucide-react";
import Star from "@/components/constellation/Star";
import {
  COLOR_PALETTES,
  DEFAULT_STAR_PROFILE,
  generateRandomStarProfile,
} from "@/lib/starConfig";

const INTEREST_ICONS = [
  { icon: "🎨", label: "Art" }, { icon: "📚", label: "Reading" }, { icon: "🎵", label: "Music" },
  { icon: "🏃", label: "Fitness" }, { icon: "🍳", label: "Cooking" }, { icon: "🌿", label: "Nature" },
  { icon: "📷", label: "Photo" }, { icon: "✈️", label: "Travel" }, { icon: "🎮", label: "Gaming" },
  { icon: "⚽", label: "Sports" }, { icon: "🧵", label: "Crafts" }, { icon: "🎣", label: "Fishing" },
  { icon: "🏔️", label: "Hiking" }, { icon: "🎸", label: "Guitar" }, { icon: "🐕", label: "Pets" },
  { icon: "🌷", label: "Garden" }, { icon: "🔧", label: "DIY" }, { icon: "🍺", label: "Brewing" },
];

const INTEREST_COLORS = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

const FAVORITE_FIELDS = [
  { key: "food", label: "Favorite Food", placeholder: "e.g. Mom's lasagna" },
  { key: "music", label: "Music", placeholder: "e.g. Indie folk" },
  { key: "movie", label: "Movie / Show", placeholder: "e.g. The Princess Bride" },
  { key: "place", label: "Happy Place", placeholder: "e.g. The beach at sunset" },
  { key: "season", label: "Season", placeholder: "e.g. Fall" },
  { key: "quote", label: "Life Quote", placeholder: "e.g. Be kind, always" },
];

const STAR_TYPES = [
  { id: 'classic', name: 'Classic', desc: 'Balanced radiance' },
  { id: 'nova', name: 'Nova', desc: 'Explosive burst' },
  { id: 'crystal', name: 'Crystal', desc: 'Precise gem' },
  { id: 'nebula', name: 'Nebula', desc: 'Dreamy diffuse' },
];

const TWINKLE_PRESETS = [
  { id: 'steady', name: 'Steady', glowStyle: 'soft-halo', animation: 'steady' },
  { id: 'gentle', name: 'Gentle', glowStyle: 'soft-halo', animation: 'gentle-pulse' },
  { id: 'twinkle', name: 'Twinkle', glowStyle: 'sparkle', animation: 'twinkle' },
  { id: 'vivid', name: 'Vivid', glowStyle: 'pulsing-aura', animation: 'dancing' },
];

function getTwinklePresetId(profile) {
  for (const preset of TWINKLE_PRESETS) {
    if (profile.animation === preset.animation) return preset.id;
  }
  return 'gentle';
}

function StarPreview({ starProfile }) {
  const boostedProfile = useMemo(() => ({
    ...starProfile,
    brightness: Math.max(starProfile.brightness || 0.8, 0.85),
  }), [starProfile]);

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ background: 'transparent' }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.1} />
      <Suspense fallback={null}>
        <Star
          position={[0, 0, 0]}
          starProfile={boostedProfile}
          personId="preview"
          globalScale={1.0}
          onClick={() => {}}
          onPointerOver={() => {}}
          onPointerOut={() => {}}
        />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}

function rgbArrToCSS(arr) {
  if (!arr || arr.length < 3) return '#888';
  return `rgb(${arr[0]},${arr[1]},${arr[2]})`;
}

function ColorSwatch({ color, isSelected, onClick, name }) {
  const hasZones = color.center && color.edge;
  const bg = hasZones
    ? `radial-gradient(circle at 35% 35%, ${rgbArrToCSS(color.center)} 0%, ${rgbArrToCSS(color.body)} 40%, ${rgbArrToCSS(color.edge)} 75%, ${rgbArrToCSS(color.deep)} 100%)`
    : `linear-gradient(135deg, ${color.primary} 0%, ${color.secondary} 100%)`;
  const shadowColor = hasZones ? rgbArrToCSS(color.glowRgb) : color.glow;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative w-10 h-10 rounded-lg transition-all duration-200
        ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'}
      `}
      style={{
        background: bg,
        boxShadow: isSelected ? `0 0 20px ${shadowColor}` : `0 0 10px ${shadowColor}80`,
      }}
      title={name}
    >
      {isSelected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check className="w-4 h-4 text-white drop-shadow-lg" />
        </div>
      )}
    </button>
  );
}

function OptionButton({ isSelected, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${isSelected 
          ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-500/50 shadow-lg shadow-amber-500/10' 
          : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-700/50 hover:text-slate-300'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

function InterestAdder({ onAdd, existingInterests }) {
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const existingNames = (existingInterests || []).map(i =>
    (typeof i === "string" ? i : i.name || i).toLowerCase()
  );

  const handleAddCustom = () => {
    const name = customName.trim();
    if (!name || existingNames.includes(name.toLowerCase())) return;
    const color = INTEREST_COLORS[existingInterests.length % INTEREST_COLORS.length];
    onAdd({ name, color });
    setCustomName("");
    setShowCustom(false);
  };

  const suggestedIcons = INTEREST_ICONS.filter(
    (ic) => !existingNames.includes(ic.label.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {suggestedIcons.slice(0, 12).map((ic) => (
          <button
            key={ic.label}
            type="button"
            onClick={() => {
              const color = INTEREST_COLORS[existingInterests.length % INTEREST_COLORS.length];
              onAdd({ name: ic.label, icon: ic.icon, color });
            }}
            className="px-2 py-1 rounded-full bg-slate-800/60 text-slate-400 text-xs border border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-200 hover:border-amber-500/30 transition-colors"
          >
            {ic.icon} {ic.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="px-2 py-1 rounded-full bg-slate-800/60 text-slate-400 text-xs border border-dashed border-slate-600 hover:text-slate-200 hover:border-amber-500/30 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); } }}
            placeholder="Type an interest..."
            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            maxLength={30}
          />
          <Button type="button" size="sm" onClick={handleAddCustom} className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40">
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

export default function StarEditor({ value, onChange }) {
  const [starProfile, setStarProfile] = useState(() => ({
    ...DEFAULT_STAR_PROFILE,
    ...value,
  }));

  const updateProfile = (updates) => {
    const newProfile = { ...starProfile, ...updates };
    setStarProfile(newProfile);
    onChange?.(newProfile);
  };

  const handleRandomize = () => {
    const randomVisuals = generateRandomStarProfile();
    const merged = {
      ...randomVisuals,
      essence: starProfile.essence,
      interests: starProfile.interests,
      favorites: starProfile.favorites,
    };
    setStarProfile(merged);
    onChange?.(merged);
  };

  const colorOptions = useMemo(() => Object.values(COLOR_PALETTES), []);
  const currentTwinkle = getTwinklePresetId(starProfile);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-violet-500/10 border border-amber-500/30 mb-3">
          <StarIcon className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium bg-gradient-to-r from-amber-300 to-violet-300 bg-clip-text text-transparent">
            Design Your Star
          </span>
        </div>
      </div>

      <div className="relative h-48 rounded-xl overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, #1e1b4b 0%, #0f0a1f 50%, #030014 100%)',
          }}
        />
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 20% 30%, white, transparent),
              radial-gradient(1px 1px at 40% 70%, white, transparent),
              radial-gradient(0.5px 0.5px at 60% 20%, white, transparent),
              radial-gradient(0.5px 0.5px at 80% 60%, white, transparent),
              radial-gradient(0.5px 0.5px at 10% 80%, white, transparent),
              radial-gradient(0.5px 0.5px at 90% 40%, white, transparent)
            `,
            backgroundSize: '100% 100%',
          }}
        />
        <StarPreview starProfile={starProfile} />
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded-full">
            Live Preview
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          onClick={handleRandomize}
          variant="outline"
          className="border-violet-500/50 text-violet-300 hover:bg-violet-500/10 hover:border-violet-500"
        >
          <Shuffle className="w-4 h-4 mr-2" />
          Randomize
        </Button>
      </div>

      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-4 space-y-5">
          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Star Type
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {STAR_TYPES.map((type) => (
                <OptionButton
                  key={type.id}
                  isSelected={starProfile.shape === type.id}
                  onClick={() => updateProfile({ shape: type.id })}
                >
                  {type.name}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Color
            </Label>
            <div className="flex flex-wrap gap-2 justify-center p-3 rounded-lg bg-slate-900/50">
              {colorOptions.map((color) => (
                <ColorSwatch
                  key={color.id}
                  color={color}
                  name={color.name}
                  isSelected={starProfile.colorPalette === color.id}
                  onClick={() => updateProfile({ colorPalette: color.id, customColor: null })}
                />
              ))}
            </div>
            <p className="text-xs text-center text-slate-500">
              {COLOR_PALETTES[starProfile.colorPalette]?.name || 'Select a color'}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Brightness
            </Label>
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs text-slate-500 w-8">Dim</span>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={starProfile.brightness}
                onChange={(e) => updateProfile({ brightness: parseFloat(e.target.value) })}
                className="flex-1 accent-amber-400 h-2"
              />
              <span className="text-xs text-slate-500 w-10 text-right">Bright</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Twinkle
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {TWINKLE_PRESETS.map((preset) => (
                <OptionButton
                  key={preset.id}
                  isSelected={currentTwinkle === preset.id}
                  onClick={() => updateProfile({
                    glowStyle: preset.glowStyle,
                    animation: preset.animation,
                  })}
                >
                  {preset.name}
                </OptionButton>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-4 space-y-5">
          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Essence
            </Label>
            <p className="text-xs text-slate-500">
              A short statement that captures who you are — this appears on your star.
            </p>
            <textarea
              value={starProfile.essence || ""}
              onChange={(e) => updateProfile({ essence: e.target.value.slice(0, 120) })}
              placeholder="e.g. Steady hand, warm heart, and the best dad jokes in the galaxy"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
              rows={2}
              maxLength={120}
            />
            <p className="text-[10px] text-slate-600 text-right">
              {(starProfile.essence || "").length}/120
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              Interests
            </Label>
            <p className="text-xs text-slate-500">
              Pick your interests — they'll orbit your star as planets.
            </p>
            {(starProfile.interests || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {(starProfile.interests || []).map((interest, idx) => {
                  const name = typeof interest === "string" ? interest : interest.name || interest;
                  const icon = typeof interest === "object" ? interest.icon : null;
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs border border-amber-500/25"
                    >
                      {icon && <span>{icon}</span>}
                      {name}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(starProfile.interests || [])];
                          updated.splice(idx, 1);
                          updateProfile({ interests: updated });
                        }}
                        className="ml-0.5 text-amber-400/60 hover:text-amber-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {(starProfile.interests || []).length >= 8 ? (
              <p className="text-xs text-slate-500 italic">Maximum of 8 interests reached.</p>
            ) : (
              <InterestAdder
                onAdd={(interest) => {
                  const current = starProfile.interests || [];
                  if (current.length >= 8) return;
                  updateProfile({ interests: [...current, interest] });
                }}
                existingInterests={starProfile.interests || []}
              />
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300 flex items-center gap-2">
              <StarIcon className="w-3.5 h-3.5 text-violet-400" />
              Favorites
            </Label>
            <p className="text-xs text-slate-500">
              The little things that make you, you.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FAVORITE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-medium">{field.label}</label>
                  <input
                    type="text"
                    value={(starProfile.favorites || {})[field.key] || ""}
                    onChange={(e) => {
                      const favorites = { ...(starProfile.favorites || {}), [field.key]: e.target.value };
                      if (!e.target.value) delete favorites[field.key];
                      updateProfile({ favorites });
                    }}
                    placeholder={field.placeholder}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
