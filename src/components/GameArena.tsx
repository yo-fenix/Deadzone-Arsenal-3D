import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  AlertTriangle,
  Backpack,
  Bomb,
  Car,
  Crosshair,
  Eye,
  Footprints,
  Heart,
  Lightbulb,
  Lock,
  LogOut,
  MessageSquare,
  Package,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  Skull,
  Sliders,
  Smartphone,
  Target,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  AttachmentSlot,
  BossVariantId,
  CharacterConfig,
  ChatMessage,
  GameMode,
  MultiplayerSubMode,
  PlatformType,
  PlayerProgression,
  RemotePlayerState,
  ServerZombieState,
  TrapType,
  VehicleType,
  WeaponAttachments,
  WeaponCategory,
  WeaponFinish,
  WeaponId,
  ZombieAIState,
  ZombieType,
} from '../types/game';
import {
  CRATE_TIERS,
  CrateRollResult,
  CrateTier,
  RARITY_META,
  WEAPON_CATEGORIES,
  WEAPONS,
  WEAPON_MAP,
  pickBossRewardWeapon,
  pickWeightedOwnedWeapon,
  pickWorldCrateWeapon,
  rollMysteryCrate,
} from '../data/weapons';
import { BOSS_ARCHETYPES, getBossForWave } from '../data/bosses';
import {
  ATTACHMENT_MAP,
  ATTACHMENT_SLOT_LABELS,
  ATTACHMENTS,
  WEAPON_FINISHES,
  WEAPON_FINISH_MAP,
  computeEffectiveWeaponStats,
  normalizeAttachments,
} from '../data/attachments';
import {
  ARMOR_CLASSES,
  BACKPACK_OPTIONS,
  EMBLEM_OPTIONS,
  HELMET_OPTIONS,
  SUIT_PATTERN_OPTIONS,
  getArmorStats,
} from '../data/customization';
import { soundEngine } from '../audio/soundEngine';
import { createProceduralTextures } from '../three/textures';
import {
  BearTrapRig,
  BossZombieRig,
  buildBearTrapMesh,
  buildBossZombieMesh,
  buildCharacterMesh,
  buildDrivableVehicleMesh,
  buildHandGrenadeMesh,
  buildLandmineMesh,
  buildSupplyCrateMesh,
  buildTargetDummyMesh,
  buildWeaponMesh,
  buildWeaponPickupMesh,
  buildZombieMesh,
  CharacterRig,
  DrivableVehicleRig,
  LandmineRig,
  TargetDummyRig,
  ZombieRig,
} from '../three/models';
import { ArenaBuildResult, buildPracticeRange, buildSurvivalArena } from '../three/worldBuilder';
import {
  hasLineOfSightXZ,
  resolveCircleAABBCollisions,
  steerAroundWalls,
} from '../three/arenaColliders';
import {
  createStudioRenderer,
  detectSoftwareWebGL,
  disposeObjectTree,
  scheduleAfterDraw,
  setupStudioEnvironment,
} from '../three/webglUtils';
import { platformLabel } from '../utils/platform';

export interface MultiplayerSessionParams {
  action: 'create' | 'join';
  roomCode?: string;
  roomName?: string;
  subMode?: MultiplayerSubMode;
}

interface GameArenaProps {
  mode: GameMode;
  platform: PlatformType;
  character: CharacterConfig;
  progression: PlayerProgression;
  onUpdateProgression: (next: PlayerProgression) => void;
  multiplayerParams?: MultiplayerSessionParams;
  onExit: () => void;
}

interface WeaponAmmoState {
  mag: number;
  reserve: number;
}

interface LocalZombieEntity {
  id: string;
  type: ZombieType;
  rig: ZombieRig | BossZombieRig;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  speed: number;
  isCrawling: boolean;
  lastAttackAt: number;
  walkPhase: number;
  aiState: ZombieAIState;
  targetPos: THREE.Vector3;
  investigateUntil: number;
  wanderTarget: THREE.Vector3;
  nextWanderAt: number;
  isBoss?: boolean;
  bossVariant?: BossVariantId;
  bossTier?: number;
  bossName?: string;
  bossTitle?: string;
  bossWeakPointLabel?: string;
  bossWeakHint?: string;
  bossColorHex?: string;
  weakSpotMult?: number;
  armorResist?: number;
  meleeDamage?: number;
  slowedUntil?: number;
  lastBossRamAt?: number;
}

interface ActiveBossHudState {
  name: string;
  title: string;
  weakPointLabel: string;
  weakPointHint: string;
  weakPointColorHex: string;
  tier: number;
  hp: number;
  maxHp: number;
}

interface PracticeTargetEntity {
  id: string;
  rig: TargetDummyRig;
  hp: number;
  maxHp: number;
  baseX: number;
  baseZ: number;
  moving: boolean;
  armored: boolean;
  speed: number;
  phase: number;
  respawnAt: number;
}

interface TracerEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface GrenadeProjectile {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  radius: number;
  isHandGrenade?: boolean;
  isRocket?: boolean;
}

interface PlacedTrapEntity {
  id: string;
  type: TrapType;
  pos: THREE.Vector3;
  rig: BearTrapRig | LandmineRig;
  triggered: boolean;
  removeAt: number;
}

interface StoneProjectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  bounced: boolean;
}

interface AcidSpitProjectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  damage: number;
}

interface DrivableVehicleEntity {
  id: string;
  type: VehicleType;
  name: string;
  rig: DrivableVehicleRig;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  hp: number;
  maxHp: number;
  steerAngle: number;
  headlightsOn: boolean;
  lastHornAt: number;
  lastRamAt: number;
}

interface NoiseRingEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface ShellCasing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
}

interface ParticleBurst {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

type PickupKind = 'medkit' | 'ammo' | 'scrap' | 'stones' | 'grenade' | 'trap';

interface PickupEntity {
  mesh: THREE.Group;
  kind: PickupKind;
  life: number;
}

interface WeaponWorldDrop {
  id: string;
  weaponId: WeaponId;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  collected: boolean;
  respawnAt: number;
}

interface SupplyCrateEntity {
  id: string;
  root: THREE.Group;
  lid: THREE.Mesh;
  indicator: THREE.Mesh;
  pos: THREE.Vector3;
  opened: boolean;
  respawnAt: number;
}

interface FloatingDamage {
  id: number;
  text: string;
  x: number;
  y: number;
  headshot: boolean;
  createdAt: number;
}

interface ProjectedTag {
  id: string;
  name: string;
  platform: PlatformType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camQuat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export const GameArena: React.FC<GameArenaProps> = ({
  mode,
  platform,
  character,
  progression,
  onUpdateProgression,
  multiplayerParams,
  onExit,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const armorStats = getArmorStats(character.armorClass);

  // Only weapons owned by the player appear!
  // Survival starts with melee only (unless the player legitimately earned & equipped a firearm starter).
  const safeStarter: WeaponId = progression.ownedWeapons.includes(character.starterWeaponId)
    ? character.starterWeaponId
    : 'machete_apoc';

  const initialUnlocked: WeaponId[] =
    mode === 'survival'
      ? Array.from(new Set<WeaponId>(['knife_combat', safeStarter]))
      : Array.from(new Set<WeaponId>(progression.ownedWeapons));

  const initialWeaponId: WeaponId = progression.ownedWeapons.includes(safeStarter)
    ? safeStarter
    : initialUnlocked[0] || 'knife_combat';

  // HUD State
  const [hp, setHp] = useState(armorStats.maxHp);
  const [maxHp, setMaxHp] = useState(armorStats.maxHp);
  const [stamina, setStamina] = useState(100);
  const [scrap, setScrap] = useState(mode === 'survival' ? 120 : 9999);
  const [medkits, setMedkits] = useState(mode === 'survival' ? 1 : 3);
  const [stones, setStones] = useState(5);
  const [grenadesCount, setGrenadesCount] = useState(mode === 'practice' ? 99 : 2);
  const [bearTraps, setBearTraps] = useState(mode === 'practice' ? 99 : 2);
  const [landmines, setLandmines] = useState(mode === 'practice' ? 99 : 1);
  const [selectedTrap, setSelectedTrap] = useState<TrapType>('bear_trap');
  const [isCrouching, setIsCrouching] = useState(false);
  const [noiseLabel, setNoiseLabel] = useState<'Silencio' | 'Sigilo' | 'Pasos' | 'Ruido Alto'>('Silencio');
  const [noiseLevelPct, setNoiseLevelPct] = useState(0);
  const [nearPrompt, setNearPrompt] = useState<string | null>(null);
  const [lootToast, setLootToast] = useState<string | null>(null);

  const [kills, setKills] = useState(0);
  const [headshots, setHeadshots] = useState(0);
  const [wave, setWave] = useState(1);
  const [waveRemainingCount, setWaveRemainingCount] = useState(mode === 'survival' ? 10 : 0);
  const [bossesDefeated, setBossesDefeated] = useState(0);
  const [activeBoss, setActiveBoss] = useState<ActiveBossHudState | null>(null);
  const [waveBanner, setWaveBanner] = useState<string | null>(
    mode === 'practice'
      ? 'Campo de Práctica — Tus armas y accesorios listos'
      : mode === 'survival'
      ? 'Oleada 1 — Empieza cuerpo a cuerpo; consigue armas de fuego en cajas o tienda · Jefe cada 5 oleadas'
      : null
  );
  const [activeWeaponId, setActiveWeaponId] = useState<WeaponId>(initialWeaponId);
  const [unlockedWeapons, setUnlockedWeapons] = useState<WeaponId[]>(initialUnlocked);
  const [ownedAttachments, setOwnedAttachments] = useState<string[]>(
    mode === 'practice' ? ATTACHMENTS.map((a) => a.id) : progression.ownedAttachments
  );
  const [ownedFinishes, setOwnedFinishes] = useState<WeaponFinish[]>(
    mode === 'practice' ? WEAPON_FINISHES.map((f) => f.id) : progression.ownedFinishes || ['factory']
  );
  const [weaponAttachments, setWeaponAttachments] = useState<Partial<Record<WeaponId, WeaponAttachments>>>(
    progression.weaponAttachments || {}
  );
  const [weaponFinishes, setWeaponFinishes] = useState<Partial<Record<WeaponId, WeaponFinish>>>(
    progression.weaponFinishes || {}
  );
  const [ammoState, setAmmoState] = useState<Record<WeaponId, WeaponAmmoState>>(() => {
    const map = {} as Record<WeaponId, WeaponAmmoState>;
    WEAPONS.forEach((w) => {
      const eff = computeEffectiveWeaponStats(w.id, progression.weaponAttachments?.[w.id]);
      map[w.id] = {
        mag: eff.magSize,
        reserve: mode === 'survival' ? eff.magSize : eff.reserveMax,
      };
    });
    return map;
  });

  const [isReloading, setIsReloading] = useState(false);
  const [isAds, setIsAds] = useState(false);
  const [extraZoom, setExtraZoom] = useState(false);
  const [cameraPerspective, setCameraPerspective] = useState<'1p' | '3p'>('1p');
  const [pointerLocked, setPointerLocked] = useState(false);
  const [touchMode, setTouchMode] = useState<boolean>(platform !== 'desktop');
  const [autoFireMobile, setAutoFireMobile] = useState<boolean>(platform !== 'desktop');
  const [muted, setMuted] = useState(soundEngine.muted);
  const [gameOver, setGameOver] = useState(false);

  // Modals: Mesa de Trabajo [B] & Inventario [I]
  const [showArmory, setShowArmory] = useState(false);
  const [armoryTab, setArmoryTab] = useState<'armas' | 'accesorios' | 'cajas'>('armas');
  const [armoryCategory, setArmoryCategory] = useState<WeaponCategory | 'Todas'>('Todas');
  const [armorySlot, setArmorySlot] = useState<AttachmentSlot>('optic');
  const [onlyOwnedArmory, setOnlyOwnedArmory] = useState(true);
  const [practiceShowAll, setPracticeShowAll] = useState(false);
  const [lastMatchCrateResult, setLastMatchCrateResult] = useState<CrateRollResult | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [drivingVehicle, setDrivingVehicle] = useState<{
    name: string;
    speedKmh: number;
    hp: number;
    maxHp: number;
    headlights: boolean;
  } | null>(null);

  const [hitMarker, setHitMarker] = useState<'none' | 'body' | 'head'>('none');
  const [damageFlash, setDamageFlash] = useState(false);
  const [floatingDmgs, setFloatingDmgs] = useState<FloatingDamage[]>([]);
  const [killFeed, setKillFeed] = useState<{ id: number; text: string }[]>([]);

  const [practiceStats, setPracticeStats] = useState({
    shots: 0,
    hits: 0,
    lastDamage: 0,
    targetsDown: 0,
  });

  const [roomCode, setRoomCode] = useState<string>('');
  const [roomSubMode, setRoomSubMode] = useState<MultiplayerSubMode>(
    multiplayerParams?.subMode || 'coop'
  );
  const [mpStatus, setMpStatus] = useState<string>(
    mode === 'multiplayer' ? 'Conectando al servidor...' : ''
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [remotePlayersList, setRemotePlayersList] = useState<RemotePlayerState[]>([]);
  const [projectedTags, setProjectedTags] = useState<ProjectedTag[]>([]);

  // Mutable Engine Refs
  const progressionRef = useRef<PlayerProgression>(progression);
  useEffect(() => {
    progressionRef.current = progression;
  }, [progression]);

  const engineRef = useRef({
    hp: armorStats.maxHp,
    maxHp: armorStats.maxHp,
    stamina: 100,
    scrap: mode === 'survival' ? 120 : 9999,
    medkits: mode === 'survival' ? 1 : 3,
    stones: 5,
    grenadesCount: mode === 'practice' ? 99 : 2,
    bearTraps: mode === 'practice' ? 99 : 2,
    landmines: mode === 'practice' ? 99 : 1,
    selectedTrap: 'bear_trap' as TrapType,
    isCrouching: false,
    kills: 0,
    headshots: 0,
    wave: 1,
    bossesDefeated: 0,
    activeWeaponId: initialWeaponId,
    unlockedWeapons: new Set<WeaponId>(initialUnlocked),
    ownedAttachments: new Set<string>(
      mode === 'practice' ? ATTACHMENTS.map((a) => a.id) : progression.ownedAttachments
    ),
    ownedFinishes: new Set<WeaponFinish>(
      mode === 'practice' ? WEAPON_FINISHES.map((f) => f.id) : progression.ownedFinishes || ['factory']
    ),
    weaponAttachments: { ...(progression.weaponAttachments || {}) } as Partial<Record<WeaponId, WeaponAttachments>>,
    weaponFinishes: { ...(progression.weaponFinishes || {}) } as Partial<Record<WeaponId, WeaponFinish>>,
    ammo: {} as Record<WeaponId, WeaponAmmoState>,
    isReloading: false,
    reloadEndsAt: 0,
    lastShotAt: 0,
    meleeSwingStartedAt: 0,
    meleeSwingUntil: 0,
    lastStoneAt: 0,
    lastGrenadeAt: 0,
    lastTrapAt: 0,
    isFiring: false,
    isAds: false,
    adsBlend: 0,
    extraZoom: false,
    perspective: '1p' as '1p' | '3p',
    touchMode: platform !== 'desktop',
    autoFireMobile: platform !== 'desktop',
    gameOver: false,
    modalOpen: false,
    chatOpen: false,
    pos: new THREE.Vector3(0, 0, mode === 'practice' ? 4 : 0),
    velY: 0,
    onGround: true,
    yaw: 0,
    pitch: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    viewBob: 0,
    keys: {} as Record<string, boolean>,
    joyVec: { x: 0, y: 0 },
    joyTouchId: null as number | null,
    lookTouchId: null as number | null,
    lookLast: { x: 0, y: 0 },
    triggerFireOnce: false,
    throwStoneRequested: false,
    throwGrenadeRequested: false,
    placeTrapRequested: false,
    interactRequested: false,
    resetTargetsRequested: false,
    rebuildWeaponRequested: false,
    restartRequested: false,
    drivingVehicleId: null as string | null,
    toggleHeadlightsRequested: false,
    hornRequested: false,
  });

  useEffect(() => {
    WEAPONS.forEach((w) => {
      const eff = computeEffectiveWeaponStats(w.id, engineRef.current.weaponAttachments[w.id]);
      engineRef.current.ammo[w.id] = {
        mag: eff.magSize,
        reserve: mode === 'survival' ? eff.magSize : eff.reserveMax,
      };
    });
    if (mode === 'survival') {
      const t = window.setTimeout(() => setWaveBanner(null), 4400);
      return () => window.clearTimeout(t);
    }
  }, [mode]);

  useEffect(() => {
    engineRef.current.touchMode = touchMode;
  }, [touchMode]);

  useEffect(() => {
    engineRef.current.autoFireMobile = autoFireMobile;
  }, [autoFireMobile]);

  useEffect(() => {
    engineRef.current.perspective = cameraPerspective;
  }, [cameraPerspective]);

  useEffect(() => {
    engineRef.current.isCrouching = isCrouching;
  }, [isCrouching]);

  useEffect(() => {
    const anyModal = showArmory || showInventory;
    engineRef.current.modalOpen = anyModal;
    if (anyModal) {
      engineRef.current.isAds = false;
      engineRef.current.isFiring = false;
      setIsAds(false);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, [showArmory, showInventory]);

  useEffect(() => {
    engineRef.current.chatOpen = chatOpen;
    if (chatOpen && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [chatOpen]);

  const wsRef = useRef<WebSocket | null>(null);
  const myPlayerIdRef = useRef<string>('');
  const toastTimerRef = useRef<number>(0);

  const showLootToast = (msg: string) => {
    setLootToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setLootToast(null), 2800);
  };

  const awardCredits = (amount: number) => {
    const cur = progressionRef.current;
    const next = { ...cur, credits: cur.credits + amount };
    progressionRef.current = next;
    onUpdateProgression(next);
  };

  const addKillFeed = (text: string) => {
    const id = Date.now() + Math.random();
    setKillFeed((prev) => [{ id, text }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setKillFeed((prev) => prev.filter((k) => k.id !== id));
    }, 4000);
  };

  const switchWeapon = (id: WeaponId) => {
    const eng = engineRef.current;
    if (!eng.unlockedWeapons.has(id)) return;
    if (eng.activeWeaponId === id) return;
    eng.activeWeaponId = id;
    eng.isReloading = false;
    eng.extraZoom = false;
    if (WEAPON_MAP[id]?.isMelee) {
      eng.isAds = false;
      setIsAds(false);
    }
    eng.rebuildWeaponRequested = true;
    setExtraZoom(false);
    setIsReloading(false);
    setActiveWeaponId(id);
    soundEngine.playReload();
  };

  const triggerReload = () => {
    const eng = engineRef.current;
    if (eng.isReloading || eng.gameOver) return;
    if (WEAPON_MAP[eng.activeWeaponId]?.isMelee) return;
    const eff = computeEffectiveWeaponStats(eng.activeWeaponId, eng.weaponAttachments[eng.activeWeaponId]);
    const st = eng.ammo[eng.activeWeaponId];
    if (!st || st.mag >= eff.magSize) return;
    if (mode !== 'practice' && st.reserve <= 0) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.isReloading = true;
    eng.reloadEndsAt = performance.now() + eff.reloadSec * 1000;
    setIsReloading(true);
    soundEngine.playReload();
  };

  const triggerThrowStone = () => {
    const eng = engineRef.current;
    if (eng.gameOver || eng.modalOpen || eng.chatOpen || eng.drivingVehicleId) return;
    if (mode !== 'practice' && eng.stones <= 0) {
      soundEngine.playEmptyClick();
      showLootToast('Sin piedras — busca en las ruinas o fabrica en Mesa [B]');
      return;
    }
    const now = performance.now();
    if (now - eng.lastStoneAt < 450) return;
    eng.lastStoneAt = now;
    eng.throwStoneRequested = true;
  };

  const triggerThrowGrenade = () => {
    const eng = engineRef.current;
    if (eng.gameOver || eng.modalOpen || eng.chatOpen || eng.drivingVehicleId) return;
    if (mode !== 'practice' && eng.grenadesCount <= 0) {
      soundEngine.playEmptyClick();
      showLootToast('Sin granadas — saquea cajas o fabrica en Mesa [B]');
      return;
    }
    const now = performance.now();
    if (now - eng.lastGrenadeAt < 550) return;
    eng.lastGrenadeAt = now;
    soundEngine.playPinPull();
    eng.throwGrenadeRequested = true;
  };

  const triggerPlaceTrap = () => {
    const eng = engineRef.current;
    if (eng.gameOver || eng.modalOpen || eng.chatOpen || eng.drivingVehicleId) return;
    const isBear = eng.selectedTrap === 'bear_trap';
    const available = isBear ? eng.bearTraps : eng.landmines;
    if (mode !== 'practice' && available <= 0) {
      soundEngine.playEmptyClick();
      showLootToast(
        isBear
          ? 'Sin Trampas de Osos — cambia con [Y] o fabrica en Mesa [B]'
          : 'Sin Minas Explosivas — cambia con [Y] o fabrica en Mesa [B]'
      );
      return;
    }
    const now = performance.now();
    if (now - eng.lastTrapAt < 450) return;
    eng.lastTrapAt = now;
    soundEngine.playTrapPlace();
    eng.placeTrapRequested = true;
  };

  const cycleTrapType = () => {
    const eng = engineRef.current;
    const next: TrapType = eng.selectedTrap === 'bear_trap' ? 'landmine' : 'bear_trap';
    eng.selectedTrap = next;
    setSelectedTrap(next);
    showLootToast(
      next === 'bear_trap'
        ? `Trampa equipada: Cepo para Osos (${mode === 'practice' ? '∞' : eng.bearTraps})`
        : `Trampa equipada: Mina Explosiva (${mode === 'practice' ? '∞' : eng.landmines})`
    );
  };

  const usePortableMedkit = () => {
    const eng = engineRef.current;
    if (eng.gameOver) return;
    if (eng.medkits <= 0) {
      soundEngine.playEmptyClick();
      showLootToast('Sin botiquines en inventario');
      return;
    }
    if (eng.hp >= eng.maxHp) {
      showLootToast('Salud al máximo');
      return;
    }
    eng.medkits -= 1;
    eng.hp = Math.min(eng.maxHp, eng.hp + 50);
    setMedkits(eng.medkits);
    setHp(eng.hp);
    soundEngine.playPickup();
    showLootToast('+50 Salud restaurada con Botiquín');
  };

  const buyOrEquipWeapon = (id: WeaponId) => {
    const eng = engineRef.current;
    const spec = WEAPON_MAP[id];
    if (eng.unlockedWeapons.has(id)) {
      switchWeapon(id);
      setShowArmory(false);
      return;
    }
    if (eng.scrap < spec.cost) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= spec.cost;
    setScrap(eng.scrap);
    eng.unlockedWeapons.add(id);
    setUnlockedWeapons(Array.from(eng.unlockedWeapons));
    const eff = computeEffectiveWeaponStats(id, eng.weaponAttachments[id]);
    eng.ammo[id] = { mag: eff.magSize, reserve: eff.magSize };
    setAmmoState({ ...eng.ammo });
    soundEngine.playPickup();
    switchWeapon(id);
    showLootToast(`Compraste ${spec.name}`);
  };

  const buyOrEquipAttachmentInGame = (attId: string, slot: AttachmentSlot) => {
    const eng = engineRef.current;
    const attSpec = ATTACHMENT_MAP[attId];
    if (!attSpec) return;

    const wId = eng.activeWeaponId;
    const current = normalizeAttachments(eng.weaponAttachments[wId]);
    const isOwned = eng.ownedAttachments.has(attId) || mode === 'practice';
    const isEquipped = current[slot] === attId;

    if (!isOwned) {
      if (eng.scrap < attSpec.cost) {
        soundEngine.playEmptyClick();
        return;
      }
      eng.scrap -= attSpec.cost;
      setScrap(eng.scrap);
      eng.ownedAttachments.add(attId);
      setOwnedAttachments(Array.from(eng.ownedAttachments));
    }

    const resetValue = slot === 'magazine' ? 'standard' : 'none';
    const nextForGun: WeaponAttachments = {
      ...current,
      [slot]: isEquipped ? resetValue : attId,
    };
    eng.weaponAttachments = { ...eng.weaponAttachments, [wId]: nextForGun };
    setWeaponAttachments({ ...eng.weaponAttachments });
    eng.rebuildWeaponRequested = true;

    // Update magazine cap if extended mag changed
    const eff = computeEffectiveWeaponStats(wId, nextForGun);
    const curAmmo = eng.ammo[wId];
    if (curAmmo && curAmmo.mag > eff.magSize) {
      curAmmo.mag = eff.magSize;
    }
    setAmmoState({ ...eng.ammo });

    if (mode !== 'practice') {
      const prog = progressionRef.current;
      const nextProg: PlayerProgression = {
        ...prog,
        ownedAttachments: Array.from(new Set([...prog.ownedAttachments, ...Array.from(eng.ownedAttachments)])),
        weaponAttachments: eng.weaponAttachments,
      };
      progressionRef.current = nextProg;
      onUpdateProgression(nextProg);
    }

    soundEngine.playReload();
    showLootToast(`${isEquipped ? 'Quitado' : 'Equipado'}: ${attSpec.name}`);
  };

  const buyOrEquipFinishInGame = (finishId: WeaponFinish) => {
    const eng = engineRef.current;
    const finSpec = WEAPON_FINISH_MAP[finishId];
    if (!finSpec) return;

    const wId = eng.activeWeaponId;
    const isOwned = eng.ownedFinishes.has(finishId) || mode === 'practice';
    const current = eng.weaponFinishes[wId] || 'factory';
    const isEquipped = current === finishId;

    if (!isOwned) {
      if (eng.scrap < finSpec.cost) {
        soundEngine.playEmptyClick();
        return;
      }
      eng.scrap -= finSpec.cost;
      setScrap(eng.scrap);
      eng.ownedFinishes.add(finishId);
      setOwnedFinishes(Array.from(eng.ownedFinishes));
    }

    const nextFinish: WeaponFinish = isEquipped ? 'factory' : finishId;
    eng.weaponFinishes = { ...eng.weaponFinishes, [wId]: nextFinish };
    setWeaponFinishes({ ...eng.weaponFinishes });
    eng.rebuildWeaponRequested = true;

    if (mode !== 'practice') {
      const prog = progressionRef.current;
      const nextProg: PlayerProgression = {
        ...prog,
        ownedFinishes: Array.from(new Set([...(prog.ownedFinishes || ['factory']), ...Array.from(eng.ownedFinishes)])),
        weaponFinishes: eng.weaponFinishes,
      };
      progressionRef.current = nextProg;
      onUpdateProgression(nextProg);
    }

    soundEngine.playReload();
    showLootToast(`Pintura 3D: ${isEquipped ? 'Acero Fábrica' : finSpec.label}`);
  };

  const buyCrateInGame = (tier: CrateTier) => {
    const eng = engineRef.current;
    const cfg = CRATE_TIERS[tier];
    if (mode !== 'practice' && eng.scrap < cfg.scrapCost) {
      soundEngine.playEmptyClick();
      return;
    }
    if (mode !== 'practice') {
      eng.scrap -= cfg.scrapCost;
      setScrap(eng.scrap);
    }

    const res = rollMysteryCrate(tier, Array.from(eng.unlockedWeapons));
    setLastMatchCrateResult(res);

    if (res.wonWeapon) {
      soundEngine.playCrateOpen();
      const wonId = res.wonWeapon;
      const wonSpec = WEAPON_MAP[wonId];
      if (!eng.unlockedWeapons.has(wonId)) {
        eng.unlockedWeapons.add(wonId);
        setUnlockedWeapons(Array.from(eng.unlockedWeapons));
      }
      const eff = computeEffectiveWeaponStats(wonId, eng.weaponAttachments[wonId]);
      eng.ammo[wonId] = {
        mag: eff.magSize,
        reserve: Math.min(eff.reserveMax, (eng.ammo[wonId]?.reserve || 0) + eff.magSize),
      };
      setAmmoState({ ...eng.ammo });
      switchWeapon(wonId);
      showLootToast(`¡Caja [${wonSpec.rarity}]: Ganaste ${wonSpec.name}!`);

      if (mode !== 'practice') {
        const prog = progressionRef.current;
        if (!prog.ownedWeapons.includes(wonId)) {
          const nextProg: PlayerProgression = {
            ...prog,
            ownedWeapons: [...prog.ownedWeapons, wonId],
          };
          progressionRef.current = nextProg;
          onUpdateProgression(nextProg);
        }
      }
    } else {
      soundEngine.playEmptyClick();
      showLootToast('¡Caja Vacía! No salió ningún arma (Nada)');
    }
  };

  const craftAmmo = () => {
    const eng = engineRef.current;
    const id = eng.activeWeaponId;
    const spec = WEAPON_MAP[id];
    if (spec.isMelee) {
      soundEngine.playEmptyClick();
      showLootToast(`${spec.name} es cuerpo a cuerpo y no usa munición`);
      return;
    }
    const eff = computeEffectiveWeaponStats(id, eng.weaponAttachments[id]);
    if (eng.scrap < 95) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= 95;
    setScrap(eng.scrap);
    eng.ammo[id].reserve = Math.min(eff.reserveMax, eng.ammo[id].reserve + eff.magSize);
    setAmmoState({ ...eng.ammo });
    soundEngine.playPickup();
    showLootToast(`Fabricaste +${eff.magSize} balas para ${spec.name}`);
  };

  const craftMedkit = () => {
    const eng = engineRef.current;
    if (eng.scrap < 80 || eng.medkits >= 5) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= 80;
    eng.medkits += 1;
    setScrap(eng.scrap);
    setMedkits(eng.medkits);
    soundEngine.playPickup();
    showLootToast('Botiquín portátil añadido al Inventario [I]');
  };

  const gatherStonesCraft = () => {
    const eng = engineRef.current;
    if (eng.scrap < 20 || eng.stones >= 12) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= 20;
    eng.stones = Math.min(12, eng.stones + 4);
    setScrap(eng.scrap);
    setStones(eng.stones);
    soundEngine.playPickup();
  };

  const craftGrenades = () => {
    const eng = engineRef.current;
    if (eng.scrap < 90 || eng.grenadesCount >= 6) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= 90;
    eng.grenadesCount = Math.min(6, eng.grenadesCount + 2);
    setScrap(eng.scrap);
    setGrenadesCount(eng.grenadesCount);
    soundEngine.playPickup();
    showLootToast('+2 Granadas de Mano añadidas [X]');
  };

  const craftBearTraps = () => {
    const eng = engineRef.current;
    if (eng.scrap < 70 || eng.bearTraps >= 6) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= 70;
    eng.bearTraps = Math.min(6, eng.bearTraps + 2);
    setScrap(eng.scrap);
    setBearTraps(eng.bearTraps);
    soundEngine.playPickup();
    showLootToast('+2 Trampas de Osos añadidas [T]');
  };

  const craftLandmines = () => {
    const eng = engineRef.current;
    if (eng.scrap < 110 || eng.landmines >= 6) {
      soundEngine.playEmptyClick();
      return;
    }
    eng.scrap -= 110;
    eng.landmines = Math.min(6, eng.landmines + 2);
    setScrap(eng.scrap);
    setLandmines(eng.landmines);
    soundEngine.playPickup();
    showLootToast('+2 Minas Explosivas añadidas [T]');
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = chatInput.trim();
    if (!txt || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'chat', text: txt }));
    setChatInput('');
  };

  const restartSurvival = () => {
    const eng = engineRef.current;
    eng.hp = eng.maxHp;
    eng.stamina = 100;
    eng.scrap = 120;
    eng.medkits = 1;
    eng.stones = 5;
    eng.grenadesCount = 2;
    eng.bearTraps = 2;
    eng.landmines = 1;
    eng.kills = 0;
    eng.headshots = 0;
    eng.wave = 1;
    eng.bossesDefeated = 0;
    eng.gameOver = false;
    eng.drivingVehicleId = null;
    eng.restartRequested = true;
    setDrivingVehicle(null);
    eng.pos.set(0, 0, 0);
    eng.velY = 0;
    const validStarter: WeaponId = progressionRef.current.ownedWeapons.includes(character.starterWeaponId)
      ? character.starterWeaponId
      : 'machete_apoc';
    const starterReset = Array.from(new Set<WeaponId>(['knife_combat', validStarter]));
    eng.unlockedWeapons = new Set<WeaponId>(starterReset);
    setUnlockedWeapons(starterReset);
    eng.activeWeaponId = validStarter;
    setActiveWeaponId(validStarter);
    eng.rebuildWeaponRequested = true;

    WEAPONS.forEach((w) => {
      const eff = computeEffectiveWeaponStats(w.id, eng.weaponAttachments[w.id]);
      eng.ammo[w.id] = { mag: eff.magSize, reserve: eff.magSize };
    });
    setHp(eng.maxHp);
    setStamina(100);
    setScrap(120);
    setMedkits(1);
    setStones(5);
    setGrenadesCount(2);
    setBearTraps(2);
    setLandmines(1);
    setKills(0);
    setHeadshots(0);
    setWave(1);
    setWaveRemainingCount(10);
    setBossesDefeated(0);
    setActiveBoss(null);
    setAmmoState({ ...eng.ammo });
    setGameOver(false);
    setWaveBanner('Oleada 1 — Empieza cuerpo a cuerpo; consigue armas de fuego en cajas o tienda · Jefe cada 5 oleadas');
    window.setTimeout(() => setWaveBanner(null), 3600);
  };

  // Main Three.js Engine
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = createStudioRenderer(container, isSoftwareGl);
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    const bgHex = mode === 'practice' ? 0x0d131c : 0x151311;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, mode === 'practice' ? 0.009 : 0.0082);

    const envTex = setupStudioEnvironment(renderer, scene);
    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());

    const camera = new THREE.PerspectiveCamera(
      72,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      340
    );
    scene.add(camera);

    const hemi = new THREE.HemisphereLight(
      mode === 'practice' ? 0x93c5fd : 0xc29e7a,
      mode === 'practice' ? 0x1e293b : 0x1c1917,
      0.75
    );
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(mode === 'practice' ? 0xffedd5 : 0xfdba74, 1.45);
    keyLight.position.set(38, 56, 32);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 175;
    keyLight.shadow.camera.left = -85;
    keyLight.shadow.camera.right = 85;
    keyLight.shadow.camera.top = 85;
    keyLight.shadow.camera.bottom = -85;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x64748b, 0.65);
    rimLight.position.set(-24, 18, -28);
    scene.add(rimLight);

    const arena: ArenaBuildResult =
      mode === 'practice'
        ? buildPracticeRange(scene, textures)
        : buildSurvivalArena(scene, textures);

    let localPlayerRig: CharacterRig = buildCharacterMesh(
      character,
      engineRef.current.activeWeaponId,
      engineRef.current.weaponAttachments[engineRef.current.activeWeaponId],
      engineRef.current.weaponFinishes[engineRef.current.activeWeaponId]
    );
    localPlayerRig.root.visible = engineRef.current.perspective === '3p';
    scene.add(localPlayerRig.root);

    const fpWeaponPivot = new THREE.Group();
    camera.add(fpWeaponPivot);
    let fpWeaponGroup: THREE.Group | null = null;
    let fpMuzzleOffset = new THREE.Vector3(0, 0.04, -0.5);
    let fpSightOffset = new THREE.Vector3(0, 0.1, -0.04);

    const muzzleFlashLight = new THREE.PointLight(0xfbbf24, 0, 9, 2);
    scene.add(muzzleFlashLight);

    const muzzleFlashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.92 })
    );
    muzzleFlashMesh.visible = false;
    scene.add(muzzleFlashMesh);

    const rebuildWeaponVisuals = () => {
      const wId = engineRef.current.activeWeaponId;
      const att = engineRef.current.weaponAttachments[wId];
      const fin = engineRef.current.weaponFinishes[wId];
      if (fpWeaponGroup) {
        fpWeaponPivot.remove(fpWeaponGroup);
        disposeObjectTree(fpWeaponGroup);
      }
      const builtFp = buildWeaponMesh(wId, att, fin);
      fpWeaponGroup = builtFp.group;
      fpMuzzleOffset = builtFp.muzzleOffset.clone();
      fpSightOffset = builtFp.sightOffset.clone();
      fpWeaponPivot.add(fpWeaponGroup);

      scene.remove(localPlayerRig.root);
      disposeObjectTree(localPlayerRig.root);
      localPlayerRig = buildCharacterMesh(character, wId, att, fin);
      localPlayerRig.root.visible = engineRef.current.perspective === '3p';
      scene.add(localPlayerRig.root);
    };
    rebuildWeaponVisuals();

    // World entities
    const localZombies = new Map<string, LocalZombieEntity>();
    const mpZombies = new Map<
      string,
      { rig: ZombieRig; targetPos: THREE.Vector3; targetYaw: number; type: ZombieType; walkPhase: number; isCrawling: boolean }
    >();
    const remotePlayers = new Map<
      string,
      {
        rig: CharacterRig;
        targetPos: THREE.Vector3;
        targetYaw: number;
        weaponId: WeaponId;
        state: RemotePlayerState;
        walkPhase: number;
      }
    >();
    const practiceTargets: PracticeTargetEntity[] = [];
    const tracers: TracerEffect[] = [];
    const grenades: GrenadeProjectile[] = [];
    const placedTraps: PlacedTrapEntity[] = [];
    const stonesProj: StoneProjectile[] = [];
    const acidSpits: AcidSpitProjectile[] = [];
    const noiseRings: NoiseRingEffect[] = [];
    const shellCasings: ShellCasing[] = [];
    const particles: ParticleBurst[] = [];
    const pickups: PickupEntity[] = [];
    const crates: SupplyCrateEntity[] = [];
    const weaponDrops: WeaponWorldDrop[] = [];
    const vehicles: DrivableVehicleEntity[] = [];

    const applyZombieCrawlingPose = (rig: ZombieRig) => {
      rig.torso.position.set(0, 0.26, 0.2);
      rig.torso.rotation.x = 1.25;
      rig.headGroup.rotation.x = -0.82;
      rig.leftLeg.rotation.x = 0.35;
      rig.rightLeg.rotation.x = 0.15;
      rig.hpBarGroup.position.y = 0.98;
    };

    const spawnPracticeTargets = () => {
      while (practiceTargets.length > 0) {
        const old = practiceTargets.pop()!;
        scene.remove(old.rig.root);
        disposeObjectTree(old.rig.root);
      }
      const specs = [
        { x: -7, z: -10, moving: false, armored: false, hp: 100 },
        { x: 0, z: -20, moving: false, armored: true, hp: 220 },
        { x: 7, z: -20, moving: true, armored: false, hp: 120 },
        { x: -6, z: -35, moving: true, armored: true, hp: 240 },
        { x: 6, z: -35, moving: false, armored: false, hp: 120 },
        { x: 0, z: -50, moving: false, armored: true, hp: 300 },
      ];
      specs.forEach((s, i) => {
        const rig = buildTargetDummyMesh(textures.targetRing, s.armored);
        rig.root.position.set(s.x, 0, s.z);
        scene.add(rig.root);
        practiceTargets.push({
          id: `pt_${i}`,
          rig,
          hp: s.hp,
          maxHp: s.hp,
          baseX: s.x,
          baseZ: s.z,
          moving: s.moving,
          armored: s.armored,
          speed: 2.2 + (i % 2) * 0.9,
          phase: i * 1.3,
          respawnAt: 0,
        });
      });
    };

    const spawnPickup = (pos: THREE.Vector3, kind: PickupKind) => {
      const g = new THREE.Group();
      if (kind === 'stones') {
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
        for (let i = 0; i < 3; i++) {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), rockMat);
          rock.position.set((i - 1) * 0.14, 0.16, (i % 2) * 0.1);
          g.add(rock);
        }
      } else if (kind === 'grenade') {
        const frag = buildHandGrenadeMesh();
        frag.scale.setScalar(1.9);
        frag.position.y = 0.28;
        g.add(frag);
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(0.28, 0.36, 16),
          new THREE.MeshBasicMaterial({ color: 0x84cc16, side: THREE.DoubleSide })
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.04;
        g.add(halo);
      } else {
        const colorHex =
          kind === 'medkit'
            ? 0x10b981
            : kind === 'ammo'
            ? 0xf59e0b
            : kind === 'trap'
            ? 0xf97316
            : 0x38bdf8;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.3, 0.42),
          new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.75,
            roughness: 0.35,
            metalness: kind === 'scrap' || kind === 'trap' ? 0.7 : 0.2,
          })
        );
        box.position.y = 0.28;
        g.add(box);
      }
      g.position.set(pos.x, 0, pos.z);
      resolveCircleAABBCollisions(g.position, 0.5, arena.colliders, arena.arenaRadius);
      scene.add(g);
      pickups.push({ mesh: g, kind, life: 9999 });
    };

    if (mode === 'practice') {
      spawnPracticeTargets();
    } else if (mode === 'survival') {
      arena.crateSpawns.forEach((pos, idx) => {
        const built = buildSupplyCrateMesh(textures.crate);
        built.root.position.copy(pos);
        scene.add(built.root);
        crates.push({
          id: `crate_${idx}`,
          root: built.root,
          lid: built.lid,
          indicator: built.indicator,
          pos: pos.clone(),
          opened: false,
          respawnAt: 0,
        });
      });

      const kinds: PickupKind[] = ['ammo', 'scrap', 'stones', 'medkit', 'grenade', 'trap'];
      arena.lootSpawns.forEach((pos, idx) => {
        spawnPickup(pos, kinds[idx % kinds.length]);
      });

      // Physical 3D Weapons to discover: ONLY owned weapons appear, with common melee weapons spawning most frequently!
      arena.weaponSpawns.forEach((ws, idx) => {
        const chosenWeaponId = pickWeightedOwnedWeapon(progressionRef.current.ownedWeapons);
        const mesh = buildWeaponPickupMesh(chosenWeaponId);
        mesh.position.copy(ws.pos);
        scene.add(mesh);
        weaponDrops.push({
          id: `wdrop_${idx}`,
          weaponId: chosenWeaponId,
          mesh,
          pos: ws.pos.clone(),
          collected: false,
          respawnAt: 0,
        });
      });
    }

    if (mode === 'survival' || mode === 'multiplayer') {
      arena.vehicleSpawns.forEach((vs, idx) => {
        const rig = buildDrivableVehicleMesh(vs.type, textures.rustedMetal);
        rig.root.position.copy(vs.pos);
        rig.root.rotation.y = vs.yaw;
        scene.add(rig.root);
        vehicles.push({
          id: `veh_${idx}`,
          type: vs.type,
          name: vs.name,
          rig,
          pos: vs.pos.clone(),
          yaw: vs.yaw,
          speed: 0,
          maxSpeed: vs.maxSpeed,
          accel: vs.accel,
          hp: vs.maxHp,
          maxHp: vs.maxHp,
          steerAngle: 0,
          headlightsOn: false,
          lastHornAt: 0,
          lastRamAt: 0,
        });
      });
    }

    let survivalSeq = 1;
    let survivalWaveRemaining = mode === 'survival' ? 10 : 0;
    let survivalNextWaveAt = 0;
    let survivalLastSpawnAt = performance.now();

    const syncWaveCountUi = () => {
      if (mode === 'survival') {
        setWaveRemainingCount(survivalWaveRemaining + localZombies.size);
      }
    };

    const syncBossHud = () => {
      if (mode !== 'survival') return;
      let foundBoss: LocalZombieEntity | null = null;
      for (const z of localZombies.values()) {
        if (z.isBoss && z.hp > 0) {
          foundBoss = z;
          break;
        }
      }
      if (!foundBoss) {
        setActiveBoss(null);
      } else {
        setActiveBoss({
          name: foundBoss.bossName || 'Jefe Mutante',
          title: foundBoss.bossTitle || 'Amenaza Extrema',
          weakPointLabel: foundBoss.bossWeakPointLabel || 'Punto Débil',
          weakPointHint: foundBoss.bossWeakHint || '',
          weakPointColorHex: foundBoss.bossColorHex || '#f97316',
          tier: foundBoss.bossTier || 1,
          hp: Math.max(0, Math.round(foundBoss.hp)),
          maxHp: foundBoss.maxHp,
        });
      }
    };

    const spawnSurvivalBoss = () => {
      const sp = arena.zombieSpawns[Math.floor(Math.random() * arena.zombieSpawns.length)];
      const cfg = getBossForWave(engineRef.current.bossesDefeated, engineRef.current.wave);
      const rig = buildBossZombieMesh(cfg.spec.id, cfg.tier);
      rig.root.position.set(sp.x, 0, sp.z);
      resolveCircleAABBCollisions(rig.root.position, 0.85, arena.colliders, arena.arenaRadius);
      scene.add(rig.root);

      const id = `boss_${survivalSeq++}`;
      localZombies.set(id, {
        id,
        type: 'brute',
        rig,
        hp: cfg.scaledHp,
        maxHp: cfg.scaledHp,
        baseSpeed: cfg.scaledSpeed,
        speed: cfg.scaledSpeed,
        isCrawling: false,
        lastAttackAt: 0,
        walkPhase: 0,
        aiState: 'chasing',
        targetPos: engineRef.current.pos.clone(),
        investigateUntil: 0,
        wanderTarget: engineRef.current.pos.clone(),
        nextWanderAt: performance.now() + 2000,
        isBoss: true,
        bossVariant: cfg.spec.id,
        bossTier: cfg.tier,
        bossName: cfg.spec.name,
        bossTitle: cfg.spec.title,
        bossWeakPointLabel: cfg.spec.weakPointLabel,
        bossWeakHint: cfg.spec.weakPointHint,
        bossColorHex: cfg.spec.weakPointColorHex,
        weakSpotMult: cfg.weakSpotMult,
        armorResist: cfg.scaledArmorResist,
        meleeDamage: cfg.scaledDamage,
      });

      soundEngine.playBossSpawn();
      syncBossHud();
      syncWaveCountUi();
      setWaveBanner(
        `¡JEFE OLEADA ${engineRef.current.wave}: ${cfg.spec.name} (Nivel ${cfg.tier})! · Punto débil: ${cfg.spec.weakPointLabel}`
      );
      window.setTimeout(() => setWaveBanner(null), 5000);
    };

    const spawnSurvivalZombie = (nearCenter = false) => {
      const sp = arena.zombieSpawns[Math.floor(Math.random() * arena.zombieSpawns.length)];
      const curWave = engineRef.current.wave;
      const r = Math.random();
      let type: ZombieType = 'walker';
      if (curWave === 1) {
        if (r > 0.88) type = 'crawler';
        else if (r > 0.72) type = 'runner';
        else if (r > 0.58) type = 'hazmat';
      } else {
        if (r > 0.92 && curWave >= 3) type = 'brute';
        else if (r > 0.84 && curWave >= 2) type = 'bloater';
        else if (r > 0.74 && curWave >= 2) type = 'riot';
        else if (r > 0.62) type = 'spitter';
        else if (r > 0.50) type = 'hazmat';
        else if (r > 0.37) type = 'crawler';
        else if (r > 0.22) type = 'runner';
      }

      const mult = 1 + (curWave - 1) * 0.16;
      const baseHp =
        type === 'brute'
          ? 340
          : type === 'bloater'
          ? 240
          : type === 'riot'
          ? 215
          : type === 'hazmat'
          ? 155
          : type === 'spitter'
          ? 105
          : type === 'crawler'
          ? 85
          : type === 'runner'
          ? 85
          : 115;
      const baseSpd =
        type === 'runner'
          ? 5.4
          : type === 'spitter'
          ? 3.4
          : type === 'walker'
          ? 3.2
          : type === 'hazmat'
          ? 3.0
          : type === 'riot'
          ? 2.8
          : type === 'brute'
          ? 2.6
          : type === 'bloater'
          ? 2.4
          : 2.05;

      const rig = buildZombieMesh(type);
      const sx = nearCenter ? (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 24) : sp.x + (Math.random() - 0.5) * 6;
      const sz = nearCenter ? (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 24) : sp.z + (Math.random() - 0.5) * 6;
      rig.root.position.set(sx, 0, sz);
      resolveCircleAABBCollisions(rig.root.position, 0.52, arena.colliders, arena.arenaRadius);
      if (type === 'crawler') applyZombieCrawlingPose(rig);
      scene.add(rig.root);

      const wanderBound = arena.arenaRadius - 4;
      const id = `sz_${survivalSeq++}`;
      const hpVal = Math.round(baseHp * mult);
      const finalSpeed = baseSpd + Math.min(curWave * 0.08, 1.2);
      localZombies.set(id, {
        id,
        type,
        rig,
        hp: hpVal,
        maxHp: hpVal,
        baseSpeed: finalSpeed,
        speed: finalSpeed,
        isCrawling: type === 'crawler',
        lastAttackAt: 0,
        walkPhase: Math.random() * Math.PI * 2,
        aiState: 'wandering',
        targetPos: rig.root.position.clone(),
        investigateUntil: 0,
        wanderTarget: new THREE.Vector3(
          THREE.MathUtils.clamp(sx + (Math.random() - 0.5) * 26, -wanderBound, wanderBound),
          0,
          THREE.MathUtils.clamp(sz + (Math.random() - 0.5) * 26, -wanderBound, wanderBound)
        ),
        nextWanderAt: performance.now() + 2000,
      });
    };

    if (mode === 'survival') {
      for (let i = 0; i < 8; i++) {
        spawnSurvivalZombie(true);
        survivalWaveRemaining = Math.max(0, survivalWaveRemaining - 1);
      }
      syncWaveCountUi();
      soundEngine.playWaveStart();
    }

    const emitNoise = (origin: THREE.Vector3, radius: number, showRing: boolean, ringColor = 0xf59e0b) => {
      if (showRing) {
        const ringGeo = new THREE.RingGeometry(0.4, 0.58, 28);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: ringColor,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(origin.x, 0.06, origin.z);
        scene.add(ring);
        noiseRings.push({ mesh: ring, life: 0.75, maxLife: 0.75, maxScale: Math.min(radius * 0.45, 11) });
      }

      if (mode !== 'survival') return;
      const now = performance.now();
      for (const z of localZombies.values()) {
        const d = z.rig.root.position.distanceTo(origin);
        if (d <= radius) {
          const distToPlayer = z.rig.root.position.distanceTo(engineRef.current.pos);
          if (z.aiState !== 'chasing' || (showRing && distToPlayer > 4.5)) {
            z.aiState = 'investigating';
            z.targetPos.set(origin.x, 0, origin.z);
            z.investigateUntil = now + 7000;
          }
        }
      }
    };

    const spawnParticles = (pos: THREE.Vector3, colorHex: string | number, count = 8, speed = 4.5) => {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        scene.add(m);
        particles.push({
          mesh: m,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * speed * 2,
            Math.random() * speed * 1.4,
            (Math.random() - 0.5) * speed * 2
          ),
          life: 0.42,
          maxLife: 0.42,
        });
      }
    };

    const spawnShellCasing = (origin: THREE.Vector3, rightVec: THREE.Vector3) => {
      if (isSoftwareGl && shellCasings.length > 10) return;
      const geo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 6);
      const mat = new THREE.MeshStandardMaterial({ color: 0xd4a843, metalness: 0.9, roughness: 0.25 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(origin).addScaledVector(rightVec, 0.14);
      scene.add(m);
      const vel = rightVec
        .clone()
        .multiplyScalar(2.4 + Math.random() * 1.2)
        .add(new THREE.Vector3(0, 2.0 + Math.random() * 1.0, 0));
      shellCasings.push({
        mesh: m,
        vel,
        rotVel: new THREE.Vector3(14, 18, 12),
        life: 1.4,
      });
    };

    const spawnTracer = (start: THREE.Vector3, end: THREE.Vector3, colorHex: string, thickness = 0.02) => {
      const dist = start.distanceTo(end);
      if (dist < 0.2) return;
      const geo = new THREE.CylinderGeometry(thickness, thickness, dist, 6);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(start).lerp(end, 0.5);
      mesh.lookAt(end);
      scene.add(mesh);
      tracers.push({ mesh, life: 0.1, maxLife: 0.1 });
    };

    const pushFloatingDamage = (worldPos: THREE.Vector3, label: string, headshot: boolean) => {
      _v1.copy(worldPos).project(camera);
      if (_v1.z > 1) return;
      const sx = ((_v1.x + 1) / 2) * container.clientWidth;
      const sy = ((-_v1.y + 1) / 2) * container.clientHeight;
      const id = Date.now() + Math.random();
      setFloatingDmgs((prev) => [
        ...prev.slice(-8),
        { id, text: label, x: sx, y: sy, headshot, createdAt: performance.now() },
      ]);
      window.setTimeout(() => {
        setFloatingDmgs((prev) => prev.filter((f) => f.id !== id));
      }, 720);
    };

    const triggerHitMarker = (headshot: boolean) => {
      setHitMarker(headshot ? 'head' : 'body');
      soundEngine.playHit(headshot);
      window.setTimeout(() => setHitMarker('none'), 140);
    };

    // WebSocket Multiplayer Client Setup
    let lastMpSendAt = 0;
    if (mode === 'multiplayer' && multiplayerParams) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setMpStatus('Conectado · Entrando a la sala...');
        if (multiplayerParams.action === 'create') {
          ws.send(
            JSON.stringify({
              type: 'create_room',
              roomName: multiplayerParams.roomName || 'Zona Cero',
              subMode: multiplayerParams.subMode || 'coop',
              player: {
                name: character.name,
                platform,
                character,
                weaponId: engineRef.current.activeWeaponId,
                maxHp: armorStats.maxHp,
              },
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: 'join_room',
              code: multiplayerParams.roomCode,
              player: {
                name: character.name,
                platform,
                character,
                weaponId: engineRef.current.activeWeaponId,
                maxHp: armorStats.maxHp,
              },
            })
          );
        }
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        const t = String(msg.type || '');
        if (t === 'welcome') {
          myPlayerIdRef.current = String(msg.playerId || '');
        } else if (t === 'error') {
          setMpStatus(String(msg.message || 'Error de conexión'));
        } else if (t === 'joined_room') {
          const rm = msg.room as { code: string; name: string; subMode: MultiplayerSubMode; wave: number };
          const sp = msg.spawn as { x: number; z: number; hp: number; maxHp: number };
          setRoomCode(rm.code);
          setRoomSubMode(rm.subMode);
          setWave(rm.wave);
          setMpStatus('');
          engineRef.current.pos.set(sp.x, 0, sp.z);
          engineRef.current.hp = sp.hp;
          engineRef.current.maxHp = sp.maxHp;
          setHp(sp.hp);
          setMaxHp(sp.maxHp);
          if (rm.subMode === 'pvp') {
            const ownedList = Array.from(new Set<WeaponId>(progressionRef.current.ownedWeapons));
            engineRef.current.unlockedWeapons = new Set<WeaponId>(ownedList);
            setUnlockedWeapons(ownedList);
          }
          setWaveBanner(
            rm.subMode === 'coop' ? `Sala ${rm.code} · Co-op Horda` : `Sala ${rm.code} · Arena PvP`
          );
          window.setTimeout(() => setWaveBanner(null), 2800);
        } else if (t === 'chat') {
          const cm = msg.message as ChatMessage;
          setChatMessages((prev) => [...prev.slice(-30), cm]);
        } else if (t === 'wave_start') {
          const wv = Number(msg.wave || 1);
          setWave(wv);
          setWaveBanner(`Oleada ${wv} — ¡En camino!`);
          soundEngine.playWaveStart();
          window.setTimeout(() => setWaveBanner(null), 2500);
        } else if (t === 'wave_cleared') {
          setWaveBanner(`Oleada ${msg.wave} completada`);
          window.setTimeout(() => setWaveBanner(null), 2200);
        } else if (t === 'player_damaged') {
          const newHp = Number(msg.hp ?? 0);
          engineRef.current.hp = newHp;
          setHp(newHp);
          soundEngine.playHurt();
          setDamageFlash(true);
          window.setTimeout(() => setDamageFlash(false), 180);
          if (newHp <= 0) {
            engineRef.current.gameOver = true;
            setGameOver(true);
          }
        } else if (t === 'respawn') {
          engineRef.current.pos.set(Number(msg.x || 0), 0, Number(msg.z || 0));
          engineRef.current.hp = Number(msg.hp || engineRef.current.maxHp);
          engineRef.current.gameOver = false;
          setHp(engineRef.current.hp);
          setGameOver(false);
        } else if (t === 'remote_shot') {
          const org = msg.origin as [number, number, number];
          const tgt = msg.target as [number, number, number];
          const col = String(msg.color || '#fbbf24');
          if (org && tgt) {
            spawnTracer(new THREE.Vector3(...org), new THREE.Vector3(...tgt), col, 0.022);
          }
        } else if (t === 'zombie_killed') {
          if (String(msg.killerId) === myPlayerIdRef.current) {
            const hs = Boolean(msg.headshot);
            engineRef.current.kills += 1;
            if (hs) engineRef.current.headshots += 1;
            engineRef.current.scrap += hs ? 120 : 80;
            setKills(engineRef.current.kills);
            setHeadshots(engineRef.current.headshots);
            setScrap(engineRef.current.scrap);
            awardCredits(hs ? 35 : 20);
          }
          addKillFeed(`${msg.killerName} eliminó un zombie${msg.headshot ? ' (Cabeza 1-Tiro)' : ''}`);
        } else if (t === 'state') {
          const playersArr = (msg.players || []) as RemotePlayerState[];
          const zombiesArr = (msg.zombies || []) as ServerZombieState[];
          setRemotePlayersList(playersArr);

          const seenP = new Set<string>();
          for (const rp of playersArr) {
            if (rp.id === myPlayerIdRef.current) continue;
            seenP.add(rp.id);
            let entry = remotePlayers.get(rp.id);
            if (!entry || entry.weaponId !== rp.weaponId) {
              if (entry) {
                scene.remove(entry.rig.root);
                disposeObjectTree(entry.rig.root);
              }
              const rChar = rp.character || character;
              const rWep = rp.weaponId || 'm4_centinela';
              const rig = buildCharacterMesh(
                rChar,
                rWep,
                rChar.weaponAttachments?.[rWep],
                rChar.weaponFinishes?.[rWep]
              );
              rig.root.position.set(rp.x, rp.y, rp.z);
              scene.add(rig.root);
              entry = {
                rig,
                targetPos: new THREE.Vector3(rp.x, rp.y, rp.z),
                targetYaw: rp.yaw,
                weaponId: rp.weaponId,
                state: rp,
                walkPhase: 0,
              };
              remotePlayers.set(rp.id, entry);
            } else {
              entry.targetPos.set(rp.x, rp.y, rp.z);
              entry.targetYaw = rp.yaw;
              entry.state = rp;
            }
            entry.rig.root.visible = rp.hp > 0;
          }
          for (const [id, entry] of remotePlayers) {
            if (!seenP.has(id)) {
              scene.remove(entry.rig.root);
              disposeObjectTree(entry.rig.root);
              remotePlayers.delete(id);
            }
          }

          const seenZ = new Set<string>();
          for (const sz of zombiesArr) {
            seenZ.add(sz.id);
            let zEntry = mpZombies.get(sz.id);
            if (!zEntry) {
              const rig = buildZombieMesh(sz.type);
              rig.root.position.set(sz.x, sz.y, sz.z);
              scene.add(rig.root);
              zEntry = {
                rig,
                targetPos: new THREE.Vector3(sz.x, sz.y, sz.z),
                targetYaw: sz.yaw,
                type: sz.type,
                walkPhase: Math.random() * 6,
                isCrawling: Boolean(sz.isCrawling),
              };
              if (zEntry.isCrawling) applyZombieCrawlingPose(rig);
              mpZombies.set(sz.id, zEntry);
            } else {
              zEntry.targetPos.set(sz.x, sz.y, sz.z);
              zEntry.targetYaw = sz.yaw;
              if (sz.isCrawling && !zEntry.isCrawling) {
                zEntry.isCrawling = true;
                applyZombieCrawlingPose(zEntry.rig);
              }
            }
            const ratio = Math.max(0.01, sz.hp / sz.maxHp);
            zEntry.rig.hpBarFill.scale.x = ratio;
            zEntry.rig.hpBarFill.position.x = -(1 - ratio) * 0.355;
          }
          for (const [id, zEntry] of mpZombies) {
            if (!seenZ.has(id)) {
              scene.remove(zEntry.rig.root);
              disposeObjectTree(zEntry.rig.root);
              mpZombies.delete(id);
            }
          }
        }
      };

      ws.onclose = () => {
        setMpStatus('Desconectado del servidor');
      };
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (engineRef.current.chatOpen) {
        if (e.code === 'Escape') setChatOpen(false);
        return;
      }
      engineRef.current.keys[e.code] = true;

      if (e.code === 'KeyR') triggerReload();
      if (e.code === 'KeyG') triggerThrowStone();
      if (e.code === 'KeyX') triggerThrowGrenade();
      if (e.code === 'KeyT') triggerPlaceTrap();
      if (e.code === 'KeyY') cycleTrapType();
      if (e.code === 'KeyH') usePortableMedkit();
      if (e.code === 'KeyE') {
        engineRef.current.interactRequested = true;
      }
      if (e.code === 'KeyL') {
        if (engineRef.current.drivingVehicleId) {
          engineRef.current.toggleHeadlightsRequested = true;
        }
      }
      if (e.code === 'KeyK') {
        if (engineRef.current.drivingVehicleId) {
          engineRef.current.hornRequested = true;
        }
      }
      if (e.code === 'KeyQ' || e.code === 'KeyF') {
        if (engineRef.current.drivingVehicleId && e.code === 'KeyF') {
          engineRef.current.toggleHeadlightsRequested = true;
        } else if (
          !engineRef.current.drivingVehicleId &&
          !engineRef.current.modalOpen &&
          !engineRef.current.gameOver &&
          !WEAPON_MAP[engineRef.current.activeWeaponId]?.isMelee
        ) {
          const nextAds = !engineRef.current.isAds;
          engineRef.current.isAds = nextAds;
          setIsAds(nextAds);
          if (!nextAds) {
            engineRef.current.extraZoom = false;
            setExtraZoom(false);
          }
        }
      }
      if (e.code === 'KeyZ') {
        if (engineRef.current.isAds && !engineRef.current.modalOpen) {
          const nextZoom = !engineRef.current.extraZoom;
          engineRef.current.extraZoom = nextZoom;
          setExtraZoom(nextZoom);
        }
      }
      if (e.code === 'KeyC') {
        setIsCrouching((c) => !c);
      }
      if (e.code === 'KeyV') {
        setCameraPerspective((prev) => (prev === '1p' ? '3p' : '1p'));
      }
      if (e.code === 'KeyI') {
        setShowArmory(false);
        setShowInventory((prev) => !prev);
      }
      if (e.code === 'KeyB') {
        setShowInventory(false);
        setShowArmory((prev) => !prev);
      }
      if (e.code === 'Tab' && mode === 'multiplayer') {
        e.preventDefault();
        setScoreboardOpen(true);
      }
      if (e.code === 'Enter' && mode === 'multiplayer') {
        setChatOpen(true);
      }
      if (e.code === 'Space' && !engineRef.current.drivingVehicleId && engineRef.current.onGround && !engineRef.current.gameOver) {
        engineRef.current.velY = 6.8;
        engineRef.current.onGround = false;
      }

      const digitMap: Record<string, number> = {
        Digit1: 0,
        Digit2: 1,
        Digit3: 2,
        Digit4: 3,
        Digit5: 4,
        Digit6: 5,
        Digit7: 6,
        Digit8: 7,
        Digit9: 8,
        Digit0: 9,
      };
      if (e.code in digitMap) {
        const unlockedList = WEAPONS.filter((w) => engineRef.current.unlockedWeapons.has(w.id));
        const w = unlockedList[digitMap[e.code]];
        if (w) switchWeapon(w.id);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current.keys[e.code] = false;
      if (e.code === 'Tab' && mode === 'multiplayer') {
        setScoreboardOpen(false);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sens = engineRef.current.isAds ? 0.001 : 0.0021;
      engineRef.current.yaw -= e.movementX * sens;
      engineRef.current.pitch = THREE.MathUtils.clamp(
        engineRef.current.pitch - e.movementY * sens,
        -Math.PI / 2.2,
        Math.PI / 2.2
      );
    };

    const onMouseDown = (e: MouseEvent) => {
      soundEngine.unlock();
      if (engineRef.current.touchMode || engineRef.current.modalOpen || engineRef.current.chatOpen || engineRef.current.gameOver) {
        return;
      }
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
        return;
      }
      if (engineRef.current.drivingVehicleId) {
        if (e.button === 0) engineRef.current.hornRequested = true;
        else if (e.button === 2) engineRef.current.toggleHeadlightsRequested = true;
        return;
      }
      if (e.button === 0) {
        engineRef.current.isFiring = true;
        engineRef.current.triggerFireOnce = true;
      } else if (e.button === 2 && !WEAPON_MAP[engineRef.current.activeWeaponId]?.isMelee) {
        engineRef.current.isAds = true;
        setIsAds(true);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) engineRef.current.isFiring = false;
      if (e.button === 2) {
        engineRef.current.isAds = false;
        setIsAds(false);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const unlocked = WEAPONS.filter((w) => engineRef.current.unlockedWeapons.has(w.id));
      if (unlocked.length <= 1) return;
      const idx = unlocked.findIndex((w) => w.id === engineRef.current.activeWeaponId);
      const next = (idx + (e.deltaY > 0 ? 1 : -1) + unlocked.length) % unlocked.length;
      switchWeapon(unlocked[next].id);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvas);
      if (document.pointerLockElement !== canvas) {
        engineRef.current.isFiring = false;
        engineRef.current.isAds = false;
        setIsAds(false);
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: true });
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('resize', onResize);

    const raycaster = new THREE.Raycaster();
    let muzzleFlashHideAt = 0;

    const explodeAt = (center: THREE.Vector3, radius: number, maxDmg: number, isToxic = false) => {
      soundEngine.playExplosion();
      spawnParticles(center, isToxic ? 0x84cc16 : 0xf97316, 18, 8.5);
      spawnParticles(center, isToxic ? 0x22c55e : 0xfacc15, 10, 5.5);
      emitNoise(center, 60, true, isToxic ? 0x84cc16 : 0xef4444);

      const ring = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.35, 14, 14),
        new THREE.MeshBasicMaterial({
          color: isToxic ? 0xa3e635 : 0xfb923c,
          transparent: true,
          opacity: 0.65,
          wireframe: true,
        })
      );
      ring.position.copy(center);
      scene.add(ring);
      tracers.push({ mesh: ring, life: 0.22, maxLife: 0.22 });

      if (isToxic && !engineRef.current.drivingVehicleId && !engineRef.current.gameOver) {
        const pDist = engineRef.current.pos.distanceTo(center);
        if (pDist <= radius) {
          const pDmg = Math.round(28 * (1 - (pDist / radius) * 0.55));
          engineRef.current.hp = Math.max(0, engineRef.current.hp - pDmg);
          setHp(engineRef.current.hp);
          soundEngine.playHurt();
          setDamageFlash(true);
          window.setTimeout(() => setDamageFlash(false), 180);
          if (engineRef.current.hp <= 0) {
            engineRef.current.gameOver = true;
            setGameOver(true);
          }
        }
      }

      if (mode === 'practice') {
        for (const pt of practiceTargets) {
          if (pt.respawnAt > 0) continue;
          const dist = pt.rig.root.position.distanceTo(center);
          if (dist <= radius) {
            const dmg = Math.round(maxDmg * (1 - (dist / radius) * 0.6));
            pt.hp -= dmg;
            pushFloatingDamage(pt.rig.root.position.clone().add(new THREE.Vector3(0, 1.8, 0)), `${dmg}`, false);
            triggerHitMarker(false);
            setPracticeStats((s) => ({ ...s, hits: s.hits + 1, lastDamage: dmg }));
            if (pt.hp <= 0) {
              pt.respawnAt = performance.now() + 2000;
              pt.rig.root.visible = false;
              setPracticeStats((s) => ({ ...s, targetsDown: s.targetsDown + 1 }));
            }
          }
        }
      } else if (mode === 'survival') {
        for (const [zid, z] of Array.from(localZombies.entries())) {
          const dist = z.rig.root.position.distanceTo(center);
          if (dist <= radius) {
            const rawDmg = maxDmg * (1 - (dist / radius) * 0.55);
            const dmg = Math.max(1, Math.round(z.isBoss ? rawDmg * 0.85 : rawDmg));
            z.hp -= dmg;
            pushFloatingDamage(
              z.rig.root.position.clone().add(new THREE.Vector3(0, z.isBoss ? 2.6 : 1.8, 0)),
              z.isBoss ? `${dmg} EXPLOSIVO` : `${dmg}`,
              false
            );
            triggerHitMarker(false);
            if (z.hp <= 0) {
              killLocalZombie(zid, z, false);
            } else if (z.isBoss) {
              syncBossHud();
            }
          }
        }
      } else if (mode === 'multiplayer' && wsRef.current?.readyState === WebSocket.OPEN) {
        for (const [zid, z] of mpZombies.entries()) {
          const dist = z.rig.root.position.distanceTo(center);
          if (dist <= radius) {
            const dmg = Math.round(maxDmg * (1 - (dist / radius) * 0.55));
            wsRef.current.send(JSON.stringify({ type: 'hit_zombie', zombieId: zid, damage: dmg, headshot: false }));
            triggerHitMarker(false);
          }
        }
        if (roomSubMode === 'pvp' && !isToxic) {
          for (const [pid, rp] of remotePlayers.entries()) {
            if (rp.state.hp <= 0) continue;
            const dist = rp.rig.root.position.distanceTo(center);
            if (dist <= radius) {
              const dmg = Math.round(maxDmg * (1 - (dist / radius) * 0.55));
              wsRef.current.send(JSON.stringify({ type: 'hit_player', targetId: pid, damage: dmg, headshot: false }));
              triggerHitMarker(false);
            }
          }
        }
      }
    };

    const killLocalZombie = (zid: string, z: LocalZombieEntity, isHead: boolean) => {
      const pos = z.rig.root.position.clone();
      const zType = z.type;
      const wasBoss = Boolean(z.isBoss);
      const bossName = z.bossName || 'Jefe';
      const bossTier = z.bossTier || 1;
      scene.remove(z.rig.root);
      disposeObjectTree(z.rig.root);
      localZombies.delete(zid);

      engineRef.current.kills += 1;
      if (isHead) engineRef.current.headshots += 1;
      const baseScrap = wasBoss
        ? 340 + bossTier * 150
        : zType === 'brute'
        ? 160
        : zType === 'bloater'
        ? 120
        : zType === 'riot'
        ? 100
        : zType === 'hazmat'
        ? 80
        : 50;
      const scrapGain = baseScrap + (isHead ? 35 : 0);
      engineRef.current.scrap += scrapGain;
      setKills(engineRef.current.kills);
      setHeadshots(engineRef.current.headshots);
      setScrap(engineRef.current.scrap);
      awardCredits(wasBoss ? 150 + bossTier * 60 : isHead ? 30 : 18);

      if (wasBoss) {
        engineRef.current.bossesDefeated += 1;
        setBossesDefeated(engineRef.current.bossesDefeated);
        setActiveBoss(null);
        soundEngine.playCrateOpen();
        addKillFeed(`¡JEFE DERROTADO: ${bossName} (Nivel ${bossTier})!`);
        const rewardWeaponId = pickBossRewardWeapon(Array.from(engineRef.current.unlockedWeapons));
        if (rewardWeaponId) {
          const rw = WEAPON_MAP[rewardWeaponId];
          const rwEff = computeEffectiveWeaponStats(rewardWeaponId, engineRef.current.weaponAttachments[rewardWeaponId]);
          engineRef.current.unlockedWeapons.add(rewardWeaponId);
          setUnlockedWeapons(Array.from(engineRef.current.unlockedWeapons));
          engineRef.current.ammo[rewardWeaponId] = { mag: rwEff.magSize, reserve: rwEff.magSize };
          setAmmoState({ ...engineRef.current.ammo });
          const prog = progressionRef.current;
          if (!prog.ownedWeapons.includes(rewardWeaponId)) {
            const nextProg: PlayerProgression = {
              ...prog,
              ownedWeapons: [...prog.ownedWeapons, rewardWeaponId],
            };
            progressionRef.current = nextProg;
            onUpdateProgression(nextProg);
          }
          showLootToast(`¡Botín de Jefe [${rw.rarity}]: Desbloqueaste ${rw.name} (+${scrapGain} Chatarra)!`);
        } else {
          showLootToast(`¡${bossName} derrotado! +${scrapGain} Chatarra · El próximo jefe será más difícil`);
        }
        (['ammo', 'medkit', 'grenade', 'trap'] as PickupKind[]).forEach((pkKind, idx) => {
          const offset = new THREE.Vector3(Math.cos(idx * 1.57) * 1.4, 0, Math.sin(idx * 1.57) * 1.4);
          spawnPickup(pos.clone().add(offset), pkKind);
        });
      } else {
        if (zType === 'bloater') {
          explodeAt(pos.clone().add(new THREE.Vector3(0, 0.9, 0)), 4.6, 55, true);
        }

        if (Math.random() < 0.52) {
          const dropChoices: PickupKind[] = ['ammo', 'medkit', 'scrap', 'stones', 'grenade', 'trap'];
          spawnPickup(pos, dropChoices[Math.floor(Math.random() * dropChoices.length)]);
        }
      }
      syncWaveCountUi();
    };

    const fireCurrentWeapon = (nowMs: number) => {
      const eng = engineRef.current;
      if (eng.isReloading || eng.gameOver) return;
      const spec = WEAPON_MAP[eng.activeWeaponId];
      const eff = computeEffectiveWeaponStats(eng.activeWeaponId, eng.weaponAttachments[eng.activeWeaponId]);
      const intervalMs = 60000 / eff.rpm;
      if (nowMs - eng.lastShotAt < intervalMs) return;

      // Close-range Melee Combat Branch (no ammo consumed, wall-safe, 1-shot headshot in Survival)
      if (spec.isMelee) {
        eng.lastShotAt = nowMs;
        eng.meleeSwingStartedAt = nowMs;
        eng.meleeSwingUntil = nowMs + 280;
        soundEngine.playMeleeSwing(spec.damage >= 95);
        emitNoise(eng.pos, eff.noiseRadius, false);
        setNoiseLabel('Sigilo');
        setNoiseLevelPct(14);

        _euler.set(eng.pitch, eng.yaw, 0, 'YXZ');
        const aimDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler).normalize();
        const rayOrigin = camera.position.clone();

        const meleeMeshes: THREE.Object3D[] = [...arena.obstacleMeshes];
        const meleeMap = new Map<
          THREE.Object3D,
          { kind: 'practice' | 'zombie' | 'mp_zombie' | 'mp_player'; id: string }
        >();

        if (mode === 'practice') {
          setPracticeStats((s) => ({ ...s, shots: s.shots + 1 }));
          for (const pt of practiceTargets) {
            if (pt.respawnAt > 0) continue;
            pt.rig.board.traverse((c) => {
              if ((c as THREE.Mesh).isMesh && c.userData.hitbox) {
                meleeMeshes.push(c);
                meleeMap.set(c, { kind: 'practice', id: pt.id });
              }
            });
          }
        } else if (mode === 'survival') {
          for (const [zid, z] of localZombies) {
            z.rig.torso.traverse((c) => {
              if ((c as THREE.Mesh).isMesh && c.userData.hitbox) {
                meleeMeshes.push(c);
                meleeMap.set(c, { kind: 'zombie', id: zid });
              }
            });
          }
        } else if (mode === 'multiplayer') {
          for (const [zid, z] of mpZombies) {
            z.rig.torso.traverse((c) => {
              if ((c as THREE.Mesh).isMesh && c.userData.hitbox) {
                meleeMeshes.push(c);
                meleeMap.set(c, { kind: 'mp_zombie', id: zid });
              }
            });
          }
          if (roomSubMode === 'pvp') {
            for (const [pid, rp] of remotePlayers) {
              if (rp.state.hp <= 0) continue;
              rp.rig.bodyGroup.traverse((c) => {
                if ((c as THREE.Mesh).isMesh) {
                  meleeMeshes.push(c);
                  meleeMap.set(c, { kind: 'mp_player', id: pid });
                }
              });
            }
          }
        }

        raycaster.set(rayOrigin, aimDir);
        raycaster.far = eff.range + (eng.perspective === '3p' ? 2.4 : 0.25);
        const hits = raycaster.intersectObjects(meleeMeshes, false);

        let hitTarget: {
          kind: 'practice' | 'zombie' | 'mp_zombie' | 'mp_player';
          id: string;
          point: THREE.Vector3;
          isHead: boolean;
          isWeakSpot: boolean;
        } | null = null;
        if (hits.length > 0) {
          const first = hits[0];
          const info = meleeMap.get(first.object);
          if (!info) {
            soundEngine.playStoneImpact();
            spawnParticles(first.point, 0x94a3b8, 4, 2.2);
          } else {
            hitTarget = {
              kind: info.kind,
              id: info.id,
              point: first.point.clone(),
              isHead: first.object.userData.hitbox === 'head',
              isWeakSpot: first.object.userData.hitbox === 'weakspot',
            };
          }
        }

        // Fallback cleave cone in front of player (checks wall LOS so swings never hit through walls)
        if (!hitTarget) {
          const flatFwd = new THREE.Vector3(-Math.sin(eng.yaw), 0, -Math.cos(eng.yaw));
          let bestDist = eff.range + 0.35;
          const tryCandidate = (kind: 'practice' | 'zombie' | 'mp_zombie' | 'mp_player', id: string, pos: THREE.Vector3) => {
            const dx = pos.x - eng.pos.x;
            const dz = pos.z - eng.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > bestDist || d < 0.05) return;
            const dot = (dx / d) * flatFwd.x + (dz / d) * flatFwd.z;
            if (dot < 0.48) return;
            if (!hasLineOfSightXZ(eng.pos.x, eng.pos.z, pos.x, pos.z, arena.colliders, 1.3)) return;
            bestDist = d;
            hitTarget = {
              kind,
              id,
              point: new THREE.Vector3(pos.x, eng.pitch > -0.05 ? 1.55 : 1.05, pos.z),
              isHead: eng.pitch > 0.05,
              isWeakSpot: false,
            };
          };

          if (mode === 'practice') {
            practiceTargets.forEach((pt) => {
              if (pt.respawnAt === 0) tryCandidate('practice', pt.id, pt.rig.root.position);
            });
          } else if (mode === 'survival') {
            localZombies.forEach((z, zid) => tryCandidate('zombie', zid, z.rig.root.position));
          } else if (mode === 'multiplayer') {
            mpZombies.forEach((mz, zid) => tryCandidate('mp_zombie', zid, mz.rig.root.position));
            if (roomSubMode === 'pvp') {
              remotePlayers.forEach((rp, pid) => {
                if (rp.state.hp > 0) tryCandidate('mp_player', pid, rp.rig.root.position);
              });
            }
          }
        }

        if (hitTarget) {
          const dmg = Math.round(eff.damage * (hitTarget.isHead ? eff.headshotMult : 1));
          const critHit = hitTarget.isHead || hitTarget.isWeakSpot;
          soundEngine.playMeleeHit(critHit);
          triggerHitMarker(critHit);
          spawnParticles(hitTarget.point, hitTarget.kind === 'practice' ? 0xfacc15 : 0x991b1b, critHit ? 10 : 6, 4.2);

          if (hitTarget.kind === 'practice') {
            const pt = practiceTargets.find((t) => t.id === hitTarget!.id);
            if (pt) {
              const applied = hitTarget.isHead ? pt.hp : dmg;
              pt.hp -= applied;
              pushFloatingDamage(hitTarget.point, hitTarget.isHead ? '¡CABEZA!' : `${dmg}`, hitTarget.isHead);
              setPracticeStats((s) => ({ ...s, hits: s.hits + 1, lastDamage: applied }));
              if (hitTarget.isHead) setHeadshots((h) => h + 1);
              if (pt.hp <= 0) {
                pt.respawnAt = performance.now() + 2000;
                pt.rig.root.visible = false;
                setPracticeStats((s) => ({ ...s, targetsDown: s.targetsDown + 1 }));
              }
            }
          } else if (hitTarget.kind === 'zombie') {
            const z = localZombies.get(hitTarget.id);
            if (z) {
              if (z.isBoss) {
                const finalDmg = hitTarget.isWeakSpot
                  ? Math.max(1, Math.round(eff.damage * (z.weakSpotMult || 4.5)))
                  : Math.max(1, Math.round(eff.damage * (z.armorResist ?? 0.28)));
                z.hp -= finalDmg;
                z.aiState = 'chasing';
                if (hitTarget.isWeakSpot && z.bossVariant === 'riot_juggernaut') {
                  z.slowedUntil = nowMs + 1600;
                }
                pushFloatingDamage(
                  hitTarget.point,
                  hitTarget.isWeakSpot ? `¡PUNTO DÉBIL! ${finalDmg}` : `${finalDmg} BLINDADO`,
                  hitTarget.isWeakSpot
                );
                if (z.hp <= 0) killLocalZombie(hitTarget.id, z, hitTarget.isWeakSpot);
                else syncBossHud();
              } else if (hitTarget.isHead) {
                pushFloatingDamage(hitTarget.point, '¡CABEZA! 1-GOLPE', true);
                killLocalZombie(hitTarget.id, z, true);
              } else {
                const armorMult = z.type === 'riot' ? 0.65 : z.type === 'hazmat' ? 0.8 : 1.0;
                const finalDmg = Math.max(1, Math.round(dmg * armorMult));
                z.hp -= finalDmg;
                z.aiState = 'chasing';
                pushFloatingDamage(hitTarget.point, `${finalDmg}`, false);
                if (z.hp <= 0) killLocalZombie(hitTarget.id, z, false);
              }
            }
          } else if (hitTarget.kind === 'mp_zombie' && wsRef.current?.readyState === WebSocket.OPEN) {
            pushFloatingDamage(hitTarget.point, hitTarget.isHead ? '¡CABEZA!' : `${dmg}`, hitTarget.isHead);
            wsRef.current.send(
              JSON.stringify({
                type: 'hit_zombie',
                zombieId: hitTarget.id,
                damage: dmg,
                headshot: hitTarget.isHead,
              })
            );
          } else if (hitTarget.kind === 'mp_player' && wsRef.current?.readyState === WebSocket.OPEN) {
            pushFloatingDamage(hitTarget.point, `${dmg}`, hitTarget.isHead);
            wsRef.current.send(JSON.stringify({ type: 'hit_player', targetId: hitTarget.id, damage: dmg }));
          }
        }
        return;
      }

      const ammo = eng.ammo[eng.activeWeaponId];
      if (!ammo || ammo.mag <= 0) {
        eng.lastShotAt = nowMs;
        soundEngine.playEmptyClick();
        triggerReload();
        return;
      }

      eng.lastShotAt = nowMs;
      ammo.mag -= 1;
      setAmmoState({ ...eng.ammo });
      soundEngine.playShot(eff.suppressed && spec.soundProfile !== 'plasma' && spec.soundProfile !== 'laser' ? 'smg' : spec.soundProfile);

      eng.recoilPitch += eff.recoilKick * (eng.isAds ? 0.52 : 1.0);
      eng.recoilYaw += (Math.random() - 0.5) * eff.recoilKick * 0.35;

      emitNoise(eng.pos, eff.noiseRadius, !eff.suppressed, 0xf59e0b);
      setNoiseLabel(eff.suppressed ? 'Pasos' : 'Ruido Alto');
      setNoiseLevelPct(eff.suppressed ? 35 : 100);

      const muzzleWorld = new THREE.Vector3();
      if (eng.perspective === '1p' && fpWeaponGroup) {
        muzzleWorld.copy(fpMuzzleOffset);
        fpWeaponPivot.localToWorld(muzzleWorld);
      } else {
        localPlayerRig.muzzlePoint.getWorldPosition(muzzleWorld);
      }

      if (
        spec.id !== 'x9_plasma' &&
        spec.id !== 'vulcan_laser' &&
        spec.id !== 'gl40' &&
        spec.id !== 'crossbow_apoc' &&
        spec.id !== 'mgl_incendiary' &&
        spec.id !== 'railgun_nemesis'
      ) {
        _right.set(Math.cos(eng.yaw), 0, -Math.sin(eng.yaw));
        spawnShellCasing(muzzleWorld.clone().lerp(camera.position, 0.35), _right);
      }

      muzzleFlashLight.color.set(spec.tracerColor);
      muzzleFlashLight.position.copy(muzzleWorld);
      muzzleFlashLight.intensity = eff.suppressed ? 1.2 : 3.8;
      muzzleFlashMesh.position.copy(muzzleWorld);
      (muzzleFlashMesh.material as THREE.MeshBasicMaterial).color.set(spec.tracerColor);
      muzzleFlashMesh.visible = true;
      muzzleFlashHideAt = nowMs + 42;

      _euler.set(eng.pitch + eng.recoilPitch * 0.4, eng.yaw, 0, 'YXZ');
      const aimDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler).normalize();
      const rayOrigin = camera.position.clone();

      if (spec.explosiveRadius) {
        const isRocket = spec.id === 'mgl_incendiary';
        const projMesh = new THREE.Mesh(
          isRocket ? new THREE.CylinderGeometry(0.055, 0.085, 0.44, 14) : new THREE.SphereGeometry(0.12, 12, 12),
          new THREE.MeshStandardMaterial({
            color: isRocket ? 0xf97316 : 0xef4444,
            emissive: isRocket ? 0xf97316 : 0xef4444,
            emissiveIntensity: 1.6,
          })
        );
        projMesh.position.copy(muzzleWorld);
        if (isRocket) {
          projMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aimDir);
        }
        scene.add(projMesh);
        const vel = aimDir.clone().multiplyScalar(spec.projectileSpeed || 34);
        vel.y += isRocket ? 0.4 : 3.5;
        grenades.push({
          mesh: projMesh,
          vel,
          life: isRocket ? 3.4 : 2.8,
          damage: eff.damage,
          radius: spec.explosiveRadius,
          isRocket,
        });
        if (mode === 'practice') {
          setPracticeStats((s) => ({ ...s, shots: s.shots + 1 }));
        }
        return;
      }

      const hitMeshes: THREE.Object3D[] = [...arena.obstacleMeshes];
      const meshToEntity = new Map<
        THREE.Object3D,
        { kind: 'practice' | 'zombie' | 'mp_zombie' | 'mp_player'; id: string }
      >();

      if (mode === 'practice') {
        setPracticeStats((s) => ({ ...s, shots: s.shots + 1 }));
        for (const pt of practiceTargets) {
          if (pt.respawnAt > 0) continue;
          pt.rig.board.traverse((c) => {
            if ((c as THREE.Mesh).isMesh && c.userData.hitbox) {
              hitMeshes.push(c);
              meshToEntity.set(c, { kind: 'practice', id: pt.id });
            }
          });
        }
      } else if (mode === 'survival') {
        for (const [zid, z] of localZombies) {
          z.rig.torso.traverse((c) => {
            if ((c as THREE.Mesh).isMesh && c.userData.hitbox) {
              hitMeshes.push(c);
              meshToEntity.set(c, { kind: 'zombie', id: zid });
            }
          });
        }
      } else if (mode === 'multiplayer') {
        for (const [zid, z] of mpZombies) {
          z.rig.torso.traverse((c) => {
            if ((c as THREE.Mesh).isMesh && c.userData.hitbox) {
              hitMeshes.push(c);
              meshToEntity.set(c, { kind: 'mp_zombie', id: zid });
            }
          });
        }
        if (roomSubMode === 'pvp') {
          for (const [pid, rp] of remotePlayers) {
            if (rp.state.hp <= 0) continue;
            rp.rig.bodyGroup.traverse((c) => {
              if ((c as THREE.Mesh).isMesh) {
                hitMeshes.push(c);
                meshToEntity.set(c, { kind: 'mp_player', id: pid });
              }
            });
          }
        }
      }

      const spread = eng.isAds ? eff.adsSpread : eff.spread;
      const isShotgun = spec.category === 'Escopetas';

      for (let p = 0; p < spec.pellets; p++) {
        const pelletDir = aimDir.clone();
        pelletDir.x += (Math.random() - 0.5) * spread * 2;
        pelletDir.y += (Math.random() - 0.5) * spread * 2;
        pelletDir.z += (Math.random() - 0.5) * spread * 2;
        pelletDir.normalize();

        raycaster.set(rayOrigin, pelletDir);
        raycaster.far = eff.range;

        const hits = raycaster.intersectObjects(hitMeshes, false);
        let endPoint = rayOrigin.clone().add(pelletDir.clone().multiplyScalar(eff.range));

        if (hits.length > 0) {
          const hit = hits[0];
          endPoint = hit.point.clone();
          const info = meshToEntity.get(hit.object);

          if (!info) {
            // Bullet stopped by concrete wall, building, car, or barricade!
            spawnParticles(hit.point, 0x94a3b8, 4, 2.5);
          } else {
            const hitbox = hit.object.userData.hitbox as 'head' | 'leg' | 'body' | 'weakspot' | undefined;
            const isHead = hitbox === 'head';
            const isLeg = hitbox === 'leg';
            const isWeakSpot = hitbox === 'weakspot';
            const dmg = Math.round(eff.damage * (isHead ? eff.headshotMult : isLeg ? 0.85 : 1));

            triggerHitMarker(isHead || isWeakSpot);
            spawnParticles(hit.point, info.kind === 'practice' ? 0xfacc15 : isWeakSpot ? 0xfbbf24 : 0x991b1b, isHead || isWeakSpot ? 10 : 6, 4.2);

            if (info.kind === 'practice') {
              const pt = practiceTargets.find((t) => t.id === info.id);
              if (pt) {
                const applied = isHead ? pt.hp : dmg;
                pt.hp -= applied;
                pushFloatingDamage(hit.point, isHead ? '¡CABEZA!' : `${dmg}`, isHead);
                setPracticeStats((s) => ({ ...s, hits: s.hits + 1, lastDamage: applied }));
                if (isHead) setHeadshots((h) => h + 1);
                if (pt.hp <= 0) {
                  pt.respawnAt = performance.now() + 2000;
                  pt.rig.root.visible = false;
                  setPracticeStats((s) => ({ ...s, targetsDown: s.targetsDown + 1 }));
                }
              }
            } else if (info.kind === 'zombie') {
              const z = localZombies.get(info.id);
              if (z) {
                if (z.isBoss) {
                  const finalDmg = isWeakSpot
                    ? Math.max(1, Math.round(eff.damage * (z.weakSpotMult || 4.5)))
                    : Math.max(1, Math.round(eff.damage * (z.armorResist ?? 0.28)));
                  z.hp -= finalDmg;
                  z.aiState = 'chasing';
                  if (isWeakSpot && z.bossVariant === 'riot_juggernaut') {
                    z.slowedUntil = nowMs + 1800;
                  }
                  pushFloatingDamage(
                    hit.point,
                    isWeakSpot ? `¡PUNTO DÉBIL! ${finalDmg}` : `${finalDmg} BLINDADO`,
                    isWeakSpot
                  );
                  if (z.hp <= 0) {
                    killLocalZombie(info.id, z, isWeakSpot);
                  } else {
                    syncBossHud();
                  }
                } else if (isHead) {
                  // 1-SHOT HEADSHOT LETHAL KILL!
                  pushFloatingDamage(hit.point, '¡CABEZA! 1-TIRO', true);
                  killLocalZombie(info.id, z, true);
                } else {
                  const armorMult =
                    !isLeg && z.type === 'riot' ? 0.55 : !isLeg && z.type === 'hazmat' ? 0.72 : 1.0;
                  const finalDmg = Math.max(1, Math.round(dmg * armorMult));
                  z.hp -= finalDmg;
                  z.aiState = 'chasing';
                  if (isLeg && isShotgun && !z.isCrawling && z.hp > 0) {
                    // 1 SHOTGUN HIT TO LEG -> ZOMBIE MUST CRAWL!
                    z.isCrawling = true;
                    z.speed = z.baseSpeed * 0.34;
                    applyZombieCrawlingPose(z.rig);
                    pushFloatingDamage(hit.point, '¡ARRASTRÁNDOSE!', false);
                    showLootToast('¡Pierna destrozada! El zombie ahora se arrastra');
                  } else {
                    pushFloatingDamage(hit.point, `${finalDmg}`, false);
                  }
                  if (z.hp <= 0) {
                    killLocalZombie(info.id, z, false);
                  }
                }
              }
            } else if (info.kind === 'mp_zombie' && wsRef.current?.readyState === WebSocket.OPEN) {
              pushFloatingDamage(hit.point, isHead ? '¡CABEZA!' : `${dmg}`, isHead);
              wsRef.current.send(
                JSON.stringify({
                  type: 'hit_zombie',
                  zombieId: info.id,
                  damage: dmg,
                  headshot: isHead,
                  legShotgun: isLeg && isShotgun,
                })
              );
            } else if (info.kind === 'mp_player' && wsRef.current?.readyState === WebSocket.OPEN) {
              pushFloatingDamage(hit.point, `${dmg}`, isHead);
              wsRef.current.send(JSON.stringify({ type: 'hit_player', targetId: info.id, damage: dmg }));
            }
          }
        }

        const tracerWidth =
          spec.id === 'railgun_nemesis'
            ? 0.058
            : spec.id === 'vulcan_laser'
            ? 0.045
            : spec.id === 'x9_plasma'
            ? 0.032
            : 0.016;
        spawnTracer(muzzleWorld, endPoint, spec.tracerColor, tracerWidth);

        if (mode === 'multiplayer' && p === 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'player_shoot',
              origin: [muzzleWorld.x, muzzleWorld.y, muzzleWorld.z],
              target: [endPoint.x, endPoint.y, endPoint.z],
              color: spec.tracerColor,
              weaponId: spec.id,
            })
          );
        }
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();
    let regenAccum = 0;
    let lastTagProjAt = 0;
    let lastNoiseUiAt = 0;
    let lastFootstepNoiseAt = 0;

    let lastCarUiAt = 0;
    let lastCarNoiseAt = 0;
    let lastBossHudSyncAt = 0;

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const nowMs = performance.now();
      const eng = engineRef.current;

      if (eng.rebuildWeaponRequested) {
        eng.rebuildWeaponRequested = false;
        rebuildWeaponVisuals();
      }
      if (eng.restartRequested) {
        eng.restartRequested = false;
        for (const z of localZombies.values()) {
          scene.remove(z.rig.root);
          disposeObjectTree(z.rig.root);
        }
        localZombies.clear();
        for (let i = acidSpits.length - 1; i >= 0; i--) {
          const sp = acidSpits[i];
          scene.remove(sp.mesh);
          sp.mesh.geometry.dispose();
          (sp.mesh.material as THREE.Material).dispose();
          acidSpits.splice(i, 1);
        }
        survivalWaveRemaining = 10;
        survivalNextWaveAt = 0;
        survivalLastSpawnAt = nowMs;
        for (let i = 0; i < 8; i++) {
          spawnSurvivalZombie(true);
          survivalWaveRemaining = Math.max(0, survivalWaveRemaining - 1);
        }
        syncWaveCountUi();
        syncBossHud();
      }
      if (eng.resetTargetsRequested) {
        eng.resetTargetsRequested = false;
        spawnPracticeTargets();
      }

      if (eng.throwStoneRequested) {
        eng.throwStoneRequested = false;
        if (mode !== 'practice') {
          eng.stones = Math.max(0, eng.stones - 1);
          setStones(eng.stones);
        }
        soundEngine.playStoneThrow();
        const stoneMesh = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.11, 0),
          new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 })
        );
        _euler.set(eng.pitch, eng.yaw, 0, 'YXZ');
        const throwDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler).normalize();
        stoneMesh.position.copy(camera.position).addScaledVector(throwDir, 0.7);
        scene.add(stoneMesh);
        const vel = throwDir.multiplyScalar(20);
        vel.y += 4.2;
        stonesProj.push({ mesh: stoneMesh, vel, life: 4.0, bounced: false });
      }

      if (eng.throwGrenadeRequested) {
        eng.throwGrenadeRequested = false;
        if (mode !== 'practice') {
          eng.grenadesCount = Math.max(0, eng.grenadesCount - 1);
          setGrenadesCount(eng.grenadesCount);
        }
        const gMesh = buildHandGrenadeMesh();
        _euler.set(eng.pitch, eng.yaw, 0, 'YXZ');
        const throwDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler).normalize();
        gMesh.position.copy(camera.position).addScaledVector(throwDir, 0.75);
        scene.add(gMesh);
        const vel = throwDir.multiplyScalar(19);
        vel.y += 4.8;
        grenades.push({
          mesh: gMesh,
          vel,
          life: 1.55,
          damage: 175,
          radius: 6.5,
          isHandGrenade: true,
        });
        showLootToast('¡Granada lanzada!');
      }

      if (eng.placeTrapRequested) {
        eng.placeTrapRequested = false;
        const trapType = eng.selectedTrap;
        if (mode !== 'practice') {
          if (trapType === 'bear_trap') {
            eng.bearTraps = Math.max(0, eng.bearTraps - 1);
            setBearTraps(eng.bearTraps);
          } else {
            eng.landmines = Math.max(0, eng.landmines - 1);
            setLandmines(eng.landmines);
          }
        }
        if (placedTraps.length >= 20) {
          const oldest = placedTraps.shift()!;
          scene.remove(oldest.rig.root);
          disposeObjectTree(oldest.rig.root);
        }
        const placePos = new THREE.Vector3(
          eng.pos.x - Math.sin(eng.yaw) * 1.45,
          0,
          eng.pos.z - Math.cos(eng.yaw) * 1.45
        );
        resolveCircleAABBCollisions(placePos, 0.48, arena.colliders, arena.arenaRadius);
        const rig = trapType === 'bear_trap' ? buildBearTrapMesh() : buildLandmineMesh();
        rig.root.position.copy(placePos);
        rig.root.rotation.y = eng.yaw;
        scene.add(rig.root);
        placedTraps.push({
          id: `trap_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
          type: trapType,
          pos: placePos,
          rig,
          triggered: false,
          removeAt: 0,
        });
        showLootToast(trapType === 'bear_trap' ? 'Trampa de Osos colocada' : 'Mina Explosiva armada');
      }

      if (eng.isReloading && nowMs >= eng.reloadEndsAt) {
        eng.isReloading = false;
        setIsReloading(false);
        const eff = computeEffectiveWeaponStats(eng.activeWeaponId, eng.weaponAttachments[eng.activeWeaponId]);
        const st = eng.ammo[eng.activeWeaponId];
        if (mode === 'practice') {
          st.mag = eff.magSize;
        } else {
          const needed = eff.magSize - st.mag;
          const load = Math.min(needed, st.reserve);
          st.mag += load;
          st.reserve -= load;
        }
        setAmmoState({ ...eng.ammo });
      }

      if (!eng.gameOver && armorStats.regenPerSec > 0 && eng.hp < eng.maxHp) {
        regenAccum += armorStats.regenPerSec * dt;
        if (regenAccum >= 1) {
          const heal = Math.floor(regenAccum);
          regenAccum -= heal;
          eng.hp = Math.min(eng.maxHp, eng.hp + heal);
          setHp(eng.hp);
        }
      }

      let activeCar = eng.drivingVehicleId ? vehicles.find((v) => v.id === eng.drivingVehicleId) || null : null;
      let isMoving = false;
      let isSprinting = false;

      if (activeCar && !eng.gameOver && !eng.modalOpen && !eng.chatOpen) {
        eng.isAds = false;
        eng.isFiring = false;

        if (eng.toggleHeadlightsRequested) {
          eng.toggleHeadlightsRequested = false;
          activeCar.headlightsOn = !activeCar.headlightsOn;
          activeCar.rig.headlightBeam.intensity = activeCar.headlightsOn ? 3.8 : 0;
          activeCar.rig.headlightLenses.forEach((hl) => {
            (hl.material as THREE.MeshStandardMaterial).emissiveIntensity = activeCar!.headlightsOn ? 2.2 : 0.25;
          });
        }
        if (eng.hornRequested) {
          eng.hornRequested = false;
          if (nowMs - activeCar.lastHornAt > 420) {
            activeCar.lastHornAt = nowMs;
            soundEngine.playCarHorn();
            emitNoise(activeCar.pos, 55, true, 0xfacc15);
          }
        }

        let throttle = 0;
        let steerInput = 0;
        if (eng.keys['KeyW'] || eng.keys['ArrowUp']) throttle += 1;
        if (eng.keys['KeyS'] || eng.keys['ArrowDown']) throttle -= 1;
        if (eng.keys['KeyA'] || eng.keys['ArrowLeft']) steerInput += 1;
        if (eng.keys['KeyD'] || eng.keys['ArrowRight']) steerInput -= 1;

        if (Math.abs(eng.joyVec.x) > 0.08 || Math.abs(eng.joyVec.y) > 0.08) {
          throttle -= eng.joyVec.y;
          steerInput -= eng.joyVec.x;
        }

        const handbrake = Boolean(eng.keys['Space']);
        const boostMult = eng.keys['ShiftLeft'] || eng.keys['ShiftRight'] ? 1.24 : 1.0;

        if (handbrake) {
          activeCar.speed = THREE.MathUtils.damp(activeCar.speed, 0, 7.5, dt);
        } else if (Math.abs(throttle) > 0.05) {
          const effAccel = activeCar.accel * boostMult;
          activeCar.speed += throttle * effAccel * dt;
          const fwdCap = activeCar.maxSpeed * boostMult;
          const revCap = -activeCar.maxSpeed * 0.42;
          activeCar.speed = THREE.MathUtils.clamp(activeCar.speed, revCap, fwdCap);
        } else {
          activeCar.speed = THREE.MathUtils.damp(activeCar.speed, 0, 1.85, dt);
        }

        activeCar.steerAngle = THREE.MathUtils.damp(activeCar.steerAngle, steerInput * 0.42, 12, dt);
        if (Math.abs(activeCar.speed) > 0.35) {
          isMoving = true;
          const turnFactor = (activeCar.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(activeCar.speed) / 6.5);
          activeCar.yaw += steerInput * 2.15 * turnFactor * dt;

          // Gently align chase camera yaw toward vehicle heading when driving
          const yawDiff = Math.atan2(Math.sin(activeCar.yaw - eng.yaw), Math.cos(activeCar.yaw - eng.yaw));
          eng.yaw += yawDiff * Math.min(1, dt * 2.4);
        }

        const stepDist = activeCar.speed * dt;
        activeCar.pos.x += -Math.sin(activeCar.yaw) * stepDist;
        activeCar.pos.z += -Math.cos(activeCar.yaw) * stepDist;

        const hitWall = resolveCircleAABBCollisions(activeCar.pos, 1.78, arena.colliders, arena.arenaRadius - 1.5);
        if (hitWall && Math.abs(activeCar.speed) > 4.2) {
          activeCar.speed *= -0.22;
          soundEngine.playVehicleHit();
        }

        eng.pos.set(activeCar.pos.x, 0, activeCar.pos.z);

        // Roadkill collision check against Zombies (Bosses resist instant roadkill)
        if (Math.abs(activeCar.speed) > 5.0) {
          if (mode === 'survival') {
            for (const [zid, z] of Array.from(localZombies.entries())) {
              const hitDist = z.isBoss ? 2.65 : 2.3;
              if (z.rig.root.position.distanceTo(activeCar.pos) < hitDist) {
                if (z.isBoss) {
                  if (nowMs - (z.lastBossRamAt || 0) > 750) {
                    z.lastBossRamAt = nowMs;
                    soundEngine.playVehicleHit();
                    const ramDmg = Math.round(145 + Math.abs(activeCar.speed) * 6);
                    z.hp -= ramDmg;
                    spawnParticles(z.rig.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 0xf97316, 12, 6);
                    pushFloatingDamage(
                      z.rig.root.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
                      `${ramDmg} IMPACTO`,
                      false
                    );
                    activeCar.speed *= -0.4;
                    activeCar.hp = Math.max(15, activeCar.hp - 14);
                    if (z.hp <= 0) {
                      killLocalZombie(zid, z, false);
                    } else {
                      syncBossHud();
                    }
                  }
                } else {
                  soundEngine.playVehicleHit();
                  spawnParticles(z.rig.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)), 0x991b1b, 10, 6);
                  pushFloatingDamage(z.rig.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), '¡ATROPELLADO!', true);
                  killLocalZombie(zid, z, false);
                  activeCar.hp = Math.max(20, activeCar.hp - 3);
                }
              }
            }
          } else if (mode === 'multiplayer' && roomSubMode === 'coop' && wsRef.current?.readyState === WebSocket.OPEN) {
            for (const [zid, mz] of mpZombies.entries()) {
              if (mz.rig.root.position.distanceTo(activeCar.pos) < 2.3 && nowMs - activeCar.lastRamAt > 250) {
                activeCar.lastRamAt = nowMs;
                soundEngine.playVehicleHit();
                wsRef.current.send(JSON.stringify({ type: 'hit_zombie', zombieId: zid, damage: 500, headshot: false }));
              }
            }
          }
        }

        if (Math.abs(activeCar.speed) > 3.5 && nowMs - lastCarNoiseAt > 480) {
          lastCarNoiseAt = nowMs;
          emitNoise(activeCar.pos, Math.min(34, 12 + Math.abs(activeCar.speed)), false);
        }

        if (nowMs - lastCarUiAt > 80) {
          lastCarUiAt = nowMs;
          setDrivingVehicle({
            name: activeCar.name,
            speedKmh: Math.round(Math.abs(activeCar.speed) * 4.5),
            hp: activeCar.hp,
            maxHp: activeCar.maxHp,
            headlights: activeCar.headlightsOn,
          });
        }
      } else if (!eng.gameOver && !eng.modalOpen && !eng.chatOpen) {
        let moveF = 0;
        let moveR = 0;
        if (eng.keys['KeyW'] || eng.keys['ArrowUp']) moveF += 1;
        if (eng.keys['KeyS'] || eng.keys['ArrowDown']) moveF -= 1;
        if (eng.keys['KeyD'] || eng.keys['ArrowRight']) moveR += 1;
        if (eng.keys['KeyA'] || eng.keys['ArrowLeft']) moveR -= 1;

        if (Math.abs(eng.joyVec.x) > 0.08 || Math.abs(eng.joyVec.y) > 0.08) {
          moveR += eng.joyVec.x;
          moveF -= eng.joyVec.y;
        }

        const joyMag = Math.hypot(eng.joyVec.x, eng.joyVec.y);
        const wantsSprint =
          Boolean(eng.keys['ShiftLeft'] || eng.keys['ShiftRight'] || joyMag > 0.8) &&
          !eng.isAds &&
          !eng.isCrouching;

        _forward.set(-Math.sin(eng.yaw), 0, -Math.cos(eng.yaw));
        _right.set(Math.cos(eng.yaw), 0, -Math.sin(eng.yaw));
        _v1.set(0, 0, 0).addScaledVector(_forward, moveF).addScaledVector(_right, moveR);

        if (_v1.lengthSq() > 0.01) {
          isMoving = true;
          isSprinting = wantsSprint && eng.stamina > 3;
          if (isSprinting) {
            eng.stamina = Math.max(0, eng.stamina - 22 * dt);
          } else {
            eng.stamina = Math.min(100, eng.stamina + 12 * dt);
          }

          const crouchMult = eng.isCrouching ? 0.56 : 1.0;
          const baseSpeed =
            6.3 * armorStats.speedMult * crouchMult * (isSprinting ? 1.44 : 1.0) * (eng.isAds ? 0.65 : 1.0);

          _v1.normalize().multiplyScalar(baseSpeed * dt);
          eng.pos.add(_v1);
          resolveCircleAABBCollisions(
            eng.pos,
            0.48,
            arena.colliders,
            mode === 'practice' ? 15.2 : arena.arenaRadius,
            mode === 'practice' ? -54 : -arena.arenaRadius,
            mode === 'practice' ? 12 : arena.arenaRadius
          );
          eng.viewBob += dt * (isSprinting ? 14 : eng.isCrouching ? 6 : 9.5);

          if (nowMs - lastFootstepNoiseAt > 420) {
            lastFootstepNoiseAt = nowMs;
            const stepNoise = eng.isCrouching ? 1.5 : isSprinting ? 15 : 6.5;
            emitNoise(eng.pos, stepNoise, false);
          }
        } else {
          eng.stamina = Math.min(100, eng.stamina + 18 * dt);
        }
      }

      // Sync all drivable vehicle visuals (wheels spin, steering pivots, sirens, coasting)
      for (const v of vehicles) {
        if (v !== activeCar) {
          v.speed = THREE.MathUtils.damp(v.speed, 0, 3.8, dt);
          if (Math.abs(v.speed) > 0.1) {
            v.pos.x += -Math.sin(v.yaw) * v.speed * dt;
            v.pos.z += -Math.cos(v.yaw) * v.speed * dt;
            resolveCircleAABBCollisions(v.pos, 1.78, arena.colliders, arena.arenaRadius - 1.5);
          }
        }
        v.rig.root.position.copy(v.pos);
        v.rig.root.rotation.y = v.yaw;
        v.rig.frontSteerLeft.rotation.y = v.steerAngle;
        v.rig.frontSteerRight.rotation.y = v.steerAngle;
        v.rig.wheels.forEach((w) => {
          w.rotation.x -= (v.speed * dt) / 0.4;
        });
        v.rig.bodyGroup.rotation.z = THREE.MathUtils.damp(
          v.rig.bodyGroup.rotation.z,
          -v.steerAngle * 0.1 * (Math.abs(v.speed) / Math.max(1, v.maxSpeed)),
          10,
          dt
        );
        if (v.rig.sirenMeshes.length === 2) {
          const activeLights = v === activeCar || v.headlightsOn;
          const phase = Math.floor(nowMs / 240) % 2;
          (v.rig.sirenMeshes[0].material as THREE.MeshStandardMaterial).emissiveIntensity =
            activeLights && phase === 0 ? 2.6 : 0.25;
          (v.rig.sirenMeshes[1].material as THREE.MeshStandardMaterial).emissiveIntensity =
            activeLights && phase === 1 ? 2.6 : 0.25;
        }
      }

      if (nowMs - lastNoiseUiAt > 180) {
        lastNoiseUiAt = nowMs;
        setStamina(Math.round(eng.stamina));
        if (nowMs - eng.lastShotAt > 900) {
          if (activeCar && Math.abs(activeCar.speed) > 2) {
            setNoiseLabel('Ruido Alto');
            setNoiseLevelPct(82);
          } else if (!isMoving) {
            setNoiseLabel('Silencio');
            setNoiseLevelPct(4);
          } else if (eng.isCrouching) {
            setNoiseLabel('Sigilo');
            setNoiseLevelPct(15);
          } else if (isSprinting) {
            setNoiseLabel('Pasos');
            setNoiseLevelPct(65);
          } else {
            setNoiseLabel('Pasos');
            setNoiseLevelPct(32);
          }
        }
      }

      if (!activeCar && !eng.onGround) {
        eng.velY -= 19.5 * dt;
        eng.pos.y += eng.velY * dt;
        if (eng.pos.y <= 0) {
          eng.pos.y = 0;
          eng.velY = 0;
          eng.onGround = true;
        }
      }

      eng.recoilPitch = THREE.MathUtils.damp(eng.recoilPitch, 0, 12, dt);
      eng.recoilYaw = THREE.MathUtils.damp(eng.recoilYaw, 0, 12, dt);

      const activeSpec = WEAPON_MAP[eng.activeWeaponId];
      const activeAtt = normalizeAttachments(eng.weaponAttachments[eng.activeWeaponId]);
      const activeEff = computeEffectiveWeaponStats(eng.activeWeaponId, activeAtt);
      const effectiveOptic =
        activeAtt.optic === 'none' && (activeSpec.id === 'awp_espectro' || activeSpec.id === 'cheytac_m200')
          ? 'sniper_8x'
          : activeAtt.optic === 'none' && (activeSpec.id === 'm24_cazador' || activeSpec.id === 'kar98k_classic')
          ? 'acog_4x'
          : activeAtt.optic;
      const isScopedOptic =
        effectiveOptic === 'acog_4x' || effectiveOptic === 'thermal_scope' || effectiveOptic === 'sniper_8x';

      eng.adsBlend = THREE.MathUtils.damp(eng.adsBlend, eng.isAds && !eng.isReloading && !activeCar ? 1 : 0, 18, dt);

      const scopedFov =
        isScopedOptic && eng.extraZoom ? Math.max(11, activeEff.zoomFov * 0.6) : activeEff.zoomFov;
      const targetFov = activeCar ? 78 : eng.isAds ? scopedFov : 72;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 15, dt);
        camera.updateProjectionMatrix();
      }

      _euler.set(
        THREE.MathUtils.clamp(eng.pitch + eng.recoilPitch, -1.45, 1.45),
        eng.yaw + eng.recoilYaw,
        0,
        'YXZ'
      );
      _camQuat.setFromEuler(_euler);
      camera.quaternion.copy(_camQuat);

      const eyeHeight = eng.isCrouching ? 1.12 : 1.66;

      const swingDuration = 280;
      const swingActive = nowMs < eng.meleeSwingUntil;
      const swingT = swingActive ? Math.min(1, (nowMs - eng.meleeSwingStartedAt) / swingDuration) : 0;
      const swingArc = swingActive ? Math.sin(swingT * Math.PI) : 0;

      if (activeCar) {
        localPlayerRig.root.visible = false;
        fpWeaponPivot.visible = false;
        const chaseOffset = new THREE.Vector3(0, 1.45, 6.4).applyQuaternion(_camQuat);
        const carCenter = new THREE.Vector3(activeCar.pos.x, 1.35, activeCar.pos.z);
        camera.position.copy(carCenter).add(chaseOffset);
        camera.position.y = Math.max(0.95, camera.position.y);
      } else if (eng.perspective === '1p') {
        localPlayerRig.root.visible = false;
        const hideGunForScope = !activeSpec.isMelee && isScopedOptic && eng.adsBlend > 0.62;
        fpWeaponPivot.visible = !hideGunForScope;

        const bobScale = 1 - eng.adsBlend * 0.85;
        const bobY = isMoving ? Math.sin(eng.viewBob) * 0.026 * bobScale : 0;
        camera.position.set(eng.pos.x, eng.pos.y + eyeHeight + bobY, eng.pos.z);

        const hipX = activeSpec.isMelee ? 0.27 : 0.23;
        const hipY = activeSpec.isMelee ? -0.25 : -0.22;
        const hipZ = activeSpec.isMelee ? -0.44 : -0.45;

        // Align the 3D optic center directly with the camera's forward eye ray (0, 0, -Z)
        const targetAdsX = -fpSightOffset.x;
        const targetAdsY = -fpSightOffset.y;
        const targetAdsZ = -0.22 - fpSightOffset.z * 0.45;

        const adsFactor = activeSpec.isMelee ? 0 : eng.adsBlend;
        const curX = THREE.MathUtils.lerp(hipX, targetAdsX, adsFactor);
        const curY = THREE.MathUtils.lerp(hipY, targetAdsY, adsFactor);
        const curZ = THREE.MathUtils.lerp(hipZ, targetAdsZ, adsFactor);
        const reloadTilt = eng.isReloading ? -0.55 : 0;

        fpWeaponPivot.position.set(
          curX + (isMoving ? Math.cos(eng.viewBob * 0.5) * 0.009 * bobScale : 0) - swingArc * 0.26,
          curY + (isMoving ? Math.abs(Math.sin(eng.viewBob)) * 0.011 * bobScale : 0) - swingArc * 0.06,
          curZ + eng.recoilPitch * (0.22 * (1 - adsFactor * 0.45)) - swingArc * 0.14
        );
        if (activeSpec.isMelee) {
          fpWeaponPivot.rotation.set(
            0.18 - swingArc * 1.15,
            0.22 + swingArc * 0.85,
            0.12 + swingArc * 0.72
          );
        } else {
          fpWeaponPivot.rotation.set(reloadTilt + eng.recoilPitch * (0.65 * (1 - adsFactor * 0.35)), 0, 0);
        }
      } else {
        localPlayerRig.root.visible = true;
        fpWeaponPivot.visible = false;
        localPlayerRig.root.position.copy(eng.pos);
        localPlayerRig.root.rotation.y = eng.yaw;
        localPlayerRig.root.scale.y = eng.isCrouching ? 0.78 : 1.0;

        const swing = isMoving ? Math.sin(eng.viewBob) * 0.6 : 0;
        localPlayerRig.leftLeg.rotation.x = swing;
        localPlayerRig.rightLeg.rotation.x = -swing;
        localPlayerRig.rightArm.rotation.x = activeSpec.isMelee ? -0.45 - swingArc * 1.55 : 0;

        const backOffset = new THREE.Vector3(0.55, 0.35, 3.3).applyQuaternion(_camQuat);
        const eyeOrigin = new THREE.Vector3(eng.pos.x, eng.pos.y + eyeHeight, eng.pos.z);
        camera.position.copy(eyeOrigin).add(backOffset);
        camera.position.y = Math.max(0.6, camera.position.y);
      }

      let autoShouldFire = false;
      if (!activeCar && eng.touchMode && eng.autoFireMobile && !eng.gameOver && !eng.modalOpen) {
        _euler.set(eng.pitch, eng.yaw, 0, 'YXZ');
        const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(_euler).normalize();
        raycaster.set(camera.position, lookDir);
        raycaster.far = activeEff.range;
        const targetsToScan: THREE.Object3D[] = [];
        if (mode === 'practice') {
          practiceTargets.forEach((pt) => {
            if (pt.respawnAt === 0) targetsToScan.push(pt.rig.board);
          });
        } else if (mode === 'survival') {
          localZombies.forEach((z) => targetsToScan.push(z.rig.torso));
        } else if (mode === 'multiplayer') {
          mpZombies.forEach((z) => targetsToScan.push(z.rig.torso));
          if (roomSubMode === 'pvp') {
            remotePlayers.forEach((rp) => {
              if (rp.state.hp > 0) targetsToScan.push(rp.rig.bodyGroup);
            });
          }
        }
        if (targetsToScan.length > 0 && raycaster.intersectObjects(targetsToScan, true).length > 0) {
          autoShouldFire = true;
        }
      }

      if (!activeCar && ((eng.isFiring && activeSpec.auto) || eng.triggerFireOnce || autoShouldFire)) {
        eng.triggerFireOnce = false;
        fireCurrentWeapon(nowMs);
      }

      if (muzzleFlashMesh.visible && nowMs > muzzleFlashHideAt) {
        muzzleFlashMesh.visible = false;
        muzzleFlashLight.intensity = 0;
      }

      if (mode === 'practice') {
        for (const pt of practiceTargets) {
          if (pt.respawnAt > 0) {
            if (nowMs >= pt.respawnAt) {
              pt.respawnAt = 0;
              pt.hp = pt.maxHp;
              pt.rig.root.visible = true;
            }
          } else {
            if (pt.moving) {
              pt.phase += dt * pt.speed * 0.7;
              pt.rig.root.position.x = pt.baseX + Math.sin(pt.phase) * 4.5;
            }
            const r = Math.max(0.01, pt.hp / pt.maxHp);
            pt.rig.hpBarFill.scale.x = r;
            pt.rig.hpBarFill.position.x = -(1 - r) * 0.36;
          }
        }
      }

      // Crates, Ground Weapons & Drivable Vehicles Interaction ([E])
      if (mode === 'survival' || mode === 'multiplayer') {
        let promptMsg: string | null = null;
        let foundNearCrate: SupplyCrateEntity | null = null;
        let foundNearWeapon: WeaponWorldDrop | null = null;
        let foundNearVehicle: DrivableVehicleEntity | null = null;

        if (!activeCar) {
          if (mode === 'survival') {
            for (const cr of crates) {
              if (cr.opened) {
                if (nowMs >= cr.respawnAt) {
                  cr.opened = false;
                  cr.lid.rotation.x = 0;
                  cr.lid.position.y = 0.68;
                  cr.indicator.visible = true;
                }
                continue;
              }
              if (cr.pos.distanceTo(eng.pos) < 2.8) {
                foundNearCrate = cr;
                promptMsg = eng.touchMode ? 'Tocar para Saquear Caja' : 'Pulsa [E] para Saquear Caja de Suministros';
                break;
              }
            }

            for (const wd of weaponDrops) {
              if (wd.collected) {
                if (nowMs >= wd.respawnAt) {
                  wd.collected = false;
                  wd.mesh.visible = true;
                }
                continue;
              }
              wd.mesh.rotation.y += dt * 1.4;
              if (!foundNearCrate && wd.pos.distanceTo(eng.pos) < 2.5) {
                foundNearWeapon = wd;
                const wSpec = WEAPON_MAP[wd.weaponId];
                promptMsg = eng.touchMode
                  ? `Tocar para Recoger ${wSpec.name} [${wSpec.rarity}]`
                  : `Pulsa [E] para Recoger ${wSpec.name} [${wSpec.rarity}]`;
              }
            }
          }

          if (!foundNearCrate && !foundNearWeapon) {
            let bestVehDist = 3.7;
            for (const v of vehicles) {
              const d = v.pos.distanceTo(eng.pos);
              if (d < bestVehDist) {
                bestVehDist = d;
                foundNearVehicle = v;
              }
            }
            if (foundNearVehicle) {
              promptMsg = eng.touchMode
                ? `Tocar para Conducir ${foundNearVehicle.name}`
                : `Pulsa [E] para Conducir ${foundNearVehicle.name}`;
            }
          }
        }
        setNearPrompt(promptMsg);

        if (eng.interactRequested) {
          eng.interactRequested = false;
          if (activeCar) {
            const sidePos = new THREE.Vector3(
              activeCar.pos.x + Math.cos(activeCar.yaw) * 2.4,
              0,
              activeCar.pos.z - Math.sin(activeCar.yaw) * 2.4
            );
            resolveCircleAABBCollisions(sidePos, 0.52, arena.colliders, arena.arenaRadius);
            eng.pos.copy(sidePos);
            activeCar.speed *= 0.35;
            eng.drivingVehicleId = null;
            activeCar = null;
            setDrivingVehicle(null);
            showLootToast('Saliste del vehículo');
          } else if (foundNearWeapon && !foundNearWeapon.collected) {
            foundNearWeapon.collected = true;
            foundNearWeapon.mesh.visible = false;
            foundNearWeapon.respawnAt = nowMs + 60000;
            soundEngine.playPickup();

            const wSpec = WEAPON_MAP[foundNearWeapon.weaponId];
            const eff = computeEffectiveWeaponStats(foundNearWeapon.weaponId, eng.weaponAttachments[foundNearWeapon.weaponId]);
            if (!eng.unlockedWeapons.has(foundNearWeapon.weaponId)) {
              eng.unlockedWeapons.add(foundNearWeapon.weaponId);
              setUnlockedWeapons(Array.from(eng.unlockedWeapons));
              eng.ammo[foundNearWeapon.weaponId] = { mag: eff.magSize, reserve: eff.magSize };
              setAmmoState({ ...eng.ammo });
              switchWeapon(foundNearWeapon.weaponId);
              showLootToast(`¡Arma [${wSpec.rarity}]: ${wSpec.name} (${wSpec.category})!`);
            } else if (wSpec.isMelee) {
              eng.scrap += 35;
              setScrap(eng.scrap);
              showLootToast(`Ya llevas ${wSpec.name} · +35 Chatarra al reciclar`);
            } else {
              eng.ammo[foundNearWeapon.weaponId].reserve = Math.min(
                eff.reserveMax,
                eng.ammo[foundNearWeapon.weaponId].reserve + eff.magSize
              );
              setAmmoState({ ...eng.ammo });
              showLootToast(`+${eff.magSize} Balas para ${wSpec.name}`);
            }
          } else if (foundNearCrate && !foundNearCrate.opened) {
            foundNearCrate.opened = true;
            foundNearCrate.lid.rotation.x = -0.85;
            foundNearCrate.lid.position.y = 0.85;
            foundNearCrate.indicator.visible = false;
            foundNearCrate.respawnAt = nowMs + 45000;
            soundEngine.playCrateOpen();

            // Grant ammo for active firearm (or fallback to first unlocked firearm if holding melee)
            const ammoTargetId =
              !WEAPON_MAP[eng.activeWeaponId].isMelee
                ? eng.activeWeaponId
                : Array.from(eng.unlockedWeapons).find((wid) => !WEAPON_MAP[wid]?.isMelee) || null;
            let ammoMsg = '';
            if (ammoTargetId) {
              const curSpec = WEAPON_MAP[ammoTargetId];
              const curEff = computeEffectiveWeaponStats(ammoTargetId, eng.weaponAttachments[ammoTargetId]);
              const ammoBonus = curEff.magSize;
              eng.ammo[ammoTargetId].reserve = Math.min(
                curEff.reserveMax,
                eng.ammo[ammoTargetId].reserve + ammoBonus
              );
              setAmmoState({ ...eng.ammo });
              ammoMsg = `+${ammoBonus} Balas (${curSpec.name}) · `;
            }
            const scrapBonus = 95 + Math.floor(Math.random() * 65);
            eng.scrap += scrapBonus;
            setScrap(eng.scrap);
            eng.stones = Math.min(12, eng.stones + 3);
            setStones(eng.stones);
            if (eng.medkits < 5) {
              eng.medkits += 1;
              setMedkits(eng.medkits);
            }
            if (eng.grenadesCount < 6 && Math.random() < 0.65) {
              eng.grenadesCount = Math.min(6, eng.grenadesCount + 1);
              setGrenadesCount(eng.grenadesCount);
            }
            if (Math.random() < 0.6) {
              if (Math.random() < 0.55) {
                eng.bearTraps = Math.min(6, eng.bearTraps + 1);
                setBearTraps(eng.bearTraps);
              } else {
                eng.landmines = Math.min(6, eng.landmines + 1);
                setLandmines(eng.landmines);
              }
            }

            // Physical Military Crates can contain ANY random weapon (via pickWorldCrateWeapon) or attachments/supplies
            const foundCrateWeaponId = pickWorldCrateWeapon(Array.from(eng.unlockedWeapons));
            const lockedAtts = ATTACHMENTS.filter((a) => !eng.ownedAttachments.has(a.id));
            if (foundCrateWeaponId) {
              const foundW = WEAPON_MAP[foundCrateWeaponId];
              eng.unlockedWeapons.add(foundW.id);
              setUnlockedWeapons(Array.from(eng.unlockedWeapons));
              const wEff = computeEffectiveWeaponStats(foundW.id, eng.weaponAttachments[foundW.id]);
              eng.ammo[foundW.id] = { mag: wEff.magSize, reserve: wEff.magSize };
              setAmmoState({ ...eng.ammo });
              showLootToast(`¡Caja Militar [${foundW.rarity}]: Encontraste ${foundW.name} + ${scrapBonus} Chatarra!`);
            } else if (lockedAtts.length > 0 && Math.random() < 0.45) {
              const foundAtt = lockedAtts[Math.floor(Math.random() * lockedAtts.length)];
              eng.ownedAttachments.add(foundAtt.id);
              setOwnedAttachments(Array.from(eng.ownedAttachments));
              showLootToast(`¡Accesorio encontrado: ${foundAtt.name} (equipa en [B])!`);
            } else {
              showLootToast(`Caja (sin arma): ${ammoMsg}+${scrapBonus} Chatarra · +1 Botiquín`);
            }
          } else if (foundNearVehicle) {
            eng.drivingVehicleId = foundNearVehicle.id;
            eng.isAds = false;
            eng.isFiring = false;
            setIsAds(false);
            eng.yaw = foundNearVehicle.yaw;
            eng.pitch = -0.18;
            foundNearVehicle.headlightsOn = true;
            foundNearVehicle.rig.headlightBeam.intensity = 3.8;
            setDrivingVehicle({
              name: foundNearVehicle.name,
              speedKmh: 0,
              hp: foundNearVehicle.hp,
              maxHp: foundNearVehicle.maxHp,
              headlights: true,
            });
            soundEngine.playPickup();
            showLootToast(`Conduciendo ${foundNearVehicle.name} · [K] Bocina · [L] Luces · [E] Bajar`);
          }
        }
      }

      // Survival: Waves & Boss every 5 waves + Wall-Impenetrable Zombie AI
      if (mode === 'survival') {
        if (!eng.gameOver) {
          if (survivalNextWaveAt > 0) {
            if (nowMs >= survivalNextWaveAt) {
              survivalNextWaveAt = 0;
              eng.wave += 1;
              setWave(eng.wave);
              const isBossWave = eng.wave % 5 === 0;
              survivalWaveRemaining = isBossWave ? 6 + Math.floor(eng.wave * 1.4) : 8 + eng.wave * 4;
              if (isBossWave) {
                spawnSurvivalBoss();
              } else {
                const wavesToBoss = 5 - (eng.wave % 5);
                setWaveBanner(`Oleada ${eng.wave} — Horda mixta (Jefe en ${wavesToBoss} ${wavesToBoss === 1 ? 'oleada' : 'oleadas'})`);
                soundEngine.playWaveStart();
                window.setTimeout(() => setWaveBanner(null), 2800);
              }
              syncWaveCountUi();
            }
          } else {
            if (survivalWaveRemaining > 0 && localZombies.size < 22 && nowMs - survivalLastSpawnAt > 950) {
              spawnSurvivalZombie(false);
              survivalWaveRemaining -= 1;
              survivalLastSpawnAt = nowMs;
              syncWaveCountUi();
            } else if (survivalWaveRemaining === 0 && localZombies.size === 0) {
              survivalNextWaveAt = nowMs + 4200;
              setWaveBanner(`Oleada ${eng.wave} completada · +120 Chatarra`);
              eng.scrap += 120;
              setScrap(eng.scrap);
              awardCredits(45);
              syncWaveCountUi();
              window.setTimeout(() => setWaveBanner(null), 2400);
            }
          }

          const sightRange = eng.isCrouching && !activeCar ? 9.5 : activeCar ? 28 : 19;
          const zombieArr = Array.from(localZombies.values());
          const wanderBound = arena.arenaRadius - 4;
          let hasActiveBoss = false;

          for (const z of zombieArr) {
            const zPos = z.rig.root.position;
            const bossSpec = z.isBoss && z.bossVariant ? BOSS_ARCHETYPES[z.bossVariant] : null;
            if (z.isBoss) {
              hasActiveBoss = true;
              const bRig = z.rig as BossZombieRig;
              bRig.weakSpotMat.emissiveIntensity = 1.8 + Math.sin(nowMs * 0.008) * 1.0;
            }

            const distToPlayer = _v1.subVectors(eng.pos, zPos).setY(0).length();
            const canSeePlayer =
              z.isBoss ||
              (distToPlayer <= sightRange &&
                hasLineOfSightXZ(zPos.x, zPos.z, eng.pos.x, eng.pos.z, arena.colliders, 1.5));

            if (canSeePlayer && z.aiState !== 'chasing') {
              z.aiState = 'chasing';
            }

            if (z.aiState === 'chasing') {
              z.targetPos.copy(eng.pos);
              if (!z.isBoss && distToPlayer > 34 && !canSeePlayer) {
                z.aiState = 'wandering';
              }
            } else if (z.aiState === 'investigating') {
              if (nowMs >= z.investigateUntil) {
                z.aiState = 'wandering';
              }
            } else {
              if (nowMs >= z.nextWanderAt || zPos.distanceTo(z.wanderTarget) < 1.5) {
                z.nextWanderAt = nowMs + 3500 + Math.random() * 3000;
                z.wanderTarget.set(
                  THREE.MathUtils.clamp(zPos.x + (Math.random() - 0.5) * 28, -wanderBound, wanderBound),
                  0,
                  THREE.MathUtils.clamp(zPos.z + (Math.random() - 0.5) * 28, -wanderBound, wanderBound)
                );
              }
              z.targetPos.copy(z.wanderTarget);
            }

            // Spitter & Ranged Boss acid attack
            const canShootAcid = z.type === 'spitter' || Boolean(bossSpec?.rangedAcidBurst);
            const maxAcidRange = bossSpec ? 22 : 16.5;
            const acidCooldown = bossSpec ? 2400 : 2600;
            if (
              canShootAcid &&
              z.aiState === 'chasing' &&
              distToPlayer > 3.5 &&
              distToPlayer <= maxAcidRange &&
              nowMs - z.lastAttackAt > acidCooldown &&
              hasLineOfSightXZ(zPos.x, zPos.z, eng.pos.x, eng.pos.z, arena.colliders, 1.2)
            ) {
              z.lastAttackAt = nowMs;
              const spreadAngles = bossSpec?.rangedAcidBurst ? [-0.16, 0, 0.16] : [0];
              const origin = new THREE.Vector3(zPos.x, z.isBoss ? 2.15 : z.isCrawling ? 0.45 : 1.45, zPos.z);
              const aimTgt = new THREE.Vector3(eng.pos.x, 1.25, eng.pos.z);
              const baseDir = aimTgt.sub(origin).normalize();
              const acidDmg = bossSpec ? 16 + (z.bossTier || 1) * 3 : 14;
              const acidSpeed = bossSpec ? 20 : 17.5;
              const acidRadius = bossSpec ? 0.22 : 0.16;

              for (const ang of spreadAngles) {
                const spitDir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
                const spitMesh = new THREE.Mesh(
                  new THREE.SphereGeometry(acidRadius, 8, 8),
                  new THREE.MeshBasicMaterial({ color: bossSpec ? bossSpec.weakPointEmissive : 0x4ade80 })
                );
                spitMesh.position.copy(origin);
                scene.add(spitMesh);
                acidSpits.push({
                  mesh: spitMesh,
                  vel: spitDir.multiplyScalar(acidSpeed).add(new THREE.Vector3(0, 1.4, 0)),
                  life: 2.3,
                  damage: acidDmg,
                });
              }
            }

            const slowMult = z.slowedUntil && z.slowedUntil > nowMs ? 0.52 : 1.0;
            const moveSpeed =
              (z.aiState === 'chasing' ? z.speed : z.aiState === 'investigating' ? z.speed * 0.85 : z.speed * 0.38) *
              slowMult;

            const distToGoal = Math.hypot(z.targetPos.x - zPos.x, z.targetPos.z - zPos.z);
            const stopDist = z.isBoss ? 1.8 : 1.35;

            if (distToGoal > stopDist) {
              const steer = steerAroundWalls(
                zPos.x,
                zPos.z,
                z.targetPos.x,
                z.targetPos.z,
                arena.colliders,
                z.isBoss ? 1.65 : 1.35,
                arena.arenaRadius - 2
              );
              z.rig.root.rotation.y = Math.atan2(-steer.dirX, -steer.dirZ);

              const stepLen = moveSpeed * dt;
              const subSteps = stepLen > 0.2 ? 2 : 1;
              for (let s = 0; s < subSteps; s++) {
                zPos.x += steer.dirX * (stepLen / subSteps);
                zPos.z += steer.dirZ * (stepLen / subSteps);
                resolveCircleAABBCollisions(zPos, z.isBoss ? 0.78 : 0.5, arena.colliders, arena.arenaRadius);
              }

              z.walkPhase += dt * moveSpeed * (z.isCrawling ? 4.2 : 2.5);
              if (z.isCrawling) {
                const crawlSwing = Math.sin(z.walkPhase) * 0.55;
                z.rig.leftArm.rotation.x = crawlSwing;
                z.rig.rightArm.rotation.x = -crawlSwing;
              } else {
                const sw = Math.sin(z.walkPhase) * 0.55;
                z.rig.leftLeg.rotation.x = sw;
                z.rig.rightLeg.rotation.x = -sw;
              }
            } else if (
              z.aiState === 'chasing' &&
              distToPlayer <= (activeCar ? (z.isBoss ? 2.9 : 2.4) : z.isBoss ? 2.25 : 1.55) &&
              nowMs - z.lastAttackAt > (z.isBoss ? 1150 : 950) &&
              hasLineOfSightXZ(zPos.x, zPos.z, eng.pos.x, eng.pos.z, arena.colliders, 1.2)
            ) {
              z.lastAttackAt = nowMs;
              const dmg = z.isBoss
                ? z.meleeDamage || 30
                : z.type === 'brute'
                ? 24
                : z.type === 'bloater'
                ? 20
                : z.type === 'riot'
                ? 16
                : z.type === 'spitter'
                ? 14
                : 12;
              if (bossSpec?.shockwaveSlam) {
                spawnParticles(zPos.clone().add(new THREE.Vector3(0, 0.35, 0)), bossSpec.weakPointEmissive, 14, 7.5);
                emitNoise(zPos, 14, true, bossSpec.weakPointEmissive);
              }
              if (activeCar) {
                activeCar.hp = Math.max(0, activeCar.hp - Math.round(dmg * 0.7));
                soundEngine.playVehicleHit();
                if (activeCar.hp <= 0) {
                  eng.drivingVehicleId = null;
                  activeCar = null;
                  setDrivingVehicle(null);
                  showLootToast('¡Vehículo inutilizado!');
                }
              } else {
                eng.hp = Math.max(0, eng.hp - dmg);
                setHp(eng.hp);
                soundEngine.playHurt();
                setDamageFlash(true);
                window.setTimeout(() => setDamageFlash(false), 180);
                if (eng.hp <= 0) {
                  eng.gameOver = true;
                  setGameOver(true);
                  if (document.pointerLockElement === canvas) {
                    document.exitPointerLock();
                  }
                }
              }
            }

            const ratio = Math.max(0.01, z.hp / z.maxHp);
            z.rig.hpBarFill.scale.x = ratio;
            z.rig.hpBarFill.position.x = -(1 - ratio) * 0.355;
            z.rig.hpBarGroup.lookAt(camera.position);
          }

          if (hasActiveBoss && nowMs - lastBossHudSyncAt > 120) {
            lastBossHudSyncAt = nowMs;
            syncBossHud();
          }

          // Zombie-to-Zombie separation followed by wall clamp so zombies never push each other through walls
          for (let i = 0; i < zombieArr.length; i++) {
            for (let j = i + 1; j < zombieArr.length; j++) {
              const pA = zombieArr[i].rig.root.position;
              const pB = zombieArr[j].rig.root.position;
              const dx = pB.x - pA.x;
              const dz = pB.z - pA.z;
              const dSq = dx * dx + dz * dz;
              if (dSq > 0.0001 && dSq < 0.72 * 0.72) {
                const d = Math.sqrt(dSq);
                const push = (0.72 - d) * 0.45;
                pA.x -= (dx / d) * push;
                pA.z -= (dz / d) * push;
                pB.x += (dx / d) * push;
                pB.z += (dz / d) * push;
                resolveCircleAABBCollisions(pA, 0.5, arena.colliders, arena.arenaRadius);
                resolveCircleAABBCollisions(pB, 0.5, arena.colliders, arena.arenaRadius);
              }
            }
          }
        }
      }

      if (mode === 'multiplayer') {
        for (const rp of remotePlayers.values()) {
          rp.rig.root.position.lerp(rp.targetPos, 1 - Math.exp(-14 * dt));
          rp.rig.root.rotation.y = rp.targetYaw;
          if (rp.state.isMoving) {
            rp.walkPhase += dt * 11;
            const sw = Math.sin(rp.walkPhase) * 0.55;
            rp.rig.leftLeg.rotation.x = sw;
            rp.rig.rightLeg.rotation.x = -sw;
          } else {
            rp.rig.leftLeg.rotation.x = 0;
            rp.rig.rightLeg.rotation.x = 0;
          }
        }
        for (const mz of mpZombies.values()) {
          mz.rig.root.position.lerp(mz.targetPos, 1 - Math.exp(-12 * dt));
          mz.rig.root.rotation.y = mz.targetYaw;
          mz.walkPhase += dt * (mz.isCrawling ? 6 : 8);
          if (mz.isCrawling) {
            const cw = Math.sin(mz.walkPhase) * 0.55;
            mz.rig.leftArm.rotation.x = cw;
            mz.rig.rightArm.rotation.x = -cw;
          } else {
            const sw = Math.sin(mz.walkPhase) * 0.5;
            mz.rig.leftLeg.rotation.x = sw;
            mz.rig.rightLeg.rotation.x = -sw;
          }
          mz.rig.hpBarGroup.lookAt(camera.position);
        }

        if (wsRef.current?.readyState === WebSocket.OPEN && nowMs - lastMpSendAt >= 50) {
          lastMpSendAt = nowMs;
          wsRef.current.send(
            JSON.stringify({
              type: 'player_update',
              x: eng.pos.x,
              y: eng.pos.y,
              z: eng.pos.z,
              yaw: eng.yaw,
              pitch: eng.pitch,
              weaponId: eng.activeWeaponId,
              isMoving,
            })
          );
        }

        if (nowMs - lastTagProjAt > 90) {
          lastTagProjAt = nowMs;
          const tags: ProjectedTag[] = [];
          for (const [pid, rp] of remotePlayers) {
            if (rp.state.hp <= 0) continue;
            _v2.copy(rp.rig.root.position);
            _v2.y += 2.25;
            _v2.project(camera);
            if (_v2.z < 1 && _v2.z > -1) {
              const sx = ((_v2.x + 1) / 2) * container.clientWidth;
              const sy = ((-_v2.y + 1) / 2) * container.clientHeight;
              if (sx > 0 && sx < container.clientWidth && sy > 0 && sy < container.clientHeight) {
                tags.push({
                  id: pid,
                  name: rp.state.name,
                  platform: rp.state.platform,
                  x: sx,
                  y: sy,
                  hp: rp.state.hp,
                  maxHp: rp.state.maxHp,
                });
              }
            }
          }
          setProjectedTags(tags);
        }
      }

      // Thrown Stones
      for (let i = stonesProj.length - 1; i >= 0; i--) {
        const st = stonesProj[i];
        st.life -= dt;
        st.vel.y -= 17 * dt;
        st.mesh.position.addScaledVector(st.vel, dt);
        st.mesh.rotation.x += dt * 8;
        st.mesh.rotation.z += dt * 6;
        if (st.mesh.position.y <= 0.11 && !st.bounced) {
          st.mesh.position.y = 0.11;
          st.vel.y = Math.abs(st.vel.y) * 0.32;
          st.vel.x *= 0.45;
          st.vel.z *= 0.45;
          st.bounced = true;
          soundEngine.playStoneImpact();
          emitNoise(st.mesh.position, 28, true, 0x38bdf8);
          showLootToast('Piedra impactó — ¡Zombies atraídos al ruido!');
        } else if (st.mesh.position.y < 0.11) {
          st.mesh.position.y = 0.11;
          st.vel.set(0, 0, 0);
        }
        if (st.life <= 0) {
          scene.remove(st.mesh);
          st.mesh.geometry.dispose();
          (st.mesh.material as THREE.Material).dispose();
          stonesProj.splice(i, 1);
        }
      }

      // Acid Spits (Spitter Zombies)
      for (let i = acidSpits.length - 1; i >= 0; i--) {
        const sp = acidSpits[i];
        sp.life -= dt;
        sp.vel.y -= 5.2 * dt;
        sp.mesh.position.addScaledVector(sp.vel, dt);
        const hitWall = resolveCircleAABBCollisions(sp.mesh.position.clone(), 0.18, arena.colliders, arena.arenaRadius);
        const hitPlayer = sp.mesh.position.distanceTo(new THREE.Vector3(eng.pos.x, 1.1, eng.pos.z)) < 1.05;
        if (hitPlayer && !eng.gameOver) {
          if (activeCar) {
            activeCar.hp = Math.max(5, activeCar.hp - 4);
          } else {
            eng.hp = Math.max(0, eng.hp - sp.damage);
            setHp(eng.hp);
            soundEngine.playHurt();
            setDamageFlash(true);
            window.setTimeout(() => setDamageFlash(false), 180);
            if (eng.hp <= 0) {
              eng.gameOver = true;
              setGameOver(true);
            }
          }
          spawnParticles(sp.mesh.position, 0x4ade80, 7, 3.5);
          scene.remove(sp.mesh);
          sp.mesh.geometry.dispose();
          (sp.mesh.material as THREE.Material).dispose();
          acidSpits.splice(i, 1);
          continue;
        }
        if (hitWall || sp.mesh.position.y <= 0.1 || sp.life <= 0) {
          spawnParticles(sp.mesh.position, 0x4ade80, 5, 2.5);
          scene.remove(sp.mesh);
          sp.mesh.geometry.dispose();
          (sp.mesh.material as THREE.Material).dispose();
          acidSpits.splice(i, 1);
        }
      }

      // Noise Rings
      for (let i = noiseRings.length - 1; i >= 0; i--) {
        const nr = noiseRings[i];
        nr.life -= dt;
        const t = 1 - nr.life / nr.maxLife;
        nr.mesh.scale.setScalar(1 + t * nr.maxScale);
        (nr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - t) * 0.72);
        if (nr.life <= 0) {
          scene.remove(nr.mesh);
          nr.mesh.geometry.dispose();
          (nr.mesh.material as THREE.Material).dispose();
          noiseRings.splice(i, 1);
        }
      }

      // Shell Casings
      for (let i = shellCasings.length - 1; i >= 0; i--) {
        const sc = shellCasings[i];
        sc.life -= dt;
        sc.vel.y -= 14 * dt;
        sc.mesh.position.addScaledVector(sc.vel, dt);
        sc.mesh.rotation.x += sc.rotVel.x * dt;
        sc.mesh.rotation.y += sc.rotVel.y * dt;
        if (sc.mesh.position.y <= 0.02) {
          sc.mesh.position.y = 0.02;
          sc.vel.y = Math.abs(sc.vel.y) * 0.35;
          sc.vel.x *= 0.5;
          sc.vel.z *= 0.5;
        }
        if (sc.life <= 0) {
          scene.remove(sc.mesh);
          sc.mesh.geometry.dispose();
          (sc.mesh.material as THREE.Material).dispose();
          shellCasings.splice(i, 1);
        }
      }

      // Grenades & Rockets (Launcher + Thrown Hand Grenades)
      for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        g.life -= dt;
        g.vel.y -= (g.isRocket ? 2.4 : 16) * dt;
        g.mesh.position.addScaledVector(g.vel, dt);
        if (g.isHandGrenade) {
          g.mesh.rotation.x += dt * 7;
          g.mesh.rotation.z += dt * 5;
          if (g.mesh.position.y <= 0.12) {
            g.mesh.position.y = 0.12;
            if (Math.abs(g.vel.y) > 1.2) {
              g.vel.y = Math.abs(g.vel.y) * 0.42;
              soundEngine.playStoneImpact();
            } else {
              g.vel.y = 0;
            }
            g.vel.x *= 0.68;
            g.vel.z *= 0.68;
          }
          if (resolveCircleAABBCollisions(g.mesh.position, 0.14, arena.colliders, arena.arenaRadius)) {
            g.vel.x *= -0.45;
            g.vel.z *= -0.45;
          }
          if (g.life <= 0) {
            const hitPos = g.mesh.position.clone();
            hitPos.y = Math.max(0.25, hitPos.y);
            scene.remove(g.mesh);
            disposeObjectTree(g.mesh);
            grenades.splice(i, 1);
            explodeAt(hitPos, g.radius, g.damage);
          }
        } else {
          let impactHit =
            g.mesh.position.y <= 0.14 ||
            g.life <= 0 ||
            resolveCircleAABBCollisions(g.mesh.position.clone(), 0.16, arena.colliders, arena.arenaRadius);
          if (!impactHit && g.isRocket) {
            for (const z of localZombies.values()) {
              if (
                Math.hypot(z.rig.root.position.x - g.mesh.position.x, z.rig.root.position.z - g.mesh.position.z) < 1.15 &&
                g.mesh.position.y < 2.2
              ) {
                impactHit = true;
                break;
              }
            }
          }
          if (impactHit) {
            const hitPos = g.mesh.position.clone();
            hitPos.y = Math.max(0.2, hitPos.y);
            scene.remove(g.mesh);
            disposeObjectTree(g.mesh);
            grenades.splice(i, 1);
            explodeAt(hitPos, g.radius, g.damage);
          }
        }
      }

      // Placed Tactical Traps (Bear Traps & Landmines)
      for (let i = placedTraps.length - 1; i >= 0; i--) {
        const tr = placedTraps[i];
        if (tr.type === 'landmine' && !tr.triggered) {
          const led = (tr.rig as LandmineRig).led;
          (led.material as THREE.MeshStandardMaterial).emissiveIntensity =
            Math.floor(nowMs / 340) % 2 === 0 ? 2.5 : 0.35;
        }
        if (tr.triggered) {
          if (nowMs >= tr.removeAt) {
            scene.remove(tr.rig.root);
            disposeObjectTree(tr.rig.root);
            placedTraps.splice(i, 1);
          }
          continue;
        }

        const trigRadius = tr.type === 'bear_trap' ? 1.25 : 1.8;
        let hitKind: 'zombie' | 'mp_zombie' | 'practice' | 'mp_player' | null = null;
        let hitId = '';

        if (mode === 'survival') {
          for (const [zid, z] of localZombies.entries()) {
            if (z.rig.root.position.distanceTo(tr.pos) <= trigRadius) {
              hitKind = 'zombie';
              hitId = zid;
              break;
            }
          }
        } else if (mode === 'multiplayer') {
          for (const [zid, mz] of mpZombies.entries()) {
            if (mz.rig.root.position.distanceTo(tr.pos) <= trigRadius) {
              hitKind = 'mp_zombie';
              hitId = zid;
              break;
            }
          }
          if (!hitKind && roomSubMode === 'pvp') {
            for (const [pid, rp] of remotePlayers.entries()) {
              if (rp.state.hp > 0 && rp.rig.root.position.distanceTo(tr.pos) <= trigRadius) {
                hitKind = 'mp_player';
                hitId = pid;
                break;
              }
            }
          }
        } else if (mode === 'practice') {
          for (const pt of practiceTargets) {
            if (pt.respawnAt === 0 && pt.rig.root.position.distanceTo(tr.pos) <= trigRadius) {
              hitKind = 'practice';
              hitId = pt.id;
              break;
            }
          }
        }

        if (!hitKind) continue;

        if (tr.type === 'landmine') {
          const boomPos = tr.pos.clone().add(new THREE.Vector3(0, 0.25, 0));
          scene.remove(tr.rig.root);
          disposeObjectTree(tr.rig.root);
          placedTraps.splice(i, 1);
          explodeAt(boomPos, 5.8, 185);
          showLootToast('¡Mina explosiva detonada!');
        } else {
          const bRig = tr.rig as BearTrapRig;
          bRig.leftJaw.rotation.z = 1.28;
          bRig.rightJaw.rotation.z = -1.28;
          soundEngine.playTrapSnap();
          spawnParticles(tr.pos.clone().add(new THREE.Vector3(0, 0.25, 0)), 0x991b1b, 8, 4.5);
          tr.triggered = true;
          tr.removeAt = nowMs + 2800;

          if (hitKind === 'zombie') {
            const z = localZombies.get(hitId);
            if (z) {
              if (z.isBoss) {
                z.hp -= 150;
                z.slowedUntil = nowMs + 2200;
                pushFloatingDamage(z.rig.root.position.clone().add(new THREE.Vector3(0, 2.5, 0)), '150 CEPO', false);
                triggerHitMarker(false);
                if (z.hp <= 0) {
                  killLocalZombie(hitId, z, false);
                } else {
                  syncBossHud();
                  showLootToast('¡Cepo ralentizó al Jefe (-150 PS)!');
                }
              } else {
                z.hp -= 110;
                pushFloatingDamage(z.rig.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '110 CEPO', false);
                triggerHitMarker(false);
                if (z.hp <= 0) {
                  killLocalZombie(hitId, z, false);
                } else if (!z.isCrawling) {
                  z.isCrawling = true;
                  z.speed = z.baseSpeed * 0.34;
                  applyZombieCrawlingPose(z.rig);
                  showLootToast('¡Cepo atrapó al zombie — se arrastra!');
                }
              }
            }
          } else if (hitKind === 'mp_zombie' && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: 'hit_zombie', zombieId: hitId, damage: 110, headshot: false, legShotgun: true })
            );
            triggerHitMarker(false);
          } else if (hitKind === 'mp_player' && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: 'hit_player', targetId: hitId, damage: 75, headshot: false })
            );
            triggerHitMarker(false);
          } else if (hitKind === 'practice') {
            const pt = practiceTargets.find((p) => p.id === hitId);
            if (pt) {
              pt.hp -= 110;
              pushFloatingDamage(pt.rig.root.position.clone().add(new THREE.Vector3(0, 1.6, 0)), '110 CEPO', false);
              triggerHitMarker(false);
              if (pt.hp <= 0) {
                pt.respawnAt = nowMs + 2000;
                pt.rig.root.visible = false;
                setPracticeStats((s) => ({ ...s, targetsDown: s.targetsDown + 1 }));
              }
            }
          }
        }
      }

      // Tracers
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        tr.life -= dt;
        (tr.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, tr.life / tr.maxLife);
        if (tr.life <= 0) {
          scene.remove(tr.mesh);
          tr.mesh.geometry.dispose();
          (tr.mesh.material as THREE.Material).dispose();
          tracers.splice(i, 1);
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.life -= dt;
        pt.vel.y -= 14 * dt;
        pt.mesh.position.addScaledVector(pt.vel, dt);
        pt.mesh.scale.setScalar(Math.max(0.05, pt.life / pt.maxLife));
        if (pt.life <= 0) {
          scene.remove(pt.mesh);
          particles.splice(i, 1);
        }
      }

      // Pickups
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i];
        pk.life -= dt;
        pk.mesh.rotation.y += dt * 2.1;
        const dist = _v3.subVectors(eng.pos, pk.mesh.position).setY(0).length();
        if (dist < 1.65) {
          if (pk.kind === 'medkit') {
            if (eng.hp < eng.maxHp) {
              eng.hp = Math.min(eng.maxHp, eng.hp + 35);
              setHp(eng.hp);
              showLootToast('+35 Salud (Botiquín)');
            } else {
              eng.medkits = Math.min(5, eng.medkits + 1);
              setMedkits(eng.medkits);
              showLootToast('+1 Botiquín guardado en Inventario [I]');
            }
          } else if (pk.kind === 'ammo') {
            const ammoTargetId =
              !WEAPON_MAP[eng.activeWeaponId].isMelee
                ? eng.activeWeaponId
                : Array.from(eng.unlockedWeapons).find((wid) => !WEAPON_MAP[wid]?.isMelee) || null;
            if (ammoTargetId) {
              const curSpec = WEAPON_MAP[ammoTargetId];
              const curEff = computeEffectiveWeaponStats(ammoTargetId, eng.weaponAttachments[ammoTargetId]);
              const gain = curEff.magSize;
              eng.ammo[ammoTargetId].reserve = Math.min(
                curEff.reserveMax,
                eng.ammo[ammoTargetId].reserve + gain
              );
              setAmmoState({ ...eng.ammo });
              showLootToast(`+${gain} Munición (${curSpec.name})`);
            } else {
              eng.scrap += 45;
              setScrap(eng.scrap);
              showLootToast('+45 Chatarra (Munición reciclada)');
            }
          } else if (pk.kind === 'scrap') {
            eng.scrap += 75;
            setScrap(eng.scrap);
            showLootToast('+75 Chatarra encontrada');
          } else if (pk.kind === 'stones') {
            eng.stones = Math.min(12, eng.stones + 3);
            setStones(eng.stones);
            showLootToast('+3 Piedras recogidas');
          } else if (pk.kind === 'grenade') {
            eng.grenadesCount = Math.min(6, eng.grenadesCount + 1);
            setGrenadesCount(eng.grenadesCount);
            showLootToast('+1 Granada de Mano [X]');
          } else if (pk.kind === 'trap') {
            if (Math.random() < 0.6) {
              eng.bearTraps = Math.min(6, eng.bearTraps + 1);
              setBearTraps(eng.bearTraps);
              showLootToast('+1 Trampa de Osos [T]');
            } else {
              eng.landmines = Math.min(6, eng.landmines + 1);
              setLandmines(eng.landmines);
              showLootToast('+1 Mina Explosiva [T]');
            }
          }
          soundEngine.playPickup();
          scene.remove(pk.mesh);
          disposeObjectTree(pk.mesh);
          pickups.splice(i, 1);
          continue;
        }
        if (pk.life <= 0) {
          scene.remove(pk.mesh);
          disposeObjectTree(pk.mesh);
          pickups.splice(i, 1);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        scheduleAfterDraw(renderer, (id) => {
          frameId = id;
        }, tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('resize', onResize);
      textures.dispose();
      disposeObjectTree(scene);
      envTex.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [mode]);

  // Touch Handlers
  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    soundEngine.unlock();
    const t = e.changedTouches[0];
    if (!t) return;
    engineRef.current.joyTouchId = t.identifier;
    updateJoyFromTouch(t, e.currentTarget);
  };
  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const id = engineRef.current.joyTouchId;
    if (id === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === id) {
        updateJoyFromTouch(e.changedTouches[i], e.currentTarget);
      }
    }
  };
  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const id = engineRef.current.joyTouchId;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === id) {
        engineRef.current.joyTouchId = null;
        engineRef.current.joyVec = { x: 0, y: 0 };
      }
    }
  };
  const updateJoyFromTouch = (t: React.Touch, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const maxR = rect.width / 2;
    let dx = (t.clientX - (rect.left + maxR)) / maxR;
    let dy = (t.clientY - (rect.top + rect.height / 2)) / maxR;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    engineRef.current.joyVec = { x: dx, y: dy };
  };

  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    soundEngine.unlock();
    const t = e.changedTouches[0];
    if (!t) return;
    engineRef.current.lookTouchId = t.identifier;
    engineRef.current.lookLast = { x: t.clientX, y: t.clientY };
  };
  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const id = engineRef.current.lookTouchId;
    if (id === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === id) {
        const dx = t.clientX - engineRef.current.lookLast.x;
        const dy = t.clientY - engineRef.current.lookLast.y;
        engineRef.current.lookLast = { x: t.clientX, y: t.clientY };
        const sens = engineRef.current.isAds ? 0.0028 : 0.0052;
        engineRef.current.yaw -= dx * sens;
        engineRef.current.pitch = THREE.MathUtils.clamp(
          engineRef.current.pitch - dy * sens,
          -Math.PI / 2.2,
          Math.PI / 2.2
        );
      }
    }
  };
  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const id = engineRef.current.lookTouchId;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === id) {
        engineRef.current.lookTouchId = null;
      }
    }
  };

  const activeSpec = WEAPON_MAP[activeWeaponId];
  const activeAtt = normalizeAttachments(weaponAttachments[activeWeaponId]);
  const activeEff = computeEffectiveWeaponStats(activeWeaponId, activeAtt);
  const curAmmo = ammoState[activeWeaponId] || { mag: activeEff.magSize, reserve: activeEff.reserveMax };
  const hpPct = Math.round((hp / maxHp) * 100);
  const accuracy = practiceStats.shots > 0 ? Math.round((practiceStats.hits / practiceStats.shots) * 100) : 0;

  const activeOpticId =
    activeAtt.optic === 'none' && (activeWeaponId === 'awp_espectro' || activeWeaponId === 'cheytac_m200')
      ? 'sniper_8x'
      : activeAtt.optic === 'none' && (activeWeaponId === 'm24_cazador' || activeWeaponId === 'kar98k_classic')
      ? 'acog_4x'
      : activeAtt.optic;

  const isScopedZoom =
    isAds && (activeOpticId === 'sniper_8x' || activeOpticId === 'acog_4x' || activeOpticId === 'thermal_scope');

  const filteredArmoryWeapons = WEAPONS.filter(
    (w) =>
      (armoryCategory === 'Todas' || w.category === armoryCategory) &&
      (!onlyOwnedArmory || progression.ownedWeapons.includes(w.id) || unlockedWeapons.includes(w.id))
  );

  const armorInfo = ARMOR_CLASSES.find((c) => c.id === character.armorClass);
  const helmetInfo = HELMET_OPTIONS.find((h) => h.id === character.helmet);
  const backpackInfo = BACKPACK_OPTIONS.find((b) => b.id === character.backpack);
  const patternInfo = SUIT_PATTERN_OPTIONS.find((p) => p.id === (character.suitPattern || 'solid'));
  const emblemInfo = EMBLEM_OPTIONS.find((e) => e.id === (character.emblem || 'shield'));

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090c10] select-none">
      <div ref={mountRef} className="w-full h-full touch-none-canvas" />

      {damageFlash && (
        <div className="pointer-events-none fixed inset-0 z-20 border-[14px] border-red-600/55 bg-red-600/15" />
      )}

      {/* Remote Player Callsigns */}
      {projectedTags.map((tag) => (
        <div
          key={tag.id}
          style={{ left: tag.x, top: tag.y }}
          className="pointer-events-none fixed z-10 -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded bg-[#0a0e14]/85 border border-slate-700 text-center"
        >
          <div className="text-[11px] font-medium text-white whitespace-nowrap">
            {tag.name} <span className="text-amber-400">· {platformLabel(tag.platform)}</span>
          </div>
          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden mx-auto mt-0.5">
            <div
              className="h-full bg-emerald-400"
              style={{ width: `${Math.max(0, Math.min(100, (tag.hp / tag.maxHp) * 100))}%` }}
            />
          </div>
        </div>
      ))}

      {/* Floating Damage & Critical Hit Labels */}
      {floatingDmgs.map((fd) => (
        <div
          key={fd.id}
          style={{ left: fd.x, top: fd.y }}
          className={`pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full font-mono-num font-bold drop-shadow ${
            fd.headshot ? 'text-red-400 text-base' : 'text-amber-200 text-sm'
          }`}
        >
          {fd.text}
        </div>
      ))}

      {/* Center Crosshair & Usable 1st-Person Optic ADS Reticles */}
      {!gameOver && !showArmory && !showInventory && !drivingVehicle && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {isScopedZoom && activeOpticId === 'sniper_8x' ? (
              <div className="relative w-80 h-80 sm:w-[26rem] sm:h-[26rem] rounded-full border-4 border-slate-950 ring-2 ring-amber-400/50 flex items-center justify-center shadow-[0_0_0_9999px_rgba(3,6,11,0.9)]">
                <div className="w-full h-[1px] bg-slate-200/75 absolute" />
                <div className="h-full w-[1px] bg-slate-200/75 absolute" />
                {/* Ballistic Mil-Dot Stadia */}
                <div className="absolute w-16 h-[2px] bg-amber-400/80 translate-y-6" />
                <div className="absolute w-10 h-[2px] bg-amber-400/75 translate-y-12" />
                <div className="absolute w-6 h-[2px] bg-amber-400/70 translate-y-[4.5rem]" />
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                <div className="absolute bottom-4 px-2.5 py-0.5 rounded bg-black/75 border border-slate-700 font-mono-num text-[10px] text-amber-300">
                  {extraZoom ? '12x · [Z] Normal' : '8x · [Z] +Zoom'}
                </div>
              </div>
            ) : isScopedZoom && activeOpticId === 'thermal_scope' ? (
              <div className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-full border-4 border-slate-950 ring-2 ring-orange-500/70 bg-orange-950/15 flex items-center justify-center shadow-[0_0_0_9999px_rgba(4,7,14,0.88)]">
                <div className="w-48 h-[1px] bg-orange-400/70 absolute" />
                <div className="h-48 w-[1px] bg-orange-400/70 absolute" />
                <div className="w-14 h-14 border border-orange-400/60 rotate-45 absolute" />
                <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_10px_#fb923c]" />
                <div className="absolute bottom-3 px-2.5 py-0.5 rounded bg-black/80 border border-orange-500/60 font-mono-num text-[10px] text-orange-300">
                  FLIR {extraZoom ? '5.5x · [Z] Normal' : '3.5x · [Z] +Zoom'}
                </div>
              </div>
            ) : isScopedZoom && activeOpticId === 'acog_4x' ? (
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full border-4 border-slate-950 ring-2 ring-red-500/45 flex items-center justify-center shadow-[0_0_0_9999px_rgba(3,6,11,0.8)]">
                <div className="w-40 h-[1px] bg-slate-200/65 absolute" />
                <div className="h-24 w-[1px] bg-slate-200/65 absolute translate-y-12" />
                {/* Illuminated ACOG Chevron */}
                <div className="w-3 h-3 border-t-2 border-l-2 border-red-500 rotate-45 translate-y-0.5 shadow-[0_0_8px_#ef4444]" />
                <div className="absolute bottom-3 px-2.5 py-0.5 rounded bg-black/75 border border-slate-700 font-mono-num text-[10px] text-red-300">
                  ACOG {extraZoom ? '6x · [Z] Normal' : '4x · [Z] +Zoom'}
                </div>
              </div>
            ) : isAds && activeOpticId === 'holo' ? (
              <div className="w-8 h-8 rounded-full border border-emerald-400/80 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.45)]">
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
              </div>
            ) : isAds && activeOpticId === 'red_dot' ? (
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
            ) : isAds ? (
              <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_#10b981]" />
            ) : (
              <div className="relative w-6 h-6 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <div className="absolute top-0 w-[2px] h-1.5 bg-white/80" />
                <div className="absolute bottom-0 w-[2px] h-1.5 bg-white/80" />
                <div className="absolute left-0 h-[2px] w-1.5 bg-white/80" />
                <div className="absolute right-0 h-[2px] w-1.5 bg-white/80" />
              </div>
            )}
            {hitMarker !== 'none' && (
              <div
                className={`absolute w-5 h-5 border-2 rotate-45 ${
                  hitMarker === 'head' ? 'border-red-500 scale-125' : 'border-white'
                }`}
              />
            )}
          </div>
        </div>
      )}

      {/* Crate / Weapon World Pickup Prompt */}
      {nearPrompt && !showArmory && !showInventory && !gameOver && (
        <div className="fixed top-[58%] left-1/2 -translate-x-1/2 z-30">
          <button
            type="button"
            onClick={() => {
              engineRef.current.interactRequested = true;
            }}
            className="px-4 py-2 rounded-lg bg-[#0a0e14]/92 border border-amber-400 text-amber-300 text-xs font-semibold shadow-lg flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            <span>{nearPrompt}</span>
          </button>
        </div>
      )}

      {/* Toast Feedback */}
      {lootToast && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-lg bg-[#0a0e14]/92 border border-sky-500/60 text-sky-300 text-xs font-medium">
          {lootToast}
        </div>
      )}

      {/* Top HUD Bar */}
      <div className="pointer-events-none fixed top-3 left-3 right-3 z-30 flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0a0e14]/90 border border-slate-700/80">
          {mode === 'practice' ? (
            <>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="font-display text-sm font-bold text-white">Campo de Práctica</span>
              </div>
              <span className="text-slate-600" aria-hidden="true">|</span>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-mono-num">
                <span>Últ. Daño: <strong className="text-amber-400">{practiceStats.lastDamage}</strong></span>
                <span>Precisión: <strong className="text-white">{accuracy}%</strong></span>
                <span>Abatidos: <strong className="text-emerald-400">{practiceStats.targetsDown}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => {
                  engineRef.current.resetTargetsRequested = true;
                  setPracticeStats({ shots: 0, hits: 0, lastDamage: 0, targetsDown: 0 });
                }}
                className="ml-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reiniciar Blancos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !practiceShowAll;
                  setPracticeShowAll(next);
                  const list = next ? WEAPONS.map((w) => w.id) : Array.from(new Set<WeaponId>(progression.ownedWeapons));
                  engineRef.current.unlockedWeapons = new Set<WeaponId>(list);
                  setUnlockedWeapons(list);
                  if (!list.includes(engineRef.current.activeWeaponId) && list[0]) {
                    switchWeapon(list[0]);
                  }
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                  practiceShowAll
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-emerald-300 hover:bg-slate-700'
                }`}
              >
                {practiceShowAll ? 'Probar: Todas' : `Solo mis armas (${progression.ownedWeapons.length})`}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {mode === 'multiplayer' && roomCode && (
                <div>
                  <span className="text-slate-400">Sala </span>
                  <span className="font-mono-num font-bold text-amber-400">{roomCode}</span>
                </div>
              )}
              {(mode === 'survival' || roomSubMode === 'coop') && (
                <div className="flex items-center gap-2.5">
                  <div>
                    <span className="text-slate-400">Oleada </span>
                    <span className="font-mono-num font-bold text-amber-400 text-sm">{wave}</span>
                  </div>
                  {mode === 'survival' && (
                    <>
                      <span className="text-slate-600">·</span>
                      <div>
                        <span className="text-slate-400">Restantes </span>
                        <span className="font-mono-num font-bold text-white text-sm">{waveRemainingCount}</span>
                      </div>
                      <span className="text-slate-600">·</span>
                      {activeBoss || wave % 5 === 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-600/30 border border-red-500/70 text-red-300 font-bold tracking-wide text-[11px]">
                          ¡JEFE ACTIVO!
                        </span>
                      ) : (
                        <span className="text-slate-300">
                          Jefe en <strong className="font-mono-num text-orange-400">{5 - (wave % 5)}</strong>
                        </span>
                      )}
                      {bossesDefeated > 0 && (
                        <>
                          <span className="text-slate-600">·</span>
                          <div>
                            <span className="text-slate-400">Jefes </span>
                            <span className="font-mono-num font-bold text-rose-400 text-sm">{bossesDefeated}</span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              <div>
                <span className="text-slate-400">Bajas </span>
                <span className="font-mono-num font-bold text-white text-sm">{kills}</span>
              </div>
              {mode === 'survival' && (
                <>
                  <div>
                    <span className="text-slate-400">Chatarra </span>
                    <span className="font-mono-num font-bold text-sky-400 text-sm">{scrap}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Piedras [G] </span>
                    <span className="font-mono-num font-bold text-amber-400 text-sm">{stones}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Granadas [X] </span>
                    <span className="font-mono-num font-bold text-lime-400 text-sm">{grenadesCount}</span>
                  </div>
                  <button
                    type="button"
                    onClick={cycleTrapType}
                    className="pointer-events-auto text-left hover:text-amber-300 transition-colors"
                    title="Cambiar tipo de trampa (Y)"
                  >
                    <span className="text-slate-400">
                      {selectedTrap === 'bear_trap' ? 'Cepo [T] ' : 'Mina [T] '}
                    </span>
                    <span className="font-mono-num font-bold text-orange-400 text-sm">
                      {selectedTrap === 'bear_trap' ? bearTraps : landmines}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1">[Y]</span>
                  </button>
                  <div>
                    <span className="text-slate-400">Botiquines [H] </span>
                    <span className="font-mono-num font-bold text-emerald-400 text-sm">{medkits}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Ruido:</span>
                    <span
                      className={`font-semibold ${
                        noiseLevelPct > 70
                          ? 'text-red-400'
                          : noiseLevelPct > 25
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {noiseLabel}
                    </span>
                  </div>
                </>
              )}
              {mode === 'multiplayer' && (
                <>
                  <div>
                    <span className="text-slate-400">Granadas [X] </span>
                    <span className="font-mono-num font-bold text-lime-400 text-sm">{grenadesCount}</span>
                  </div>
                  <button
                    type="button"
                    onClick={cycleTrapType}
                    className="pointer-events-auto text-left hover:text-amber-300 transition-colors"
                    title="Cambiar trampa (Y)"
                  >
                    <span className="text-slate-400">
                      {selectedTrap === 'bear_trap' ? 'Cepo [T] ' : 'Mina [T] '}
                    </span>
                    <span className="font-mono-num font-bold text-orange-400 text-sm">
                      {selectedTrap === 'bear_trap' ? bearTraps : landmines}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1">[Y]</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right HUD Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowArmory(false);
              setShowInventory((i) => !i);
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              showInventory
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-[#0a0e14]/90 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <Backpack className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Inventario [I]</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowInventory(false);
              setShowArmory((s) => !s);
            }}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              showArmory
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0a0e14]/90 hover:bg-slate-800 border-amber-500/60 text-amber-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Mesa / Accesorios [B]</span>
          </button>

          <button
            type="button"
            onClick={() => setCameraPerspective((p) => (p === '1p' ? '3p' : '1p'))}
            className="px-3 py-2 rounded-lg bg-[#0a0e14]/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
            title="Alternar cámara 1ª / 3ª persona (V)"
          >
            <Eye className="w-4 h-4 text-amber-400" />
            <span>{cameraPerspective === '1p' ? '1P' : '3P'}</span>
          </button>

          <button
            type="button"
            onClick={() => setTouchMode((t) => !t)}
            className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
              touchMode
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-[#0a0e14]/90 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline">{touchMode ? 'Táctil' : 'PC'}</span>
          </button>

          {mode === 'multiplayer' && (
            <>
              <button
                type="button"
                onClick={() => setScoreboardOpen((s) => !s)}
                className="p-2 rounded-lg bg-[#0a0e14]/90 hover:bg-slate-800 border border-slate-700 text-slate-200"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen((c) => !c)}
                className="p-2 rounded-lg bg-[#0a0e14]/90 hover:bg-slate-800 border border-slate-700 text-slate-200"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.muted = !muted;
              setMuted(!muted);
            }}
            className="p-2 rounded-lg bg-[#0a0e14]/90 hover:bg-slate-800 border border-slate-700 text-slate-200"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onExit}
            className="px-3 py-2 rounded-lg bg-red-950/85 hover:bg-red-900 border border-red-700/70 text-red-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {mode === 'survival' && activeBoss && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-30 w-[440px] max-w-[92vw] px-4 py-2.5 rounded-xl bg-[#0a0e14]/94 border border-red-500/70 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Skull className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-display font-bold text-sm text-white truncate">{activeBoss.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-[10px] font-mono-num font-bold text-red-300 shrink-0">
                Nivel {activeBoss.tier}
              </span>
            </div>
            <span className="font-mono-num text-xs font-bold text-slate-200 shrink-0">
              {activeBoss.hp} / {activeBoss.maxHp}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">{activeBoss.title}</div>
          <div className="mt-1.5 h-2.5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${Math.max(0, Math.min(100, (activeBoss.hp / Math.max(1, activeBoss.maxHp)) * 100))}%`,
                backgroundColor: activeBoss.weakPointColorHex,
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold" style={{ color: activeBoss.weakPointColorHex }}>
              Punto débil: {activeBoss.weakPointLabel}
            </span>
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">{activeBoss.weakPointHint}</div>
        </div>
      )}

      {waveBanner && (
        <div
          className={`pointer-events-none fixed ${
            activeBoss ? 'top-44' : 'top-20'
          } left-1/2 -translate-x-1/2 z-30 px-6 py-2.5 rounded-lg bg-[#0a0e14]/92 border border-amber-500/60 text-amber-300 font-display text-sm sm:text-base font-bold tracking-wide text-center`}
        >
          {waveBanner}
        </div>
      )}

      {mode === 'multiplayer' && mpStatus && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-lg bg-[#0a0e14]/92 border border-slate-700 text-slate-200 text-xs">
          {mpStatus}
        </div>
      )}

      {killFeed.length > 0 && (
        <div className="pointer-events-none fixed top-16 right-3 z-20 flex flex-col items-end gap-1">
          {killFeed.map((kf) => (
            <div key={kf.id} className="px-3 py-1 rounded bg-[#0a0e14]/80 border border-slate-800 text-xs text-slate-200">
              {kf.text}
            </div>
          ))}
        </div>
      )}

      {!touchMode && !pointerLocked && !showArmory && !showInventory && !chatOpen && !gameOver && (
        <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 translate-y-10 z-20 px-4 py-2 rounded-lg bg-[#0a0e14]/90 border border-slate-700 text-xs text-slate-200 text-center">
          Clic para jugar · <span className="text-amber-400">Clic Der. / Q</span> Mira ·{' '}
          <span className="text-amber-400">X</span> Granada · <span className="text-amber-400">T / Y</span> Trampas ·{' '}
          <span className="text-amber-400">G</span> Piedra · <span className="text-amber-400">I</span> Inventario
        </div>
      )}

      {/* Bottom HUD */}
      <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-30 flex flex-col gap-2">
        {drivingVehicle ? (
          <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-4 px-5 py-2.5 rounded-lg bg-[#0a0e14]/92 border border-amber-500/70">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" />
              <span className="font-display text-sm font-bold text-white">{drivingVehicle.name}</span>
            </div>
            <div className="font-mono-num text-xl font-bold text-amber-400">
              {drivingVehicle.speedKmh} <span className="text-xs text-slate-400">km/h</span>
            </div>
            <div className="w-24">
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>Chasis</span>
                <span className="font-mono-num text-white">{drivingVehicle.hp}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.max(0, Math.min(100, (drivingVehicle.hp / drivingVehicle.maxHp) * 100))}%` }}
                />
              </div>
            </div>
            {!touchMode && (
              <div className="text-[11px] text-slate-300 flex items-center gap-2">
                <span><strong className="text-amber-400">WASD</strong> Conducir</span>
                <span><strong className="text-amber-400">Shift</strong> Turbo</span>
                <span><strong className="text-amber-400">K/Clic</strong> Bocina</span>
                <span><strong className="text-amber-400">L</strong> {drivingVehicle.headlights ? 'Luces ON' : 'Luces OFF'}</span>
                <span><strong className="text-amber-400">E</strong> Bajar</span>
              </div>
            )}
          </div>
        ) : (
          !touchMode && (
            <div className="pointer-events-auto mx-auto flex items-center gap-1 p-1 rounded-lg bg-[#0a0e14]/90 border border-slate-700/80 overflow-x-auto max-w-full">
              {WEAPONS.filter((w) => unlockedWeapons.includes(w.id)).map((w, idx) => {
                const active = w.id === activeWeaponId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => switchWeapon(w.id)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                      active ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-mono-num opacity-75 mr-1">{idx + 1}</span>
                    <span>{w.name}</span>
                  </button>
                );
              })}
            </div>
          )
        )}

        <div className="flex items-end justify-between gap-4">
          <div className="pointer-events-auto px-4 py-2.5 rounded-lg bg-[#0a0e14]/90 border border-slate-700/80 min-w-[225px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{character.name}</span>
                {isCrouching && <span className="text-sky-400 font-semibold">· Sigilo</span>}
              </span>
              <span className="font-mono-num font-bold text-white">
                {hp} / {maxHp}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <Footprints className="w-3 h-3 text-slate-400 shrink-0" />
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 transition-all duration-100" style={{ width: `${stamina}%` }} />
              </div>
            </div>
          </div>

          <div className="pointer-events-auto px-4 py-2.5 rounded-lg bg-[#0a0e14]/90 border border-slate-700/80 text-right min-w-[235px]">
            <div className="text-xs text-amber-400 font-semibold flex items-center justify-end gap-1.5">
              <span className={`px-1.5 py-0.5 rounded border text-[10px] ${RARITY_META[activeSpec.rarity].badgeClass}`}>
                {activeSpec.rarity}
              </span>
              <span>{activeSpec.name}</span>
              {!activeSpec.isMelee && activeEff.suppressed && (
                <span className="text-emerald-400">· Silenciada</span>
              )}
              {activeEff.powerBonusPct > 0 && (
                <span className="text-sky-400">· +{activeEff.powerBonusPct}%</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {activeSpec.isMelee ? (
                <span>Cuerpo a Cuerpo · Alcance {activeSpec.range}m</span>
              ) : (
                <>
                  Mira:{' '}
                  <span className="text-slate-200">
                    {activeOpticId === 'none' ? 'Hierro' : ATTACHMENT_MAP[activeOpticId]?.name}
                  </span>
                  <span className="text-amber-400 ml-1.5">[{isAds ? 'Q Salir' : 'Q / Clic Der.'}]</span>
                </>
              )}
            </div>
            <div className="font-mono-num text-xl font-bold text-white leading-tight mt-0.5">
              {activeSpec.isMelee ? (
                <span className="text-emerald-400">∞ <span className="text-xs text-slate-400 font-sans">Sin munición</span></span>
              ) : isReloading ? (
                <span className="text-sm text-amber-300">Recargando...</span>
              ) : (
                <>
                  <span>{curAmmo.mag}</span>
                  <span className="text-slate-500 text-sm mx-1">/</span>
                  <span className="text-slate-400 text-sm">
                    {mode === 'practice' ? '∞' : curAmmo.reserve}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Touch Controls */}
      {touchMode && !gameOver && !showArmory && !showInventory && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          <div
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
            onTouchCancel={handleLookEnd}
            className="pointer-events-auto absolute top-16 right-0 bottom-28 left-1/2 touch-none"
          />

          <div
            onTouchStart={handleJoyStart}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            onTouchCancel={handleJoyEnd}
            className="pointer-events-auto absolute bottom-20 left-5 w-32 h-32 rounded-full bg-[#0a0e14]/60 border-2 border-slate-500/60 flex items-center justify-center touch-none"
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/80 border border-amber-300" />
          </div>

          <div className="pointer-events-auto absolute top-16 left-3 right-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            {WEAPONS.filter((w) => unlockedWeapons.includes(w.id)).map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => switchWeapon(w.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border ${
                  w.id === activeWeaponId
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-[#0a0e14]/85 text-slate-200 border-slate-700'
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>

          <div className="pointer-events-auto absolute bottom-20 right-5 flex flex-col items-end gap-2">
            {drivingVehicle ? (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current.toggleHeadlightsRequested = true;
                  }}
                  className={`h-12 px-3.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                    drivingVehicle.headlights
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                      : 'bg-[#0a0e14]/88 border-slate-600 text-slate-200'
                  }`}
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>Luces</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current.hornRequested = true;
                  }}
                  className="h-12 px-3.5 rounded-lg bg-[#0a0e14]/88 border border-sky-500/70 text-sky-300 text-xs font-semibold"
                >
                  Bocina
                </button>
                <button
                  type="button"
                  onClick={() => {
                    engineRef.current.interactRequested = true;
                  }}
                  className="h-14 px-4 rounded-xl bg-red-600/90 border border-red-300 text-white font-display font-bold text-xs flex items-center gap-1.5"
                >
                  <Car className="w-4 h-4" />
                  <span>Bajar</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap justify-end items-center gap-1.5">
                  <button
                    type="button"
                    onClick={triggerThrowGrenade}
                    className="h-10 px-2.5 rounded-lg bg-[#0a0e14]/88 border border-lime-500/70 text-lime-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <Bomb className="w-3.5 h-3.5" />
                    <span>{mode === 'practice' ? '∞' : grenadesCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerPlaceTrap}
                    className="h-10 px-2.5 rounded-lg bg-[#0a0e14]/88 border border-orange-500/70 text-orange-300 text-xs font-semibold flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {selectedTrap === 'bear_trap' ? 'Cepo' : 'Mina'} ({mode === 'practice' ? '∞' : selectedTrap === 'bear_trap' ? bearTraps : landmines})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={cycleTrapType}
                    className="h-10 px-2 rounded-lg bg-[#0a0e14]/88 border border-slate-600 text-slate-200 text-xs"
                    title="Cambiar tipo de trampa"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={usePortableMedkit}
                    className="h-10 px-2.5 rounded-lg bg-[#0a0e14]/88 border border-emerald-500/70 text-emerald-300 text-xs font-semibold"
                  >
                    Curar ({medkits})
                  </button>
                  <button
                    type="button"
                    onClick={triggerThrowStone}
                    className="h-10 px-2.5 rounded-lg bg-[#0a0e14]/88 border border-sky-500/70 text-sky-300 text-xs font-semibold"
                  >
                    Piedra ({stones})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCrouching((c) => !c)}
                    className={`h-10 px-2.5 rounded-lg text-xs font-semibold border ${
                      isCrouching
                        ? 'bg-sky-500/25 border-sky-400 text-sky-300'
                        : 'bg-[#0a0e14]/88 border-slate-700 text-slate-200'
                    }`}
                  >
                    Sigilo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoFireMobile((a) => !a)}
                    className={`h-10 px-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1 ${
                      autoFireMobile
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                        : 'bg-[#0a0e14]/88 border-slate-700 text-slate-300'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (WEAPON_MAP[engineRef.current.activeWeaponId]?.isMelee) return;
                      const next = !engineRef.current.isAds;
                      engineRef.current.isAds = next;
                      setIsAds(next);
                    }}
                    className={`w-12 h-12 rounded-full border text-xs font-bold ${
                      isAds ? 'bg-amber-500/30 border-amber-400 text-amber-300' : 'bg-[#0a0e14]/88 border-slate-600 text-slate-200'
                    }`}
                  >
                    <Crosshair className="w-5 h-5 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={triggerReload}
                    className="w-12 h-12 rounded-full bg-[#0a0e14]/88 border border-slate-600 text-xs font-bold text-slate-200 active:bg-slate-700"
                  >
                    R
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (engineRef.current.onGround) {
                        engineRef.current.velY = 6.8;
                        engineRef.current.onGround = false;
                      }
                    }}
                    className="w-12 h-12 rounded-full bg-[#0a0e14]/88 border border-slate-600 text-xs font-bold text-slate-200 active:bg-slate-700"
                  >
                    Saltar
                  </button>
                  <button
                    type="button"
                    onTouchStart={(e) => {
                      e.preventDefault();
                      soundEngine.unlock();
                      engineRef.current.isFiring = true;
                      engineRef.current.triggerFireOnce = true;
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      engineRef.current.isFiring = false;
                    }}
                    onMouseDown={() => {
                      engineRef.current.isFiring = true;
                      engineRef.current.triggerFireOnce = true;
                    }}
                    onMouseUp={() => {
                      engineRef.current.isFiring = false;
                    }}
                    className="w-20 h-20 rounded-full bg-red-600/90 active:bg-red-500 border-2 border-red-300 text-white font-display font-bold text-xs tracking-wide shadow-lg"
                  >
                    FUEGO
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Character Inventory Modal [I] */}
      {showInventory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/78 p-4">
          <div className="w-full max-w-4xl bg-[#11161f] border border-slate-700 rounded-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0d1118]">
              <div className="flex items-center gap-2.5">
                <Backpack className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Inventario del Operador ({character.name})
                  </h3>
                  <p className="text-xs text-slate-400">
                    {armorInfo?.label} · {helmetInfo?.label} · {backpackInfo?.label} · {patternInfo?.label} · {emblemInfo?.label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInventory(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600"
              >
                Cerrar [I]
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Consumables & Resources Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-lg bg-[#161d28] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Chatarra</div>
                  <div className="font-mono-num text-xl font-bold text-sky-400 mt-0.5">
                    {mode === 'practice' ? '∞' : scrap}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#161d28] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Granadas [X]</div>
                  <div className="font-mono-num text-xl font-bold text-lime-400 mt-0.5">
                    {mode === 'practice' ? '∞' : `${grenadesCount} / 6`}
                  </div>
                </div>
                <div
                  onClick={() => {
                    engineRef.current.selectedTrap = 'bear_trap';
                    setSelectedTrap('bear_trap');
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedTrap === 'bear_trap'
                      ? 'bg-orange-500/15 border-orange-400'
                      : 'bg-[#161d28] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] text-slate-400">Trampas Osos [T]</div>
                  <div className="font-mono-num text-xl font-bold text-orange-400 mt-0.5">
                    {mode === 'practice' ? '∞' : `${bearTraps} / 6`}
                  </div>
                </div>
                <div
                  onClick={() => {
                    engineRef.current.selectedTrap = 'landmine';
                    setSelectedTrap('landmine');
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedTrap === 'landmine'
                      ? 'bg-red-500/15 border-red-400'
                      : 'bg-[#161d28] border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] text-slate-400">Minas Explosivas [T]</div>
                  <div className="font-mono-num text-xl font-bold text-red-400 mt-0.5">
                    {mode === 'practice' ? '∞' : `${landmines} / 6`}
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#161d28] border border-slate-800">
                  <div className="text-[11px] text-slate-400">Piedras [G]</div>
                  <div className="font-mono-num text-xl font-bold text-amber-400 mt-0.5">{stones} / 12</div>
                </div>
                <div className="p-3.5 rounded-lg bg-[#161d28] border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-400">Botiquín [H]</div>
                    <div className="font-mono-num text-xl font-bold text-emerald-400 mt-0.5">{medkits} / 5</div>
                  </div>
                  <button
                    type="button"
                    onClick={usePortableMedkit}
                    disabled={medkits <= 0 || hp >= maxHp}
                    className={`px-2 py-1.5 rounded text-xs font-semibold flex items-center gap-1 ${
                      medkits > 0 && hp < maxHp
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>Usar</span>
                  </button>
                </div>
              </div>

              {/* Carried Weapons & Attachments Breakdown */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="font-display text-sm font-bold text-white">
                    Armas en Mochila ({unlockedWeapons.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInventory(false);
                      setArmoryTab('accesorios');
                      setShowArmory(true);
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Configurar Miras y Accesorios</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {WEAPONS.filter((w) => unlockedWeapons.includes(w.id)).map((w) => {
                    const att = normalizeAttachments(weaponAttachments[w.id]);
                    const eff = computeEffectiveWeaponStats(w.id, att);
                    const am = ammoState[w.id] || { mag: eff.magSize, reserve: eff.reserveMax };
                    const isEq = activeWeaponId === w.id;
                    return (
                      <div
                        key={w.id}
                        className={`p-3.5 rounded-lg border flex flex-col justify-between gap-2.5 ${
                          isEq ? 'bg-amber-500/10 border-amber-400' : 'bg-[#161d28] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-display font-bold text-sm text-white truncate">{w.name}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${
                                  RARITY_META[w.rarity].badgeClass
                                }`}
                              >
                                {w.rarity}
                              </span>
                            </div>
                            <span className="text-xs text-amber-400 shrink-0">{w.category}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono-num text-slate-300">
                            <span>Daño: <strong className="text-white">{eff.damage}</strong></span>
                            {w.isMelee ? (
                              <>
                                <span>Alcance: <strong className="text-white">{w.range}m</strong></span>
                                <span>Munición: <strong className="text-emerald-400">∞</strong></span>
                              </>
                            ) : (
                              <span>Balas: <strong className="text-white">{am.mag}/{mode === 'practice' ? '∞' : am.reserve}</strong></span>
                            )}
                            <span>Ruido: <strong className="text-white">{eff.noiseRadius}m</strong></span>
                          </div>
                          {!w.isMelee && (
                            <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                              <div>Mira: <span className="text-slate-200">{att.optic === 'none' ? 'Estándar' : ATTACHMENT_MAP[att.optic]?.name}</span></div>
                              <div>Bocacha: <span className="text-slate-200">{att.muzzle === 'none' ? 'Estándar' : ATTACHMENT_MAP[att.muzzle]?.name}</span></div>
                              <div>Acople: <span className="text-slate-200">{att.underbarrel === 'none' ? 'Ninguno' : ATTACHMENT_MAP[att.underbarrel]?.name}</span></div>
                              <div>Cargador: <span className="text-slate-200">{att.magazine === 'standard' ? 'Estándar' : ATTACHMENT_MAP[att.magazine]?.name}</span></div>
                              <div>Culata: <span className="text-slate-200">{!att.stock || att.stock === 'none' ? 'Estándar' : ATTACHMENT_MAP[att.stock]?.name}</span></div>
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-slate-400">
                            Pintura 3D:{' '}
                            <span className="text-amber-300">
                              {WEAPON_FINISH_MAP[weaponFinishes[w.id] || 'factory']?.label}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            switchWeapon(w.id);
                            setShowInventory(false);
                          }}
                          className={`w-full py-1.5 rounded text-xs font-semibold ${
                            isEq ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }`}
                        >
                          {isEq ? 'Equipada en mano' : 'Equipar Arma'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crafting Workbench & Attachments Modal [B] */}
      {showArmory && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/78 p-4">
          <div className="w-full max-w-5xl bg-[#11161f] border border-slate-700 rounded-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-[#0d1118]">
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Mesa de Trabajo, Tienda y Accesorios
                </h3>
                <p className="text-xs text-slate-400">
                  Arma activa: <span className="text-amber-400 font-semibold">{activeSpec.name}</span> · Chatarra:{' '}
                  <span className="font-mono-num text-sky-400 font-bold">{mode === 'practice' ? '∞' : scrap}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mode !== 'practice' && (
                  <>
                    <button
                      type="button"
                      onClick={craftAmmo}
                      className="px-2.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                    >
                      +Balas (95)
                    </button>
                    <button
                      type="button"
                      onClick={craftMedkit}
                      className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                    >
                      +Botiquín (80)
                    </button>
                    <button
                      type="button"
                      onClick={craftGrenades}
                      className="px-2.5 py-2 rounded-lg bg-lime-700 hover:bg-lime-600 text-white text-xs font-semibold transition-colors"
                    >
                      +2 Granadas (90)
                    </button>
                    <button
                      type="button"
                      onClick={craftBearTraps}
                      className="px-2.5 py-2 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                    >
                      +2 Cepos (70)
                    </button>
                    <button
                      type="button"
                      onClick={craftLandmines}
                      className="px-2.5 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-colors"
                    >
                      +2 Minas (110)
                    </button>
                    <button
                      type="button"
                      onClick={gatherStonesCraft}
                      className="px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sky-300 text-xs font-semibold transition-colors"
                    >
                      +4 Piedras (20)
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowArmory(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Armory Mode Tabs */}
            <div className="flex items-center justify-between gap-3 px-6 py-2.5 border-b border-slate-800 bg-[#0f141c]">
              <div className="flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setArmoryTab('armas')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    armoryTab === 'armas' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  Armas por Categoría
                </button>
                <button
                  type="button"
                  onClick={() => setArmoryTab('accesorios')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    armoryTab === 'accesorios' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Miras, Accesorios y Pintura ({activeSpec.name})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setArmoryTab('cajas')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    armoryTab === 'cajas' ? 'bg-amber-500 text-slate-950' : 'text-amber-300 hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Cajas Aleatorias</span>
                </button>
              </div>
            </div>

            {armoryTab === 'armas' ? (
              <div className="p-5 overflow-y-auto flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setArmoryCategory('Todas')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap ${
                        armoryCategory === 'Todas'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-[#090c10] border-slate-800 text-slate-400'
                      }`}
                    >
                      Todas
                    </button>
                    {WEAPON_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setArmoryCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap ${
                          armoryCategory === cat.id
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
                    onClick={() => setOnlyOwnedArmory((v) => !v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap shrink-0 ${
                      onlyOwnedArmory
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#090c10] border-slate-700 text-slate-300'
                    }`}
                  >
                    {onlyOwnedArmory ? 'Solo mis armas' : 'Ver todas (Tienda)'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredArmoryWeapons.map((w) => {
                    const owned = unlockedWeapons.includes(w.id);
                    const equipped = activeWeaponId === w.id;
                    const canAfford = scrap >= w.cost;
                    const rarity = RARITY_META[w.rarity];
                    return (
                      <div
                        key={w.id}
                        className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                          equipped ? 'bg-amber-500/10 border-amber-400' : 'bg-[#161d28] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-sm text-white truncate">{w.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${rarity.badgeClass}`}
                            >
                              {rarity.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {w.category} · {w.caliber}
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{w.description}</p>
                          <div className="mt-2.5 flex items-center gap-2 text-[11px] font-mono-num text-slate-300">
                            <span>Daño: {w.damage}{w.pellets > 1 ? `×${w.pellets}` : ''}</span>
                            <span>·</span>
                            <span>{w.isMelee ? `Alcance: ${w.range}m` : `Ruido: ${w.noiseRadius}m`}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => buyOrEquipWeapon(w.id)}
                          disabled={!owned && !canAfford}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            equipped
                              ? 'bg-amber-500 text-slate-950'
                              : owned
                              ? 'bg-slate-700 hover:bg-slate-600 text-white'
                              : canAfford
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {!owned && <Lock className="w-3.5 h-3.5" />}
                          <span>
                            {equipped
                              ? 'Equipada'
                              : owned
                              ? 'Equipar'
                              : `Comprar (${w.cost} Chatarra)`}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                  {filteredArmoryWeapons.length === 0 && (
                    <div className="col-span-full p-4 rounded-lg bg-[#090c10] border border-slate-800 text-xs text-slate-400">
                      No tienes armas en esta categoría todavía.
                    </div>
                  )}
                </div>
              </div>
            ) : armoryTab === 'cajas' ? (
              <div className="p-5 overflow-y-auto flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['standard', 'elite'] as CrateTier[]).map((tier) => {
                    const cfg = CRATE_TIERS[tier];
                    const canAfford = mode === 'practice' || scrap >= cfg.scrapCost;
                    return (
                      <div
                        key={tier}
                        className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                          tier === 'elite'
                            ? 'bg-amber-500/10 border-amber-500/60'
                            : 'bg-[#161d28] border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-base text-white flex items-center gap-2">
                              <Package className="w-4 h-4 text-amber-400" />
                              <span>{cfg.label}</span>
                            </span>
                            <span className="font-mono-num text-xs font-bold text-sky-400">
                              {mode === 'practice' ? 'Gratis' : `${cfg.scrapCost} Chatarra`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{cfg.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => buyCrateInGame(tier)}
                          disabled={!canAfford}
                          className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            canAfford
                              ? tier === 'elite'
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {canAfford
                            ? `Comprar Caja (${mode === 'practice' ? '0' : cfg.scrapCost} Chatarra)`
                            : 'Chatarra insuficiente'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {lastMatchCrateResult && (
                  <div className="p-4 rounded-lg bg-[#090c10] border border-slate-700">
                    {lastMatchCrateResult.wonWeapon ? (
                      (() => {
                        const won = WEAPON_MAP[lastMatchCrateResult.wonWeapon];
                        const rMeta = RARITY_META[won.rarity];
                        return (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-400">¡ARMA OBTENIDA DE LA CAJA!</span>
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${rMeta.badgeClass}`}>
                                  {rMeta.label}
                                </span>
                              </div>
                              <div className="font-display text-lg font-bold text-white mt-0.5">{won.name}</div>
                              <p className="text-xs text-slate-400">{won.category} · {won.description}</p>
                            </div>
                            <span className="text-xs text-amber-300 font-semibold shrink-0">Equipada en mano</span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-2">
                        <div className="font-display text-base font-bold text-red-400">¡Caja Vacía! (Nada)</div>
                        <p className="text-xs text-slate-400 mt-1">
                          No había ningún arma dentro de esta caja aleatoria.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 overflow-y-auto flex flex-col gap-4">
                {/* 3D Weapon Finish Bar (available on all weapons including Melee) */}
                <div className="p-3 rounded-lg bg-[#090c10] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Pintura y Camuflaje 3D ({activeSpec.name}):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {WEAPON_FINISHES.map((fin) => {
                      const owned = ownedFinishes.includes(fin.id) || mode === 'practice';
                      const activeFin = (weaponFinishes[activeWeaponId] || 'factory') === fin.id;
                      const canAfford = scrap >= fin.cost;
                      return (
                        <button
                          key={fin.id}
                          type="button"
                          onClick={() => buyOrEquipFinishInGame(fin.id)}
                          disabled={!owned && !canAfford}
                          className={`px-2.5 py-1 rounded border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
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
                          {!owned && <span className="font-mono-num text-[10px] text-sky-300">({fin.cost})</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeSpec.isMelee ? (
                  <div className="p-4 rounded-lg bg-[#090c10] border border-slate-800 text-sm text-slate-300">
                    <span className="font-semibold text-amber-300">{activeSpec.name}</span> es un arma cuerpo a cuerpo: puedes cambiar su pintura 3D arriba, pero no utiliza miras ni cargadores. Equipa un arma de fuego para montarle miras o culatas.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {(Object.keys(ATTACHMENT_SLOT_LABELS) as AttachmentSlot[]).map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setArmorySlot(slot)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold border whitespace-nowrap ${
                              armorySlot === slot
                                ? 'bg-amber-500 text-slate-950 border-amber-300'
                                : 'bg-[#090c10] border-slate-800 text-slate-300'
                            }`}
                          >
                            {ATTACHMENT_SLOT_LABELS[slot]}
                          </button>
                        ))}
                      </div>

                      <div className="text-xs font-mono-num text-slate-300 flex items-center gap-4">
                        <span>Daño actual: <strong className="text-amber-400">{activeEff.damage}</strong></span>
                        <span>Cargador: <strong className="text-white">{activeEff.magSize}</strong></span>
                        <span>Ruido: <strong className="text-emerald-400">{activeEff.noiseRadius}m</strong></span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {ATTACHMENTS.filter((a) => a.slot === armorySlot).map((att) => {
                        const owned = ownedAttachments.includes(att.id) || mode === 'practice';
                        const equipped = activeAtt[att.slot] === att.id;
                        const canAfford = scrap >= att.cost;
                        return (
                          <div
                            key={att.id}
                            className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                              equipped ? 'bg-amber-500/15 border-amber-400' : 'bg-[#161d28] border-slate-800'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-sm text-white">{att.name}</div>
                              <div className="text-xs text-emerald-400 mt-1">{att.statSummary}</div>
                              <p className="text-xs text-slate-400 mt-1.5">{att.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => buyOrEquipAttachmentInGame(att.id, att.slot)}
                              disabled={!owned && !canAfford}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                equipped
                                  ? 'bg-amber-500 text-slate-950'
                                  : owned
                                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                                  : canAfford
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {equipped ? 'Quitar Accesorio' : owned ? 'Montar en Arma' : `Comprar (${att.cost})`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multiplayer Chat Drawer */}
      {mode === 'multiplayer' && chatOpen && (
        <div className="fixed bottom-24 left-3 z-40 w-80 max-w-[90vw] bg-[#0e141d]/95 border border-slate-700 rounded-lg overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-white">Chat de Sala ({roomCode})</span>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          <div className="h-44 overflow-y-auto p-3 space-y-1.5 text-xs">
            {chatMessages.length === 0 ? (
              <p className="text-slate-500">Sin mensajes aún.</p>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className={m.system ? 'text-amber-300' : 'text-slate-200'}>
                  <span className="font-semibold">{m.sender}: </span>
                  <span>{m.text}</span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={sendChatMessage} className="flex border-t border-slate-800">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-3 py-2 bg-transparent text-xs text-white focus:outline-none"
            />
            <button type="submit" className="px-3 text-amber-400 hover:text-amber-300">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Multiplayer Scoreboard */}
      {mode === 'multiplayer' && scoreboardOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-lg bg-[#11161f] border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-base font-bold text-white">
                Escuadrón en Sala {roomCode} ({roomSubMode === 'coop' ? 'Co-op Horda' : 'Arena PvP'})
              </h3>
              <button
                type="button"
                onClick={() => setScoreboardOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            <div className="divide-y divide-slate-800 text-xs">
              {remotePlayersList.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="text-slate-400 ml-2">· {platformLabel(p.platform)}</span>
                  </div>
                  <div className="font-mono-num flex items-center gap-4 text-slate-300">
                    <span>Bajas: <strong className="text-amber-400">{p.kills}</strong></span>
                    <span>Caídas: <strong>{p.deaths}</strong></span>
                    <span>PS: <strong className="text-emerald-400">{p.hp}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md bg-[#11161f] border border-red-800/70 rounded-xl p-6 text-center">
            <h2 className="font-display text-2xl font-bold text-red-400">
              {mode === 'multiplayer' ? 'Has caído en combate' : 'Operador Abatido'}
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              {mode === 'multiplayer'
                ? 'Reapareciendo automáticamente en la zona segura...'
                : `Sobreviviste hasta la oleada ${wave} (${bossesDefeated} jefes derrotados) con ${kills} bajas (${headshots} en la cabeza).`}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {mode === 'survival' && (
                <button
                  type="button"
                  onClick={restartSurvival}
                  className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
                >
                  Reintentar
                </button>
              )}
              <button
                type="button"
                onClick={onExit}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-600 transition-colors"
              >
                Volver al Hangar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
