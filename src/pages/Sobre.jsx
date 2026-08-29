import { Link } from 'react-router-dom';
import { ArrowLeft, PencilLine } from 'lucide-react';
import { BLOCOS } from '../components/sobre/conteudoDoSobre';

/**
 * A página "Sobre", pedida pelo dono como primeira aba da navegação lateral.
 *
 * É pública de propósito: alguém precisa poder ler sobre o projeto **antes** de
 * decidir criar conta. Por isso ela não entra no `RequireAuth`.
 *
 * O conteúdo mora em `components/sobre/conteudoDoSobre.js`. Os blocos que
 * dependem da história do dono estão marcados como pendentes e aparecem na tela
 * como pendentes — ver lá o porquê de não serem inventados.
 */
export default function Sobre() {
  return (
    <div className="min-h-screen bg-dark-900 grid-bg">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-neon-green transition-colors"
        >
          <ArrowLeft size={14} /> Voltar
        </Link>

        <header className="space-y-2">
          <p className="font-display text-xs tracking-widest uppercase text-neon-green">
            Sobre
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white">
            O GamerHub
          </h1>
        </header>

        {BLOCOS.map(bloco => (
          <section key={bloco.id} className="space-y-3">
            <h2 className="font-display text-xl font-bold text-white">{bloco.titulo}</h2>

            {bloco.pendente ? (
              // Aparece na TELA em vez de a seção simplesmente não existir. Uma
              // seção que some sem explicação é indistinguível de esquecimento;
              // assim fica claro que falta um texto, e qual.
              <div className="card p-4 border-dashed border-dark-500 space-y-1">
                <p className="inline-flex items-center gap-2 text-sm font-mono text-gray-400">
                  <PencilLine size={14} className="text-neon-purple" />
                  Esta parte ainda vai ser escrita.
                </p>
                <p className="text-xs font-mono text-gray-600">{bloco.dica}</p>
              </div>
            ) : (
              bloco.paragrafos.map((texto, i) => (
                <p key={i} className="text-gray-400 font-body leading-relaxed">{texto}</p>
              ))
            )}
          </section>
        ))}

        <p className="text-xs font-mono text-gray-700 pt-4 border-t border-dark-700">
          // esta página cresce junto com o projeto
        </p>
      </div>
    </div>
  );
}
