export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="5" fill="rgb(var(--accent))" />
      <ellipse cx="16" cy="16" rx="12.5" ry="5" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.4" transform="rotate(-25 16 16)" />
      <circle cx="26.5" cy="11" r="2.1" fill="rgb(var(--mars))" />
    </svg>
  );
}
