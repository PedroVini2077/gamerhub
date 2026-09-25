/**
 * `[25/09]` O VOCABULÁRIO FECHADO da formatação — cor, tamanho e o porquê.
 *
 * ── O pedido, e o risco que ele traz junto ────────────────────────────────
 *
 * O dono pediu um editor de texto rico: *"o site é pra gamers, o usuário pode
 * ter a liberdade de ser criativo, mexer em tamanho, cor, forma"*. Cor e
 * tamanho são a parte que muda a natureza do problema — até aqui, a formatação
 * só escolhia ENTRE ELEMENTOS (negrito, itálico); agora ela escolhe VALORES.
 *
 * ── Por que valor livre estava fora de cogitação ──────────────────────────
 *
 * Guardar `[cor=#ff0000]` e aplicar como `style={{ color: valor }}` parece
 * inofensivo — o React até recusa CSS malformado. Mas o dado passaria a ser
 * uma string que alguém escolheu, viajando até um atributo de estilo, e a
 * defesa seria "o React trata". Isso é proteção acidental (§1.3): funciona por
 * efeito colateral de outra regra, e some no dia em que esse texto for parar
 * num e-mail, num PDF, num `<style>` ou num componente que concatene.
 *
 * Aqui o usuário escolhe um NOME de uma lista fechada, e o nome vira uma
 * classe do Tailwind que já existe. Nenhuma string dele encosta em CSS. Cor
 * inventada não é sanitizada: ela simplesmente **não existe**, e o texto
 * aparece cru — o mapa explícito do §4, sem `else` que chuta.
 *
 * ── Por que ESTAS cores ───────────────────────────────────────────────────
 *
 * São as quatro do neon da marca (`tailwind.config.js`) mais branco e cinza.
 * Não é limitação de preguiça: paleta fechada é o que impede o feed de virar
 * arco-íris ilegível, e mantém o texto de qualquer post legível no fundo
 * escuro — coisa que um seletor de cor livre não garante.
 */

/** Cor do texto: nome → classe que JÁ existe no Tailwind do projeto. */
export const CORES = {
  verde:  { classe: 'text-neon-green',  rotulo: 'Verde',  amostra: '#39ff14' },
  roxo:   { classe: 'text-neon-purple', rotulo: 'Roxo',   amostra: '#bf00ff' },
  ciano:  { classe: 'text-neon-cyan',   rotulo: 'Ciano',  amostra: '#00ffff' },
  rosa:   { classe: 'text-neon-pink',   rotulo: 'Rosa',   amostra: '#ff0090' },
  branco: { classe: 'text-white',       rotulo: 'Branco', amostra: '#ffffff' },
  cinza:  { classe: 'text-gray-500',    rotulo: 'Cinza',  amostra: '#6b7280' },
};

/**
 * Tamanho do texto. Três degraus, e o teto é deliberado.
 *
 * Sem teto, um post inteiro em `text-6xl` empurra o resto do feed para fora da
 * tela de quem só estava passando — a liberdade de um vira a experiência de
 * todos. `enorme` é o maior que ainda convive com o card.
 */
export const TAMANHOS = {
  pequeno: { classe: 'text-xs',  rotulo: 'Pequeno' },
  grande:  { classe: 'text-lg',  rotulo: 'Grande'  },
  enorme:  { classe: 'text-2xl', rotulo: 'Enorme'  },
};

/*
 * `[25/09]` Os degraus eram `text-xs`/`text-base`/`text-xl`, e o do meio quase
 * não se via: o corpo do post é `text-sm` (14px) e `text-base` é 16px. Aplicar
 * "Grande" e ver dois pixels de diferença é indistinguível de não ter
 * funcionado — foi parte do que o dono relatou.
 *
 * Agora 12 / 18 / 24 contra os 14 do corpo: cada degrau se vê.
 */

/** O nome é conhecido? Usado pelo analisador e pela trava. */
export const corValida = (nome) => Object.hasOwn(CORES, nome);
export const tamanhoValido = (nome) => Object.hasOwn(TAMANHOS, nome);

/**
 * As marcações que o editor sabe aplicar, e como.
 *
 * `envolve` é o que a barra de ferramentas usa para embrulhar a seleção. Fica
 * aqui, junto do vocabulário, para não existir uma segunda lista do que o
 * editor oferece — divergir dela seria oferecer botão que o analisador não
 * entende, e o resultado apareceria como lixo na tela (§4, fonte única).
 */
export const MARCACOES = {
  negrito:     { abre: '**',  fecha: '**',  rotulo: 'Negrito' },
  italico:     { abre: '*',   fecha: '*',   rotulo: 'Itálico' },
  sublinhado:  { abre: '__',  fecha: '__',  rotulo: 'Sublinhado' },
  tachado:     { abre: '~~',  fecha: '~~',  rotulo: 'Riscado' },
};

/** `[cor=verde]texto[/cor]` — a forma que o analisador reconhece. */
export const envolverCor = (nome) => ({ abre: `[cor=${nome}]`, fecha: '[/cor]' });
export const envolverTamanho = (nome) => ({ abre: `[tamanho=${nome}]`, fecha: '[/tamanho]' });

/**
 * O que a barra de ferramentas oferece em cada lugar.
 *
 * Pedido do dono em 25/09: *"nem tudo que tem na hora de postar precisa ter
 * nos comentários"*. Comentário é conversa, não publicação — cor e tamanho ali
 * transformariam a discussão numa disputa de quem grita mais alto, e o post
 * de alguém deixaria de se distinguir da resposta a ele.
 *
 * Moram aqui, e não no componente, por dois motivos: é o mesmo arquivo do
 * vocabulário que eles recortam, e constante exportada de arquivo de
 * componente quebra o fast refresh do Vite (o lint avisa).
 */
export const RECURSOS_COMPLETOS = [
  'negrito', 'italico', 'sublinhado', 'tachado', 'cor', 'tamanho', 'lista', 'citacao', 'link',
];
export const RECURSOS_DE_COMENTARIO = ['negrito', 'italico', 'tachado', 'link'];
