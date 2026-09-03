// 앱 최초 진입 시 패턴 잠금화면 — 안드로이드 스타일 9점 패턴.
// 정답 패턴은 ㄱ자 모양(왼쪽 위 → 오른쪽 위 → 아래로)으로 고정되어 있다.

import { useCallback, useRef, useState } from "react";

// 3x3 격자 인덱스 0~8을 좌상단부터 행 우선으로 두었을 때 ㄱ자 모양의 궤적
//  0 1 2        0→1→2 (가로)
//  3 4 5   →         2→5→8 (세로)
//  6 7 8
const TARGET_PATTERN = [0, 1, 2, 5, 8];

const GRID_SIZE = 280;
const DOT_GAP = 100;
const DOT_OFFSET = 40;
const HIT_RADIUS = 32;

const DOTS = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return { x: DOT_OFFSET + col * DOT_GAP, y: DOT_OFFSET + row * DOT_GAP };
});

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function hitDot(x: number, y: number) {
  for (let i = 0; i < DOTS.length; i++) {
    if (distance(x, y, DOTS[i].x, DOTS[i].y) <= HIT_RADIUS) return i;
  }
  return -1;
}

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const finish = (finalPath: number[]) => {
    setDrawing(false);
    setCursor(null);
    const matched =
      finalPath.length === TARGET_PATTERN.length &&
      finalPath.every((value, i) => value === TARGET_PATTERN[i]);

    if (matched) {
      setSuccess(true);
      setTimeout(onUnlock, 420);
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPath([]);
      }, 480);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (success) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    const hit = hitDot(x, y);
    if (hit === -1) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrawing(true);
    setPath([hit]);
    setCursor({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawing || success) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    setCursor({ x, y });
    const hit = hitDot(x, y);
    if (hit !== -1) {
      setPath((prev) => (prev.includes(hit) ? prev : [...prev, hit]));
    }
  };

  const handlePointerUp = () => {
    if (!drawing || success) return;
    finish(path);
  };

  const statusText = success
    ? "패턴 확인 완료"
    : shake
      ? "패턴이 일치하지 않아요"
      : "패턴을 그려 잠금을 해제하세요";
  const statusColor = success ? "text-emerald-600" : shake ? "text-red-500" : "text-gray-400";
  const lineColor = success ? "#059669" : "#1d4ed8";

  return (
    // 바깥(화면 양옆)은 그대로 흰 배경 — 색이 칠해지는 영역은 안쪽의 max-w-[430px] 칼럼,
    // 즉 실제 홈 화면(은행 앱 프레임)과 정확히 같은 폭·위치로만 한정한다.
    <div className="fixed inset-0 z-[200] bg-white">
      <div
        className={`relative mx-auto flex h-full max-w-[430px] flex-col items-center justify-center bg-[#e2edfe] px-6 ${
          shake ? "[animation:shake_0.48s_ease]" : ""
        }`}
      >
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--ac-100)] bg-white shadow-sm">
        <svg viewBox="0 0 24 24" fill="#2563eb" className="h-8 w-8">
          <path d="M12 2L2 7.5v1h20v-1L12 2z" />
          <path d="M4.5 9h2v8h-2zM9 9h2v8H9zM13 9h2v8h-2zM17.5 9h2v8h-2z" />
          <path d="M2 17h20v2H2z" />
          <circle cx="12" cy="5.2" r="0.8" fill="white" />
        </svg>
      </div>
      <p className="mt-4 text-[17px] font-bold text-gray-900 tracking-tight">한결은행</p>
      <p className={`mt-1.5 text-[12px] font-medium transition-colors ${statusColor}`}>{statusText}</p>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative mt-9 touch-none select-none"
        style={{ width: GRID_SIZE, height: GRID_SIZE }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={GRID_SIZE} height={GRID_SIZE}>
          {path.slice(1).map((idx, i) => {
            const a = DOTS[path[i]];
            const b = DOTS[idx];
            return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lineColor} strokeWidth={5} strokeLinecap="round" />;
          })}
          {drawing && cursor && path.length > 0 && (
            <line
              x1={DOTS[path[path.length - 1]].x}
              y1={DOTS[path[path.length - 1]].y}
              x2={cursor.x}
              y2={cursor.y}
              stroke={lineColor}
              strokeWidth={5}
              strokeLinecap="round"
            />
          )}
        </svg>

        {DOTS.map((d, i) => {
          const active = path.includes(i);
          return (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: d.x, top: d.y }}>
              <div
                className={`h-5 w-5 rounded-full border-[3px] transition-colors duration-150 ${
                  success
                    ? "border-emerald-600 bg-emerald-500"
                    : active
                      ? "border-[#1d4ed8] bg-[#2563eb]"
                      : "border-gray-500 bg-white"
                }`}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-9 text-[11px] text-gray-300">힌트 · ㄱ 자 모양으로 그어보세요</p>
      </div>
    </div>
  );
}
