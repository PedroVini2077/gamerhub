import { motion } from 'framer-motion';
import { listContainer, listItem } from '../../lib/motion';
import AvatarPopup from '../ui/AvatarPopup';

export default function LivesList({ lives, enterLive }) {
  if (lives.length === 0) return (
    <div className="card p-10 text-center">
      <div className="flex justify-center mb-5">
        <svg width="170" height="113" viewBox="0 0 180 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="55" cy="115" rx="40" ry="4.5" fill="#39ff14" fillOpacity="0.07"/>
          <ellipse cx="148" cy="113" rx="14" ry="3" fill="#39ff14" fillOpacity="0.04"/>
          <line x1="49" y1="94" x2="21" y2="115" stroke="#39ff14" strokeWidth="1.7" strokeLinecap="round"/>
          <line x1="57" y1="95" x2="57" y2="115" stroke="#39ff14" strokeWidth="1.7" strokeLinecap="round"/>
          <line x1="65" y1="94" x2="89" y2="115" stroke="#39ff14" strokeWidth="1.7" strokeLinecap="round"/>
          <rect x="42" y="89" width="30" height="7" rx="3" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.3"/>
          <rect x="16" y="48" width="78" height="44" rx="7" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.8"/>
          <circle cx="34" cy="36" r="13" fill="#09090f" stroke="#39ff14" strokeWidth="1.5"/>
          <circle cx="34" cy="36" r="8" fill="#0d0d14" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.28"/>
          <circle cx="34" cy="36" r="2.8" fill="#09090f" stroke="#39ff14" strokeWidth="1"/>
          <line x1="34" y1="28" x2="34" y2="33" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
          <line x1="34" y1="39" x2="34" y2="44" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
          <line x1="26" y1="36" x2="31" y2="36" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
          <line x1="37" y1="36" x2="42" y2="36" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.45"/>
          <circle cx="67" cy="32" r="17" fill="#09090f" stroke="#39ff14" strokeWidth="1.7"/>
          <circle cx="67" cy="32" r="11" fill="#0d0d14" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.28"/>
          <circle cx="67" cy="32" r="3.6" fill="#09090f" stroke="#39ff14" strokeWidth="1.2"/>
          <line x1="67" y1="21" x2="67" y2="28" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
          <line x1="67" y1="36" x2="67" y2="43" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
          <line x1="56" y1="32" x2="63" y2="32" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
          <line x1="71" y1="32" x2="78" y2="32" stroke="#39ff14" strokeWidth="1" strokeOpacity="0.45"/>
          <line x1="59" y1="23" x2="64" y2="28" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
          <line x1="70" y1="36" x2="75" y2="41" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
          <line x1="75" y1="23" x2="70" y2="28" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
          <line x1="59" y1="41" x2="64" y2="36" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.3"/>
          <circle cx="37" cy="68" r="17" fill="#09090f" stroke="#39ff14" strokeWidth="1.8"/>
          <circle cx="37" cy="68" r="12" fill="#0d0d14" stroke="#39ff14" strokeWidth="0.8" strokeOpacity="0.25"/>
          <circle cx="37" cy="68" r="6.5" fill="#07070d"/>
          <circle cx="34" cy="65" r="2" fill="#39ff14" fillOpacity="0.1"/>
          <rect x="66" y="50" width="16" height="11" rx="2" fill="#09090f" stroke="#39ff14" strokeWidth="1"/>
          <rect x="94" y="54" width="14" height="24" rx="2" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.3"/>
          <line x1="94" y1="61" x2="108" y2="61" stroke="#39ff14" strokeWidth="0.5" strokeOpacity="0.25"/>
          <line x1="94" y1="68" x2="108" y2="68" stroke="#39ff14" strokeWidth="0.5" strokeOpacity="0.25"/>
          <circle cx="74" cy="66" r="3.5" fill="#09090f" stroke="#39ff14" strokeWidth="0.9" strokeOpacity="0.4"/>
          <circle cx="74" cy="78" r="2.5" fill="#09090f" stroke="#39ff14" strokeWidth="0.8" strokeOpacity="0.3"/>
          <line x1="65" y1="74" x2="68" y2="74" stroke="#39ff14" strokeWidth="0.7" strokeOpacity="0.25"/>
          <ellipse cx="148" cy="78" rx="15" ry="16" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.4"/>
          <line x1="141" y1="93" x2="138" y2="107" stroke="#39ff14" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="155" y1="93" x2="158" y2="107" stroke="#39ff14" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M133 75 Q127 67 130 60" stroke="#39ff14" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          <path d="M163 75 Q169 67 166 60" stroke="#39ff14" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          <circle cx="130" cy="59" r="3" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.1"/>
          <circle cx="166" cy="59" r="3" fill="#0d0d14" stroke="#39ff14" strokeWidth="1.1"/>
          <ellipse cx="142" cy="75" rx="2.6" ry="3.1" fill="#39ff14"/>
          <ellipse cx="143" cy="74" rx="1.1" ry="1.1" fill="#09090f"/>
          <ellipse cx="154" cy="75" rx="2.6" ry="3.1" fill="#39ff14"/>
          <ellipse cx="153" cy="76" rx="1.1" ry="1.1" fill="#09090f"/>
          <path d="M139 70 Q142 68 145 69" stroke="#39ff14" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <path d="M141 84 Q144.5 82 148 84 Q151.5 86 155 84" stroke="#39ff14" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <text x="143" y="56" fontSize="15" fill="#39ff14" fillOpacity="0.9" fontFamily="monospace" fontWeight="bold">?</text>
          <text x="170" y="50" fontSize="9" fill="#39ff14" fillOpacity="0.35" fontFamily="monospace">?</text>
          <text x="110" y="42" fontSize="7" fill="#39ff14" fillOpacity="0.2" fontFamily="monospace">?</text>
        </svg>
      </div>
      <p className="text-gray-400 font-mono text-sm">Nenhuma live acontecendo agora</p>
      <p className="text-gray-600 font-mono text-xs mt-1">Volte mais tarde!</p>
    </div>
  );

  return (
    <motion.div className="space-y-4"
      variants={listContainer} initial="initial" animate="animate">
      {lives.map(live => (
        <motion.div key={live.id} variants={listItem}
          className="card p-4 cursor-pointer hover:border-neon-green/30 transition-all"
          onClick={() => enterLive(live)}>
          <div className="flex items-center gap-3 mb-3">
            <AvatarPopup profile={live.profiles} size={36} />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{live.profiles?.username}</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-mono text-red-400">AO VIVO</span>
              </div>
            </div>
            {live.expires_at && (
              <span className="text-xs font-mono text-gray-600">
                até {new Date(live.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h3 className="font-bold text-white mb-1">{live.title}</h3>
          {live.content && <p className="text-sm text-gray-400">{live.content}</p>}
          <div className="mt-3 flex items-center justify-between">
            <span className="tag tag-purple text-xs">
              {live.embed_type === 'twitch' ? 'Twitch' : 'YouTube'}
            </span>
            <span className="text-xs font-mono text-neon-green">Entrar na live →</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
