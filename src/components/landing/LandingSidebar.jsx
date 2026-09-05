import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Info, LogIn, ShieldCheck, Scale, ShieldOff, Mail, FileText } from 'lucide-react';
import { SECOES, alvoDaSecao } from './secoesDaLanding';

/**
 * A navegação lateral da landing.
 *
 * ── Por que gaveta, e não uma coluna fixa ───────────────────────────────────
 *
 * O dono pediu "uma side bar com algumas abas". Numa landing, uma coluna fixa
 * disputaria espaço justamente com o Hero, que é a primeira impressão — e no
 * celular, que é onde ele testa, não haveria largura para as duas coisas.
 *
 * Uma gaveta que abre pelo menu resolve os dois: some quando não é chamada, e
 * ocupa a tela inteira quando é.
 *
 * ── As abas ─────────────────────────────────────────────────────────────────
 *
 * As seções da página vêm de `secoesDaLanding.js` — a mesma lista da faixa do
 * topo e do rodapé. "Sobre" e "Entrar" são fixas: uma é o projeto, a outra é o
 * que a landing existe para oferecer.
 */
export default function LandingSidebar({ aberta, aoFechar }) {
  // `Escape` fecha, e o corpo para de rolar enquanto a gaveta está aberta —
  // sem isso a página de trás rola junto e a gaveta parece quebrada.
  useEffect(() => {
    if (!aberta) return undefined;
    const aoTeclar = (e) => { if (e.key === 'Escape') aoFechar(); };
    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <button
        aria-label="Fechar menu"
        onClick={aoFechar}
        className="absolute inset-0 w-full h-full"
        style={{ background: 'rgba(0,0,0,0.92)' }}
      />

      <nav
        aria-label="Navegação do site"
        className="relative ml-auto h-full w-72 max-w-[85vw] bg-dark-800 border-l border-dark-600 p-5 space-y-6 animate-fade-up overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-xs tracking-widest uppercase text-gray-500">
            Navegar
          </span>
          <button
            onClick={aoFechar}
            aria-label="Fechar menu"
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-1">
          {SECOES.map(({ id, rotulo, icone: Icone, cor }) => (
            <li key={id}>
              <a
                href={alvoDaSecao(id)}
                onClick={aoFechar}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
              >
                <Icone size={16} className={cor} />
                {rotulo}
              </a>
            </li>
          ))}
        </ul>

        <div className="border-t border-dark-600 pt-4 space-y-1">
          <Link
            to="/sobre"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <Info size={16} className="text-neon-purple" />
            Sobre o projeto
          </Link>
          {/* `[02/09]` Privacidade fica ao lado do "Sobre" e ANTES do "Entrar":
              a pessoa consegue ler o que acontece com os dados dela antes de
              decidir criar conta, e não depois. */}
          <Link
            to="/privacidade"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <ShieldCheck size={16} className="text-neon-green" />
            Privacidade
          </Link>
          <Link
            to="/regras"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <Scale size={16} className="text-neon-purple" />
            Regras da comunidade
          </Link>
          <Link
            to="/termos"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <FileText size={16} className="text-gray-400" />
            Termos de uso
          </Link>
          {/* `[02/09]` A porta de entrada de quem foi banido, e ela leva ao
              LOGIN de propósito.
              Uma página pública que aceitasse e-mail e respondesse "esta conta
              está banida" seria um ORÁCULO DE ENUMERAÇÃO: qualquer um
              descobriria se um endereço tem conta aqui e se aquela pessoa foi
              punida — dado de terceiro, exposto sem consentimento.
              Entrar resolve isso sem truque: a conta É a prova de identidade, e
              o login continua funcionando para quem está banido (só a
              navegação no site é que não). */}
          <Link
            to="/login"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-400 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <ShieldOff size={16} className="text-red-400" />
            Fui banido — ver meu caso
          </Link>
          {/* `[02/09]` O canal que faltava, e ele NÃO substitui o link acima —
              os dois atendem gente diferente, separada por uma pergunta só:
              **você ainda consegue entrar?**

              Quem consegue vai ao login e vê o motivo, a linha do tempo do
              caso e o recurso na hora. Quem não consegue — perdeu o acesso,
              perdeu o e-mail, nunca criou conta, ou quer exercer um direito de
              LGPD — não tinha via nenhuma até este formulário existir. */}
          <Link
            to="/contato"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-300 hover:bg-dark-700 hover:text-white transition-colors"
          >
            <Mail size={16} className="text-neon-cyan" />
            Não consigo entrar — falar com a equipe
          </Link>
          <Link
            to="/login"
            onClick={aoFechar}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-mono text-neon-green hover:bg-dark-700 transition-colors"
          >
            <LogIn size={16} />
            Entrar ou criar conta
          </Link>
        </div>
      </nav>
    </div>,
    document.body,
  );
}
