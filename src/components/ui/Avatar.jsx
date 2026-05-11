export default function Avatar({ profile, size = 36, className = '' }) {
  const letter = profile?.username?.[0]?.toUpperCase() || '?';
  const fontSize = size <= 28 ? 11 : size <= 36 ? 13 : size <= 48 ? 15 : 22;

  return (
    <div
      className={`rounded-full bg-dark-400 border border-dark-300 flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={letter}
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
