'use client';

import { useState, useRef, useCallback } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HalfStarPickerProps {
  value: number;
  onChange?: (val: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  size?: number;
}

export function HalfStarPicker({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  size = 20,
}: HalfStarPickerProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayValue = hoverValue ?? value;
  const interactive = !disabled && !readOnly && !!onChange;

  const handleClick = useCallback(
    (starIndex: number, isLeftHalf: boolean) => {
      if (!interactive) return;
      const val = isLeftHalf ? starIndex - 0.5 : starIndex;
      onChange!(val);
    },
    [interactive, onChange],
  );

  const handleMouseMove = useCallback(
    (starIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      setHoverValue(isLeftHalf ? starIndex - 0.5 : starIndex);
    },
    [interactive],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'inline-flex items-center gap-0.5',
        disabled && 'opacity-50 pointer-events-none',
      )}
      onMouseLeave={() => setHoverValue(null)}
      role="group"
      aria-label={`Rating: ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fill = displayValue >= starIndex
          ? 'full'
          : displayValue >= starIndex - 0.5
            ? 'half'
            : 'empty';

        return (
          <div
            key={starIndex}
            className={cn('relative', interactive && 'cursor-pointer')}
            style={{ width: size, height: size }}
            onMouseMove={(e) => handleMouseMove(starIndex, e)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const isLeftHalf = e.clientX - rect.left < rect.width / 2;
              handleClick(starIndex, isLeftHalf);
            }}
          >
            {/* Empty star (background) */}
            <Star
              className="absolute inset-0 text-muted-foreground/30"
              style={{ width: size, height: size }}
            />
            {/* Filled star — full or half via clipPath */}
            {fill !== 'empty' && (
              <Star
                className="absolute inset-0 text-yellow-400 fill-yellow-400"
                style={{
                  width: size,
                  height: size,
                  clipPath: fill === 'half' ? 'inset(0 50% 0 0)' : undefined,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
