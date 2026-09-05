import { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { InputWrap } from '../auth/InputWrap';

/**
 * O campo de senha do site inteiro — com o olho de mostrar/ocultar.
 *
 * ── `[05/09]` Os dois problemas que ele resolve ─────────────────────────────
 *
 * **1. O olho só existia no celular.** Relato do dono: *"aquele olho pra mostrar
 * senha ou não? só aparece no celular, no PC não existe, consegue padronizar
 * isso?"*. Aquele olho não era do site: é o botão nativo que alguns navegadores
 * de Android desenham dentro de campo de senha. No Chrome de computador ele não
 * existe, e no Firefox e no Safari não existe em lugar nenhum — então metade das
 * pessoas tinha o recurso e a outra metade não, sem ninguém ter decidido isso.
 *
 * **2. Campo branco.** No cofre do Fundador o campo saiu branco, com o texto
 * preto. A causa era minha: `className="input"` — uma classe que **não existe**
 * neste projeto (a de verdade é `.input-gamer`). Sem estilo, o `<input>` cai no
 * padrão do navegador, que no Android é caixa branca. Um componente único mata
 * essa classe de erro: não há mais nome de classe para digitar errado.
 *
 * ── Por que um olho NOSSO, e não deixar o nativo ────────────────────────────
 *
 * Porque o nativo não é padronizável: ele aparece onde o navegador quiser, com o
 * desenho que o navegador quiser, e não dá para alinhar com a paleta. O CSS
 * (`componentes.css`) esconde o nativo justamente para não ficarem **dois**
 * olhos no mesmo campo no Android.
 *
 * ── O estado NÃO é lembrado, e isso é de propósito ──────────────────────────
 *
 * Cada campo começa oculto, sempre. Guardar "esta pessoa gosta de ver a senha"
 * faria a senha aparecer sozinha na próxima vez — possivelmente na frente de
 * outra pessoa, que é exatamente o risco que o campo mascarado existe para
 * cobrir.
 */
export default function CampoDeSenha({
  valor, aoMudar, rotulo, placeholder = '••••••••',
  Icone = Lock, autoFocus = false, autoComplete = 'current-password',
  desabilitado = false, aoTeclar, id, erro = false,
}) {
  const [visivel, setVisivel] = useState(false);
  const idAutomatico = useId();
  const idDoCampo = id || idAutomatico;

  return (
    <div>
      {rotulo && (
        <label htmlFor={idDoCampo}
          className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
          {rotulo}
        </label>
      )}

      <InputWrap erro={erro}>
        <span className="pl-3 pr-2 text-gray-500 shrink-0"><Icone size={14} /></span>

        <input
          id={idDoCampo}
          type={visivel ? 'text' : 'password'}
          className="campo-de-senha flex-1 bg-transparent py-2.5 text-sm text-white placeholder-gray-600 outline-none font-body min-w-0"
          placeholder={placeholder}
          value={valor}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          disabled={desabilitado}
          onChange={(e) => aoMudar(e.target.value)}
          onKeyDown={aoTeclar}
        />

        {/* `type="button"` é obrigatório: dentro de um `<form>`, o padrão de um
            botão é SUBMIT — clicar no olho enviaria o formulário. */}
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          disabled={desabilitado}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          className="px-3 py-2.5 text-gray-500 hover:text-gray-300 transition-colors shrink-0 disabled:opacity-40"
        >
          {visivel ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </InputWrap>
    </div>
  );
}
