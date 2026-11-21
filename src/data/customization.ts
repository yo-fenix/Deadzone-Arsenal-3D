import {
  ArmorClass,
  BackpackType,
  CharacterConfig,
  EmblemType,
  HelmetType,
  PlayerProgression,
  ShoulderStyle,
  SuitPattern,
  WeaponId,
} from '../types/game';
import { getCategoryStarterWeapons } from './weapons';

export interface ArmorClassOption {
  id: ArmorClass;
  label: string;
  perk: string;
  cost: number;
  maxHp: number;
  speedMult: number;
  regenPerSec: number;
}

export const ARMOR_CLASSES: ArmorClassOption[] = [
  {
    id: 'none',
    label: 'Nada',
    perk: 'Sin clase · 85 PS · Velocidad base · Ranura gratuita',
    cost: 0,
    maxHp: 85,
    speedMult: 0.96,
    regenPerSec: 0,
  },
  {
    id: 'tactical',
    label: 'Asalto Táctico',
    perk: '105 PS · +2% Velocidad · Entrenamiento estándar',
    cost: 250,
    maxHp: 105,
    speedMult: 1.02,
    regenPerSec: 0,
  },
  {
    id: 'recon',
    label: 'Explorador Sigilo',
    perk: '115 PS · +18% Velocidad · Alta movilidad',
    cost: 500,
    maxHp: 115,
    speedMult: 1.18,
    regenPerSec: 0,
  },
  {
    id: 'heavy',
    label: 'Blindado Pesado',
    perk: '165 PS Máx · Placas reforzadas · +0.5 PS/s',
    cost: 850,
    maxHp: 165,
    speedMult: 0.94,
    regenPerSec: 0.5,
  },
  {
    id: 'medic',
    label: 'Médico Biohazard',
    perk: '135 PS · +8% Velocidad · Regeneración +3.0 PS/s',
    cost: 1300,
    maxHp: 135,
    speedMult: 1.08,
    regenPerSec: 3.0,
  },
];

export const HELMET_OPTIONS: { id: HelmetType; label: string }[] = [
  { id: 'ballistic', label: 'Casco Balístico' },
  { id: 'visor', label: 'Visor Táctico' },
  { id: 'gasmask', label: 'Máscara Antigás' },
  { id: 'beret', label: 'Boina Comando' },
  { id: 'hood', label: 'Capucha Hazmat' },
  { id: 'oni_mask', label: 'Máscara Oni' },
  { id: 'pilot_helm', label: 'Casco Piloto' },
];

export const BACKPACK_OPTIONS: { id: BackpackType; label: string }[] = [
  { id: 'tactical', label: 'Mochila Asalto' },
  { id: 'jetpack', label: 'Propulsor Compacto' },
  { id: 'bio', label: 'Tanque Bio-Médico' },
  { id: 'ammo_pack', label: 'Mochila Munición' },
  { id: 'sword_sheath', label: 'Vaina Táctica' },
  { id: 'none', label: 'Sin Accesorio' },
];

export const SUIT_PATTERN_OPTIONS: { id: SuitPattern; label: string }[] = [
  { id: 'solid', label: 'Sólido Mate' },
  { id: 'urban_camo', label: 'Camo Urbano' },
  { id: 'woodland', label: 'Camo Bosque' },
  { id: 'desert', label: 'Camo Desierto' },
  { id: 'hazard', label: 'Franjas Peligro' },
  { id: 'cyber_hex', label: 'Hexágono Cyber' },
];

export const SHOULDER_STYLE_OPTIONS: { id: ShoulderStyle; label: string }[] = [
  { id: 'standard', label: 'Estándar' },
  { id: 'heavy_plates', label: 'Placas Pesadas' },
  { id: 'spiked', label: 'Con Púas' },
  { id: 'stealth', label: 'Sigilo Angular' },
];

export const EMBLEM_OPTIONS: { id: EmblemType; label: string }[] = [
  { id: 'shield', label: 'Escudo' },
  { id: 'skull', label: 'Calavera' },
  { id: 'biohazard', label: 'Biohazard' },
  { id: 'wing', label: 'Alas' },
  { id: 'star', label: 'Estrella' },
  { id: 'none', label: 'Ninguno' },
];

export const ARMOR_COLOR_SWATCHES: { hex: string; label: string }[] = [
  { hex: '#1e293b', label: 'Obsidiana' },
  { hex: '#365314', label: 'Oliva Militar' },
  { hex: '#7f1d1d', label: 'Carmesí' },
  { hex: '#cbd5e1', label: 'Titanio Ártico' },
  { hex: '#1d4ed8', label: 'Cobalto' },
  { hex: '#92400e', label: 'Arena Desierto' },
  { hex: '#4c1d95', label: 'Púrpura Élite' },
  { hex: '#0f766e', label: 'Turquesa Comando' },
];

export const SECONDARY_COLOR_SWATCHES: { hex: string; label: string }[] = [
  { hex: '#475569', label: 'Acero Oscuro' },
  { hex: '#111827', label: 'Negro Carbón' },
  { hex: '#78350f', label: 'Cuero Táctico' },
  { hex: '#e2e8f0', label: 'Blanco Ártico' },
  { hex: '#991b1b', label: 'Rojo Sangre' },
  { hex: '#b45309', label: 'Bronce' },
];

export const ACCENT_COLOR_SWATCHES: { hex: string; label: string }[] = [
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#06b6d4', label: 'Cian Eléctrico' },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#ef4444', label: 'Rojo Láser' },
  { hex: '#f8fafc', label: 'Blanco Puro' },
  { hex: '#a855f7', label: 'Neón Violeta' },
];

export const STARTER_WEAPON_OPTIONS: WeaponId[] = getCategoryStarterWeapons();

export const DEFAULT_CHARACTER: CharacterConfig = {
  name: 'Operador-01',
  armorClass: 'none',
  helmet: 'visor',
  armorColor: '#1e293b',
  secondaryColor: '#475569',
  accentColor: '#f59e0b',
  suitPattern: 'solid',
  shoulderStyle: 'standard',
  emblem: 'shield',
  backpack: 'tactical',
  starterWeaponId: 'p9_tactical',
  weaponAttachments: {},
  weaponFinishes: {},
};

export const DEFAULT_PROGRESSION: PlayerProgression = {
  credits: 150,
  ownedWeapons: getCategoryStarterWeapons(),
  ownedClasses: ['none'],
  ownedAttachments: ['red_dot'],
  ownedFinishes: ['factory'],
  weaponAttachments: {},
  weaponFinishes: {},
};

export function getArmorStats(armorClass: ArmorClass): ArmorClassOption {
  return ARMOR_CLASSES.find((c) => c.id === armorClass) || ARMOR_CLASSES[0];
}
