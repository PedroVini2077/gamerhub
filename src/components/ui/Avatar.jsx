// rankBorder: { color, glow, borderWidth } — quando passado, substitui a borda padrão
export default function Avatar({ profile, size = 36, className = '', rankBorder = null }) {
  const letter = profile?.username?.[0]?.toUpperCase() || '?';
  const fontSize = size <= 28 ? 11 : size <= 36 ? 13 : size <= 48 ? 15 : 22;
  const glowPx = rankBorder ? (size >= 80 ? 22 : size >= 48 ? 14 : 8) : 0;

  return (
    <div
      className={`rounded-full bg-dark-400 flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{
        width: size, height: size, minWidth: size, minHeight: size,
        border: rankBorder
          ? `${rankBorder.borderWidth ?? 2}px solid ${rankBorder.color}`
          : '1px solid #2e2e3e',
        boxShadow: rankBorder ? `0 0 ${glowPx}px ${rankBorder.glow}` : 'none',
        transition: 'box-shadow 0.3s',
      }}
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={letter}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ fontSize, lineHeight: 1 }} className="font-mono text-gray-300">
          {letter}
        </span>
      )}
    </div>
  );
}
