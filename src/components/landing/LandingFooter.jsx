import { Link } from 'react-router-dom';
import { Zap, Info, LogIn, ShieldQuestion, ShieldCheck, Scale, Mail, FileText } from 'lucide-react';
// Marca vem do `react-icons/fa6`, não do lucide (§4 da convenção de UI) — e o
// lucide nem tem mais `Github`, ele saiu do pacote junto com os outros ícones
// de marca.
import { FaGithub } from 'react-icons/fa6';
import { SECOES, alvoDaSecao } from './secoesDaLanding';

/**
 * O rodapé da landing.
 *
 * ── Por que ele cresceu ─────────────────────────────────────────────────────
 *
 * Pedido do dono: *"queria fazer um footer bonitão"*, e a decisão dele foi
 * começar pela landing (camada 1 — ver `CLAUDE.md` §0.4), avaliando depois uma
 * versão para o site logado, que tem barra lateral e cabeçalho próprios e onde
 * rodapé grande disputa espaço com o conteúdo.
 *
 * O que existia eram duas linhas: a marca e "v1.0 — Powered by Supabase". Não
 * levava a lugar nenhum, e num site que quer crescer o rodapé é a segunda
 * navegação — o lugar onde quem rolou até o fim procura o que não achou.
 *
 * ── A lista de seções não é escrita aqui ────────────────────────────────────
 *
 * Ela vem de `secoesDaLanding.js`, a mesma que alimenta a faixa do topo. Rodapé
 * com lista própria é o caso clássico de cópia que diverge (§4).
 */

const ANO = new Date().getFullYear();

function Coluna({ titulo, children }) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-xs tracking-widest uppercase text-gray-500">{titulo}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function ItemDeLink({ para, href, icone: Icone, children }) {
  const classe = 'inline-flex items-center gap-2 text-sm font-mono text-gray-400 '
    + 'hover:text-neon-green transition-colors';
  return (
    <li>
      {para
        ? <Link to={para} className={classe}>{Icone && <Icone size={13} />}{children}</Link>
        : <a href={href} className={classe}>{Icone && <Icone size={13} />}{children}</a>}
    </li>
  );
}

export default function LandingFooter() {
  return (
    <footer className="border-t border-dark-600 mt-10">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="space-y-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 6px #39ff14)' }} />
            <span className="font-display font-bold text-neon-green tracking-wider">GAMER</span>
            <span className="font-display font-bold text-white tracking-wider">HUB</span>
          </div>
          <p className="text-xs text-gray-500 font-body leading-relaxed">
            Feed colaborativo, mural, lives com chat ao vivo, keys grátis e ranks
            por XP — feito pra quem vive games.
          </p>
        </div>

        <Coluna titulo="O que tem aqui">
          {SECOES.map(({ id, rotulo }) => (
            // `para` e nao `href`: este rodape aparece na landing E na
            // pagina "Sobre". Uma ancora relativa (`#feed`) so existe na
            // landing — na Sobre ela apontava para uma secao inexistente e o
            // clique nao fazia nada. O objeto com `pathname` leva para a
            // landing E rola ate a secao, das duas paginas, sem recarregar.
            <ItemDeLink key={id} para={{ pathname: '/', hash: alvoDaSecao(id) }}>
              {rotulo}
            </ItemDeLink>
          ))}
        </Coluna>

        <Coluna titulo="O projeto">
          <ItemDeLink para="/sobre" icone={Info}>Sobre o GamerHub</ItemDeLink>
          <ItemDeLink para="/privacidade" icone={ShieldCheck}>Privacidade</ItemDeLink>
          <ItemDeLink para="/regras" icone={Scale}>Regras da comunidade</ItemDeLink>
          <ItemDeLink para="/termos" icone={FileText}>Termos de uso</ItemDeLink>
          <ItemDeLink
            href="https://github.com/PedroVini2077/gamerhub"
            icone={FaGithub}
          >
            Código no GitHub
          </ItemDeLink>
        </Coluna>

        <Coluna titulo="Sua conta">
          <ItemDeLink para="/login" icone={LogIn}>Entrar ou criar conta</ItemDeLink>
          {/* `[02/09]` Estas duas linhas dividem as pessoas por uma pergunta
              só: **você ainda consegue entrar?**

              Antes elas eram duas mensagens quase iguais ("Conta bloqueada?" e
              "Fui banido — ver meu caso") levando as duas ao MESMO lugar, o
              login. Isso obrigava quem tinha perdido o acesso a descobrir
              sozinho que o login não ia resolver o caso dela.

              Quem CONSEGUE entrar deve ir ao login, e não ao formulário: a
              tela de banimento mostra o motivo, a linha do tempo do caso e o
              recurso na hora. O formulário levaria dias e chegaria ao mesmo
              lugar. Quem NÃO consegue entrar não tem essa porta, e é para ela
              que o /contato existe. */}
          <ItemDeLink para="/login" icone={ShieldQuestion}>Fui banido — ver meu caso</ItemDeLink>
          <ItemDeLink para="/contato" icone={Mail}>Não consigo entrar na conta</ItemDeLink>
        </Coluna>
      </div>

      <div className="border-t border-dark-700">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-600 font-mono">
            © {ANO} GamerHub — projeto independente, feito por um gamer.
          </p>
          <p className="text-xs text-gray-700 font-mono">
            // construído com React, Supabase e muito café
          </p>
        </div>
      </div>
    </footer>
  );
}
