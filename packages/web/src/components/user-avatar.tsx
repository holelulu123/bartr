'use client';

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Tiny coloured identicon — same algorithm as navbar, extracted here for reuse
function Identicon({ seed, size }: { seed: string; size: number }) {
  const cells = 5;
  const cellSize = size / cells;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const h = ((hash >>> 0) * 2654435761) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 150) % 360;
  const fg = `hsl(${hue1},65%,55%)`;
  const bg = `hsl(${hue2},30%,18%)`;
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      const col = c < Math.ceil(cells / 2) ? c : cells - 1 - c;
      return ((h >>> (r * Math.ceil(cells / 2) + col)) & 1) === 1;
    }),
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <rect width={size} height={size} fill={bg} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fg}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

interface UserAvatarProps {
  nickname: string;
  /** pixel size — used for both the container and the identicon fallback */
  size?: number;
  className?: string;
}

/**
 * Shows the user's uploaded avatar image.
 * Falls back to the deterministic identicon when no avatar is set or the image fails to load.
 */
export function UserAvatar({ nickname, size = 40, className }: UserAvatarProps) {
  const avatarUrl = `/api/users/${encodeURIComponent(nickname)}/avatar`;

  return (
    <Avatar
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <AvatarImage
        src={avatarUrl}
        alt={nickname}
      />
      <AvatarFallback className="p-0 overflow-hidden rounded-full">
        <Identicon seed={nickname} size={size} />
      </AvatarFallback>
    </Avatar>
  );
}
