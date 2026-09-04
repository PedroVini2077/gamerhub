import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../../hooks/useAuth.jsx';
import { consumirEntradaAgora, ehPrimeiraVez, registrarQueJaEntrou } from '../../lib/boasVindas';

/**
 * O portão que abre depois do login.
 *
 * ── A ideia, e o que ela realmente resolve ──────────────────────────────────
 *
 * Pedido do dono: *"ao invés de um redirecionamento seco, uma tela antes,
 * rápida, com alguma mensagem: seja bem-vindo (nome), preparando tudo pra
 * você… e um portão se abre"*.
 *
 * **Ela não inventa uma espera — ela mostra a que já existe.** Entrar hoje é um
 * corte: o formulário some e o feed aparece. Nesse intervalo o site carrega
 * perfil, cargo, feed e notificações. A tela cobre exatamente esse intervalo,
 * que é a diferença entre parecer travado e parecer que está te esperando.
 *
 * ── O que mata esse tipo de tela, e como isto evita ─────────────────────────
 *
 * Tempo FIXO. Dois segundos encantam na primeira vez e viram pedágio na
 * décima. Então a duração aqui é a do carregamento de verdade:
 *
 *     PISO   700 ms .... para não PISCAR em conexão rápida
 *     saída  quando o perfil chega
 *     TETO  2500 ms .... e este é o número que importa
 *
 * **O teto não é conforto, é regra do projeto** (§0.3): *"toda espera precisa
 * de teto absoluto"*. Se o perfil não chegar — banco lento, rede caindo —, a
 * tela sai assim mesmo e o site assume. Enfeite que segura a pessoa deixa de
 * ser enfeite e vira porta trancada, e o site já pagou por isso uma vez, com a
 * cena 3D presa esperando um evento que não veio.
 *
 * ── Por que ela mora AQUI e não na tela de login ────────────────────────────
 *
 * Segurar o redirecionamento no `Login.jsx` cobriria o corte, mas cobriria a
 * parte errada: a espera acontece DEPOIS de entrar, enquanto o site logado
 * monta. Montada no `App`, ela cobre a montagem de verdade.
 *
 * ── "Primeira vez" é por NAVEGADOR, e isso está dito ────────────────────────
 *
 * Ver `lib/boasVindas.js`. Quem entrar de outro aparelho vê a saudação de
 * estreia de novo — troca aceita para não criar contador de login no banco.
 */

/** Não piscar: menos que isto, a tela aparece e some antes de ser lida. */
const PISO_MS = 700;
/** Teto absoluto. Passou disto, o site assume mesmo sem o perfil. */
const TETO_MS = 2500;

export default function PortaoDeBoasVindas() {
  const { user, profile } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [estreia, setEstreia] = useState(false);
  const desde = useRef(0);

  // Abre SÓ quando a marca de "acabou de entrar" existe. Sem ela, recarregar a
  // página com sessão salva reabriria a tela em todo F5.
  //
  // A LEITURA do armazenamento é síncrona aqui de propósito — ela consome a
  // marca, e render descartado pelo React concorrente não pode engolir esse
  // consumo. Quem vai para o próximo tique é a APLICAÇÃO do estado, por duas
  // razões: o lint acusa `setState` síncrono em efeito (e está certo, é render
  // em cascata), e um tique de folga deixa a troca de rota assentar antes de o
  // portão cobrir a tela.
  useEffect(() => {
    if (!user || visivel) return undefined;
    if (!consumirEntradaAgora()) return undefined;

    const estreou = ehPrimeiraVez(user.id);
    registrarQueJaEntrou(user.id);
    desde.current = Date.now();

    const t = setTimeout(() => { setEstreia(estreou); setVisivel(true); }, 0);
    return () => clearTimeout(t);
  }, [user, visivel]);

  // Fecha: pelo perfil que chegou (respeitando o piso) ou pelo teto.
  useEffect(() => {
    if (!visivel) return undefined;

    const fechar = () => setSaindo(true);
    const decorrido = Date.now() - desde.current;

    const teto = setTimeout(fechar, Math.max(0, TETO_MS - decorrido));
    const piso = profile
      ? setTimeout(fechar, Math.max(0, PISO_MS - decorrido))
      : null;

    return () => { clearTimeout(teto); if (piso) clearTimeout(piso); };
  }, [visivel, profile]);

  // A saída é animada; o desmonte espera ela terminar.
  useEffect(() => {
    if (!saindo) return undefined;
    const t = setTimeout(() => { setVisivel(false); setSaindo(false); }, 620);
    return () => clearTimeout(t);
  }, [saindo]);

  if (!visivel) return null;

  const nome = profile?.username ? `@${profile.username}` : '';
  const titulo = estreia ? 'Seja bem-vindo' : 'Bem-vindo de volta';

  return createPortal(
    <div className={`portao ${saindo ? 'portao-abrindo' : ''}`} role="status" aria-live="polite">
      {/* As duas folhas. Elas só se movem por `transform`, e o fundo delas é
          gradiente estático — nada aqui repinta a tela por quadro. */}
      <div className="portao-folha portao-folha-verde" />
      <div className="portao-folha portao-folha-roxa" />

      <div className="portao-texto">
        <p className="portao-titulo">
          {titulo}
          {nome && <span className="portao-nome">{nome}</span>}
        </p>
        <p className="portao-linha">// preparando tudo pra você</p>
      </div>
    </div>,
    document.body,
  );
}
