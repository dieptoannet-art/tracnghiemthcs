import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Lock, Unlock, KeyRound } from 'lucide-react';

export type VaultVisualState = 'locked' | 'unlocking' | 'open';

export interface VaultSceneProps {
  vaultState: VaultVisualState;
  instantOpen: boolean;
  dialStepCount: number;
  wrongPulseId: number;
  reducedMotion: boolean;
  statusLabel: string;
  onWebGLFallback?: () => void;
}

function createDialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    // Metallic outer ring
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(256, 256, 232, 0, Math.PI * 2);
    ctx.stroke();

    // Inner teal hairline
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(256, 256, 174, 0, Math.PI * 2);
    ctx.stroke();

    // 40 fine precision ticks + 10 major index bars (no answer digits leaked)
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2 - Math.PI / 2;
      const major = i % 4 === 0;
      const rOuter = 216;
      const rInner = major ? 182 : 198;
      ctx.strokeStyle = major ? '#f8fafc' : '#94a3b8';
      ctx.lineWidth = major ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(angle) * rInner, 256 + Math.sin(angle) * rInner);
      ctx.lineTo(256 + Math.cos(angle) * rOuter, 256 + Math.sin(angle) * rOuter);
      ctx.stroke();
    }

    // Center brushed brass hub disc
    const grad = ctx.createRadialGradient(240, 240, 20, 256, 256, 110);
    grad.addColorStop(0, '#fcd34d');
    grad.addColorStop(0.7, '#b45309');
    grad.addColorStop(1, '#78350f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 108, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 3D Mechanical Security Vault Room (Three.js).
 * - Heavy gunmetal vault safe with hollow illuminated gold interior chamber
 * - Left-hinged armored door with 20 instanced brass rivets, 3 retracting locking bolts,
 *   5-spoke brass wheel handle, and rotating combination dial
 * - Stable studio camera framing, RoomEnvironment reflections, software-WebGL sync guard,
 *   instantOpen support (for "Bỏ qua hoạt ảnh" & session restore), and clean WebGL fallback.
 */
export const Vault3DScene: React.FC<VaultSceneProps> = ({
  vaultState,
  instantOpen,
  dialStepCount,
  wrongPulseId,
  reducedMotion,
  statusLabel,
  onWebGLFallback,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({
    vaultState,
    instantOpen,
    dialStepCount,
    wrongPulseId,
    reducedMotion,
  });

  const wrongAnimRef = useRef<{ lastId: number; startedAt: number }>({
    lastId: wrongPulseId,
    startedAt: 0,
  });

  useEffect(() => {
    if (wrongPulseId !== wrongAnimRef.current.lastId) {
      wrongAnimRef.current = { lastId: wrongPulseId, startedAt: performance.now() };
    }
    propsRef.current = {
      vaultState,
      instantOpen,
      dialStepCount,
      wrongPulseId,
      reducedMotion,
    };
  }, [vaultState, instantOpen, dialStepCount, wrongPulseId, reducedMotion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Probe software WebGL via renderer string
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const glProbe = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!glProbe) return true;
        const ext = glProbe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : glProbe.RENDERER;
        const gpu = String(glProbe.getParameter(param) || '');
        glProbe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      onWebGLFallback?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      onWebGLFallback?.();
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 440, container.clientHeight || 360);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const onContextLost = (e: Event) => {
      e.preventDefault();
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Scene & Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050c1c);
    scene.fog = new THREE.FogExp2(0x050c1c, 0.045);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Camera — steady slightly off-center 3/4 view showing front door, hinges, handle & interior reveal
    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 440) / (container.clientHeight || 360),
      0.1,
      50
    );
    camera.position.set(1.05, 1.55, 5.25);
    camera.lookAt(0.05, 1.18, 0);

    // Three-point warm/cool lighting rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0b132b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(3.8, 5.2, 4.8);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -2;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const tealRimLight = new THREE.DirectionalLight(0x14b8a6, 0.95);
    tealRimLight.position.set(-4.2, 2.8, -2.5);
    scene.add(tealRimLight);

    // Warm interior golden treasure glow (scales up as vault opens!)
    const goldInteriorLight = new THREE.PointLight(0xfbbf24, 0.35, 6.5, 1.6);
    goldInteriorLight.position.set(0, 1.25, 0.1);
    scene.add(goldInteriorLight);

    // Materials (varied roughness & metalness >= 0.25 contrast between steel, brass & slate)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b152b,
      roughness: 0.72,
      metalness: 0.15,
    });
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x102140,
      roughness: 0.55,
      metalness: 0.28,
    });
    const tealStripMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 0.75,
      roughness: 0.25,
      metalness: 0.35,
    });
    const vaultSteelMat = new THREE.MeshStandardMaterial({
      color: 0x263449,
      roughness: 0.44,
      metalness: 0.76,
    });
    const darkSteelTrimMat = new THREE.MeshStandardMaterial({
      color: 0x172133,
      roughness: 0.36,
      metalness: 0.82,
    });
    const interiorChamberMat = new THREE.MeshStandardMaterial({
      color: 0x1c2538,
      roughness: 0.62,
      metalness: 0.35,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf5b942,
      roughness: 0.22,
      metalness: 0.9,
    });
    const boltChromeMat = new THREE.MeshStandardMaterial({
      color: 0xdbe4ee,
      roughness: 0.18,
      metalness: 0.92,
    });
    const statusLedMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    });
    const goldCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.16,
      metalness: 0.82,
    });

    // Vault Room Floor & Pedestal Plinth (grounded at y = 0)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 2.7), plinthMat);
    plinth.position.set(0, 0.08, 0);
    plinth.receiveShadow = true;
    scene.add(plinth);

    const plinthTealTrim = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.04, 2.76), tealStripMat);
    plinthTealTrim.position.set(0, 0.16, 0);
    scene.add(plinthTealTrim);

    // Vault Assembly Root (bottom-center seated flush on plinth y = 0.16)
    const vaultRoot = new THREE.Group();
    vaultRoot.position.set(0, 0.16, 0);
    scene.add(vaultRoot);

    const W = 2.46;
    const H = 2.34;
    const D = 1.9;
    const wallT = 0.22;

    // Hollow armored body (back, bottom, top, left, right walls)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), vaultSteelMat);
    backWall.position.set(0, H / 2, -D / 2 + wallT / 2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;

    const bottomWall = new THREE.Mesh(new THREE.BoxGeometry(W, wallT, D), vaultSteelMat);
    bottomWall.position.set(0, wallT / 2, 0);
    bottomWall.receiveShadow = true;

    const topWall = new THREE.Mesh(new THREE.BoxGeometry(W, wallT, D), vaultSteelMat);
    topWall.position.set(0, H - wallT / 2, 0);
    topWall.castShadow = true;

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H - wallT * 2, D), vaultSteelMat);
    leftWall.position.set(-W / 2 + wallT / 2, H / 2, 0);
    leftWall.castShadow = true;

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H - wallT * 2, D), vaultSteelMat);
    rightWall.position.set(W / 2 - wallT / 2, H / 2, 0);
    rightWall.castShadow = true;

    // Inner lining + golden prize pedestal inside vault chamber
    const innerFloor = new THREE.Mesh(
      new THREE.BoxGeometry(W - wallT * 2 - 0.04, 0.08, D - wallT - 0.12),
      interiorChamberMat
    );
    innerFloor.position.set(0, wallT + 0.04, -0.04);

    const prizePedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.24, 24),
      darkSteelTrimMat
    );
    prizePedestal.position.set(0, wallT + 0.2, -0.1);

    const prizeRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 12, 32), brassMat);
    prizeRing.rotation.x = Math.PI / 2;
    prizeRing.position.set(0, wallT + 0.32, -0.1);

    const prizeCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), goldCrystalMat);
    prizeCrystal.position.set(0, wallT + 0.82, -0.1);

    // Top status light bezel on vault crown
    const crownBezel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.18), darkSteelTrimMat);
    crownBezel.position.set(0, H + 0.07, D / 2 - 0.12);

    const statusLedBar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.06), statusLedMat);
    statusLedBar.position.set(0, H + 0.07, D / 2 - 0.01);

    vaultRoot.add(
      backWall,
      bottomWall,
      topWall,
      leftWall,
      rightWall,
      innerFloor,
      prizePedestal,
      prizeRing,
      prizeCrystal,
      crownBezel,
      statusLedBar
    );

    // Twin cylindrical left-side hinges fixed to vault edge
    const hingeX = -W / 2 + 0.08;
    const hingeZ = D / 2 + 0.06;
    const hingeGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.36, 18);
    const hingeTop = new THREE.Mesh(hingeGeo, darkSteelTrimMat);
    hingeTop.position.set(hingeX, H * 0.75, hingeZ);
    const hingeBot = new THREE.Mesh(hingeGeo, darkSteelTrimMat);
    hingeBot.position.set(hingeX, H * 0.25, hingeZ);

    const hingeCapGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 18);
    [H * 0.75 + 0.19, H * 0.75 - 0.19, H * 0.25 + 0.19, H * 0.25 - 0.19].forEach((hy) => {
      const cap = new THREE.Mesh(hingeCapGeo, brassMat);
      cap.position.set(hingeX, hy, hingeZ);
      vaultRoot.add(cap);
    });
    vaultRoot.add(hingeTop, hingeBot);

    // HINGED VAULT DOOR PIVOT (rotates around Y at left hinge axis!)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(hingeX, H / 2, hingeZ);
    vaultRoot.add(doorPivot);

    const doorW = W - 0.18;
    const doorH = H - 0.18;
    const doorD = 0.16;
    const doorCenterX = doorW / 2 - 0.02;

    const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, doorD), vaultSteelMat);
    doorSlab.position.set(doorCenterX, 0, -0.02);
    doorSlab.castShadow = true;
    doorSlab.receiveShadow = true;
    doorPivot.add(doorSlab);

    const doorInset = new THREE.Mesh(
      new THREE.BoxGeometry(doorW - 0.3, doorH - 0.3, 0.04),
      darkSteelTrimMat
    );
    doorInset.position.set(doorCenterX, 0, doorD / 2 - 0.01);
    doorPivot.add(doorInset);

    // 20 Instanced Brass Perimeter Rivets on door face
    const rivetPositions: Array<[number, number]> = [];
    for (let i = 0; i < 6; i++) {
      const rx = doorCenterX - (doorW / 2 - 0.11) + (i / 5) * (doorW - 0.22);
      rivetPositions.push([rx, doorH / 2 - 0.1]);
      rivetPositions.push([rx, -(doorH / 2 - 0.1)]);
    }
    for (let j = 1; j <= 4; j++) {
      const ry = -(doorH / 2 - 0.1) + (j / 5) * (doorH - 0.2);
      rivetPositions.push([doorCenterX - (doorW / 2 - 0.11), ry]);
      rivetPositions.push([doorCenterX + (doorW / 2 - 0.11), ry]);
    }
    const rivetGeo = new THREE.SphereGeometry(0.032, 10, 10);
    const rivetInst = new THREE.InstancedMesh(rivetGeo, brassMat, rivetPositions.length);
    const dummy = new THREE.Object3D();
    rivetPositions.forEach(([rx, ry], idx) => {
      dummy.position.set(rx, ry, doorD / 2 + 0.005);
      dummy.updateMatrix();
      rivetInst.setMatrixAt(idx, dummy.matrix);
    });
    rivetInst.instanceMatrix.needsUpdate = true;
    rivetInst.computeBoundingSphere();
    doorPivot.add(rivetInst);

    // 3 Sliding Steel Locking Bolts on right edge of door
    const boltsGroup = new THREE.Group();
    doorPivot.add(boltsGroup);
    const boltGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.28, 16);
    boltGeo.rotateZ(Math.PI / 2);
    [-0.55, 0, 0.55].forEach((by) => {
      const bolt = new THREE.Mesh(boltGeo, boltChromeMat);
      bolt.position.set(doorCenterX + doorW / 2 + 0.02, by, -0.02);
      boltsGroup.add(bolt);
    });

    // 5-Spoke Brass Wheel Handle (center-left of door face)
    const handleGroup = new THREE.Group();
    handleGroup.position.set(doorCenterX - 0.12, -0.02, doorD / 2 + 0.12);
    doorPivot.add(handleGroup);

    const handleShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.18, 20).rotateX(Math.PI / 2),
      darkSteelTrimMat
    );
    handleShaft.position.z = -0.05;
    handleGroup.add(handleShaft);

    const handleHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.09, 20).rotateX(Math.PI / 2),
      brassMat
    );
    handleGroup.add(handleHub);

    const handleRim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.042, 14, 36), brassMat);
    handleGroup.add(handleRim);

    const spokeGeo = new THREE.CylinderGeometry(0.024, 0.028, 0.54, 12);
    const knobGeo = new THREE.SphereGeometry(0.048, 12, 12);
    for (let s = 0; s < 5; s++) {
      const angle = (s / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, brassMat);
      spoke.position.set(Math.cos(angle) * 0.26, Math.sin(angle) * 0.26, 0);
      spoke.rotation.z = angle - Math.PI / 2;
      handleGroup.add(spoke);

      const knob = new THREE.Mesh(knobGeo, brassMat);
      knob.position.set(Math.cos(angle) * 0.53, Math.sin(angle) * 0.53, 0.01);
      handleGroup.add(knob);
    }

    // Precision Combination Lock Dial (right of spoked wheel)
    const dialTexture = createDialTexture();
    dialTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const dialGroup = new THREE.Group();
    dialGroup.position.set(doorCenterX + 0.62, 0.1, doorD / 2 + 0.07);
    doorPivot.add(dialGroup);

    const dialRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.29, 0.08, 32).rotateX(Math.PI / 2),
      darkSteelTrimMat
    );
    dialGroup.add(dialRim);

    const dialFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.245, 0.245, 0.04, 32).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: dialTexture,
        roughness: 0.3,
        metalness: 0.45,
      })
    );
    dialFace.position.z = 0.045;
    dialGroup.add(dialFace);

    // Stationary top red/gold index pointer above dial
    const dialPointer = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 4), brassMat);
    dialPointer.rotation.z = Math.PI;
    dialPointer.position.set(doorCenterX + 0.62, 0.42, doorD / 2 + 0.09);
    doorPivot.add(dialPointer);

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Responsive ResizeObserver
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !renderer) return;
      const w = Math.max(220, Math.floor(entry.contentRect.width));
      const h = Math.max(200, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // Animation state variables
    let currentDoorAngle = propsRef.current.vaultState === 'open' ? -1.82 : 0;
    let currentHandleAngle = propsRef.current.vaultState === 'open' ? Math.PI * 1.5 : 0;
    let currentDialAngle = 0;
    let currentBoltRetract = propsRef.current.vaultState === 'open' ? -0.18 : 0;

    doorPivot.rotation.y = currentDoorAngle;
    handleGroup.rotation.z = currentHandleAngle;
    boltsGroup.position.x = currentBoltRetract;

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      if (disposed) return;
      if (gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed || !renderer) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const cur = propsRef.current;
      const isOpenOrOpening = cur.vaultState === 'unlocking' || cur.vaultState === 'open';
      const targetDoor = isOpenOrOpening ? -1.82 : 0;
      const targetHandle = isOpenOrOpening ? Math.PI * 1.5 : 0;
      const targetBolt = isOpenOrOpening ? -0.18 : 0;
      const targetDial = cur.dialStepCount * 0.55;

      if (cur.instantOpen || cur.reducedMotion) {
        currentDoorAngle = targetDoor;
        currentHandleAngle = targetHandle;
        currentBoltRetract = targetBolt;
        currentDialAngle = targetDial;
      } else {
        currentHandleAngle = THREE.MathUtils.damp(currentHandleAngle, targetHandle, 7, dt);
        currentBoltRetract = THREE.MathUtils.damp(currentBoltRetract, targetBolt, 9, dt);
        // Door swings open once handle starts turning
        const doorReady = !isOpenOrOpening || Math.abs(currentHandleAngle) > 1.1;
        if (doorReady) {
          currentDoorAngle = THREE.MathUtils.damp(currentDoorAngle, targetDoor, 4.5, dt);
        }
        currentDialAngle = THREE.MathUtils.damp(currentDialAngle, targetDial, 10, dt);
      }

      // Wrong code subtle shake & crimson LED flash
      const wrongAge = (now - wrongAnimRef.current.startedAt) / 1000;
      let shakeOffset = 0;
      const isWrongFlash = wrongAnimRef.current.startedAt > 0 && wrongAge >= 0 && wrongAge < 0.55;
      if (isWrongFlash && !cur.reducedMotion && !isOpenOrOpening) {
        shakeOffset = Math.sin(wrongAge * 44) * 0.045 * (1 - wrongAge / 0.55);
      }

      doorPivot.rotation.y = currentDoorAngle;
      handleGroup.rotation.z = currentHandleAngle + shakeOffset * 2.2;
      boltsGroup.position.x = currentBoltRetract;
      dialGroup.rotation.z = -currentDialAngle;
      vaultRoot.position.x = shakeOffset;

      // Interior golden glow & prize crystal hover
      const openRatio = Math.min(1, Math.abs(currentDoorAngle) / 1.6);
      goldInteriorLight.intensity = 0.25 + openRatio * 5.2;
      if (!cur.reducedMotion) {
        prizeCrystal.rotation.y = now * 0.0012;
        prizeCrystal.position.y = wallT + 0.82 + Math.sin(now * 0.003) * 0.05;
      }

      // Status LED bar color (paired with explicit DOM text below)
      if (isOpenOrOpening) {
        statusLedMat.color.setHex(0xfde047);
        statusLedMat.emissive.setHex(0xf59e0b);
        statusLedMat.emissiveIntensity = 1.6;
      } else if (isWrongFlash) {
        statusLedMat.color.setHex(0xfb7185);
        statusLedMat.emissive.setHex(0xe11d48);
        statusLedMat.emissiveIntensity = 1.6;
      } else {
        statusLedMat.color.setHex(0x2dd4bf);
        statusLedMat.emissive.setHex(0x0d9488);
        statusLedMat.emissiveIntensity = 1.05;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      ro.disconnect();
      renderer?.domElement.removeEventListener('webglcontextlost', onContextLost);
      dialTexture.dispose();
      envRT.dispose();

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });

      renderer?.dispose();
      if (container) container.innerHTML = '';
    };
  }, [onWebGLFallback]);

  return (
    <div className="relative w-full h-full min-h-[290px] sm:min-h-[360px] rounded-xl overflow-hidden bg-[#050C1C] border border-slate-800">
      <div ref={containerRef} className="w-full h-full" aria-label="Phòng giải mã két sắt 3D" />
      {/* Explicit non-color-only state readout on solid surface (no backdrop-blur over WebGL) */}
      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#09142A]/95 border border-slate-700 text-xs font-bold text-white pointer-events-none">
        {vaultState === 'open' || vaultState === 'unlocking' ? (
          <Unlock className="w-3.5 h-3.5 text-amber-300" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-teal-300" />
        )}
        <span>{statusLabel}</span>
      </div>
    </div>
  );
};

/**
 * Full-function 2D Mechanical Vault SVG Fallback (used automatically when WebGL is unavailable
 * or when the user chooses "2D nhẹ").
 */
export const Vault2DFallback: React.FC<VaultSceneProps> = ({
  vaultState,
  dialStepCount,
  statusLabel,
}) => {
  const isOpen = vaultState === 'open' || vaultState === 'unlocking';
  const dialRot = (dialStepCount * 36) % 360;

  return (
    <div className="relative w-full h-full min-h-[290px] sm:min-h-[360px] rounded-xl overflow-hidden bg-[#061126] border border-slate-800 flex flex-col items-center justify-center p-4">
      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#09142A] border border-slate-700 text-xs font-bold text-white">
        {isOpen ? (
          <Unlock className="w-3.5 h-3.5 text-amber-300" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-teal-300" />
        )}
        <span>{statusLabel}</span>
      </div>

      <svg
        viewBox="0 0 380 300"
        className="w-full max-w-[360px] h-auto select-none"
        role="img"
        aria-label={isOpen ? 'Két sắt cơ khí đang mở' : 'Két sắt cơ khí đang khóa'}
      >
        <defs>
          <radialGradient id="f05GoldGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0.85" />
            <stop offset="65%" stopColor="#d97706" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Plinth base */}
        <rect x="42" y="258" width="296" height="18" rx="6" fill="#0f2140" stroke="#14b8a6" strokeWidth="2" />

        {/* Armored vault chassis */}
        <rect x="74" y="34" width="232" height="224" rx="14" fill="#1e2d45" stroke="#334155" strokeWidth="4" />

        {/* Status crown light */}
        <rect x="148" y="22" width="84" height="14" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="2" />
        <rect x="160" y="26" width="60" height="6" rx="3" fill={isOpen ? '#fbbf24' : '#2dd4bf'} />

        {/* Interior chamber */}
        <rect x="96" y="56" width="188" height="180" rx="8" fill="#0c1528" stroke="#475569" strokeWidth="2" />

        {isOpen ? (
          <g>
            {/* Warm golden interior reveal */}
            <circle cx="190" cy="146" r="78" fill="url(#f05GoldGlow)" />
            <polygon
              points="190,94 222,146 190,198 158,146"
              fill="#fbbf24"
              stroke="#fef08a"
              strokeWidth="3"
            />
            <rect x="146" y="206" width="88" height="18" rx="5" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
            {/* Swung-open door silhouette on left hinge */}
            <polygon
              points="74,46 32,26 32,262 74,246"
              fill="#263449"
              stroke="#64748b"
              strokeWidth="3"
            />
          </g>
        ) : (
          <g>
            {/* Closed armored door face */}
            <rect x="92" y="52" width="196" height="188" rx="10" fill="#263449" stroke="#64748b" strokeWidth="3" />
            <rect x="106" y="66" width="168" height="160" rx="6" fill="#172236" stroke="#334155" strokeWidth="2" />

            {/* Locking bolts on right edge */}
            <rect x="282" y="88" width="18" height="14" rx="3" fill="#cbd5e1" />
            <rect x="282" y="139" width="18" height="14" rx="3" fill="#cbd5e1" />
            <rect x="282" y="190" width="18" height="14" rx="3" fill="#cbd5e1" />

            {/* 5-Spoke Brass Handle Wheel */}
            <g transform="translate(168, 146)">
              <circle r="38" fill="none" stroke="#f59e0b" strokeWidth="7" />
              {[0, 72, 144, 216, 288].map((deg) => (
                <g key={deg} transform={`rotate(${deg})`}>
                  <line x1="0" y1="0" x2="0" y2="-46" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="0" cy="-47" r="5" fill="#fde047" />
                </g>
              ))}
              <circle r="11" fill="#d97706" stroke="#fef08a" strokeWidth="2" />
            </g>

            {/* Rotating Combination Dial */}
            <g transform={`translate(242, 142) rotate(${dialRot})`}>
              <circle r="24" fill="#0f172a" stroke="#f59e0b" strokeWidth="3.5" />
              <circle r="15" fill="none" stroke="#14b8a6" strokeWidth="2" strokeDasharray="4 4" />
              <circle r="7" fill="#fbbf24" />
              <line x1="0" y1="-22" x2="0" y2="-12" stroke="#ffffff" strokeWidth="3" />
            </g>
          </g>
        )}

        {/* Left cylindrical hinges */}
        <rect x="66" y="74" width="18" height="36" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
        <rect x="66" y="182" width="18" height="36" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
      </svg>

      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
        <KeyRound className="w-3.5 h-3.5 text-teal-400" />
        <span>Chế độ 2D nhẹ (đầy đủ chức năng giải mã)</span>
      </div>
    </div>
  );
};
