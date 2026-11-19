export type PlatformType = 'desktop' | 'mobile' | 'tablet';

export type GameMode = 'survival' | 'practice' | 'multiplayer';

export type MultiplayerSubMode = 'coop' | 'pvp';

export type ArmorClass = 'tactical' | 'heavy' | 'recon' | 'medic';

export type HelmetType =
  | 'ballistic'
  | 'visor'
  | 'gasmask'
  | 'beret'
  | 'hood'
  | 'oni_mask'
  | 'pilot_helm';

export type BackpackType =
  | 'tactical'
  | 'jetpack'
  | 'bio'
  | 'ammo_pack'
  | 'sword_sheath'
  | 'none';

export type SuitPattern =
  | 'solid'
  | 'urban_camo'
  | 'woodland'
  | 'desert'
  | 'hazard'
  | 'cyber_hex';

export type ShoulderStyle = 'standard' | 'heavy_plates' | 'spiked' | 'stealth';

export type EmblemType = 'none' | 'skull' | 'biohazard' | 'wing' | 'shield' | 'star';

export type WeaponFinish =
  | 'factory'
  | 'tan_desert'
  | 'olive_mil'
  | 'arctic'
  | 'crimson'
  | 'gold_plated'
  | 'neon_cyber';

export type WeaponRarity = 'Común' | 'Poco Común' | 'Rara' | 'Épica' | 'Legendaria';

export type WeaponId =
  | 'knife_combat'
  | 'baseball_bat'
  | 'machete_apoc'
  | 'katana_cyber'
  | 'crowbar_tactical'
  | 'fire_axe'
  | 'combat_tomahawk'
  | 'chainsaw_ripper'
  | 'energy_blade'
  | 'p9_tactical'
  | 'deagle_50'
  | 'glock18_auto'
  | 'magnum_357'
  | 'usp_silenced'
  | 'beretta_93r'
  | 'colt_python'
  | 'mp5_alfa'
  | 'mp7_viper'
  | 'p90_spectre'
  | 'vector_45'
  | 'ump_45'
  | 'thompson_m1a1'
  | 'bizon_pp19'
  | 'm4_centinela'
  | 'ak_furia'
  | 'scar_pesado'
  | 'famas_burst'
  | 'g36_tactico'
  | 'aug_a3'
  | 'hk416_delta'
  | 'fal_battle'
  | 'remington_870'
  | 'spas12'
  | 'sawed_off'
  | 'aa12_auto'
  | 'benelli_m4'
  | 'ksg_bullpup'
  | 'origin_12'
  | 'm24_cazador'
  | 'awp_espectro'
  | 'svd_dragunov'
  | 'barrett_50'
  | 'kar98k_classic'
  | 'mk14_ebr'
  | 'cheytac_m200'
  | 'm249_titan'
  | 'gl40'
  | 'x9_plasma'
  | 'vulcan_laser'
  | 'crossbow_apoc'
  | 'minigun_hydra'
  | 'rpk_heavy'
  | 'mgl_incendiary'
  | 'railgun_nemesis';

export type WeaponCategory =
  | 'Cuerpo a Cuerpo'
  | 'Pistolas'
  | 'Subfusiles'
  | 'Rifles de Asalto'
  | 'Escopetas'
  | 'Francotiradores'
  | 'Pesadas y Especiales';

export type OpticId = 'none' | 'red_dot' | 'holo' | 'acog_4x' | 'sniper_8x' | 'thermal_scope';
export type MuzzleId = 'none' | 'compensator' | 'suppressor' | 'heavy_barrel';
export type UnderbarrelId = 'none' | 'vertical_grip' | 'laser_sight' | 'tactical_foregrip';
export type MagazineId = 'standard' | 'extended_mag' | 'ap_rounds' | 'drum_mag';
export type StockId = 'none' | 'light_stock' | 'heavy_stock' | 'recoil_pad';

export interface WeaponAttachments {
  optic: OpticId;
  muzzle: MuzzleId;
  underbarrel: UnderbarrelId;
  magazine: MagazineId;
  stock?: StockId;
}

export type AttachmentSlot = 'optic' | 'muzzle' | 'underbarrel' | 'magazine' | 'stock';

export interface AttachmentSpec {
  id: string;
  slot: AttachmentSlot;
  name: string;
  description: string;
  statSummary: string;
  cost: number;
  damageMult: number;
  headshotBonus: number;
  recoilMult: number;
  spreadMult: number;
  adsFovOverride?: number;
  noiseMult: number;
  forceSuppressed?: boolean;
  magMult: number;
  reloadMult: number;
  rangeMult: number;
}

export interface WeaponSpec {
  id: WeaponId;
  slotIndex: number;
  name: string;
  caliber: string;
  category: WeaponCategory;
  rarity: WeaponRarity;
  isMelee?: boolean;
  isCategoryStarter: boolean;
  description: string;
  damage: number;
  headshotMult: number;
  rpm: number;
  auto: boolean;
  magSize: number;
  reserveMax: number;
  reloadSec: number;
  spread: number;
  adsSpread: number;
  pellets: number;
  range: number;
  explosiveRadius?: number;
  projectileSpeed?: number;
  zoomFov: number;
  recoilKick: number;
  tracerColor: string;
  cost: number;
  noiseRadius: number;
  suppressed?: boolean;
  soundProfile:
    | 'melee'
    | 'pistol'
    | 'smg'
    | 'rifle'
    | 'heavy'
    | 'shotgun'
    | 'sniper'
    | 'lmg'
    | 'grenade'
    | 'plasma'
    | 'laser';
}

export type ZombieAIState = 'wandering' | 'investigating' | 'chasing';

export interface CharacterConfig {
  name: string;
  armorClass: ArmorClass;
  helmet: HelmetType;
  armorColor: string;
  secondaryColor?: string;
  accentColor: string;
  suitPattern?: SuitPattern;
  shoulderStyle?: ShoulderStyle;
  emblem?: EmblemType;
  backpack: BackpackType;
  starterWeaponId: WeaponId;
  weaponAttachments?: Partial<Record<WeaponId, WeaponAttachments>>;
  weaponFinishes?: Partial<Record<WeaponId, WeaponFinish>>;
}

export interface PlayerProgression {
  credits: number;
  ownedWeapons: WeaponId[];
  ownedAttachments: string[];
  ownedFinishes?: WeaponFinish[];
  weaponAttachments: Partial<Record<WeaponId, WeaponAttachments>>;
  weaponFinishes?: Partial<Record<WeaponId, WeaponFinish>>;
}

export type ZombieType =
  | 'walker'
  | 'runner'
  | 'brute'
  | 'spitter'
  | 'crawler'
  | 'hazmat'
  | 'riot'
  | 'bloater';

export type BossVariantId =
  | 'colossus_reactor'
  | 'acid_matriarch'
  | 'riot_juggernaut'
  | 'apex_abomination';

export type VehicleType = 'sedan' | 'pickup' | 'sport' | 'ambulance' | 'buggy';

export type TrapType = 'bear_trap' | 'landmine';

export interface RoomSummary {
  code: string;
  name: string;
  subMode: MultiplayerSubMode;
  playerCount: number;
  maxPlayers: number;
  wave: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  platform: PlatformType;
  character: CharacterConfig;
  weaponId: WeaponId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  isMoving: boolean;
  lastShotAt?: number;
}

export interface ServerZombieState {
  id: string;
  type: ZombieType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  isCrawling?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  system?: boolean;
}
