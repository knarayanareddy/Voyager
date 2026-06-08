import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useDatabase } from '../context/DatabaseContext';

const BEZEL_COLORS = [
  { label: 'Phantom Black', value: '#0a0a0a' },
  { label: 'Botanic Green', value: '#2d3b2e' },
  { label: 'Cream', value: '#d4c5a9' },
  { label: 'Lavender', value: '#9b8ec4' },
  { label: 'Titanium', value: '#2c2c2e' },
];

interface Props {
  children: ReactNode;
  onSPenClick: () => void;
  onCameraClick?: () => void;
}

export default function S23UltraFrame({ children, onSPenClick }: Props) {
  const { state, dispatch } = useDatabase();
  const { settings } = state;

  const [screenOn, setScreenOn] = useState(true);
  const [volumeLevel, setVolumeLevel] = useState(70);
  const [showVolumeHUD, setShowVolumeHUD] = useState(false);
  const [showBezelPicker, setShowBezelPicker] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const volumeHUDTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chargingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real-time clock ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Charging simulation ──────────────────────────────────────────────────
  useEffect(() => {
    if (settings.charging) {
      chargingTimerRef.current = setInterval(() => {
        dispatch({
          type: 'UPDATE_SETTINGS',
          settings: { batteryLevel: Math.min(100, settings.batteryLevel + 1) },
        });
      }, 3000);
    } else {
      if (chargingTimerRef.current) clearInterval(chargingTimerRef.current);
    }
    return () => {
      if (chargingTimerRef.current) clearInterval(chargingTimerRef.current);
    };
  }, [settings.charging, settings.batteryLevel, dispatch]);

  // ── Volume HUD ────────────────────────────────────────────────────────────
  const showVolume = useCallback(() => {
    setShowVolumeHUD(true);
    if (volumeHUDTimerRef.current) clearTimeout(volumeHUDTimerRef.current);
    volumeHUDTimerRef.current = setTimeout(() => setShowVolumeHUD(false), 2000);
  }, []);

  const handleVolumeUp = () => {
    setVolumeLevel(v => Math.min(100, v + 10));
    showVolume();
  };

  const handleVolumeDown = () => {
    setVolumeLevel(v => Math.max(0, v - 10));
    showVolume();
  };

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bezel = settings.bezelColor;
  const isLightBezel = bezel === '#d4c5a9' || bezel === '#9b8ec4';

  const batteryPct = settings.batteryLevel;
  const batteryColor =
    batteryPct > 60 ? '#10b981' : batteryPct > 30 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="relative select-none"
      style={{ width: 390, height: 860 }}
    >
      {/* ── Phone shell ─────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 rounded-[52px] shadow-2xl"
        style={{
          background: bezel,
          boxShadow: `0 0 0 1px ${isLightBezel ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)'}, 0 40px 80px -20px rgba(0,0,0,0.8), 0 0 0 0.5px ${isLightBezel ? '#999' : '#333'}`,
        }}
      />

      {/* ── Volume Up button ─────────────────────────────────────────────── */}
      <button
        onClick={handleVolumeUp}
        className="absolute left-0 top-32 w-1 h-14 rounded-r-sm cursor-pointer hover:brightness-150 transition-all"
        style={{ background: isLightBezel ? '#aaa' : '#333', marginLeft: -2 }}
        title="Volume Up"
      />
      {/* ── Volume Down button ───────────────────────────────────────────── */}
      <button
        onClick={handleVolumeDown}
        className="absolute left-0 top-52 w-1 h-14 rounded-r-sm cursor-pointer hover:brightness-150 transition-all"
        style={{ background: isLightBezel ? '#aaa' : '#333', marginLeft: -2 }}
        title="Volume Down"
      />
      {/* ── Power button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setScreenOn(s => !s)}
        className="absolute right-0 top-44 w-1 h-20 rounded-l-sm cursor-pointer hover:brightness-150 transition-all"
        style={{ background: isLightBezel ? '#aaa' : '#333', marginRight: -2 }}
        title="Power"
      />

      {/* ── Bezel color picker button ─────────────────────────────────────── */}
      <button
        onClick={() => setShowBezelPicker(p => !p)}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white/20 hover:border-white/50 transition-colors"
        style={{ background: bezel }}
        title="Change bezel color"
      />

      {/* Bezel color picker popup */}
      {showBezelPicker && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 z-50 flex gap-2 shadow-2xl animate-slide-in-up">
          {BEZEL_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => {
                dispatch({ type: 'UPDATE_SETTINGS', settings: { bezelColor: c.value } });
                setShowBezelPicker(false);
              }}
              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${settings.bezelColor === c.value ? 'border-white scale-110' : 'border-white/20'}`}
              style={{ background: c.value }}
              title={c.label}
            />
          ))}
        </div>
      )}

      {/* ── Screen ───────────────────────────────────────────────────────── */}
      <div
        className="absolute rounded-[44px] overflow-hidden"
        style={{
          top: 12, left: 12, right: 12, bottom: 12,
          background: '#0f172a',
        }}
      >
        {!screenOn ? (
          /* Lock screen */
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950 cursor-pointer"
            onClick={() => setScreenOn(true)}
          >
            <div className="text-6xl">🔒</div>
            <p className="text-white text-3xl font-light tracking-widest">{timeStr}</p>
            <p className="text-slate-400 text-sm">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-slate-600 text-xs mt-4">Swipe up to unlock</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col bg-slate-950">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0 z-10">
              <span className="text-white text-xs font-semibold">{timeStr}</span>
              <div className="flex items-center gap-2">
                {/* 5G */}
                <span className="text-white text-[9px] font-bold">5G</span>
                {/* Signal bars */}
                <div className="flex items-end gap-px">
                  {[3, 5, 7, 9].map((h, i) => (
                    <div key={i} className="w-0.5 rounded-sm bg-white" style={{ height: h }} />
                  ))}
                </div>
                {/* WiFi */}
                <svg width="14" height="10" viewBox="0 0 14 10" fill="white" opacity={0.9}>
                  <path d="M7 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                  <path d="M4.5 6.5C5.1 5.9 6 5.5 7 5.5s1.9.4 2.5 1" strokeWidth={1.2} stroke="white" fill="none" />
                  <path d="M2 4.5C3.2 3.3 5 2.5 7 2.5s3.8.8 5 2" strokeWidth={1.2} stroke="white" fill="none" />
                </svg>
                {/* Battery */}
                <div className="flex items-center gap-0.5">
                  <div
                    className="relative rounded-sm border border-white/70 overflow-hidden"
                    style={{ width: 22, height: 11 }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm transition-all"
                      style={{ width: `${batteryPct}%`, background: batteryColor }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-white leading-none z-10">
                        {batteryPct}
                      </span>
                    </div>
                  </div>
                  <div className="w-0.5 h-1.5 rounded-r-sm bg-white/50" />
                  {settings.charging && (
                    <span className="text-amber-400 text-[10px] animate-charging">⚡</span>
                  )}
                </div>
              </div>
            </div>

            {/* Punch-hole camera */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black z-20 border border-slate-800" />

            {/* Volume HUD */}
            {showVolumeHUD && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-slate-700 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl animate-slide-in-up">
                <span className="text-xl">🔊</span>
                <div>
                  <p className="text-white text-xs font-semibold">Volume</p>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-3 rounded-sm transition-colors"
                        style={{ background: i < volumeLevel / 10 ? '#6366f1' : '#334155' }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-slate-400 text-xs font-mono">{volumeLevel}%</span>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 overflow-hidden relative">
              {children}
            </div>

            {/* S-Pen slot indicator */}
            <button
              onClick={onSPenClick}
              className="absolute bottom-16 right-4 w-6 h-6 rounded-full bg-indigo-600/80 flex items-center justify-center text-white text-xs hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/30 z-20"
              title="S-Pen Air Command"
            >
              ✏
            </button>
          </div>
        )}
      </div>

      {/* ── One UI navigation bar ─────────────────────────────────────────── */}
      {screenOn && settings.navMode === 'buttons' && (
        <div
          className="absolute bottom-0 left-12 right-12 flex items-center justify-around py-3 z-10"
          style={{ pointerEvents: 'none' }}
        >
          {['◄', '●', '■'].map((btn, i) => (
            <button
              key={i}
              className="text-white/40 text-sm hover:text-white/70 transition-colors"
              style={{ pointerEvents: 'auto' }}
              onClick={i === 1 ? () => {/* home */} : undefined}
            >
              {btn}
            </button>
          ))}
        </div>
      )}
      {screenOn && settings.navMode === 'gesture' && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-white/30 z-10"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
