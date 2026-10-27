import {
  ArrowClockwise,
  ArrowSquareOut,
  ArrowUpRight,
  BookOpen,
  Books,
  CaretDown,
  CaretRight,
  CaretUp,
  ChartLineUp,
  Check,
  CheckCircle,
  Copy,
  DownloadSimple,
  FileCode,
  GithubLogo,
  Info,
  Lightning,
  ListChecks,
  MagnifyingGlass,
  Monitor,
  Moon,
  Play,
  PlusCircle,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Terminal,
  TrendUp,
  Warning,
  WarningCircle,
  X,
  XCircle,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react';

/** Every icon the app uses, by a stable name. Add new ones here, not inline. */
const ICONS = {
  'arrow-up-right': ArrowUpRight,
  'book': BookOpen,
  'books': Books,
  'caret-down': CaretDown,
  'caret-right': CaretRight,
  'caret-up': CaretUp,
  'chart': ChartLineUp,
  'check': Check,
  'check-circle': CheckCircle,
  'copy': Copy,
  'download': DownloadSimple,
  'external': ArrowSquareOut,
  'file': FileCode,
  'github': GithubLogo,
  'info': Info,
  'lightning': Lightning,
  'list-checks': ListChecks,
  'monitor': Monitor,
  'moon': Moon,
  'play': Play,
  'plus-circle': PlusCircle,
  'refresh': ArrowClockwise,
  'search': MagnifyingGlass,
  'shield': ShieldCheck,
  'sliders': SlidersHorizontal,
  'sun': Sun,
  'terminal': Terminal,
  'trend-up': TrendUp,
  'warning': Warning,
  'warning-circle': WarningCircle,
  'x': X,
  'x-circle': XCircle,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  weight?: IconWeight;
  className?: string;
  /** Accessible label. Omit for decorative icons (the default). */
  label?: string;
}

export function Icon({ name, size = 16, weight = 'regular', className, label }: IconProps) {
  const Component = ICONS[name];
  return (
    <Component
      size={size}
      weight={weight}
      className={`shrink-0 ${className ?? ''}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}
