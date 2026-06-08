import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';

interface S23UltraFrameProps {
  children: React.ReactNode;
  onSPenClick: () => void;
  onCameraClick: () => void;
}

const BEZEL_COLORS = [
  { label: 'Phantom Black', value: '#0a0a0a' },
  { label: 'Botanic Green', value: '#2d3b2e' },
  { label: 'Cream', value: '#e8dcc8' },
  { label: 'Lavender', value: '#9b8ec4' },
];

export default function S23UltraFrame({ children, onSPenClick, onCameraClick }: S23UltraFrameProps) {
  const { state, dispatch } = useDatabase();
  const { settings } = state;
  const [showVolumeHUD, setShowVolumeHUD] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(50);
  const [screenOn, setScreenOn] = useState(true);
  const [showBezelPicker, setShowBezelPicker] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [charging] = useState(settings.charging);
  const [batteryLevel, setBatteryLevel] = useState(settings.batteryLevel);
  const volumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Battery simulation
  useEffect(() => {
    if (!charging) return;
    const timer = setInterval(() => {
      setBatteryLevel(l => {
        const next = Math.min(100, l + 1);
        dispatch({ type: 'UPDATE_SETTINGS', settings: { batteryLevel: next } });
        return next;
      });
    }, 10000);
    return () => clearInterval(timer);
  }, [charging, dispatch]);

  const handleVolume = (direction: 'up' | 'down') => {
    setVolumeLevel(v => {
      const next = direction === 'up' ? Math.min(100, v + 10) : Math.max(0, v - 10);
      return next;
    });
    setShowVolumeHUD(true);
    if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    volumeTimeout.current = setTimeout(() => setShowVolumeHUD(false), 2000);
  };

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bezelColor = settings.bezelColor || '#0a0a0a';


  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      {/* Phone outer shell */}
      <div
        className="relative flex flex-col"
        style={{
          width: 390,
          height: 844,
          background: `linear-gradient(145deg, ${bezelColor}dd, ${bezelColor}99, ${bezelColor})`,
          borderRadius: 44,
          boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 0 2px ${bezelColor}`,
        }}
      >
        {/* Physical buttons - LEFT */}
        {/* Volume up */}
        <button
          onClick={() => handleVolume('up')}
          className="absolute -left-1.5 top-32 rounded-l-md active:scale-95 transition-transform"
          style={{ width: 4, height: 36, background: bezelColor, filter: 'brightness(0.7)', boxShadow: '-1px 0 4px rgba(0,0,0,0.6)' }}
          title="Volume Up"
        />
        {/* Volume down */}
        <button
          onClick={() => handleVolume('down')}
          className="absolute -left-1.5 top-48 rounded-l-md active:scale-95 transition-transform"
          style={{ width: 4, height: 36, background: bezelColor, filter: 'brightness(0.7)', boxShadow: '-1px 0 4px rgba(0,0,0,0.6)' }}
          title="Volume Down"
        />

        {/* Physical buttons - RIGHT */}
        {/* Power button */}
        <button
          onClick={() => setScreenOn(!screenOn)}
          className="absolute -right-1.5 top-36 rounded-r-md active:scale-95 transition-transform"
          style={{ width: 4, height: 52, background: bezelColor, filter: 'brightness(0.7)', boxShadow: '1px 0 4px rgba(0,0,0,0.6)' }}
          title="Power"
        />

        {/* Screen area */}
        <div
          className="relative flex-1 m-2 rounded-[38px] overflow-hidden"
          style={{ background: '#000' }}
        >
          {!screenOn ? (
            /* Lock screen */
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-3"
              style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #111124 100%)' }}
              onClick={() => setScreenOn(true)}
            >
              <div className="text-white/20 text-5xl mb-2">🔒</div>
              <div className="text-white text-4xl font-thin">{timeStr}</div>
              <div className="text-white/50 text-sm">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="mt-8 text-white/30 text-xs animate-pulse">Tap to unlock</div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              {/* Status bar */}
              <div
                className="flex items-center justify-between px-5 pt-2 pb-1 shrink-0"
                style={{ paddingTop: 14 }}
              >
                <span className="text-white text-xs font-semibold">{timeStr}</span>
                <div className="flex items-center gap-1.5">
                  {/* 5G */}
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="white" opacity="0.9">
                    <text y="9" fontSize="8" fontWeight="bold">5G</text>
                  </svg>
                  {/* WiFi */}
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9">
                    <path d="M7 9 L7 9" strokeLinecap="round" />
                    <path d="M4 7 Q7 4 10 7" strokeLinecap="round" fill="none" />
                    <path d="M1 5 Q7 0 13 5" strokeLinecap="round" fill="none" />
                  </svg>
                  {/* Battery */}
                  <div className="flex items-center gap-0.5">
                    <div className="relative w-6 h-3 border border-white/80 rounded-sm">
                      <div
                        className={`absolute inset-0.5 rounded-sm transition-all ${batteryLevel > 20 ? (charging ? 'bg-green-400' : 'bg-white') : 'bg-red-400'}`}
                        style={{ width: `${batteryLevel}%` }}
                      />
                    </div>
                    {charging && <span className="text-yellow-300 text-[8px]">⚡</span>}
                  </div>
                </div>
              </div>

              {/* Punch-hole camera */}
              <div className="flex justify-center -mt-1 mb-0.5 shrink-0">
                <div className="w-3 h-3 rounded-full bg-black border border-white/5"
                  style={{ boxShadow: 'inset 0 0 4px rgba(0,0,0,0.9)' }}
                />
              </div>

              {/* App content */}
              <div className="flex-1 overflow-hidden">
                {children}
              </div>

              {/* Navigation bar */}
              {settings.navMode === 'buttons' ? (
                <div
                  className="flex items-center justify-around px-8 py-2 shrink-0"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
                >
                  {/* Back */}
                  <button
                    onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: false, rightSidebarOpen: false } })}
                    className="p-2 text-white/70 hover:text-white active:scale-90 transition-transform"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M5 12l7-7M5 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {/* Home */}
                  <button
                    onClick={() => dispatch({ type: 'ENSURE_TODAY_JOURNAL' } as any)}
                    className="p-2 text-white/70 hover:text-white active:scale-90 transition-transform"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  </button>
                  {/* Recents */}
                  <button
                    onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: !settings.sidebarOpen } })}
                    className="p-2 text-white/70 hover:text-white active:scale-90 transition-transform"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex justify-center py-3 shrink-0">
                  <div className="w-32 h-1 rounded-full bg-white/30" />
                </div>
              )}
            </div>
          )}

          {/* Volume HUD */}
          {showVolumeHUD && (
            <div className="absolute top-16 left-3 z-50 bg-black/80 backdrop-blur-md rounded-2xl px-3 py-2 flex items-center gap-2 shadow-xl border border-white/10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
              <div className="w-28 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${volumeLevel}%` }} />
              </div>
              <span className="text-white text-[10px]">{volumeLevel}%</span>
            </div>
          )}
        </div>

        {/* Bottom area: S-Pen slot */}
        <div className="flex items-center justify-between px-4 pb-2 shrink-0">
          {/* S-Pen slot */}
          <button
            onClick={onSPenClick}
            className="w-2 h-8 rounded-full transition-all active:scale-95 hover:brightness-125"
            style={{
              background: 'linear-gradient(to bottom, #a78bfa, #7c3aed)',
              boxShadow: '0 0 8px rgba(139,92,246,0.6)',
            }}
            title="Pull out S-Pen"
          />
          {/* Bezel picker */}
          <div className="relative">
            <button
              onClick={() => setShowBezelPicker(!showBezelPicker)}
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ background: bezelColor }}
              title="Change bezel color"
            />
            {showBezelPicker && (
              <div className="absolute bottom-6 right-0 flex gap-2 bg-black/80 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-xl">
                {BEZEL_COLORS.map(bc => (
                  <button
                    key={bc.value}
                    onClick={() => { dispatch({ type: 'UPDATE_SETTINGS', settings: { bezelColor: bc.value } }); setShowBezelPicker(false); }}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ background: bc.value, borderColor: bezelColor === bc.value ? 'white' : 'transparent' }}
                    title={bc.label}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Camera button hint */}
          <button
            onClick={onCameraClick}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
            title="Camera"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
