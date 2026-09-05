import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import PortaDeAcesso from './PortaDeAcesso';

import { useAuth } from '../../hooks/useAuth.jsx';
import {
  consumirEntradaAgora, ehPrimeiraVez, registrarQueJaEntrou, nomeDaSaudacao,
  EVENTO_ENTROU, EVENTO_CANCELADO,
} from '../../lib/boasVindas';

/**
 * O portão que abre depois do login.
 *
 * ── A ideia, e o que ela realmente resolve ──────────────────────────────────
 *
 * Pedido do dono: *"ao invés de um redirecionamento seco, uma tela antes,
 * rápida, com alguma mensagem: seja bem-vindo (nome), preparando tudo pra
 * você… e um portão se abre"*.
 *
 * ── `[04/09]` A PRIMEIRA versão foi reprovada, e o motivo importa ────────────
 *
 * Ela era duas metades com uma fenda no meio desde o primeiro quadro. Ele
 * cortou: *"não queria que ela tivesse essa fenda, eu queria que fosse estilo
 * portão futurista, que tem uma tranca no meio que rodasse 'destrancando' a
 * porta e carregando o site"*.
 *
 * A diferença não é decorativa. Fenda no primeiro quadro conta *"isto vai
 * abrir"*; porta inteira com tranca girando conta *"isto está sendo aberto para
 * você"* — que é o que a tela existe para dizer enquanto o site carrega.
 *
 * Daí os TRÊS estados, e o do meio é o que dá causa à abertura:
 *
 *     trancado ..... a porta é uma superfície só, e a tranca gira
 *     destrancado .. a tranca para, trava e acende
 *     abrindo ...... aí sim as folhas se separam
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

/** Não piscar: menos que isto, a tranca nem completa uma volta. */
const PISO_MS = 700;
/** Teto absoluto. Passou disto, o site assume mesmo sem o perfil. */
const TETO_MS = 2500;
/**
 * Quanto dura o destravamento: a volta inteira da tranca, mais um respiro.
 *
 * `[05/09]` Era 420 ms. Pedido do dono: *"achei a volta da tranca muito curta,
 * você acha legal ela fazer uma volta 360 e depois abrir?"*. A volta são 820 ms
 * (`portaDestrava`, em `estilos/portao/estados.css`) e os 140 ms de sobra são a
 * pausa em que ela fica travada e acesa antes de as folhas andarem — sem essa
 * pausa, a abertura come o fim da volta e as duas coisas viram uma só.
 */
const DESTRAVE_MS = 960;
/** A abertura das folhas — igual à `transition` do CSS. */
const ABERTURA_MS = 640;

export default function PortaoDeBoasVindas() {
  const { user, profile } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const [destrancado, setDestrancado] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [estreia, setEstreia] = useState(false);
  const desde = useRef(0);
  // Muda quando o login avisa que marcou. Serve só para o efeito abaixo
  // reconferir — ver `EVENTO_ENTROU` em `lib/boasVindas.js` para a corrida que
  // isto resolve.
  const [tique, setTique] = useState(0);

  useEffect(() => {
    const aviso = () => setTique((t) => t + 1);
    window.addEventListener(EVENTO_ENTROU, aviso);
    return () => window.removeEventListener(EVENTO_ENTROU, aviso);
  }, []);

  // SAI NA HORA quando a entrada é cancelada — senha recusada ou conta banida.
  //
  // A marca é escrita antes do login, e o `user` aparece antes de a checagem de
  // ban terminar: nessa janela o portão já subiu e já consumiu a marca, então
  // apagá-la não o tira da tela. Sem isto, quem fosse barrado teria um
  // "Bem-vindo de volta" rodando atrás da tela de banimento — invisível hoje só
  // porque o `z-index` dela é maior, o que é sorte, não proteção (§1.3).
  useEffect(() => {
    const sumir = () => {
      setVisivel(false); setSaindo(false); setDestrancado(false);
    };
    window.addEventListener(EVENTO_CANCELADO, sumir);
    return () => window.removeEventListener(EVENTO_CANCELADO, sumir);
  }, []);

  // Abre SÓ quando a marca de "acabou de entrar" existe. Sem ela, recarregar a
  // página com sessão salva reabriria a tela em todo F5.
  //
  // ── `[05/09]` `useLayoutEffect`, e é a metade do conserto do bug ───────────
  //
  // Relato do dono: *"assim que eu logava, eu via o site por alguns segundos,
  // depois aparecia o portão"*. A outra metade está em `useAuth.jsx` (a marca
  // passou a ser escrita ANTES do login); esta é o instante em que o portão
  // sobe.
  //
  // `useEffect` roda DEPOIS de o navegador pintar. Como o `user` aparecer é o
  // mesmo evento que troca a rota, um efeito comum garante pelo menos um quadro
  // com o site logado à mostra e nada por cima — e a versão anterior ainda
  // adiava mais um `setTimeout(0)` em cima disso, com um comentário meu dizendo
  // que era de propósito. Era o defeito, escrito como decisão.
  //
  // `useLayoutEffect` roda depois da mutação do DOM e ANTES da pintura, e o
  // React descarrega o `setState` dele de forma síncrona. Resultado: o primeiro
  // quadro que contém o site já contém o portão em cima. Não existe janela.
  useLayoutEffect(() => {
    if (!user || visivel) return;
    if (!consumirEntradaAgora()) return;

    // SUPRESSÃO CONSCIENTE, e ela é o oposto de maquiagem (§6.1).
    //
    // A regra avisa que `setState` síncrono em efeito provoca render em
    // cascata, e está certa: provoca mesmo. Só que a cascata é EXATAMENTE o
    // que se quer aqui — é o segundo render, ainda antes da pintura, que põe
    // o portão sobre o site. Obedecer ao aviso (adiar por `setTimeout`, que
    // era como estava) devolve o bug que o dono relatou.
    //
    // O custo é um render extra, uma vez por login, num componente de três
    // estados. Não é laço, não é por quadro, não escala com nada.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setEstreia(ehPrimeiraVez(user.id));
    registrarQueJaEntrou(user.id);
    desde.current = Date.now();
    setVisivel(true);
  }, [user, visivel, tique]);

  // DESTRANCA: pelo perfil que chegou (respeitando o piso) ou pelo teto.
  useEffect(() => {
    if (!visivel || destrancado) return undefined;

    const destrancar = () => setDestrancado(true);
    const decorrido = Date.now() - desde.current;

    const teto = setTimeout(destrancar, Math.max(0, TETO_MS - decorrido));
    const piso = profile
      ? setTimeout(destrancar, Math.max(0, PISO_MS - decorrido))
      : null;

    return () => { clearTimeout(teto); if (piso) clearTimeout(piso); };
  }, [visivel, destrancado, profile]);

  // ── A VOLTA da tranca precisa saber onde ela está ─────────────────────────
  //
  // O giro contínuo é uma animação CSS, e o ângulo dela não é legível como
  // valor — só como matriz de transformação já calculada. Então, no instante em
  // que destranca, lemos a matriz e escrevemos o ângulo em `--tranca-em`; o
  // `@keyframes portaDestrava` usa isso para girar EXATAMENTE 360° e parar
  // alinhado. O porquê de cada metade da conta está no CSS.
  //
  // `useLayoutEffect` porque a variável tem que existir ANTES de o navegador
  // pintar o primeiro quadro da nova animação. Num `useEffect`, o primeiro
  // quadro usaria o padrão e o disco daria um salto visível.
  useLayoutEffect(() => {
    if (!destrancado) return;

    const disco = document.querySelector('.porta-disco');
    if (!disco) return;

    const { m11, m12 } = new DOMMatrixReadOnly(getComputedStyle(disco).transform);
    // `atan2` devolve de -180 a 180; o `+ 360) % 360` normaliza para 0..360,
    // que é o intervalo que a conta do CSS espera.
    const graus = ((Math.atan2(m12, m11) * 180) / Math.PI + 360) % 360;

    disco.closest('.portao')?.style.setProperty('--tranca-em', `${graus}deg`);
  }, [destrancado]);

  // ABRE, depois de a tranca ter dado a volta e travado. A pausa é o que faz a
  // abertura ter causa em vez de acontecer sozinha.
  useEffect(() => {
    if (!destrancado) return undefined;
    const t = setTimeout(() => setSaindo(true), DESTRAVE_MS);
    return () => clearTimeout(t);
  }, [destrancado]);

  // O desmonte espera a abertura terminar.
  useEffect(() => {
    if (!saindo) return undefined;
    const t = setTimeout(() => {
      setVisivel(false); setSaindo(false); setDestrancado(false);
    }, ABERTURA_MS + 60);
    return () => clearTimeout(t);
  }, [saindo]);

  if (!visivel) return null;

  // Duas fontes de propósito: o perfil pode ainda não ter chegado quando o
  // portão sobe. Ver `nomeDaSaudacao` em `lib/boasVindas.js`.
  const nome = nomeDaSaudacao(profile, user);
  const titulo = estreia ? 'Seja bem-vindo' : 'Bem-vindo de volta';

  const classes = [
    'portao',
    destrancado ? 'portao-destrancado' : '',
    saindo ? 'portao-abrindo' : '',
  ].filter(Boolean).join(' ');

  return createPortal(
    <div className={classes} role="status" aria-live="polite">
      {/* A porta é desenhada em SVG, à MÃO. O dono mandou um render como
          REFERÊNCIA e foi explícito: *"eu mandei pra você usar como exemplo e
          criar à mão"* — antes disso eu tinha recortado a própria ilustração em
          quatro pedaços, e ele cortou com razão. Ver `PortaDeAcesso.jsx`. */}
      <PortaDeAcesso />

      <div className="portao-texto">
        <p className="portao-titulo">
          {titulo}
          {nome && <span className="portao-nome">{nome}</span>}
        </p>
        <p className="portao-linha">
          {destrancado ? '// acesso liberado' : '// destrancando'}
        </p>
      </div>
    </div>,
    document.body,
  );
}
