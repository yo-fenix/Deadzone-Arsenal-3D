import * as THREE from 'three';
import {
  BossVariantId,
  CharacterConfig,
  EmblemType,
  SuitPattern,
  VehicleType,
  WeaponAttachments,
  WeaponFinish,
  WeaponId,
  ZombieType,
} from '../types/game';
import { BOSS_ARCHETYPES } from '../data/bosses';
import { RARITY_META, WEAPON_MAP } from '../data/weapons';
import { WEAPON_FINISH_MAP, normalizeAttachments } from '../data/attachments';

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMount: THREE.Group;
  muzzlePoint: THREE.Object3D;
}

export interface ZombieRig {
  root: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hpBarFill: THREE.Mesh;
  hpBarGroup: THREE.Group;
}

export interface BossZombieRig extends ZombieRig {
  weakSpots: THREE.Mesh[];
  weakSpotMat: THREE.MeshStandardMaterial;
}

export interface TargetDummyRig {
  root: THREE.Group;
  board: THREE.Group;
  hpBarFill: THREE.Mesh;
}

export interface DrivableVehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Group[];
  frontSteerLeft: THREE.Group;
  frontSteerRight: THREE.Group;
  headlightBeam: THREE.SpotLight;
  headlightLenses: THREE.Mesh[];
  sirenMeshes: THREE.Mesh[];
}

export interface BearTrapRig {
  root: THREE.Group;
  leftJaw: THREE.Group;
  rightJaw: THREE.Group;
  triggerPlate: THREE.Mesh;
}

export interface LandmineRig {
  root: THREE.Group;
  led: THREE.Mesh;
}

/**
 * Builds a high-detail realistic procedural 3D firearm + dynamically mounted Optics, Muzzles, Underbarrel grips/lasers & Magazines
 * Oriented along -Z (forward)
 */
export function buildWeaponMesh(
  weaponId: WeaponId,
  rawAttachments?: Partial<WeaponAttachments>,
  weaponFinish?: WeaponFinish
): { group: THREE.Group; muzzleOffset: THREE.Vector3; sightOffset: THREE.Vector3 } {
  const safeId: WeaponId = WEAPON_MAP[weaponId] ? weaponId : 'm4_centinela';
  const spec = WEAPON_MAP[safeId];
  const att = normalizeAttachments(rawAttachments);
  const finish = weaponFinish && WEAPON_FINISH_MAP[weaponFinish] ? WEAPON_FINISH_MAP[weaponFinish] : WEAPON_FINISH_MAP.factory;
  const hasCustomFinish = finish.id !== 'factory';
  const group = new THREE.Group();

  const parkerizedSteel = new THREE.MeshStandardMaterial({
    color: hasCustomFinish ? finish.primaryHex : 0x1e2229,
    metalness: finish.metalness ?? 0.88,
    roughness: finish.roughness ?? 0.34,
    emissive: finish.emissiveHex ? finish.emissiveHex : 0x000000,
    emissiveIntensity: finish.emissiveHex ? 0.12 : 0,
  });
  const anodizedAlloy = new THREE.MeshStandardMaterial({
    color: hasCustomFinish ? finish.secondaryHex : 0x2b313a,
    metalness: finish.metalness ?? 0.78,
    roughness: finish.roughness ?? 0.28,
    emissive: finish.emissiveHex ? finish.emissiveHex : 0x000000,
    emissiveIntensity: finish.emissiveHex ? 0.55 : 0,
  });
  const fdePolymer = new THREE.MeshStandardMaterial({
    color: 0x8f7654,
    metalness: 0.14,
    roughness: 0.65,
  });
  const chromeSteel = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.96,
    roughness: 0.15,
  });
  const polymerGrip = new THREE.MeshStandardMaterial({
    color: 0x16191e,
    metalness: 0.08,
    roughness: 0.84,
  });
  const olivePolymer = new THREE.MeshStandardMaterial({
    color: 0x2d3629,
    metalness: 0.1,
    roughness: 0.78,
  });
  const walnutWood = new THREE.MeshStandardMaterial({
    color: 0x5c331c,
    metalness: 0.06,
    roughness: 0.54,
  });
  const machinedSteel = new THREE.MeshStandardMaterial({
    color: 0x8b95a5,
    metalness: 0.94,
    roughness: 0.2,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc29842,
    metalness: 0.92,
    roughness: 0.22,
  });
  const opticGlass = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.25,
    metalness: 0.4,
    roughness: 0.08,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const tritiumMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x22c55e,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const laserEmitMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const energyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.tracerColor),
    emissive: new THREE.Color(spec.tracerColor),
    emissiveIntensity: 1.7,
    metalness: 0.35,
    roughness: 0.25,
  });

  let muzzleZ = -0.5;
  let muzzleY = 0.045;
  let opticPos = new THREE.Vector3(0, 0.086, -0.04);
  let underPos = new THREE.Vector3(0, 0.0, -0.26);
  let magAnchor = new THREE.Vector3(0, -0.01, -0.1);
  let isPistol = false;

  const addPart = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // Rounded & beveled box matching exact outer dimensions (w, h, d)
  const roundedBoxGeo = (w: number, h: number, d: number, radius = 0.007, bevelSegments = 3) => {
    const r = Math.min(radius, w * 0.32, h * 0.32, d * 0.32);
    const iw = Math.max(0.002, w - r * 2);
    const ih = Math.max(0.002, h - r * 2);
    const id = Math.max(0.002, d - r * 2);
    const hw = iw / 2;
    const hh = ih / 2;
    const shape = new THREE.Shape();
    const cr = Math.min(r * 0.75, hw * 0.5, hh * 0.5);
    shape.moveTo(-hw + cr, -hh);
    shape.lineTo(hw - cr, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
    shape.lineTo(hw, hh - cr);
    shape.quadraticCurveTo(hw, hh, hw - cr, hh);
    shape.lineTo(-hw + cr, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - cr);
    shape.lineTo(-hw, -hh + cr);
    shape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: id,
      curveSegments: 4,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments,
    });
    geo.translate(0, 0, -id / 2);
    return geo;
  };

  // Ergonomic contoured pistol grip with palm swell and front finger groove
  const roundedGripGeo = (w: number, h: number, d: number) => {
    const hh = h / 2;
    const hd = d / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hd * 0.85, hh);
    shape.lineTo(hd * 0.9, hh);
    // Backstrap palm swell
    shape.quadraticCurveTo(hd * 1.18, 0.0, hd * 0.95, -hh);
    shape.lineTo(-hd * 0.95, -hh);
    // Front finger groove contour
    shape.quadraticCurveTo(-hd * 0.72, -hh * 0.2, -hd * 0.98, hh * 0.35);
    shape.quadraticCurveTo(-hd * 1.05, hh * 0.72, -hd * 0.85, hh);
    const r = Math.min(0.006, w * 0.22);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.004, w - r * 2),
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments: 3,
    });
    geo.translate(0, 0, -Math.max(0.004, w - r * 2) / 2);
    geo.rotateY(-Math.PI / 2);
    return geo;
  };

  // Contoured rifle stock silhouette (extruded along X thickness, spanning Z length)
  const contouredStockGeo = (length: number, backH: number, frontH: number, thick: number) => {
    const hl = length / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hl, frontH * 0.45);
    shape.quadraticCurveTo(0, backH * 0.56, hl, backH * 0.48);
    shape.quadraticCurveTo(hl + 0.008, 0, hl, -backH * 0.52);
    shape.quadraticCurveTo(0, -backH * 0.25, -hl, -frontH * 0.45);
    shape.closePath();
    const r = Math.min(0.007, thick * 0.22);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.004, thick - r * 2),
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments: 3,
    });
    geo.translate(0, 0, -Math.max(0.004, thick - r * 2) / 2);
    geo.rotateY(-Math.PI / 2);
    return geo;
  };

  const addCrownedBarrel = (
    radius: number,
    length: number,
    mat: THREE.Material,
    y: number,
    zCenter: number,
    crownMat: THREE.Material = machinedSteel
  ) => {
    addPart(new THREE.CylinderGeometry(radius * 0.94, radius, length, 22), mat, 0, y, zCenter, Math.PI / 2);
    addPart(new THREE.TorusGeometry(radius * 0.96, radius * 0.22, 8, 20), crownMat, 0, y, zCenter - length / 2);
  };

  const addPicatinnyRail = (y: number, zStart: number, length: number, teethCount: number) => {
    addPart(roundedBoxGeo(0.025, 0.011, length, 0.003, 2), anodizedAlloy, 0, y, zStart - length / 2);
    const step = length / teethCount;
    for (let i = 0; i < teethCount; i++) {
      addPart(
        roundedBoxGeo(0.028, 0.007, step * 0.56, 0.002, 2),
        parkerizedSteel,
        0,
        y + 0.006,
        zStart - (i + 0.5) * step
      );
    }
  };

  const addCurvedMag = (mat: THREE.Material, y: number, z: number, height: number, curveOffset: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.027, 0);
    shape.lineTo(0.027, 0);
    shape.quadraticCurveTo(0.032 + curveOffset * 0.55, -height * 0.5, 0.025 + curveOffset, -height);
    shape.lineTo(-0.027 + curveOffset, -height);
    shape.quadraticCurveTo(-0.022 + curveOffset * 0.55, -height * 0.5, -0.027, 0);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.024,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 3,
    });
    geo.translate(0, 0, -0.012);
    geo.rotateY(Math.PI / 2);
    addPart(geo, mat, 0, y, z);
    // Floorplate bumper
    addPart(
      roundedBoxGeo(0.034, 0.012, 0.056, 0.004, 2),
      polymerGrip,
      0,
      y - height - 0.004,
      z + curveOffset
    );
  };

  const addTriggerAssembly = (y: number, z: number) => {
    // Rounded loop trigger guard + curved trigger shoe
    addPart(
      new THREE.TorusGeometry(0.022, 0.004, 8, 18, Math.PI * 1.12),
      polymerGrip,
      0,
      y - 0.012,
      z,
      0,
      Math.PI / 2,
      Math.PI * 0.94
    );
    addPart(
      new THREE.TorusGeometry(0.012, 0.0028, 6, 12, Math.PI * 0.65),
      machinedSteel,
      0,
      y - 0.008,
      z - 0.002,
      0,
      Math.PI / 2,
      -0.4
    );
  };

  switch (safeId) {
    // ==================== CUERPO A CUERPO (9 ARMAS) ====================
    case 'knife_combat': {
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, -0.013);
      bladeShape.lineTo(0.16, -0.015);
      bladeShape.quadraticCurveTo(0.21, -0.004, 0.225, 0.01);
      bladeShape.lineTo(0.18, 0.018);
      bladeShape.lineTo(0, 0.016);
      bladeShape.closePath();
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.005,
        curveSegments: 5,
        bevelEnabled: true,
        bevelThickness: 0.0022,
        bevelSize: 0.0022,
        bevelSegments: 3,
      });
      bladeGeo.translate(0, 0, -0.0025);
      bladeGeo.rotateY(Math.PI / 2);
      addPart(bladeGeo, chromeSteel, 0, 0.08, -0.04, -0.68, 0, 0);
      addPart(roundedBoxGeo(0.018, 0.058, 0.022, 0.005, 3), parkerizedSteel, 0, 0.06, -0.025, -0.68);
      addPart(new THREE.CylinderGeometry(0.015, 0.018, 0.125, 18), polymerGrip, 0, 0.0, 0.025, -0.68);
      for (let g = 0; g < 4; g++) {
        addPart(new THREE.TorusGeometry(0.016, 0.0026, 8, 16), anodizedAlloy, 0, -0.025 + g * 0.02, 0.042 - g * 0.015, Math.PI / 2 - 0.68);
      }
      addPart(new THREE.CylinderGeometry(0.019, 0.016, 0.016, 18), anodizedAlloy, 0, -0.048, 0.065, -0.68);
      muzzleZ = -0.18;
      muzzleY = 0.16;
      break;
    }
    case 'crowbar_tactical': {
      addPart(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 16), parkerizedSteel, 0, 0.12, -0.04, -0.58);
      addPart(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.68 }), 0, -0.02, 0.05, -0.58);
      addPart(new THREE.TorusGeometry(0.038, 0.011, 10, 18, Math.PI * 0.9), chromeSteel, 0, 0.275, -0.15, 0, Math.PI / 2, -0.5);
      addPart(roundedBoxGeo(0.024, 0.026, 0.055, 0.006, 3), chromeSteel, 0, 0.285, -0.185, 0.35);
      addPart(roundedBoxGeo(0.018, 0.048, 0.028, 0.005, 2), chromeSteel, 0, -0.09, 0.1, -0.95);
      muzzleZ = -0.22;
      muzzleY = 0.3;
      break;
    }
    case 'baseball_bat': {
      const batPts = [
        new THREE.Vector2(0.022, 0),
        new THREE.Vector2(0.014, 0.025),
        new THREE.Vector2(0.013, 0.18),
        new THREE.Vector2(0.022, 0.34),
        new THREE.Vector2(0.034, 0.56),
        new THREE.Vector2(0.033, 0.65),
        new THREE.Vector2(0.02, 0.675),
        new THREE.Vector2(0.001, 0.682),
      ];
      const batGeo = new THREE.LatheGeometry(batPts, 24);
      addPart(batGeo, walnutWood, 0, -0.08, 0.02, -0.58);
      addPart(new THREE.CylinderGeometry(0.016, 0.016, 0.17, 18), polymerGrip, 0, -0.01, -0.025, -0.58);
      addPart(new THREE.CylinderGeometry(0.025, 0.024, 0.03, 20), anodizedAlloy, 0, 0.18, -0.15, -0.58);
      for (let s = 0; s < 8; s++) {
        const ang = (s / 8) * Math.PI * 2;
        const hOffset = 0.3 + (s % 3) * 0.085;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.048, 10), chromeSteel);
        spike.position.set(
          Math.cos(ang) * 0.042,
          -0.08 + Math.cos(-0.58) * hOffset,
          0.02 + Math.sin(-0.58) * hOffset + Math.sin(ang) * 0.028
        );
        spike.rotation.z = -ang + Math.PI / 2;
        spike.castShadow = true;
        group.add(spike);
      }
      muzzleZ = -0.36;
      muzzleY = 0.42;
      break;
    }
    case 'machete_apoc': {
      const machShape = new THREE.Shape();
      machShape.moveTo(0, -0.016);
      machShape.lineTo(0.28, -0.02);
      machShape.quadraticCurveTo(0.42, -0.025, 0.46, 0.022);
      machShape.lineTo(0.41, 0.044);
      machShape.quadraticCurveTo(0.22, 0.032, 0, 0.02);
      machShape.closePath();
      const machGeo = new THREE.ExtrudeGeometry(machShape, {
        depth: 0.005,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.0022,
        bevelSize: 0.0022,
        bevelSegments: 3,
      });
      machGeo.translate(0, 0, -0.0025);
      machGeo.rotateY(Math.PI / 2);
      addPart(machGeo, machinedSteel, 0, 0.06, -0.03, -0.58);
      addPart(roundedBoxGeo(0.018, 0.056, 0.024, 0.005, 3), parkerizedSteel, 0, 0.045, -0.018, -0.58);
      addPart(roundedGripGeo(0.026, 0.145, 0.036), walnutWood, 0, -0.02, 0.025, -0.58);
      for (let r = 0; r < 3; r++) {
        addPart(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 10), brassMat, 0, -0.055 + r * 0.035, 0.05 - r * 0.022, 0, 0, Math.PI / 2);
      }
      muzzleZ = -0.3;
      muzzleY = 0.3;
      break;
    }
    case 'fire_axe': {
      addPart(new THREE.CylinderGeometry(0.015, 0.018, 0.62, 18), walnutWood, 0, 0.14, -0.05, -0.55);
      addPart(new THREE.CylinderGeometry(0.019, 0.019, 0.16, 18), polymerGrip, 0, -0.06, 0.08, -0.55);
      const axeRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.55, roughness: 0.35 });
      addPart(roundedBoxGeo(0.026, 0.095, 0.16, 0.008, 3), axeRed, 0, 0.34, -0.22, -0.55);
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, -0.052);
      bladeShape.quadraticCurveTo(0.055, -0.065, 0.062, 0);
      bladeShape.quadraticCurveTo(0.055, 0.065, 0, 0.052);
      bladeShape.closePath();
      const bGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.008, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3 });
      bGeo.translate(0, 0, -0.004);
      bGeo.rotateY(Math.PI / 2);
      addPart(bGeo, chromeSteel, 0, 0.34, -0.275, -0.55);
      addPart(new THREE.ConeGeometry(0.016, 0.085, 12), chromeSteel, 0, 0.34, -0.12, -0.55 + Math.PI / 2);
      muzzleZ = -0.34;
      muzzleY = 0.38;
      break;
    }
    case 'katana_cyber': {
      const katShape = new THREE.Shape();
      katShape.moveTo(0, -0.01);
      katShape.quadraticCurveTo(0.32, -0.016, 0.62, 0.012);
      katShape.lineTo(0.66, 0.028);
      katShape.quadraticCurveTo(0.34, 0.004, 0, 0.014);
      katShape.closePath();
      const katGeo = new THREE.ExtrudeGeometry(katShape, {
        depth: 0.004,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.0018,
        bevelSize: 0.0018,
        bevelSegments: 3,
      });
      katGeo.translate(0, 0, -0.002);
      katGeo.rotateY(Math.PI / 2);
      addPart(katGeo, chromeSteel, 0, 0.08, -0.03, -0.52);
      addPart(new THREE.CylinderGeometry(0.038, 0.038, 0.009, 24), brassMat, 0, 0.075, -0.025, -0.52);
      addPart(new THREE.CylinderGeometry(0.015, 0.017, 0.22, 18), polymerGrip, 0, -0.02, 0.035, -0.52);
      addPart(new THREE.CylinderGeometry(0.018, 0.018, 0.022, 18), energyMat, 0, -0.115, 0.095, -0.52);
      muzzleZ = -0.45;
      muzzleY = 0.4;
      break;
    }
    case 'combat_tomahawk': {
      addPart(new THREE.CylinderGeometry(0.015, 0.017, 0.44, 18), polymerGrip, 0, 0.1, -0.02, -0.58);
      addPart(new THREE.CylinderGeometry(0.019, 0.019, 0.032, 18), anodizedAlloy, 0, 0.25, -0.12, -0.58);
      const headShape = new THREE.Shape();
      headShape.moveTo(0, -0.038);
      headShape.quadraticCurveTo(0.085, -0.058, 0.098, 0);
      headShape.quadraticCurveTo(0.085, 0.058, 0, 0.034);
      headShape.lineTo(-0.075, 0.008);
      headShape.lineTo(-0.075, -0.006);
      headShape.closePath();
      const headGeo = new THREE.ExtrudeGeometry(headShape, { depth: 0.012, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3 });
      headGeo.translate(0, 0, -0.006);
      headGeo.rotateY(Math.PI / 2);
      addPart(headGeo, parkerizedSteel, 0, 0.25, -0.12, -0.58);
      addPart(roundedBoxGeo(0.008, 0.09, 0.024, 0.002, 2), chromeSteel, 0, 0.25, -0.205, -0.58);
      muzzleZ = -0.26;
      muzzleY = 0.32;
      break;
    }
    case 'chainsaw_ripper': {
      const sawRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.45, roughness: 0.38 });
      addPart(roundedBoxGeo(0.11, 0.12, 0.22, 0.018, 4), sawRed, 0, 0.03, -0.04);
      addPart(new THREE.CylinderGeometry(0.045, 0.045, 0.118, 20), anodizedAlloy, 0, 0.03, -0.02, 0, 0, Math.PI / 2);
      // Top loop handle
      addPart(new THREE.TorusGeometry(0.065, 0.011, 10, 20, Math.PI), polymerGrip, 0, 0.09, -0.02, 0, 0, 0);
      addPart(roundedGripGeo(0.036, 0.11, 0.048), polymerGrip, 0, 0.01, 0.11, 0.35);
      // Rounded chain bar + teeth
      const barShape = new THREE.Shape();
      barShape.moveTo(0, -0.042);
      barShape.lineTo(0.36, -0.032);
      barShape.absarc(0.36, 0, 0.032, -Math.PI / 2, Math.PI / 2, false);
      barShape.lineTo(0, 0.042);
      barShape.closePath();
      const barGeo = new THREE.ExtrudeGeometry(barShape, { depth: 0.012, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
      barGeo.translate(0, 0, -0.006);
      barGeo.rotateY(Math.PI / 2);
      addPart(barGeo, machinedSteel, 0, 0.028, -0.14);
      for (let t = 0; t < 10; t++) {
        addPart(roundedBoxGeo(0.016, 0.012, 0.014, 0.003, 2), chromeSteel, 0, 0.072, -0.17 - t * 0.032);
        addPart(roundedBoxGeo(0.016, 0.012, 0.014, 0.003, 2), chromeSteel, 0, -0.016, -0.17 - t * 0.032);
      }
      muzzleZ = -0.54;
      muzzleY = 0.03;
      break;
    }
    case 'energy_blade': {
      // Sci-fi plasma emitter hilt + glowing plasma arc blade
      addPart(new THREE.CylinderGeometry(0.02, 0.022, 0.22, 22), anodizedAlloy, 0, -0.01, 0.03, -0.54);
      addPart(new THREE.CylinderGeometry(0.028, 0.022, 0.045, 22), machinedSteel, 0, 0.08, -0.03, -0.54);
      addPart(new THREE.TorusGeometry(0.028, 0.005, 10, 20), energyMat, 0, 0.092, -0.038, Math.PI / 2 - 0.54);
      const pShape = new THREE.Shape();
      pShape.moveTo(0, -0.012);
      pShape.quadraticCurveTo(0.32, -0.018, 0.64, 0.005);
      pShape.lineTo(0.68, 0.02);
      pShape.quadraticCurveTo(0.34, 0.018, 0, 0.016);
      pShape.closePath();
      const pGeo = new THREE.ExtrudeGeometry(pShape, { depth: 0.008, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3 });
      pGeo.translate(0, 0, -0.004);
      pGeo.rotateY(Math.PI / 2);
      addPart(pGeo, energyMat, 0, 0.098, -0.042, -0.54);
      muzzleZ = -0.46;
      muzzleY = 0.42;
      break;
    }

    // ==================== PISTOLAS (7 ARMAS) ====================
    case 'p9_tactical': {
      isPistol = true;
      addPart(roundedBoxGeo(0.038, 0.038, 0.225, 0.008, 3), parkerizedSteel, 0, 0.044, -0.055);
      addPart(roundedBoxGeo(0.014, 0.014, 0.048, 0.004, 2), machinedSteel, 0.013, 0.046, -0.04);
      addPart(roundedBoxGeo(0.034, 0.026, 0.215, 0.007, 3), polymerGrip, 0, 0.012, -0.05);
      addPart(roundedGripGeo(0.033, 0.115, 0.048), polymerGrip, 0, -0.05, 0.032, 0.22);
      addPart(roundedBoxGeo(0.036, 0.014, 0.054, 0.004, 2), parkerizedSteel, 0, -0.108, 0.044, 0.22);
      addCrownedBarrel(0.011, 0.075, machinedSteel, 0.042, -0.185);
      addPart(roundedBoxGeo(0.007, 0.01, 0.01, 0.002, 2), tritiumMat, 0, 0.066, -0.155);
      addPart(roundedBoxGeo(0.024, 0.01, 0.01, 0.002, 2), parkerizedSteel, 0, 0.066, 0.042);
      addTriggerAssembly(0.008, -0.025);
      muzzleZ = -0.225;
      muzzleY = 0.042;
      opticPos.set(0, 0.068, -0.03);
      underPos.set(0, -0.002, -0.13);
      magAnchor.set(0, -0.095, 0.04);
      break;
    }
    case 'glock18_auto': {
      isPistol = true;
      addPart(roundedBoxGeo(0.035, 0.036, 0.215, 0.007, 3), anodizedAlloy, 0, 0.042, -0.05);
      addPart(roundedBoxGeo(0.018, 0.008, 0.02, 0.003, 2), tritiumMat, 0, 0.062, -0.13);
      addPart(roundedBoxGeo(0.032, 0.024, 0.2, 0.006, 3), polymerGrip, 0, 0.012, -0.045);
      addPart(roundedGripGeo(0.031, 0.115, 0.046), polymerGrip, 0, -0.05, 0.032, 0.22);
      addPart(roundedBoxGeo(0.026, 0.11, 0.038, 0.006, 3), parkerizedSteel, 0, -0.12, 0.054, 0.22);
      addCrownedBarrel(0.01, 0.055, machinedSteel, 0.042, -0.17);
      addTriggerAssembly(0.008, -0.025);
      muzzleZ = -0.21;
      muzzleY = 0.042;
      opticPos.set(0, 0.066, -0.03);
      underPos.set(0, -0.002, -0.12);
      magAnchor.set(0, -0.095, 0.04);
      break;
    }
    case 'usp_silenced': {
      isPistol = true;
      addPart(roundedBoxGeo(0.036, 0.04, 0.22, 0.008, 3), parkerizedSteel, 0, 0.044, -0.055);
      addPart(roundedBoxGeo(0.033, 0.026, 0.21, 0.007, 3), polymerGrip, 0, 0.012, -0.05);
      addPart(roundedGripGeo(0.032, 0.115, 0.048), polymerGrip, 0, -0.05, 0.032, 0.22);
      addPart(roundedBoxGeo(0.016, 0.014, 0.045, 0.003, 2), machinedSteel, 0.013, 0.046, -0.04);
      // Integrated tactical suppressor
      addPart(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 22), anodizedAlloy, 0, 0.042, -0.24, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 22), machinedSteel, 0, 0.042, -0.175, Math.PI / 2);
      addPart(roundedBoxGeo(0.007, 0.013, 0.01, 0.002, 2), tritiumMat, 0, 0.07, -0.145);
      addTriggerAssembly(0.008, -0.025);
      muzzleZ = -0.32;
      muzzleY = 0.042;
      opticPos.set(0, 0.068, -0.03);
      underPos.set(0, -0.002, -0.13);
      magAnchor.set(0, -0.095, 0.04);
      break;
    }
    case 'beretta_93r': {
      isPistol = true;
      addPart(roundedBoxGeo(0.036, 0.036, 0.24, 0.008, 3), parkerizedSteel, 0, 0.044, -0.065);
      addPart(roundedBoxGeo(0.032, 0.024, 0.22, 0.007, 3), anodizedAlloy, 0, 0.014, -0.055);
      addPart(roundedGripGeo(0.032, 0.116, 0.046), polymerGrip, 0, -0.05, 0.032, 0.22);
      addPart(roundedBoxGeo(0.026, 0.075, 0.038, 0.005, 2), parkerizedSteel, 0, -0.11, 0.05, 0.22);
      // Ported compensator barrel extension + folding front grip
      addCrownedBarrel(0.011, 0.08, chromeSteel, 0.044, -0.21);
      addPart(roundedBoxGeo(0.024, 0.022, 0.045, 0.006, 3), machinedSteel, 0, 0.044, -0.225);
      addPart(new THREE.CylinderGeometry(0.01, 0.012, 0.068, 16), polymerGrip, 0, -0.025, -0.145, -0.45);
      addTriggerAssembly(0.008, -0.02);
      muzzleZ = -0.255;
      muzzleY = 0.044;
      opticPos.set(0, 0.068, -0.04);
      underPos.set(0, -0.002, -0.14);
      magAnchor.set(0, -0.095, 0.04);
      break;
    }
    case 'deagle_50': {
      isPistol = true;
      addPart(roundedBoxGeo(0.044, 0.048, 0.27, 0.009, 3), chromeSteel, 0, 0.048, -0.08);
      addPart(roundedBoxGeo(0.04, 0.024, 0.23, 0.007, 3), chromeSteel, 0, 0.014, -0.06);
      addPart(roundedGripGeo(0.036, 0.125, 0.054), polymerGrip, 0, -0.052, 0.032, 0.24);
      addPart(roundedBoxGeo(0.042, 0.024, 0.085, 0.007, 3), parkerizedSteel, 0, 0.052, -0.23);
      addCrownedBarrel(0.014, 0.05, machinedSteel, 0.05, -0.26);
      addPart(roundedBoxGeo(0.018, 0.016, 0.055, 0.004, 2), anodizedAlloy, 0.016, 0.05, -0.05);
      addTriggerAssembly(0.008, -0.025);
      muzzleZ = -0.285;
      muzzleY = 0.05;
      opticPos.set(0, 0.078, -0.09);
      underPos.set(0, -0.002, -0.16);
      magAnchor.set(0, -0.1, 0.04);
      break;
    }
    case 'magnum_357': {
      isPistol = true;
      addPart(roundedBoxGeo(0.032, 0.052, 0.14, 0.008, 3), chromeSteel, 0, 0.03, -0.02);
      addPart(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 22), machinedSteel, 0, 0.042, -0.04, Math.PI / 2);
      for (let c = 0; c < 6; c++) {
        const ang = (c / 6) * Math.PI * 2;
        addPart(new THREE.CylinderGeometry(0.007, 0.007, 0.062, 10), parkerizedSteel, Math.cos(ang) * 0.018, 0.042 + Math.sin(ang) * 0.018, -0.04, Math.PI / 2);
      }
      addPart(roundedBoxGeo(0.024, 0.032, 0.19, 0.007, 3), chromeSteel, 0, 0.048, -0.175);
      addCrownedBarrel(0.011, 0.03, machinedSteel, 0.052, -0.27);
      addPart(roundedGripGeo(0.03, 0.11, 0.046), walnutWood, 0, -0.048, 0.045, 0.34);
      addTriggerAssembly(0.006, -0.01);
      muzzleZ = -0.285;
      muzzleY = 0.052;
      opticPos.set(0, 0.072, -0.08);
      underPos.set(0, 0.02, -0.15);
      magAnchor.set(0, 0.02, -0.04);
      break;
    }
    case 'colt_python': {
      isPistol = true;
      addPart(roundedBoxGeo(0.036, 0.056, 0.15, 0.009, 3), chromeSteel, 0, 0.032, -0.02);
      addPart(new THREE.CylinderGeometry(0.031, 0.031, 0.064, 24), chromeSteel, 0, 0.045, -0.042, Math.PI / 2);
      // Heavy full-underlug ventilated rib barrel
      addPart(roundedBoxGeo(0.026, 0.044, 0.22, 0.008, 3), chromeSteel, 0, 0.046, -0.185);
      for (let v = 0; v < 4; v++) {
        addPart(roundedBoxGeo(0.028, 0.008, 0.022, 0.002, 2), parkerizedSteel, 0, 0.064, -0.12 - v * 0.042);
      }
      addCrownedBarrel(0.013, 0.028, machinedSteel, 0.054, -0.295);
      addPart(roundedGripGeo(0.034, 0.118, 0.048), walnutWood, 0, -0.048, 0.045, 0.32);
      addTriggerAssembly(0.006, -0.01);
      muzzleZ = -0.31;
      muzzleY = 0.054;
      opticPos.set(0, 0.076, -0.09);
      underPos.set(0, 0.015, -0.18);
      magAnchor.set(0, 0.02, -0.04);
      break;
    }

    // ==================== SUBFUSILES (7 ARMAS) ====================
    case 'mp5_alfa': {
      addPart(roundedBoxGeo(0.048, 0.068, 0.34, 0.012, 3), parkerizedSteel, 0, 0.034, -0.04);
      addPart(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 20), parkerizedSteel, 0, 0.064, -0.24, Math.PI / 2);
      addPart(roundedBoxGeo(0.048, 0.054, 0.22, 0.014, 4), polymerGrip, 0, 0.024, -0.27);
      addCrownedBarrel(0.012, 0.12, machinedSteel, 0.04, -0.42);
      addPart(roundedGripGeo(0.034, 0.115, 0.046), polymerGrip, 0, -0.055, 0.05, 0.22);
      addPart(roundedBoxGeo(0.036, 0.014, 0.16, 0.005, 2), machinedSteel, 0, 0.038, 0.18);
      addPart(contouredStockGeo(0.11, 0.098, 0.06, 0.034), polymerGrip, 0, 0.018, 0.27);
      addCurvedMag(parkerizedSteel, -0.005, -0.1, 0.175, -0.045);
      addPart(new THREE.TorusGeometry(0.018, 0.004, 10, 20), parkerizedSteel, 0, 0.078, -0.35);
      addPicatinnyRail(0.072, 0.08, 0.2, 8);
      addTriggerAssembly(-0.004, -0.005);
      muzzleZ = -0.49;
      muzzleY = 0.04;
      opticPos.set(0, 0.084, -0.02);
      underPos.set(0, -0.005, -0.26);
      magAnchor.set(0, -0.01, -0.1);
      break;
    }
    case 'ump_45': {
      addPart(roundedBoxGeo(0.052, 0.076, 0.38, 0.011, 3), polymerGrip, 0, 0.035, -0.06);
      addPart(roundedBoxGeo(0.05, 0.058, 0.2, 0.01, 3), anodizedAlloy, 0, 0.032, -0.28);
      addCrownedBarrel(0.013, 0.11, parkerizedSteel, 0.04, -0.42);
      addPart(roundedGripGeo(0.034, 0.115, 0.048), polymerGrip, 0, -0.055, 0.05, 0.22);
      // Straight heavy .45 stick magazine
      addPart(roundedBoxGeo(0.03, 0.19, 0.048, 0.006, 3), polymerGrip, 0, -0.085, -0.1, 0.06);
      addPart(contouredStockGeo(0.2, 0.092, 0.055, 0.032), polymerGrip, 0, 0.022, 0.21);
      addPicatinnyRail(0.076, 0.08, 0.3, 12);
      addTriggerAssembly(-0.004, -0.005);
      muzzleZ = -0.48;
      muzzleY = 0.04;
      opticPos.set(0, 0.088, -0.04);
      underPos.set(0, -0.004, -0.26);
      magAnchor.set(0, -0.01, -0.1);
      break;
    }
    case 'mp7_viper': {
      addPart(roundedBoxGeo(0.05, 0.075, 0.32, 0.011, 3), anodizedAlloy, 0, 0.035, -0.06);
      addPart(roundedBoxGeo(0.02, 0.018, 0.055, 0.004, 2), machinedSteel, 0.018, 0.042, -0.06);
      addPart(roundedGripGeo(0.036, 0.125, 0.048), polymerGrip, 0, -0.062, 0.02, 0.14);
      addCurvedMag(parkerizedSteel, -0.02, 0.02, 0.15, -0.02);
      addPart(new THREE.CylinderGeometry(0.011, 0.012, 0.08, 16), polymerGrip, 0, -0.045, -0.18, 0.05);
      addPart(new THREE.CylinderGeometry(0.021, 0.021, 0.18, 22), parkerizedSteel, 0, 0.036, -0.305, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.023, 0.023, 0.03, 22), anodizedAlloy, 0, 0.036, -0.23, Math.PI / 2);
      addPart(roundedBoxGeo(0.034, 0.012, 0.13, 0.004, 2), machinedSteel, 0, 0.036, 0.15);
      addPart(roundedBoxGeo(0.032, 0.085, 0.024, 0.006, 3), polymerGrip, 0, 0.015, 0.22);
      addPicatinnyRail(0.076, 0.06, 0.26, 12);
      addTriggerAssembly(0.002, -0.04);
      muzzleZ = -0.4;
      muzzleY = 0.036;
      opticPos.set(0, 0.088, -0.05);
      underPos.set(0, -0.005, -0.18);
      magAnchor.set(0, -0.02, 0.02);
      break;
    }
    case 'p90_spectre': {
      addPart(roundedBoxGeo(0.052, 0.095, 0.38, 0.014, 4), polymerGrip, 0, 0.022, -0.02);
      addPart(roundedBoxGeo(0.046, 0.03, 0.24, 0.008, 3), anodizedAlloy, 0, 0.072, -0.08);
      addCrownedBarrel(0.012, 0.14, parkerizedSteel, 0.04, -0.26);
      addPart(contouredStockGeo(0.14, 0.105, 0.085, 0.048), polymerGrip, 0, 0.01, 0.18);
      addPicatinnyRail(0.094, 0.02, 0.16, 7);
      addTriggerAssembly(-0.006, -0.08);
      muzzleZ = -0.34;
      muzzleY = 0.04;
      opticPos.set(0, 0.106, -0.06);
      underPos.set(0, -0.02, -0.18);
      magAnchor.set(0, 0.07, -0.08);
      break;
    }
    case 'thompson_m1a1': {
      addPart(roundedBoxGeo(0.052, 0.068, 0.34, 0.011, 3), parkerizedSteel, 0, 0.036, -0.04);
      addPart(roundedBoxGeo(0.046, 0.044, 0.2, 0.01, 3), walnutWood, 0, 0.018, -0.28);
      // Finned cooling barrel
      addCrownedBarrel(0.014, 0.26, parkerizedSteel, 0.044, -0.34);
      for (let f = 0; f < 6; f++) {
        addPart(new THREE.CylinderGeometry(0.019, 0.019, 0.008, 18), anodizedAlloy, 0, 0.044, -0.24 - f * 0.022, Math.PI / 2);
      }
      // Classic 50-rd drum mag
      addPart(new THREE.CylinderGeometry(0.074, 0.074, 0.052, 24), parkerizedSteel, 0, -0.058, -0.12, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.028, 0.028, 0.058, 18), machinedSteel, 0, -0.058, -0.12, Math.PI / 2);
      addPart(roundedGripGeo(0.034, 0.115, 0.046), walnutWood, 0, -0.052, 0.06, 0.26);
      addPart(contouredStockGeo(0.24, 0.105, 0.058, 0.042), walnutWood, 0, 0.002, 0.23, 0.08);
      addPicatinnyRail(0.074, 0.05, 0.16, 6);
      addTriggerAssembly(-0.005, 0.0);
      muzzleZ = -0.48;
      muzzleY = 0.044;
      opticPos.set(0, 0.086, -0.04);
      underPos.set(0, -0.008, -0.28);
      magAnchor.set(0, -0.06, -0.12);
      break;
    }
    case 'bizon_pp19': {
      addPart(roundedBoxGeo(0.05, 0.07, 0.34, 0.011, 3), parkerizedSteel, 0, 0.034, -0.04);
      addPart(roundedBoxGeo(0.048, 0.042, 0.2, 0.01, 3), anodizedAlloy, 0, 0.038, -0.28);
      // Signature underbarrel helical cylindrical 64-rd magazine
      addPart(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 24), polymerGrip, 0, -0.016, -0.23, Math.PI / 2);
      addPart(new THREE.TorusGeometry(0.033, 0.004, 8, 22), machinedSteel, 0, -0.016, -0.34);
      addPart(new THREE.TorusGeometry(0.033, 0.004, 8, 22), machinedSteel, 0, -0.016, -0.14);
      addCrownedBarrel(0.013, 0.16, parkerizedSteel, 0.042, -0.43);
      addPart(roundedGripGeo(0.034, 0.115, 0.046), polymerGrip, 0, -0.055, 0.06, 0.24);
      addPart(contouredStockGeo(0.22, 0.09, 0.052, 0.03), parkerizedSteel, 0, 0.022, 0.23);
      addPicatinnyRail(0.074, 0.06, 0.2, 8);
      addTriggerAssembly(-0.006, 0.0);
      muzzleZ = -0.52;
      muzzleY = 0.042;
      opticPos.set(0, 0.086, -0.03);
      underPos.set(0, -0.048, -0.26);
      magAnchor.set(0, -0.016, -0.22);
      break;
    }
    case 'vector_45': {
      addPart(roundedBoxGeo(0.05, 0.08, 0.32, 0.011, 3), anodizedAlloy, 0, 0.038, -0.08);
      addPart(roundedBoxGeo(0.046, 0.095, 0.11, 0.01, 3), parkerizedSteel, 0, -0.028, -0.15);
      addPart(roundedBoxGeo(0.032, 0.15, 0.042, 0.006, 3), polymerGrip, 0, -0.09, -0.13, 0.25);
      addPart(roundedGripGeo(0.034, 0.11, 0.046), polymerGrip, 0, -0.048, 0.04, 0.22);
      addCrownedBarrel(0.012, 0.14, parkerizedSteel, 0.042, -0.3);
      addPart(contouredStockGeo(0.18, 0.082, 0.054, 0.036), anodizedAlloy, 0, 0.025, 0.18);
      addPicatinnyRail(0.084, 0.06, 0.28, 12);
      addTriggerAssembly(-0.002, -0.01);
      muzzleZ = -0.38;
      muzzleY = 0.042;
      opticPos.set(0, 0.096, -0.06);
      underPos.set(0, -0.025, -0.22);
      magAnchor.set(0, -0.08, -0.13);
      break;
    }

    // ==================== RIFLES DE ASALTO (8 ARMAS) ====================
    case 'm4_centinela': {
      addPart(roundedBoxGeo(0.052, 0.072, 0.32, 0.011, 3), anodizedAlloy, 0, 0.032, -0.04);
      addPart(roundedBoxGeo(0.022, 0.018, 0.065, 0.004, 2), machinedSteel, 0.02, 0.042, -0.04);
      addPart(roundedBoxGeo(0.018, 0.018, 0.035, 0.004, 2), parkerizedSteel, 0, 0.052, 0.125);
      addPart(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 22), parkerizedSteel, 0, 0.038, -0.34, Math.PI / 2);
      addCrownedBarrel(0.0125, 0.25, parkerizedSteel, 0.04, -0.58);
      addPart(new THREE.CylinderGeometry(0.016, 0.014, 0.045, 18), machinedSteel, 0, 0.04, -0.71, Math.PI / 2);
      addPart(roundedBoxGeo(0.022, 0.048, 0.032, 0.005, 2), parkerizedSteel, 0, 0.058, -0.49);
      addPart(roundedGripGeo(0.034, 0.12, 0.048), polymerGrip, 0, -0.06, 0.06, 0.24);
      addCurvedMag(anodizedAlloy, -0.005, -0.1, 0.16, -0.035);
      addPart(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 20), anodizedAlloy, 0, 0.038, 0.21, Math.PI / 2);
      addPart(contouredStockGeo(0.16, 0.105, 0.06, 0.044), polymerGrip, 0, 0.018, 0.29);
      addPicatinnyRail(0.072, 0.1, 0.56, 22);
      addTriggerAssembly(-0.004, 0.0);
      muzzleZ = -0.74;
      muzzleY = 0.04;
      opticPos.set(0, 0.084, -0.04);
      underPos.set(0, 0.005, -0.34);
      magAnchor.set(0, -0.005, -0.1);
      break;
    }
    case 'famas_burst': {
      addPart(roundedBoxGeo(0.052, 0.072, 0.48, 0.012, 3), parkerizedSteel, 0, 0.025, -0.02);
      addPart(roundedBoxGeo(0.036, 0.035, 0.28, 0.008, 3), anodizedAlloy, 0, 0.084, -0.08);
      addPart(roundedBoxGeo(0.024, 0.04, 0.03, 0.005, 2), anodizedAlloy, 0, 0.062, 0.04);
      addPart(roundedBoxGeo(0.024, 0.04, 0.03, 0.005, 2), anodizedAlloy, 0, 0.062, -0.2);
      addCrownedBarrel(0.0125, 0.24, parkerizedSteel, 0.04, -0.36);
      addPart(roundedGripGeo(0.034, 0.115, 0.048), polymerGrip, 0, -0.052, -0.06, 0.22);
      addPart(roundedBoxGeo(0.034, 0.14, 0.062, 0.006, 3), parkerizedSteel, 0, -0.04, 0.11);
      addPicatinnyRail(0.106, 0.04, 0.24, 10);
      addTriggerAssembly(-0.004, -0.1);
      muzzleZ = -0.49;
      muzzleY = 0.04;
      opticPos.set(0, 0.116, -0.08);
      underPos.set(0, -0.012, -0.24);
      magAnchor.set(0, -0.04, 0.11);
      break;
    }
    case 'aug_a3': {
      addPart(roundedBoxGeo(0.054, 0.086, 0.52, 0.014, 4), olivePolymer, 0, 0.026, 0.02);
      addPart(roundedBoxGeo(0.046, 0.04, 0.24, 0.009, 3), anodizedAlloy, 0, 0.072, -0.1);
      addCrownedBarrel(0.013, 0.34, parkerizedSteel, 0.044, -0.38);
      addPart(new THREE.CylinderGeometry(0.012, 0.012, 0.085, 16), polymerGrip, 0, -0.038, -0.28, 0.18);
      addPart(roundedGripGeo(0.034, 0.115, 0.046), polymerGrip, 0, -0.05, -0.05, 0.22);
      addCurvedMag(anodizedAlloy, -0.02, 0.14, 0.155, -0.025);
      addPicatinnyRail(0.095, 0.02, 0.24, 10);
      addTriggerAssembly(-0.006, -0.09);
      muzzleZ = -0.56;
      muzzleY = 0.044;
      opticPos.set(0, 0.106, -0.1);
      underPos.set(0, -0.01, -0.28);
      magAnchor.set(0, -0.02, 0.14);
      break;
    }
    case 'ak_furia': {
      addPart(roundedBoxGeo(0.052, 0.074, 0.34, 0.011, 3), parkerizedSteel, 0, 0.03, -0.05);
      addPart(roundedBoxGeo(0.02, 0.022, 0.09, 0.005, 2), machinedSteel, 0.02, 0.038, -0.06);
      addPart(roundedBoxGeo(0.052, 0.054, 0.24, 0.013, 4), walnutWood, 0, 0.028, -0.34);
      addPart(new THREE.CylinderGeometry(0.013, 0.013, 0.18, 18), parkerizedSteel, 0, 0.062, -0.34, Math.PI / 2);
      addCrownedBarrel(0.0135, 0.26, parkerizedSteel, 0.036, -0.57);
      addPart(new THREE.CylinderGeometry(0.017, 0.014, 0.045, 16), machinedSteel, 0, 0.036, -0.71, Math.PI / 2);
      addPart(roundedBoxGeo(0.016, 0.045, 0.02, 0.004, 2), parkerizedSteel, 0, 0.065, -0.64);
      addPart(roundedGripGeo(0.034, 0.12, 0.046), walnutWood, 0, -0.062, 0.06, 0.25);
      addPart(contouredStockGeo(0.26, 0.105, 0.058, 0.044), walnutWood, 0, 0.005, 0.25, 0.08);
      addPart(roundedBoxGeo(0.046, 0.105, 0.015, 0.005, 2), parkerizedSteel, 0, -0.005, 0.38, 0.08);
      addCurvedMag(new THREE.MeshStandardMaterial({ color: 0x6f3622, roughness: 0.48, metalness: 0.2 }), -0.005, -0.11, 0.2, -0.065);
      addPicatinnyRail(0.072, 0.06, 0.2, 8);
      addTriggerAssembly(-0.006, 0.005);
      muzzleZ = -0.74;
      muzzleY = 0.036;
      opticPos.set(0, 0.084, -0.04);
      underPos.set(0, -0.002, -0.34);
      magAnchor.set(0, -0.005, -0.11);
      break;
    }
    case 'g36_tactico': {
      addPart(roundedBoxGeo(0.054, 0.078, 0.44, 0.011, 3), anodizedAlloy, 0, 0.032, -0.08);
      addPart(roundedBoxGeo(0.034, 0.032, 0.26, 0.008, 3), parkerizedSteel, 0, 0.088, -0.06);
      addCrownedBarrel(0.013, 0.22, parkerizedSteel, 0.04, -0.4);
      addPart(roundedGripGeo(0.034, 0.115, 0.048), polymerGrip, 0, -0.055, 0.05, 0.22);
      addCurvedMag(anodizedAlloy, -0.005, -0.1, 0.165, -0.035);
      addPart(contouredStockGeo(0.22, 0.088, 0.056, 0.036), polymerGrip, 0, 0.02, 0.24);
      addPicatinnyRail(0.108, 0.06, 0.24, 10);
      addTriggerAssembly(-0.004, 0.0);
      muzzleZ = -0.52;
      muzzleY = 0.04;
      opticPos.set(0, 0.118, -0.06);
      underPos.set(0, -0.008, -0.26);
      magAnchor.set(0, -0.005, -0.1);
      break;
    }
    case 'hk416_delta': {
      addPart(roundedBoxGeo(0.054, 0.076, 0.34, 0.012, 3), anodizedAlloy, 0, 0.034, -0.04);
      addPart(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 22), fdePolymer, 0, 0.04, -0.35, Math.PI / 2);
      addCrownedBarrel(0.013, 0.26, chromeSteel, 0.04, -0.59);
      addPart(new THREE.CylinderGeometry(0.018, 0.015, 0.048, 20), machinedSteel, 0, 0.04, -0.73, Math.PI / 2);
      addPart(roundedGripGeo(0.035, 0.12, 0.048), polymerGrip, 0, -0.06, 0.06, 0.24);
      addCurvedMag(fdePolymer, -0.005, -0.1, 0.165, -0.035);
      addPart(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 20), anodizedAlloy, 0, 0.038, 0.21, Math.PI / 2);
      addPart(contouredStockGeo(0.18, 0.108, 0.062, 0.046), fdePolymer, 0, 0.02, 0.29);
      addPicatinnyRail(0.076, 0.1, 0.56, 22);
      addTriggerAssembly(-0.004, 0.0);
      muzzleZ = -0.76;
      muzzleY = 0.04;
      opticPos.set(0, 0.088, -0.04);
      underPos.set(0, 0.004, -0.34);
      magAnchor.set(0, -0.005, -0.1);
      break;
    }
    case 'scar_pesado': {
      addPart(roundedBoxGeo(0.058, 0.082, 0.42, 0.012, 3), fdePolymer, 0, 0.036, -0.1);
      addPart(roundedBoxGeo(0.054, 0.035, 0.3, 0.009, 3), anodizedAlloy, 0, -0.01, -0.05);
      addPart(roundedBoxGeo(0.022, 0.016, 0.06, 0.004, 2), machinedSteel, 0.024, 0.044, -0.14);
      addCrownedBarrel(0.015, 0.26, parkerizedSteel, 0.042, -0.44);
      addPart(roundedBoxGeo(0.028, 0.026, 0.05, 0.007, 3), machinedSteel, 0, 0.042, -0.58);
      addPart(roundedGripGeo(0.034, 0.118, 0.048), polymerGrip, 0, -0.06, 0.06, 0.22);
      addPart(roundedBoxGeo(0.042, 0.095, 0.16, 0.007, 3), fdePolymer, 0, -0.025, -0.08);
      addPart(contouredStockGeo(0.24, 0.112, 0.066, 0.048), fdePolymer, 0, 0.02, 0.23);
      addPart(roundedBoxGeo(0.048, 0.035, 0.12, 0.009, 3), polymerGrip, 0, 0.072, 0.22);
      addPicatinnyRail(0.082, 0.1, 0.44, 18);
      addTriggerAssembly(-0.008, 0.0);
      muzzleZ = -0.61;
      muzzleY = 0.042;
      opticPos.set(0, 0.094, -0.08);
      underPos.set(0, -0.008, -0.26);
      magAnchor.set(0, -0.015, -0.08);
      break;
    }
    case 'fal_battle': {
      addPart(roundedBoxGeo(0.052, 0.074, 0.38, 0.011, 3), parkerizedSteel, 0, 0.034, -0.05);
      addPart(roundedBoxGeo(0.046, 0.052, 0.28, 0.013, 4), walnutWood, 0, 0.028, -0.36);
      addCrownedBarrel(0.014, 0.32, parkerizedSteel, 0.044, -0.64);
      addPart(new THREE.CylinderGeometry(0.017, 0.015, 0.055, 18), machinedSteel, 0, 0.044, -0.81, Math.PI / 2);
      addPart(roundedBoxGeo(0.036, 0.115, 0.068, 0.006, 3), parkerizedSteel, 0, -0.045, -0.1);
      addPart(roundedGripGeo(0.034, 0.118, 0.048), polymerGrip, 0, -0.058, 0.07, 0.24);
      addPart(contouredStockGeo(0.26, 0.106, 0.058, 0.044), walnutWood, 0, 0.008, 0.26, 0.08);
      addPicatinnyRail(0.076, 0.08, 0.28, 12);
      addTriggerAssembly(-0.006, 0.01);
      muzzleZ = -0.84;
      muzzleY = 0.044;
      opticPos.set(0, 0.088, -0.04);
      underPos.set(0, -0.005, -0.36);
      magAnchor.set(0, -0.04, -0.1);
      break;
    }

    // ==================== ESCOPETAS (7 ARMAS) ====================
    case 'sawed_off': {
      addPart(roundedBoxGeo(0.062, 0.064, 0.16, 0.012, 3), parkerizedSteel, 0, 0.03, -0.02);
      addCrownedBarrel(0.0155, 0.34, anodizedAlloy, 0.048, -0.25);
      // Offset side-by-side barrels
      addPart(new THREE.CylinderGeometry(0.015, 0.016, 0.34, 20), anodizedAlloy, -0.016, 0.048, -0.25, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.015, 0.016, 0.34, 20), anodizedAlloy, 0.016, 0.048, -0.25, Math.PI / 2);
      addPart(roundedBoxGeo(0.056, 0.044, 0.14, 0.012, 4), walnutWood, 0, 0.014, -0.18);
      addPart(roundedGripGeo(0.042, 0.11, 0.11), walnutWood, 0, -0.03, 0.1, 0.45);
      addTriggerAssembly(-0.006, 0.02);
      muzzleZ = -0.43;
      muzzleY = 0.048;
      opticPos.set(0, 0.072, -0.06);
      underPos.set(0, -0.01, -0.18);
      magAnchor.set(0, 0.0, -0.14);
      break;
    }
    case 'remington_870': {
      addPart(roundedBoxGeo(0.058, 0.082, 0.34, 0.013, 3), parkerizedSteel, 0, 0.032, -0.03);
      addPart(roundedBoxGeo(0.02, 0.02, 0.06, 0.004, 2), machinedSteel, 0.022, 0.042, -0.05);
      addCrownedBarrel(0.0175, 0.56, parkerizedSteel, 0.054, -0.48);
      addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.48, 20), parkerizedSteel, 0, 0.018, -0.44, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 22), walnutWood, 0, 0.016, -0.36, Math.PI / 2);
      addPart(contouredStockGeo(0.32, 0.105, 0.055, 0.045), walnutWood, 0, -0.015, 0.26, 0.14);
      addPart(roundedBoxGeo(0.048, 0.11, 0.025, 0.007, 3), polymerGrip, 0, -0.04, 0.42, 0.14);
      addPicatinnyRail(0.078, 0.08, 0.18, 7);
      addTriggerAssembly(-0.008, 0.03);
      muzzleZ = -0.77;
      muzzleY = 0.054;
      opticPos.set(0, 0.088, -0.02);
      underPos.set(0, -0.01, -0.36);
      magAnchor.set(0, 0.0, -0.25);
      break;
    }
    case 'spas12': {
      addPart(roundedBoxGeo(0.06, 0.088, 0.38, 0.013, 3), anodizedAlloy, 0, 0.032, -0.05);
      addPart(roundedBoxGeo(0.02, 0.022, 0.06, 0.004, 2), machinedSteel, 0.024, 0.038, -0.08);
      addCrownedBarrel(0.0185, 0.5, parkerizedSteel, 0.056, -0.48);
      addPart(new THREE.CylinderGeometry(0.015, 0.015, 0.46, 20), anodizedAlloy, 0, 0.018, -0.46, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 22), polymerGrip, 0, 0.014, -0.37, Math.PI / 2);
      addPart(roundedBoxGeo(0.058, 0.024, 0.34, 0.008, 3), parkerizedSteel, 0, 0.082, -0.22);
      addPart(roundedGripGeo(0.036, 0.115, 0.05), polymerGrip, 0, -0.06, 0.07, 0.24);
      addPart(contouredStockGeo(0.24, 0.095, 0.056, 0.04), parkerizedSteel, 0, 0.025, 0.25, 0.05);
      addPart(roundedBoxGeo(0.046, 0.11, 0.03, 0.008, 3), polymerGrip, 0, 0.01, 0.37);
      addPicatinnyRail(0.096, 0.06, 0.2, 8);
      addTriggerAssembly(-0.005, 0.01);
      muzzleZ = -0.74;
      muzzleY = 0.056;
      opticPos.set(0, 0.108, -0.05);
      underPos.set(0, -0.015, -0.37);
      magAnchor.set(0, 0.0, -0.26);
      break;
    }
    case 'benelli_m4': {
      addPart(roundedBoxGeo(0.058, 0.084, 0.36, 0.013, 3), anodizedAlloy, 0, 0.034, -0.04);
      addCrownedBarrel(0.018, 0.54, parkerizedSteel, 0.055, -0.49);
      addPart(new THREE.CylinderGeometry(0.0145, 0.0145, 0.48, 20), machinedSteel, 0, 0.018, -0.46, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 22), polymerGrip, 0, 0.018, -0.35, Math.PI / 2);
      addPart(roundedGripGeo(0.035, 0.115, 0.048), polymerGrip, 0, -0.058, 0.07, 0.22);
      addPart(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 18), parkerizedSteel, 0, 0.032, 0.22, Math.PI / 2);
      addPart(contouredStockGeo(0.18, 0.106, 0.06, 0.042), polymerGrip, 0, 0.016, 0.31);
      addPicatinnyRail(0.08, 0.06, 0.22, 9);
      addTriggerAssembly(-0.006, 0.02);
      muzzleZ = -0.77;
      muzzleY = 0.055;
      opticPos.set(0, 0.092, -0.03);
      underPos.set(0, -0.008, -0.35);
      magAnchor.set(0, 0.0, -0.26);
      break;
    }
    case 'ksg_bullpup': {
      addPart(roundedBoxGeo(0.062, 0.105, 0.46, 0.015, 4), polymerGrip, 0, 0.028, -0.06);
      addCrownedBarrel(0.017, 0.32, parkerizedSteel, 0.056, -0.34);
      // Signature dual bottom mag tubes
      addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 18), machinedSteel, -0.016, 0.012, -0.3, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.38, 18), machinedSteel, 0.016, 0.012, -0.3, Math.PI / 2);
      addPart(roundedBoxGeo(0.056, 0.042, 0.18, 0.012, 3), anodizedAlloy, 0, 0.006, -0.32);
      addPart(roundedGripGeo(0.035, 0.112, 0.048), polymerGrip, 0, -0.054, -0.04, 0.22);
      addPicatinnyRail(0.084, 0.08, 0.36, 15);
      addTriggerAssembly(-0.006, -0.09);
      muzzleZ = -0.51;
      muzzleY = 0.056;
      opticPos.set(0, 0.096, -0.08);
      underPos.set(0, -0.014, -0.32);
      magAnchor.set(0, -0.01, 0.08);
      break;
    }
    case 'aa12_auto': {
      addPart(roundedBoxGeo(0.072, 0.105, 0.48, 0.016, 4), anodizedAlloy, 0, 0.038, -0.04);
      addPart(roundedBoxGeo(0.066, 0.068, 0.24, 0.014, 3), parkerizedSteel, 0, 0.04, -0.34);
      addCrownedBarrel(0.019, 0.2, machinedSteel, 0.046, -0.52);
      addPart(new THREE.CylinderGeometry(0.088, 0.088, 0.068, 24), parkerizedSteel, 0, -0.085, -0.12, Math.PI / 2);
      addPart(roundedGripGeo(0.036, 0.115, 0.048), polymerGrip, 0, -0.055, 0.08, 0.22);
      addPart(contouredStockGeo(0.22, 0.108, 0.075, 0.056), anodizedAlloy, 0, 0.02, 0.27);
      addPicatinnyRail(0.095, 0.08, 0.34, 14);
      addTriggerAssembly(-0.004, 0.01);
      muzzleZ = -0.63;
      muzzleY = 0.046;
      opticPos.set(0, 0.108, -0.05);
      underPos.set(0, -0.002, -0.32);
      magAnchor.set(0, -0.08, -0.12);
      break;
    }
    case 'origin_12': {
      addPart(roundedBoxGeo(0.064, 0.092, 0.42, 0.013, 3), parkerizedSteel, 0, 0.036, -0.05);
      addPart(roundedBoxGeo(0.056, 0.066, 0.26, 0.014, 3), anodizedAlloy, 0, 0.042, -0.34);
      addCrownedBarrel(0.019, 0.18, machinedSteel, 0.046, -0.54);
      addPart(roundedBoxGeo(0.048, 0.036, 0.06, 0.008, 3), chromeSteel, 0, 0.046, -0.63);
      // Giant 25-round shotgun drum
      addPart(new THREE.CylinderGeometry(0.098, 0.098, 0.074, 26), anodizedAlloy, 0, -0.095, -0.14, Math.PI / 2);
      addPart(roundedGripGeo(0.036, 0.115, 0.048), polymerGrip, 0, -0.058, 0.07, 0.22);
      addPart(contouredStockGeo(0.2, 0.106, 0.065, 0.044), polymerGrip, 0, 0.02, 0.26);
      addPicatinnyRail(0.088, 0.08, 0.36, 15);
      addTriggerAssembly(-0.004, 0.0);
      muzzleZ = -0.67;
      muzzleY = 0.046;
      opticPos.set(0, 0.1, -0.04);
      underPos.set(0, -0.002, -0.34);
      magAnchor.set(0, -0.09, -0.14);
      break;
    }

    // ==================== FRANCOTIRADORES (7 ARMAS) ====================
    case 'kar98k_classic': {
      addPart(roundedBoxGeo(0.05, 0.064, 0.56, 0.015, 4), walnutWood, 0, 0.018, -0.12);
      addPart(contouredStockGeo(0.3, 0.104, 0.054, 0.044), walnutWood, 0, 0.004, 0.27, 0.09);
      addPart(new THREE.CylinderGeometry(0.017, 0.017, 0.22, 22), parkerizedSteel, 0, 0.052, -0.02, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.007, 0.007, 0.042, 12), machinedSteel, 0.028, 0.052, 0.03, 0, 0, Math.PI / 2);
      addCrownedBarrel(0.013, 0.62, parkerizedSteel, 0.05, -0.46);
      addPicatinnyRail(0.074, 0.05, 0.2, 8);
      addTriggerAssembly(-0.008, 0.05);
      muzzleZ = -0.78;
      muzzleY = 0.05;
      opticPos.set(0, 0.084, -0.04);
      underPos.set(0, -0.01, -0.34);
      magAnchor.set(0, -0.02, -0.08);
      break;
    }
    case 'm24_cazador': {
      addPart(roundedBoxGeo(0.052, 0.068, 0.52, 0.014, 4), walnutWood, 0, 0.02, -0.1);
      addPart(contouredStockGeo(0.28, 0.098, 0.054, 0.044), walnutWood, 0, 0.008, 0.27, 0.06);
      addPart(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 22), parkerizedSteel, 0, 0.056, -0.02, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.007, 0.007, 0.042, 12), machinedSteel, 0.03, 0.056, 0.03, 0, 0, Math.PI / 2);
      addCrownedBarrel(0.015, 0.58, parkerizedSteel, 0.054, -0.44);
      addPicatinnyRail(0.078, 0.06, 0.22, 10);
      addTriggerAssembly(-0.008, 0.05);
      muzzleZ = -0.74;
      muzzleY = 0.054;
      opticPos.set(0, 0.09, -0.04);
      underPos.set(0, -0.01, -0.32);
      magAnchor.set(0, -0.02, -0.08);
      break;
    }
    case 'svd_dragunov': {
      addPart(roundedBoxGeo(0.048, 0.07, 0.36, 0.011, 3), parkerizedSteel, 0, 0.034, -0.06);
      addPart(roundedBoxGeo(0.044, 0.05, 0.26, 0.012, 4), walnutWood, 0, 0.026, -0.34);
      addCrownedBarrel(0.014, 0.46, parkerizedSteel, 0.044, -0.66);
      addPart(new THREE.CylinderGeometry(0.017, 0.014, 0.065, 18), machinedSteel, 0, 0.044, -0.91, Math.PI / 2);
      addPart(contouredStockGeo(0.28, 0.098, 0.056, 0.04), walnutWood, 0, 0.012, 0.26);
      addCurvedMag(parkerizedSteel, -0.01, -0.1, 0.12, -0.03);
      addPicatinnyRail(0.074, 0.06, 0.22, 10);
      addTriggerAssembly(-0.006, 0.02);
      muzzleZ = -0.95;
      muzzleY = 0.044;
      opticPos.set(0, 0.086, -0.05);
      underPos.set(0, -0.005, -0.34);
      magAnchor.set(0, -0.01, -0.1);
      break;
    }
    case 'mk14_ebr': {
      addPart(roundedBoxGeo(0.054, 0.074, 0.46, 0.011, 3), anodizedAlloy, 0, 0.03, -0.08);
      addPart(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 20), fdePolymer, 0, 0.042, -0.38, Math.PI / 2);
      addCrownedBarrel(0.015, 0.42, parkerizedSteel, 0.048, -0.68);
      addPart(roundedBoxGeo(0.038, 0.105, 0.078, 0.007, 3), parkerizedSteel, 0, -0.048, -0.1);
      addPart(roundedGripGeo(0.034, 0.115, 0.046), polymerGrip, 0, -0.058, 0.08, 0.22);
      addPart(contouredStockGeo(0.24, 0.102, 0.052, 0.038), anodizedAlloy, 0, 0.02, 0.26);
      addPicatinnyRail(0.078, 0.08, 0.44, 18);
      addTriggerAssembly(-0.006, 0.02);
      muzzleZ = -0.91;
      muzzleY = 0.048;
      opticPos.set(0, 0.09, -0.04);
      underPos.set(0, -0.008, -0.38);
      magAnchor.set(0, -0.04, -0.1);
      break;
    }
    case 'awp_espectro': {
      addPart(roundedBoxGeo(0.056, 0.078, 0.46, 0.014, 4), olivePolymer, 0, 0.022, -0.04);
      addPart(contouredStockGeo(0.26, 0.096, 0.058, 0.046), olivePolymer, 0, 0.012, 0.31);
      addPart(roundedBoxGeo(0.048, 0.038, 0.12, 0.01, 3), polymerGrip, 0, 0.068, 0.3);
      addPart(roundedGripGeo(0.032, 0.1, 0.044), olivePolymer, 0, -0.055, 0.14, 0.18);
      addCrownedBarrel(0.018, 0.68, parkerizedSteel, 0.052, -0.58);
      addPart(roundedBoxGeo(0.044, 0.038, 0.085, 0.008, 3), machinedSteel, 0, 0.052, -0.94);
      addPart(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 12), machinedSteel, 0.035, 0.052, -0.02, 0, 0, Math.PI / 2);
      addPart(roundedBoxGeo(0.038, 0.1, 0.095, 0.006, 3), parkerizedSteel, 0, -0.055, -0.1);
      addPart(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 12), anodizedAlloy, -0.035, -0.01, -0.34, Math.PI / 2.2);
      addPart(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 12), anodizedAlloy, 0.035, -0.01, -0.34, Math.PI / 2.2);
      addPicatinnyRail(0.066, 0.08, 0.26, 12);
      addTriggerAssembly(-0.01, 0.07);
      muzzleZ = -0.99;
      muzzleY = 0.052;
      opticPos.set(0, 0.082, -0.05);
      underPos.set(0, -0.012, -0.26);
      magAnchor.set(0, -0.045, -0.1);
      break;
    }
    case 'barrett_50': {
      addPart(roundedBoxGeo(0.074, 0.1, 0.56, 0.014, 3), anodizedAlloy, 0, 0.042, -0.06);
      addCrownedBarrel(0.022, 0.62, parkerizedSteel, 0.056, -0.62);
      addPart(roundedBoxGeo(0.068, 0.044, 0.11, 0.009, 3), machinedSteel, 0, 0.056, -0.96);
      addPart(roundedBoxGeo(0.044, 0.115, 0.135, 0.007, 3), parkerizedSteel, 0, -0.065, -0.14);
      addPart(roundedGripGeo(0.036, 0.115, 0.048), polymerGrip, 0, -0.058, 0.08, 0.22);
      addPart(contouredStockGeo(0.24, 0.11, 0.075, 0.062), anodizedAlloy, 0, 0.03, 0.32);
      addPicatinnyRail(0.098, 0.1, 0.44, 18);
      addTriggerAssembly(-0.01, 0.01);
      muzzleZ = -1.03;
      muzzleY = 0.056;
      opticPos.set(0, 0.11, -0.06);
      underPos.set(0, -0.01, -0.36);
      magAnchor.set(0, -0.06, -0.14);
      break;
    }
    case 'cheytac_m200': {
      addPart(roundedBoxGeo(0.064, 0.086, 0.48, 0.013, 3), fdePolymer, 0, 0.038, -0.05);
      addPart(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 22), parkerizedSteel, 0, 0.054, -0.38, Math.PI / 2);
      addCrownedBarrel(0.019, 0.68, chromeSteel, 0.054, -0.72);
      addPart(new THREE.CylinderGeometry(0.028, 0.024, 0.09, 20), machinedSteel, 0, 0.054, -1.08, Math.PI / 2);
      addPart(roundedBoxGeo(0.042, 0.115, 0.115, 0.007, 3), parkerizedSteel, 0, -0.06, -0.12);
      addPart(roundedGripGeo(0.035, 0.115, 0.048), polymerGrip, 0, -0.058, 0.08, 0.22);
      // Collapsible twin-rodIntervention stock
      addPart(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 14), machinedSteel, -0.02, 0.042, 0.28, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 14), machinedSteel, 0.02, 0.042, 0.28, Math.PI / 2);
      addPart(roundedBoxGeo(0.052, 0.105, 0.035, 0.009, 3), polymerGrip, 0, 0.018, 0.41);
      addPicatinnyRail(0.088, 0.08, 0.38, 16);
      addTriggerAssembly(-0.008, 0.01);
      muzzleZ = -1.14;
      muzzleY = 0.054;
      opticPos.set(0, 0.1, -0.05);
      underPos.set(0, -0.01, -0.38);
      magAnchor.set(0, -0.06, -0.12);
      break;
    }

    // ==================== PESADAS Y ESPECIALES (9 ARMAS) ====================
    case 'crossbow_apoc': {
      addPart(roundedBoxGeo(0.044, 0.064, 0.54, 0.011, 3), anodizedAlloy, 0, 0.026, -0.12);
      addPart(roundedBoxGeo(0.46, 0.02, 0.045, 0.006, 2), parkerizedSteel, 0, 0.04, -0.38);
      addPart(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 18), machinedSteel, -0.22, 0.04, -0.38);
      addPart(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 18), machinedSteel, 0.22, 0.04, -0.38);
      addPart(new THREE.CylinderGeometry(0.0025, 0.0025, 0.46, 8), energyMat, 0, 0.04, -0.22, 0, 0, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 10), chromeSteel, 0, 0.056, -0.24, Math.PI / 2);
      addPart(roundedGripGeo(0.034, 0.11, 0.046), polymerGrip, 0, -0.052, 0.06, 0.24);
      addPart(contouredStockGeo(0.22, 0.095, 0.056, 0.04), polymerGrip, 0, 0.014, 0.24);
      addPicatinnyRail(0.064, 0.04, 0.2, 8);
      addTriggerAssembly(-0.008, 0.0);
      muzzleZ = -0.46;
      muzzleY = 0.056;
      opticPos.set(0, 0.076, -0.04);
      underPos.set(0, -0.01, -0.25);
      magAnchor.set(0, 0.0, -0.15);
      break;
    }
    case 'rpk_heavy': {
      addPart(roundedBoxGeo(0.056, 0.078, 0.36, 0.012, 3), parkerizedSteel, 0, 0.034, -0.04);
      addPart(roundedBoxGeo(0.054, 0.056, 0.26, 0.014, 4), walnutWood, 0, 0.03, -0.34);
      addCrownedBarrel(0.016, 0.42, parkerizedSteel, 0.042, -0.64);
      addPart(new THREE.CylinderGeometry(0.078, 0.078, 0.06, 24), parkerizedSteel, 0, -0.075, -0.12, Math.PI / 2);
      addPart(roundedGripGeo(0.035, 0.118, 0.048), polymerGrip, 0, -0.058, 0.06, 0.24);
      addPart(contouredStockGeo(0.25, 0.112, 0.058, 0.044), walnutWood, 0, 0.006, 0.25, 0.08);
      addPart(new THREE.CylinderGeometry(0.007, 0.007, 0.18, 10), machinedSteel, -0.034, -0.015, -0.52, Math.PI / 2.2);
      addPart(new THREE.CylinderGeometry(0.007, 0.007, 0.18, 10), machinedSteel, 0.034, -0.015, -0.52, Math.PI / 2.2);
      addPicatinnyRail(0.078, 0.06, 0.22, 9);
      addTriggerAssembly(-0.006, 0.005);
      muzzleZ = -0.86;
      muzzleY = 0.042;
      opticPos.set(0, 0.09, -0.03);
      underPos.set(0, -0.005, -0.34);
      magAnchor.set(0, -0.075, -0.12);
      break;
    }
    case 'm249_titan': {
      addPart(roundedBoxGeo(0.078, 0.096, 0.48, 0.014, 3), parkerizedSteel, 0, 0.04, -0.08);
      addPart(roundedBoxGeo(0.115, 0.12, 0.13, 0.014, 3), olivePolymer, -0.01, -0.068, -0.1);
      for (let b = 0; b < 5; b++) {
        addPart(new THREE.CylinderGeometry(0.005, 0.005, 0.032, 10), brassMat, -0.048, 0.015, -0.13 + b * 0.015, 0, 0, Math.PI / 2);
      }
      addPart(roundedBoxGeo(0.068, 0.06, 0.25, 0.012, 3), anodizedAlloy, 0, 0.032, -0.4);
      addCrownedBarrel(0.017, 0.44, parkerizedSteel, 0.052, -0.53);
      addPart(new THREE.CylinderGeometry(0.02, 0.016, 0.05, 16), machinedSteel, 0, 0.052, -0.76, Math.PI / 2);
      addPart(roundedBoxGeo(0.018, 0.045, 0.15, 0.005, 2), polymerGrip, 0.03, 0.105, -0.22);
      addPart(contouredStockGeo(0.24, 0.105, 0.07, 0.05), polymerGrip, 0, 0.02, 0.27);
      addPart(roundedGripGeo(0.036, 0.115, 0.048), polymerGrip, 0, -0.055, 0.09, 0.2);
      addPicatinnyRail(0.09, 0.08, 0.24, 10);
      addTriggerAssembly(-0.005, 0.02);
      muzzleZ = -0.79;
      muzzleY = 0.052;
      opticPos.set(0, 0.102, -0.02);
      underPos.set(0, -0.002, -0.38);
      magAnchor.set(-0.01, -0.08, -0.1);
      break;
    }
    case 'gl40': {
      addPart(roundedBoxGeo(0.062, 0.078, 0.34, 0.012, 3), anodizedAlloy, 0, 0.042, -0.04);
      addPart(new THREE.CylinderGeometry(0.072, 0.072, 0.15, 24), parkerizedSteel, 0, 0.012, -0.11, Math.PI / 2);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        addPart(
          new THREE.CylinderGeometry(0.018, 0.018, 0.155, 14),
          brassMat,
          Math.cos(ang) * 0.042,
          0.012 + Math.sin(ang) * 0.042,
          -0.11,
          Math.PI / 2
        );
      }
      addCrownedBarrel(0.03, 0.32, parkerizedSteel, 0.045, -0.34);
      addPart(roundedBoxGeo(0.04, 0.04, 0.22, 0.008, 3), anodizedAlloy, 0, 0.005, -0.32);
      addPart(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 14), polymerGrip, 0, -0.045, -0.34);
      addPart(roundedGripGeo(0.038, 0.115, 0.052), polymerGrip, 0, -0.055, 0.06, 0.2);
      addPart(contouredStockGeo(0.22, 0.1, 0.062, 0.044), polymerGrip, 0, 0.018, 0.22);
      addPicatinnyRail(0.084, 0.04, 0.22, 10);
      muzzleZ = -0.52;
      muzzleY = 0.045;
      opticPos.set(0, 0.098, -0.06);
      underPos.set(0, -0.01, -0.34);
      magAnchor.set(0, -0.03, -0.11);
      break;
    }
    case 'x9_plasma': {
      addPart(roundedBoxGeo(0.062, 0.088, 0.44, 0.014, 3), anodizedAlloy, 0, 0.032, -0.07);
      addPart(roundedBoxGeo(0.068, 0.022, 0.36, 0.007, 3), parkerizedSteel, 0, 0.072, -0.35);
      addPart(roundedBoxGeo(0.068, 0.022, 0.36, 0.007, 3), parkerizedSteel, 0, -0.004, -0.35);
      addPart(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 18), energyMat, 0, 0.036, -0.36, Math.PI / 2);
      for (let i = 0; i < 4; i++) {
        addPart(new THREE.TorusGeometry(0.038, 0.008, 10, 20), machinedSteel, 0, 0.036, -0.22 - i * 0.08);
      }
      addPart(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 20), energyMat, 0, -0.058, -0.1);
      addPart(roundedGripGeo(0.038, 0.11, 0.048), polymerGrip, 0, -0.055, 0.07, 0.22);
      addPart(contouredStockGeo(0.22, 0.1, 0.064, 0.046), polymerGrip, 0, 0.02, 0.24);
      addPicatinnyRail(0.085, 0.08, 0.3, 12);
      muzzleZ = -0.58;
      muzzleY = 0.036;
      opticPos.set(0, 0.098, -0.04);
      underPos.set(0, -0.01, -0.32);
      magAnchor.set(0, -0.05, -0.1);
      break;
    }
    case 'minigun_hydra': {
      addPart(new THREE.CylinderGeometry(0.095, 0.095, 0.34, 24), anodizedAlloy, 0, 0.028, -0.08, Math.PI / 2);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        addPart(
          new THREE.CylinderGeometry(0.011, 0.011, 0.56, 12),
          parkerizedSteel,
          Math.cos(ang) * 0.046,
          0.028 + Math.sin(ang) * 0.046,
          -0.5,
          Math.PI / 2
        );
      }
      addPart(new THREE.TorusGeometry(0.058, 0.01, 10, 22), machinedSteel, 0, 0.028, -0.68);
      addPart(new THREE.TorusGeometry(0.058, 0.01, 10, 22), machinedSteel, 0, 0.028, -0.4);
      addPart(roundedBoxGeo(0.11, 0.12, 0.16, 0.016, 3), olivePolymer, -0.01, -0.09, -0.08);
      addPart(new THREE.TorusGeometry(0.06, 0.012, 10, 20, Math.PI), polymerGrip, 0, 0.12, -0.08);
      addPart(roundedGripGeo(0.038, 0.11, 0.05), polymerGrip, 0, -0.05, 0.14, 0.2);
      addPicatinnyRail(0.128, 0.04, 0.16, 6);
      muzzleZ = -0.8;
      muzzleY = 0.028;
      opticPos.set(0, 0.14, -0.04);
      underPos.set(0, -0.04, -0.35);
      magAnchor.set(0, -0.09, -0.08);
      break;
    }
    case 'mgl_incendiary': {
      // AT-4 Tubular olive rocket launcher with flared venturi & safety grip
      addPart(new THREE.CylinderGeometry(0.058, 0.058, 0.78, 24), olivePolymer, 0, 0.048, -0.18, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.072, 0.058, 0.1, 24), parkerizedSteel, 0, 0.048, -0.59, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.058, 0.074, 0.12, 24), parkerizedSteel, 0, 0.048, 0.26, Math.PI / 2);
      addPart(new THREE.TorusGeometry(0.062, 0.008, 10, 22), brassMat, 0, 0.048, -0.42);
      addPart(new THREE.TorusGeometry(0.062, 0.008, 10, 22), anodizedAlloy, 0, 0.048, -0.05);
      addPart(roundedGripGeo(0.036, 0.11, 0.048), polymerGrip, 0, -0.052, -0.16, 0.15);
      addPart(roundedGripGeo(0.036, 0.11, 0.048), polymerGrip, 0, -0.052, 0.06, 0.2);
      addPicatinnyRail(0.108, 0.02, 0.22, 8);
      muzzleZ = -0.66;
      muzzleY = 0.048;
      opticPos.set(0, 0.118, -0.08);
      underPos.set(0, -0.015, -0.22);
      magAnchor.set(0, 0.02, -0.15);
      break;
    }
    case 'vulcan_laser': {
      addPart(roundedBoxGeo(0.085, 0.11, 0.5, 0.016, 4), anodizedAlloy, 0, 0.038, -0.06);
      addPart(new THREE.CylinderGeometry(0.038, 0.042, 0.36, 22), parkerizedSteel, 0, 0.046, -0.45, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 20), energyMat, 0, 0.046, -0.48, Math.PI / 2);
      for (let f = 0; f < 5; f++) {
        addPart(new THREE.TorusGeometry(0.045, 0.007, 10, 22), machinedSteel, 0, 0.046, -0.34 - f * 0.065);
      }
      addPart(new THREE.CircleGeometry(0.034, 20), opticGlass, 0, 0.046, -0.68, 0, Math.PI);
      addPart(roundedBoxGeo(0.076, 0.11, 0.16, 0.014, 3), energyMat, 0, -0.075, -0.04);
      addPart(roundedGripGeo(0.038, 0.11, 0.05), polymerGrip, 0, -0.055, 0.12, 0.2);
      addPart(contouredStockGeo(0.22, 0.108, 0.072, 0.052), polymerGrip, 0, 0.02, 0.28);
      addPicatinnyRail(0.094, 0.08, 0.26, 10);
      muzzleZ = -0.74;
      muzzleY = 0.046;
      opticPos.set(0, 0.104, -0.06);
      underPos.set(0, -0.02, -0.32);
      magAnchor.set(0, -0.07, -0.04);
      break;
    }
    case 'railgun_nemesis': {
      addPart(roundedBoxGeo(0.074, 0.096, 0.52, 0.016, 4), parkerizedSteel, 0, 0.038, -0.05);
      // Dual curved magnetic rails + glowing core coils
      addPart(roundedBoxGeo(0.024, 0.044, 0.62, 0.008, 3), chromeSteel, -0.026, 0.048, -0.52);
      addPart(roundedBoxGeo(0.024, 0.044, 0.62, 0.008, 3), chromeSteel, 0.026, 0.048, -0.52);
      addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.58, 18), energyMat, 0, 0.048, -0.5, Math.PI / 2);
      for (let r = 0; r < 6; r++) {
        addPart(new THREE.TorusGeometry(0.042, 0.007, 10, 22), anodizedAlloy, 0, 0.048, -0.28 - r * 0.09);
      }
      addPart(roundedBoxGeo(0.058, 0.105, 0.14, 0.012, 3), energyMat, 0, -0.068, -0.08);
      addPart(roundedGripGeo(0.036, 0.115, 0.048), polymerGrip, 0, -0.058, 0.12, 0.22);
      addPart(contouredStockGeo(0.24, 0.11, 0.072, 0.052), anodizedAlloy, 0, 0.022, 0.3);
      addPicatinnyRail(0.092, 0.08, 0.34, 14);
      muzzleZ = -0.84;
      muzzleY = 0.048;
      opticPos.set(0, 0.102, -0.05);
      underPos.set(0, -0.015, -0.34);
      magAnchor.set(0, -0.065, -0.08);
      break;
    }
  }

  // --- ATTACHMENTS RENDERING (Skip firearms optics/muzzles/mags on melee weapons) ---
  let sightCenterY = opticPos.y + 0.008;
  if (!spec.isMelee) {
    // 1. OPTIC (Rounded open-frame housings for Red Dot & Holo + smooth 22-seg scope barrels)
    const effectiveOptic =
      att.optic === 'none' && (safeId === 'awp_espectro' || safeId === 'cheytac_m200')
        ? 'sniper_8x'
        : att.optic === 'none' && (safeId === 'm24_cazador' || safeId === 'kar98k_classic')
        ? 'acog_4x'
        : att.optic;

    if (effectiveOptic === 'none') {
      addPart(roundedBoxGeo(0.007, 0.014, 0.01, 0.002, 2), parkerizedSteel, opticPos.x - 0.01, opticPos.y + 0.006, opticPos.z + 0.04);
      addPart(roundedBoxGeo(0.007, 0.014, 0.01, 0.002, 2), parkerizedSteel, opticPos.x + 0.01, opticPos.y + 0.006, opticPos.z + 0.04);
      addPart(roundedBoxGeo(0.004, 0.015, 0.008, 0.0015, 2), tritiumMat, opticPos.x, opticPos.y + 0.008, muzzleZ + 0.08);
      sightCenterY = opticPos.y + 0.011;
    } else if (effectiveOptic === 'red_dot') {
      addPart(roundedBoxGeo(0.034, 0.01, 0.068, 0.003, 2), parkerizedSteel, opticPos.x, opticPos.y, opticPos.z);
      addPart(roundedBoxGeo(0.006, 0.036, 0.048, 0.002, 2), anodizedAlloy, opticPos.x - 0.016, opticPos.y + 0.022, opticPos.z);
      addPart(roundedBoxGeo(0.006, 0.036, 0.048, 0.002, 2), anodizedAlloy, opticPos.x + 0.016, opticPos.y + 0.022, opticPos.z);
      addPart(roundedBoxGeo(0.038, 0.006, 0.048, 0.002, 2), anodizedAlloy, opticPos.x, opticPos.y + 0.041, opticPos.z);
      addPart(new THREE.PlaneGeometry(0.026, 0.028), opticGlass, opticPos.x, opticPos.y + 0.023, opticPos.z - 0.018, 0, Math.PI);
      addPart(new THREE.SphereGeometry(0.0022, 10, 10), laserEmitMat, opticPos.x, opticPos.y + 0.023, opticPos.z);
      sightCenterY = opticPos.y + 0.023;
    } else if (effectiveOptic === 'holo') {
      addPart(roundedBoxGeo(0.042, 0.012, 0.08, 0.004, 2), parkerizedSteel, opticPos.x, opticPos.y + 0.001, opticPos.z);
      addPart(roundedBoxGeo(0.007, 0.042, 0.058, 0.0025, 2), anodizedAlloy, opticPos.x - 0.02, opticPos.y + 0.026, opticPos.z);
      addPart(roundedBoxGeo(0.007, 0.042, 0.058, 0.0025, 2), anodizedAlloy, opticPos.x + 0.02, opticPos.y + 0.026, opticPos.z);
      addPart(roundedBoxGeo(0.047, 0.007, 0.058, 0.0025, 2), anodizedAlloy, opticPos.x, opticPos.y + 0.048, opticPos.z);
      addPart(new THREE.PlaneGeometry(0.033, 0.032), opticGlass, opticPos.x, opticPos.y + 0.027, opticPos.z - 0.02);
      addPart(new THREE.RingGeometry(0.0065, 0.0085, 20), tritiumMat, opticPos.x, opticPos.y + 0.027, opticPos.z);
      addPart(new THREE.SphereGeometry(0.0018, 10, 10), tritiumMat, opticPos.x, opticPos.y + 0.027, opticPos.z);
      sightCenterY = opticPos.y + 0.027;
    } else if (effectiveOptic === 'acog_4x') {
      addPart(roundedBoxGeo(0.032, 0.018, 0.11, 0.005, 3), anodizedAlloy, opticPos.x, opticPos.y + 0.004, opticPos.z);
      addPart(new THREE.CylinderGeometry(0.02, 0.018, 0.14, 22), parkerizedSteel, opticPos.x, opticPos.y + 0.028, opticPos.z, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.024, 0.02, 0.045, 22), parkerizedSteel, opticPos.x, opticPos.y + 0.028, opticPos.z - 0.08, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 12), laserEmitMat, opticPos.x, opticPos.y + 0.052, opticPos.z, Math.PI / 2);
      addPart(new THREE.CircleGeometry(0.02, 20), opticGlass, opticPos.x, opticPos.y + 0.028, opticPos.z - 0.104, 0, Math.PI);
      addPart(new THREE.CircleGeometry(0.017, 20), opticGlass, opticPos.x, opticPos.y + 0.028, opticPos.z + 0.072);
      sightCenterY = opticPos.y + 0.028;
    } else if (effectiveOptic === 'thermal_scope') {
      const thermalLens = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 0.75,
        metalness: 0.4,
        roughness: 0.1,
        transparent: true,
        opacity: 0.35,
      });
      addPart(roundedBoxGeo(0.046, 0.042, 0.15, 0.011, 3), anodizedAlloy, opticPos.x, opticPos.y + 0.026, opticPos.z);
      addPart(new THREE.CylinderGeometry(0.024, 0.02, 0.05, 22), parkerizedSteel, opticPos.x, opticPos.y + 0.026, opticPos.z - 0.085, Math.PI / 2);
      addPart(new THREE.CircleGeometry(0.021, 20), thermalLens, opticPos.x, opticPos.y + 0.026, opticPos.z - 0.112, 0, Math.PI);
      addPart(roundedBoxGeo(0.012, 0.012, 0.03, 0.003, 2), laserEmitMat, opticPos.x + 0.024, opticPos.y + 0.032, opticPos.z);
      sightCenterY = opticPos.y + 0.026;
    } else if (effectiveOptic === 'sniper_8x') {
      addPart(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 22), parkerizedSteel, opticPos.x, opticPos.y + 0.034, opticPos.z, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.03, 0.022, 0.09, 22), parkerizedSteel, opticPos.x, opticPos.y + 0.034, opticPos.z - 0.16, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.025, 0.02, 0.07, 22), parkerizedSteel, opticPos.x, opticPos.y + 0.034, opticPos.z + 0.15, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.01, 0.01, 0.025, 16), machinedSteel, opticPos.x, opticPos.y + 0.058, opticPos.z);
      addPart(new THREE.CircleGeometry(0.026, 22), opticGlass, opticPos.x, opticPos.y + 0.034, opticPos.z - 0.206, 0, Math.PI);
      addPart(new THREE.CircleGeometry(0.021, 22), opticGlass, opticPos.x, opticPos.y + 0.034, opticPos.z + 0.186);
      addPart(new THREE.TorusGeometry(0.024, 0.005, 8, 20), anodizedAlloy, opticPos.x, opticPos.y + 0.034, opticPos.z - 0.07);
      addPart(new THREE.TorusGeometry(0.024, 0.005, 8, 20), anodizedAlloy, opticPos.x, opticPos.y + 0.034, opticPos.z + 0.07);
      sightCenterY = opticPos.y + 0.034;
    }

    // 2. MUZZLE
    if (att.muzzle === 'suppressor') {
      const supLen = isPistol ? 0.14 : 0.19;
      const supRad = isPistol ? 0.018 : 0.023;
      addPart(
        new THREE.CylinderGeometry(supRad, supRad, supLen, 22),
        parkerizedSteel,
        0,
        muzzleY,
        muzzleZ - supLen / 2,
        Math.PI / 2
      );
      addPart(
        new THREE.CylinderGeometry(supRad + 0.003, supRad + 0.003, 0.025, 22),
        machinedSteel,
        0,
        muzzleY,
        muzzleZ - 0.015,
        Math.PI / 2
      );
      addPart(new THREE.TorusGeometry(supRad * 0.96, 0.003, 8, 20), machinedSteel, 0, muzzleY, muzzleZ - supLen);
      muzzleZ -= supLen;
    } else if (att.muzzle === 'compensator') {
      addPart(roundedBoxGeo(0.032, 0.03, 0.065, 0.007, 3), machinedSteel, 0, muzzleY, muzzleZ - 0.032);
      addPart(roundedBoxGeo(0.036, 0.016, 0.014, 0.004, 2), parkerizedSteel, 0, muzzleY, muzzleZ - 0.045);
      muzzleZ -= 0.065;
    } else if (att.muzzle === 'heavy_barrel') {
      const extLen = isPistol ? 0.07 : 0.16;
      addCrownedBarrel(0.017, extLen, chromeSteel, muzzleY, muzzleZ - extLen / 2);
      muzzleZ -= extLen;
    }

    // 3. UNDERBARREL
    if (att.underbarrel === 'vertical_grip') {
      addPart(roundedBoxGeo(0.03, 0.02, 0.045, 0.005, 2), anodizedAlloy, underPos.x, underPos.y, underPos.z);
      addPart(new THREE.CylinderGeometry(0.014, 0.017, 0.105, 18), polymerGrip, underPos.x, underPos.y - 0.058, underPos.z);
    } else if (att.underbarrel === 'tactical_foregrip') {
      addPart(roundedBoxGeo(0.032, 0.034, 0.095, 0.009, 3), fdePolymer, underPos.x, underPos.y - 0.018, underPos.z, 0.25);
    } else if (att.underbarrel === 'laser_sight') {
      addPart(roundedBoxGeo(0.034, 0.028, 0.075, 0.007, 3), anodizedAlloy, 0.034, muzzleY - 0.005, underPos.z);
      addPart(new THREE.CircleGeometry(0.007, 14), laserEmitMat, 0.034, muzzleY - 0.005, underPos.z - 0.039, 0, Math.PI);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.42 });
      addPart(new THREE.CylinderGeometry(0.0018, 0.0018, 2.2, 8), beamMat, 0.034, muzzleY - 0.005, underPos.z - 1.14, Math.PI / 2);
    }

    // 4. MAGAZINE MODS
    if (att.magazine === 'extended_mag') {
      if (isPistol) {
        addPart(roundedBoxGeo(0.028, 0.075, 0.044, 0.006, 3), parkerizedSteel, magAnchor.x, magAnchor.y - 0.03, magAnchor.z + 0.01, 0.22);
      } else {
        addPart(new THREE.CylinderGeometry(0.056, 0.056, 0.052, 22), anodizedAlloy, magAnchor.x, magAnchor.y - 0.095, magAnchor.z, Math.PI / 2);
      }
    } else if (att.magazine === 'drum_mag') {
      addPart(new THREE.CylinderGeometry(0.068, 0.068, 0.055, 24), parkerizedSteel, magAnchor.x - 0.058, magAnchor.y - 0.095, magAnchor.z, Math.PI / 2);
      addPart(new THREE.CylinderGeometry(0.068, 0.068, 0.055, 24), parkerizedSteel, magAnchor.x + 0.058, magAnchor.y - 0.095, magAnchor.z, Math.PI / 2);
    } else if (att.magazine === 'ap_rounds') {
      addPart(roundedBoxGeo(0.036, 0.028, 0.054, 0.005, 2), brassMat, magAnchor.x, magAnchor.y - 0.055, magAnchor.z);
      addPart(roundedBoxGeo(0.038, 0.012, 0.056, 0.004, 2), laserEmitMat, magAnchor.x, magAnchor.y - 0.072, magAnchor.z);
    }

    // 5. STOCK / STABILITY MODS
    if (!isPistol && att.stock && att.stock !== 'none') {
      if (att.stock === 'light_stock') {
        addPart(roundedBoxGeo(0.026, 0.014, 0.16, 0.004, 2), machinedSteel, 0, 0.04, 0.26);
        addPart(roundedBoxGeo(0.032, 0.08, 0.024, 0.006, 3), anodizedAlloy, 0, 0.012, 0.34);
      } else if (att.stock === 'heavy_stock') {
        addPart(contouredStockGeo(0.18, 0.098, 0.064, 0.048), fdePolymer, 0, 0.024, 0.28);
        addPart(roundedBoxGeo(0.05, 0.036, 0.12, 0.009, 3), polymerGrip, 0, 0.068, 0.27);
      } else if (att.stock === 'recoil_pad') {
        addPart(roundedBoxGeo(0.05, 0.105, 0.036, 0.009, 3), polymerGrip, 0, 0.018, 0.36);
        addPart(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 16), brassMat, 0, 0.035, 0.25, Math.PI / 2);
      }
    }
  }

  return {
    group,
    muzzleOffset: new THREE.Vector3(0, muzzleY, muzzleZ),
    sightOffset: new THREE.Vector3(opticPos.x, sightCenterY, opticPos.z),
  };
}

/**
 * Builds a 3D Weapon Pickup Display (case + rarity-colored glowing pedestal + scaled weapon mesh)
 */
export function buildWeaponPickupMesh(weaponId: WeaponId): THREE.Group {
  const root = new THREE.Group();
  const spec = WEAPON_MAP[weaponId] || WEAPON_MAP.knife_combat;
  const rarityHex = RARITY_META[spec.rarity]?.hex ?? 0x94a3b8;

  const caseMat = new THREE.MeshStandardMaterial({ color: 0x1e242c, roughness: 0.55, metalness: 0.5 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: rarityHex,
    emissive: rarityHex,
    emissiveIntensity: 1.5,
    roughness: 0.25,
  });

  const caseBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.14, 0.44), caseMat);
  caseBox.position.y = 0.07;
  caseBox.castShadow = true;
  root.add(caseBox);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.04, 0.48), rimMat);
  rim.position.y = 0.15;
  root.add(rim);

  const built = buildWeaponMesh(weaponId);
  built.group.scale.setScalar(1.35);
  built.group.position.set(0, 0.46, 0.2);
  built.group.rotation.y = Math.PI / 2;
  root.add(built.group);

  return root;
}

/**
 * Builds the customized 3D Operator Character (bottom-center grounded at y = 0)
 */
function createSuitPatternTexture(baseHex: string, pattern: SuitPattern, secondaryHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  if (pattern === 'urban_camo') {
    const tones = ['#111827', '#475569', '#94a3b8'];
    for (let i = 0; i < 38; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.45;
      ctx.fillRect((i * 37) % 116, (i * 53) % 116, 18 + (i % 14), 10 + (i % 12));
    }
  } else if (pattern === 'woodland') {
    const tones = ['#14532d', '#3f6212', '#451a03'];
    for (let i = 0; i < 34; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse((i * 41) % 128, (i * 29) % 128, 16, 9, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'desert') {
    const tones = ['#d6b88d', '#a16207', '#78350f'];
    for (let i = 0; i < 36; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = 0.42;
      ctx.fillRect((i * 29) % 120, (i * 47) % 120, 22, 8);
    }
  } else if (pattern === 'hazard') {
    ctx.fillStyle = secondaryHex;
    ctx.globalAlpha = 0.65;
    for (let x = -128; x < 256; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x - 52, 128);
      ctx.lineTo(x - 64, 128);
      ctx.closePath();
      ctx.fill();
    }
  } else if (pattern === 'cyber_hex') {
    ctx.strokeStyle = secondaryHex;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.55;
    for (let y = 0; y < 128; y += 16) {
      for (let x = 0; x < 128; x += 18) {
        const ox = (y / 16) % 2 === 0 ? 0 : 9;
        ctx.strokeRect(x + ox, y, 12, 12);
      }
    }
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createEmblemTexture(emblem: EmblemType, accentHex: string): THREE.CanvasTexture | null {
  if (emblem === 'none') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = accentHex;
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;

  if (emblem === 'shield') {
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.lineTo(50, 10);
    ctx.lineTo(50, 34);
    ctx.lineTo(32, 54);
    ctx.lineTo(14, 34);
    ctx.closePath();
    ctx.stroke();
  } else if (emblem === 'skull') {
    ctx.beginPath();
    ctx.arc(32, 26, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(23, 36, 18, 13);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(26, 26, 4, 0, Math.PI * 2);
    ctx.arc(38, 26, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'biohazard') {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(32 + Math.cos(a) * 11, 32 + Math.sin(a) * 11, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(32, 32, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'wing') {
    ctx.beginPath();
    ctx.moveTo(32, 44);
    ctx.lineTo(8, 16);
    ctx.lineTo(24, 24);
    ctx.lineTo(32, 16);
    ctx.lineTo(40, 24);
    ctx.lineTo(56, 16);
    ctx.closePath();
    ctx.fill();
  } else if (emblem === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 22 : 9;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const px = 32 + Math.cos(a) * r;
      const py = 32 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the customized 3D Operator Character (bottom-center grounded at y = 0)
 */
export function buildCharacterMesh(
  config: CharacterConfig,
  weaponId: WeaponId,
  attachments?: Partial<WeaponAttachments>,
  weaponFinish?: WeaponFinish
): CharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const secondaryHex = config.secondaryColor || '#475569';
  const suitPattern = config.suitPattern || 'solid';
  const shoulderStyle = config.shoulderStyle || 'standard';
  const emblem = config.emblem || 'shield';

  const patternTex =
    suitPattern !== 'solid'
      ? createSuitPatternTexture(config.armorColor, suitPattern, secondaryHex)
      : null;

  const armorMat = new THREE.MeshStandardMaterial({
    color: patternTex ? 0xffffff : new THREE.Color(config.armorColor),
    map: patternTex,
    roughness: 0.48,
    metalness: 0.28,
  });
  const darkUnderMat = new THREE.MeshStandardMaterial({
    color: 0x161b22,
    roughness: 0.78,
    metalness: 0.12,
  });
  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(secondaryHex),
    roughness: 0.34,
    metalness: 0.65,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.accentColor),
    emissive: new THREE.Color(config.accentColor),
    emissiveIntensity: 1.35,
    roughness: 0.2,
    metalness: 0.3,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd6a888,
    roughness: 0.65,
    metalness: 0.05,
  });

  const makeLeg = (xOffset: number) => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.85, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.24), darkUnderMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    leg.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.27), metalTrimMat);
    kneePad.position.set(0, -0.43, -0.02);
    kneePad.castShadow = true;
    leg.add(kneePad);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.22), armorMat);
    shin.position.y = -0.62;
    shin.castShadow = true;
    leg.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.31), metalTrimMat);
    boot.position.set(0, -0.79, -0.04);
    boot.castShadow = true;
    leg.add(boot);

    return leg;
  };

  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  bodyGroup.add(leftLeg, rightLeg);

  const torsoWidth =
    config.armorClass === 'heavy'
      ? 0.62
      : config.armorClass === 'recon'
      ? 0.48
      : config.armorClass === 'none'
      ? 0.49
      : 0.54;
  const torsoDepth = config.armorClass === 'heavy' ? 0.36 : config.armorClass === 'none' ? 0.25 : 0.28;

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.26), darkUnderMat);
  pelvis.position.set(0, 0.9, 0);
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.07, 0.29), metalTrimMat);
  belt.position.set(0, 0.96, 0);
  bodyGroup.add(belt);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(torsoWidth, 0.56, torsoDepth), armorMat);
  chest.position.set(0, 1.26, 0);
  chest.castShadow = true;
  bodyGroup.add(chest);

  if (config.armorClass !== 'none') {
    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(torsoWidth * 0.78, 0.34, torsoDepth + 0.05),
      config.armorClass === 'medic'
        ? new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 })
        : metalTrimMat
    );
    chestPlate.position.set(0, 1.29, -0.01);
    chestPlate.castShadow = true;
    bodyGroup.add(chestPlate);
  }

  const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.02), accentMat);
  chestStrip.position.set(0, 1.4, -torsoDepth / 2 - 0.035);
  bodyGroup.add(chestStrip);

  const emblemTex = createEmblemTexture(emblem, config.accentColor);
  if (emblemTex) {
    const emblemPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true })
    );
    emblemPlane.position.set(0, 1.26, -torsoDepth / 2 - 0.04);
    emblemPlane.rotation.y = Math.PI;
    bodyGroup.add(emblemPlane);
  }

  // Shoulder Pauldrons based on shoulderStyle
  const basePauldronScale = config.armorClass === 'heavy' ? 1.22 : 0.96;
  [-1, 1].forEach((side) => {
    if (shoulderStyle === 'heavy_plates') {
      const pauldron = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * basePauldronScale, 0.22 * basePauldronScale, 0.3 * basePauldronScale),
        armorMat
      );
      pauldron.position.set(side * (torsoWidth / 2 + 0.08), 1.49, 0);
      pauldron.rotation.z = side * -0.2;
      pauldron.castShadow = true;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.31), accentMat);
      trim.position.set(side * (torsoWidth / 2 + 0.08), 1.56, 0);
      trim.rotation.z = side * -0.2;
      bodyGroup.add(pauldron, trim);
    } else if (shoulderStyle === 'spiked') {
      const baseP = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.26), metalTrimMat);
      baseP.position.set(side * (torsoWidth / 2 + 0.07), 1.48, 0);
      baseP.rotation.z = side * -0.2;
      baseP.castShadow = true;
      bodyGroup.add(baseP);
      for (let sp = -1; sp <= 1; sp++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.11, 6), accentMat);
        spike.position.set(side * (torsoWidth / 2 + 0.14), 1.54, sp * 0.075);
        spike.rotation.z = side * -0.75;
        bodyGroup.add(spike);
      }
    } else if (shoulderStyle === 'stealth') {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.24), darkUnderMat);
      fin.position.set(side * (torsoWidth / 2 + 0.05), 1.48, 0);
      fin.rotation.z = side * -0.38;
      bodyGroup.add(fin);
    } else {
      const pauldron = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * basePauldronScale, 0.18 * basePauldronScale, 0.26 * basePauldronScale),
        armorMat
      );
      pauldron.position.set(side * (torsoWidth / 2 + 0.07), 1.48, 0);
      pauldron.rotation.z = side * -0.18;
      pauldron.castShadow = true;
      bodyGroup.add(pauldron);
    }
  });

  if (config.backpack !== 'none') {
    const packGroup = new THREE.Group();
    packGroup.position.set(0, 1.28, torsoDepth / 2 + 0.09);
    if (config.backpack === 'tactical') {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.18), darkUnderMat);
      bag.castShadow = true;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.19), accentMat);
      strap.position.y = 0.08;
      packGroup.add(bag, strap);
    } else if (config.backpack === 'jetpack') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.12), metalTrimMat);
      [-0.12, 0.12].forEach((x) => {
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.38, 12), armorMat);
        thruster.position.set(x, -0.02, 0.04);
        const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.04, 12), accentMat);
        glow.position.set(x, -0.22, 0.04);
        packGroup.add(thruster, glow);
      });
      packGroup.add(frame);
    } else if (config.backpack === 'bio') {
      const tankFrame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.14), metalTrimMat);
      const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.36, 14), accentMat);
      canister.position.z = 0.06;
      packGroup.add(tankFrame, canister);
    } else if (config.backpack === 'ammo_pack') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.2), metalTrimMat);
      crate.castShadow = true;
      const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), armorMat);
      pouchL.position.set(-0.12, -0.04, 0.12);
      const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), armorMat);
      pouchR.position.set(0.12, -0.04, 0.12);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.04), accentMat);
      strip.position.set(0, 0.12, 0.11);
      packGroup.add(crate, pouchL, pouchR, strip);
    } else if (config.backpack === 'sword_sheath') {
      const harness = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.1), darkUnderMat);
      const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.72, 0.04), metalTrimMat);
      scabbard.position.set(0.02, 0.05, 0.08);
      scabbard.rotation.z = -0.45;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.18, 8), accentMat);
      hilt.position.set(0.2, 0.41, 0.08);
      hilt.rotation.z = -0.45;
      packGroup.add(harness, scabbard, hilt);
    }
    bodyGroup.add(packGroup);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);
  bodyGroup.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.1, 10), darkUnderMat);
  neck.position.y = 0.04;
  headGroup.add(neck);

  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
  headMesh.position.y = 0.21;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  switch (config.helmet) {
    case 'ballistic': {
      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.2, 0.34), armorMat);
      dome.position.set(0, 0.28, 0.01);
      dome.castShadow = true;
      const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.06), accentMat);
      goggles.position.set(0, 0.24, -0.15);
      headGroup.add(dome, goggles);
      break;
    }
    case 'visor': {
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.33, 0.32), armorMat);
      shell.position.y = 0.21;
      shell.castShadow = true;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.05), accentMat);
      visor.position.set(0, 0.23, -0.15);
      headGroup.add(shell, visor);
      break;
    }
    case 'gasmask': {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.31, 0.31), darkUnderMat);
      hood.position.y = 0.21;
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.1), metalTrimMat);
      mask.position.set(0, 0.16, -0.15);
      const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 12), armorMat);
      filter.rotation.x = Math.PI / 2;
      filter.position.set(0, 0.12, -0.21);
      [-0.07, 0.07].forEach((ex) => {
        const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), accentMat);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(ex, 0.24, -0.165);
        headGroup.add(eye);
      });
      headGroup.add(hood, mask, filter);
      break;
    }
    case 'beret': {
      const beret = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.16, 0.09, 16),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(config.accentColor), roughness: 0.7 })
      );
      beret.position.set(0.03, 0.36, 0);
      beret.rotation.z = -0.18;
      const shades = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.04), darkUnderMat);
      shades.position.set(0, 0.24, -0.145);
      headGroup.add(beret, shades);
      break;
    }
    case 'hood': {
      const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), armorMat);
      cowl.position.set(0, 0.22, 0.01);
      const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.04), darkUnderMat);
      facePlate.position.set(0, 0.21, -0.155);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.03), accentMat);
      slit.position.set(0, 0.24, -0.175);
      headGroup.add(cowl, facePlate, slit);
      break;
    }
    case 'oni_mask': {
      const helm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), darkUnderMat);
      helm.position.y = 0.21;
      const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.2, 0.07), armorMat);
      faceMask.position.set(0, 0.18, -0.15);
      [-0.08, 0.08].forEach((hx) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 6), accentMat);
        horn.position.set(hx, 0.39, -0.13);
        horn.rotation.x = 0.35;
        horn.rotation.z = hx < 0 ? 0.22 : -0.22;
        headGroup.add(horn);
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 0.03), accentMat);
        eye.position.set(hx * 0.85, 0.25, -0.175);
        headGroup.add(eye);
      });
      headGroup.add(helm, faceMask);
      break;
    }
    case 'pilot_helm': {
      const sphereHelm = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), armorMat);
      sphereHelm.position.y = 0.23;
      sphereHelm.castShadow = true;
      const shieldVisor = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI, 0.35, 0.85), accentMat);
      shieldVisor.position.set(0, 0.23, -0.03);
      shieldVisor.rotation.y = Math.PI;
      const coms = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.08, 0.08), metalTrimMat);
      coms.position.set(0, 0.21, 0);
      headGroup.add(sphereHelm, shieldVisor, coms);
      break;
    }
  }

  const rightArm = new THREE.Group();
  rightArm.position.set(torsoWidth / 2 + 0.1, 1.44, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.15), armorMat);
  rUpper.position.set(0, -0.12, -0.16);
  rUpper.rotation.x = Math.PI / 2.2;
  rUpper.castShadow = true;
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), metalTrimMat);
  rGlove.position.set(0, -0.13, -0.34);
  rGlove.rotation.x = Math.PI / 2.2;
  rightArm.add(rUpper, rGlove);
  bodyGroup.add(rightArm);

  const leftArm = new THREE.Group();
  leftArm.position.set(-(torsoWidth / 2 + 0.1), 1.44, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.44, 0.15), armorMat);
  lUpper.position.set(0.08, -0.12, -0.2);
  lUpper.rotation.set(Math.PI / 2.3, 0, -0.35);
  lUpper.castShadow = true;
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), metalTrimMat);
  lGlove.position.set(0.14, -0.14, -0.36);
  lGlove.rotation.set(Math.PI / 2.3, 0, -0.35);
  leftArm.add(lUpper, lGlove);
  bodyGroup.add(leftArm);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.14, -0.4);
  rightArm.add(weaponMount);

  const resolvedFinish = weaponFinish || config.weaponFinishes?.[weaponId] || 'factory';
  const builtWeapon = buildWeaponMesh(weaponId, attachments || config.weaponAttachments?.[weaponId], resolvedFinish);
  weaponMount.add(builtWeapon.group);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.copy(builtWeapon.muzzleOffset);
  weaponMount.add(muzzlePoint);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMount,
    muzzlePoint,
  };
}

/**
 * Builds anatomically sculpted, realistic 3D Zombies with tagged 'head', 'body', and 'leg' hitboxes
 */
export function buildZombieMesh(type: ZombieType): ZombieRig {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);

  const scale =
    type === 'brute'
      ? 1.42
      : type === 'bloater'
      ? 1.24
      : type === 'riot'
      ? 1.08
      : type === 'hazmat'
      ? 1.03
      : type === 'runner'
      ? 0.94
      : type === 'crawler'
      ? 0.92
      : type === 'spitter'
      ? 1.04
      : 1.0;
  root.scale.setScalar(scale);

  const skinHex =
    type === 'brute'
      ? 0x566350
      : type === 'runner'
      ? 0x735252
      : type === 'spitter'
      ? 0x3e6953
      : type === 'crawler'
      ? 0x5a4c48
      : type === 'bloater'
      ? 0x6b7042
      : type === 'hazmat'
      ? 0x7c8a52
      : type === 'riot'
      ? 0x586259
      : 0x62705d;

  const clothHex =
    type === 'brute'
      ? 0x22252a
      : type === 'runner'
      ? 0x3b2020
      : type === 'spitter'
      ? 0x162c25
      : type === 'hazmat'
      ? 0xd97706
      : type === 'riot'
      ? 0x111827
      : type === 'bloater'
      ? 0x3d3b27
      : type === 'crawler'
      ? 0x2c2422
      : 0x2b313a;

  const eyeHex =
    type === 'brute'
      ? 0xff5500
      : type === 'runner'
      ? 0xff1e1e
      : type === 'spitter'
      ? 0x22ff66
      : type === 'bloater'
      ? 0xa3e635
      : type === 'hazmat'
      ? 0xfacc15
      : type === 'riot'
      ? 0x38bdf8
      : type === 'crawler'
      ? 0xfb7185
      : 0xfde047;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.78, metalness: 0.05 });
  const bloodMat = new THREE.MeshStandardMaterial({ color: 0x641212, roughness: 0.35, metalness: 0.12 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xc2b9a7, roughness: 0.65, metalness: 0.05 });
  const clothMat = new THREE.MeshStandardMaterial({
    color: clothHex,
    roughness: type === 'hazmat' ? 0.5 : 0.92,
    metalness: type === 'riot' ? 0.38 : 0.04,
  });
  const socketMat = new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.9 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: eyeHex,
    emissive: eyeHex,
    emissiveIntensity: 2.1,
    roughness: 0.15,
  });

  const tagBody = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'body';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  };
  const tagHead = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'head';
    mesh.castShadow = true;
  };
  const tagLeg = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'leg';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  };

  // Sculpted Articulated Legs (tagged 'leg' so 1 shotgun hit cripples them to crawl!)
  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.84, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.088, 0.42, 10), clothMat);
    thigh.position.y = -0.21;
    tagLeg(thigh);
    leg.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), skinMat);
    knee.position.set(0, -0.42, -0.02);
    tagLeg(knee);
    leg.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.062, 0.36, 10), clothMat);
    shin.position.y = -0.61;
    tagLeg(shin);
    leg.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), socketMat);
    boot.position.set(0, -0.8, -0.04);
    tagLeg(boot);
    leg.add(boot);

    return leg;
  };
  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);
  torso.add(leftLeg, rightLeg);

  // Pelvis & Hunched Muscular/Decayed Torso
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.18, 10), clothMat);
  pelvis.position.set(0, 0.9, 0);
  tagBody(pelvis);
  torso.add(pelvis);

  const ribTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, 0.56, 12), clothMat);
  ribTorso.position.set(0, 1.22, -0.03);
  ribTorso.rotation.x = 0.16; // realistic forward zombie hunch
  tagBody(ribTorso);
  torso.add(ribTorso);

  // Exposed blood wound & ribs on chest
  const chestWound = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.05), bloodMat);
  chestWound.position.set(0.03, 1.24, -0.22);
  chestWound.rotation.x = 0.16;
  tagBody(chestWound);
  torso.add(chestWound);

  for (let r = 0; r < 3; r++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.026, 0.04), boneMat);
    rib.position.set(0.03, 1.18 + r * 0.06, -0.24);
    tagBody(rib);
    torso.add(rib);
  }

  // Shoulders
  [-0.28, 0.28].forEach((sx) => {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), clothMat);
    sh.position.set(sx, 1.44, -0.05);
    tagBody(sh);
    torso.add(sh);
  });

  if (type === 'brute') {
    [-0.31, 0.31].forEach((x) => {
      const hump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 1), skinMat);
      hump.position.set(x, 1.48, -0.02);
      tagBody(hump);
      torso.add(hump);
    });
  } else if (type === 'spitter') {
    const cyst = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), eyeMat);
    cyst.position.set(0.14, 1.26, -0.18);
    tagBody(cyst);
    torso.add(cyst);
  } else if (type === 'bloater') {
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 12), skinMat);
    belly.position.set(0, 1.15, -0.14);
    belly.scale.set(1.05, 1.1, 0.95);
    tagBody(belly);
    torso.add(belly);
    const pustules: [number, number, number, number][] = [
      [-0.16, 1.24, -0.32, 0.09],
      [0.18, 1.08, -0.3, 0.1],
      [0.02, 1.38, -0.26, 0.08],
      [-0.22, 1.36, 0.08, 0.09],
    ];
    pustules.forEach(([px, py, pz, pr]) => {
      const pustule = new THREE.Mesh(new THREE.SphereGeometry(pr, 8, 8), eyeMat);
      pustule.position.set(px, py, pz);
      tagBody(pustule);
      torso.add(pustule);
    });
  } else if (type === 'hazmat') {
    const airTank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 10), boneMat);
    airTank.position.set(0, 1.24, 0.22);
    tagBody(airTank);
    torso.add(airTank);
  } else if (type === 'riot') {
    const kevlar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.46, 0.34), socketMat);
    kevlar.position.set(0, 1.24, -0.04);
    tagBody(kevlar);
    torso.add(kevlar);
  }

  // Sculpted Realistic Skull & Head Group (all parts tagged 'head')
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, -0.09);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10), skinMat);
  neck.position.set(0, 0.03, 0.02);
  neck.rotation.x = 0.25;
  tagHead(neck);
  headGroup.add(neck);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), skinMat);
  cranium.scale.set(0.92, 1.12, 1.05);
  cranium.position.set(0, 0.2, 0);
  tagHead(cranium);
  headGroup.add(cranium);

  const browRidge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.14), skinMat);
  browRidge.position.set(0, 0.24, -0.12);
  tagHead(browRidge);
  headGroup.add(browRidge);

  const bloodJaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.17), bloodMat);
  bloodJaw.position.set(0, 0.08, -0.08);
  bloodJaw.rotation.x = 0.25;
  tagHead(bloodJaw);
  headGroup.add(bloodJaw);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), skinMat);
  jaw.position.set(0, 0.04, -0.08);
  jaw.rotation.x = 0.3;
  tagHead(jaw);
  headGroup.add(jaw);

  // Teeth
  for (let t = -2; t <= 2; t++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.028, 0.015), boneMat);
    tooth.position.set(t * 0.03, 0.09, -0.17);
    tagHead(tooth);
    headGroup.add(tooth);
  }

  // Sunken Eye Sockets & Glowing Bloodshot Pupils
  [-0.062, 0.062].forEach((ex) => {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), socketMat);
    socket.position.set(ex, 0.21, -0.145);
    tagHead(socket);
    headGroup.add(socket);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMat);
    eye.position.set(ex, 0.21, -0.17);
    tagHead(eye);
    headGroup.add(eye);
  });

  if (type === 'hazmat') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.35, 0.35), clothMat);
    hood.position.set(0, 0.2, 0.01);
    tagHead(hood);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
    );
    visor.position.set(0, 0.21, -0.17);
    tagHead(visor);
    headGroup.add(hood, visor);
  } else if (type === 'riot') {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), clothMat);
    helmet.position.set(0, 0.24, 0);
    helmet.scale.set(1.0, 0.88, 1.08);
    tagHead(helmet);
    const shieldVisor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.15 })
    );
    shieldVisor.position.set(0, 0.18, -0.18);
    tagHead(shieldVisor);
    headGroup.add(helmet, shieldVisor);
  }

  torso.add(headGroup);

  // Articulated Outstretched Arms with Clawed Hands
  const makeArm = (x: number) => {
    const arm = new THREE.Group();
    arm.position.set(x, 1.42, -0.05);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, 0.3, 8), clothMat);
    upper.position.set(0, -0.04, -0.14);
    upper.rotation.x = Math.PI / 2.4;
    tagBody(upper);
    arm.add(upper);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.046, 0.28, 8), skinMat);
    forearm.position.set(0, -0.07, -0.39);
    forearm.rotation.x = Math.PI / 2.1;
    tagBody(forearm);
    arm.add(forearm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.045, 0.12), bloodMat);
    hand.position.set(0, -0.08, -0.55);
    tagBody(hand);
    arm.add(hand);

    return arm;
  };
  const leftArm = makeArm(-0.31);
  const rightArm = makeArm(0.31);
  torso.add(leftArm, rightArm);

  // Overhead floating HP bar
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, 2.08, 0);
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x090c10, transparent: true, opacity: 0.78, side: THREE.DoubleSide })
  );
  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.71, 0.055),
    new THREE.MeshBasicMaterial({ color: type === 'brute' ? 0xf97316 : 0xef4444, side: THREE.DoubleSide })
  );
  hpBarFill.position.z = 0.005;
  hpBarGroup.add(bg, hpBarFill);
  root.add(hpBarGroup);

  return {
    root,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    hpBarFill,
    hpBarGroup,
  };
}

/**
 * Builds 4 visually distinct Boss Zombies with uniquely located 'weakspot' meshes
 * so each defeated boss transitions to a tougher, mechanically distinct boss.
 */
export function buildBossZombieMesh(variant: BossVariantId, tier: number): BossZombieRig {
  const spec = BOSS_ARCHETYPES[variant];
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);

  const scale = spec.scale + Math.min((tier - 1) * 0.08, 0.48);
  root.scale.setScalar(scale);

  const weakSpots: THREE.Mesh[] = [];
  const weakSpotMat = new THREE.MeshStandardMaterial({
    color: spec.weakPointEmissive,
    emissive: spec.weakPointEmissive,
    emissiveIntensity: 2.3,
    roughness: 0.18,
    metalness: 0.15,
  });

  const palette =
    variant === 'colossus_reactor'
      ? { skin: 0x3b4238, armor: 0x1e293b, trim: 0x475569, eye: 0xf97316 }
      : variant === 'acid_matriarch'
      ? { skin: 0x264b3b, armor: 0x13261d, trim: 0x365314, eye: 0x4ade80 }
      : variant === 'riot_juggernaut'
      ? { skin: 0x475569, armor: 0x0f172a, trim: 0x1d4ed8, eye: 0x22d3ee }
      : { skin: 0x4c1d24, armor: 0x180b10, trim: 0x7f1d1d, eye: 0xfb7185 };

  const skinMat = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.72, metalness: 0.08 });
  const armorMat = new THREE.MeshStandardMaterial({ color: palette.armor, roughness: 0.36, metalness: 0.65 });
  const trimMat = new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.4, metalness: 0.5 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc2, roughness: 0.62, metalness: 0.06 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: palette.eye,
    emissive: palette.eye,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  const tagBody = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'body';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  };
  const tagHead = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'head';
    mesh.castShadow = true;
  };
  const tagLeg = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'leg';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  };
  const tagWeakSpot = (mesh: THREE.Mesh) => {
    mesh.userData.hitbox = 'weakspot';
    mesh.castShadow = true;
    weakSpots.push(mesh);
  };

  // Heavy articulated legs
  const makeBossLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.86, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.115, 0.44, 12), armorMat);
    thigh.position.y = -0.22;
    tagLeg(thigh);
    leg.add(thigh);

    const knee = new THREE.Mesh(
      variant === 'riot_juggernaut'
        ? new THREE.CylinderGeometry(0.115, 0.115, 0.16, 12)
        : new THREE.SphereGeometry(0.11, 10, 10),
      variant === 'riot_juggernaut' ? weakSpotMat : trimMat
    );
    if (variant === 'riot_juggernaut') {
      knee.rotation.z = Math.PI / 2;
      knee.position.set(0, -0.44, -0.05);
      tagWeakSpot(knee);
    } else {
      knee.position.set(0, -0.44, -0.02);
      tagLeg(knee);
    }
    leg.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.088, 0.36, 12), armorMat);
    shin.position.y = -0.62;
    tagLeg(shin);
    leg.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.31), trimMat);
    boot.position.set(0, -0.81, -0.04);
    tagLeg(boot);
    leg.add(boot);

    return leg;
  };

  const leftLeg = makeBossLeg(-0.18);
  const rightLeg = makeBossLeg(0.18);
  torso.add(leftLeg, rightLeg);

  // Pelvis & Massive Boss Torso
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 12), armorMat);
  pelvis.position.set(0, 0.92, 0);
  tagBody(pelvis);
  torso.add(pelvis);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.64, 14), skinMat);
  chest.position.set(0, 1.28, -0.02);
  chest.rotation.x = variant === 'acid_matriarch' ? 0.12 : 0.16;
  tagBody(chest);
  torso.add(chest);

  // Armor Cuirass / Variant-specific torso silhouette + weak spots
  if (variant === 'colossus_reactor') {
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.22), armorMat);
    frontPlate.position.set(0, 1.3, -0.18);
    tagBody(frontPlate);
    torso.add(frontPlate);

    [-0.38, 0.38].forEach((sx) => {
      const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.23, 1), armorMat);
      pauldron.position.set(sx, 1.52, -0.02);
      tagBody(pauldron);
      torso.add(pauldron);
    });

    // WEAK POINT: Dorsal Back Nuclear Reactor Core + Dual Glowing Cylinders!
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.18), trimMat);
    housing.position.set(0, 1.32, 0.26);
    tagBody(housing);
    torso.add(housing);

    const reactorCore = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), weakSpotMat);
    reactorCore.position.set(0, 1.34, 0.39);
    tagWeakSpot(reactorCore);
    torso.add(reactorCore);

    [-0.17, 0.17].forEach((rx) => {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 12), weakSpotMat);
      tube.position.set(rx, 1.34, 0.34);
      tagWeakSpot(tube);
      torso.add(tube);
    });
  } else if (variant === 'acid_matriarch') {
    const carapace = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.24, 0.56, 12), armorMat);
    carapace.position.set(0, 1.28, -0.01);
    tagBody(carapace);
    torso.add(carapace);

    // WEAK POINTS: Glowing Neon-Green Shoulder & Throat Venom Sacs
    [-0.36, 0.36].forEach((sx) => {
      const sac = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), weakSpotMat);
      sac.scale.set(1.1, 1.25, 1.05);
      sac.position.set(sx, 1.52, -0.04);
      tagWeakSpot(sac);
      torso.add(sac);
    });

    const throatSac = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), weakSpotMat);
    throatSac.position.set(0, 1.48, -0.26);
    tagWeakSpot(throatSac);
    torso.add(throatSac);

    const backCyst = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), weakSpotMat);
    backCyst.position.set(0, 1.32, 0.24);
    tagWeakSpot(backCyst);
    torso.add(backCyst);
  } else if (variant === 'riot_juggernaut') {
    const ballisticVest = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 0.42), armorMat);
    ballisticVest.position.set(0, 1.28, -0.02);
    tagBody(ballisticVest);
    torso.add(ballisticVest);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.14, 12), trimMat);
    collar.position.set(0, 1.56, -0.03);
    tagBody(collar);
    torso.add(collar);

    [-0.39, 0.39].forEach((sx) => {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.32), trimMat);
      sh.position.set(sx, 1.48, -0.02);
      tagBody(sh);
      torso.add(sh);
    });
  } else {
    // apex_abomination: Spiked Crimson Horror with Exposed Heart Weak Point
    const ribArmor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.54, 0.36), armorMat);
    ribArmor.position.set(0, 1.28, -0.01);
    tagBody(ribArmor);
    torso.add(ribArmor);

    for (let s = 0; s < 3; s++) {
      const dorsalSpike = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.32, 8), boneMat);
      dorsalSpike.position.set(0, 1.15 + s * 0.18, 0.26);
      dorsalSpike.rotation.x = 0.75;
      tagBody(dorsalSpike);
      torso.add(dorsalSpike);
    }

    // WEAK POINT: Pulsing Crimson Exposed Heart inside Ribcage!
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), weakSpotMat);
    heart.scale.set(1.05, 1.25, 0.95);
    heart.position.set(0, 1.29, -0.24);
    tagWeakSpot(heart);
    torso.add(heart);

    [-0.14, 0.14].forEach((rx) => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.04), boneMat);
      rib.position.set(rx, 1.29, -0.22);
      rib.rotation.z = rx < 0 ? 0.22 : -0.22;
      tagBody(rib);
      torso.add(rib);
    });
  }

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.62, -0.1);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skinMat);
  cranium.position.set(0, 0.2, 0);
  tagHead(cranium);
  headGroup.add(cranium);

  if (variant === 'colossus_reactor') {
    const ironMask = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.34), armorMat);
    ironMask.position.set(0, 0.21, 0);
    tagHead(ironMask);
    headGroup.add(ironMask);
    [-0.14, 0.14].forEach((hx) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 8), trimMat);
      horn.position.set(hx, 0.38, -0.1);
      horn.rotation.x = 0.35;
      tagHead(horn);
      headGroup.add(horn);
    });
  } else if (variant === 'acid_matriarch') {
    for (let i = -2; i <= 2; i++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 6), boneMat);
      crown.position.set(i * 0.075, 0.38, -0.02);
      crown.rotation.z = -i * 0.18;
      tagHead(crown);
      headGroup.add(crown);
    }
  } else if (variant === 'riot_juggernaut') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), armorMat);
    helm.position.set(0, 0.21, 0);
    tagHead(helm);
    headGroup.add(helm);

    // WEAK POINT: Narrow Glowing Cyan Visor Slit!
    const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.065, 0.08), weakSpotMat);
    visorSlit.position.set(0, 0.22, -0.22);
    tagWeakSpot(visorSlit);
    headGroup.add(visorSlit);
  } else {
    // apex_abomination: Horned skull + Cranial Third Eye Weakspot
    [-0.14, 0.14].forEach((hx) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), boneMat);
      horn.position.set(hx, 0.4, -0.04);
      horn.rotation.z = hx < 0 ? 0.35 : -0.35;
      tagHead(horn);
      headGroup.add(horn);
    });
    const thirdEye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), weakSpotMat);
    thirdEye.position.set(0, 0.31, -0.19);
    tagWeakSpot(thirdEye);
    headGroup.add(thirdEye);
  }

  // Boss glowing eyes (except riot_juggernaut which uses visorSlit)
  if (variant !== 'riot_juggernaut') {
    [-0.07, 0.07].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
      eye.position.set(ex, 0.22, -0.19);
      tagHead(eye);
      headGroup.add(eye);
    });
  }

  torso.add(headGroup);

  // Heavy Boss Arms
  const makeBossArm = (x: number, isLeft: boolean) => {
    const arm = new THREE.Group();
    arm.position.set(x, 1.46, -0.04);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.34, 10), armorMat);
    upper.position.set(0, -0.05, -0.16);
    upper.rotation.x = Math.PI / 2.4;
    tagBody(upper);
    arm.add(upper);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.32, 10), skinMat);
    forearm.position.set(0, -0.08, -0.44);
    forearm.rotation.x = Math.PI / 2.1;
    tagBody(forearm);
    arm.add(forearm);

    if (variant === 'riot_juggernaut' && isLeft) {
      // Heavy Ballistic Shield blocking frontal torso!
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.92, 0.09), armorMat);
      shield.position.set(0.05, -0.12, -0.62);
      tagBody(shield);
      const shieldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.1), trimMat);
      shieldTrim.position.set(0.05, 0.16, -0.63);
      tagBody(shieldTrim);
      arm.add(shield, shieldTrim);
    } else if (variant === 'apex_abomination') {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 6), boneMat);
      claw.rotation.x = -Math.PI / 2;
      claw.position.set(0, -0.09, -0.72);
      tagBody(claw);
      arm.add(claw);
    } else {
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.16), trimMat);
      fist.position.set(0, -0.09, -0.62);
      tagBody(fist);
      arm.add(fist);
    }

    return arm;
  };

  const leftArm = makeBossArm(-0.42, true);
  const rightArm = makeBossArm(0.42, false);
  torso.add(leftArm, rightArm);

  // Subtle overhead bar (plus full HUD Boss Bar)
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, 2.32, 0);
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.11),
    new THREE.MeshBasicMaterial({ color: 0x090c10, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.065),
    new THREE.MeshBasicMaterial({ color: spec.weakPointEmissive, side: THREE.DoubleSide })
  );
  hpBarFill.position.z = 0.005;
  hpBarGroup.add(bg, hpBarFill);
  root.add(hpBarGroup);

  return {
    root,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    hpBarFill,
    hpBarGroup,
    weakSpots,
    weakSpotMat,
  };
}

/**
 * Builds Shooting Range Tactical Silhouette Target Dummy
 */
export function buildTargetDummyMesh(targetTex: THREE.CanvasTexture, armored: boolean): TargetDummyRig {
  const root = new THREE.Group();
  const board = new THREE.Group();
  root.add(board);

  const standMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const plateMat = new THREE.MeshStandardMaterial({
    color: armored ? 0x64748b : 0x1e293b,
    metalness: armored ? 0.85 : 0.25,
    roughness: armored ? 0.25 : 0.7,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), standMat);
  base.position.y = 0.04;
  root.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 10), standMat);
  pole.position.y = 0.5;
  root.add(pole);

  const torsoPlate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.88, 0.08), plateMat);
  torsoPlate.position.y = 1.25;
  torsoPlate.userData.hitbox = 'body';
  torsoPlate.castShadow = true;
  board.add(torsoPlate);

  const bullseye = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 24),
    new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.5 })
  );
  bullseye.position.set(0, 1.28, 0.045);
  bullseye.userData.hitbox = 'body';
  board.add(bullseye);

  const headPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.34, 0.08),
    new THREE.MeshStandardMaterial({ color: armored ? 0xf59e0b : 0xef4444, roughness: 0.4, metalness: 0.3 })
  );
  headPlate.position.y = 1.88;
  headPlate.userData.hitbox = 'head';
  headPlate.castShadow = true;
  board.add(headPlate);

  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x090c10, side: THREE.DoubleSide })
  );
  hpBg.position.set(0, 2.22, 0);
  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.055),
    new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
  );
  hpBarFill.position.set(0, 2.22, 0.005);
  board.add(hpBg, hpBarFill);

  return { root, board, hpBarFill };
}

/**
 * Builds a multi-part Wrecked Apocalyptic Car
 */
export function buildWreckedCarMesh(bodyColor: number, rustedTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    map: rustedTex,
    roughness: 0.78,
    metalness: 0.45,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.5, metalness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.6, transparent: true, opacity: 0.65 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 4.3), bodyMat);
  chassis.position.y = 0.56;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  g.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.55, 2.1), bodyMat);
  cabin.position.set(0, 1.12, 0.15);
  cabin.castShadow = true;
  g.add(cabin);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 2.14), glassMat);
  glass.position.set(0, 1.1, 0.15);
  g.add(glass);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.22), rimMat);
  frontBumper.position.set(0, 0.34, -2.18);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = 2.18;
  g.add(frontBumper, rearBumper);

  const wheelCoords: [number, number][] = [
    [-1.02, -1.35],
    [1.02, -1.35],
    [-1.02, 1.35],
    [1.02, 1.35],
  ];
  wheelCoords.forEach(([wx, wz]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, 0.36, wz);
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10), rimMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.36, wz);
    g.add(tire, hub);
  });

  return g;
}

/**
 * Builds an interactive Apocalyptic Supply Crate
 */
export function buildSupplyCrateMesh(crateTex: THREE.CanvasTexture): { root: THREE.Group; lid: THREE.Mesh; indicator: THREE.Mesh } {
  const root = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.65, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e241d, roughness: 0.5, metalness: 0.6 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.78), baseMat);
  body.position.y = 0.31;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.82), trimMat);
  lid.position.y = 0.68;
  lid.castShadow = true;
  root.add(lid);

  const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.06), glowMat);
  indicator.position.set(0, 0.54, 0.4);
  root.add(indicator);

  return { root, lid, indicator };
}

/**
 * Builds a realistic multi-part Drivable Apocalyptic Vehicle oriented along -Z (forward)
 */
export function buildDrivableVehicleMesh(type: VehicleType, rustedTex: THREE.CanvasTexture): DrivableVehicleRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const colorHex =
    type === 'moto'
      ? 0xdc2626
      : type === 'sedan'
      ? 0x1e293b
      : type === 'pickup'
      ? 0x3f6212
      : type === 'sport'
      ? 0xb91c1c
      : type === 'ambulance'
      ? 0xe2e8f0
      : 0xd97706;

  const paintMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    map: type === 'sport' || type === 'moto' ? undefined : rustedTex,
    roughness: type === 'sport' || type === 'moto' ? 0.28 : 0.55,
    metalness: type === 'sport' || type === 'moto' ? 0.72 : 0.45,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6, metalness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.15,
    metalness: 0.75,
    transparent: true,
    opacity: 0.72,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9, metalness: 0.08 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.3,
  });

  if (type === 'moto') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 1.45), trimMat);
    frame.position.set(0, 0.55, 0.04);
    frame.castShadow = true;

    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.44), chromeMat);
    engine.position.set(0, 0.48, -0.05);

    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), paintMat);
    tank.scale.set(0.92, 0.78, 1.45);
    tank.position.set(0, 0.84, -0.28);
    tank.castShadow = true;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.68), trimMat);
    seat.position.set(0, 0.8, 0.28);
    seat.rotation.x = 0.08;

    const tailFender = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.52), paintMat);
    tailFender.position.set(0, 0.82, 0.78);
    tailFender.rotation.x = -0.22;

    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.82, 10), chromeMat);
    exhaustL.rotation.x = Math.PI / 2 + 0.12;
    exhaustL.position.set(-0.22, 0.42, 0.45);
    const exhaustR = exhaustL.clone();
    exhaustR.position.x = 0.22;

    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.42), paintMat);
    fairing.position.set(0, 0.92, -0.68);
    fairing.rotation.x = 0.32;
    const windScreen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.06), glassMat);
    windScreen.position.set(0, 1.12, -0.7);
    windScreen.rotation.x = 0.45;

    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14), headlightMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, 0.88, -0.9);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.06), tailMat);
    tl.position.set(0, 0.84, 1.04);

    bodyGroup.add(frame, engine, tank, seat, tailFender, exhaustL, exhaustR, fairing, windScreen, hl, tl);

    const headlightBeam = new THREE.SpotLight(0xfffbeb, 0, 42, Math.PI / 4.2, 0.45, 1.3);
    headlightBeam.position.set(0, 0.9, -0.95);
    const beamTarget = new THREE.Object3D();
    beamTarget.position.set(0, 0.2, -18);
    root.add(headlightBeam, beamTarget);
    headlightBeam.target = beamTarget;

    const makeMotoWheel = () => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 12), chromeMat);
      rim.rotation.z = Math.PI / 2;
      wg.add(tire, rim);
      return wg;
    };

    const frontSteerLeft = new THREE.Group();
    frontSteerLeft.position.set(0, 0.35, -0.92);
    const wFront = makeMotoWheel();
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.65, 8), chromeMat);
    forkL.position.set(-0.12, 0.28, 0.08);
    forkL.rotation.x = -0.32;
    const forkR = forkL.clone();
    forkR.position.x = 0.12;
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.76, 8), trimMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.64, 0.18);
    frontSteerLeft.add(wFront, forkL, forkR, handlebar);

    const frontSteerRight = new THREE.Group();
    frontSteerRight.position.set(0, 0.35, -0.92);

    const wRear = makeMotoWheel();
    wRear.position.set(0, 0.35, 0.9);

    root.add(frontSteerLeft, frontSteerRight, wRear);
    return {
      root,
      bodyGroup,
      wheels: [wFront, wRear],
      frontSteerLeft,
      frontSteerRight,
      headlightBeam,
      headlightLenses: [hl],
      sirenMeshes: [],
    };
  }

  const width = type === 'ambulance' ? 2.25 : type === 'pickup' ? 2.15 : type === 'buggy' ? 1.95 : 2.05;
  const length = type === 'ambulance' ? 5.1 : type === 'pickup' ? 4.8 : type === 'buggy' ? 3.8 : 4.4;

  // Main Chassis
  const chassisHeight = type === 'sport' ? 0.52 : type === 'buggy' ? 0.42 : 0.64;
  const chassisY = type === 'sport' ? 0.46 : 0.58;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, chassisHeight, length), paintMat);
  chassis.position.y = chassisY;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyGroup.add(chassis);

  // Cabin / Roof
  if (type === 'ambulance') {
    const boxCab = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 1.15, 2.85), paintMat);
    boxCab.position.set(0, 1.35, 0.72);
    boxCab.castShadow = true;
    const redStripe = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, 0.18, 2.88), tailMat);
    redStripe.position.set(0, 1.2, 0.72);
    const frontCab = new THREE.Mesh(new THREE.BoxGeometry(width - 0.18, 0.72, 1.35), paintMat);
    frontCab.position.set(0, 1.15, -1.0);
    const wind = new THREE.Mesh(new THREE.BoxGeometry(width - 0.28, 0.52, 0.12), glassMat);
    wind.position.set(0, 1.18, -1.66);
    wind.rotation.x = 0.22;
    bodyGroup.add(boxCab, redStripe, frontCab, wind);
  } else if (type === 'pickup') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(width - 0.22, 0.72, 1.7), paintMat);
    cab.position.set(0, 1.24, -0.2);
    cab.castShadow = true;
    const wind = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, 0.55, 1.76), glassMat);
    wind.position.set(0, 1.24, -0.2);
    const rollbar = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, 0.45, 0.12), trimMat);
    rollbar.position.set(0, 1.18, 0.85);
    const ramBar = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.44, 0.22), chromeMat);
    ramBar.position.set(0, 0.58, -length / 2 - 0.14);
    bodyGroup.add(cab, wind, rollbar, ramBar);
  } else if (type === 'buggy') {
    const cageL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), trimMat);
    cageL.rotation.x = Math.PI / 2.2;
    cageL.position.set(-0.68, 1.12, 0.15);
    const cageR = cageL.clone();
    cageR.position.x = 0.68;
    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 1.2), trimMat);
    roofBar.position.set(0, 1.48, 0.2);
    bodyGroup.add(cageL, cageR, roofBar);
  } else {
    const cabH = type === 'sport' ? 0.48 : 0.6;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(width - 0.24, cabH, 2.05), paintMat);
    cab.position.set(0, chassisY + chassisHeight / 2 + cabH / 2 - 0.02, 0.2);
    cab.castShadow = true;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, cabH * 0.78, 2.1), glassMat);
    glass.position.copy(cab.position);
    bodyGroup.add(cab, glass);
    if (type === 'sedan') {
      const whiteDoor = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.45, 1.55), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 }));
      whiteDoor.position.set(0, chassisY, 0.1);
      bodyGroup.add(whiteDoor);
    }
    if (type === 'sport') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.08, 0.34), trimMat);
      spoiler.position.set(0, chassisY + 0.44, length / 2 - 0.22);
      bodyGroup.add(spoiler);
    }
  }

  // Front & Rear Bumpers + Headlights + Taillights
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.2, 0.24), trimMat);
  frontBumper.position.set(0, 0.36, -length / 2 - 0.05);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = length / 2 + 0.05;
  bodyGroup.add(frontBumper, rearBumper);

  const headlightLenses: THREE.Mesh[] = [];
  [-width * 0.34, width * 0.34].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headlightMat);
    hl.position.set(hx, chassisY + 0.08, -length / 2 - 0.02);
    bodyGroup.add(hl);
    headlightLenses.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), tailMat);
    tl.position.set(hx, chassisY + 0.1, length / 2 + 0.02);
    bodyGroup.add(tl);
  });

  // Emergency Sirens for Police Sedan & Ambulance
  const sirenMeshes: THREE.Mesh[] = [];
  if (type === 'sedan' || type === 'ambulance') {
    const barY = type === 'ambulance' ? 1.98 : 1.54;
    const barZ = type === 'ambulance' ? -0.8 : 0.15;
    const redL = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 })
    );
    redL.position.set(-0.24, barY, barZ);
    const blueR = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.12, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 2.0 })
    );
    blueR.position.set(0.24, barY, barZ);
    bodyGroup.add(redL, blueR);
    sirenMeshes.push(redL, blueR);
  }

  // Headlight SpotLight oriented forward (-Z)
  const headlightBeam = new THREE.SpotLight(0xfffbeb, 0, 42, Math.PI / 4.5, 0.45, 1.3);
  headlightBeam.position.set(0, 0.9, -length / 2);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0.2, -length / 2 - 18);
  root.add(headlightBeam, beamTarget);
  headlightBeam.target = beamTarget;

  // Wheels (Front pair inside steering pivots)
  const wheelRadius = type === 'pickup' || type === 'buggy' ? 0.44 : 0.37;
  const wheelZ = length * 0.32;
  const wheelX = width * 0.5 + 0.04;

  const makeWheel = () => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.28, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.56, wheelRadius * 0.56, 0.3, 12), chromeMat);
    rim.rotation.z = Math.PI / 2;
    wg.add(tire, rim);
    return wg;
  };

  const frontSteerLeft = new THREE.Group();
  frontSteerLeft.position.set(-wheelX, wheelRadius, -wheelZ);
  const wFL = makeWheel();
  frontSteerLeft.add(wFL);

  const frontSteerRight = new THREE.Group();
  frontSteerRight.position.set(wheelX, wheelRadius, -wheelZ);
  const wFR = makeWheel();
  frontSteerRight.add(wFR);

  const wRL = makeWheel();
  wRL.position.set(-wheelX, wheelRadius, wheelZ);
  const wRR = makeWheel();
  wRR.position.set(wheelX, wheelRadius, wheelZ);

  root.add(frontSteerLeft, frontSteerRight, wRL, wRR);

  return {
    root,
    bodyGroup,
    wheels: [wFL, wFR, wRL, wRR],
    frontSteerLeft,
    frontSteerRight,
    headlightBeam,
    headlightLenses,
    sirenMeshes,
  };
}

/**
 * Builds a realistic multi-part 3D Tactical Hand Grenade (M67 style)
 */
export function buildHandGrenadeMesh(): THREE.Group {
  const root = new THREE.Group();
  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.65, metalness: 0.22 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.86 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.28, metalness: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), oliveMat);
  body.scale.set(1, 1.18, 1);
  body.castShadow = true;
  const collarBand = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.012, 8, 16), steelMat);
  collarBand.rotation.x = Math.PI / 2;
  const fuseNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.075, 10), brassMat);
  fuseNeck.position.y = 0.145;
  const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.125, 0.036), steelMat);
  spoon.position.set(0.068, 0.085, 0);
  spoon.rotation.z = -0.35;
  const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 6, 14), brassMat);
  pullRing.position.set(-0.042, 0.165, 0);
  pullRing.rotation.y = Math.PI / 2;

  root.add(body, collarBand, fuseNeck, spoon, pullRing);
  return root;
}

/**
 * Builds a composite 3D Serrated Steel Bear Trap grounded at y = 0
 */
export function buildBearTrapMesh(): BearTrapRig {
  const root = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.42, metalness: 0.84 });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.24, metalness: 0.92 });
  const panMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0.35,
  });

  // Outer ground frame + cross bar + spring coils
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.032, 8, 20), ironMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.032;
  baseRing.receiveShadow = true;

  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.045, 0.1), ironMat);
  crossBar.position.y = 0.025;

  const springL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10), ironMat);
  springL.rotation.z = Math.PI / 2;
  springL.position.set(-0.48, 0.055, 0);
  const springR = springL.clone();
  springR.position.x = 0.48;

  const triggerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.038, 12), panMat);
  triggerPlate.position.y = 0.055;

  root.add(baseRing, crossBar, springL, springR, triggerPlate);

  // Articulated Jaws with serrated teeth
  const buildHalfJaw = (side: -1 | 1) => {
    const jawPivot = new THREE.Group();
    jawPivot.position.set(side * 0.03, 0.05, 0);

    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.024, 8, 14, Math.PI),
      ironMat
    );
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    arc.castShadow = true;
    jawPivot.add(arc);

    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.38 + (i / 4) * (Math.PI * 0.76);
      const tx = side * Math.cos(ang) * 0.38;
      const tz = Math.sin(ang) * 0.38;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.11, 5), toothMat);
      tooth.position.set(tx, 0.055, tz);
      jawPivot.add(tooth);
    }
    return jawPivot;
  };

  const leftJaw = buildHalfJaw(-1);
  const rightJaw = buildHalfJaw(1);
  root.add(leftJaw, rightJaw);

  return { root, leftJaw, rightJaw, triggerPlate };
}

/**
 * Builds a composite 3D Tactical Anti-Horde Landmine / Claymore grounded at y = 0
 */
export function buildLandmineMesh(): LandmineRig {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f4d34, roughness: 0.68, metalness: 0.18 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  // Base plate & 4 steel anchor legs
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.07, 16), bodyMat);
  base.position.y = 0.035;
  base.castShadow = true;
  base.receiveShadow = true;

  const upperRing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.055, 16), metalMat);
  upperRing.position.y = 0.095;

  const pressureCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.04, 14), bodyMat);
  pressureCap.position.y = 0.135;

  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.14), metalMat);
    fin.position.set(Math.cos(ang) * 0.27, 0.025, Math.sin(ang) * 0.27);
    fin.rotation.y = -ang + Math.PI / 2;
    root.add(fin);
  }

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), ledMat);
  led.position.set(0, 0.165, 0);

  root.add(base, upperRing, pressureCap, led);
  return { root, led };
}

