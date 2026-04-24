import type { ButtonHTMLAttributes } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

type BackButtonProps = {
  label?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function BackButton({ label, className = '', type = 'button', ...props }: BackButtonProps) {
  const { lang, isRTL } = useLang();
  const Icon = isRTL ? ArrowRight : ArrowLeft;
  const resolvedLabel = label ?? (lang === 'he' ? 'חזור' : 'Back');

  return (
    <button
      type={type}
      className={`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 ${className}`.trim()}
      {...props}
    >
      <Icon size={16} />
      <span>{resolvedLabel}</span>
    </button>
  );
}
