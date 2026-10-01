import React from 'react';
import { InteractiveBubbles } from './InteractiveBubbles';

export const LiquidBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden z-0 bg-[#08090B] pointer-events-none">
      {/* Deep dark backdrop with subtle radial light falloff */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_15%,rgba(255,255,255,0.025),rgba(8,9,11,0.98)_100%)] pointer-events-none" />

      {/* Very soft monochrome ambient light sheens behind central interface */}
      <div className="absolute top-[18%] left-[28%] w-[550px] h-[550px] rounded-full bg-white/[0.018] blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[22%] w-[480px] h-[480px] rounded-full bg-white/[0.012] blur-[150px] pointer-events-none" />

      {/* Interactive Liquid-Glass Bubbles System (Poppable & Respawning) */}
      <InteractiveBubbles />

      {/* Decorative 4-Point Glass Shine / Star in Lower-Right */}
      <div className="absolute bottom-[14%] right-[16%] md:right-[20%] pointer-events-none opacity-40 animate-shine">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
          <path
            d="M12 0L13.8 8.2L22 10L13.8 11.8L12 20L10.2 11.8L2 10L10.2 8.2L12 0Z"
            fill="currentColor"
            fillOpacity="0.8"
          />
        </svg>
      </div>

      {/* Micro Depth Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015] mix-blend-screen pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: '36px 36px'
        }}
      />
    </div>
  );
};
