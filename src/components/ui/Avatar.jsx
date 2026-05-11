export default function Avatar({ profile, size = 9, className = '' }) {
  const sizeClass = `w-${size} h-${size}`;
  const letter = profile?.username?.[0]?.toUpperCase() || '?';
  const textSize = size <= 8 ? 'text-xs' : size <= 12 ? 'text-sm' : 'text-xl';

  return (
    <div className={`${sizeClass} rounded-full bg-dark-400 border border-dark-300 flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={letter} className="w-full h-full object-cover" />
      ) : (
        <span className={`${textSize} font-mono text-gray-300`}>{letter}</span>
      )}
    </div>
  );
}
