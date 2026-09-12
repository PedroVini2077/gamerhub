import { Link } from 'react-router-dom';
import { useRef } from 'react';
import ArteQueInvade from './ArteQueInvade';
import useProgressoDeRolagem from '../../hooks/useProgressoDeRolagem';
import { CLASSE_DA_COSTURA, estiloDaCostura } from '../../lib/costuraDeCena';
import { CENAS } from '../../lib/cenasDaLanding';

/**
 * O FECHO da landing — a sétima cena.
 *
 * ── `[12/09]` Por que ela é diferente das outras cinco ──────────────────────
 *
 * Nas cenas de funcionalidade o texto fica de lado e a arte mostra o produto.
 * Aqui é o contrário: a arte é **gente caminhando em direção à luz e à marca**,
 * e o texto vai no CENTRO, por cima delas. A composição da própria arte pede
 * isso — ela tem um ponto de fuga no meio, e pôr o texto de lado brigaria com
 * ele.
 *
 * É também o único lugar da landing onde a arte mostra **pessoas** em vez de
 * telas. Isso é deliberado e é o argumento do fecho: o que se ganha ao entrar
 * não é software, é a companhia.
 *
 * ── O que NÃO mudou ─────────────────────────────────────────────────────────
 *
 * O botão, o texto e o destino. Esta seção é a porta do cadastro, e mexer no
 * caminho que leva alguém a criar conta por causa de uma reforma visual seria
 * trocar o que funciona pelo que é bonito.
 *
 * ── `[12/09]` Como ela entra, e a resposta mudou duas vezes no mesmo dia ────
 *
 * Ela entrava com o mesmo `fadeUpReveal` das outras cinco — o sexto fade da
 * fila. Virou uma cortina que subia. E agora é **costura**, como todas as
 * outras: a cena invade a anterior e o gesto da arte é `afasta`, o plano
 * abrindo para mostrar as pessoas.
 *
 * A cortina saiu porque, com a costura, seriam duas entradas na mesma cena —
 * e o fecho é justamente onde a página não pode voltar a parecer um bloco.
 */
export default function FinalCTA() {
  const alvo = useRef(null);
  const progresso = useProgressoDeRolagem(alvo, 'solta');

  return (
    // `fechaEmbaixo`: esta é a ÚNICA cena que não é seguida por outra arte, e
    // por isso a única cuja borda inferior aparece. Ver `costuraDeCena.js`.
    // A margem de baixo saiu junto — a arte precisa dissolver DENTRO do preto do
    // rodapé, e não numa faixa vazia antes dele, senão o corte só troca de lugar.
    <section
      ref={alvo}
      style={estiloDaCostura({ fechaEmbaixo: true })}
      className={`relative overflow-hidden mt-10 md:mt-14 ${CLASSE_DA_COSTURA}`}
    >
      {/* Sem `prioridade`: esta é a ÚLTIMA seção da página, e quem para na
          primeira dobra não pode pagar por uma arte que está a cinco telas de
          distância. O `<picture>` em si mora em `ArteDaCena` — ver o porquê lá. */}
      <ArteQueInvade arte={CENAS.cta} progresso={progresso} invasao="afasta" />

      {/* Véu radial, e não lateral como nas outras: aqui o texto está no meio,
          então o escurecimento precisa nascer do centro para fora — senão ele
          apaga justamente as pessoas, que são o assunto da cena. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 62% 74% at 50% 46%, rgba(6,6,8,0.92) 0%, rgba(6,6,8,0.78) 42%, rgba(6,6,8,0.18) 78%, rgba(6,6,8,0) 100%)',
        }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <h2 className="font-display font-bold text-white leading-tight
                       text-xl md:text-4xl lg:text-5xl">
          Pronto pra entrar pro <span className="text-neon-green">Hub</span>?
        </h2>
        <p className="mt-2 md:mt-4 text-gray-300 font-body max-w-md
                      text-xs md:text-lg">
          Crie sua conta gratuita e comece a postar, conversar, assistir lives e
          subir no ranking agora mesmo.
        </p>
        <Link to="/login" className="btn-solid mt-4 md:mt-8 py-3 md:py-3.5 px-8 md:px-10 text-xs md:text-sm inline-block">
          Criar minha conta
        </Link>
      </div>
    </section>
  );
}
