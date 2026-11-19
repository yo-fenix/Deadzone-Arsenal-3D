import * as THREE from 'three';

export interface ProceduralTexturePack {
  asphalt: THREE.CanvasTexture;
  rangeFloor: THREE.CanvasTexture;
  hazard: THREE.CanvasTexture;
  crate: THREE.CanvasTexture;
  ruinedConcrete: THREE.CanvasTexture;
  rustedMetal: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  targetRing: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  // 1. Weathered cracked apocalyptic asphalt
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#1b1d20';
  actx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 18 + Math.floor(Math.random() * 28);
    actx.fillStyle = `rgb(${v + 2},${v},${v - 2})`;
    actx.fillRect(x, y, 2, 2);
  }
  // Cracks & ash patches
  actx.strokeStyle = 'rgba(10, 10, 10, 0.55)';
  actx.lineWidth = 1.5;
  for (let c = 0; c < 14; c++) {
    actx.beginPath();
    let cx = Math.random() * 512;
    let cy = Math.random() * 512;
    actx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * 80;
      cy += (Math.random() - 0.5) * 80;
      actx.lineTo(cx, cy);
    }
    actx.stroke();
  }
  actx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  actx.lineWidth = 2;
  actx.strokeRect(2, 2, 508, 508);

  const asphalt = new THREE.CanvasTexture(asphaltCanvas);
  asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(32, 32);
  asphalt.anisotropy = maxAnisotropy;

  // 2. Firing range floor with lane stripes
  const rangeCanvas = document.createElement('canvas');
  rangeCanvas.width = 512;
  rangeCanvas.height = 512;
  const rctx = rangeCanvas.getContext('2d')!;
  rctx.fillStyle = '#141920';
  rctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2000; i++) {
    const v = 18 + Math.floor(Math.random() * 16);
    rctx.fillStyle = `rgb(${v},${v + 4},${v + 9})`;
    rctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  rctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  rctx.lineWidth = 4;
  rctx.strokeRect(12, 0, 488, 512);
  rctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  rctx.lineWidth = 2;
  for (let y = 64; y < 512; y += 128) {
    rctx.beginPath();
    rctx.moveTo(0, y);
    rctx.lineTo(512, y);
    rctx.stroke();
  }

  const rangeFloor = new THREE.CanvasTexture(rangeCanvas);
  rangeFloor.colorSpace = THREE.SRGBColorSpace;
  rangeFloor.wrapS = THREE.RepeatWrapping;
  rangeFloor.wrapT = THREE.RepeatWrapping;
  rangeFloor.repeat.set(6, 14);
  rangeFloor.anisotropy = maxAnisotropy;

  // 3. Yellow/Black Hazard Stripes
  const hazCanvas = document.createElement('canvas');
  hazCanvas.width = 256;
  hazCanvas.height = 256;
  const hctx = hazCanvas.getContext('2d')!;
  hctx.fillStyle = '#b45309';
  hctx.fillRect(0, 0, 256, 256);
  hctx.fillStyle = '#111827';
  for (let i = -256; i < 512; i += 48) {
    hctx.beginPath();
    hctx.moveTo(i, 0);
    hctx.lineTo(i + 24, 0);
    hctx.lineTo(i + 280, 256);
    hctx.lineTo(i + 256, 256);
    hctx.closePath();
    hctx.fill();
  }
  const hazard = new THREE.CanvasTexture(hazCanvas);
  hazard.colorSpace = THREE.SRGBColorSpace;
  hazard.wrapS = THREE.RepeatWrapping;
  hazard.wrapT = THREE.RepeatWrapping;
  hazard.anisotropy = maxAnisotropy;

  // 4. Military Supply Crate
  const crateCanvas = document.createElement('canvas');
  crateCanvas.width = 256;
  crateCanvas.height = 256;
  const cctx = crateCanvas.getContext('2d')!;
  cctx.fillStyle = '#333b32';
  cctx.fillRect(0, 0, 256, 256);
  cctx.strokeStyle = '#1e241d';
  cctx.lineWidth = 18;
  cctx.strokeRect(9, 9, 238, 238);
  cctx.strokeStyle = '#475345';
  cctx.lineWidth = 6;
  cctx.beginPath();
  cctx.moveTo(22, 22);
  cctx.lineTo(234, 234);
  cctx.moveTo(234, 22);
  cctx.lineTo(22, 234);
  cctx.stroke();
  cctx.fillStyle = '#d97706';
  cctx.fillRect(88, 114, 80, 28);

  const crate = new THREE.CanvasTexture(crateCanvas);
  crate.colorSpace = THREE.SRGBColorSpace;
  crate.anisotropy = maxAnisotropy;

  // 5. Ruined Weathered Concrete
  const concCanvas = document.createElement('canvas');
  concCanvas.width = 256;
  concCanvas.height = 256;
  const nctx = concCanvas.getContext('2d')!;
  nctx.fillStyle = '#3a3b38';
  nctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const v = 42 + Math.floor(Math.random() * 35);
    nctx.fillStyle = `rgba(${v},${v - 2},${v - 4},0.45)`;
    nctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  // Vertical water/soot streaks
  for (let s = 0; s < 16; s++) {
    const x = Math.random() * 256;
    const grad = nctx.createLinearGradient(x, 0, x, 256);
    grad.addColorStop(0, 'rgba(15,15,15,0.45)');
    grad.addColorStop(1, 'rgba(15,15,15,0)');
    nctx.fillStyle = grad;
    nctx.fillRect(x, 0, 6 + Math.random() * 10, 256);
  }
  const ruinedConcrete = new THREE.CanvasTexture(concCanvas);
  ruinedConcrete.colorSpace = THREE.SRGBColorSpace;
  ruinedConcrete.wrapS = THREE.RepeatWrapping;
  ruinedConcrete.wrapT = THREE.RepeatWrapping;
  ruinedConcrete.anisotropy = maxAnisotropy;

  // 6. Rusted Metal
  const rustCanvas = document.createElement('canvas');
  rustCanvas.width = 256;
  rustCanvas.height = 256;
  const uctx = rustCanvas.getContext('2d')!;
  uctx.fillStyle = '#4a352a';
  uctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    uctx.fillStyle = Math.random() > 0.5 ? 'rgba(120,53,15,0.35)' : 'rgba(40,38,36,0.4)';
    uctx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
  }
  const rustedMetal = new THREE.CanvasTexture(rustCanvas);
  rustedMetal.colorSpace = THREE.SRGBColorSpace;
  rustedMetal.anisotropy = maxAnisotropy;

  // 7. Soft radial contact shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  // 8. Shooting range bullseye target texture
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = 256;
  targetCanvas.height = 256;
  const tctx = targetCanvas.getContext('2d')!;
  tctx.fillStyle = '#e2e8f0';
  tctx.fillRect(0, 0, 256, 256);
  tctx.fillStyle = '#0f172a';
  tctx.beginPath();
  tctx.arc(128, 128, 108, 0, Math.PI * 2);
  tctx.fill();
  tctx.fillStyle = '#f8fafc';
  tctx.beginPath();
  tctx.arc(128, 128, 76, 0, Math.PI * 2);
  tctx.fill();
  tctx.fillStyle = '#ef4444';
  tctx.beginPath();
  tctx.arc(128, 128, 44, 0, Math.PI * 2);
  tctx.fill();
  tctx.fillStyle = '#facc15';
  tctx.beginPath();
  tctx.arc(128, 128, 18, 0, Math.PI * 2);
  tctx.fill();

  const targetRing = new THREE.CanvasTexture(targetCanvas);
  targetRing.colorSpace = THREE.SRGBColorSpace;
  targetRing.anisotropy = maxAnisotropy;

  return {
    asphalt,
    rangeFloor,
    hazard,
    crate,
    ruinedConcrete,
    rustedMetal,
    contactShadow,
    targetRing,
    dispose: () => {
      asphalt.dispose();
      rangeFloor.dispose();
      hazard.dispose();
      crate.dispose();
      ruinedConcrete.dispose();
      rustedMetal.dispose();
      contactShadow.dispose();
      targetRing.dispose();
    },
  };
}
