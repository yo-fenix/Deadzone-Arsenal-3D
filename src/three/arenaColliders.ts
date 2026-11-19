export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface VecXZ {
  x: number;
  z: number;
}

export const CITY_ARENA_HALF = 110;

export interface CityBuildingSpec {
  cx: number;
  cz: number;
  bw: number;
  bd: number;
  h: number;
  label: string;
}

export const CITY_BUILDINGS: CityBuildingSpec[] = [
  // Inner Downtown District (4 buildings)
  { cx: -26, cz: -26, bw: 15, bd: 13, h: 5.2, label: 'FARMACIA' },
  { cx: 26, cz: -26, bw: 15, bd: 13, h: 5.4, label: 'ARMERÍA' },
  { cx: -26, cz: 26, bw: 15, bd: 14, h: 5.0, label: 'SUPERMERCADO' },
  { cx: 26, cz: 26, bw: 15, bd: 13, h: 5.6, label: 'COMISARÍA' },
  // Outer North & South City Blocks
  { cx: -30, cz: -82, bw: 18, bd: 14, h: 6.4, label: 'HOSPITAL' },
  { cx: 30, cz: -82, bw: 16, bd: 14, h: 5.8, label: 'TALLER' },
  { cx: -30, cz: 82, bw: 16, bd: 14, h: 6.0, label: 'BANCO' },
  { cx: 30, cz: 82, bw: 18, bd: 14, h: 6.2, label: 'REFUGIO' },
  // Outer West & East Avenues
  { cx: -84, cz: -28, bw: 16, bd: 15, h: 5.8, label: 'DEPÓSITO' },
  { cx: 84, cz: 28, bw: 16, bd: 15, h: 6.0, label: 'CUARTEL' },
];

export const CITY_TREE_POSITIONS: [number, number][] = [
  [-44, -14], [-44, 16], [44, -16], [44, 14],
  [-16, -44], [16, -44], [-16, 44], [16, 44],
  [-74, -44], [74, -44], [-74, 44], [74, 44],
  [-92, 16], [92, -16], [-18, -94], [18, 94],
  [-68, -74], [68, -74], [-68, 74], [68, 74],
];

export const CITY_WRECKED_CARS: { x: number; z: number; rotY: number; color: number }[] = [
  { x: -3.5, z: -16, rotY: 0.25, color: 0x7c2d12 },
  { x: 4.2, z: -38, rotY: -0.35, color: 0x3f6212 },
  { x: -18, z: 3.4, rotY: 1.4, color: 0x1e3a8a },
  { x: 19, z: -3.4, rotY: -1.75, color: 0x713f12 },
  { x: 3.5, z: 22, rotY: 2.9, color: 0x52525b },
  { x: -40, z: -3.2, rotY: 1.55, color: 0x7f1d1d },
  { x: 64, z: -3.4, rotY: 1.45, color: 0x334155 },
  { x: -64, z: 3.6, rotY: -1.65, color: 0x4d7c0f },
  { x: -3.8, z: -68, rotY: 0.4, color: 0x9a3412 },
  { x: 4.0, z: 72, rotY: 2.7, color: 0x1e293b },
];

export const CITY_BARRICADES: [number, number, number, number, number][] = [
  [0, -10.5, 4.2, 1.15, 0.9],
  [-10.5, 0, 0.9, 1.15, 4.2],
  [10.5, 0, 0.9, 1.15, 4.2],
  [0, 11.5, 4.2, 1.15, 0.9],
  [-46, 20, 3.8, 1.3, 1.1],
  [46, -20, 3.8, 1.3, 1.1],
  [0, -52, 5.2, 1.3, 1.1],
  [0, 52, 5.2, 1.3, 1.1],
  [-52, 0, 1.1, 1.3, 5.2],
  [52, 0, 1.1, 1.3, 5.2],
];

export const CITY_FIRE_BARRELS: [number, number][] = [
  [-8.5, -8.5],
  [12, 8.5],
  [-24, 17],
  [24, -17],
  [-54, -12],
  [54, 12],
  [-12, -56],
  [12, 56],
];

function makeBox(x: number, z: number, w: number, h: number, d: number): ColliderBox {
  return {
    minX: x - w / 2,
    maxX: x + w / 2,
    minZ: z - d / 2,
    maxZ: z + d / 2,
    maxY: h,
  };
}

function createRuinedBuildingColliders(cx: number, cz: number, bw: number, bd: number, h: number): ColliderBox[] {
  const boxes: ColliderBox[] = [];
  const t = 0.75;
  const doorW = 3.4;
  const segW = (bw - doorW) / 2;
  const frontZ = cz < 0 ? cz + bd / 2 : cz - bd / 2;
  boxes.push(makeBox(cx - (doorW / 2 + segW / 2), frontZ, segW, h, t));
  boxes.push(makeBox(cx + (doorW / 2 + segW / 2), frontZ, segW, h, t));

  const backZ = cz < 0 ? cz - bd / 2 : cz + bd / 2;
  boxes.push(makeBox(cx, backZ, bw, h * 0.9, t));

  boxes.push(makeBox(cx - bw / 2, cz, t, h, bd));
  const sideSegD = (bd - doorW) / 2;
  boxes.push(makeBox(cx + bw / 2, cz - (doorW / 2 + sideSegD / 2), t, h * 0.85, sideSegD));
  boxes.push(makeBox(cx + bw / 2, cz + (doorW / 2 + sideSegD / 2), t, h * 0.85, sideSegD));
  return boxes;
}

/**
 * Shared exact collider layout for the 220m x 220m Survival & Multiplayer Apocalyptic City.
 * Used by BOTH client Three.js world (players, zombies, bullets, drivable cars) & server.ts!
 */
export const SURVIVAL_ARENA_COLLIDERS: ColliderBox[] = (() => {
  const cols: ColliderBox[] = [];
  const arenaHalf = CITY_ARENA_HALF;
  const wallH = 4.2;

  // Perimeter quarantine concrete walls
  cols.push(makeBox(0, -arenaHalf, arenaHalf * 2 + 2, wallH, 1.8));
  cols.push(makeBox(0, arenaHalf, arenaHalf * 2 + 2, wallH, 1.8));
  cols.push(makeBox(-arenaHalf, 0, 1.8, wallH, arenaHalf * 2 + 2));
  cols.push(makeBox(arenaHalf, 0, 1.8, wallH, arenaHalf * 2 + 2));

  // 10 Ruined City Buildings
  CITY_BUILDINGS.forEach((b) => {
    cols.push(...createRuinedBuildingColliders(b.cx, b.cz, b.bw, b.bd, b.h));
  });

  // Dead trees
  CITY_TREE_POSITIONS.forEach(([tx, tz]) => {
    cols.push({ minX: tx - 0.55, maxX: tx + 0.55, minZ: tz - 0.55, maxZ: tz + 0.55, maxY: 4.8 });
  });

  // Wrecked static cars
  CITY_WRECKED_CARS.forEach((cp) => {
    const isEW = Math.abs(Math.sin(cp.rotY)) > 0.7;
    cols.push(makeBox(cp.x, cp.z, isEW ? 4.3 : 2.1, 1.5, isEW ? 2.1 : 4.3));
  });

  // Barricades
  CITY_BARRICADES.forEach(([x, z, w, h, d]) => cols.push(makeBox(x, z, w, h, d)));

  // Burning barrels
  CITY_FIRE_BARRELS.forEach(([bx, bz]) => {
    cols.push({ minX: bx - 0.55, maxX: bx + 0.55, minZ: bz - 0.55, maxZ: bz + 0.55, maxY: 1.1 });
  });

  return cols;
})();

/**
 * Multi-iteration circle-vs-AABB collision solver that cleanly pushes out of corners
 * and never fails when an entity's center penetrates a wall box.
 */
export function resolveCircleAABBCollisions(
  pos: VecXZ & { y?: number },
  radius: number,
  colliders: ColliderBox[],
  boundX: number,
  minZ = -boundX,
  maxZ = boundX
): boolean {
  let collided = false;
  pos.x = Math.max(-boundX, Math.min(boundX, pos.x));
  pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
  const entityY = pos.y ?? 0;

  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (entityY > box.maxY) continue;

      const nearX = Math.max(box.minX, Math.min(box.maxX, pos.x));
      const nearZ = Math.max(box.minZ, Math.min(box.maxZ, pos.z));
      const dx = pos.x - nearX;
      const dz = pos.z - nearZ;
      const dSq = dx * dx + dz * dz;

      if (dSq === 0) {
        collided = true;
        const dLeft = Math.abs(pos.x - box.minX);
        const dRight = Math.abs(box.maxX - pos.x);
        const dBack = Math.abs(pos.z - box.minZ);
        const dFront = Math.abs(box.maxZ - pos.z);
        const minPen = Math.min(dLeft, dRight, dBack, dFront);
        if (minPen === dLeft) pos.x = box.minX - radius;
        else if (minPen === dRight) pos.x = box.maxX + radius;
        else if (minPen === dBack) pos.z = box.minZ - radius;
        else pos.z = box.maxZ + radius;
      } else if (dSq < radius * radius) {
        collided = true;
        const d = Math.sqrt(dSq);
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      }
    }
    pos.x = Math.max(-boundX, Math.min(boundX, pos.x));
    pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
  }
  return collided;
}

/**
 * Checks whether the 2D segment from (x1,z1) to (x2,z2) is blocked by any tall wall/building collider
 */
export function hasLineOfSightXZ(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  colliders: ColliderBox[],
  minWallHeight = 1.6
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;

  const steps = Math.ceil(dist / 0.55);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.maxY < minWallHeight) continue;
      if (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Computes steering direction for a zombie so it walks around walls & through building doorways
 * instead of pushing blindly into a solid wall.
 */
export function steerAroundWalls(
  x: number,
  z: number,
  goalX: number,
  goalZ: number,
  colliders: ColliderBox[],
  probeDist = 1.35,
  arenaBound = CITY_ARENA_HALF - 2
): { dirX: number; dirZ: number } {
  const dx = goalX - x;
  const dz = goalZ - z;
  const len = Math.hypot(dx, dz) || 1;
  const baseAngle = Math.atan2(dz, dx);

  const isPointClear = (px: number, pz: number, r = 0.52) => {
    if (Math.abs(px) > arenaBound || Math.abs(pz) > arenaBound) return false;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (b.maxY < 0.6) continue;
      if (px + r > b.minX && px - r < b.maxX && pz + r > b.minZ && pz - r < b.maxZ) {
        return false;
      }
    }
    return true;
  };

  const testRay = (ang: number) => {
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    return (
      isPointClear(x + ux * (probeDist * 0.5), z + uz * (probeDist * 0.5)) &&
      isPointClear(x + ux * probeDist, z + uz * probeDist)
    );
  };

  if (testRay(baseAngle)) {
    return { dirX: Math.cos(baseAngle), dirZ: Math.sin(baseAngle) };
  }

  const offsets = [0.55, -0.55, 1.05, -1.05, 1.5, -1.5, 2.0, -2.0];
  for (const off of offsets) {
    if (testRay(baseAngle + off)) {
      return { dirX: Math.cos(baseAngle + off), dirZ: Math.sin(baseAngle + off) };
    }
  }

  return { dirX: dx / len, dirZ: dz / len };
}
