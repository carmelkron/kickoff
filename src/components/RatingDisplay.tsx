import { Star } from 'lucide-react';

interface Props {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
  label?: string;
}

function ratingColor(r: number) {
  if (r >= 7) return 'text-green-600';
  if (r >= 4) return 'text-amber-500';
  return 'text-red-500';
}

function ratingBg(r: number) {
  if (r >= 7) return 'bg-green-50 text-green-700';
  if (r >= 4) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-600';
}

export function RatingBadge({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeClass} ${ratingBg(rating)}`}>
      <Star size={size === 'sm' ? 10 : 12} fill="currentColor" />
      {rating.toFixed(1)}
    </span>
  );
}

export default function RatingDisplay({ rating, size = 'md', showNumber = true, label }: Props) {
  const iconSize = size === 'lg' ? 20 : size === 'md' ? 16 : 12;
  const textSize = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-base' : 'text-sm';
  const color = ratingColor(rating);

  return (
    <div className="flex items-center gap-1">
      <Star size={iconSize} className={`${color} fill-current`} />
      {showNumber && (
        <span className={`${textSize} font-bold ${color}`}>{rating.toFixed(1)}</span>
      )}
      {label && <span className="text-gray-400 text-sm">{label}</span>}
    </div>
  );
}
