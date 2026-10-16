// The app's mark from the Stitch screens: a cube in a blue square (D49).
export default function Logo({ size = 30, className = 'app-logo' }) {
  return (
    <span className={className} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
        <path d="M12 12 20.5 7M12 12 3.5 7M12 12v9.5" />
      </svg>
    </span>
  );
}
