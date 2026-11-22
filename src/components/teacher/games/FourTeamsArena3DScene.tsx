import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArenaPlayMode, ArenaTeamSlotId, ArenaTeamStats } from './fourTeamsArena3dEngine';

export interface FourTeamsArenaSceneProps {
  playMode: ArenaPlayMode;
  teamStats: ArenaTeamStats[];
  activeDoubles: Record<ArenaTeamSlotId, boolean>;
  maxPossibleScore: number;
  compact: boolean;
  reducedMotion: boolean;
  skipEffectToken: number;
  scorePulseToken: number;
  onWebGLFallback?: () => void;
}

function createTeamBadgeTexture(letter: string, bgHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0b152a';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = bgHex;
    ctx.lineWidth = 22;
    ctx.strokeRect(18, 18, 220, 220);

    ctx.fillStyle = bgHex;
    ctx.beginPath();
    ctx.arc(128, 128, 76, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 108px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 128, 134);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 3D Four-Team Symmetrical Quiz Arena Stage (Three.js).
 * - Four identical-size symmetrical podiums (A, B, C, D) in fixed left-to-right slots
 *   with individual team spotlights, rising 3D score pillars, and golden Double-Power crowns.
 * - Practice mode displays ONE centered solo podium (zero fake opponent podiums).
 * - Compact framing when question board owns center stage; instant snap on skipEffectToken or reducedMotion.
 */
export const FourTeamsArena3DScene: React.FC<FourTeamsArenaSceneProps> = ({
  playMode,
  teamStats,
  activeDoubles,
  maxPossibleScore,
  compact,
  reducedMotion,
  skipEffectToken,
  scorePulseToken,
  onWebGLFallback,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({
    playMode,
    teamStats,
    activeDoubles,
    maxPossibleScore,
    compact,
    reducedMotion,
    skipEffectToken,
    scorePulseToken,
  });

  const pulseRef = useRef<{ lastToken: number; startedAt: number }>({
    lastToken: scorePulseToken,
    startedAt: 0,
  });
  const lastSkipTokenRef = useRef<number>(skipEffectToken);

  useEffect(() => {
    if (scorePulseToken !== pulseRef.current.lastToken) {
      pulseRef.current = { lastToken: scorePulseToken, startedAt: performance.now() };
    }
    propsRef.current = {
      playMode,
      teamStats,
      activeDoubles,
      maxPossibleScore,
      compact,
      reducedMotion,
      skipEffectToken,
      scorePulseToken,
    };
  }, [
    playMode,
    teamStats,
    activeDoubles,
    maxPossibleScore,
    compact,
    reducedMotion,
    skipEffectToken,
    scorePulseToken,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    renderer.setSize(container.clientWidth || 720, container.clientHeight || 190);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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
    scene.fog = new THREE.FogExp2(0x050c1c, 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      36,
      (container.clientWidth || 720) / Math.max(1, container.clientHeight || 190),
      0.1,
      60
    );
    camera.position.set(0, 2.35, 8.2);
    camera.lookAt(0, 1.0, 0);

    // Balanced warm/cool studio rig
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x091224, 0.9);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff7ed, 1.45);
    key.position.set(3.5, 6.5, 5.5);
    if (!isSoftwareGl) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -6;
      key.shadow.camera.right = 6;
      key.shadow.camera.top = 5;
      key.shadow.camera.bottom = -3;
      key.shadow.bias = -0.0005;
    }
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x14b8a6, 0.75);
    rim.position.set(-4, 4, -5);
    scene.add(rim);

    // Stage floor & circular studio deck
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0c1933,
      roughness: 0.48,
      metalness: 0.32,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 0.65,
      roughness: 0.28,
      metalness: 0.4,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1e2c44,
      roughness: 0.38,
      metalness: 0.72,
    });
    const goldCrownMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.85,
    });

    const stageDeck = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.24, 48), deckMat);
    stageDeck.position.set(0, -0.12, 0);
    stageDeck.receiveShadow = true;
    scene.add(stageDeck);

    const stageRing = new THREE.Mesh(new THREE.TorusGeometry(5.55, 0.045, 12, 64), trimMat);
    stageRing.rotation.x = Math.PI / 2;
    stageRing.position.set(0, 0.02, 0);
    scene.add(stageRing);

    // Central Backdrop Question Board Frame behind podiums
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.14), steelMat);
    boardFrame.position.set(0, 1.55, -2.15);
    scene.add(boardFrame);

    const boardScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(4.12, 1.92),
      new THREE.MeshStandardMaterial({
        color: 0x0f2547,
        emissive: 0x0c345e,
        emissiveIntensity: 0.55,
        roughness: 0.35,
      })
    );
    boardScreen.position.set(0, 1.55, -2.07);
    scene.add(boardScreen);

    // Build 4 Identical Symmetrical Podiums (A, B, C, D)
    const teamConfigs: Array<{ id: ArenaTeamSlotId; color: string; x: number; z: number }> = [
      { id: 'A', color: '#EF4444', x: -3.25, z: 0.45 },
      { id: 'B', color: '#3B82F6', x: -1.15, z: -0.15 },
      { id: 'C', color: '#F59E0B', x: 1.15, z: -0.15 },
      { id: 'D', color: '#10B981', x: 3.25, z: 0.45 },
    ];

    interface PodiumRig {
      id: ArenaTeamSlotId;
      group: THREE.Group;
      scoreBar: THREE.Mesh;
      doubleCrown: THREE.Mesh;
      spotBeam: THREE.Mesh;
      currentBarH: number;
      defaultX: number;
      defaultZ: number;
    }

    const podiumRigs: PodiumRig[] = [];
    const disposableTextures: THREE.Texture[] = [];

    for (const tc of teamConfigs) {
      const group = new THREE.Group();
      group.position.set(tc.x, 0, tc.z);
      scene.add(group);

      const teamColor = new THREE.Color(tc.color);
      const glowMat = new THREE.MeshStandardMaterial({
        color: teamColor,
        emissive: teamColor,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.35,
      });

      // Symmetrical pedestal base
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.16, 0.92), steelMat);
      base.position.y = 0.08;
      base.receiveShadow = true;
      group.add(base);

      const baseGlow = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 0.96), glowMat);
      baseGlow.position.y = 0.03;
      group.add(baseGlow);

      // Podium body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.86, 0.68), steelMat);
      body.position.y = 0.59;
      body.castShadow = true;
      group.add(body);

      // Top desk cap
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.1, 0.84), steelMat);
      desk.position.y = 1.06;
      desk.castShadow = true;
      group.add(desk);

      const deskRim = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 0.88), glowMat);
      deskRim.position.y = 1.06;
      group.add(deskRim);

      // Front letter emblem plate (A, B, C, D)
      const tex = createTeamBadgeTexture(tc.id, tc.color);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      disposableTextures.push(tex);
      const badgePlate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.56, 0.56),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 })
      );
      badgePlate.position.set(0, 0.58, 0.35);
      group.add(badgePlate);

      // Vertical 3D Score Pillar behind desk (bottom-anchored via scale.y + position.y)
      const pillarHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 2.25, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0x0f1a2e,
          roughness: 0.5,
          metalness: 0.5,
        })
      );
      pillarHousing.position.set(0, 1.15, -0.42);
      group.add(pillarHousing);

      const scoreBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.0, 0.18), glowMat);
      scoreBar.position.set(0, 0.18, -0.36);
      scoreBar.scale.y = 0.16;
      group.add(scoreBar);

      // Floating Golden Double-Power Crown above score pillar
      const doubleCrown = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.055, 12, 24), goldCrownMat);
      doubleCrown.rotation.x = Math.PI / 2;
      doubleCrown.position.set(0, 2.48, -0.36);
      doubleCrown.visible = false;
      group.add(doubleCrown);

      // Subtle translucent team spotlight cone
      const spotBeam = new THREE.Mesh(
        new THREE.ConeGeometry(0.85, 3.6, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: teamColor,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      spotBeam.position.set(0, 2.0, -0.1);
      group.add(spotBeam);

      podiumRigs.push({
        id: tc.id,
        group,
        scoreBar,
        doubleCrown,
        spotBeam,
        currentBarH: 0.16,
        defaultX: tc.x,
        defaultZ: tc.z,
      });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !renderer) return;
      const w = Math.max(240, Math.floor(entry.contentRect.width));
      const h = Math.max(120, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

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
          const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (st === gl.UNSIGNALED) {
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
      const instantSnap =
        cur.reducedMotion || cur.skipEffectToken !== lastSkipTokenRef.current;
      if (cur.skipEffectToken !== lastSkipTokenRef.current) {
        lastSkipTokenRef.current = cur.skipEffectToken;
      }

      const maxScore = Math.max(10, cur.maxPossibleScore || 120);
      const pulseAge = (now - pulseRef.current.startedAt) / 1000;
      const pulseBoost =
        !cur.reducedMotion && pulseRef.current.startedAt > 0 && pulseAge >= 0 && pulseAge < 0.75
          ? Math.sin((pulseAge / 0.75) * Math.PI) * 0.1
          : 0;

      for (const rig of podiumRigs) {
        const isPractice = cur.playMode === 'practice';
        if (isPractice && rig.id !== 'A') {
          rig.group.visible = false;
          continue;
        }
        rig.group.visible = true;
        rig.group.position.x = isPractice ? 0 : rig.defaultX;
        rig.group.position.z = isPractice ? 0.2 : rig.defaultZ;

        const stat = cur.teamStats.find((s) => s.teamId === rig.id);
        const ratio = stat ? Math.min(1, Math.max(0, stat.score / maxScore)) : 0;
        const targetH = 0.16 + ratio * 2.0;

        rig.currentBarH = instantSnap
          ? targetH
          : THREE.MathUtils.damp(rig.currentBarH, targetH, 8, dt);

        rig.scoreBar.scale.y = rig.currentBarH;
        rig.scoreBar.position.y = 0.12 + rig.currentBarH / 2;

        const isDoubled = Boolean(cur.activeDoubles[rig.id]);
        rig.doubleCrown.visible = isDoubled;
        if (isDoubled && !cur.reducedMotion) {
          rig.doubleCrown.rotation.z = now * 0.003;
          rig.doubleCrown.position.y = 2.48 + Math.sin(now * 0.005) * 0.08;
        }

        const beamMat = rig.spotBeam.material as THREE.MeshBasicMaterial;
        beamMat.opacity = (isDoubled ? 0.18 : 0.07) + pulseBoost;
      }

      // Smoothly adjust camera framing between wide hero and compact question strip
      const targetCamZ = cur.compact ? 9.4 : 8.1;
      const targetCamY = cur.compact ? 2.15 : 2.4;
      camera.position.z = instantSnap
        ? targetCamZ
        : THREE.MathUtils.damp(camera.position.z, targetCamZ, 6, dt);
      camera.position.y = instantSnap
        ? targetCamY
        : THREE.MathUtils.damp(camera.position.y, targetCamY, 6, dt);
      camera.lookAt(0, 1.05, 0);

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
      disposableTextures.forEach((t) => t.dispose());
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
    <div
      ref={containerRef}
      className={`w-full ${
        compact ? 'h-[128px] sm:h-[148px]' : 'h-[185px] sm:h-[225px]'
      } rounded-xl overflow-hidden bg-[#050C1C] border border-slate-800 transition-all`}
      aria-label="Sân khấu Đấu trường 4 đội 3D"
    />
  );
};

/**
 * Lightweight 2D Scoreboard Stage Fallback (used automatically when WebGL is unavailable
 * or when teacher chooses "2D nhẹ").
 */
export const FourTeamsArena2DBoard: React.FC<FourTeamsArenaSceneProps> = ({
  playMode,
  teamStats,
  activeDoubles,
  maxPossibleScore,
}) => {
  const maxScore = Math.max(10, maxPossibleScore || 120);

  return (
    <div className="w-full rounded-xl bg-[#07142A] border border-slate-800 p-3">
      <div
        className={`grid gap-2.5 ${
          playMode === 'practice'
            ? 'grid-cols-1 max-w-md mx-auto'
            : 'grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {teamStats.map((team) => {
          const pct = Math.min(100, Math.round((team.score / maxScore) * 100));
          const isDoubled = Boolean(activeDoubles[team.teamId]);
          return (
            <div
              key={team.teamId}
              className="rounded-lg bg-slate-900/95 border border-slate-700/80 p-2.5 space-y-1.5 tabular-nums"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                    style={{ backgroundColor: team.colorHex }}
                  >
                    {team.teamId}
                  </span>
                  <span className="text-xs font-bold text-white truncate">{team.name}</span>
                </div>
                <span className="text-base font-extrabold text-white">{team.score}</span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(4, pct)}%`, backgroundColor: team.colorHex }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Đúng: {team.correctCount} câu</span>
                {playMode === 'four_teams' && (
                  <span
                    className={
                      isDoubled
                        ? 'text-amber-300 font-bold'
                        : team.doubleAvailable
                          ? 'text-teal-300 font-semibold'
                          : 'text-slate-500'
                    }
                  >
                    {isDoubled
                      ? '×2 Đang bật'
                      : team.doubleAvailable
                        ? 'Còn quyền ×2'
                        : team.doubleUsedOnRound
                          ? `Đã dùng ×2 (C${team.doubleUsedOnRound})`
                          : 'Tắt ×2'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
