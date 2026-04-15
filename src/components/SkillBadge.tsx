import { SkillLevel } from '../types';
import { useLang } from '../contexts/LanguageContext';

const styles: Record<SkillLevel, string> = {
  beginner:     'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced:     'bg-orange-100 text-orange-700',
  mixed:        'bg-purple-100 text-purple-700',
};

interface Props {
  level: SkillLevel;
  size?: 'sm' | 'md';
}

export default function SkillBadge({ level, size = 'md' }: Props) {
  const { t } = useLang();
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span className={`inline-block rounded-full font-medium ${sizeClass} ${styles[level]}`}>
      {t.skillLevel[level]}
    </span>
  );
}
