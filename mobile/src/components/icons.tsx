// Line icons of the Stitch screens (D49), drawn inline so the app needs no icon library.
const PATHS = {
  logo: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM12 12l8.5-5M12 12 3.5 7M12 12v9.5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  booth: 'M3 9l1.5-5h15L21 9M3 9h18M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8M10 20v-5h4v5',
  factory: 'M3 21V10l5 3V10l5 3V10l5 3V4h3v17zM7 17h2M11 17h2M15 17h2',
  review: 'M9 4h6v3H9zM9 5H6v16h12V5h-3M9 14l2 2 4-4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
  back: 'M15 5l-7 7 7 7',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// The app's mark: a cube in a blue square.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-blue-600 text-white" style={{ width: size, height: size }}>
      <Icon name="logo" size={size * 0.62} />
    </span>
  );
}
