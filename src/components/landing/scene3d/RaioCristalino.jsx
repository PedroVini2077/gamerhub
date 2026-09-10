/* eslint-disable react-hooks/immutability -- SUPRESSÃO, não conserto (§6.1).
   O padrão do @react-three/fiber é criar geometria e material UMA vez e mutá-los
   no laço: `uniforms.*.value` é escrito ~60x por segundo, fora do ciclo de render
   do React — é para isso que `useFrame` existe. As regras do React Compiler
   modelam React puro e acusam essa mutação ("This value cannot be modified").
   O conserto de verdade — declarar `<shaderMaterial>` como filho JSX e registrar
   `ShaderMaterial` no `extend()` — está no BACKLOG; ele custa o `extend()`
   seletivo, que é o que segura o tamanho deste chunk. Ver o bloco em
   `RaioCristalino()` para as duas saídas já tentadas e por que não serviram. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { construirMetades, construirNucleo, construirLascas, CENTRO_DO_NUCLEO } from './geometriaDoRaio';
import { criarMaterialDeCristal, criarMaterialDoNucleo, PALETA } from './materialDeCristal';
import { criarLinhaDoTempo } from './linhaDoTempo';

// O raio cristalino — metade superior + núcleo + metade inferior.
//
// ── UM `useFrame`, e é o ponto da arquitetura ───────────────────────────────
//
// Ordem do dono: *"evitar dezenas de `useFrame()` independentes e
// descoordenados"*. A cena antiga tinha um por objeto, cada um com o próprio
// acumulador de tempo — nada garantia que dois objetos concordassem sobre em
// que instante da cena estavam.
//
// Aqui existe **um só**, no topo. Ele avança a `linhaDoTempo` e escreve o
// resultado em `ref`s e em `uniforms`. Nenhum filho tem laço próprio.
//
// Isso também é o que torna o portão de viewport confiável: com um laço, parar
// a cena é parar uma coisa.

/**
 * A família de fragmentos.
 *
 * Ordem dele sobre a cor: *"verde = dominante · cyan = mais próximo do core ·
 * purple = mais distante · amber = raro e pontual"*. A regra está codificada
 * abaixo em vez de espalhada, para a distribuição não escorregar quando alguém
 * acrescentar um fragmento.
 */
const AMBAR = new THREE.Color('#ffb43a');

const FRAGMENTOS = [
  // perto do núcleo -> ciano
  { pos: [0.62, 0.28, 0.55], escala: 0.30, giro: [0.4, 0.9, 0.2], vel: 0.18 },
  { pos: [-0.58, -0.16, 0.48], escala: 0.26, giro: [1.1, 0.3, 0.7], vel: -0.22 },
  // meio -> verde (dominante)
  { pos: [1.15, 0.74, -0.35], escala: 0.38, giro: [0.2, 1.4, 0.9], vel: 0.14 },
  { pos: [-1.22, 0.42, -0.28], escala: 0.34, giro: [0.8, 0.1, 1.2], vel: -0.16 },
  { pos: [0.95, -0.82, -0.2], escala: 0.31, giro: [1.3, 0.6, 0.4], vel: 0.2 },
  // longe -> roxo
  { pos: [-1.65, -0.95, -1.1], escala: 0.46, giro: [0.5, 1.1, 0.3], vel: -0.11 },
  { pos: [1.78, -0.38, -1.35], escala: 0.42, giro: [0.9, 0.4, 1.0], vel: 0.09 },
  // raro e pontual -> âmbar. UM só, de propósito
  { pos: [-0.42, 1.25, -0.75], escala: 0.22, giro: [0.3, 0.7, 1.5], vel: 0.26 },
];

/** A cor de um fragmento vem da PROFUNDIDADE, não de escolha caso a caso. */
function corDoFragmento(indice, z) {
  if (indice === FRAGMENTOS.length - 1) return AMBAR;      // o raro
  if (z > 0.4) return PALETA.borda;                        // perto -> ciano
  if (z < -0.9) return PALETA.fuga;                        // longe -> roxo
  return PALETA.base;                                      // o corpo -> verde
}

export default function RaioCristalino() {
  // ── Os recursos de GPU, e a SUPRESSÃO de lint que eles exigem ─────────────
  //
  // **Isto é supressão, não conserto**, e a §6.1 manda escrever o motivo ao
  // lado. Aqui está ele.
  //
  // O padrão do `@react-three/fiber` é criar geometria e material UMA vez e
  // mutá-los no laço: `uniforms.uTempo.value` é escrito 60 vezes por segundo,
  // fora do ciclo de render do React — é justamente para isso que o `useFrame`
  // existe. As regras do React Compiler modelam React puro e acusam essa
  // mutação (`This value cannot be modified`).
  //
  // As duas saídas que tentei antes desta, e por que não serviram:
  //
  //  1. **guardar em `ref` com criação preguiçosa** — troca quatro avisos por
  //     um (`Cannot access refs during render`). Mesmo problema, outro nome;
  //  2. **declarar o material como filho JSX** (`<shaderMaterial ref=… />`) —
  //     é a saída idiomática de verdade e some com o aviso, mas exige
  //     registrar `ShaderMaterial` no `extend()`, e o `extend()` seletivo é o
  //     que segura o tamanho deste chunk. Fica anotado no BACKLOG como o
  //     conserto de verdade.
  //
  const r = useMemo(() => {
    const matsFragmento = FRAGMENTOS.map((f, i) => {
      const m = criarMaterialDeCristal({ nucleo: [0, 0, 0], opacidade: 0.72 });
      m.uniforms.uCorBase.value = corDoFragmento(i, f.pos[2]).clone();
      return m;
    });
    return {
      metades: construirMetades(),
      geoNucleo: construirNucleo(),
      lascas: construirLascas(),
      matSuperior: criarMaterialDeCristal({ nucleo: [...CENTRO_DO_NUCLEO, 0] }),
      matInferior: criarMaterialDeCristal({ nucleo: [...CENTRO_DO_NUCLEO, 0] }),
      matNucleo: criarMaterialDoNucleo(),
      matsFragmento,
      linha: criarLinhaDoTempo(),
    };
  }, []);

  // ── Liberar a GPU ao desmontar ────────────────────────────────────────────
  //
  // O `root.unmount()` do `LandingScene` solta o contexto WebGL inteiro, então
  // hoje isto é cinto e suspensório. Fica porque quem CRIA recurso de GPU é
  // quem tem que soltar: se um dia a cena passar a montar e desmontar sem
  // derrubar o contexto, sem isto cada ciclo vazaria 11 geometrias e 11
  // materiais — e vazamento de GPU não quebra teste nenhum (§1.5).
  useEffect(() => () => {
    r.metades.superior.dispose();
    r.metades.inferior.dispose();
    r.geoNucleo.dispose();
    r.lascas.forEach((g) => g.dispose());
    [r.matSuperior, r.matInferior, r.matNucleo, ...r.matsFragmento]
      .forEach((m) => m.dispose());
  }, [r]);

  const grupo = useRef(null);
  const refSuperior = useRef(null);
  const refInferior = useRef(null);
  const refNucleo = useRef(null);
  const refsFragmento = useRef([]);

  // ── O ÚNICO laço da cena ──────────────────────────────────────────────────
  //
  // A supressão do topo do arquivo cobre este laço: escrever `uniforms.*.value`
  // por quadro é o contrato do `useFrame`, e a regra `immutability` modela React
  // puro. Suprimido de propósito, não consertado.
  useFrame((_estado, delta) => {
    const e = r.linha.avancar(delta);

    // Os uniforms compartilhados. `uMaterializacao` é o que faz a peça ganhar
    // existência de baixo para cima, em vez de aparecer translúcida.
    for (const m of [r.matSuperior, r.matInferior, r.matNucleo, ...r.matsFragmento]) {
      m.uniforms.uTempo.value = e.tempo;
      m.uniforms.uPulso.value = e.pulso;
    }
    r.matSuperior.uniforms.uMaterializacao.value = e.materializacao;
    r.matInferior.uniforms.uMaterializacao.value = e.materializacao;
    // O núcleo nasce ANTES das metades — ele é a fonte, não a consequência.
    r.matNucleo.uniforms.uMaterializacao.value = 1;

    // As metades se afastam COM o pulso: a de cima sobe, a de baixo desce.
    // É o que faz a energia parecer empurrar a peça (pedido dele), em vez de
    // o brilho só mudar de valor.
    if (refSuperior.current) refSuperior.current.position.y = e.afastamento;
    if (refInferior.current) refInferior.current.position.y = -e.afastamento;

    if (refNucleo.current) {
      const s = e.escala * (0.92 + e.pulso * 0.16);
      refNucleo.current.scale.setScalar(s);
      refNucleo.current.rotation.y += delta * 0.55;
      refNucleo.current.rotation.x += delta * 0.21;
    }

    // O conjunto inclina devagar — dá volume sem virar carrossel.
    if (grupo.current) {
      grupo.current.rotation.y = Math.sin(e.tempo * 0.24) * 0.30;
      grupo.current.rotation.x = Math.sin(e.tempo * 0.17) * 0.09;
    }

    // Fragmentos: chegam por último e orbitam devagar.
    refsFragmento.current.forEach((malha, i) => {
      if (!malha) return;
      const f = FRAGMENTOS[i];
      const chegada = e.fragmentos;
      malha.scale.setScalar(f.escala * chegada);
      // Vêm de FORA para o lugar: sem isto eles só piscam no ponto final.
      const longe = 2.2 - chegada * 1.2;
      malha.position.set(f.pos[0] * longe, f.pos[1] * longe, f.pos[2]);
      malha.rotation.x = f.giro[0] + e.tempo * f.vel * 0.5;
      malha.rotation.y = f.giro[1] + e.tempo * f.vel;
      malha.rotation.z = f.giro[2];
      r.matsFragmento[i].uniforms.uMaterializacao.value = chegada;
    });
  });

  return (
    // `[10/09]` ESCALA e POSIÇÃO, e as duas vieram de MEDIR o print da landing
    // de verdade, não da peça isolada.
    //
    // Câmera em `z = 5.5` com `fov 42` dá meia-altura visível de
    // `5,5 · tan(21°) = 2,11`. A faixa livre acima da linha "sua base de
    // operações gamer" vai de `y ≈ 1,62` a `y ≈ 0,62` — 1 unidade. Com o raio
    // nascendo com 2 de altura, é `scale 0.50` centrado em `1.12`.
    //
    // A versão anterior usava `0.62` em `1.15`, e o topo caía em `y = 1,77`:
    // a ponta ficava ATRÁS da barra do cabeçalho e a peça encostava no texto.
    // Está no print de 10/09.
    <group ref={grupo} scale={0.50} position={[0, 1.12, 0]}>
      {/* Luz interna: o núcleo é a fonte, então a luz mora NELE. */}
      <pointLight position={[CENTRO_DO_NUCLEO[0], CENTRO_DO_NUCLEO[1], 0.35]}
        color="#8dff7a" intensity={3.4} distance={4.6} />
      <ambientLight intensity={0.28} />

      <mesh ref={refSuperior} geometry={r.metades.superior} material={r.matSuperior} />
      <mesh ref={refInferior} geometry={r.metades.inferior} material={r.matInferior} />

      <mesh
        ref={refNucleo}
        geometry={r.geoNucleo}
        material={r.matNucleo}
        position={[CENTRO_DO_NUCLEO[0], CENTRO_DO_NUCLEO[1], 0]}
        scale={0}
      />

      {FRAGMENTOS.map((f, i) => (
        <mesh
          key={`${f.pos[0]}:${f.pos[1]}:${f.pos[2]}`}
          ref={(el) => { refsFragmento.current[i] = el; }}
          geometry={r.lascas[i % r.lascas.length]}
          material={r.matsFragmento[i]}
          scale={0}
        />
      ))}
    </group>
  );
}
