import AssinaturaDoRodape from './rodape/AssinaturaDoRodape';
import ColunasDoRodape from './rodape/ColunasDoRodape';
import CreditosDoRodape from './rodape/CreditosDoRodape';

/**
 * O rodapé — e ele NÃO é só da landing, apesar do nome.
 *
 * ── Onde ele aparece, e por que isso decide o que pode mudar aqui ───────────
 *
 * Quatro lugares: a landing, a `/sobre`, e as páginas de conteúdo legal
 * (`/privacidade`, `/regras`, `/termos`) pelo `PaginaDeConteudo`. Qualquer
 * mudança aqui aparece nos quatro — e foi o que decidiu **não** mexer no
 * `border-t`: na landing ele parece redundante depois de a última arte
 * dissolver, mas nas outras três ele é o único separador que existe.
 *
 * ── `[12/09]` Por que ele foi reorganizado ──────────────────────────────────
 *
 * Pedido do dono: *"pense no footer como o epílogo da experiência… a sensação
 * de 'a experiência terminou, mas o universo do GamerHub continua aqui'"*, com
 * dois limites que valem palavra por palavra — *"não quero outro espetáculo
 * visual"* e *"menos espetáculo, mais assinatura"*.
 *
 * A estrutura antiga era **quatro colunas iguais**, e a primeira delas era a
 * marca espremida num quarto da largura, ao lado dos links. Isso dá à
 * identidade o mesmo peso visual de uma lista de links — que é o oposto de
 * assinatura.
 *
 * A hierarquia agora tem três degraus, e cada um é um arquivo:
 *
 * | | o quê | como entra |
 * | --- | --- | --- |
 * | `AssinaturaDoRodape` | a marca, a tagline e os traços que saem dela | 22 px, 0,85 s |
 * | `ColunasDoRodape` | as três colunas de navegação | 12 px, em cascata de 0,08 |
 * | `CreditosDoRodape` | créditos e o voltar ao início | só opacidade |
 *
 * **As três entradas desaceleram na ordem**, de propósito: o rodapé inteiro é
 * uma frenagem depois do ritmo da landing, e a última coisa a aparecer quase
 * não se move. O `fadeUpReveal` das cenas desloca 56 px — usá-lo aqui daria ao
 * epílogo o mesmo impulso do que veio antes.
 *
 * ── Por que três arquivos e não um ──────────────────────────────────────────
 *
 * O arquivo tinha 127 linhas e a reforma o levaria a ~290 — dentro do limite de
 * 300 do §4, e exatamente o tipo de arquivo que passa dele na próxima mudança.
 * A regra manda entregar dividido quando eu SEI que vou fazer crescer, em vez
 * de criar a dívida para pagar depois.
 *
 * O corte é por responsabilidade, não por tamanho: identidade, navegação e
 * créditos mudam por motivos diferentes e em momentos diferentes.
 */
export default function LandingFooter() {
  return (
    <footer className="border-t border-dark-600 mt-10">
      <AssinaturaDoRodape />
      <ColunasDoRodape />
      <CreditosDoRodape />
    </footer>
  );
}
