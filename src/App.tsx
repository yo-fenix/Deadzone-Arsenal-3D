/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crosshair,
  Download,
  Lock,
  Monitor,
  Package,
  Palette,
  Play,
  Shield,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  Target,
  User,
  Users,
} from 'lucide-react';
import {
  AttachmentSlot,
  CharacterConfig,
  GameMode,
  MultiplayerSubMode,
  PlatformType,
  PlayerProgression,
  WeaponAttachments,
  WeaponCategory,
  WeaponFinish,
  WeaponId,
} from './types/game';
import {
  ACCENT_COLOR_SWATCHES,
  ARMOR_CLASSES,
  ARMOR_COLOR_SWATCHES,
  BACKPACK_OPTIONS,
  DEFAULT_CHARACTER,
  DEFAULT_PROGRESSION,
  EMBLEM_OPTIONS,
  HELMET_OPTIONS,
  SECONDARY_COLOR_SWATCHES,
  SHOULDER_STYLE_OPTIONS,
  SUIT_PATTERN_OPTIONS,
} from './data/customization';
import {
  CRATE_TIERS,
  CrateRollResult,
  CrateTier,
  RARITY_META,
  WEAPON_CATEGORIES,
  WEAPONS,
  WEAPON_MAP,
  getCategoryStarterWeapons,
  rollMysteryCrate,
} from './data/weapons';
import {
  ATTACHMENT_SLOT_LABELS,
  ATTACHMENTS,
  WEAPON_FINISHES,
  computeEffectiveWeaponStats,
  normalizeAttachments,
} from './data/attachments';
import { detectPlatform, platformLabel } from './utils/platform';
import { CharacterHangarCanvas } from './components/CharacterHangarCanvas';
import { GameArena, MultiplayerSessionParams } from './components/GameArena';
import { MultiplayerModal } from './components/MultiplayerModal';
import { soundEngine } from './audio/soundEngine';

const CHAR_STORAGE_KEY = 'deadzone_arsenal_character_v2';
const PROG_STORAGE_KEY = 'deadzone_arsenal_progression_v2';

type CustomTab = 'identidad' | 'armadura' | 'armas' | 'accesorios' | 'cajas';

export default function App() {
  const [platform, setPlatform] = useState<PlatformType>(() => detectPlatform());

  const [progression, setProgression] = useState<PlayerProgression>(() => {
    try {
      const saved = localStorage.getItem(PROG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PlayerProgression>;
        const validSavedWeapons = (parsed.ownedWeapons || []).filter((w): w is WeaponId =>
          Boolean(WEAPON_MAP[w as WeaponId])
        );
        const mergedOwned = Array.from(
          new Set<WeaponId>([...getCategoryStarterWeapons(), ...validSavedWeapons])
        );
        return {
          credits: typeof parsed.credits === 'number' ? parsed.credits : DEFAULT_PROGRESSION.credits,
          ownedWeapons: mergedOwned,
          ownedAttachments: Array.from(
            new Set([
              'red_dot',
              ...(Array.isArray(parsed.ownedAttachments) ? parsed.ownedAttachments : []),
            ])
          ),
          ownedFinishes: Array.from(
            new Set<WeaponFinish>([
              'factory',
              ...((Array.isArray(parsed.ownedFinishes) ? parsed.ownedFinishes : []).filter(Boolean) as WeaponFinish[]),
            ])
          ),
          weaponAttachments: parsed.weaponAttachments || {},
          weaponFinishes: parsed.weaponFinishes || {},
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_PROGRESSION;
  });

  const [character, setCharacter] = useState<CharacterConfig>(() => {
    try {
      const saved = localStorage.getItem(CHAR_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CharacterConfig>;
        const candidate = parsed.starterWeaponId as WeaponId | undefined;
        const safeStarter =
          candidate && WEAPON_MAP[candidate] && progression.ownedWeapons.includes(candidate)
            ? candidate
            : progression.ownedWeapons.includes(DEFAULT_CHARACTER.starterWeaponId)
            ? DEFAULT_CHARACTER.starterWeaponId
            : progression.ownedWeapons[0] || 'knife_combat';
        return { ...DEFAULT_CHARACTER, ...parsed, starterWeaponId: safeStarter };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_CHARACTER;
  });

  const [selectedCategory, setSelectedCategory] = useState<WeaponCategory>(() => {
    const startW = WEAPON_MAP[character.starterWeaponId];
    return startW ? startW.category : 'Cuerpo a Cuerpo';
  });
  const [previewWeaponId, setPreviewWeaponId] = useState<WeaponId>(() =>
    WEAPON_MAP[character.starterWeaponId] ? character.starterWeaponId : DEFAULT_CHARACTER.starterWeaponId
  );
  const [activeSlotFilter, setActiveSlotFilter] = useState<AttachmentSlot>('optic');
  const [activeTab, setActiveTab] = useState<CustomTab>('identidad');
  const [onlyOwnedWeapons, setOnlyOwnedWeapons] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [lastCrateResult, setLastCrateResult] = useState<CrateRollResult | null>(null);

  const [activeMode, setActiveMode] = useState<GameMode | null>(null);
  const [mpModalOpen, setMpModalOpen] = useState(false);
  const [mpParams, setMpParams] = useState<MultiplayerSessionParams | undefined>(undefined);

  useEffect(() => {
    const syncedChar: CharacterConfig = {
      ...character,
      weaponAttachments: progression.weaponAttachments,
      weaponFinishes: progression.weaponFinishes,
    };
    try {
      localStorage.setItem(CHAR_STORAGE_KEY, JSON.stringify(syncedChar));
    } catch {
      // ignore
    }
  }, [character, progression.weaponAttachments, progression.weaponFinishes]);

  useEffect(() => {
    try {
      localStorage.setItem(PROG_STORAGE_KEY, JSON.stringify(progression));
    } catch {
      // ignore
    }
  }, [progression]);

  useEffect(() => {
    const onResize = () => setPlatform(detectPlatform());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const buyWeapon = (weaponId: WeaponId) => {
    const spec = WEAPON_MAP[weaponId];
    if (progression.ownedWeapons.includes(weaponId)) return;
    if (progression.credits < spec.cost) {
      soundEngine.playEmptyClick();
      return;
    }
    soundEngine.playPickup();
    setProgression((prev) => ({
      ...prev,
      credits: prev.credits - spec.cost,
      ownedWeapons: [...prev.ownedWeapons, weaponId],
    }));
    setCharacter((prev) => ({ ...prev, starterWeaponId: weaponId }));
  };

  const buyOrEquipAttachment = (attId: string, slot: AttachmentSlot) => {
    const isOwned = progression.ownedAttachments.includes(attId);
    const attSpec = ATTACHMENTS.find((a) => a.id === attId);
    if (!attSpec) return;

    const currentForGun = normalizeAttachments(progression.weaponAttachments[previewWeaponId]);
    const isEquipped = currentForGun[slot] === attId;

    if (!isOwned) {
      if (progression.credits < attSpec.cost) {
        soundEngine.playEmptyClick();
        return;
      }
      soundEngine.playPickup();
      setProgression((prev) => ({
        ...prev,
        credits: prev.credits - attSpec.cost,
        ownedAttachments: [...prev.ownedAttachments, attId],
        weaponAttachments: {
          ...prev.weaponAttachments,
          [previewWeaponId]: {
            ...normalizeAttachments(prev.weaponAttachments[previewWeaponId]),
            [slot]: attId,
          },
        },
      }));
      return;
    }

    soundEngine.playReload();
    const resetValue = slot === 'magazine' ? 'standard' : 'none';
    setProgression((prev) => ({
      ...prev,
      weaponAttachments: {
        ...prev.weaponAttachments,
        [previewWeaponId]: {
          ...normalizeAttachments(prev.weaponAttachments[previewWeaponId]),
          [slot]: isEquipped ? resetValue : attId,
        },
      },
    }));
  };

  const buyOrEquipFinish = (finishId: WeaponFinish) => {
    const finSpec = WEAPON_FINISHES.find((f) => f.id === finishId);
    if (!finSpec) return;
    const isOwned = (progression.ownedFinishes || ['factory']).includes(finishId);
    const currentFinish = progression.weaponFinishes?.[previewWeaponId] || 'factory';
    const isEquipped = currentFinish === finishId;

    if (!isOwned) {
      if (progression.credits < finSpec.cost) {
        soundEngine.playEmptyClick();
        return;
      }
      soundEngine.playPickup();
      setProgression((prev) => ({
        ...prev,
        credits: prev.credits - finSpec.cost,
        ownedFinishes: Array.from(new Set([...(prev.ownedFinishes || ['factory']), finishId])),
        weaponFinishes: {
          ...prev.weaponFinishes,
          [previewWeaponId]: finishId,
        },
      }));
      return;
    }

    soundEngine.playReload();
    setProgression((prev) => ({
      ...prev,
      weaponFinishes: {
        ...prev.weaponFinishes,
        [previewWeaponId]: isEquipped ? 'factory' : finishId,
      },
    }));
  };

  const buyMysteryCrate = (tier: CrateTier) => {
    const cfg = CRATE_TIERS[tier];
    if (progression.credits < cfg.creditCost) {
      soundEngine.playEmptyClick();
      return;
    }
    const res = rollMysteryCrate(tier, progression.ownedWeapons);
    setLastCrateResult(res);

    if (res.wonWeapon) {
      soundEngine.playCrateOpen();
      const wonId = res.wonWeapon;
      setProgression((prev) => ({
        ...prev,
        credits: prev.credits - cfg.creditCost + res.rebate,
        ownedWeapons: prev.ownedWeapons.includes(wonId)
          ? prev.ownedWeapons
          : [...prev.ownedWeapons, wonId],
      }));
      setPreviewWeaponId(wonId);
      setSelectedCategory(WEAPON_MAP[wonId].category);
      if (!res.alreadyOwned) {
        setCharacter((prev) => ({ ...prev, starterWeaponId: wonId }));
      }
    } else {
      soundEngine.playEmptyClick();
      setProgression((prev) => ({
        ...prev,
        credits: prev.credits - cfg.creditCost,
      }));
    }
  };

  const handleProgressionUpdate = (next: PlayerProgression) => {
    setProgression(next);
  };

  const startSoloSurvival = () => {
    soundEngine.unlock();
    setMpParams(undefined);
    setActiveMode('survival');
  };

  const startPracticeRange = () => {
    soundEngine.unlock();
    setMpParams(undefined);
    setActiveMode('practice');
  };

  const handleCreateRoom = (roomName: string, subMode: MultiplayerSubMode) => {
    soundEngine.unlock();
    setMpModalOpen(false);
    setMpParams({ action: 'create', roomName, subMode });
    setActiveMode('multiplayer');
  };

  const handleJoinRoom = (roomCode: string) => {
    soundEngine.unlock();
    setMpModalOpen(false);
    setMpParams({ action: 'join', roomCode });
    setActiveMode('multiplayer');
  };

  const syncedCharacter: CharacterConfig = {
    ...character,
    weaponAttachments: progression.weaponAttachments,
    weaponFinishes: progression.weaponFinishes,
  };

  if (activeMode) {
    return (
      <GameArena
        mode={activeMode}
        platform={platform}
        character={syncedCharacter}
        progression={progression}
        onUpdateProgression={handleProgressionUpdate}
        multiplayerParams={mpParams}
        onExit={() => setActiveMode(null)}
      />
    );
  }

  const PlatformIcon = platform === 'mobile' ? Smartphone : platform === 'tablet' ? Tablet : Monitor;
  const inspectedWeapon = WEAPON_MAP[previewWeaponId];
  const isInspectedOwned = progression.ownedWeapons.includes(previewWeaponId);
  const effectiveStats = computeEffectiveWeaponStats(
    previewWeaponId,
    progression.weaponAttachments[previewWeaponId]
  );
  const weaponsInCategory = WEAPONS.filter(
    (w) => w.category === selectedCategory && (!onlyOwnedWeapons || progression.ownedWeapons.includes(w.id))
  );
  const attachmentsInSlot = ATTACHMENTS.filter((a) => a.slot === activeSlotFilter);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b0f15] text-slate-100 flex flex-col">
      {/* 3D Interactive Hangar Viewport */}
      <div className="absolute inset-0 z-0">
        <CharacterHangarCanvas character={syncedCharacter} previewWeaponId={previewWeaponId} />
      </div>

      {/* Top Navigation Bar (Strict 3-zone contract) */}
      <header className="relative z-20 flex items-center justify-between gap-8 px-6 py-4 bg-[#0b0f15]/80 border-b border-slate-800/80">
        <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Deadzone Arsenal
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={startSoloSurvival}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Supervivencia
          </button>
          <button
            type="button"
            onClick={startPracticeRange}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Práctica
          </button>
          <button
            type="button"
            onClick={() => setMpModalOpen(true)}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Multijugador
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={startSoloSurvival}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Jugar Ahora</span>
          </button>
        </div>
      </header>

      {/* Top-Left Minimal Context Info */}
      <div className="pointer-events-none relative z-10 px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="pointer-events-auto max-w-md">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight [text-wrap:balance]">
            Personaliza tu Operador y Arsenal
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <PlatformIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>{platformLabel(platform)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{WEAPON_CATEGORIES.length} Categorías ({WEAPONS.length} Armas)</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-amber-400 font-semibold">
              {progression.credits} Créditos
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {typeof window !== 'undefined' && window.location.protocol !== 'file:' && (
            <a
              href="/api/download-singlefile"
              download="Deadzone-Arsenal-3D.html"
              className="px-3.5 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-400/70 text-xs font-semibold text-white flex items-center gap-2 transition-colors whitespace-nowrap"
              title="Descarga un único archivo .html que se abre directamente en Chrome sin servidor"
            >
              <Download className="w-4 h-4" />
              <span>Descargar 1 Archivo (Chrome)</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setActiveTab('cajas');
              setDockCollapsed(false);
            }}
            className="px-3.5 py-2 rounded-lg bg-[#11161f]/90 hover:bg-slate-800 border border-amber-500/70 text-xs font-semibold text-amber-300 flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Package className="w-4 h-4 text-amber-400" />
            <span>Cajas Aleatorias</span>
          </button>
          <button
            type="button"
            onClick={startPracticeRange}
            className="px-3.5 py-2 rounded-lg bg-[#11161f]/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Target className="w-4 h-4 text-amber-400" />
            <span>Campo de Práctica</span>
          </button>
          <button
            type="button"
            onClick={() => setMpModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#11161f]/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Multijugador</span>
          </button>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div className="mt-auto relative z-20 flex flex-col items-center px-3 pb-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="pointer-events-auto mb-1.5 px-3.5 py-1 rounded-t-lg bg-[#11161f]/95 border border-b-0 border-slate-700 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Mostrar Personalización' : 'Ocultar Controles'}</span>
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-5xl bg-[#11161f]/95 border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden">
            {/* Segmented Tab Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-[#0d1118] overflow-x-auto">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('identidad')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'identidad'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Identidad y Casco</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('armadura')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'armadura'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Traje y Colores</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('armas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'armas'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Categorías de Armas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accesorios')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'accesorios'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Miras, Accesorios y Pinturas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cajas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'cajas'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Cajas Aleatorias</span>
                </button>
              </div>

              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 shrink-0">
                <span>Equipada:</span>
                <span className="text-amber-400 font-semibold">
                  {WEAPON_MAP[character.starterWeaponId].name}
                </span>
              </div>
            </div>

            {/* Dock Content */}
            <div className="p-4 max-h-[40vh] overflow-y-auto">
              {activeTab === 'identidad' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Nombre del Operador</label>
                    <input
                      type="text"
                      maxLength={18}
                      value={character.name}
                      onChange={(e) => setCharacter({ ...character, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#090c10] border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                      placeholder="Ej. Fantasma"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Clase Táctica</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ARMOR_CLASSES.map((cls) => (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => setCharacter({ ...character, armorClass: cls.id })}
                          className={`px-2.5 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                            character.armorClass === cls.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="font-semibold truncate">{cls.label}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {ARMOR_CLASSES.find((c) => c.id === character.armorClass)?.perk}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Casco / Cabeza ({HELMET_OPTIONS.length})</label>
                    <div className="flex flex-wrap gap-1.5">
                      {HELMET_OPTIONS.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setCharacter({ ...character, helmet: h.id })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            character.helmet === h.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Emblema de Pecho</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {EMBLEM_OPTIONS.map((em) => (
                        <button
                          key={em.id}
                          type="button"
                          onClick={() => setCharacter({ ...character, emblem: em.id })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            (character.emblem || 'shield') === em.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {em.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'armadura' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Color Principal de Armadura</label>
                    <div className="flex flex-wrap gap-2">
                      {ARMOR_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => setCharacter({ ...character, armorColor: sw.hex })}
                          title={sw.label}
                          aria-label={sw.label}
                          className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                            character.armorColor === sw.hex
                              ? 'border-amber-400 scale-110'
                              : 'border-slate-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>

                    <label className="block text-xs text-slate-400 mt-3 mb-2">Color Secundario (Guantes / Botas)</label>
                    <div className="flex flex-wrap gap-2">
                      {SECONDARY_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => setCharacter({ ...character, secondaryColor: sw.hex })}
                          title={sw.label}
                          aria-label={sw.label}
                          className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                            (character.secondaryColor || '#475569') === sw.hex
                              ? 'border-amber-400 scale-110'
                              : 'border-slate-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Color de Visor y Luces</label>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => setCharacter({ ...character, accentColor: sw.hex })}
                          title={sw.label}
                          aria-label={sw.label}
                          className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                            character.accentColor === sw.hex
                              ? 'border-white scale-110'
                              : 'border-slate-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>

                    <label className="block text-xs text-slate-400 mt-3 mb-2">Patrón del Traje</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SUIT_PATTERN_OPTIONS.map((pat) => (
                        <button
                          key={pat.id}
                          type="button"
                          onClick={() => setCharacter({ ...character, suitPattern: pat.id })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                            (character.suitPattern || 'solid') === pat.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {pat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Estilo de Hombreras</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SHOULDER_STYLE_OPTIONS.map((sh) => (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => setCharacter({ ...character, shoulderStyle: sh.id })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                            (character.shoulderStyle || 'standard') === sh.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {sh.label}
                        </button>
                      ))}
                    </div>

                    <label className="block text-xs text-slate-400 mt-3 mb-2">Accesorio Dorsal ({BACKPACK_OPTIONS.length})</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BACKPACK_OPTIONS.map((bp) => (
                        <button
                          key={bp.id}
                          type="button"
                          onClick={() => setCharacter({ ...character, backpack: bp.id })}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                            character.backpack === bp.id
                              ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {bp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'armas' && (
                <div className="flex flex-col gap-3">
                  {/* Category Selector & Owned-Only Filter */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {WEAPON_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            const firstInCat = WEAPONS.find(
                              (w) =>
                                w.category === cat.id &&
                                (!onlyOwnedWeapons || progression.ownedWeapons.includes(w.id))
                            );
                            if (firstInCat) setPreviewWeaponId(firstInCat.id);
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                            selectedCategory === cat.id
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setOnlyOwnedWeapons((v) => !v)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                        onlyOwnedWeapons
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-[#090c10] border-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {onlyOwnedWeapons
                        ? `Solo mis armas (${progression.ownedWeapons.length})`
                        : 'Mostrando: Todas / Tienda'}
                    </button>
                  </div>

                  {/* Weapons inside Selected Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {weaponsInCategory.map((w) => {
                      const owned = progression.ownedWeapons.includes(w.id);
                      const isPreview = previewWeaponId === w.id;
                      const isEquippedStarter = character.starterWeaponId === w.id;
                      const rarity = RARITY_META[w.rarity];
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            setPreviewWeaponId(w.id);
                            if (owned) {
                              setCharacter({ ...character, starterWeaponId: w.id });
                            }
                          }}
                          className={`p-2.5 rounded-lg text-left border transition-colors ${
                            isPreview
                              ? 'bg-amber-500/15 border-amber-400 text-white'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-xs truncate">{w.name}</span>
                            {!owned ? (
                              <span className="font-mono-num text-[11px] text-amber-400 flex items-center gap-1 shrink-0">
                                <Lock className="w-3 h-3" /> {w.cost} Cr
                              </span>
                            ) : isEquippedStarter ? (
                              <span className="text-[11px] text-emerald-400 shrink-0">Equipada</span>
                            ) : (
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {w.isCategoryStarter ? 'Inicial' : 'Comprada'}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-400 truncate">{w.caliber}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${rarity.badgeClass}`}
                            >
                              {rarity.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {weaponsInCategory.length === 0 && (
                      <div className="col-span-full p-3 rounded-lg bg-[#090c10] border border-slate-800 text-xs text-slate-400">
                        No tienes armas desbloqueadas en esta categoría todavía. Desactiva &quot;Solo mis armas&quot; para ver la tienda.
                      </div>
                    )}
                  </div>

                  {/* Inspected Weapon Details & Purchase/Equip Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#090c10] border border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-sm text-white">
                          {inspectedWeapon.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                            RARITY_META[inspectedWeapon.rarity].badgeClass
                          }`}
                        >
                          {inspectedWeapon.rarity}
                        </span>
                        <span className="text-xs text-amber-400">· {inspectedWeapon.category}</span>
                        <span className="text-xs text-slate-400">· {inspectedWeapon.caliber}</span>
                        {effectiveStats.powerBonusPct > 0 && (
                          <span className="text-xs text-emerald-400 font-semibold">
                            · +{effectiveStats.powerBonusPct}% Poder por Accesorios
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{inspectedWeapon.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono-num text-slate-300 shrink-0">
                      <div>
                        <div className="text-[10px] text-slate-500">DAÑO</div>
                        <div className="font-bold text-white">
                          {effectiveStats.damage}
                          {inspectedWeapon.pellets > 1 ? `×${inspectedWeapon.pellets}` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">
                          {inspectedWeapon.isMelee ? 'ALCANCE' : 'CARGADOR'}
                        </div>
                        <div className="font-bold text-white">
                          {inspectedWeapon.isMelee ? `${inspectedWeapon.range}m` : effectiveStats.magSize}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">RUIDO</div>
                        <div className="font-bold text-white">{effectiveStats.noiseRadius}m</div>
                      </div>

                      {!isInspectedOwned ? (
                        <button
                          type="button"
                          onClick={() => buyWeapon(previewWeaponId)}
                          disabled={progression.credits < inspectedWeapon.cost}
                          className={`px-3 py-2 rounded-lg font-sans font-semibold text-xs whitespace-nowrap ${
                            progression.credits >= inspectedWeapon.cost
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Comprar ({inspectedWeapon.cost} Cr)
                        </button>
                      ) : !inspectedWeapon.isMelee ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab('accesorios')}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-sans font-semibold text-xs whitespace-nowrap flex items-center gap-1.5"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Poner Miras y Accesorios</span>
                        </button>
                      ) : (
                        <span className="px-3 py-2 rounded-lg bg-slate-800/70 text-emerald-300 font-sans font-semibold text-xs whitespace-nowrap">
                          Sin Munición · Silenciosa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'accesorios' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {(Object.keys(ATTACHMENT_SLOT_LABELS) as AttachmentSlot[]).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setActiveSlotFilter(slot)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
                            activeSlotFilter === slot
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-[#090c10] border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {ATTACHMENT_SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-2">
                      <span>Editando:</span>
                      <select
                        value={previewWeaponId}
                        onChange={(e) => {
                          if (e.target.value) setPreviewWeaponId(e.target.value as WeaponId);
                        }}
                        className="px-2.5 py-1.5 rounded bg-[#090c10] border border-slate-700 text-xs text-amber-400 font-semibold focus:outline-none"
                      >
                        {WEAPONS.filter((w) => progression.ownedWeapons.includes(w.id)).map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} [{w.rarity}] ({w.category})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 3D Weapon Finish / Camo Bar (available on all weapons including Melee) */}
                  <div className="p-2.5 rounded-lg bg-[#090c10] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pintura y Acabado 3D ({inspectedWeapon.name}):</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {WEAPON_FINISHES.map((fin) => {
                        const owned = (progression.ownedFinishes || ['factory']).includes(fin.id);
                        const activeFin = (progression.weaponFinishes?.[previewWeaponId] || 'factory') === fin.id;
                        const canAfford = progression.credits >= fin.cost;
                        return (
                          <button
                            key={fin.id}
                            type="button"
                            onClick={() => buyOrEquipFinish(fin.id)}
                            disabled={!owned && !canAfford}
                            className={`px-2 py-1 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                              activeFin
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : owned
                                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                                : canAfford
                                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/60'
                                : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: fin.swatch }}
                            />
                            <span>{fin.label}</span>
                            {!owned && <span className="font-mono-num text-[10px] text-amber-300">({fin.cost} Cr)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {inspectedWeapon.isMelee ? (
                    <div className="p-3 rounded-lg bg-[#090c10] border border-slate-800 text-xs text-slate-300">
                      <span className="font-semibold text-amber-300">{inspectedWeapon.name}</span> es un arma cuerpo a cuerpo: puedes personalizar su pintura 3D arriba, pero no usa miras ni cargadores. Selecciona un arma de fuego arriba para añadirle miras o culatas.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {attachmentsInSlot.map((att) => {
                        const owned = progression.ownedAttachments.includes(att.id);
                        const equipped = effectiveStats.attachments[att.slot] === att.id;
                        const canAfford = progression.credits >= att.cost;
                        return (
                          <div
                            key={att.id}
                            className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                              equipped
                                ? 'bg-amber-500/15 border-amber-400'
                                : 'bg-[#090c10] border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-xs text-white">{att.name}</div>
                              <div className="text-[11px] text-emerald-400 mt-0.5">{att.statSummary}</div>
                              <p className="text-[11px] text-slate-400 mt-1">{att.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => buyOrEquipAttachment(att.id, att.slot)}
                              disabled={!owned && !canAfford}
                              className={`w-full py-1.5 px-2.5 rounded text-xs font-semibold transition-colors ${
                                equipped
                                  ? 'bg-amber-500 text-slate-950'
                                  : owned
                                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                  : canAfford
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {equipped
                                ? 'Quitar'
                                : owned
                                ? 'Equipar'
                                : `Comprar (${att.cost} Cr)`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'cajas' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {(['standard', 'elite'] as CrateTier[]).map((tier) => {
                    const cfg = CRATE_TIERS[tier];
                    const canAfford = progression.credits >= cfg.creditCost;
                    return (
                      <div
                        key={tier}
                        className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 ${
                          tier === 'elite'
                            ? 'bg-amber-500/10 border-amber-500/60'
                            : 'bg-[#090c10] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                              <Package className="w-4 h-4 text-amber-400" />
                              <span>{cfg.label}</span>
                            </span>
                            <span className="font-mono-num text-xs font-bold text-amber-300">
                              {cfg.creditCost} Cr
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{cfg.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => buyMysteryCrate(tier)}
                          disabled={!canAfford}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            canAfford
                              ? tier === 'elite'
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? `Comprar y Abrir (${cfg.creditCost} Cr)` : 'Créditos insuficientes'}
                        </button>
                      </div>
                    );
                  })}

                  <div className="p-3.5 rounded-lg bg-[#090c10] border border-slate-800 flex flex-col justify-center">
                    {!lastCrateResult ? (
                      <div className="text-center text-xs text-slate-400">
                        Compra una caja aleatoria para intentar conseguir una de las {WEAPONS.length} armas del juego. Puede tocarte un arma de cualquier rareza… ¡o nada!
                      </div>
                    ) : lastCrateResult.wonWeapon ? (
                      (() => {
                        const won = WEAPON_MAP[lastCrateResult.wonWeapon];
                        const rMeta = RARITY_META[won.rarity];
                        return (
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-emerald-400">
                                {lastCrateResult.alreadyOwned
                                  ? `Arma repetida (+${lastCrateResult.rebate} Cr devueltos)`
                                  : '¡NUEVA ARMA DESBLOQUEADA!'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${rMeta.badgeClass}`}>
                                {rMeta.label}
                              </span>
                            </div>
                            <div className="font-display text-base font-bold text-white mt-1">{won.name}</div>
                            <div className="text-[11px] text-amber-300">{won.category} · {won.caliber}</div>
                            <p className="text-[11px] text-slate-400 mt-1">{won.description}</p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center">
                        <div className="font-display text-base font-bold text-red-400">¡Caja Vacía! (Nada)</div>
                        <p className="text-xs text-slate-400 mt-1">
                          No había ningún arma dentro de esta caja. ¡Prueba suerte con otra!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Multiplayer Modal */}
      <MultiplayerModal
        isOpen={mpModalOpen}
        onClose={() => setMpModalOpen(false)}
        playerName={character.name || 'Operador'}
        platform={platform}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
}
