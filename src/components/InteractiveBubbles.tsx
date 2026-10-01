import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

import { useSettings } from '../context/SettingsContext';

export interface SafeZone {
  key: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const SAFE_ZONES: SafeZone[] = [
  { key: 'top-left', minX: 7, maxX: 16, minY: 14, maxY: 26 },
  { key: 'top-right', minX: 82, maxX: 91, minY: 14, maxY: 26 },
  { key: 'mid-left', minX: 5, maxX: 14, minY: 44, maxY: 60 },
  { key: 'mid-right', minX: 84, maxX: 93, minY: 42, maxY: 58 },
  { key: 'bottom-left', minX: 8, maxX: 18, minY: 72, maxY: 84 },
  { key: 'bottom-right', minX: 80, maxX: 90, minY: 72, maxY: 84 },
];

export interface BubbleParticle {
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

export interface BubbleState {
  id: string;
  zoneKey: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  floatAnimation: 'animate-droplet-1' | 'animate-droplet-2' | 'animate-droplet-3';
  isPopping: boolean;
  isSpawning: boolean;
  particles?: BubbleParticle[];
}

const INITIAL_BUBBLES: BubbleState[] = [
  {
    id: 'bubble-1',
    zoneKey: 'top-left',
    xPercent: 10,
    yPercent: 18,
    sizePx: 72,
    floatAnimation: 'animate-droplet-1',
    isPopping: false,
    isSpawning: false,
  },
  {
    id: 'bubble-2',
    zoneKey: 'top-right',
    xPercent: 86,
    yPercent: 20,
    sizePx: 56,
    floatAnimation: 'animate-droplet-2',
    isPopping: false,
    isSpawning: false,
  },
  {
    id: 'bubble-3',
    zoneKey: 'bottom-left',
    xPercent: 12,
    yPercent: 78,
    sizePx: 64,
    floatAnimation: 'animate-droplet-3',
    isPopping: false,
    isSpawning: false,
  },
  {
    id: 'bubble-4',
    zoneKey: 'bottom-right',
    xPercent: 84,
    yPercent: 76,
    sizePx: 68,
    floatAnimation: 'animate-droplet-1',
    isPopping: false,
    isSpawning: false,
  },
];

export const InteractiveBubbles: React.FC = () => {
  const { settings } = useSettings();
  const [bubbles, setBubbles] = useState<BubbleState[]>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return INITIAL_BUBBLES.slice(0, 3);
    }
    return INITIAL_BUBBLES;
  });
  const timeoutsRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  const [isSystemReducedMotion, setIsSystemReducedMotion] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const isReducedMotion = isSystemReducedMotion || settings.reducedMotion;

  // Listen to prefers-reduced-motion changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setIsSystemReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Mouse parallax springs
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 45, stiffness: 60 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    if (isReducedMotion) return;
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 24;
      const y = (e.clientY / innerHeight - 0.5) * 24;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY, isReducedMotion]);

  // Clean up all timers on unmount
  useEffect(() => {
    const activeTimeouts = timeoutsRef.current;
    return () => {
      Object.values(activeTimeouts).forEach(clearTimeout);
    };
  }, []);

  // Helper to generate a random position in a zone
  const getPositionInZone = (zone: SafeZone) => {
    const x = zone.minX + Math.random() * (zone.maxX - zone.minX);
    const y = zone.minY + Math.random() * (zone.maxY - zone.minY);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  // Find an unoccupied or best safe zone for respawning
  const chooseNewSafeZone = (currentZoneKey: string, occupiedZones: string[]): SafeZone => {
    const availableZones = SAFE_ZONES.filter(
      (z) => z.key !== currentZoneKey && !occupiedZones.includes(z.key)
    );

    if (availableZones.length > 0) {
      const chosen = availableZones[Math.floor(Math.random() * availableZones.length)];
      return chosen;
    }

    // Fallback if all other zones are somehow filled: choose any zone different from current
    const differentZones = SAFE_ZONES.filter((z) => z.key !== currentZoneKey);
    return differentZones[Math.floor(Math.random() * differentZones.length)] || SAFE_ZONES[0];
  };

  // Handle individual bubble popping directly in bubble-local coordinate system
  const handlePopBubble = useCallback((bubbleId: string) => {
    setBubbles((prevBubbles) => {
      const target = prevBubbles.find((b) => b.id === bubbleId);
      if (!target || target.isPopping) return prevBubbles;

      // 1. Generate local glass micro-particles bursting from bubble center (50% 50%)
      const particleCount = 6 + Math.floor(Math.random() * 3); // 6 to 8 particles
      const particles: BubbleParticle[] = Array.from({ length: particleCount }).map((_, idx) => {
        const baseAngle = (idx / particleCount) * Math.PI * 2;
        const angle = baseAngle + (Math.random() - 0.5) * 0.4;
        const distance = 16 + Math.random() * 26; // 16 to 42px outward travel
        const size = 3 + Math.random() * 3;
        const delay = Math.random() * 0.04;
        return { angle, distance, size, delay };
      });

      // 2. Mark this bubble as popping immediately with its own local particles
      const updated = prevBubbles.map((b) =>
        b.id === bubbleId ? { ...b, isPopping: true, particles } : b
      );

      // 3. Set independent 500ms respawn timer for this bubble
      if (timeoutsRef.current[bubbleId]) {
        clearTimeout(timeoutsRef.current[bubbleId]);
      }

      timeoutsRef.current[bubbleId] = setTimeout(() => {
        setBubbles((latestBubbles) => {
          const currentOccupied = latestBubbles
            .filter((b) => b.id !== bubbleId && !b.isPopping)
            .map((b) => b.zoneKey);

          const currentTarget = latestBubbles.find((b) => b.id === bubbleId);
          const oldZone = currentTarget ? currentTarget.zoneKey : 'top-left';
          const newZone = chooseNewSafeZone(oldZone, currentOccupied);
          const newPos = getPositionInZone(newZone);

          // Variable random size (56px to 80px)
          const newSizes = [56, 62, 68, 74, 80];
          const newSize = newSizes[Math.floor(Math.random() * newSizes.length)];
          const floatAnims: ('animate-droplet-1' | 'animate-droplet-2' | 'animate-droplet-3')[] = [
            'animate-droplet-1',
            'animate-droplet-2',
            'animate-droplet-3',
          ];
          const newAnim = floatAnims[Math.floor(Math.random() * floatAnims.length)];

          return latestBubbles.map((b) =>
            b.id === bubbleId
              ? {
                  ...b,
                  zoneKey: newZone.key,
                  xPercent: newPos.x,
                  yPercent: newPos.y,
                  sizePx: newSize,
                  floatAnimation: newAnim,
                  isPopping: false,
                  isSpawning: true,
                  particles: undefined,
                }
              : b
          );
        });

        // Clear isSpawning flag after entrance animation finishes (600ms)
        setTimeout(() => {
          setBubbles((latest) =>
            latest.map((b) => (b.id === bubbleId ? { ...b, isSpawning: false } : b))
          );
        }, 600);
      }, 500);

      return updated;
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="bubble-wrapper absolute pointer-events-auto"
          style={{
            left: `${bubble.xPercent}%`,
            top: `${bubble.yPercent}%`,
            width: `${bubble.sizePx}px`,
            height: `${bubble.sizePx}px`,
            transform: 'translate(-50%, -50%)',
            transformOrigin: '50% 50%',
          }}
        >
          {/* Float & Parallax Layer */}
          <motion.div
            style={{
              x: isReducedMotion ? 0 : smoothX,
              y: isReducedMotion ? 0 : smoothY,
              transformOrigin: '50% 50%',
            }}
            className={`w-full h-full relative ${
              !bubble.isPopping && !isReducedMotion ? bubble.floatAnimation : ''
            }`}
          >
            {/* ACTIVE BUBBLE SURFACE */}
            {!bubble.isPopping && (
              <motion.div
                initial={
                  bubble.isSpawning
                    ? { opacity: 0, scale: 0.6, filter: 'blur(4px)' }
                    : false
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  filter: 'blur(0px)',
                }}
                whileHover={
                  !isReducedMotion
                    ? { scale: 1.08, filter: 'brightness(1.2)' }
                    : { opacity: 0.9 }
                }
                whileTap={!isReducedMotion ? { scale: 0.92 } : undefined}
                transition={{
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() => handlePopBubble(bubble.id)}
                className="bubble-surface absolute inset-0 rounded-full smoked-droplet cursor-pointer select-none group transition-all duration-300"
                style={{
                  transformOrigin: '50% 50%',
                }}
                title="Pop bubble"
              >
                {/* Internal Refractive Light Arc */}
                <div className="absolute top-2 left-2.5 w-4 h-2 rounded-full bg-white/25 blur-[1px] rotate-[-25deg] group-hover:bg-white/40 transition-colors pointer-events-none" />

                {/* Subtle Bottom Rim Light */}
                <div className="absolute bottom-2 right-2.5 w-2.5 h-1.5 rounded-full bg-white/10 blur-[1px] pointer-events-none" />

                {/* Ultra-subtle hover glow ring */}
                <div className="absolute inset-0 rounded-full border border-white/0 group-hover:border-white/20 transition-all duration-300 pointer-events-none" />
              </motion.div>
            )}

            {/* POPPING SEQUENCE & EFFECT LAYER */}
            {bubble.isPopping && (
              <div
                className="bubble-pop-effect absolute inset-0 pointer-events-none"
                style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'visible',
                  transformOrigin: '50% 50%',
                }}
              >
                {/* PHASE 1 & 2: Glass Surface Compression (0.82) -> Surface Pop (1.15) -> Dissolve */}
                <motion.div
                  initial={{ scale: 1, opacity: 0.9 }}
                  animate={
                    isReducedMotion
                      ? { opacity: [0.9, 0], scale: 1 }
                      : {
                          scale: [1, 0.82, 1.15, 1.22],
                          opacity: [0.9, 1, 0.45, 0],
                          filter: [
                            'blur(0px)',
                            'blur(0.5px)',
                            'blur(3px)',
                            'blur(8px)',
                          ],
                        }
                  }
                  transition={{
                    duration: isReducedMotion ? 0.22 : 0.38,
                    times: isReducedMotion ? undefined : [0, 0.32, 0.72, 1],
                    ease: 'easeOut',
                  }}
                  className="absolute inset-0 rounded-full smoked-droplet"
                  style={{
                    transformOrigin: '50% 50%',
                  }}
                >
                  {/* Internal highlight that compresses & intensifies then dissipates */}
                  <motion.div
                    animate={
                      isReducedMotion
                        ? { opacity: 0 }
                        : {
                            scale: [1, 0.75, 1.3],
                            opacity: [0.35, 0.7, 0],
                          }
                    }
                    transition={{ duration: 0.32, ease: 'easeOut' }}
                    className="absolute top-2 left-2.5 w-4 h-2 rounded-full bg-white/45 blur-[1px] rotate-[-25deg]"
                    style={{ transformOrigin: '50% 50%' }}
                  />
                  {/* Subtle rim highlight during compression */}
                  <motion.div
                    animate={
                      isReducedMotion
                        ? { opacity: 0 }
                        : {
                            opacity: [0.2, 0.6, 0],
                          }
                    }
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border border-white/30"
                    style={{ transformOrigin: '50% 50%' }}
                  />
                </motion.div>

                {/* PHASE 3: Circular Glass Ripple Centered at 50% 50% */}
                <motion.div
                  initial={{ scale: 0.2, opacity: 0.35 }}
                  animate={
                    isReducedMotion
                      ? { opacity: 0 }
                      : { scale: 1.8, opacity: 0 }
                  }
                  transition={{
                    duration: isReducedMotion ? 0.2 : 0.65,
                    ease: 'easeOut',
                  }}
                  className="absolute inset-0 rounded-full border border-white/35"
                  style={{
                    transformOrigin: '50% 50%',
                    background:
                      'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 50%, transparent 70%)',
                  }}
                />

                {/* PARTICLES: Outward Glass Micro-Particles from Bubble Center (50% 50%) */}
                {!isReducedMotion &&
                  bubble.particles?.map((p, pIdx) => {
                    const targetX = Math.cos(p.angle) * p.distance;
                    const targetY = Math.sin(p.angle) * p.distance;

                    return (
                      <motion.div
                        key={`particle-${bubble.id}-${pIdx}`}
                        initial={{ x: 0, y: 0, opacity: 0.8, scale: 1 }}
                        animate={{
                          x: targetX,
                          y: targetY,
                          opacity: 0,
                          scale: 0.25,
                        }}
                        transition={{
                          duration: 0.55,
                          delay: p.delay,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="absolute rounded-full bg-white/70 blur-[0.5px]"
                        style={{
                          width: `${p.size}px`,
                          height: `${p.size}px`,
                          left: '50%',
                          top: '50%',
                          marginLeft: `-${p.size / 2}px`,
                          marginTop: `-${p.size / 2}px`,
                          transformOrigin: '50% 50%',
                        }}
                      />
                    );
                  })}
              </div>
            )}
          </motion.div>
        </div>
      ))}
    </div>
  );
};
