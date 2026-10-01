import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePlatformReadiness } from '../context/PlatformReadinessContext';

interface ReadinessBadgeProps {
  mode?: 'direct' | 'wifi';
  onClick?: () => void;
  className?: string;
}

export const ReadinessBadge: React.FC<ReadinessBadgeProps> = ({
  mode,
  onClick,
  className = '',
}) => {
  const { checkModeReadiness, openReadinessScreen } = usePlatformReadiness();

  const readinessResult = mode ? checkModeReadiness(mode) : null;
  const isReady = readinessResult ? readinessResult.ready : true;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      openReadinessScreen();
    }
  };

  if (isReady) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-medium text-[#F5F5F5] transition-colors cursor-pointer ${className}`}
        title="All platform permissions ready • Click to review"
      >
        <CheckCircle2 className="w-3 h-3 text-white" />
        <span>Ready</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-[11px] font-semibold text-white transition-colors cursor-pointer shadow-sm ${className}`}
      title="Platform setup required • Click to configure"
    >
      <AlertCircle className="w-3 h-3 text-white animate-pulse" />
      <span>Setup required</span>
    </button>
  );
};
