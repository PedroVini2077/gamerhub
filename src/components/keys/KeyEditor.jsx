import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Pencil, Check, X } from 'lucide-react';

export default function KeyEditor({ item, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    game_title: item.game_title,
    platform: item.platform,
    key_code: item.key_code || '',
    is_promo: item.is_promo,
    discount_percent: item.discount_percent || 0,
    promo_url: item.promo_url || '',
  });

  async function handleSave() {
    const { error } = await supabase
      .from('game_keys')
      .update(form)
      .eq('id', item.id);
    if (error) toast.error('Erro ao salvar');
    else { toast.success('Atualizado!'); setEditing(false); onUpdate(); }
  }

  if (!editing) return (
    <button
      onClick={() => setEditing(true)}
      className="text-gray-500 hover:text-neon-green transition-colors"
      title="Editar"
    >
      <Pencil size={14} />
    </button>
  );

  return (
    <div className="mt-3 space-y-2 border-t border-dark-500 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <input className="input-gamer text-xs py-1.5" placeholder="Nome" value={form.game_title}
          onChange={e => setForm(f => ({ ...f, game_title: e.target.value }))} />
        <select className="input-gamer text-xs py-1.5" value={form.platform}
          onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
          {['Steam', 'Epic', 'GOG', 'PlayStation', 'Xbox'].map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      {!form.is_promo ? (
        <input className="input-gamer text-xs py-1.5" placeholder="Key code" value={form.key_code}
          onChange={e => setForm(f => ({ ...f, key_code: e.target.value }))} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input className="input-gamer text-xs py-1.5" type="number" placeholder="Desconto %"
            value={form.discount_percent}
            onChange={e => setForm(f => ({ ...f, discount_percent: +e.target.value }))} />
          <input className="input-gamer text-xs py-1.5" placeholder="URL da promo" value={form.promo_url}
            onChange={e => setForm(f => ({ ...f, promo_url: e.target.value }))} />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSave} className="btn-solid py-1 px-3 text-xs flex items-center gap-1">
          <Check size={12} /> Salvar
        </button>
        <button onClick={() => setEditing(false)} className="btn-neon py-1 px-3 text-xs flex items-center gap-1">
          <X size={12} /> Cancelar
        </button>
      </div>
    </div>
  );
}
