export default function Avatar({ profile, size = 9, className = '' }) {
  const sizes = {
    7: 'w-7 h-7 min-w-[28px] min-h-[28px]',
    8: 'w-8 h-8 min-w-[32px] min-h-[32px]',
    9: 'w-9 h-9 min-w-[36px] min-h-[36px]',
    12: 'w-12 h-12 min-w-[48px] min-h-[48px]',
    16: 'w-16 h-16 min-w-[64px] min-h-[64px]',
  };
  const textSizes = {
    7: 'text-xs', 8: 'text-xs', 9: 'text-sm', 12: 'text-base', 16: 'text-2xl',
  };

  const sizeClass = sizes[size] || sizes[9];
  const textClass = textSizes[size] || textSizes[9];
  const letter = profile?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className={`${sizeClass} rounded-full bg-dark-400 border border-dark-300 flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={letter}
          className="w-full h-full object-cover"
          style={{ display: 'block' }}
        />
      ) : (
        <span className={`${textClass} font-mono text-gray-300 leading-none`}>{letter}</span>
      )}
    </div>
  );
}
