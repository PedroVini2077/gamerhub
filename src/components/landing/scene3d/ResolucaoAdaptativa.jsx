import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DEGRAUS_DE_RESOLUCAO, QUADROS_POR_AMOSTRA, proximoDegrau } from '../../../lib/resolucaoDaCena';

/**
 * O componente que aplica a decisão de `lib/resolucaoDaCena.js` a cada amostra.
 *
 * A regra em si mora lá, sem React, porque a metade que importa — a cena SOBE
 * de resolução numa máquina capaz — não dá para provar num navegador sem GPU,
 * e precisa de teste de unidade (ver `__tests__/resolucaoAdaptativa.test.js`).
 * Aqui fica só a ponte com o `useFrame`.
 */
export default function ResolucaoAdaptativa() {
  const setDpr = useThree(estado => estado.setDpr);
  const degrau = useRef(0);
  const teto = useRef(DEGRAUS_DE_RESOLUCAO.length - 1);
  const amostras = useRef([]);

  useFrame((_, delta) => {
    amostras.current.push(delta * 1000);
    if (amostras.current.length < QUADROS_POR_AMOSTRA) return;

    // Mediana, e não média: um único quadro de 500 ms (aba em segundo plano,
    // coleta de lixo) arrastaria a média e rebaixaria a cena de uma máquina
    // que está perfeitamente bem.
    const ordenado = [...amostras.current].sort((a, b) => a - b);
    const mediana = ordenado[Math.floor(ordenado.length / 2)];
    amostras.current = [];

    const novo = proximoDegrau({
      degrau: degrau.current, teto: teto.current, mediana,
    });
    if (novo.degrau === degrau.current) return;
    degrau.current = novo.degrau;
    teto.current = novo.teto;
    setDpr(DEGRAUS_DE_RESOLUCAO[novo.degrau]);
  });

  return null;
}
