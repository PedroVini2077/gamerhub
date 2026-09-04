import { useMemo } from 'react';

/**
 * O fundo do login e do cadastro — fogo de um lado, gelo do outro.
 *
 * ── De onde veio, e o que foi DESCARTADO da referência ──────────────────────
 *
 * O dono mandou uma arte de luta com dois personagens frente a frente, cortados
 * por um "VS", e disse: *"é só pra tirar essa ambientação seca do login e
 * cadastro"*.
 *
 * O que faz aquela imagem funcionar **não são os personagens**. É a composição:
 * dois campos de cor opostos que se encontram numa fratura carregada, com o
 * formulário em cima da fratura. Tapando as duas figuras, ela continua de pé.
 *
 * Personagem de jogo tem dono — Scorpion e Sub-Zero são da NetherRealm/Warner —,
 * e o projeto já recusou capa de jogo na página "Sobre" pelo mesmo motivo (ver
 * `docs/DECISOES.md`). Aqui o risco seria maior, porque login é a porta do site.
 *
 * ── Por que isto é barato, e por que isso importa nesta tela ────────────────
 *
 * Login e cadastro são a **camada 2** (§0.4): todo mundo que decide ficar passa
 * por aqui. A landing já paga uma cena 3D; esta tela não pode pagar nada
 * parecido. Então: zero imagem, zero biblioteca, só gradiente e elementos
 * animados por `transform`/`opacity` — as duas propriedades que rodam no
 * compositor. O projeto já aprendeu isso do jeito caro, animando `text-shadow`
 * no título da landing (ver `docs/DESEMPENHO.md`).
 *
 * ── A composição muda com o modo, e não é enfeite ───────────────────────────
 *
 * `login` .... a fenda no MEIO, simétrica. São dois lados, e você decide entrar.
 * `register` . um lado DOMINA, a fenda sai do eixo. É escolha de personagem —
 *              o "character selected" que o dono descreveu.
 *
 * O formulário de cadastro é bem mais alto que o de login, e é por isso que o
 * fundo é `fixed`: ele não estica nem reflui quando a página rola.
 */
export default function ArenaDeEntrada({ modo = 'login' }) {
  // Posições fixas, calculadas uma vez. `Math.random()` a cada render faria as
  // partículas saltarem de lugar a cada tecla digitada no formulário.
  const brasas = useMemo(() => semente(14, 7), []);
  const cristais = useMemo(() => semente(14, 23), []);

  // O eixo da fenda. `register` empurra para a direita: sobra mais fogo, que é
  // o lado de quem está sendo escolhido.
  const eixo = modo === 'register' ? '68%' : '50%';

  return (
    <div className="arena" style={{ '--eixo': eixo }} aria-hidden="true">
      <div className="arena-lado arena-fogo" />
      <div className="arena-lado arena-gelo" />

      {brasas.map((p, i) => (
        <span key={`b${i}`} className="arena-particula arena-brasa" style={p} />
      ))}
      {cristais.map((p, i) => (
        <span key={`c${i}`} className="arena-particula arena-cristal" style={p} />
      ))}

      {/* A fenda vem por último para ficar por cima das partículas — é ela que
          separa os dois lados, e partícula passando por cima borraria o corte. */}
      <div className="arena-fenda" />
    </div>
  );
}

/**
 * Gera posições espalhadas de forma determinística.
 *
 * Não usa `Math.random()`: o mesmo fundo em duas abas ficaria diferente sem
 * motivo, e um `useMemo` com random ainda mudaria a cada montagem. O passo é
 * um número primo para os pontos não caírem em coluna.
 */
function semente(quantos, passo) {
  return Array.from({ length: quantos }, (_, i) => ({
    '--x': `${((i * passo) % 40) + 3}%`,
    '--atraso': `${(i * 1.7) % 9}s`,
    '--duracao': `${11 + ((i * 3) % 7)}s`,
    '--deriva': `${((i % 3) - 1) * 2.5}vw`,
  }));
}
