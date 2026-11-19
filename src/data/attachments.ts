import { AttachmentSlot, AttachmentSpec, WeaponAttachments, WeaponFinish, WeaponId } from '../types/game';
import { WEAPON_MAP } from './weapons';

export const DEFAULT_ATTACHMENTS: WeaponAttachments = {
  optic: 'none',
  muzzle: 'none',
  underbarrel: 'none',
  magazine: 'standard',
  stock: 'none',
};

export interface WeaponFinishSpec {
  id: WeaponFinish;
  label: string;
  swatch: string;
  primaryHex: number;
  secondaryHex: number;
  cost: number;
  metalness?: number;
  roughness?: number;
  emissiveHex?: number;
}

export const WEAPON_FINISHES: WeaponFinishSpec[] = [
  {
    id: 'factory',
    label: 'Acero Fábrica',
    swatch: '#334155',
    primaryHex: 0x1e2229,
    secondaryHex: 0x2b313a,
    cost: 0,
  },
  {
    id: 'tan_desert',
    label: 'Arena Desierto',
    swatch: '#a68b67',
    primaryHex: 0x9b8059,
    secondaryHex: 0x6b563b,
    cost: 90,
  },
  {
    id: 'olive_mil',
    label: 'Oliva Táctico',
    swatch: '#3f5e36',
    primaryHex: 0x3b5332,
    secondaryHex: 0x263421,
    cost: 90,
  },
  {
    id: 'arctic',
    label: 'Titanio Ártico',
    swatch: '#e2e8f0',
    primaryHex: 0xdbe3ec,
    secondaryHex: 0x64748b,
    cost: 140,
  },
  {
    id: 'crimson',
    label: 'Carmesí Sangre',
    swatch: '#991b1b',
    primaryHex: 0x7f1d1d,
    secondaryHex: 0x1e293b,
    cost: 160,
  },
  {
    id: 'gold_plated',
    label: 'Oro Balístico',
    swatch: '#eab308',
    primaryHex: 0xd4a428,
    secondaryHex: 0x855e14,
    cost: 320,
    metalness: 0.94,
    roughness: 0.2,
  },
  {
    id: 'neon_cyber',
    label: 'Cyber Neón',
    swatch: '#06b6d4',
    primaryHex: 0x0f172a,
    secondaryHex: 0x06b6d4,
    cost: 280,
    emissiveHex: 0x0891b2,
  },
];

export const WEAPON_FINISH_MAP: Record<WeaponFinish, WeaponFinishSpec> = WEAPON_FINISHES.reduce(
  (acc, f) => {
    acc[f.id] = f;
    return acc;
  },
  {} as Record<WeaponFinish, WeaponFinishSpec>
);

export const ATTACHMENTS: AttachmentSpec[] = [
  // --- MIRAS (OPTICS) ---
  {
    id: 'red_dot',
    slot: 'optic',
    name: 'Mira Punto Rojo Reflex',
    description: 'Óptica abierta con punto LED de adquisición rápida.',
    statSummary: '+25% Precisión · +15% Crítico · Zoom 1.4x',
    cost: 120,
    damageMult: 1.0,
    headshotBonus: 0.15,
    recoilMult: 0.96,
    spreadMult: 0.75,
    adsFovOverride: 50,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.08,
  },
  {
    id: 'holo',
    slot: 'optic',
    name: 'Mira Holográfica EOTech',
    description: 'Retícula holográfica blindada ideal para combate táctico.',
    statSummary: '+35% Precisión · +5% Daño · Zoom 1.6x',
    cost: 190,
    damageMult: 1.05,
    headshotBonus: 0.25,
    recoilMult: 0.92,
    spreadMult: 0.65,
    adsFovOverride: 44,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.12,
  },
  {
    id: 'acog_4x',
    slot: 'optic',
    name: 'Óptica Prisma ACOG 4x',
    description: 'Mira telescópica compacta con colector de fibra óptica.',
    statSummary: '+45% Precisión · +10% Daño · Zoom 4x',
    cost: 290,
    damageMult: 1.1,
    headshotBonus: 0.35,
    recoilMult: 0.9,
    spreadMult: 0.55,
    adsFovOverride: 30,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.24,
  },
  {
    id: 'thermal_scope',
    slot: 'optic',
    name: 'Visor Térmico FLIR 3.5x',
    description: 'Óptica infrarroja táctica que resalta blancos en niebla o zonas oscuras.',
    statSummary: '+50% Precisión · +14% Daño · Zoom Térmico 3.5x',
    cost: 360,
    damageMult: 1.14,
    headshotBonus: 0.4,
    recoilMult: 0.88,
    spreadMult: 0.48,
    adsFovOverride: 32,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.3,
  },
  {
    id: 'sniper_8x',
    slot: 'optic',
    name: 'Mira Telescópica 8x Balística',
    description: 'Visor de largo alcance con torretas de elevación y parasol.',
    statSummary: '+60% Precisión · +18% Daño · Zoom 8x',
    cost: 420,
    damageMult: 1.18,
    headshotBonus: 0.5,
    recoilMult: 0.88,
    spreadMult: 0.4,
    adsFovOverride: 18,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.38,
  },

  // --- CAÑÓN / BOCACHA (MUZZLES) ---
  {
    id: 'compensator',
    slot: 'muzzle',
    name: 'Freno Compensador CNC',
    description: 'Redirige los gases hacia arriba reduciendo drásticamente el retroceso.',
    statSummary: '-32% Retroceso · +8% Daño',
    cost: 140,
    damageMult: 1.08,
    headshotBonus: 0,
    recoilMult: 0.68,
    spreadMult: 0.88,
    noiseMult: 1.05,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.06,
  },
  {
    id: 'suppressor',
    slot: 'muzzle',
    name: 'Silenciador Táctico Deflector',
    description: 'Reduce el estruendo del disparo para evitar atraer hordas cercanas.',
    statSummary: '-62% Ruido (Sigilo) · +6% Daño · -12% Retroceso',
    cost: 240,
    damageMult: 1.06,
    headshotBonus: 0.1,
    recoilMult: 0.88,
    spreadMult: 0.9,
    noiseMult: 0.38,
    forceSuppressed: true,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.05,
  },
  {
    id: 'heavy_barrel',
    slot: 'muzzle',
    name: 'Cañón Pesado Estriado',
    description: 'Cañón flotante de acero forjado que aumenta la velocidad de salida.',
    statSummary: '+22% Daño · +25% Alcance · +15% Precisión',
    cost: 340,
    damageMult: 1.22,
    headshotBonus: 0.15,
    recoilMult: 0.92,
    spreadMult: 0.85,
    noiseMult: 1.1,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.25,
  },

  // --- ACOPLE / LÁSER (UNDERBARREL) ---
  {
    id: 'vertical_grip',
    slot: 'underbarrel',
    name: 'Empuñadura Vertical Táctica',
    description: 'Agarre inferior ergonómico para controlar ráfagas automáticas.',
    statSummary: '-28% Retroceso · +20% Estabilidad',
    cost: 130,
    damageMult: 1.0,
    headshotBonus: 0,
    recoilMult: 0.72,
    spreadMult: 0.8,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.0,
  },
  {
    id: 'laser_sight',
    slot: 'underbarrel',
    name: 'Módulo Láser PEQ-15',
    description: 'Proyecta un haz láser rojo para apuntar con precisión desde la cadera.',
    statSummary: '+42% Precisión Cadera · +10% Daño Crítico',
    cost: 210,
    damageMult: 1.1,
    headshotBonus: 0.2,
    recoilMult: 0.92,
    spreadMult: 0.58,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.06,
  },
  {
    id: 'tactical_foregrip',
    slot: 'underbarrel',
    name: 'Guardamanos Angular Pro',
    description: 'Agarre ligero que acelera la recarga y mejora la maniobrabilidad.',
    statSummary: '+22% Velocidad Recarga · -20% Retroceso',
    cost: 250,
    damageMult: 1.05,
    headshotBonus: 0,
    recoilMult: 0.8,
    spreadMult: 0.85,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 0.78,
    rangeMult: 1.0,
  },

  // --- CARGADOR / MUNICIÓN (MAGAZINE) ---
  {
    id: 'extended_mag',
    slot: 'magazine',
    name: 'Cargador Extendido +50%',
    description: 'Cargador de alta capacidad para sostener fuego prolongado sin recargar.',
    statSummary: '+50% Balas por Cargador y Reserva',
    cost: 180,
    damageMult: 1.0,
    headshotBonus: 0,
    recoilMult: 1.0,
    spreadMult: 1.0,
    noiseMult: 1.0,
    magMult: 1.5,
    reloadMult: 1.05,
    rangeMult: 1.0,
  },
  {
    id: 'drum_mag',
    slot: 'magazine',
    name: 'Tambor Doble +85%',
    description: 'Tambor táctico masivo para ráfagas casi continuas contra grandes hordas.',
    statSummary: '+85% Capacidad · +5% Daño',
    cost: 340,
    damageMult: 1.05,
    headshotBonus: 0,
    recoilMult: 1.05,
    spreadMult: 1.02,
    noiseMult: 1.0,
    magMult: 1.85,
    reloadMult: 1.14,
    rangeMult: 1.0,
  },
  {
    id: 'ap_rounds',
    slot: 'magazine',
    name: 'Munición Perforante AP',
    description: 'Proyectiles con núcleo de tungsteno que multiplican el daño letal.',
    statSummary: '+28% Daño Base · +10% Alcance',
    cost: 320,
    damageMult: 1.28,
    headshotBonus: 0.25,
    recoilMult: 1.04,
    spreadMult: 0.95,
    noiseMult: 1.08,
    magMult: 1.0,
    reloadMult: 1.0,
    rangeMult: 1.1,
  },

  // --- CULATA / ESTABILIDAD (STOCK) ---
  {
    id: 'light_stock',
    slot: 'stock',
    name: 'Culata Plegable Ultraligera',
    description: 'Armazón esqueletizado que acelera la recarga y el manejo en edificios.',
    statSummary: '+24% Velocidad Recarga · -16% Retroceso',
    cost: 150,
    damageMult: 1.0,
    headshotBonus: 0,
    recoilMult: 0.84,
    spreadMult: 0.92,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 0.76,
    rangeMult: 1.0,
  },
  {
    id: 'heavy_stock',
    slot: 'stock',
    name: 'Culata Táctica Amortiguada',
    description: 'Culata con pistón hidráulico que absorbe gran parte del retroceso.',
    statSummary: '-36% Retroceso · +22% Precisión',
    cost: 230,
    damageMult: 1.04,
    headshotBonus: 0.1,
    recoilMult: 0.64,
    spreadMult: 0.78,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 0.96,
    rangeMult: 1.06,
  },
  {
    id: 'recoil_pad',
    slot: 'stock',
    name: 'Estabilizador Match Pro',
    description: 'Contrapeso trasero de precisión que mejora daño crítico y alcance efectivo.',
    statSummary: '+12% Daño · +20% Crítico · -22% Retroceso',
    cost: 310,
    damageMult: 1.12,
    headshotBonus: 0.2,
    recoilMult: 0.78,
    spreadMult: 0.8,
    noiseMult: 1.0,
    magMult: 1.0,
    reloadMult: 0.92,
    rangeMult: 1.1,
  },
];

export const ATTACHMENT_MAP: Record<string, AttachmentSpec> = ATTACHMENTS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<string, AttachmentSpec>
);

export const ATTACHMENT_SLOT_LABELS: Record<AttachmentSlot, string> = {
  optic: 'Mira Óptica',
  muzzle: 'Cañón / Bocacha',
  underbarrel: 'Acople / Láser',
  magazine: 'Cargador / Munición',
  stock: 'Culata / Estabilidad',
};

export interface EffectiveWeaponStats {
  damage: number;
  headshotMult: number;
  rpm: number;
  magSize: number;
  reserveMax: number;
  reloadSec: number;
  spread: number;
  adsSpread: number;
  range: number;
  zoomFov: number;
  recoilKick: number;
  noiseRadius: number;
  suppressed: boolean;
  powerBonusPct: number;
  attachments: WeaponAttachments;
}

export function normalizeAttachments(att?: Partial<WeaponAttachments>): WeaponAttachments {
  return {
    optic: att?.optic || 'none',
    muzzle: att?.muzzle || 'none',
    underbarrel: att?.underbarrel || 'none',
    magazine: att?.magazine || 'standard',
    stock: att?.stock || 'none',
  };
}

export function computeEffectiveWeaponStats(
  weaponId: WeaponId,
  rawAttachments?: Partial<WeaponAttachments>
): EffectiveWeaponStats {
  const base = WEAPON_MAP[weaponId] || WEAPON_MAP.m4_centinela;
  const att = normalizeAttachments(rawAttachments);

  if (base.isMelee) {
    return {
      damage: base.damage,
      headshotMult: base.headshotMult,
      rpm: base.rpm,
      magSize: 0,
      reserveMax: 0,
      reloadSec: 0,
      spread: 0,
      adsSpread: 0,
      range: base.range,
      zoomFov: 72,
      recoilKick: 0,
      noiseRadius: base.noiseRadius,
      suppressed: true,
      powerBonusPct: 0,
      attachments: DEFAULT_ATTACHMENTS,
    };
  }

  const selected: AttachmentSpec[] = [];
  if (att.optic !== 'none' && ATTACHMENT_MAP[att.optic]) selected.push(ATTACHMENT_MAP[att.optic]);
  if (att.muzzle !== 'none' && ATTACHMENT_MAP[att.muzzle]) selected.push(ATTACHMENT_MAP[att.muzzle]);
  if (att.underbarrel !== 'none' && ATTACHMENT_MAP[att.underbarrel]) selected.push(ATTACHMENT_MAP[att.underbarrel]);
  if (att.magazine !== 'standard' && ATTACHMENT_MAP[att.magazine]) selected.push(ATTACHMENT_MAP[att.magazine]);
  if (att.stock && att.stock !== 'none' && ATTACHMENT_MAP[att.stock]) selected.push(ATTACHMENT_MAP[att.stock]);

  let damageMult = 1;
  let headshotBonus = 0;
  let recoilMult = 1;
  let spreadMult = 1;
  let noiseMult = 1;
  let magMult = 1;
  let reloadMult = 1;
  let rangeMult = 1;
  let zoomFov = base.zoomFov;
  let suppressed = Boolean(base.suppressed);

  for (const s of selected) {
    damageMult *= s.damageMult;
    headshotBonus += s.headshotBonus;
    recoilMult *= s.recoilMult;
    spreadMult *= s.spreadMult;
    noiseMult *= s.noiseMult;
    magMult *= s.magMult;
    reloadMult *= s.reloadMult;
    rangeMult *= s.rangeMult;
    if (s.adsFovOverride !== undefined) {
      zoomFov = Math.min(zoomFov, s.adsFovOverride);
    }
    if (s.forceSuppressed) {
      suppressed = true;
    }
  }

  const damage = Math.round(base.damage * damageMult);
  const magSize = Math.max(1, Math.round(base.magSize * magMult));
  const reserveMax = Math.max(magSize, Math.round(base.reserveMax * magMult));
  const noiseRadius = Math.max(6, Math.round(base.noiseRadius * noiseMult));

  return {
    damage,
    headshotMult: Number((base.headshotMult + headshotBonus).toFixed(2)),
    rpm: base.rpm,
    magSize,
    reserveMax,
    reloadSec: Number((base.reloadSec * reloadMult).toFixed(2)),
    spread: base.spread * spreadMult,
    adsSpread: base.adsSpread * spreadMult,
    range: Math.round(base.range * rangeMult),
    zoomFov,
    recoilKick: base.recoilKick * recoilMult,
    noiseRadius,
    suppressed,
    powerBonusPct: Math.round((damageMult - 1) * 100),
    attachments: att,
  };
}
