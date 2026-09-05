/**
 * O interruptor liga/desliga do site.
 *
 * ── `[05/09]` Ele vivia dentro do `Settings.jsx`, e saiu de lá ──────────────
 *
 * A saída começou por tamanho (§4), mas o que ele estava escondendo era pior
 * que o tamanho: **um botão sem nome acessível e sem estado acessível**.
 *
 * Para quem usa leitor de tela, o interruptor de "notificar quando curtirem"
 * era literalmente *"botão"*. Sem `aria-pressed`, não havia como saber se ele
 * estava ligado — a informação existia **só na cor**, e cor não é lida. É a
 * regra de acessibilidade do `CLAUDE.md` §4 na letra: *"toggle precisa de
 * `aria-pressed`"*.
 *
 * Não dava para consertar sem tirar daqui, porque o rótulo depende de quem usa:
 * quem monta o interruptor é quem sabe o que ele liga. Daí o `rotulo`
 * obrigatório.
 *
 * `type="button"` porque o padrão do HTML é `submit`: hoje ele não está dentro
 * de nenhum `<form>`, e no dia em que estiver, clicar para ligar uma preferência
 * enviaria o formulário inteiro.
 *
 * @param {boolean} value    ligado?
 * @param {Function} onChange recebe o valor NOVO
 * @param {string} rotulo    o que este interruptor liga — vira o nome acessível
 */
export default function Toggle({ value, onChange, rotulo }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-label={rotulo}
      style={{
        position: 'relative', width: 44, height: 24, borderRadius: 12,
        background: value ? '#39ff14' : '#2e2e3e', border: 'none',
        cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'white', transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  );
}
