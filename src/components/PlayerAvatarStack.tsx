import { Player } from '../types';

interface Props {
  players: Player[];
  max?: number;
  size?: 'sm' | 'md';
}

export default function PlayerAvatarStack({ players, max = 4, size = 'sm' }: Props) {
  const visible = players.slice(0, max);
  const extra = players.length - max;
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  const offset = size === 'sm' ? '-me-2' : '-me-2.5';

  return (
    <div className="flex flex-row-reverse justify-end">
      {extra > 0 && (
        <div className={`${dim} rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-medium border-2 border-white z-0`}>
          +{extra}
        </div>
      )}
      {[...visible].reverse().map((p, i) => (
        <div
          key={p.id}
          className={`${dim} ${p.avatarColor} rounded-full flex items-center justify-center text-white font-semibold border-2 border-white ${offset}`}
          style={{ zIndex: i + 1 }}
          title={p.name}
        >
          {p.initials}
        </div>
      ))}
    </div>
  );
}
