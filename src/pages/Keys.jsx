import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Tag, Copy, Check, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

function KeyCard({ item }) {
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(item.key_code);
    setCopied(true);
    toast.success('Key copiada!');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-5 hover:border-neon-green/30">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-white text-base">{item.game_title}</h3>
        <span className="tag tag-green">{item.platform}</span>
      </div>
      <div className="flex items-center gap-2 bg-dark-700 border border-dark-400 rounded px-3 py-2">
        <span className="font-mono text-sm text-neon-green flex-1 break-all">{item.key_code}</span>
        <button onClick={copyKey} className="text-gray-400 hover:text-neon-green transition-colors shrink-0">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

function PromoCard({ item }) {
  return (
    <div className="card p-5 hover:border-neon-purple/30">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-white text-base">{item.game_title}</h3>
        <span className="tag tag-purple">-{item.discount_percent}%</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className="tag tag-cyan">{item.platform}</span>
        {item.expires_at && (
          <span className="text-xs text-gray-500 font-mono">
            Até {new Date(item.expires_at).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
      {item.promo_url ? (
        <a href={item.promo_url} target="_blank" rel="noreferrer" className="btn-purple flex items-center gap-2 w-fit text-xs py-2 px-3">
          Ver oferta <ExternalLink size={12} />
        </a>
      ) : (
        <span className="text-xs text-gray-500 font-mono">Link em breve</span>
      )}
    </div>
  );
}

export default function Keys() {
  const [keys, setKeys] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('keys');

  useEffect(() => {
    supabase.from('game_keys').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setKeys(data.filter(k => !k.is_promo && k.key_code));
          setPromos(data.filter(k => k.is_promo));
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Key size={16} className="text-neon-green" />
          <h1 className="font-display text-sm text-neon-green tracking-widest uppercase">Keys & Promoções</h1>
        </div>
        <p className="text-xs text-gray-500 font-mono">Keys grátis e os melhores preços da galáxia.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('keys')}
          className={`btn-neon py-2 px-4 text-xs ${tab === 'keys' ? 'bg-neon-green/10' : 'opacity-50'}`}
        >
          Keys Grátis ({keys.length})
        </button>
        <button
          onClick={() => setTab('promos')}
          className={`btn-purple py-2 px-4 text-xs ${tab === 'promos' ? 'bg-neon-purple/10 opacity-100' : 'opacity-50'}`}
        >
          Promoções ({promos.length})
        </button>
      </div>

      {loading ? (
        <div className="card p-5 animate-pulse h-32" />
      ) : tab === 'keys' ? (
        keys.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">Sem keys disponíveis no momento 😔</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map(k => <KeyCard key={k.id} item={k} />)}
          </div>
        )
      ) : (
        promos.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-mono text-gray-500 text-sm">Sem promoções ativas no momento 😔</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {promos.map(p => <PromoCard key={p.id} item={p} />)}
          </div>
        )
      )}
    </div>
  );
}
