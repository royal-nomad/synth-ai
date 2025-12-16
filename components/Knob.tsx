import React, { useState, useEffect, useRef, useCallback } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  size?: number;
  color?: string;
}

export const Knob: React.FC<KnobProps> = ({ 
  label, 
  value, 
  min, 
  max, 
  onChange, 
  size = 64, 
  color = "#06b6d4" // cyan-500
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);
  const knobRef = useRef<HTMLDivElement>(null);

  // Calculate rotation angle based on value
  // Map value (min-max) to angle (-135deg to 135deg)
  const percent = (value - min) / (max - min);
  const angle = -135 + (percent * 270);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = 200; // pixels to full range
    
    let newValue = startValue.current + (deltaY / sensitivity) * range;
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  }, [isDragging, max, min, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col items-center gap-2 select-none group">
      <div 
        ref={knobRef}
        onMouseDown={handleMouseDown}
        className="relative rounded-full bg-zinc-800 border-2 border-zinc-700 shadow-lg cursor-ns-resize hover:border-zinc-500 transition-colors"
        style={{ width: size, height: size }}
      >
        {/* Indicator Dot/Line */}
        <div 
          className="absolute w-1 h-1/2 left-1/2 -ml-0.5 origin-bottom bg-zinc-600 rounded-sm pointer-events-none"
          style={{ 
            transform: `rotate(${angle}deg)`,
            backgroundColor: isDragging ? color : undefined
          }}
        >
          <div 
            className="w-2 h-2 rounded-full absolute top-1 -left-0.5 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ backgroundColor: color }}
          />
        </div>
        
        {/* Inner shadow/gradient for depth */}
        <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] pointer-events-none"></div>
      </div>
      
      <div className="text-center">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-200">{label}</div>
        <div className="text-[10px] text-cyan-500 font-mono mt-0.5">
          {value.toFixed(2)}
        </div>
      </div>
    </div>
  );
};
