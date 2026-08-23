import { ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';

/**
 * Os dois cartões de moderação da aba Site: limites de escalação e IA.
 *
 * Extraídos do `SiteTab` quando ele passou de 300 linhas (§4). Movimentação
 * mecânica — nenhuma mudança de comportamento.
 */
export default function SiteModerationCards({ config, setConfig, saveKey, toggle }) {
  return (
    <>
      {/* Moderação */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-orange-400" />
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Limites de Moderação</p>
        </div>
        <p className="text-xs font-mono text-gray-600 -mt-2">
          Ajuste os gatilhos automáticos do sistema de moderação.
        </p>
        {[
          { key: 'mod_report_threshold',  label: 'Denúncias para ocultar',  desc: 'Quantas denúncias ocultam um conteúdo automaticamente' },
          { key: 'mod_suspend_threshold', label: 'Pontos para suspensão',   desc: 'Pontos de infração que sinalizam suspensão' },
          { key: 'mod_ban_threshold',     label: 'Pontos para ban',         desc: 'Pontos de infração que banem o usuário automaticamente' },
        ].map(f => (
          <div key={f.key} className="flex items-center justify-between gap-4 py-2 border-b border-dark-600 last:border-0">
            <div className="min-w-0">
              <p className="text-xs font-mono text-gray-300">{f.label}</p>
              <p className="text-xs font-mono text-gray-600">{f.desc}</p>
            </div>
            <input
              type="number" min="1" max="999"
              value={config[f.key]}
              onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
              onBlur={e => {
                const v = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1));
                setConfig(c => ({ ...c, [f.key]: String(v) }));
                saveKey(f.key, v);
              }}
              className="w-16 px-2 py-1.5 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-center text-gray-200 focus:border-orange-400/50 focus:outline-none shrink-0"
            />
          </div>
        ))}
      </div>

      {/* Moderação IA */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-purple-400" />
            <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Moderação IA (HuggingFace)</p>
          </div>
          <button onClick={() => toggle('mod_ai_enabled')}
            className="flex items-center gap-1.5 text-xs font-mono transition-colors shrink-0"
            style={{ color: config.mod_ai_enabled === 'true' ? '#a855f7' : '#6b7280' }}>
            {config.mod_ai_enabled === 'true' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {config.mod_ai_enabled === 'true' ? 'Ativa' : 'Desligada'}
          </button>
        </div>
        <p className="text-xs font-mono text-gray-600 -mt-2">
          Analisa texto de posts, comentários e mural com IA e oculta automaticamente se o score de toxicidade ultrapassar o limite. Requer secret <code className="text-purple-400">HUGGINGFACE_API_KEY</code> configurado.
        </p>
        {[
          { key: 'mod_ai_text_threshold',  label: 'Limite — texto',   desc: 'Score mínimo para ocultar texto (0.0–1.0). Padrão: 0.70', def: 0.7  },
          { key: 'mod_ai_image_threshold', label: 'Limite — imagem',  desc: 'Score NSFW mínimo para ocultar imagens (0.0–1.0). Padrão: 0.85', def: 0.85 },
        ].map(f => (
          <div key={f.key} className="flex items-center justify-between gap-4 py-2 border-t border-dark-600">
            <div>
              <p className="text-xs font-mono text-gray-300">{f.label}</p>
              <p className="text-xs font-mono text-gray-600">{f.desc}</p>
            </div>
            <input
              type="number" min="0.1" max="1.0" step="0.05"
              value={config[f.key]}
              onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
              onBlur={e => {
                const v = Math.max(0.1, Math.min(1.0, parseFloat(e.target.value) || f.def));
                const rounded = Math.round(v * 100) / 100;
                setConfig(c => ({ ...c, [f.key]: String(rounded) }));
                saveKey(f.key, rounded);
              }}
              className="w-20 px-2 py-1.5 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-center text-gray-200 focus:border-purple-400/50 focus:outline-none shrink-0"
            />
          </div>
        ))}
      </div>
    </>
  );
}
