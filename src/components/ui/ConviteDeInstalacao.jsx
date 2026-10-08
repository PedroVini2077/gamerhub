import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import {
  devoConvidar, abrirConvite, dispensarConvite, aoMudarConvite,
} from '../../lib/conviteDeInstalacao';

/**
 * `[08/10]` A faixa que convida a instalar o GamerHub.
 *
 * ── Por que ela é uma FAIXA e não um toast ─────────────────────────────────
 *
 * Toast some sozinho. A oportunidade de instalar sumiria junto, e quem estava
 * lendo outra coisa perderia a única vez que o convite aparece — o navegador
 * dispara `beforeinstallprompt` uma vez só.
 *
 * ── Por que ela é dispensável, e por que isso é a parte importante ─────────
 *
 * O botão de fechar não é cortesia: é o que diferencia convite de insistência.
 * A decisão fica guardada, e quem disse não **não vê de novo** — a mesma regra
 * do som ambiente, e pelo mesmo motivo.
 *
 * ── Onde ela NÃO aparece ───────────────────────────────────────────────────
 *
 * Em quem já instalou, em quem já dispensou, e no iPhone — onde o Safari não
 * implementa o evento. Nos três casos ela simplesmente não existe, sem ocupar
 * espaço nem explicar nada.
 */
export default function ConviteDeInstalacao() {
  const [aparecer, setAparecer] = useState(() => devoConvidar());
  const [instalando, setInstalando] = useState(false);

  useEffect(() => aoMudarConvite(() => setAparecer(devoConvidar())), []);

  if (!aparecer) return null;

  async function instalar() {
    setInstalando(true);
    try {
      await abrirConvite();
    } finally {
      // O convite some em qualquer desfecho: se instalou, não faz mais
      // sentido; se recusou no diálogo do navegador, insistir seria pior.
      setInstalando(false);
      setAparecer(false);
    }
  }

  function fechar() {
    dispensarConvite();
    setAparecer(false);
  }

  return (
    <div
      role="region"
      aria-label="Instalar o GamerHub"
      // `bottom-24` no celular: o atalho de publicar do feed é um botão
      // flutuante em `bottom-5 right-5`, e a faixa o cobriria inteiro.
      className="fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(26rem,calc(100vw-2rem))]
                 bg-dark-800 border border-neon-green/30 rounded-2xl shadow-lg
                 px-4 py-3 flex items-center gap-3 animate-fade-up"
    >
      <Download size={18} className="text-neon-green shrink-0" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <p className="text-sm text-white font-medium leading-tight">
          Instalar o GamerHub
        </p>
        <p className="text-xs text-gray-400 leading-snug mt-0.5">
          Abre direto da sua tela inicial, sem passar pelo navegador.
        </p>
      </div>

      <button
        type="button"
        onClick={instalar}
        disabled={instalando}
        className="shrink-0 text-xs font-mono uppercase tracking-wider text-neon-green
                   border border-neon-green/40 rounded-lg px-3 py-2
                   hover:bg-neon-green/10 disabled:opacity-50 transition-colors"
      >
        {instalando ? 'Abrindo…' : 'Instalar'}
      </button>

      <button
        type="button"
        onClick={fechar}
        aria-label="Agora não"
        className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
