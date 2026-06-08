import { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';

interface S23UltraFrameProps {
  children: React.ReactNode;
  onSPenClick: () => void;
  onCameraClick?: () => void;
}

const BEZEL_COLORS = [
  { label: 'Phantom Black', value: '#0a0a0a' },
  { label: 'Botanic Green', value: '#2d3b2e' },
  { label: 'Cream', value: '#d4c5a9' },
  { label: 'Lavender', value: '#9b8ec4' },
  { label: 'Titanium', value: '#2c2c2e' },
];

export default function S23UltraFrame({ children, onSPenClick }: S23UltraFrameProps) {
  const { state, dispatch } = useDatabase();
  const { settings } = state;
  const [showVolumeHUD, setShowVolumeHUD] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(50);
  const [screenOn, setScreenOn] = useState(true);
  const [showBezelPicker, setShowBezelPicker] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(settings.batteryLevel);
  const volumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setBatteryLevel(settings.batteryLevel);
  }, [settings.batteryLevel]);

  useEffect(() => {
    if (!settings.charging) return;
    const timer = setInterval(() => {
      setBatteryLevel(l => {
        const next = Math.min(100, l + 1);
        dispatch({ type: 'UPDATE_SETTINGS', settings: { batteryLevel: next } });
        return next;
      });
    }, 12000);
    return () => clearInterval(timer);
  }, [settings.charging, dispatch]);

  const handleVolume = (direction: 'up' | 'down') => {
    setVolumeLevel(v => Math.max(0, Math.min(100, direction === 'up' ? v + 10 : v - 10)));
    setShowVolumeHUD(true);
    if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    volumeTimeout.current = setTimeout(() => setShowVolumeHUD(false), 2200);
  };

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bezelColor = settings.bezelColor || '#0a0a0a';

  // Determine if bezel is light-colored
  const isLightBezel = bezelColor === '#d4c5a9' || bezelColor === '#9b8ec4';

  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      {/* Phone outer shell */}
      <div
        className="relative flex flex-col"
        style={{
          width: 390,
          height: 844,
          background: `linear-gradient(155deg, ${bezelColor}ee, ${bezelColor}cc, ${bezelColor})`,
          borderRadius: 46,
          boxShadow: `
            0 40px 100px rgba(0,0,0,0.85),
            0 0 0 1px rgba(255,255,255,${isLightBezel ? '0.3' : '0.07'}) inset,
            0 0 0 2px ${bezelColor},
            0 0 60px rgba(99,102,241,0.05)
          `,
        }}
      >
        {/* Antenna line decoration */}
        <div
          className="absolute"
          style={{
            top: 80,
            left: -1,
            right: -1,
            height: 1,
            background: `rgba(${isLightBezel ? '0,0,0' : '255,255,255'},0.08)`,
          }}
        />

        {/* Physical buttons - LEFT */}
        {/* Volume up */}
        <button
          onClick={() => handleVolume('up')}
          className="absolute rounded-l-sm active:scale-95 transition-transform cursor-pointer"
          style={{
            width: 4, height: 36,
            top: 128, left: -4,
            background: `linear-gradient(90deg, ${bezelColor}77, ${bezelColor}bb)`,
            boxShadow: '-2px 0 6px rgba(0,0,0,0.5)',
          }}
          title="Volume Up"
        />
        {/* Volume down */}
        <button
          onClick={() => handleVolume('down')}
          className="absolute rounded-l-sm active:scale-95 transition-transform cursor-pointer"
          style={{
            width: 4, height: 36,
            top: 174, left: -4,
            background: `linear-gradient(90deg, ${bezelColor}77, ${bezelColor}bb)`,
            boxShadow: '-2px 0 6px rgba(0,0,0,0.5)',
          }}
          title="Volume Down"
        />

        {/* Physical buttons - RIGHT */}
        {/* Power button */}
        <button
          onClick={() => setScreenOn(s => !s)}
          className="absolute rounded-r-sm active:scale-95 transition-transform cursor-pointer"
          style={{
            width: 4, height: 54,
            top: 148, right: -4,
            background: `linear-gradient(270deg, ${bezelColor}77, ${bezelColor}bb)`,
            boxShadow: '2px 0 6px rgba(0,0,0,0.5)',
          }}
          title="Power"
        />

        {/* S-Pen slot at bottom */}
        <button
          onClick={onSPenClick}
          className="absolute rounded-full active:scale-95 transition-transform cursor-pointer group"
          title="S-Pen"
          style={{
            width: 6, height: 28,
            bottom: 20, right: 16,
            background: `linear-gradient(180deg, rgba(129,140,248,0.6), rgba(99,102,241,0.4))`,
            boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
            borderRadius: 3,
          }}
        >
          <span
            className="absolute -top-5 -left-8 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            style={{ color: '#818cf8' }}
          >
            ✏️ S-Pen
          </span>
        </button>

        {/* Screen area */}
        <div
          className="relative flex-1 m-[6px] rounded-[40px] overflow-hidden"
          style={{ background: '#000' }}
        >
          {!screenOn ? (
            /* Lock screen */
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer phone-screen-active"
              style={{
                background: 'linear-gradient(160deg, #080818 0%, #0f0f24 50%, #080814 100%)',
              }}
              onClick={() => setScreenOn(true)}
            >
              <div className="text-white/15 text-4xl mb-1">🔒</div>
              <div className="text-white text-5xl font-thin tracking-tight">{timeStr}</div>
              <div className="text-white/40 text-sm">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="mt-6 text-white/25 text-xs animate-pulse flex items-center gap-1.5">
                <span>Swipe up to unlock</span>
              </div>
              {/* Wallpaper decoration */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 30% 60%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(139,92,246,0.06) 0%, transparent 50%)',
                }}
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              {/* Status bar */}
              <div
                className="flex items-center justify-between px-4 shrink-0"
                style={{ paddingTop: 12, paddingBottom: 4 }}
              >
                <span className="text-white text-[11px] font-semibold tracking-tight">{timeStr}</span>
                <div className="flex items-center gap-1.5">
                  {/* 5G */}
                  <svg width="18" height="11" viewBox="0 0 18 11">
                    <text y="9.5" fontSize="9" fontWeight="bold" fill="white" opacity="0.85" fontFamily="system-ui">5G</text>
                  </svg>
                  {/* Signal bars */}
                  <div className="flex items-end gap-[2px]">
                    {[3, 5, 7, 9].map((h, i) => (
                      <div key={i} style={{ width: 2.5, height: h, background: i < 3 ? 'white' : 'rgba(255,255,255,0.3)', borderRadius: 1, opacity: 0.85 }} />
                    ))}
                  </div>
                  {/* WiFi */}
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" opacity="0.85">
                    <circle cx="7" cy="9" r="1.2" fill="white"/>
                    <path d="M4.2 6.8 Q7 4.2 9.8 6.8" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                    <path d="M1.5 4.5 Q7 0 12.5 4.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                  </svg>
                  {/* Battery */}
                  <div className="flex items-center gap-0.5">
                    <div className="relative w-6 h-3.5 rounded-sm border border-white/70" style={{ borderRadius: '2px' }}>
                      <div className="absolute -right-[3px] top-[3px] w-[2.5px] h-[6px] bg-white/60 rounded-r-sm" />
                      <div
                        className="absolute inset-[1.5px] rounded-sm transition-all"
                        style={{
                          width: `calc(${batteryLevel}% - 3px)`,
                          background: batteryLevel > 30
                            ? (settings.charging ? '#4ade80' : 'white')
                            : '#f87171',
                        }}
                      />
                    </div>
                    {settings.charging && <span className="text-yellow-300 text-[8px] leading-none">⚡</span>}
                  </div>
                </div>
              </div>

              {/* Punch-hole front camera */}
              <div className="flex justify-center shrink-0 -mt-0.5 mb-0.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: '#000',
                    boxShadow: 'inset 0 0 3px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,0.04)',
                  }}
                />
              </div>

              {/* Volume HUD */}
              {showVolumeHUD && (
                <div
                  className="absolute z-50 animate-fade-in"
                  style={{ top: 52, right: 12 }}
                >
                  <div
                    className="flex flex-col items-center gap-2 px-2.5 py-3 rounded-2xl"
                    style={{
                      background: 'rgba(20,20,32,0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                  >
                    <span className="text-[9px] text-slate-400 font-medium">
                      {volumeLevel === 0 ? '🔇' : volumeLevel < 40 ? '🔉' : '🔊'}
                    </span>
                    <div className="h-20 w-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <div
                        className="transition-all duration-200 w-full rounded-full"
                        style={{
                          height: `${volumeLevel}%`,
                          background: 'linear-gradient(180deg, #a5b4fc, #6366f1)',
                          position: 'absolute',
                          bottom: 0,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-bold">{volumeLevel}</span>
                  </div>
                </div>
              )}

              {/* App content */}
              <div className="flex-1 overflow-hidden">
                {children}
              </div>

              {/* Navigation bar */}
              {settings.navMode === 'buttons' ? (
                <div
                  className="flex items-center justify-around px-8 py-2 shrink-0"
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(16px)',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Back */}
                  <button
                    onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { sidebarOpen: false, rightSidebarOpen: false } })}
                    className="p-2 text-white/50 hover:text-white active:scale-90 transition-all"
                    title="Back"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M5 12l7-7M5 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {/* Home */}
                  <button
                    onClick={() => dispatch({ type: 'ENSURE_TODAY_JOURNAL' } as any)}
                    className="p-2 text-white/50 hover:text-white active:scale-90 transition-all"
                    title="Home"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="2" y="8" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <path d="M2 8L12 2L22 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                    </svg>
                  </button>
                  {/* Recents */}
                  <button
                    className="p-2 text-white/50 hover:text-white active:scale-90 transition-all"
                    title="Recents"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="4" width="7" height="7" rx="1" />
                      <rect x="13" y="4" width="7" height="7" rx="1" />
                      <rect x="4" y="13" width="7" height="7" rx="1" />
                      <rect x="13" y="13" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* Gesture bar */
                <div className="flex justify-center py-2 shrink-0">
                  <div className="w-24 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bezel color picker */}
        <button
          className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
          onClick={() => setShowBezelPicker(p => !p)}
        >
          🎨 Change Color
        </button>

        {showBezelPicker && (
          <div
            className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-xl z-50 animate-fade-in"
            style={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
          >
            {BEZEL_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => { dispatch({ type: 'UPDATE_SETTINGS', settings: { bezelColor: c.value } }); setShowBezelPicker(false); }}
                className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                style={{
                  background: c.value,
                  borderColor: settings.bezelColor === c.value ? '#818cf8' : 'rgba(255,255,255,0.2)',
                }}
                title={c.label}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
