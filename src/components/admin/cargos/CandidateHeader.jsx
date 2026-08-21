import { Link } from 'react-router-dom';
import { roleLabel } from '../../../lib/roleLabels';

/** Nome + cargo atual do candidato, com link para o perfil público. */
export default function CandidateHeader({ profile, extra }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Link to={`/u/${profile?.username}`}
        className="text-sm font-mono text-white font-bold hover:text-orange-400 transition-colors truncate">
        @{profile?.username}
      </Link>
      <span className="text-xs font-mono text-gray-600 shrink-0">{roleLabel(profile?.role)}</span>
      {extra}
    </div>
  );
}
