import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Volume2, Wifi, Battery, BatteryCharging } from 'lucide-react';

interface S23UltraFrameProps {
  children: React.ReactNode;
}

export const BEZEL_COLORS = [
  { name: 'Phantom Black', value: '#1C1C1E', border: 'border-[#2c2c2e]' },
  { name: 'Cream White', value: '#F5F5F0', border: 'border-[#e5e5e0]' },
  { name: 'Green Forest', value: '#2C3E35', border: 'border-[#3a4f45]' },
  { name: 'Lavender Blush', value: '#E3DFF2', border: 'border-[#d0cbdc]' },
];

export const S23UltraFrame: React.FC<S23UltraFrameProps> = ({ children }) => {
  const { state, actions } = useDatabase();
  const { settings } = state;
  const [scale, setScale] = useState(1);
  const [showVolumeHUD, setShowVolumeHUD] = useState(false);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Time state
  const [timeStr, setTimeStr] = useState('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle responsive scaling
  useEffect(() => {
    const handleResize = () => {
      const frameWidth = 410; // Width of the frame in px
      const frameHeight = 880; // Height of the frame in px
      const padding = 24;

      const availableWidth = window.innerWidth - padding;
      const availableHeight = window.innerHeight - padding;

      const widthScale = availableWidth / frameWidth;
      const heightScale = availableHeight / frameHeight;

      // Fit inside the viewport
      const newScale = Math.min(widthScale, heightScale, 1.2); // Don't scale up too much
      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Charging simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (settings.charging && settings.screenOn) {
      interval = setInterval(() => {
        if (settings.batteryLevel < 100) {
          actions.updateSettings({ batteryLevel: Math.min(100, settings.batteryLevel + 1) });
        }
      }, 5000); // Increment every 5 seconds when charging
    }
    return () => clearInterval(interval);
  }, [settings.charging, settings.batteryLevel, settings.screenOn, actions]);

  // Volume HUD helper
  const adjustVolume = (direction: 'up' | 'down') => {
    if (!settings.screenOn) return;

    const delta = direction === 'up' ? 10 : -10;
    const newVolume = Math.max(0, Math.min(100, settings.volume + delta));
    actions.updateSettings({ volume: newVolume });

    setShowVolumeHUD(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      setShowVolumeHUD(false);
    }, 2000);
  };

  // Toggle power / screen on/off
  const togglePower = () => {
    const nextScreenOn = !settings.screenOn;
    actions.updateSettings({ screenOn: nextScreenOn });

    if (!nextScreenOn) {
      // Dispatch a simulated Android lifecycle pause event
      // This will be caught by Camera, Graph, and Audio components to clean up immediately!
      const event = new CustomEvent('voyager-screen-off');
      window.dispatchEvent(event);
    }
  };

  // Get active bezel border color
  const activeBezel = BEZEL_COLORS.find(c => c.value === settings.bezelColor) || BEZEL_COLORS[0];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-2 overflow-hidden select-none">
      {/* Scaling Container */}
      <div
        className="relative transition-transform duration-300 ease-out"
        style={{
          width: '400px',
          height: '860px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Hardware Volume Buttons (Left Side) */}
        <div className="absolute left-[-4px] top-[180px] flex flex-col gap-4 z-10">
          {/* Volume Up */}
          <button
            onClick={() => adjustVolume('up')}
            className="w-[4px] h-[50px] bg-neutral-700 hover:bg-neutral-600 rounded-l-md active:scale-95 transition-all outline-none cursor-pointer"
            aria-label="Volume Up"
          />
          {/* Volume Down */}
          <button
            onClick={() => adjustVolume('down')}
            className="w-[4px] h-[50px] bg-neutral-700 hover:bg-neutral-600 rounded-l-md active:scale-95 transition-all outline-none cursor-pointer"
            aria-label="Volume Down"
          />
        </div>

        {/* Hardware Power Button (Right Side) */}
        <div className="absolute right-[-4px] top-[260px] z-10">
          <button
            onClick={togglePower}
            className="w-[4px] h-[65px] bg-neutral-700 hover:bg-neutral-600 rounded-r-md active:scale-95 transition-all outline-none cursor-pointer"
            aria-label="Power Button"
          />
        </div>

        {/* S-Pen Stylus Slot (Simulated bottom right corner button) */}
        <div className="absolute right-[45px] bottom-[-6px] z-20">
          <button
            onClick={() => actions.updateSettings({ sPenActive: !settings.sPenActive })}
            className={`w-[25px] h-[10px] rounded-b-md border-t border-neutral-800 transition-all cursor-pointer ${
              settings.sPenActive
                ? 'bg-neutral-600 translate-y-[2px]'
                : 'bg-[#C5A98E] hover:bg-[#b89c81] shadow-[0_2px_4px_rgba(0,0,0,0.4)]'
            }`}
            title="S-Pen Stylus"
          />
        </div>

        {/* Outer Phone Bezel Frame */}
        <div
          className={`w-full h-full rounded-[48px] border-[12px] bg-black shadow-2xl relative flex flex-col overflow-hidden transition-colors duration-500 ${activeBezel.border}`}
          style={{ borderColor: settings.bezelColor }}
        >
          {/* Punch-hole Camera */}
          <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-4.5 h-4.5 rounded-full bg-black border border-neutral-800 flex items-center justify-center z-50">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-950/40"></div>
          </div>

          {/* Screen Container */}
          <div className="w-full h-full relative flex flex-col bg-neutral-900 overflow-hidden">
            
            {/* Screen Off Black Overlay */}
            {!settings.screenOn && (
              <div 
                onClick={togglePower}
                className="absolute inset-0 bg-black z-[100] flex flex-col items-center justify-center cursor-pointer transition-all duration-500"
              >
                <div className="animate-pulse flex flex-col items-center text-neutral-600 gap-2">
                  <div className="w-12 h-12 rounded-full border border-neutral-700 flex items-center justify-center">
                    <span className="text-sm font-semibold">S23</span>
                  </div>
                  <span className="text-xs tracking-widest text-neutral-500">SCREEN OFF</span>
                  <span className="text-[10px] text-neutral-600">Tap Screen or Power Button to wake</span>
                </div>
              </div>
            )}

            {/* Volume HUD Overlay */}
            {showVolumeHUD && (
              <div className="absolute left-4 top-1/3 z-[90] w-6 bg-neutral-900/95 border border-neutral-800 py-4 px-1 rounded-full shadow-lg flex flex-col items-center gap-2 transition-opacity duration-300 animate-in fade-in">
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                <div className="w-1.5 h-24 bg-neutral-800 rounded-full relative overflow-hidden flex flex-col justify-end">
                  <div
                    className="w-full bg-blue-500 rounded-full transition-all duration-150"
                    style={{ height: `${settings.volume}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-neutral-400">{settings.volume}</span>
              </div>
            )}

            {/* Simulated Android Status Bar */}
            <div className="h-[32px] bg-neutral-950 text-white flex items-center justify-between px-6 z-40 select-none border-b border-neutral-900/30 text-xs font-medium">
              <span>{timeStr}</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-neutral-200" />
                <span className="text-[9px] font-bold tracking-tighter text-neutral-300">5G</span>
                <div className="flex items-center gap-0.5">
                  {settings.charging ? (
                    <BatteryCharging className="w-4 h-4 text-emerald-400 animate-pulse" />
                  ) : (
                    <Battery className={`w-4 h-4 ${settings.batteryLevel < 20 ? 'text-red-500' : 'text-neutral-200'}`} />
                  )}
                  <span className="text-[9px] font-mono">{settings.batteryLevel}%</span>
                </div>
              </div>
            </div>

            {/* Main Application Content Area */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              {children}
            </div>

            {/* Simulated Android Navigation Bar */}
            <div className="h-[36px] bg-neutral-950 border-t border-neutral-900/50 flex items-center justify-center px-8 z-40">
              {settings.navMode === 'buttons' ? (
                <div className="w-full flex items-center justify-between text-neutral-400">
                  {/* Recents Button */}
                  <button 
                    onClick={() => actions.setActiveView('settings')}
                    className="p-1 hover:text-white active:scale-90 transition-all outline-none cursor-pointer text-sm font-semibold tracking-widest"
                    title="Settings"
                  >
                    |||
                  </button>
                  {/* Home Button */}
                  <button
                    onClick={() => {
                      actions.setActiveView('editor');
                      // Find today's journal
                      const todayId = `journal-${new Date().toISOString().split('T')[0]}`;
                      if (state.pages[todayId]) {
                        actions.navigateToPage(todayId);
                      } else {
                        const firstPage = Object.keys(state.pages)[0];
                        if (firstPage) actions.navigateToPage(firstPage);
                      }
                    }}
                    className="w-4.5 h-4.5 rounded-sm border-2 border-neutral-400 hover:border-white active:scale-90 transition-all outline-none cursor-pointer"
                    title="Home"
                  />
                  {/* Back Button */}
                  <button
                    onClick={() => {
                      // Navigate back to editor or close sidebar
                      if (state.sidebarPageId) {
                        actions.closeSidebar();
                      } else if (state.activeView !== 'editor') {
                        actions.setActiveView('editor');
                      }
                    }}
                    className="p-1 hover:text-white active:scale-90 transition-all outline-none cursor-pointer"
                    title="Back"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </button>
                </div>
              ) : (
                /* Gesture Bar Mode */
                <div className="w-32 h-1 bg-neutral-600 rounded-full hover:bg-neutral-400 transition-all active:scale-y-150 cursor-pointer" 
                  onClick={() => actions.setActiveView('editor')}
                  title="Swipe up for Home"
                />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
