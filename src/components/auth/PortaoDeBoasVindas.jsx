import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.jsx';
import {
  consumirEntradaAgora, ehPrimeiraVez, registrarQueJaEntrou, EVENTO_ENTROU,
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
/** Quanto a tranca fica travada e acesa antes de a porta abrir. */
const DESTRAVE_MS = 420;
/** A abertura das folhas — igual à `transition` do CSS. */
const ABERTURA_MS = 560;

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

  // ABRE, depois de a tranca ter travado e acendido. A pausa é o que faz a
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

  const nome = profile?.username ? `@${profile.username}` : '';
  const titulo = estreia ? 'Seja bem-vindo' : 'Bem-vindo de volta';

  const classes = [
    'portao',
    destrancado ? 'portao-destrancado' : '',
    saindo ? 'portao-abrindo' : '',
  ].filter(Boolean).join(' ');

  return createPortal(
    <div className={classes} role="status" aria-live="polite">
      {/* As duas folhas têm o MESMO fundo e nenhuma borda: fechadas, elas são
          uma superfície só. A divisão só existe a partir do instante em que
          elas se separam — foi essa fenda prematura que o dono reprovou. */}
      <div className="portao-folha portao-folha-a" />
      <div className="portao-folha portao-folha-b" />
      <div className="portao-textura" />

      <div className="portao-nucleo">
        {/* A tranca: três anéis girando em sentidos e velocidades diferentes,
            com o raio da marca no miolo. Ela para e acende quando o site fica
            pronto — é o "destrancou" que dá causa à porta abrir. */}
        <div className="tranca">
          <span className="tranca-anel tranca-anel-externo" />
          <span className="tranca-anel tranca-anel-medio" />
          <span className="tranca-anel tranca-anel-interno" />
          <Zap className="tranca-miolo" size={34} strokeWidth={2.5} aria-hidden="true" />
        </div>

        <div className="portao-texto">
          <p className="portao-titulo">
            {titulo}
            {nome && <span className="portao-nome">{nome}</span>}
          </p>
          <p className="portao-linha">
            {destrancado ? '// acesso liberado' : '// destrancando'}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
