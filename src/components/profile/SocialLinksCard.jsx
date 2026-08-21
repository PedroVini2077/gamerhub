import { MessageSquare } from 'lucide-react';
import { FaTwitch, FaYoutube, FaDiscord } from 'react-icons/fa6';

const NETWORKS = [
  { icon: FaDiscord, label: 'Discord', placeholder: 'usuario#0000 ou usuario', name: 'discord' },
  { icon: FaTwitch,  label: 'Twitch',  placeholder: 'seu canal da Twitch',     name: 'twitch' },
  { icon: FaYoutube, label: 'YouTube', placeholder: 'seu canal do YouTube',    name: 'youtube' },
];

export default function SocialLinksCard({ form, setField }) {
  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
        <MessageSquare size={12} />Redes Sociais
      </h3>

      {NETWORKS.map(({ icon: Icon, label, placeholder, name }) => (
        <div key={name}>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">{label}</label>
          <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Icon size={14} /></span>
            <input aria-label={label} className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder={placeholder} value={form[name]}
              onChange={e => setField(name, e.target.value)} maxLength={100} />
          </div>
        </div>
      ))}
    </div>
  );
}
