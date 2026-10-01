import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Image, Video, Mic } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useNaTela } from '../../hooks/useNaTela';
import { suspendedUntil } from '../../lib/roles';
import Avatar from '../ui/Avatar';

/**
 * `[26/09]` A LINHA no topo do feed — o que sobrou do compositor.
 *
 * ── O pedido, e ele pediu as DUAS coisas ──────────────────────────────────
 *
 * *"pensei em limpar essa parte de cima do feed e adicionar um botão +, tipo
 * Instagram e TikTok"* — e depois: *"eu colocaria essa linha e acrescentaria o
 * botão + visível em algum lugar também"*.
 *
 * Então são as duas: a linha inteira é clicável (é o alvo grande, e é o gesto
 * que a pessoa já conhece de outras redes) **e** o `+` existe como botão de
 * verdade, com nome acessível próprio.
 *
 * ── Por que não é um `<button>` com um `<button>` dentro ──────────────────
 *
 * Porque botão dentro de botão é HTML inválido e o navegador desmonta a árvore
 * de um jeito imprevisível. Aqui o alvo grande é um `<button>` que ocupa a
 * linha, e o `+` é **irmão** dele — os dois vão para o mesmo lugar, e o leitor
 * de tela anuncia dois destinos claros em vez de um aninhamento confuso.
 *
 * ── O nome da ação é "Criar post", em todo lugar ──────────────────────────
 *
 * Aqui e na barra lateral. O verbo **Publicar** pertence ao botão que ENVIA, no
 * compositor — dois botões com o mesmo nome acessível na mesma tela é defeito
 * de acessibilidade, e foi o que reprovou o CI em 26/09.
 *
 * ── Os três ícones não são enfeite ────────────────────────────────────────
 *
 * Eles dizem, sem texto, o que existe do outro lado: imagem, vídeo e áudio. A
 * linha antiga era um formulário inteiro; sem esse resumo, quem chega passa a
 * achar que o feed só aceita texto.
 *
 * ── `[01/10]` O ATALHO FLUTUANTE, e por que ele mora AQUI ─────────────────
 *
 * A lacuna que ele apontou: no celular a barra lateral fica fechada, então,
 * assim que esta linha sai da viewport, **não sobra nenhum caminho para
 * publicar** até a pessoa rolar tudo de volta. No desktop isso não acontece —
 * a barra está sempre aberta e o botão dela está sempre ali.
 *
 * O atalho é renderizado por este componente, e não por um irmão no `Home`,
 * por um motivo que não é de arrumação: **as regras de quem pode publicar já
 * estão aqui**. Os dois `return null` acima — sem conta e conta suspensa —
 * governam o atalho de graça. Em qualquer outro lugar eles teriam de ser
 * reescritos, e duas cópias da mesma regra divergem (§4).
 *
 * E o alvo que decide se o atalho aparece é esta própria linha, que está
 * logo abaixo: um `ref` no mesmo componente, não um `ref` atravessando
 * fronteira.
 *
 * O recorte de "celular" é `md:`, **o mesmo ponto em que a barra lateral deixa
 * de ser gaveta** (`md:translate-x-0`). Não é um valor escolhido: é a condição
 * literal do problema — mostrar o atalho exatamente onde a barra não está.
 */
export default function LinhaDePublicar() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const linha = useRef(null);
  // Começa `true` de propósito: sem isso o atalho pisca no primeiro quadro,
  // com a linha ainda na tela. O porquê está em `useNaTela`.
  const linhaNaTela = useNaTela(linha);

  if (!user) return null;

  // Quem está suspenso não publica — e a tela diz isso no lugar de oferecer um
  // caminho que o banco vai recusar. Mesma regra dos botões do painel editorial.
  const suspenso = suspendedUntil(profile);
  if (suspenso) return null;

  const ir = () => navigate('/publicar');

  return (
    // `data-publicar` é o gancho dos roteiros de navegador. Eles esperavam o
    // `#post-title` do compositor no feed para provar "sessão válida + perfil
    // carregado + conta não suspensa"; o compositor saiu daqui, e esta linha
    // prova as mesmas três coisas — ela devolve `null` sem usuário e `null`
    // para quem está suspenso. Gancho no componente, não seletor de CSS
    // (`DECISOES-FERRAMENTAL.md`, 29/08).
    <>
    <div ref={linha} data-publicar="linha" className="card flex items-center gap-3 p-3">
      <Avatar profile={profile} size={36} />

      <button
        onClick={ir}
        className="flex-1 min-w-0 rounded-full border border-dark-400 bg-dark-700 px-4 py-2.5
                   text-left text-sm text-gray-500 transition-colors
                   hover:border-neon-green/40 hover:text-gray-300"
      >
        No que você está pensando?
      </button>

      <div className="hidden sm:flex items-center gap-2 text-gray-600">
        <Image size={15} aria-hidden="true" />
        <Video size={15} aria-hidden="true" />
        <Mic size={15} aria-hidden="true" />
      </div>

      <button
        onClick={ir}
        aria-label="Criar post"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   bg-neon-green/10 text-neon-green transition-colors
                   hover:bg-neon-green/20"
      >
        <Plus size={18} />
      </button>
    </div>

    {/* Só existe no DOM quando a linha saiu da tela — e não "existe escondido
        por CSS". Atalho montado e invisível seria conteúdo que o leitor de
        tela anuncia sem a pessoa poder usar.

        `z-[15]` fica ABAIXO do véu da barra lateral (`z-20`) de propósito: com
        o menu do celular aberto, o atalho escurece junto e para de receber
        clique, em vez de flutuar por cima do menu. Resolver isso lendo o
        estado da gaveta exigiria passar essa informação por três componentes,
        para um resultado pior. */}
    {!linhaNaTela && (
      <button
        onClick={ir}
        aria-label="Criar post"
        data-publicar="flutuante"
        className="md:hidden fixed bottom-5 right-5 z-[15] flex h-14 w-14
                   items-center justify-center rounded-full border
                   border-neon-green/40 bg-neon-green/15 text-neon-green
                   shadow-lg shadow-black/50 backdrop-blur animate-fade-up
                   transition-colors hover:bg-neon-green/25"
      >
        <Plus size={24} />
      </button>
    )}
    </>
  );
}
