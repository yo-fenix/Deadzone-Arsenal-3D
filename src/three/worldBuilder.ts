import * as THREE from 'three';
import { ProceduralTexturePack } from './textures';
import { buildWreckedCarMesh } from './models';
import {
  CITY_ARENA_HALF,
  CITY_BARRICADES,
  CITY_BUILDINGS,
  CITY_FIRE_BARRELS,
  CITY_TREE_POSITIONS,
  CITY_WRECKED_CARS,
  ColliderBox,
  SURVIVAL_ARENA_COLLIDERS,
} from './arenaColliders';
import { VehicleType, WeaponId } from '../types/game';

export type { ColliderBox };

export interface WeaponSpawnPoint {
  pos: THREE.Vector3;
  weaponId: WeaponId;
}

export interface VehicleSpawnPoint {
  type: VehicleType;
  name: string;
  pos: THREE.Vector3;
  yaw: number;
  maxSpeed: number;
  accel: number;
  maxHp: number;
}

export interface ArenaBuildResult {
  colliders: ColliderBox[];
  obstacleMeshes: THREE.Object3D[];
  playerSpawns: THREE.Vector3[];
  zombieSpawns: THREE.Vector3[];
  crateSpawns: THREE.Vector3[];
  lootSpawns: THREE.Vector3[];
  weaponSpawns: WeaponSpawnPoint[];
  vehicleSpawns: VehicleSpawnPoint[];
  arenaRadius: number;
}

function makeTextBannerTexture(label: string, bg = '#0f172a', fg = '#f59e0b'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 48);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSurvivalArena(scene: THREE.Scene, textures: ProceduralTexturePack): ArenaBuildResult {
  const colliders: ColliderBox[] = [...SURVIVAL_ARENA_COLLIDERS];
  const obstacleMeshes: THREE.Object3D[] = [];
  const arenaHalf = CITY_ARENA_HALF;

  // Vast surrounding wasteland ground
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(540, 540),
    new THREE.MeshStandardMaterial({ color: 0x131210, roughness: 0.96, metalness: 0.04 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.03;
  outerGround.receiveShadow = true;
  scene.add(outerGround);

  // Main 220m x 220m City Asphalt Base
  textures.asphalt.repeat.set(22, 22);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(arenaHalf * 2 + 4, arenaHalf * 2 + 4),
    new THREE.MeshStandardMaterial({
      map: textures.asphalt,
      roughness: 0.88,
      metalness: 0.08,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Multi-Avenue City Road Grid (Main Cross + Outer Ring Boulevards at ±56m)
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x17191d,
    roughness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const roadCoords = [0, -56, 56];
  roadCoords.forEach((coord) => {
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(13, arenaHalf * 2 - 2), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(coord, 0.014, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(arenaHalf * 2 - 2, 13), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.017, coord);
    roadEW.receiveShadow = true;
    scene.add(roadEW);
  });

  // Lane Dashes across the 3x3 City Street Grid
  const dashMat = new THREE.MeshBasicMaterial({
    color: 0xa1761b,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  roadCoords.forEach((coord) => {
    for (let i = -102; i <= 102; i += 7) {
      if (Math.abs(i) < 7 || Math.abs(Math.abs(i) - 56) < 7) continue;
      const dNS = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3.0), dashMat);
      dNS.rotation.x = -Math.PI / 2;
      dNS.position.set(coord, 0.026, i);
      scene.add(dNS);

      const dEW = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.3), dashMat);
      dEW.rotation.x = -Math.PI / 2;
      dEW.position.set(i, 0.026, coord);
      scene.add(dEW);
    }
  });

  // Streetlamps along Main Avenue intersections
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.4 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const lampCoords: [number, number][] = [
    [-8, -20], [8, 20], [-8, 44], [8, -44],
    [-48, -8], [48, 8], [-64, 48], [64, -48],
  ];
  lampCoords.forEach(([lx, lz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 8), poleMat);
    pole.position.set(lx, 2.6, lz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), poleMat);
    arm.position.set(lx + (lx < 0 ? 0.6 : -0.6), 5.1, lz);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.2), lampGlowMat);
    bulb.position.set(lx + (lx < 0 ? 1.1 : -1.1), 5.02, lz);
    scene.add(pole, arm, bulb);
  });

  // Ruined Skyscraper Skyline outside Quarantine Walls (atmospheric city horizon)
  const skyGeo = new THREE.BoxGeometry(1, 1, 1);
  const skyMat = new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.9, metalness: 0.15 });
  const skyCount = 64;
  const skyline = new THREE.InstancedMesh(skyGeo, skyMat, skyCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < skyCount; i++) {
    const angle = (i / skyCount) * Math.PI * 2;
    const dist = arenaHalf + 18 + (i % 5) * 10;
    const h = 14 + (i % 7) * 7.5;
    const w = 10 + (i % 3) * 5;
    dummy.position.set(Math.cos(angle) * dist, h / 2 - 0.5, Math.sin(angle) * dist);
    dummy.rotation.set(0, angle + (i % 2) * 0.4, 0);
    dummy.scale.set(w, h, w * 0.9);
    dummy.updateMatrix();
    skyline.setMatrixAt(i, dummy.matrix);
  }
  skyline.computeBoundingSphere();
  scene.add(skyline);

  // Dead Trees
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x29231f, roughness: 0.95 });
  CITY_TREE_POSITIONS.forEach(([tx, tz]) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 4.8, 7), treeMat);
    trunk.position.y = 2.4;
    trunk.rotation.z = (Math.random() - 0.5) * 0.14;
    trunk.castShadow = true;
    const branch1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 2.2, 6), treeMat);
    branch1.position.set(0.55, 3.7, 0);
    branch1.rotation.z = -0.65;
    const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 2.0, 6), treeMat);
    branch2.position.set(-0.5, 3.3, 0.2);
    branch2.rotation.z = 0.6;
    tree.add(trunk, branch1, branch2);
    tree.position.set(tx, 0, tz);
    scene.add(tree);
    obstacleMeshes.push(trunk);
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.ruinedConcrete,
    roughness: 0.88,
    metalness: 0.08,
  });
  const hazMat = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.55, metalness: 0.2 });

  const addBoxVisual = (x: number, z: number, w: number, h: number, d: number, mat: THREE.Material, addHazard = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacleMeshes.push(mesh);

    if (addHazard) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.2, d + 0.04), hazMat);
      trim.position.set(x, h - 0.12, z);
      scene.add(trim);
    }
  };

  // Perimeter Quarantine Concrete Walls (220m x 220m)
  const wallH = 4.2;
  addBoxVisual(0, -arenaHalf, arenaHalf * 2 + 2, wallH, 1.8, concreteMat, true);
  addBoxVisual(0, arenaHalf, arenaHalf * 2 + 2, wallH, 1.8, concreteMat, true);
  addBoxVisual(-arenaHalf, 0, 1.8, wallH, arenaHalf * 2 + 2, concreteMat, true);
  addBoxVisual(arenaHalf, 0, 1.8, wallH, arenaHalf * 2 + 2, concreteMat, true);

  // 10 Ruined City Buildings with District Signs
  const buildRuinedBuilding = (cx: number, cz: number, bw: number, bd: number, h: number, label: string) => {
    const t = 0.75;
    const doorW = 3.4;
    const segW = (bw - doorW) / 2;
    const frontZ = cz < 0 ? cz + bd / 2 : cz - bd / 2;
    addBoxVisual(cx - (doorW / 2 + segW / 2), frontZ, segW, h, t, concreteMat);
    addBoxVisual(cx + (doorW / 2 + segW / 2), frontZ, segW, h, t, concreteMat);
    const backZ = cz < 0 ? cz - bd / 2 : cz + bd / 2;
    addBoxVisual(cx, backZ, bw, h * 0.9, t, concreteMat);
    addBoxVisual(cx - bw / 2, cz, t, h, bd, concreteMat);
    const sideSegD = (bd - doorW) / 2;
    addBoxVisual(cx + bw / 2, cz - (doorW / 2 + sideSegD / 2), t, h * 0.85, sideSegD, concreteMat);
    addBoxVisual(cx + bw / 2, cz + (doorW / 2 + sideSegD / 2), t, h * 0.85, sideSegD, concreteMat);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.68, 0.35, bd * 0.68), concreteMat);
    roof.position.set(cx - bw * 0.1, h, cz);
    roof.rotation.z = -0.05;
    roof.castShadow = true;
    roof.receiveShadow = true;
    scene.add(roof);
    obstacleMeshes.push(roof);

    // Rooftop storefront sign facing center avenues
    const signTex = makeTextBannerTexture(label, '#090d14', '#fbbf24');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.4),
      new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    sign.position.set(cx, h - 0.8, frontZ + (cz < 0 ? 0.45 : -0.45));
    scene.add(sign);
  };

  CITY_BUILDINGS.forEach((b) => buildRuinedBuilding(b.cx, b.cz, b.bw, b.bd, b.h, b.label));

  // Static Wrecked Cover Cars
  CITY_WRECKED_CARS.forEach((cp) => {
    const car = buildWreckedCarMesh(cp.color, textures.rustedMetal);
    car.position.set(cp.x, 0, cp.z);
    car.rotation.y = cp.rotY;
    scene.add(car);
    car.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) obstacleMeshes.push(c);
    });
  });

  // Concrete Barricades
  CITY_BARRICADES.forEach(([x, z, w, h, d]) => {
    addBoxVisual(x, z, w, h, d, concreteMat, true);
  });

  // Burning Barrels
  const barrelMat = new THREE.MeshStandardMaterial({ map: textures.rustedMetal, roughness: 0.75, metalness: 0.5 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6b00 });
  CITY_FIRE_BARRELS.forEach(([bx, bz], idx) => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 12), barrelMat);
    barrel.position.set(bx, 0.52, bz);
    barrel.castShadow = true;
    scene.add(barrel);
    obstacleMeshes.push(barrel);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 8), emberMat);
    fire.position.set(bx, 1.2, bz);
    scene.add(fire);
    if (idx < 4) {
      const fLight = new THREE.PointLight(0xff7722, 2.2, 16, 1.8);
      fLight.position.set(bx, 1.5, bz);
      scene.add(fLight);
    }
  });

  const playerSpawns = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-4, 0, 4),
    new THREE.Vector3(4, 0, -4),
    new THREE.Vector3(0, 0, 6),
  ];

  const zombieSpawns = [
    new THREE.Vector3(-48, 0, 0),
    new THREE.Vector3(48, 0, 0),
    new THREE.Vector3(0, 0, -48),
    new THREE.Vector3(0, 0, 48),
    new THREE.Vector3(-56, 0, -56),
    new THREE.Vector3(56, 0, -56),
    new THREE.Vector3(-56, 0, 56),
    new THREE.Vector3(56, 0, 56),
    new THREE.Vector3(-92, 0, 0),
    new THREE.Vector3(92, 0, 0),
    new THREE.Vector3(0, 0, -92),
    new THREE.Vector3(0, 0, 92),
    new THREE.Vector3(-68, 0, -28),
    new THREE.Vector3(68, 0, 28),
  ];

  const crateSpawns = [
    new THREE.Vector3(-27, 0, -27),
    new THREE.Vector3(27, 0, -27),
    new THREE.Vector3(-27, 0, 27),
    new THREE.Vector3(27, 0, 27),
    new THREE.Vector3(-31, 0, -83),
    new THREE.Vector3(31, 0, -83),
    new THREE.Vector3(-31, 0, 83),
    new THREE.Vector3(31, 0, 83),
    new THREE.Vector3(-85, 0, -29),
    new THREE.Vector3(85, 0, 29),
    new THREE.Vector3(-4, 0, -20),
    new THREE.Vector3(22, 0, -5),
    new THREE.Vector3(-56, 0, 12),
    new THREE.Vector3(56, 0, -12),
  ];

  const lootSpawns = [
    new THREE.Vector3(-22, 0, -24),
    new THREE.Vector3(-28, 0, -25),
    new THREE.Vector3(22, 0, -24),
    new THREE.Vector3(28, 0, -25),
    new THREE.Vector3(-22, 0, 24),
    new THREE.Vector3(-28, 0, 25),
    new THREE.Vector3(22, 0, 24),
    new THREE.Vector3(28, 0, 25),
    new THREE.Vector3(-26, 0, -80),
    new THREE.Vector3(26, 0, -80),
    new THREE.Vector3(-26, 0, 80),
    new THREE.Vector3(26, 0, 80),
    new THREE.Vector3(-81, 0, -26),
    new THREE.Vector3(81, 0, 26),
    new THREE.Vector3(-14, 0, 0),
    new THREE.Vector3(14, 0, 0),
    new THREE.Vector3(0, 0, -34),
    new THREE.Vector3(0, 0, 34),
    new THREE.Vector3(-56, 0, -34),
    new THREE.Vector3(56, 0, 34),
    new THREE.Vector3(-38, 0, -56),
    new THREE.Vector3(38, 0, 56),
  ];

  // Physical 3D weapons inside city buildings & checkpoints
  const weaponSpawns: WeaponSpawnPoint[] = [
    { pos: new THREE.Vector3(-24, 0, -26), weaponId: 'mp7_viper' },
    { pos: new THREE.Vector3(24, 0, -26), weaponId: 'spas12' },
    { pos: new THREE.Vector3(-24, 0, 26), weaponId: 'ak_furia' },
    { pos: new THREE.Vector3(24, 0, 26), weaponId: 'awp_espectro' },
    { pos: new THREE.Vector3(6, 0, -42), weaponId: 'deagle_50' },
    { pos: new THREE.Vector3(-48, 0, 22), weaponId: 'scar_pesado' },
    { pos: new THREE.Vector3(48, 0, -22), weaponId: 'gl40' },
    { pos: new THREE.Vector3(-30, 0, -81), weaponId: 'x9_plasma' },
    { pos: new THREE.Vector3(30, 0, 81), weaponId: 'vulcan_laser' },
    { pos: new THREE.Vector3(-83, 0, -27), weaponId: 'm249_titan' },
    { pos: new THREE.Vector3(83, 0, 27), weaponId: 'scar_pesado' },
  ];

  // 5 Drivable Vehicles parked along the city avenues!
  const vehicleSpawns: VehicleSpawnPoint[] = [
    {
      type: 'sedan',
      name: 'Patrulla Policial',
      pos: new THREE.Vector3(3.6, 0, 12),
      yaw: 0,
      maxSpeed: 24,
      accel: 16,
      maxHp: 550,
    },
    {
      type: 'pickup',
      name: 'Camioneta 4x4 Blindada',
      pos: new THREE.Vector3(-15, 0, -3.6),
      yaw: Math.PI / 2,
      maxSpeed: 21,
      accel: 14,
      maxHp: 780,
    },
    {
      type: 'sport',
      name: 'Interceptor Deportivo',
      pos: new THREE.Vector3(56, 0, -18),
      yaw: Math.PI,
      maxSpeed: 31,
      accel: 22,
      maxHp: 440,
    },
    {
      type: 'ambulance',
      name: 'Ambulancia Médica',
      pos: new THREE.Vector3(-56, 0, 24),
      yaw: 0,
      maxSpeed: 20,
      accel: 13,
      maxHp: 720,
    },
    {
      type: 'buggy',
      name: 'Buggy Táctico',
      pos: new THREE.Vector3(24, 0, 56),
      yaw: -Math.PI / 2,
      maxSpeed: 27,
      accel: 20,
      maxHp: 480,
    },
  ];

  return {
    colliders,
    obstacleMeshes,
    playerSpawns,
    zombieSpawns,
    crateSpawns,
    lootSpawns,
    weaponSpawns,
    vehicleSpawns,
    arenaRadius: arenaHalf - 1.5,
  };
}

export function buildPracticeRange(scene: THREE.Scene, textures: ProceduralTexturePack): ArenaBuildResult {
  const colliders: ColliderBox[] = [];
  const obstacleMeshes: THREE.Object3D[] = [];

  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.95 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.y = -0.02;
  scene.add(outerGround);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 72),
    new THREE.MeshStandardMaterial({ map: textures.rangeFloor, roughness: 0.8, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -21);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e2631, roughness: 0.75, metalness: 0.2 });
  const hazMat = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: 0.55 });

  const addWall = (x: number, z: number, w: number, h: number, d: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    obstacleMeshes.push(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY: h });
  };

  addWall(-17, -21, 1.5, 5.5, 74);
  addWall(17, -21, 1.5, 5.5, 74);
  addWall(0, -57, 35, 6.5, 2.0);
  addWall(0, 14, 35, 4.0, 1.5);

  const counterL = new THREE.Mesh(new THREE.BoxGeometry(10, 1.05, 0.8), hazMat);
  counterL.position.set(-8, 0.525, -3);
  counterL.castShadow = true;
  scene.add(counterL);
  obstacleMeshes.push(counterL);
  colliders.push({ minX: -13, maxX: -3, minZ: -3.4, maxZ: -2.6, maxY: 1.05 });

  const counterR = new THREE.Mesh(new THREE.BoxGeometry(10, 1.05, 0.8), hazMat);
  counterR.position.set(8, 0.525, -3);
  counterR.castShadow = true;
  scene.add(counterR);
  obstacleMeshes.push(counterR);
  colliders.push({ minX: 3, maxX: 13, minZ: -3.4, maxZ: -2.6, maxY: 1.05 });

  const beamMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 });
  for (let z = 4; z >= -50; z -= 10) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(34, 0.45, 0.5), beamMat);
    beam.position.set(0, 5.4, z);
    scene.add(beam);
  }

  const distances = [
    { z: -10, label: '10M' },
    { z: -20, label: '20M' },
    { z: -35, label: '35M' },
    { z: -50, label: '50M' },
  ];
  distances.forEach((d) => {
    const tex = makeTextBannerTexture(d.label);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.0),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    sign.position.set(-15.8, 2.8, d.z);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);

    const signR = sign.clone();
    signR.position.set(15.8, 2.8, d.z);
    signR.rotation.y = -Math.PI / 2;
    scene.add(signR);
  });

  return {
    colliders,
    obstacleMeshes,
    playerSpawns: [new THREE.Vector3(0, 0, 4)],
    zombieSpawns: [],
    crateSpawns: [],
    lootSpawns: [],
    weaponSpawns: [],
    vehicleSpawns: [],
    arenaRadius: 56,
  };
}
