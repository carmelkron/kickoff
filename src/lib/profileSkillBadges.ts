export type ProfileSkillBadgeStyle = {
  icon: string;
  chipClassName: string;
  countClassName: string;
};

type ProfileSkillBadgeTheme = Omit<ProfileSkillBadgeStyle, 'icon'> & {
  keywords: string[];
  icon: string;
};

const PROFILE_SKILL_BADGE_THEMES: ProfileSkillBadgeTheme[] = [
  {
    keywords: ['סיומת', 'finishing', 'scoring', 'goal', 'shoot', 'shot', 'חלוץ', 'כיבוש'],
    icon: '🥅',
    chipClassName: 'border-amber-200 bg-amber-50 text-amber-900',
    countClassName: 'bg-white/80 text-amber-700',
  },
  {
    keywords: ['פס', 'passing', 'assist', 'מסירה', 'playmaking', 'פליימייקינג'],
    icon: '🎯',
    chipClassName: 'border-sky-200 bg-sky-50 text-sky-900',
    countClassName: 'bg-white/80 text-sky-700',
  },
  {
    keywords: ['דריבל', 'dribble', '1v1', 'אחד על אחד', 'טריק', 'skill move'],
    icon: '🪄',
    chipClassName: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900',
    countClassName: 'bg-white/80 text-fuchsia-700',
  },
  {
    keywords: ['הגנה', 'defense', 'defending', 'tackle', 'טאקל', 'בלם', 'שומר'],
    icon: '🛡️',
    chipClassName: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    countClassName: 'bg-white/80 text-emerald-700',
  },
  {
    keywords: ['שוער', 'goalkeeper', 'keeper', 'goalkeeping', 'reflex', 'reflexes'],
    icon: '🧤',
    chipClassName: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    countClassName: 'bg-white/80 text-cyan-700',
  },
  {
    keywords: ['מהיר', 'speed', 'pace', 'sprint', 'מהירות', 'זריז'],
    icon: '⚡',
    chipClassName: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    countClassName: 'bg-white/80 text-yellow-700',
  },
  {
    keywords: ['כושר', 'stamina', 'fitness', 'endurance', 'אינטנסיבי'],
    icon: '🔋',
    chipClassName: 'border-lime-200 bg-lime-50 text-lime-900',
    countClassName: 'bg-white/80 text-lime-700',
  },
  {
    keywords: ['ראיית משחק', 'vision', 'iq', 'awareness', 'חכם', 'smart'],
    icon: '🧠',
    chipClassName: 'border-violet-200 bg-violet-50 text-violet-900',
    countClassName: 'bg-white/80 text-violet-700',
  },
  {
    keywords: ['מנהיג', 'leader', 'captain', 'leadership', 'אחראי'],
    icon: '👑',
    chipClassName: 'border-orange-200 bg-orange-50 text-orange-900',
    countClassName: 'bg-white/80 text-orange-700',
  },
  {
    keywords: ['קבוצה', 'team', 'teamwork', 'communication', 'תקשורת', 'פרגון'],
    icon: '🤝',
    chipClassName: 'border-rose-200 bg-rose-50 text-rose-900',
    countClassName: 'bg-white/80 text-rose-700',
  },
  {
    keywords: ['פיזי', 'physical', 'strength', 'חזק', 'אגרסיבי'],
    icon: '💪',
    chipClassName: 'border-stone-200 bg-stone-50 text-stone-900',
    countClassName: 'bg-white/80 text-stone-700',
  },
];

const DEFAULT_PROFILE_SKILL_BADGE_THEME: ProfileSkillBadgeStyle = {
  icon: '⭐',
  chipClassName: 'border-primary-200 bg-primary-50 text-primary-900',
  countClassName: 'bg-white/80 text-primary-700',
};

export function getProfileSkillBadgeStyle(label: string): ProfileSkillBadgeStyle {
  const normalizedLabel = label.trim().toLocaleLowerCase();
  const theme = PROFILE_SKILL_BADGE_THEMES.find(({ keywords }) =>
    keywords.some((keyword) => normalizedLabel.includes(keyword.toLocaleLowerCase())),
  );

  if (!theme) {
    return DEFAULT_PROFILE_SKILL_BADGE_THEME;
  }

  return {
    icon: theme.icon,
    chipClassName: theme.chipClassName,
    countClassName: theme.countClassName,
  };
}
