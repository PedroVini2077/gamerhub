import { useNavigate } from 'react-router-dom';
import { Plus, Image, Video, Mic } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
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
 */
export default function LinhaDePublicar() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

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
    <div data-publicar="linha" className="card flex items-center gap-3 p-3">
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
  );
}
