import { useState } from 'react';
import { Lock, Unlock, ShieldAlert, KeyRound, RotateCcw } from 'lucide-react';

import DiscoDoCofre from './DiscoDoCofre';
import ConfirmModal from '../ui/ConfirmModal';
import {
  MINIMO_DO_CODIGO, abrirCofre, cofreArmado, conferirCodigo, definirCodigo,
  esquecerCodigo,
} from '../../lib/cofre';

/**
 * A tela do COFRE, na frente do painel do Fundador.
 *
 * ── O que ela é, dito na própria tela ───────────────────────────────────────
 *
 * Cenográfica. A regra do projeto é que "está seguro" nunca se escreve sem
 * evidência (§1.1), e a versão pior desse erro é o site **parecer** protegido
 * para quem o opera. Por isso o aviso não está só no código: está embaixo do
 * campo, onde o dono lê toda vez.
 *
 * A justificativa completa — inclusive de quais ameaças ele protege e de quais
 * não protege — está em `lib/cofre.js`.
 *
 * ── Dois modos, e o primeiro só acontece uma vez por aparelho ───────────────
 *
 *     definir ..... este navegador ainda não tem código
 *     abrir ....... tem, e está pedindo
 */
export default function CofreDoFundador({ aoAbrir }) {
  const [modo, setModo] = useState(() => (cofreArmado() ? 'abrir' : 'definir'));
  const [codigo, setCodigo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [girando, setGirando] = useState(false);
  const [confirmandoReset, setConfirmandoReset] = useState(false);

  /**
   * A animação roda ANTES de liberar, e é ela que dá sentido ao cofre — mas
   * tem teto (§0.3): 900 ms cravados, sem esperar evento nenhum. Enfeite que
   * depende de algo que pode não vir vira porta trancada.
   */
  function destravar() {
    setGirando(true);
    setTimeout(() => { abrirCofre(); aoAbrir(); }, 900);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');

    if (modo === 'definir') {
      if (codigo !== confirmacao) { setErro('Os dois códigos não são iguais.'); return; }
      const { erro: falha } = await definirCodigo(codigo);
      // Nunca em silêncio: sem `crypto.subtle` ou sem armazenamento, o cofre
      // não se arma, e a tela diz por quê em vez de fingir que armou.
      if (falha) { setErro(falha); return; }
      destravar();
      return;
    }

    if (await conferirCodigo(codigo)) { destravar(); return; }
    setErro('Código incorreto.');
    setCodigo('');
  }

  /**
   * Esquecer o código — a INVERSA, e ela precisa estar ALCANÇÁVEL.
   *
   * O §5 pede a inversa de toda ação de estado, e pede junto "quem pode
   * executá-la". Uma função exportada que nenhuma tela chama não cumpre isso:
   * o dono que esquecesse o código ficaria sem o painel naquele navegador até
   * saber abrir o DevTools — uma tranca cenográfica trancando de verdade, que é
   * a pior combinação possível.
   *
   * Não é brecha: como o cofre não guarda permissão nenhuma, apagar daqui não
   * abre porta que já não estivesse aberta. Quem chega nesta tela já passou pela
   * checagem de cargo, que é a que vale.
   */
  function reiniciarCofre() {
    esquecerCodigo();
    setConfirmandoReset(false);
    setModo('definir');
    setCodigo('');
    setErro('');
  }

  const definindo = modo === 'definir';

  return (
    <div className="max-w-md mx-auto pt-10 pb-16 text-center">
      <DiscoDoCofre girando={girando} />

      <h1 className="font-display text-sm tracking-widest uppercase text-orange-400 mt-6">
        {definindo ? 'Criar o código do cofre' : 'Cofre do Fundador'}
      </h1>
      <p className="text-xs font-mono text-gray-500 mt-2 px-4">
        {definindo
          ? 'Este navegador ainda não tem um código. Escolha um agora.'
          : 'Digite o código para abrir o painel.'}
      </p>

      <form onSubmit={enviar} className="card p-6 mt-6 space-y-3 text-left">
        <label className="block">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
            Código
          </span>
          <div className="relative mt-1.5">
            <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="password" autoFocus autoComplete="off" value={codigo}
              disabled={girando}
              onChange={(e) => setCodigo(e.target.value)}
              className="input w-full pl-9" placeholder="••••••"
            />
          </div>
        </label>

        {definindo && (
          <label className="block">
            <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
              Repita o código
            </span>
            <div className="relative mt-1.5">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="password" autoComplete="off" value={confirmacao}
                disabled={girando}
                onChange={(e) => setConfirmacao(e.target.value)}
                className="input w-full pl-9" placeholder="••••••"
              />
            </div>
            <span className="block text-[11px] font-mono text-gray-600 mt-1">
              mínimo {MINIMO_DO_CODIGO} caracteres
            </span>
          </label>
        )}

        {erro && (
          <p role="alert" className="text-xs font-mono text-red-400">{erro}</p>
        )}

        <button type="submit" disabled={girando || codigo.length < MINIMO_DO_CODIGO}
          className="cofre-botao w-full py-2.5 rounded text-sm font-display tracking-widest uppercase flex items-center justify-center gap-2">
          {girando
            ? <><Unlock size={14} /> Abrindo…</>
            : <><Lock size={14} /> {definindo ? 'Criar e abrir' : 'Abrir'}</>}
        </button>
      </form>

      {!definindo && !girando && (
        <button type="button" onClick={() => setConfirmandoReset(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-mono text-gray-600 hover:text-gray-400 transition-colors">
          <RotateCcw size={12} /> Esqueci o código deste navegador
        </button>
      )}

      {confirmandoReset && (
        <ConfirmModal
          title="Esquecer o código deste navegador"
          icon={RotateCcw}
          accent="orange"
          message={'O código guardado aqui será apagado e você vai criar um novo agora. '
            + 'Isso vale só neste navegador — os outros aparelhos continuam com o código deles. '
            + 'Nenhuma permissão sua muda: o cofre é uma tranca de tela.'}
          confirmLabel="Apagar e criar outro"
          confirmIcon={RotateCcw}
          onConfirm={reiniciarCofre}
          onClose={() => setConfirmandoReset(false)}
        />
      )}

      {/* O aviso fica NA TELA, não só no código.
          Um cofre que parece proteger e não protege é pior do que cofre nenhum:
          ele muda o comportamento de quem confia nele. */}
      <div className="flex gap-2 items-start text-left mt-5 px-1">
        <ShieldAlert size={14} className="text-gray-600 shrink-0 mt-0.5" />
        <p className="text-[11px] font-mono text-gray-600 leading-relaxed">
          Esta tranca é <strong className="text-gray-500">visual</strong> e vale
          só neste navegador — ela segura quem senta na sua frente, não quem
          tem a sessão. O que protege o painel de verdade são as regras do
          banco de dados, e elas não dependem desta tela.
        </p>
      </div>
    </div>
  );
}
