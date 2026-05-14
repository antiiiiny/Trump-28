import { type CSSProperties, useMemo } from 'react';
import * as Cards from '@letele/playing-cards';
import type { FC, SVGProps } from 'react';

interface PlayingCardViewProps {
  code: string;
  faceDown?: boolean;
  className?: string;
}

export function PlayingCardView({
  code,
  faceDown = false,
  className = '',
}: PlayingCardViewProps) {
  const CardComponent = useMemo(() => {
    const key = faceDown ? 'B2' : (() => {
      const suit = code.slice(-1);
      const rank = code.slice(0, -1);
      const rankKey = ['A', 'K', 'Q', 'J'].includes(rank)
        ? rank.toLowerCase()
        : rank;
      return `${suit}${rankKey}`;
    })();
    return (Cards as Record<string, FC<SVGProps<SVGSVGElement>>>)[key];
  }, [code, faceDown]);

  const cardStyle: CSSProperties = {
    display: 'inline-block',
    width: '100%',
    height: '100%',
  };

  if (!CardComponent) return null;

  return (
    <div className={className} style={cardStyle}>
      <CardComponent width="100%" height="100%" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}