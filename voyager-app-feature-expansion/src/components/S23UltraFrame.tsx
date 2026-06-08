import { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';

const BEZEL_COLORS = [
  { label: 'Phantom Black', value: '#0a0a0a' },
  { label: 'Botanic Green', value: '#2d3b2e' },
  { label: 'Cream', value: '#d4c5a9' },
  { label: 'Lavender', value: '#9b8ec4' },
  { label: 'Titanium', value: '#2c2c2e' },
];

interface Props {
  children: React.ReactNode;
  onSPenClick: () => void;
  onCameraClick?: () => void;
}

export default function S23UltraFrame({ children, onSPenClick }: Props) {
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

  useEffect(() => { setBatteryLevel(settings.batteryLevel); }, [settings.batteryLevel]);

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

  const handleVolume = (dir: 'up' | 'down') => {
    setVolumeLevel(v => Math.max(0, Math.min(100, dir === 'up' ? v + 10 : v - 10)));
    setShowVolumeHUD(true);
    if (volumeTimeout.current) clearTimeout(volumeTimeout.current);
    volumeTimeout.current = setTimeout(() => setShowVolumeHUD(false), 2200);
  };

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const bezelColor = settings.bezelColor || '#0a0a0a';
  const isLightBezel = bezelColor === '#d4c5a9' || bezelColor === '#9b8ec4';

  const batteryColor = batteryLevel > 50 ? '#4ade80' : batteryLevel > 20 ? '#fbbf24' : '#f87171';

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
        {/* Antenna line */}
        <div className="absolute" style={{ top: 80, left: -1, right: -1, height: 1, background: `rgba(${isLightBezel ? '0,0,0' : '255,255,255'},0.08)` }} />

        {/* Volume Up */}
        <button
          onClick={() => handleVolume('up')}
          className="absolute rounded-l-sm active:scale-95 transition-transform cursor-pointer"
          style={{ width: 4, height: 36, top: 128, left: -4, background: `linear-gradient(90deg, ${bezelColor}77, ${bezelColor}bb)`, boxShadow: '-2px 0 6px rgba(0,0,0,0.5)' }}
          title="Volume Up"
        />
        {/* Volume Down */}
        <button
          onClick={() => handleVolume('down')}
          className="absolute rounded-l-sm active:scale-95 transition-transform cursor-pointer"
          style={{ width: 4, height: 36, top: 174, left: -4, background: `linear-gradient(90deg, ${bezelColor}77, ${bezelColor}bb)`, boxShadow: '-2px 0 6px rgba(0,0,0,0.5)' }}
          title="Volume Down"
        />
        {/* Power button */}
        <button
          onClick={() => setScreenOn(s => !s)}
          className="absolute rounded-r-sm active:scale-95 transition-transform cursor-pointer"
          style={{ width: 4, height: 54, top: 148, right: -4, background: `linear-gradient(270deg, ${bezelColor}77, ${bezelColor}bb)`, boxShadow: '2px 0 6px rgba(0,0,0,0.5)' }}
          title="Power"
        />
        {/* S-Pen slot */}
        <button
          onClick={onSPenClick}
          className="absolute rounded-full active:scale-95 transition-transform cursor-pointer group"
          title="S-Pen — Click to activate Air Command"
          style={{ width: 6, height: 28, bottom: 20, right: 16, background: 'linear-gradient(180deg, rgba(129,140,248,0.6), rgba(99,102,241,0.4))', boxShadow: '0 2px 8px rgba(99,102,241,0.4)', borderRadius: 3 }}
        >
          <span className="absolute -top-5 -left-8 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap" style={{ color: '#818cf8' }}>✏️ S-Pen</span>
        </button>

        {/* Bezel color picker button */}
        <button
          onClick={() => setShowBezelPicker(p => !p)}
          className="absolute bottom-4 left-4 text-[8px] rounded-full w-5 h-5 flex items-center justify-center opacity-30 hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.1)', color: isLightBezel ? '#000' : '#fff' }}
          title="Change bezel color"
        >🎨</button>

        {/* Bezel color picker */}
        {showBezelPicker && (
          <div className="absolute bottom-12 left-2 bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl z-50">
            {BEZEL_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => { dispatch({ type: 'UPDATE_SETTINGS', settings: { bezelColor: c.value } }); setShowBezelPicker(false); }}
                className="flex items-center gap-2 w-full px-2 py-1 rounded-lg hover:bg-slate-800 text-white text-[10px] whitespace-nowrap"
              >
                <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: c.value }} />
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Screen */}
        <div className="relative flex-1 m-[6px] rounded-[40px] overflow-hidden" style={{ background: '#000' }}>
          {!screenOn ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer"
              style={{ background: 'linear-gradient(160deg, #080818 0%, #0f0f24 50%, #080814 100%)' }}
              onClick={() => setScreenOn(true)}
            >
              <div className="text-white/15 text-4xl mb-1">🔒</div>
              <div className="text-white text-5xl font-thin tracking-tight">{timeStr}</div>
              <div className="text-white/40 text-sm">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className="mt-6 text-white/25 text-xs animate-pulse">Swipe up to unlock</div>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(99,102,241,0.08) 0%, transparent 60%)' }} />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              {/* Status bar */}
              <div className="flex items-center justify-between px-5 shrink-0" style={{ paddingTop: 14, paddingBottom: 6 }}>
                <span className="text-white text-[11px] font-semibold">{timeStr}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-[9px] font-bold opacity-80">5G</span>
                  <div className="flex items-end gap-[2px]">
                    {[3, 5, 7, 9].map((h, i) => (
                      <div key={i} style={{ width: 2.5, height: h, background: i < 3 ? 'white' : 'rgba(255,255,255,0.3)', borderRadius: 1, opacity: 0.85 }} />
                    ))}
                  </div>
                  {/* WiFi */}
                  <svg width="13" height="10" viewBox="0 0 13 10">
                    <path d="M6.5 8 L6.5 8" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
                    <path d="M4 6.5 Q6.5 4.5 9 6.5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.75" />
                    <path d="M1.5 4.5 Q6.5 0.5 11.5 4.5" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
                  </svg>
                  {/* Battery */}
                  <div className="flex items-center gap-0.5">
                    <div className="relative" style={{ width: 20, height: 10, border: '1px solid rgba(255,255,255,0.6)', borderRadius: 2 }}>
                      <div style={{ position: 'absolute', left: 1, top: 1, bottom: 1, width: `${batteryLevel * 0.16}px`, background: batteryColor, borderRadius: 1, transition: 'width 0.5s, background 0.5s' }} />
                      {settings.charging && <span className="absolute inset-0 flex items-center justify-center text-white text-[7px] font-bold">⚡</span>}
                    </div>
                    <div style={{ width: 2, height: 5, background: 'rgba(255,255,255,0.5)', borderRadius: '0 1px 1px 0' }} />
                  </div>
                </div>
              </div>

              {/* Punch-hole camera */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10">
                <div className="w-3 h-3 rounded-full bg-black border border-slate-800/50" />
              </div>

              {/* Volume HUD */}
              {showVolumeHUD && (
                <div className="absolute top-12 right-3 z-50 bg-slate-900/95 backdrop-blur rounded-2xl px-3 py-2 shadow-2xl border border-slate-700 min-w-[100px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-white text-[10px]">🔊</span>
                    <span className="text-white text-[10px] font-medium">Volume</span>
                    <span className="text-slate-400 text-[10px] ml-auto">{volumeLevel}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${volumeLevel}%` }} />
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {children}
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav bar hint */}
        {screenOn && settings.navMode === 'buttons' && (
          <div
            className="absolute bottom-[10px] left-[6px] right-[6px] rounded-b-[38px] flex items-center justify-around px-6"
            style={{ height: 18, background: 'rgba(0,0,0,0.3)' }}
          >
            {['◄', '●', '■'].map((btn, i) => (
              <button key={i} className="text-white/30 text-[10px] hover:text-white/60 transition-colors">{btn}</button>
            ))}
          </div>
        )}
        {screenOn && settings.navMode === 'gesture' && (
          <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2" style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
        )}
      </div>
    </div>
  );
}
