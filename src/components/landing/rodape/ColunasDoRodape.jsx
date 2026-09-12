import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Info, LogIn, ShieldQuestion, ShieldCheck, Scale, Mail, FileText } from 'lucide-react';
// Marca vem do `react-icons/fa6`, não do lucide (§4 da convenção de UI) — e o
// lucide nem tem mais `Github`, ele saiu do pacote junto com os outros ícones
// de marca.
import { FaGithub } from 'react-icons/fa6';
import { SECOES, alvoDaSecao } from '../secoesDaLanding';
import { colunaDoRodape, staggerContainer, VIEWPORT } from '../../../lib/landingMotion';

/**
 * As três colunas de navegação do rodapé.
 *
 * ── A lista de seções não é escrita aqui ────────────────────────────────────
 *
 * Ela vem de `secoesDaLanding.js`, a mesma que alimenta a faixa do topo. Rodapé
 * com lista própria é o caso clássico de cópia que diverge (§4).
 *
 * ── `[12/09]` Eram QUATRO colunas e ficaram três ────────────────────────────
 *
 * A primeira era a marca + a descrição do site, espremida numa coluna de um
 * quarto ao lado dos links. Ela subiu para a `AssinaturaDoRodape`, onde tem
 * espaço e é o assunto — que é o pedido do dono de *"uma pequena área de
 * assinatura visual antes das colunas de navegação"*.
 *
 * O que sobra aqui é só navegação, e três colunas de largura igual leem melhor
 * do que três apertadas ao lado de um bloco de texto.
 *
 * ── A cascata, e por que ela é curta ────────────────────────────────────────
 *
 * `0.08` entre colunas: o suficiente para o olho perceber ordem, curto o
 * bastante para não virar apresentação de slides. Elas entram DEPOIS da
 * assinatura porque a hierarquia do epílogo é assinatura → informação →
 * créditos, e a animação é o que torna essa ordem perceptível em vez de apenas
 * verdadeira no HTML.
 */

function Coluna({ titulo, children }) {
  return (
    <motion.div variants={colunaDoRodape} className="space-y-3">
      <h3 className="font-display text-xs tracking-widest uppercase text-gray-500">{titulo}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </motion.div>
  );
}

function ItemDeLink({ para, href, icone: Icone, children }) {
  // A microinteração é o ÍCONE deslizando, não o texto: mover o rótulo faz a
  // coluna inteira parecer instável quando o ponteiro passa por vários links em
  // sequência. O ícone é pequeno e o deslocamento fica contido nele.
  // `group` no `li` e não no link: assim a área que dispara é a linha toda.
  const classe = 'group inline-flex items-center gap-2 text-sm font-mono text-gray-400 '
    + 'hover:text-neon-green transition-colors duration-200';
  const icone = Icone && (
    <Icone
      size={13}
      className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
    />
  );
  return (
    <li>
      {para
        ? <Link to={para} className={classe}>{icone}{children}</Link>
        : <a href={href} className={classe}>{icone}{children}</a>}
    </li>
  );
}

export default function ColunasDoRodape() {
  return (
    <motion.div
      variants={staggerContainer(0.08)}
      initial="initial"
      whileInView="animate"
      viewport={VIEWPORT}
      className="max-w-5xl mx-auto px-4 md:px-6 pb-12 grid gap-10 sm:grid-cols-2 md:grid-cols-3"
    >
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
    </motion.div>
  );
}
