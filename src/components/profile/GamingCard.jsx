import { Gamepad2, Swords } from 'lucide-react';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Mobile', 'Switch', 'Multi'];
const PLAYSTYLES = [
  { value: 'casual',      label: 'Casual',      desc: 'Jogo por diversão' },
  { value: 'competitivo', label: 'Competitivo', desc: 'Foco em ranking' },
  { value: 'ambos',       label: 'Ambos',       desc: 'Depende do dia' },
];

export default function GamingCard({ form, setField }) {
  // Clicar na opção já marcada desmarca — é assim que se limpa o campo.
  const toggle = (field, value) => setField(field, form[field] === value ? '' : value);

  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
        <Gamepad2 size={12} />Gaming
      </h3>

      <div>
        <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Plataforma Principal</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <button key={p} type="button" aria-pressed={form.platform === p}
              onClick={() => toggle('platform', p)}
              className={`tag cursor-pointer transition-all flex items-center gap-1 ${form.platform === p ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'}`}>
              <Gamepad2 size={10} />{p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">Estilo de Jogo</label>
        <div className="grid grid-cols-3 gap-2">
          {PLAYSTYLES.map(ps => (
            <button key={ps.value} type="button" aria-pressed={form.playstyle === ps.value}
              onClick={() => toggle('playstyle', ps.value)}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                form.playstyle === ps.value
                  ? 'border-neon-green/50 bg-neon-green/10 text-neon-green'
                  : 'border-dark-400 text-gray-500 hover:border-dark-300'
              }`}>
              <p className="text-xs font-display font-bold">{ps.label}</p>
              <p className="text-xs font-mono text-gray-600 mt-0.5" style={{ fontSize: 10 }}>{ps.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
          Jogos Favoritos
        </label>
        <div className="flex items-start bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
          <span className="pl-3 pr-2 pt-2.5 text-gray-500 shrink-0"><Swords size={14} /></span>
          <textarea aria-label="Jogos favoritos" className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body resize-none"
            rows={2} placeholder="Ex: CS2, Valorant, Minecraft..." value={form.favorite_games}
            onChange={e => setField('favorite_games', e.target.value)} maxLength={200} />
        </div>
      </div>
    </div>
  );
}
