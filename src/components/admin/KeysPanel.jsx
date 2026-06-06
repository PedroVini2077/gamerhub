import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth.jsx';
import { logAudit } from '../../lib/auditLog';
import KeyEditor from '../keys/KeyEditor';
import toast from 'react-hot-toast';

function KeyForm({ onAdd }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    game_title: '', platform: 'Steam', key_code: '', is_promo: false, discount_percent: 0, promo_url: ''
  });
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!form.game_title) { toast.error('Coloca o nome do jogo'); return; }
    setLoading(true);
    const { error } = await supabase.from('game_keys').insert(form);
    if (error) toast.error('Erro ao adicionar');
    else {
      toast.success('Adicionado!');
      logAudit('admin_add_key',
        `Key "${form.game_title}" (${form.platform})${form.is_promo ? ' — Promoção' : ''} adicionada por @${profile?.username}`,
        { category: 'admin' });
      setForm({ game_title: '', platform: 'Steam', key_code: '', is_promo: false, discount_percent: 0, promo_url: '' });
      onAdd();
    }
    setLoading(false);
  }

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-display text-xs text-neon-green tracking-widest uppercase">Adicionar Key / Promo</h3>
      <div className="grid grid-cols-2 gap-3">
        <input className="input-gamer" placeholder="Nome do jogo" value={form.game_title}
          onChange={e => setForm(f => ({ ...f, game_title: e.target.value }))} />
        <select className="input-gamer" value={form.platform}
          onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
          {['Steam', 'Epic', 'GOG', 'PlayStation', 'Xbox'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400 font-mono cursor-pointer">
        <input type="checkbox" checked={form.is_promo}
          onChange={e => setForm(f => ({ ...f, is_promo: e.target.checked }))} />
        É promoção?
      </label>
      {!form.is_promo ? (
        <input className="input-gamer" placeholder="Código da key" value={form.key_code}
          onChange={e => setForm(f => ({ ...f, key_code: e.target.value }))} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <input className="input-gamer" type="number" placeholder="Desconto %"
            value={form.discount_percent}
            onChange={e => setForm(f => ({ ...f, discount_percent: +e.target.value }))} />
          <input className="input-gamer" placeholder="URL da promo" value={form.promo_url}
            onChange={e => setForm(f => ({ ...f, promo_url: e.target.value }))} />
        </div>
      )}
      <button onClick={handleAdd} disabled={loading} className="btn-solid py-2 px-5">
        {loading ? 'Salvando...' : 'Adicionar'}
      </button>
    </div>
  );
}

export default function KeysPanel({ keys, fetchAll, handleDeleteKey }) {
  return (
    <div className="space-y-4">
      <KeyForm onAdd={fetchAll} />
      <div className="space-y-3">
        {keys.map(k => (
          <div key={k.id} className="card p-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{k.game_title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="tag tag-cyan">{k.platform}</span>
                {k.is_promo
                  ? <span className="tag tag-purple">-{k.discount_percent}%</span>
                  : <span className="font-mono text-xs text-neon-green">{k.key_code || 'sem key'}</span>
                }
              </div>
            </div>
            <KeyEditor item={k} onUpdate={fetchAll} />
            <button onClick={() => handleDeleteKey(k.id)}
              className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
