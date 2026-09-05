import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { ligarSom, desligarSom, tentarTocar, TOCANDO } from '../../lib/somAmbiente';
import {
  preferenciaDeSom, gravarPreferenciaDeSom, podeTentarSozinho,
  LIGADO, DESLIGADO, SEM_DECISAO,
} from '../../lib/preferenciaDeSom';

/**
 * O botão do som ambiente da landing, o aviso de que ele existe, e a tentativa
 * de tocar sozinho depois da intro do raio.
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
 * O que existe agora no lugar é explícito: uma tentativa, num momento definido
 * (o fim da intro), com o resultado lido de volta.
 *
 * ── Sobre "o navegador não pediu permissão" ─────────────────────────────────
 *
 * Ele não pede, e não existe caixa de permissão para áudio. Navegador
 * simplesmente **bloqueia, em silêncio**, som que começa sem um gesto. É por
 * isso que existe o aviso discreto: quem avisa que há som aqui somos nós,
 * porque ninguém mais vai avisar.
 *
 * ── A tentativa automática, e o que ela honestamente faz ────────────────────
 *
 * O dono pediu (02/09): *"tente também fazer com que o áudio seja
 * automaticamente ligado depois da intro do raio, com um fade-in, que o código
 * identifique quando está sendo bloqueado ou não"*. As três regras:
 *
 * | Quem | Tenta? | E se o navegador barrar |
 * | --- | --- | --- |
 * | já ligou antes | sim, retoma | o aviso aparece convidando ao clique |
 * | nunca decidiu | sim, **uma vez** | ninguém ouviu nada; o aviso aparece |
 * | **desligou** | **nunca** | — |
 *
 * A tentativa quase sempre é barrada em quem chega pela primeira vez, e isso é
 * o correto: o navegador está do lado da pessoa. O que o código garante é que
 * o botão **nunca minta** — se foi barrado, ele continua mostrando "desligado",
 * porque é isso que está acontecendo.
 */

const CHAVE_AVISO = 'gh_som_avisado';

function jaAvisado() {
  try { return window.sessionStorage.getItem(CHAVE_AVISO) === 'sim'; } catch { return false; }
}

export default function BotaoDeSom({ introTerminou = false }) {
  const [ligado, setLigado] = useState(false);
  // A decisão guardada.
  //
  // É `useState` e NÃO `useRef` de propósito, e o lint estava certo em reclamar
  // da primeira versão: este valor decide o TEXTO do aviso, ou seja, ele
  // participa da renderização. Ref lido durante o render não avisa o React que
  // mudou — a tela ficaria mostrando a frase da decisão anterior. O
  // `CLAUDE.md` já registra o irmão deste erro em `useAuth` ("escrever em ref
  // durante o render é inseguro com renderização concorrente").
  const [decisao, setDecisao] = useState(preferenciaDeSom);
  const [avisando, setAvisando] = useState(
    () => !jaAvisado() && preferenciaDeSom() !== DESLIGADO,
  );
  // Uma tentativa por montagem. Sem isto, qualquer re-render da landing
  // dispararia outra — e o `montar()` do somAmbiente até impediria duas
  // instâncias, mas insistir contra a decisão do navegador é fazer barulho
  // (de código) à toa.
  const jaTentou = useRef(false);
  const temporizador = useRef(null);

  const dispensarAviso = useCallback(() => {
    setAvisando(false);
    try { window.sessionStorage.setItem(CHAVE_AVISO, 'sim'); } catch { /* modo privado */ }
  }, []);

  // Some sozinho depois de 9 s: aviso que fica para sempre vira parte do
  // cenário e deixa de ser lido.
  useEffect(() => {
    if (!avisando) return undefined;
    temporizador.current = setTimeout(() => dispensarAviso(), 9000);
    return () => clearTimeout(temporizador.current);
  }, [avisando, dispensarAviso]);

  // ── A tentativa automática, depois da intro ───────────────────────────────
  useEffect(() => {
    if (!introTerminou || jaTentou.current) return undefined;
    if (!podeTentarSozinho(decisao)) return undefined;
    jaTentou.current = true;

    let vivo = true;
    tentarTocar({ sozinho: true }).then((resultado) => {
      if (!vivo) return;
      if (resultado === TOCANDO) {
        setLigado(true);
        // Quem já tinha decidido `LIGADO` continua com a mesma decisão; quem
        // estava em `SEM_DECISAO` NÃO passa a ter decidido só porque o
        // navegador deixou tocar. Ouvir não é escolher — a gravação só
        // acontece quando a pessoa clica no botão.
        dispensarAviso();
        return;
      }
      // Barrado ou indisponível: o botão fica em "desligado", que é a verdade.
      // O aviso segue na tela justamente para dar o caminho do clique.
    });
    return () => { vivo = false; };
  }, [introTerminou, decisao, dispensarAviso]);

  // Sair da landing solta o áudio. Sem isto os osciladores seguiriam vivos.
  useEffect(() => () => desligarSom(), []);

  function alternar() {
    dispensarAviso();

    if (ligado) {
      desligarSom();
      setLigado(false);
      // GRAVA o desligado em vez de apagar a chave. Ver `preferenciaDeSom.js`:
      // apagar tornava "desliguei" indistinguível de "nunca escolhi", e com
      // autoplay isso significaria o som voltando na próxima visita.
      gravarPreferenciaDeSom(DESLIGADO);
      setDecisao(DESLIGADO);
      return;
    }

    if (ligarSom()) {
      setLigado(true);
      gravarPreferenciaDeSom(LIGADO);
      setDecisao(LIGADO);
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
            {decisao === SEM_DECISAO
              ? 'este site tem som ambiente'
              : 'toque para ouvir o som ambiente'}
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
