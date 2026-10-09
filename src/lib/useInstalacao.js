import { useState } from 'react';
import { podeInstalar, abrirConvite, estaInstalado } from './conviteDeInstalacao';

/**
 * `[09/10]` A ENTRADA FIXA de instalar, em um lugar só.
 *
 * ── Por que virou hook antes de existir a segunda cópia ───────────────────
 *
 * Ele pediu a mesma entrada no rodapé: *"sabe o footer? faltou o link pra
 * download tbm, como na barra lateral"*. Seriam duas telas com a mesma
 * decisão de três partes — quando aparecer, o que o clique faz, e o que
 * mostrar quando não há convite.
 *
 * O §4 manda extrair na segunda ocorrência, e este projeto já pagou por não
 * extrair: ícones de log, rótulos de cargo, cores de cargo e a regra de
 * bloqueio de login todos divergiram como cópia. Aqui a divergência seria
 * silenciosa — uma tela respeitando o "não" e a outra não, sem nada quebrar.
 *
 * ── As duas perguntas, que continuam diferentes ───────────────────────────
 *
 * | pergunta | quem faz | respeita a decisão guardada? |
 * | --- | --- | --- |
 * | `devoConvidar()` | a FAIXA, que aparece sozinha | **sim** — insistir é o defeito |
 * | `podeInstalar()` | a ENTRADA, que é procurada | **não** — esconder é o defeito |
 *
 * **Este hook é o segundo caso.** Quem rolou até o rodapé ou abriu a gaveta
 * está procurando; esconder dela é esconder a opção de quem pediu.
 *
 * ── A única ausência honesta ──────────────────────────────────────────────
 *
 * `estaInstalado()`. Quem abriu pelo app não vê a entrada porque já está
 * dentro do que ela ofereceria — e essa ausência não é ambígua, ao contrário
 * das outras três que fizeram a 1ª versão sumir em produção.
 */
export function useInstalacao() {
  const [mostrarComo, setMostrarComo] = useState(false);

  /**
   * O clique. Devolve `true` quando o diálogo do navegador foi aberto — a
   * gaveta usa isso para se fechar, e o rodapé ignora porque não fecha nada.
   */
  async function instalar() {
    if (podeInstalar()) {
      // `prompt()` precisa do gesto: ele roda ainda dentro deste clique,
      // ANTES do primeiro `await` lá dentro.
      const desfecho = await abrirConvite();
      if (desfecho !== 'indisponivel') return true;
    }
    // Sem convite do navegador, o certo NÃO é não fazer nada: é dizer onde a
    // opção mora. Foi a ausência silenciosa que fez o recurso parecer um
    // deploy que não chegou.
    setMostrarComo(true);
    return false;
  }

  return {
    aparece: !estaInstalado(),
    instalar,
    mostrarComo,
    fecharComo: () => setMostrarComo(false),
  };
}
