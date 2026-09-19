import { useEffect, useState } from 'react';
import { Trophy, RotateCcw, Ban, RefreshCw, AlertTriangle } from 'lucide-react';
import ReasonModal from '../ui/ReasonModal';
import { useXpDasLives } from '../../hooks/useXpDasLives';

/**
 * `[19/09]` LIVE-052 — o alcance da moderação DEPOIS que o cron apagou o post.
 *
 * ── Por que esta aba existe ───────────────────────────────────────────────
 *
 * A lista "Lives Encerradas" acima lê `posts`, e o cron apaga o post 15 minutos
 * depois que a live termina. Medido em 19/09: das 10 sessões gravadas, **10**
 * já não tinham post, e **8** eram válidas e fora do alcance da moderação — o
 * XP daquela live era permanente e nem o fundador desfazia.
 *
 * Esta aba lê `lives_realizadas`, que sobrevive ao cron de propósito
 * (LIVE-036), e é o único caminho para aquelas 8.
 *
 * ── O botão some quando não pode, mas não é ele que decide ────────────────
 *
 * `posso_moderar` vem do banco só para não oferecer um clique que vai falhar.
 * A hierarquia é conferida de novo dentro da RPC — validação no cliente não
 * vale nada sozinha, porque o site usa a `anon key` (§1.3).
 */
export default function XpDasLives() {
  const { sessoes, carregando, erro, carregar, invalidar, revalidar } = useXpDasLives();
  const [alvo, setAlvo] = useState(null);
  const [avisoDeErro, setAvisoDeErro] = useState(null);

  useEffect(() => { carregar(); }, [carregar]);

  async function confirmarInvalidacao(motivo) {
    const r = await invalidar(alvo.id, motivo);
    setAlvo(null);
    // A mensagem do banco é a que explica (faixa do motivo, hierarquia, já
    // invalidada). Trocar por texto genérico manda investigar o lugar errado.
    setAvisoDeErro(r.error ? (r.error.message || 'Não foi possível invalidar.') : null);
  }

  async function desfazer(s) {
    const r = await revalidar(s.id);
    setAvisoDeErro(r.error ? (r.error.message || 'Não foi possível devolver o XP.') : null);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={13} className="text-neon-green/60" />
          <p className="text-xs font-mono text-neon-green/60 uppercase tracking-wider font-bold">
            XP das lives ({sessoes.length})
          </p>
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          aria-label="Atualizar lista de lives realizadas"
          className="text-gray-500 hover:text-neon-green transition-colors disabled:opacity-40"
        >
          <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      <p className="text-xs font-mono text-gray-600 mb-3">
        Alcança a live mesmo depois que o post foi apagado. Tirar o XP avisa o autor.
      </p>

      {(erro || avisoDeErro) && (
        <p className="text-xs font-mono text-red-400 mb-3 flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{erro || avisoDeErro}</span>
        </p>
      )}

      {!sessoes.length && !carregando ? (
        <p className="text-xs text-gray-600 font-mono">Nenhuma live registrada</p>
      ) : (
        <div className="space-y-2">
          {sessoes.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2 border border-dark-500">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-bold text-white truncate">{s.titulo}</p>
                <p className="text-xs font-mono text-gray-600">
                  por {s.username || '—'} · {new Date(s.encerrada_em).toLocaleDateString('pt-BR')}
                  {!s.post_existe && ' · post já apagado'}
                </p>
                {s.invalidada_motivo && (
                  <p className="text-xs font-mono text-yellow-400/70 truncate">{s.invalidada_motivo}</p>
                )}
              </div>

              {!s.posso_moderar ? (
                <span className="text-xs font-mono text-gray-600 shrink-0">sem alcance</span>
              ) : s.invalidada_em ? (
                <button
                  onClick={() => desfazer(s)}
                  className="flex items-center gap-1 text-xs font-mono text-neon-green/70 hover:text-neon-green border border-neon-green/20 hover:border-neon-green/50 px-2 py-0.5 rounded transition-all shrink-0"
                >
                  <RotateCcw size={10} />Devolver
                </button>
              ) : (
                <button
                  onClick={() => { setAvisoDeErro(null); setAlvo(s); }}
                  className="flex items-center gap-1 text-xs font-mono text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/50 px-2 py-0.5 rounded transition-all shrink-0"
                >
                  <Ban size={10} />Tirar XP
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {alvo && (
        <ReasonModal
          title="Tirar o XP desta live"
          icon={Ban}
          accent="red"
          subtitle="O autor é avisado, e a ação fica na trilha. Dá para devolver depois."
          target={alvo.titulo}
          label="Motivo"
          placeholder="Por que esta live não deve contar XP?"
          required
          confirmLabel="Tirar XP"
          confirmIcon={Ban}
          onConfirm={confirmarInvalidacao}
          onClose={() => setAlvo(null)}
        />
      )}
    </div>
  );
}
