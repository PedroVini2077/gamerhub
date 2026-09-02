import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { ligarSom, desligarSom } from '../../lib/somAmbiente';

/**
 * O botão do som ambiente da landing, e o aviso de que ele existe.
 *
 * ── O bug de 02/09, e por que ele nasceu ────────────────────────────────────
 *
 * A primeira versão tentava ser esperta: quem já tinha ligado o som antes teria
 * ele de volta no **primeiro gesto qualquer** na página, porque o navegador
 * exige um gesto e o botão não precisava ser esse gesto.
 *
 * Só que `pointerdown` dispara ANTES de `click`. Ao clicar no próprio botão, o
 * ouvinte ligava o som, o React atualizava o estado, e então o `click` do botão
 * via "está ligado" e **desligava na sequência**. Clicar não fazia nada — foi
 * exatamente o que o dono relatou.
 *
 * **A correção não foi remendar a ordem dos eventos, foi tirar a esperteza.**
 * O som liga pelo botão, e só. É menos código, não tem corrida possível, e o
 * comportamento é o que qualquer pessoa espera de um botão.
 *
 * ── Sobre "o navegador não pediu permissão" ─────────────────────────────────
 *
 * Ele não pede, e não existe caixa de permissão para áudio. Navegador
 * simplesmente **bloqueia, em silêncio**, som que começa sem um gesto. É por
 * isso que existe o aviso discreto abaixo: quem avisa que há som aqui somos
 * nós, porque ninguém mais vai avisar.
 */

const CHAVE = 'gh_som_ambiente';
const CHAVE_AVISO = 'gh_som_avisado';

function leu(chave) {
  try { return window.sessionStorage.getItem(chave); } catch { return null; }
}

function jaLigouAntes() {
  try { return window.localStorage.getItem(CHAVE) === 'ligado'; } catch { return false; }
}

export default function BotaoDeSom() {
  const [ligado, setLigado] = useState(false);
  // O aviso aparece uma vez por sessão, e não para quem já conhece o botão
  // (quem já ligou o som alguma vez não precisa ser apresentado a ele).
  const [avisando, setAvisando] = useState(
    () => !leu(CHAVE_AVISO) && !jaLigouAntes(),
  );
  const temporizador = useRef(null);

  // Some sozinho depois de 9 s: aviso que fica para sempre vira parte do
  // cenário e deixa de ser lido.
  useEffect(() => {
    if (!avisando) return undefined;
    temporizador.current = setTimeout(() => dispensarAviso(), 9000);
    return () => clearTimeout(temporizador.current);
  }, [avisando]);

  // Sair da landing solta o áudio. Sem isto os osciladores seguiriam vivos.
  useEffect(() => () => desligarSom(), []);

  function dispensarAviso() {
    setAvisando(false);
    try { window.sessionStorage.setItem(CHAVE_AVISO, 'sim'); } catch { /* modo privado */ }
  }

  function alternar() {
    dispensarAviso();

    if (ligado) {
      desligarSom();
      setLigado(false);
      try { window.localStorage.removeItem(CHAVE); } catch { /* modo privado */ }
      return;
    }

    if (ligarSom()) {
      setLigado(true);
      try { window.localStorage.setItem(CHAVE, 'ligado'); } catch { /* modo privado */ }
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
      {avisando && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-full border border-dark-500
                     bg-dark-800/90 backdrop-blur px-3 py-2 animate-fade-up"
        >
          <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap">
            este site tem som ambiente
          </span>
          <button
            type="button"
            onClick={dispensarAviso}
            aria-label="Dispensar aviso de som"
            className="text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={alternar}
        aria-pressed={ligado}
        aria-label={ligado ? 'Desligar som ambiente' : 'Ligar som ambiente'}
        title={ligado ? 'Desligar som ambiente' : 'Ligar som ambiente'}
        className={`grid place-items-center w-11 h-11 shrink-0 rounded-full border
                    backdrop-blur transition-colors
                    ${ligado
                      ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                      : 'border-dark-500 bg-dark-800/80 text-gray-500 hover:text-gray-300'}`}
      >
        {ligado ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>
    </div>
  );
}
