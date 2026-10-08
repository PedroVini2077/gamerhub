import { lazy, Suspense, useState, useEffect } from 'react';
import { devoConvidar, aoMudarConvite } from '../../lib/conviteDeInstalacao';

/**
 * `[08/10]` O PORTÃO da faixa de instalação — e por que ele é um arquivo.
 *
 * ── O que ele resolve, com número ──────────────────────────────────────────
 *
 * A faixa entrou no caminho crítico e o **orçamento de bytes estourou**:
 * 229,0 → 229,9 kB comprimidos, contra teto de 229. Ela é enfeite útil para
 * uma minoria — quem tem o convite do navegador e ainda não respondeu — e
 * estava sendo baixada por todo mundo, inclusive por quem já instalou e por
 * quem está no iPhone, onde ela nem existe.
 *
 * ── Por que `lazy()` funciona AQUI, e não funcionou na cena 3D ─────────────
 *
 * A 1ª armadilha do §0.3 é exatamente isto: *"`lazy()` não adia download"* —
 * a cena 3D era lazy e montava com o Hero, então o pedido saía no primeiro
 * instante e o caminho crítico continuava o mesmo, só com outro nome.
 *
 * A diferença é a CONDIÇÃO. Aqui o `lazy` está atrás de `devoConvidar()`, que
 * é falso na maioria das visitas: já instalou, já dispensou, o navegador não
 * ofereceu, ou é Safari. Nesses casos o chunk **nunca é pedido**. Quando é, é
 * depois da pintura e para mostrar uma faixa que ninguém está esperando.
 *
 * ── Por que o portão mora num arquivo separado ─────────────────────────────
 *
 * Porque ele é a parte que NÃO pode ser adiada: a pergunta precisa existir no
 * pacote inicial para alguém poder respondê-la. Deixá-lo dentro da faixa seria
 * carregar a faixa para descobrir se a faixa deve aparecer.
 */
const Faixa = lazy(() => import('./FaixaDeInstalacao'));

export default function ConviteDeInstalacao() {
  const [aparecer, setAparecer] = useState(() => devoConvidar());

  // O evento do navegador pode chegar depois desta tela montar.
  useEffect(() => aoMudarConvite(() => setAparecer(devoConvidar())), []);

  if (!aparecer) return null;

  // `fallback` nulo de propósito: enquanto o chunk vem, o certo é não existir
  // nada. Um esqueleto piscando no canto da tela chamaria atenção para algo
  // que a pessoa não pediu.
  return (
    <Suspense fallback={null}>
      <Faixa />
    </Suspense>
  );
}
