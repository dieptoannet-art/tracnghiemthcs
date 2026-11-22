/**
 * E04 — SIMON SAYS (SIMON BẢO) 3D — SCHOOL AUDITORIUM STAGE & 2D FALLBACK
 * - Deep navy school auditorium with emerald teal, golden yellow, and white geometric accents & maple stage floor
 * - Front-facing articulated composite 3D instructor keeping face, hands, and body clearly in frame
 * - Supports Standing ("Đứng tại chỗ") and Seated ("Ngồi tại bàn" with wooden school bench)
 * - Strict anti-spoiler: renders 'ready_wait' until reveal; only demonstrates gesture when revealed & expected === 'execute'
 * - Software-WebGL guard, RoomEnvironment reflections, afterDraw fenceSync pacing, webglcontextlost, and SVG 2D fallback
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  SimonGestureId,
  SimonPostureSetting,
  getSimonGestureSpec,
} from './simonSays3dEngine';

export interface SimonSays3DSceneProps {
  activeGesture: SimonGestureId;
  posture: SimonPostureSetting;
  isRevealed: boolean;
  expectedDecision?: 'execute' | 'hold' | null;
  skipAnimationKey: number;
  reducedMotion: boolean;
  force2D: boolean;
  compact?: boolean;
}

interface PoseAngles {
  rShoulderX: number;
  rShoulderZ: number;
  rElbowX: number;
  lShoulderX: number;
  lShoulderZ: number;
  lElbowX: number;
  torsoY: number;
}

const POSE_TARGETS: Record<SimonGestureId, PoseAngles> = {
  ready_wait: {
    rShoulderX: 0.08,
    rShoulderZ: -0.16,
    rElbowX: -0.18,
    lShoulderX: 0.08,
    lShoulderZ: 0.16,
    lElbowX: -0.18,
    torsoY: 0,
  },
  raise_one_hand: {
    rShoulderX: -2.92,
    rShoulderZ: -0.22,
    rElbowX: -0.08,
    lShoulderX: 0.08,
    lShoulderZ: 0.16,
    lElbowX: -0.18,
    torsoY: 0.03,
  },
  raise_two_hands: {
    rShoulderX: -2.86,
    rShoulderZ: -0.34,
    rElbowX: -0.06,
    lShoulderX: -2.86,
    lShoulderZ: 0.34,
    lElbowX: -0.06,
    torsoY: 0.04,
  },
  palms_at_chest: {
    rShoulderX: -0.95,
    rShoulderZ: 0.44,
    rElbowX: -1.32,
    lShoulderX: -0.95,
    lShoulderZ: -0.44,
    lElbowX: -1.32,
    torsoY: 0.01,
  },
  hands_on_thighs: {
    rShoulderX: -0.26,
    rShoulderZ: 0.12,
    rElbowX: -0.32,
    lShoulderX: -0.26,
    lShoulderZ: -0.12,
    lElbowX: -0.32,
    torsoY: -0.02,
  },
};

function detectSoftwareWebGL(): { available: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') return { available: false, isSoftwareGl: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { available: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { available: true, isSoftwareGl };
  } catch {
    return { available: false, isSoftwareGl: true };
  }
}

function createStageWoodTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#DFB985';
    ctx.fillRect(0, 0, 512, 512);
    const plankH = 24;
    for (let y = 0; y < 512; y += plankH) {
      const shade = ((y / plankH) % 3) * 6 - 6;
      ctx.fillStyle = `rgb(${223 + shade}, ${185 + shade}, ${133 + shade})`;
      ctx.fillRect(0, y, 512, plankH - 1);
      ctx.fillStyle = 'rgba(110, 74, 34, 0.16)';
      ctx.fillRect(0, y + plankH - 1, 512, 1);
    }
    // Crisp stage arc lines
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(256, 280, 145, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#EAB308';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 280, 126, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Lightweight 2D SVG Illustrated Stage Fallback (when WebGL is unavailable, toggled to 2D, or reduced motion).
 */
export const SimonSays2DStageFallback: React.FC<SimonSays3DSceneProps> = ({
  activeGesture,
  posture,
  isRevealed,
  expectedDecision,
  compact = false,
}) => {
  const gestureLabel =
    activeGesture === 'ready_wait'
      ? isRevealed && expectedDecision === 'hold'
        ? 'Giữ nguyên tư thế'
        : 'Tư thế chờ'
      : getSimonGestureSpec(activeGesture).actionText;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0A1830] flex flex-col items-center justify-center ${
        compact ? 'h-[210px]' : 'h-[240px] sm:h-[290px]'
      }`}
    >
      <svg
        viewBox="0 0 420 260"
        className="w-full h-full max-w-[440px] block"
        aria-label={`Minh họa động tác: ${gestureLabel}`}
      >
        {/* Auditorium backdrop */}
        <rect x="0" y="0" width="420" height="260" fill="#0B1A34" />
        {/* Geometric teal & gold stage frames */}
        <rect x="26" y="24" width="90" height="145" rx="8" fill="none" stroke="#0D9488" strokeWidth="3" opacity="0.6" />
        <rect x="304" y="24" width="90" height="145" rx="8" fill="none" stroke="#EAB308" strokeWidth="3" opacity="0.6" />
        {/* Hardwood floor */}
        <rect x="0" y="198" width="420" height="62" fill="#DCBA87" />
        <ellipse cx="210" cy="212" rx="92" ry="14" fill="rgba(13,148,136,0.22)" stroke="#0D9488" strokeWidth="2.5" />

        {/* Optional school bench when seated */}
        {posture === 'seated' && (
          <g>
            <rect x="148" y="158" width="124" height="12" rx="4" fill="#9A6B3E" />
            <rect x="160" y="170" width="10" height="40" fill="#1E293B" />
            <rect x="250" y="170" width="10" height="40" fill="#1E293B" />
          </g>
        )}

        {/* Friendly athletic figure */}
        <g transform={posture === 'seated' ? 'translate(210, 108)' : 'translate(210, 96)'}>
          {/* Head */}
          <circle cx="0" cy="-40" r="19" fill="#F3C6A5" />
          <path d="M-19,-43 C-16,-62 16,-62 19,-43 Z" fill="#1E293B" />
          <circle cx="-6" cy="-41" r="2.2" fill="#0F172A" />
          <circle cx="6" cy="-41" r="2.2" fill="#0F172A" />
          <path d="M-6,-32 Q0,-26 6,-32" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />

          {/* Torso (navy & teal athletic jacket) */}
          <rect x="-22" y="-18" width="44" height="58" rx="12" fill="#0F2C5C" />
          <path d="M-22,-8 L-8,-18 L-8,40 L-22,34 Z" fill="#0D9488" />
          <path d="M22,-8 L8,-18 L8,40 L22,34 Z" fill="#0D9488" />
          <line x1="0" y1="-16" x2="0" y2="38" stroke="#EAB308" strokeWidth="2.5" />

          {/* Legs */}
          {posture === 'standing' ? (
            <>
              <rect x="-16" y="40" width="12" height="58" rx="6" fill="#1E3A68" />
              <rect x="4" y="40" width="12" height="58" rx="6" fill="#1E3A68" />
              <rect x="-19" y="94" width="17" height="9" rx="4" fill="#F8FAFC" />
              <rect x="2" y="94" width="17" height="9" rx="4" fill="#F8FAFC" />
            </>
          ) : (
            <>
              <rect x="-18" y="38" width="14" height="36" rx="6" fill="#1E3A68" />
              <rect x="4" y="38" width="14" height="36" rx="6" fill="#1E3A68" />
              <rect x="-20" y="72" width="17" height="9" rx="4" fill="#F8FAFC" />
              <rect x="3" y="72" width="17" height="9" rx="4" fill="#F8FAFC" />
            </>
          )}

          {/* Arms per activeGesture */}
          {activeGesture === 'ready_wait' && (
            <>
              <path d="M-22,-10 L-34,36" stroke="#0F2C5C" strokeWidth="11" strokeLinecap="round" />
              <circle cx="-35" cy="40" r="6" fill="#F3C6A5" />
              <path d="M22,-10 L34,36" stroke="#0F2C5C" strokeWidth="11" strokeLinecap="round" />
              <circle cx="35" cy="40" r="6" fill="#F3C6A5" />
            </>
          )}

          {activeGesture === 'raise_one_hand' && (
            <>
              {/* Viewer-left (character right) arm raised high */}
              <path d="M-22,-10 L-36,-62" stroke="#0D9488" strokeWidth="11" strokeLinecap="round" />
              <circle cx="-37" cy="-67" r="7" fill="#F3C6A5" />
              {/* Other arm resting */}
              <path d="M22,-10 L34,36" stroke="#0F2C5C" strokeWidth="11" strokeLinecap="round" />
              <circle cx="35" cy="40" r="6" fill="#F3C6A5" />
            </>
          )}

          {activeGesture === 'raise_two_hands' && (
            <>
              <path d="M-22,-10 L-42,-60" stroke="#0D9488" strokeWidth="11" strokeLinecap="round" />
              <circle cx="-44" cy="-65" r="7" fill="#F3C6A5" />
              <path d="M22,-10 L42,-60" stroke="#0D9488" strokeWidth="11" strokeLinecap="round" />
              <circle cx="44" cy="-65" r="7" fill="#F3C6A5" />
            </>
          )}

          {activeGesture === 'palms_at_chest' && (
            <>
              <path d="M-22,-10 L-34,12 L-8,12" fill="none" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22,-10 L34,12 L8,12" fill="none" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="-4" cy="12" r="6.5" fill="#F3C6A5" />
              <circle cx="4" cy="12" r="6.5" fill="#F3C6A5" />
            </>
          )}

          {activeGesture === 'hands_on_thighs' && (
            <>
              <path d="M-22,-10 L-26,24 L-12,46" fill="none" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22,-10 L26,24 L12,46" fill="none" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="-11" cy="48" r="6.5" fill="#F3C6A5" />
              <circle cx="11" cy="48" r="6.5" fill="#F3C6A5" />
            </>
          )}
        </g>
      </svg>

      <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#071226]/92 border border-slate-600/80 text-xs">
        <span className="font-black text-teal-200 truncate">{gestureLabel}</span>
        <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
          {posture === 'seated' ? 'Ngồi tại bàn' : 'Đứng tại chỗ'} · Minh họa 2D
        </span>
      </div>
    </div>
  );
};

export const SimonSays3DScene: React.FC<SimonSays3DSceneProps> = (props) => {
  const { activeGesture, posture, isRevealed, expectedDecision, skipAnimationKey, reducedMotion, force2D, compact = false } =
    props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(() => {
    if (force2D) return true;
    return !detectSoftwareWebGL().available;
  });

  const propsRef = useRef(props);
  propsRef.current = props;

  const prevSkipRef = useRef<number>(skipAnimationKey);
  const snapRef = useRef<boolean>(false);

  useEffect(() => {
    if (skipAnimationKey !== prevSkipRef.current) {
      prevSkipRef.current = skipAnimationKey;
      snapRef.current = true;
    }
  }, [skipAnimationKey]);

  useEffect(() => {
    if (force2D || webglUnavailable) return;
    const container = containerRef.current;
    if (!container) return;

    const probe = detectSoftwareWebGL();
    if (!probe.available) {
      setWebglUnavailable(true);
      return;
    }
    const { isSoftwareGl } = probe;

    let disposed = false;
    let frameId = 0;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(280, container.clientWidth || 500);
    const initH = Math.max(200, container.clientHeight || 280);
    renderer.setSize(initW, initH);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (!disposed) setWebglUnavailable(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Scene & Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B1B36');
    scene.fog = new THREE.Fog('#0B1B36', 11, 24);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // Front-facing stable camera keeping head, raised hands, torso & feet cleanly inside viewport
    const camera = new THREE.PerspectiveCamera(38, initW / initH, 0.1, 45);
    camera.position.set(0, 1.55, 5.45);
    camera.lookAt(0, 1.24, 0);

    // 3-Point Auditorium Lighting
    const hemi = new THREE.HemisphereLight('#E0F2FE', '#5C4024', 0.92);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFF6E6', 1.75);
    keyLight.position.set(2.8, 5.8, 4.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3.5;
    keyLight.shadow.camera.right = 3.5;
    keyLight.shadow.camera.top = 3.5;
    keyLight.shadow.camera.bottom = -3.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#2DD4BF', 0.65);
    rimLight.position.set(-3.2, 3.0, -3.5);
    scene.add(rimLight);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      textures.push(t);
      return t;
    };

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Maple stage floor
    const floorTex = trackTex(createStageWoodTexture(maxAniso));
    const floor = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(11, 8)),
      trackMat(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.38, metalness: 0.05 }))
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Auditorium back wall + emerald & gold flanking panels
    const wall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11, 5.2, 0.3)),
      trackMat(new THREE.MeshStandardMaterial({ color: '#0E2346', roughness: 0.72, metalness: 0.1 }))
    );
    wall.position.set(0, 2.6, -2.5);
    scene.add(wall);

    const tealPanel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.15, 2.0, 0.14)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#0D9488',
          emissive: '#0D9488',
          emissiveIntensity: 0.25,
          roughness: 0.35,
          metalness: 0.2,
        })
      )
    );
    tealPanel.position.set(-2.05, 1.05, -1.65);
    scene.add(tealPanel);

    const goldPanel = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.15, 2.0, 0.14)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: '#D97706',
          emissive: '#EAB308',
          emissiveIntensity: 0.22,
          roughness: 0.35,
          metalness: 0.25,
        })
      )
    );
    goldPanel.position.set(2.05, 1.05, -1.65);
    scene.add(goldPanel);

    // School Bench (visible strictly when posture === 'seated')
    const benchGroup = new THREE.Group();
    const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: '#B8834B', roughness: 0.52 }));
    const frameMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.38, metalness: 0.45 })
    );
    const seatMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.55, 0.09, 0.56)), woodMat);
    seatMesh.position.set(0, 0.54, -0.06);
    seatMesh.castShadow = !isSoftwareGl;
    seatMesh.receiveShadow = true;
    benchGroup.add(seatMesh);

    const legGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.52, 0.08));
    [
      [-0.64, 0.26, 0.15],
      [0.64, 0.26, 0.15],
      [-0.64, 0.26, -0.26],
      [0.64, 0.26, -0.26],
    ].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(lx, ly, lz);
      benchGroup.add(leg);
    });
    scene.add(benchGroup);

    // Articulated Composite 3D Instructor (bottom-centered at y = 0)
    const charRoot = new THREE.Group();
    scene.add(charRoot);

    const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: '#F1C29B', roughness: 0.62 }));
    const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1B2436', roughness: 0.72 }));
    const navyMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0F2A56', roughness: 0.52 }));
    const tealMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0D9488', roughness: 0.42 }));
    const goldAccentMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#EAB308', roughness: 0.3, metalness: 0.45 })
    );
    const shoeMat = trackMat(new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.4 }));
    const darkMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0B1220', roughness: 0.35 }));

    const bodyPivot = new THREE.Group();
    charRoot.add(bodyPivot);

    // Pelvis + Torso + Jacket Stripes
    const pelvis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.2, 0.28)), navyMat);
    pelvis.position.set(0, 0.94, 0);
    pelvis.castShadow = !isSoftwareGl;
    bodyPivot.add(pelvis);

    const torso = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.62, 0.3)), navyMat);
    torso.position.set(0, 1.34, 0);
    torso.castShadow = !isSoftwareGl;
    bodyPivot.add(torso);

    const chestV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.44, 0.315)), tealMat);
    chestV.position.set(0, 1.37, 0);
    bodyPivot.add(chestV);

    const zipLine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.035, 0.56, 0.32)), goldAccentMat);
    zipLine.position.set(0, 1.35, 0);
    bodyPivot.add(zipLine);

    // Neck + Head + Hair + Friendly Eyes
    const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 14)), skinMat);
    neck.position.set(0, 1.71, 0);
    bodyPivot.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.94, 0);
    bodyPivot.add(headGroup);

    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.21, 24, 20)), skinMat);
    head.castShadow = !isSoftwareGl;
    headGroup.add(head);

    const hair = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.22, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      hairMat
    );
    hair.position.set(0, 0.025, -0.015);
    headGroup.add(hair);

    const eyeGeo = trackGeo(new THREE.SphereGeometry(0.024, 10, 10));
    [-0.07, 0.07].forEach((ex) => {
      const eye = new THREE.Mesh(eyeGeo, darkMat);
      eye.position.set(ex, 0.02, 0.19);
      headGroup.add(eye);
    });

    // Articulated Arms (Character Right = Viewer Left -X; Character Left = Viewer Right +X)
    const buildArm = (side: -1 | 1) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.33, 1.56, 0);
      bodyPivot.add(shoulder);

      const cap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.082, 14, 12)), tealMat);
      shoulder.add(cap);

      const upper = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.068, 0.06, 0.34, 12)),
        navyMat
      );
      upper.position.set(0, -0.17, 0);
      upper.castShadow = !isSoftwareGl;
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.34, 0);
      shoulder.add(elbow);

      const fore = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.056, 0.048, 0.31, 12)),
        tealMat
      );
      fore.position.set(0, -0.155, 0);
      fore.castShadow = !isSoftwareGl;
      elbow.add(fore);

      const hand = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.065, 14, 12)), skinMat);
      hand.position.set(0, -0.34, 0);
      elbow.add(hand);

      return { shoulder, elbow };
    };

    const rightArm = buildArm(-1);
    const leftArm = buildArm(1);

    // Legs (with hip & knee joints for clean standing vs seated bench posture)
    const buildLeg = (side: -1 | 1) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.135, 0.86, 0);
      bodyPivot.add(hip);

      const thigh = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.088, 0.076, 0.42, 12)),
        navyMat
      );
      thigh.position.set(0, -0.21, 0);
      thigh.castShadow = !isSoftwareGl;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      hip.add(knee);

      const shin = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.07, 0.058, 0.38, 12)),
        navyMat
      );
      shin.position.set(0, -0.19, 0);
      shin.castShadow = !isSoftwareGl;
      knee.add(shin);

      const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.13, 0.08, 0.24)), shoeMat);
      shoe.position.set(0, -0.4, 0.05);
      knee.add(shoe);

      return { hip, knee };
    };

    const rightLeg = buildLeg(-1);
    const leftLeg = buildLeg(1);

    // Ground contact shadow
    const contactShadow = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.55, 24)),
      trackMat(
        new THREE.MeshBasicMaterial({
          color: '#071226',
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
        })
      )
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.015, 0);
    scene.add(contactShadow);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(260, Math.floor(entry.contentRect.width));
      const h = Math.max(190, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.fov = w / h < 1.2 ? 44 : 38;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let elapsed = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 6);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.08, clock.getDelta());
      elapsed += dt;

      const cur = propsRef.current;
      const target = POSE_TARGETS[cur.activeGesture] || POSE_TARGETS.ready_wait;
      const snap = snapRef.current || cur.reducedMotion;
      if (snapRef.current) snapRef.current = false;

      const lerpFactor = snap ? 1 : 1 - Math.exp(-9.5 * dt);

      // Posture: Standing vs Seated on bench
      const isSeated = cur.posture === 'seated';
      benchGroup.visible = isSeated;
      const targetBodyY = (isSeated ? -0.3 : 0) + target.torsoY;
      bodyPivot.position.y = THREE.MathUtils.lerp(bodyPivot.position.y, targetBodyY, lerpFactor);

      const targetHipX = isSeated ? -1.48 : 0;
      const targetKneeX = isSeated ? 1.48 : 0;
      rightLeg.hip.rotation.x = THREE.MathUtils.lerp(rightLeg.hip.rotation.x, targetHipX, lerpFactor);
      leftLeg.hip.rotation.x = THREE.MathUtils.lerp(leftLeg.hip.rotation.x, targetHipX, lerpFactor);
      rightLeg.knee.rotation.x = THREE.MathUtils.lerp(rightLeg.knee.rotation.x, targetKneeX, lerpFactor);
      leftLeg.knee.rotation.x = THREE.MathUtils.lerp(leftLeg.knee.rotation.x, targetKneeX, lerpFactor);

      // Arms smoothly interpolate to active pose
      rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(
        rightArm.shoulder.rotation.x,
        target.rShoulderX,
        lerpFactor
      );
      rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(
        rightArm.shoulder.rotation.z,
        target.rShoulderZ,
        lerpFactor
      );
      rightArm.elbow.rotation.x = THREE.MathUtils.lerp(
        rightArm.elbow.rotation.x,
        target.rElbowX,
        lerpFactor
      );
      leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(
        leftArm.shoulder.rotation.x,
        target.lShoulderX,
        lerpFactor
      );
      leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(
        leftArm.shoulder.rotation.z,
        target.lShoulderZ,
        lerpFactor
      );
      leftArm.elbow.rotation.x = THREE.MathUtils.lerp(
        leftArm.elbow.rotation.x,
        target.lElbowX,
        lerpFactor
      );

      // Subtle breathing sway (disabled in reducedMotion)
      headGroup.rotation.y = cur.reducedMotion ? 0 : Math.sin(elapsed * 1.4) * 0.06;

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
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      envTex.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [force2D, webglUnavailable]);

  if (force2D || webglUnavailable) {
    return <SimonSays2DStageFallback {...props} />;
  }

  const statusLabel =
    activeGesture === 'ready_wait'
      ? isRevealed && expectedDecision === 'hold'
        ? 'Giữ nguyên tư thế'
        : 'Tư thế chờ'
      : getSimonGestureSpec(activeGesture).actionText;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0B1B36] ${
        compact ? 'h-[210px]' : 'h-[245px] sm:h-[300px] lg:h-[330px]'
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />

      <div className="pointer-events-none absolute bottom-2.5 inset-x-3 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#071226]/92 border border-slate-600/80 text-xs">
        <span className="font-black text-teal-200 truncate">{statusLabel}</span>
        <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
          {posture === 'seated' ? 'Ngồi tại bàn' : 'Đứng tại chỗ'} · Sân khấu 3D
        </span>
      </div>
    </div>
  );
};
