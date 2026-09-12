import { motion, useReducedMotion } from 'framer-motion';

/**
 * A CORTINA que descobre uma cena — três aberturas diferentes, um mecanismo só.
 *
 * ── O problema que ela resolve `[12/09]` ────────────────────────────────────
 *
 * Ordem do dono: *"não quero cinco fades iguais"*. A saída óbvia seria escrever
 * cinco variantes de `opacity`+`y` com números diferentes — e isso continuaria
 * sendo cinco fades, só que desafinados.
 *
 * Cortina é outra coisa: a cena já está inteira ali, **coberta**, e o que se
 * move é o que a cobre. Ler como "descobrir" em vez de "aparecer" muda a
 * sensação, e cada eixo de abertura conta uma coisa diferente:
 *
 * | eixo | o que ele diz | onde é usado |
 * | --- | --- | --- |
 * | `centro` | uma cortina que abre — algo vai começar | Lives (*"está acontecendo agora"*) |
 * | `varredura` | um preenchimento da esquerda para a direita | Ranks (*"eu estou evoluindo"*) |
 * | `sobe` | o chão se abrindo para você entrar | o fecho, o CTA |
 *
 * A escolha do eixo não é decoração: é a regra 14 do prompt dele — *"qual
 * movimento representa essa funcionalidade?"*.
 *
 * ── Por que painel escalando, e NÃO `clip-path` ─────────────────────────────
 *
 * `clip-path` animado repinta a cada quadro sobre uma imagem que ocupa a faixa
 * inteira, e repaint contínuo é o travamento clássico de celular. Um retângulo
 * opaco com `scaleX`/`scaleY` faz o mesmo desenho **no compositor**, de graça.
 *
 * Só funciona porque o fundo da página é exatamente a cor do painel
 * (`bg-dark-900`): a cortina não "some", ela vira o fundo.
 *
 * ── Acessibilidade ──────────────────────────────────────────────────────────
 *
 * Com `prefers-reduced-motion` a cortina não é montada. Não há estado
 * intermediário para preservar: sem ela, a cena simplesmente já está visível,
 * que é exatamente o fim da animação.
 */
const ABERTURAS = {
  centro: [
    { origem: 'right center', escala: 'scaleX', classe: 'left-0 top-0 h-full w-1/2' },
    { origem: 'left center', escala: 'scaleX', classe: 'right-0 top-0 h-full w-1/2' },
  ],
  varredura: [
    { origem: 'right center', escala: 'scaleX', classe: 'inset-0' },
  ],
  sobe: [
    { origem: 'top center', escala: 'scaleY', classe: 'inset-0' },
  ],
};

export default function CortinaDaCena({ eixo = 'centro', duracao = 0.9 }) {
  const menosMovimento = useReducedMotion();
  if (menosMovimento) return null;

  // Mapa EXPLÍCITO: eixo desconhecido devolve `undefined` e estoura aqui, em
  // vez de cair num padrão silencioso que cobriria a cena para sempre (§4).
  const paineis = ABERTURAS[eixo];
  if (!paineis) throw new Error(`CortinaDaCena: eixo desconhecido "${eixo}"`);

  return (
    <>
      {paineis.map((painel, i) => (
        <motion.div
          key={i}
          aria-hidden
          className={`absolute ${painel.classe} bg-dark-900 pointer-events-none z-20`}
          style={{ transformOrigin: painel.origem, willChange: 'transform' }}
          initial={{ [painel.escala]: 1 }}
          whileInView={{ [painel.escala]: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: duracao, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
        />
      ))}
    </>
  );
}
