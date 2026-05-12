import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Pencil, Check, X } from 'lucide-react';

export default function KeyEditor({ item, onUpdate }) {
  const [open, setOpen] = useState(false);
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
    else {
      toast.success('Atualizado!');
      setOpen(false);
      onUpdate();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-gray-500 hover:text-neon-green transition-colors"
        title="Editar"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/70 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-dark-700 border border-dark-400 rounded-xl w-full max-w-sm p-5 space-y-3 animate-fade-up">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-xs text-neon-green tracking-widest uppercase">
                  Editar
                </h3>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input-gamer text-sm"
                  placeholder="Nome do jogo"
                  value={form.game_title}
                  onChange={e => setForm(f => ({ ...f, game_title: e.target.value }))}
                />
                <select
                  className="input-gamer text-sm"
                  value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                >
                  {['Steam', 'Epic', 'GOG', 'PlayStation', 'Xbox'].map(p => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>

              {!form.is_promo ? (
                <input
                  className="input-gamer text-sm"
                  placeholder="Código da key"
                  value={form.key_code}
                  onChange={e => setForm(f => ({ ...f, key_code: e.target.value }))}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="input-gamer text-sm"
                    type="number"
                    placeholder="Desconto %"
                    value={form.discount_percent}
                    onChange={e => setForm(f => ({ ...f, discount_percent: +e.target.value }))}
                  />
                  <input
                    className="input-gamer text-sm"
                    placeholder="URL da promo"
                    value={form.promo_url}
                    onChange={e => setForm(f => ({ ...f, promo_url: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} className="btn-solid flex items-center gap-2 py-2 px-4 flex-1">
                  <Check size={13} /> Salvar
                </button>
                <button onClick={() => setOpen(false)} className="btn-neon flex items-center gap-2 py-2 px-4">
                  <X size={13} /> Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
