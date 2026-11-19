import { BossVariantId } from '../types/game';

export interface BossArchetypeSpec {
  id: BossVariantId;
  name: string;
  title: string;
  weakPointLabel: string;
  weakPointHint: string;
  weakPointColorHex: string;
  weakPointEmissive: number;
  baseHp: number;
  baseSpeed: number;
  meleeDamage: number;
  armorResist: number;
  weakSpotMult: number;
  scale: number;
  rangedAcidBurst?: boolean;
  shockwaveSlam?: boolean;
}

export const BOSS_ROTATION: BossVariantId[] = [
  'colossus_reactor',
  'acid_matriarch',
  'riot_juggernaut',
  'apex_abomination',
];

export const BOSS_ARCHETYPES: Record<BossVariantId, BossArchetypeSpec> = {
  colossus_reactor: {
    id: 'colossus_reactor',
    name: 'Coloso del Reactor',
    title: 'Blindado Pesado · Acorazado Frontal',
    weakPointLabel: 'Núcleo Dorsal (Espalda)',
    weakPointHint: 'Dispara al reactor naranja brillante en su espalda',
    weakPointColorHex: '#f97316',
    weakPointEmissive: 0xf97316,
    baseHp: 1150,
    baseSpeed: 3.15,
    meleeDamage: 30,
    armorResist: 0.28,
    weakSpotMult: 4.5,
    scale: 1.82,
    shockwaveSlam: true,
  },
  acid_matriarch: {
    id: 'acid_matriarch',
    name: 'Matriarca Ácida',
    title: 'Mutante Venenosa · Ataque de Ácido Triple',
    weakPointLabel: 'Sacos Tóxicos (Hombros y Garganta)',
    weakPointHint: 'Apunta a los sacos verde neón de sus hombros y garganta',
    weakPointColorHex: '#4ade80',
    weakPointEmissive: 0x22c55e,
    baseHp: 1380,
    baseSpeed: 3.65,
    meleeDamage: 26,
    armorResist: 0.32,
    weakSpotMult: 4.8,
    scale: 1.76,
    rangedAcidBurst: true,
  },
  riot_juggernaut: {
    id: 'riot_juggernaut',
    name: 'Acorazado Cryo-Táctico',
    title: 'Escudo Balístico · Blindaje Extremo',
    weakPointLabel: 'Rodillas Hidráulicas y Visor Frontal',
    weakPointHint: 'Dispara a las articulaciones cian de sus rodillas o la rendija del visor',
    weakPointColorHex: '#22d3ee',
    weakPointEmissive: 0x06b6d4,
    baseHp: 1650,
    baseSpeed: 3.35,
    meleeDamage: 34,
    armorResist: 0.24,
    weakSpotMult: 4.7,
    scale: 1.9,
  },
  apex_abomination: {
    id: 'apex_abomination',
    name: 'Abominación Abisal',
    title: 'Depredador Alfa · Alta Velocidad y Furia',
    weakPointLabel: 'Corazón Expuesto (Pecho) y Ojo Craneal',
    weakPointHint: 'Destruye el corazón carmesí en su pecho abierto o su tercer ojo craneal',
    weakPointColorHex: '#fb7185',
    weakPointEmissive: 0xe11d48,
    baseHp: 1950,
    baseSpeed: 4.15,
    meleeDamage: 38,
    armorResist: 0.26,
    weakSpotMult: 5.0,
    scale: 1.96,
    rangedAcidBurst: true,
    shockwaveSlam: true,
  },
};

export function getBossForWave(bossesDefeated: number, wave: number): {
  spec: BossArchetypeSpec;
  tier: number;
  scaledHp: number;
  scaledSpeed: number;
  scaledDamage: number;
  scaledArmorResist: number;
  weakSpotMult: number;
} {
  const variantId = BOSS_ROTATION[bossesDefeated % BOSS_ROTATION.length];
  const spec = BOSS_ARCHETYPES[variantId];
  const tier = bossesDefeated + 1;
  const cycleMult = 1 + bossesDefeated * 0.58 + Math.max(0, wave - 5) * 0.04;
  return {
    spec,
    tier,
    scaledHp: Math.round(spec.baseHp * cycleMult),
    scaledSpeed: Number((spec.baseSpeed + Math.min(bossesDefeated * 0.34, 2.1)).toFixed(2)),
    scaledDamage: Math.round(spec.meleeDamage + bossesDefeated * 6),
    scaledArmorResist: Math.max(0.15, Number((spec.armorResist - bossesDefeated * 0.015).toFixed(2))),
    weakSpotMult: spec.weakSpotMult,
  };
}
