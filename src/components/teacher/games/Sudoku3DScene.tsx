import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Lock, AlertTriangle } from 'lucide-react';
import {
  SudokuSize,
  SudokuHintStep,
  cellKey,
  getBoxIndex,
  getBoxSize,
} from './sudoku3dEngine';

export interface SudokuBoardViewProps {
  size: SudokuSize;
  givens: number[][];
  values: number[][];
  notes: Record<string, number[]>;
  selectedCell: { row: number; col: number } | null;
  conflictCellKeys: Set<string>;
  conflictUnitsHighlight: {
    rows: number[];
    cols: number[];
    boxes: number[];
  } | null;
  activeHint: SudokuHintStep | null;
  isCompleted: boolean;
  completionToken: number;
  reducedMotion: boolean;
  preferLightweight2D: boolean;
  onSelectCell: (row: number, col: number) => void;
  onWebGLUnavailable?: () => void;
}

// ============================================================================
// WEBGL PROBE & SOFTWARE GL GUARD
// ============================================================================

function probeWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') return { supported: false, isSoftwareGl: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

// ============================================================================
// SHARED PROCEDURAL TILE TEXTURE RENDERER (HIGH-DPI CRISP NUMERALS & NOTES)
// ============================================================================

interface TileVisualState {
  size: SudokuSize;
  row: number;
  col: number;
  value: number;
  isGiven: boolean;
  notes: number[];
  isSelected: boolean;
  isSameValue: boolean;
  isSamePeer: boolean;
  isConflict: boolean;
  isConflictUnit: boolean;
  isHintTarget: boolean;
  isHintUnit: boolean;
  isHintRelatedCell: boolean;
  isCompleted: boolean;
}

function buildTileVisualSignature(t: TileVisualState): string {
  return [
    t.size,
    t.value,
    t.isGiven ? 1 : 0,
    t.notes.join(','),
    t.isSelected ? 1 : 0,
    t.isSameValue ? 1 : 0,
    t.isSamePeer ? 1 : 0,
    t.isConflict ? 1 : 0,
    t.isConflictUnit ? 1 : 0,
    t.isHintTarget ? 1 : 0,
    t.isHintUnit ? 1 : 0,
    t.isHintRelatedCell ? 1 : 0,
    t.isCompleted ? 1 : 0,
  ].join('|');
}

function drawCeramicTileCanvas(canvas: HTMLCanvasElement, t: TileVisualState): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Base ceramic glaze gradient
  let topColor = '#142649';
  let botColor = '#0E1C38';
  if (t.isGiven) {
    topColor = '#101F3C';
    botColor = '#0A152B';
  } else if (t.value > 0) {
    topColor = '#17315E';
    botColor = '#102447';
  }

  if (t.isSamePeer) {
    topColor = t.isGiven ? '#142A4F' : '#1A3463';
    botColor = t.isGiven ? '#0E1E3A' : '#12284F';
  }
  if (t.isHintUnit || t.isHintRelatedCell) {
    topColor = '#163B57';
    botColor = '#0F2B42';
  }
  if (t.isConflictUnit) {
    topColor = '#33172A';
    botColor = '#25101F';
  }
  if (t.isSameValue) {
    topColor = '#134459';
    botColor = '#0E3345';
  }
  if (t.isSelected) {
    topColor = '#144B5C';
    botColor = '#0E3645';
  }
  if (t.isHintTarget) {
    topColor = '#3D3214';
    botColor = '#29210C';
  }
  if (t.isConflict) {
    topColor = '#53192B';
    botColor = '#3B101E';
  }
  if (t.isCompleted) {
    topColor = t.isGiven ? '#102B3F' : '#133C4B';
    botColor = t.isGiven ? '#0A1E2E' : '#0D2C38';
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, botColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle satin ceramic inner specular sheen
  const sheen = ctx.createLinearGradient(0, 0, w * 0.85, h * 0.85);
  sheen.addColorStop(0, 'rgba(255,255,255,0.09)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  // Subtle inner ceramic bevel edge
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = Math.max(2, w * 0.015);
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // State borders (shape + color, never hue-only)
  if (t.isHintTarget) {
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = w * 0.055;
    ctx.setLineDash([w * 0.12, w * 0.06]);
    ctx.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
    ctx.setLineDash([]);
  } else if (t.isConflict) {
    ctx.strokeStyle = '#F87171';
    ctx.lineWidth = w * 0.06;
    ctx.strokeRect(w * 0.035, h * 0.035, w * 0.93, h * 0.93);
  } else if (t.isSelected) {
    ctx.strokeStyle = '#2DD4BF';
    ctx.lineWidth = w * 0.06;
    ctx.strokeRect(w * 0.035, h * 0.035, w * 0.93, h * 0.93);
    // Four corner precision brackets
    const bLen = w * 0.16;
    const pad = w * 0.095;
    ctx.strokeStyle = '#99F6E4';
    ctx.lineWidth = w * 0.028;
    ctx.beginPath();
    // TL
    ctx.moveTo(pad, pad + bLen);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad + bLen, pad);
    // TR
    ctx.moveTo(w - pad - bLen, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, pad + bLen);
    // BL
    ctx.moveTo(pad, h - pad - bLen);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(pad + bLen, h - pad);
    // BR
    ctx.moveTo(w - pad - bLen, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(w - pad, h - pad - bLen);
    ctx.stroke();
  } else if (t.isSameValue) {
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.72)';
    ctx.lineWidth = w * 0.035;
    ctx.strokeRect(w * 0.03, h * 0.03, w * 0.94, h * 0.94);
  } else if (t.isHintRelatedCell) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.lineWidth = w * 0.038;
    ctx.strokeRect(w * 0.03, h * 0.03, w * 0.94, h * 0.94);
  }

  // Top-right state glyph (non-hue indicator)
  if (t.isConflict) {
    const r = w * 0.105;
    const cx = w - r - w * 0.07;
    const cy = r + h * 0.07;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.round(w * 0.14)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy + 1);
  } else if (t.isGiven) {
    // Subtle engraved corner lock dot for given tiles
    const cx = w - w * 0.12;
    const cy = h * 0.12;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.038, 0, Math.PI * 2);
    ctx.fill();
  } else if (t.value > 0) {
    // Subtle emerald bottom accent bar distinguishing student-entered values from givens
    ctx.fillStyle = t.isCompleted ? '#34D399' : '#2DD4BF';
    const barW = w * 0.34;
    const barH = h * 0.032;
    ctx.fillRect((w - barW) / 2, h - h * 0.12, barW, barH);
  }

  // Main digit OR candidate notes
  if (t.value > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.round(w * (t.size === 4 ? 0.54 : 0.56));
    ctx.font = `${t.isGiven ? 800 : 700} ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
    // Soft engraved drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillText(String(t.value), w / 2, h / 2 + w * 0.022);
    if (t.isConflict) {
      ctx.fillStyle = '#FECACA';
    } else if (t.isGiven) {
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = '#7AF3E0';
    }
    ctx.fillText(String(t.value), w / 2, h / 2);
  } else if (t.notes.length > 0) {
    const sub = getBoxSize(t.size); // 2 for 4x4, 3 for 9x9
    const pad = w * 0.12;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    const cellW = innerW / sub;
    const cellH = innerH / sub;
    const noteFont = Math.round(w * (t.size === 4 ? 0.24 : 0.20));
    ctx.font = `700 ${noteFont}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#BAE6FD';

    for (const d of t.notes) {
      const idx = d - 1;
      const nr = Math.floor(idx / sub);
      const nc = idx % sub;
      const x = pad + nc * cellW + cellW / 2;
      const y = pad + nr * cellH + cellH / 2;
      ctx.fillText(String(d), x, y);
    }
  }
}

// ============================================================================
// HELPER: CREATE ROUNDED RECT EXTRUDE GEOMETRY
// ============================================================================

function createRoundedTileGeometry(width: number, height: number, depth: number, radius: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width * 0.25, height * 0.25);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.032, depth * 0.22),
    bevelSize: Math.min(0.028, width * 0.04),
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.center();
  return geo;
}

// ============================================================================
// 2D LIGHTWEIGHT CERAMIC BOARD FALLBACK (WCAG, TOUCH & NO-WEBGL SAFE)
// ============================================================================

export const Sudoku2DBoard: React.FC<SudokuBoardViewProps> = ({
  size,
  givens,
  values,
  notes,
  selectedCell,
  conflictCellKeys,
  conflictUnitsHighlight,
  activeHint,
  isCompleted,
  onSelectCell,
}) => {
  const boxSize = getBoxSize(size);
  const selectedVal = selectedCell ? values[selectedCell.row]?.[selectedCell.col] ?? 0 : 0;
  const hintCellSet = new Set(activeHint?.highlightCells ?? []);
  const hintRowSet = new Set(activeHint?.highlightRows ?? []);
  const hintColSet = new Set(activeHint?.highlightCols ?? []);
  const hintBoxSet = new Set(activeHint?.highlightBoxes ?? []);
  const confRowSet = new Set(conflictUnitsHighlight?.rows ?? []);
  const confColSet = new Set(conflictUnitsHighlight?.cols ?? []);
  const confBoxSet = new Set(conflictUnitsHighlight?.boxes ?? []);

  return (
    <div
      className="w-full h-full flex items-center justify-center p-2 sm:p-3 select-none"
      role="grid"
      aria-label={`Bảng Sudoku ${size} nhân ${size}`}
    >
      <div
        className={`w-full aspect-square max-w-[540px] rounded-2xl p-2 sm:p-2.5 bg-[#08142B] border-2 ${
          isCompleted ? 'border-emerald-400/80 shadow-[0_0_28px_rgba(16,185,129,0.28)]' : 'border-teal-400/45 shadow-[0_14px_34px_rgba(2,8,23,0.65)]'
        }`}
      >
        <div
          className="w-full h-full grid rounded-xl overflow-hidden bg-[#061022] border border-teal-400/40"
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => {
              const key = cellKey(r, c);
              const val = values[r]?.[c] ?? 0;
              const isGiven = (givens[r]?.[c] ?? 0) !== 0;
              const cellNotes = notes[key] ?? [];
              const box = getBoxIndex(r, c, size);

              const isSelected = selectedCell?.row === r && selectedCell?.col === c;
              const isSamePeer =
                Boolean(selectedCell) &&
                !isSelected &&
                (selectedCell!.row === r ||
                  selectedCell!.col === c ||
                  getBoxIndex(selectedCell!.row, selectedCell!.col, size) === box);
              const isSameValue = selectedVal > 0 && val === selectedVal && !isSelected;
              const isConflict = conflictCellKeys.has(key);
              const isConflictUnit = confRowSet.has(r) || confColSet.has(c) || confBoxSet.has(box);
              const isHintTarget =
                activeHint?.status === 'found' &&
                activeHint.targetCell?.row === r &&
                activeHint.targetCell?.col === c;
              const isHintUnit = hintRowSet.has(r) || hintColSet.has(c) || hintBoxSet.has(box);
              const isHintRelatedCell = hintCellSet.has(key) && !isHintTarget;

              const thickRight = (c + 1) % boxSize === 0 && c < size - 1;
              const thickBottom = (r + 1) % boxSize === 0 && r < size - 1;

              let bgClass = isGiven ? 'bg-[#0D1C37]' : 'bg-[#13294E]';
              if (isSamePeer) bgClass = isGiven ? 'bg-[#13284A]' : 'bg-[#193463]';
              if (isHintUnit || isHintRelatedCell) bgClass = 'bg-[#143952]';
              if (isConflictUnit) bgClass = 'bg-[#331628]';
              if (isSameValue) bgClass = 'bg-[#134459]';
              if (isSelected) bgClass = 'bg-[#144C5E]';
              if (isHintTarget) bgClass = 'bg-[#3D3113]';
              if (isConflict) bgClass = 'bg-[#54192B]';
              if (isCompleted) bgClass = isGiven ? 'bg-[#0F293B]' : 'bg-[#133C4B]';

              const borderClasses = [
                thickRight ? 'border-r-[3px] border-r-teal-400/90' : 'border-r border-r-slate-700/75',
                thickBottom ? 'border-b-[3px] border-b-teal-400/90' : 'border-b border-b-slate-700/75',
              ].join(' ');

              const ringClass = isConflict
                ? 'ring-2 ring-inset ring-rose-400'
                : isHintTarget
                ? 'ring-2 ring-inset ring-amber-400'
                : isSelected
                ? 'ring-2 ring-inset ring-teal-300'
                : isSameValue
                ? 'ring-1 ring-inset ring-teal-400/70'
                : isHintRelatedCell
                ? 'ring-1 ring-inset ring-amber-300/70'
                : '';

              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`Hàng ${r + 1} cột ${c + 1}${
                    val > 0 ? `, số ${val}` : cellNotes.length > 0 ? `, ghi chú ${cellNotes.join(' ')}` : ', ô trống'
                  }${isGiven ? ', ô cho sẵn bị khóa' : ''}${isConflict ? ', có xung đột' : ''}`}
                  onClick={() => onSelectCell(r, c)}
                  className={`relative flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 cursor-pointer ${bgClass} ${borderClasses} ${ringClass}`}
                >
                  {/* Top-right status icon (never hue-only) */}
                  {isConflict && (
                    <span
                      className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-rose-500 text-white flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {!isConflict && isGiven && (
                    <span
                      className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 text-slate-400/70"
                      aria-hidden="true"
                    >
                      <Lock className={size === 4 ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
                    </span>
                  )}

                  {/* Main Digit or Candidate Notes */}
                  {val > 0 ? (
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className={`tabular-nums leading-none ${
                          size === 4
                            ? 'text-3xl sm:text-5xl'
                            : 'text-lg sm:text-2xl md:text-[26px]'
                        } ${
                          isConflict
                            ? 'font-extrabold text-rose-100'
                            : isGiven
                            ? 'font-extrabold text-white'
                            : 'font-bold text-teal-200'
                        }`}
                      >
                        {val}
                      </span>
                      {!isGiven && (
                        <span
                          className={`mt-0.5 rounded-full ${
                            size === 4 ? 'w-5 h-1' : 'w-3 h-0.5'
                          } ${isCompleted ? 'bg-emerald-400' : 'bg-teal-400/90'}`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  ) : cellNotes.length > 0 ? (
                    <div
                      className="w-full h-full grid p-0.5 sm:p-1"
                      style={{
                        gridTemplateColumns: `repeat(${boxSize}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${boxSize}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: size }, (_, idx) => {
                        const d = idx + 1;
                        const active = cellNotes.includes(d);
                        return (
                          <span
                            key={d}
                            className={`flex items-center justify-center tabular-nums font-semibold leading-none ${
                              size === 4
                                ? 'text-xs sm:text-sm'
                                : 'text-[9px] sm:text-[11px]'
                            } ${active ? 'text-sky-200' : 'text-transparent'}`}
                          >
                            {active ? d : '·'}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3D CERAMIC-ON-NAVY SUDOKU BOARD (THREE.JS + AUTOMATIC 2D FALLBACK)
// ============================================================================

interface TileMeshBundle {
  row: number;
  col: number;
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  faceMesh: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
  faceCanvas: HTMLCanvasElement;
  faceTexture: THREE.CanvasTexture;
  faceMat: THREE.MeshStandardMaterial;
  lastSignature: string;
  currentZ: number;
  targetZ: number;
}

export const Sudoku3DScene: React.FC<SudokuBoardViewProps> = (props) => {
  const {
    size,
    givens,
    values,
    notes,
    selectedCell,
    conflictCellKeys,
    conflictUnitsHighlight,
    activeHint,
    isCompleted,
    completionToken,
    reducedMotion,
    preferLightweight2D,
    onSelectCell,
    onWebGLUnavailable,
  } = props;

  const [webglStatus, setWebglStatus] = useState<'checking' | 'ready' | 'fallback'>(() =>
    preferLightweight2D ? 'fallback' : 'checking'
  );
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const syncBoardRef = useRef<(() => void) | null>(null);
  const celebrateStartRef = useRef<number>(0);
  const lastCelebrationTokenRef = useRef<number>(completionToken);

  // Respect user toggle between 3D and Lightweight 2D
  useEffect(() => {
    if (preferLightweight2D) {
      setWebglStatus('fallback');
    } else {
      const probe = probeWebGL();
      if (probe.supported) {
        setWebglStatus('ready');
      } else {
        setWebglStatus('fallback');
        onWebGLUnavailable?.();
      }
    }
  }, [preferLightweight2D, onWebGLUnavailable]);

  // Trigger subtle celebration wave once per new completionToken
  useEffect(() => {
    if (completionToken > lastCelebrationTokenRef.current) {
      lastCelebrationTokenRef.current = completionToken;
      if (!reducedMotion) {
        celebrateStartRef.current = performance.now();
      }
      syncBoardRef.current?.();
    }
  }, [completionToken, reducedMotion]);

  // Trigger texture/elevation update when board props change
  useEffect(() => {
    syncBoardRef.current?.();
  }, [
    size,
    givens,
    values,
    notes,
    selectedCell,
    conflictCellKeys,
    conflictUnitsHighlight,
    activeHint,
    isCompleted,
    reducedMotion,
  ]);

  // Initialize Three.js ceramic board when in 3D mode (rebuilds cleanly when board size 4x4 <-> 9x9 switches)
  useEffect(() => {
    if (webglStatus !== 'ready') return;
    const container = mountRef.current;
    if (!container) return;

    const probe = probeWebGL();
    if (!probe.supported) {
      setWebglStatus('fallback');
      onWebGLUnavailable?.();
      return;
    }
    const { isSoftwareGl } = probe;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglStatus('fallback');
      onWebGLUnavailable?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'pointer';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061024);
    scene.fog = new THREE.FogExp2(0x061024, 0.018);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // Near-frontal architectural camera: subtle tactile 3D depth while keeping numbers crisp and straight
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
    camera.position.set(0, -1.25, 13.8);
    camera.lookAt(0, 0, 0);

    // 3-Point Studio Lighting (Warm key + Cool Hemisphere fill + Rim light)
    const hemiLight = new THREE.HemisphereLight(0xcce6ff, 0x09162e, 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.65);
    keyLight.position.set(-4.5, 5.2, 9.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 25;
      keyLight.shadow.camera.left = -4.5;
      keyLight.shadow.camera.right = 4.5;
      keyLight.shadow.camera.top = 4.5;
      keyLight.shadow.camera.bottom = -4.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 0.72);
    rimLight.position.set(5.2, -3.6, 4.5);
    scene.add(rimLight);

    // Composite Board Group
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];
    const disposableTexs: THREE.Texture[] = [];

    const boardSpan = 5.4;
    const outerFrameSpan = boardSpan + 0.56;

    // 1. Tabletop matte navy backdrop plane
    const deskGeo = new THREE.PlaneGeometry(34, 34);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x061024,
      roughness: 0.9,
      metalness: 0.08,
    });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.set(0, 0, -0.45);
    deskMesh.receiveShadow = !isSoftwareGl;
    scene.add(deskMesh);
    disposableGeos.push(deskGeo);
    disposableMats.push(deskMat);

    // 2. Soft grounded contact shadow beneath board tray
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d');
    if (sctx) {
      const rg = sctx.createRadialGradient(128, 128, 48, 128, 128, 126);
      rg.addColorStop(0, 'rgba(0, 4, 16, 0.72)');
      rg.addColorStop(0.65, 'rgba(0, 4, 16, 0.34)');
      rg.addColorStop(1, 'rgba(0, 4, 16, 0)');
      sctx.fillStyle = rg;
      sctx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlaneGeo = new THREE.PlaneGeometry(outerFrameSpan + 1.15, outerFrameSpan + 1.15);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.set(0.08, -0.14, -0.41);
    boardGroup.add(shadowPlane);
    disposableGeos.push(shadowPlaneGeo);
    disposableMats.push(shadowPlaneMat);
    disposableTexs.push(shadowTex);

    // 3. Outer sculpted ceramic tray frame (beveled navy ceramic)
    const trayGeo = createRoundedTileGeometry(outerFrameSpan, outerFrameSpan, 0.32, 0.24);
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x0b1a36,
      roughness: 0.42,
      metalness: 0.22,
    });
    const trayMesh = new THREE.Mesh(trayGeo, trayMat);
    trayMesh.position.set(0, 0, -0.22);
    trayMesh.castShadow = !isSoftwareGl;
    trayMesh.receiveShadow = !isSoftwareGl;
    boardGroup.add(trayMesh);
    disposableGeos.push(trayGeo);
    disposableMats.push(trayMat);

    // 4. Recessed inner dark ceramic bed
    const bedGeo = new THREE.BoxGeometry(boardSpan + 0.14, boardSpan + 0.14, 0.08);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x050d1d,
      roughness: 0.78,
      metalness: 0.08,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.position.set(0, 0, -0.04);
    bedMesh.receiveShadow = !isSoftwareGl;
    boardGroup.add(bedMesh);
    disposableGeos.push(bedGeo);
    disposableMats.push(bedMat);

    // 5. Brushed emerald-teal outer accent frame rails (4 metallic bezel strips)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0a4d47,
      emissiveIntensity: 0.35,
      roughness: 0.26,
      metalness: 0.78,
    });
    disposableMats.push(railMat);
    const railThick = 0.048;
    const railDepth = 0.14;
    const halfOuter = boardSpan / 2 + 0.11;
    const hRailGeo = new THREE.BoxGeometry(boardSpan + 0.27, railThick, railDepth);
    const vRailGeo = new THREE.BoxGeometry(railThick, boardSpan + 0.27, railDepth);
    disposableGeos.push(hRailGeo, vRailGeo);

    const topRail = new THREE.Mesh(hRailGeo, railMat);
    topRail.position.set(0, halfOuter, 0.02);
    const botRail = new THREE.Mesh(hRailGeo, railMat);
    botRail.position.set(0, -halfOuter, 0.02);
    const leftRail = new THREE.Mesh(vRailGeo, railMat);
    leftRail.position.set(-halfOuter, 0, 0.02);
    const rightRail = new THREE.Mesh(vRailGeo, railMat);
    rightRail.position.set(halfOuter, 0, 0.02);
    boardGroup.add(topRail, botRail, leftRail, rightRail);

    // 6. Elevated emerald-teal region dividers (2x2 or 3x3)
    const boxSize = getBoxSize(size);
    const regionGap = size === 4 ? 0.11 : 0.08;
    const cellGap = size === 4 ? 0.055 : 0.032;
    const totalGaps = (size - 1) * cellGap + (boxSize - 1) * (regionGap - cellGap);
    const tileSpan = (boardSpan - totalGaps) / size;

    const getCellCenter = (idx: number): number => {
      const regionBreaksBefore = Math.floor(idx / boxSize);
      const offsetFromLeft =
        tileSpan / 2 + idx * (tileSpan + cellGap) + regionBreaksBefore * (regionGap - cellGap);
      return -boardSpan / 2 + offsetFromLeft;
    };

    const dividerMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d5c54,
      emissiveIntensity: 0.42,
      roughness: 0.22,
      metalness: 0.72,
    });
    disposableMats.push(dividerMat);
    const divThickness = size === 4 ? 0.055 : 0.042;
    const divHGeo = new THREE.BoxGeometry(boardSpan + 0.04, divThickness, 0.22);
    const divVGeo = new THREE.BoxGeometry(divThickness, boardSpan + 0.04, 0.22);
    disposableGeos.push(divHGeo, divVGeo);

    for (let bIdx = 1; bIdx < boxSize; bIdx++) {
      const prevCenter = getCellCenter(bIdx * boxSize - 1);
      const nextCenter = getCellCenter(bIdx * boxSize);
      const mid = (prevCenter + nextCenter) / 2;

      const vDiv = new THREE.Mesh(divVGeo, dividerMat);
      vDiv.position.set(mid, 0, 0.09);
      boardGroup.add(vDiv);

      const hDiv = new THREE.Mesh(divHGeo, dividerMat);
      hDiv.position.set(0, -mid, 0.09);
      boardGroup.add(hDiv);
    }

    // 7. Ceramic Tiles Grid (extruded beveled ceramic body + high-DPI top face texture)
    const tileDepth = 0.18;
    const tileBodyGeo = createRoundedTileGeometry(tileSpan * 0.96, tileSpan * 0.96, tileDepth, tileSpan * 0.11);
    const faceGeo = new THREE.PlaneGeometry(tileSpan * 0.92, tileSpan * 0.92);
    disposableGeos.push(tileBodyGeo, faceGeo);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const texResolution = size === 4 ? 256 : 160;
    const tiles: TileMeshBundle[] = [];
    const pickTargets: THREE.Object3D[] = [];

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cx = getCellCenter(c);
        const cy = -getCellCenter(r);

        const group = new THREE.Group();
        group.position.set(cx, cy, 0.08);

        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x13264a,
          roughness: 0.32,
          metalness: 0.18,
        });
        const bodyMesh = new THREE.Mesh(tileBodyGeo, bodyMat);
        bodyMesh.castShadow = !isSoftwareGl;
        bodyMesh.receiveShadow = !isSoftwareGl;
        bodyMesh.userData = { row: r, col: c };
        bodyMesh.layers.enable(1);

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = texResolution;
        faceCanvas.height = texResolution;
        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;
        faceTexture.anisotropy = maxAniso;

        const faceMat = new THREE.MeshStandardMaterial({
          map: faceTexture,
          roughness: 0.36,
          metalness: 0.06,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const faceMesh = new THREE.Mesh(faceGeo, faceMat);
        faceMesh.position.set(0, 0, tileDepth / 2 + 0.036);
        faceMesh.userData = { row: r, col: c };
        faceMesh.layers.enable(1);

        group.add(bodyMesh, faceMesh);
        boardGroup.add(group);
        pickTargets.push(faceMesh, bodyMesh);

        disposableMats.push(bodyMat, faceMat);
        disposableTexs.push(faceTexture);

        tiles.push({
          row: r,
          col: c,
          group,
          bodyMesh,
          faceMesh,
          bodyMat,
          faceCanvas,
          faceTexture,
          faceMat,
          lastSignature: '',
          currentZ: 0.08,
          targetZ: 0.08,
        });
      }
    }

    // Raycaster for crisp click/tap cell selection
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();

    const handlePointerDown = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pickTargets, false);
      if (hits.length > 0) {
        const { row, col } = hits[0].object.userData as { row?: number; col?: number };
        if (typeof row === 'number' && typeof col === 'number') {
          propsRef.current.onSelectCell(row, col);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // WebGL context loss guard
    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglStatus('fallback');
      propsRef.current.onWebGLUnavailable?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // On-demand render scheduler with software-WebGL fenceSync pacing
    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastFrameTime = performance.now();

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
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
          return;
        }
      } catch {
        // Ignore
      }
      frameId = window.setTimeout(cb, 80);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastFrameTime) / 1000, 0.08);
        lastFrameTime = now;

        const isReduced = propsRef.current.reducedMotion;
        const celebrateElapsed = celebrateStartRef.current > 0 ? (now - celebrateStartRef.current) / 1000 : -1;
        const celebrating = !isReduced && celebrateElapsed >= 0 && celebrateElapsed < 1.35;
        let stillAnimating = celebrating;

        for (const tile of tiles) {
          let desiredZ = tile.targetZ;
          if (celebrating) {
            const wavePhase = celebrateElapsed * 5.2 - (tile.row + tile.col) * 0.28;
            if (wavePhase > 0 && wavePhase < Math.PI) {
              desiredZ += Math.sin(wavePhase) * 0.14;
            }
          }
          if (isReduced) {
            tile.currentZ = desiredZ;
          } else {
            tile.currentZ = THREE.MathUtils.damp(tile.currentZ, desiredZ, 13, dt);
            if (Math.abs(tile.currentZ - desiredZ) > 0.002) {
              stillAnimating = true;
            } else {
              tile.currentZ = desiredZ;
            }
          }
          tile.group.position.z = tile.currentZ;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || stillAnimating) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    const syncBoardVisuals = () => {
      const p = propsRef.current;
      if (p.size !== size) return;
      const sel = p.selectedCell;
      const selectedVal = sel ? p.values[sel.row]?.[sel.col] ?? 0 : 0;
      const hintCellSet = new Set(p.activeHint?.highlightCells ?? []);
      const hintRowSet = new Set(p.activeHint?.highlightRows ?? []);
      const hintColSet = new Set(p.activeHint?.highlightCols ?? []);
      const hintBoxSet = new Set(p.activeHint?.highlightBoxes ?? []);
      const confRowSet = new Set(p.conflictUnitsHighlight?.rows ?? []);
      const confColSet = new Set(p.conflictUnitsHighlight?.cols ?? []);
      const confBoxSet = new Set(p.conflictUnitsHighlight?.boxes ?? []);

      // Update divider accent color slightly on completion
      dividerMat.color.setHex(p.isCompleted ? 0x34d399 : 0x2dd4bf);

      for (const tile of tiles) {
        const { row, col } = tile;
        const key = cellKey(row, col);
        const val = p.values[row]?.[col] ?? 0;
        const isGiven = (p.givens[row]?.[col] ?? 0) !== 0;
        const box = getBoxIndex(row, col, size);
        const isSelected = sel?.row === row && sel?.col === col;
        const isSamePeer =
          Boolean(sel) &&
          !isSelected &&
          (sel!.row === row || sel!.col === col || getBoxIndex(sel!.row, sel!.col, size) === box);
        const isSameValue = selectedVal > 0 && val === selectedVal && !isSelected;
        const isConflict = p.conflictCellKeys.has(key);
        const isConflictUnit = confRowSet.has(row) || confColSet.has(col) || confBoxSet.has(box);
        const isHintTarget =
          p.activeHint?.status === 'found' &&
          p.activeHint.targetCell?.row === row &&
          p.activeHint.targetCell?.col === col;
        const isHintUnit = hintRowSet.has(row) || hintColSet.has(col) || hintBoxSet.has(box);
        const isHintRelatedCell = hintCellSet.has(key) && !isHintTarget;

        const visual: TileVisualState = {
          size,
          row,
          col,
          value: val,
          isGiven,
          notes: p.notes[key] ?? [],
          isSelected,
          isSameValue,
          isSamePeer,
          isConflict,
          isConflictUnit,
          isHintTarget,
          isHintUnit,
          isHintRelatedCell,
          isCompleted: p.isCompleted,
        };

        const sig = buildTileVisualSignature(visual);
        if (sig !== tile.lastSignature) {
          tile.lastSignature = sig;
          drawCeramicTileCanvas(tile.faceCanvas, visual);
          tile.faceTexture.needsUpdate = true;

          // Update ceramic bevel body tint
          if (isConflict) {
            tile.bodyMat.color.setHex(0x881337);
          } else if (isHintTarget) {
            tile.bodyMat.color.setHex(0x92400e);
          } else if (isSelected) {
            tile.bodyMat.color.setHex(0x0f766e);
          } else if (isGiven) {
            tile.bodyMat.color.setHex(0x0d1b36);
          } else {
            tile.bodyMat.color.setHex(0x16305c);
          }
        }

        // Tactile ceramic elevation
        tile.targetZ = isConflict ? 0.17 : isHintTarget ? 0.18 : isSelected ? 0.19 : val > 0 && !isGiven ? 0.11 : 0.08;
      }

      requestRender();
    };

    syncBoardRef.current = syncBoardVisuals;

    // Responsive sizing with orthographic-feeling framing so board fills container cleanly on 1366x768, 1920x1080 & mobile
    const handleResize = () => {
      if (disposed || !container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      const aspect = w / h;
      camera.aspect = aspect;
      // Fit 6.35-unit board comfortably in both portrait & landscape
      const vFovRad = THREE.MathUtils.degToRad(camera.fov);
      const neededHeight = 6.55;
      const distV = neededHeight / (2 * Math.tan(vFovRad / 2));
      const distH = neededHeight / (2 * Math.tan(vFovRad / 2) * Math.max(aspect, 0.55));
      const dist = Math.max(distV, distH);
      camera.position.set(0, -dist * 0.095, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestRender();
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    handleResize();

    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Ignore shader pre-warm errors
      }
    }
    syncBoardVisuals();

    return () => {
      disposed = true;
      syncBoardRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableTexs.forEach((tx) => tx.dispose());
      envRT.dispose();
      renderer.dispose();
    };
  }, [webglStatus, size, onWebGLUnavailable]);

  if (webglStatus !== 'ready') {
    return <Sudoku2DBoard {...props} />;
  }

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[400px] rounded-2xl overflow-hidden bg-[#061024]">
      <div
        ref={mountRef}
        className="w-full h-full"
        role="application"
        aria-label={`Bảng Sudoku 3D ${size} nhân ${size}. Nhấn vào ô để chọn và dùng bàn phím hoặc phím số để điền.`}
      />
    </div>
  );
};
