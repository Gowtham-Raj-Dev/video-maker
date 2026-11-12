/** The mark: a speech bubble with a voice in it — characters that talk. Same drawing as app/icon.svg. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none", display: "block" }}>
      <rect width="32" height="32" rx="8" fill="#16151A" />
      <path d="M11.5 7h9a5 5 0 0 1 5 5v4.5a5 5 0 0 1-5 5h-6.2l-4.8 3.8v-4.4A5 5 0 0 1 6.5 16.5V12a5 5 0 0 1 5-5z" fill="#FFFFFF" />
      <path d="M12.2 12.6v3.8M16 10.4v8.2M19.8 11.9v5.2" stroke="#FF5B24" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
