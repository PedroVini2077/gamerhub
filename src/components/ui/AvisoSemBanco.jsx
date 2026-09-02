import { DatabaseZap } from 'lucide-react';

/**
 * A faixa que aparece quando o site perde o banco.
 *
 * ── O que ela substituiu, e por quê ─────────────────────────────────────────
 *
 * Antes isto era um `OfflineGate` que SEQUESTRAVA o app inteiro: um
 * `if (semBanco) return <OfflineGate />` acima do `<Routes>`. Três defeitos
 * saíam daí, e o dono relatou os três:
 *
 * 1. **Ficava preso.** Sem o `<Routes>`, `/sobre` e `/login` viravam
 *    inalcançáveis — e nenhuma das duas precisa do banco. Clicar mudava a URL
 *    e nada acontecia.
 * 2. **A mensagem mentia.** Ela dizia "redirecionando em 4s" enquanto o
 *    `navigate('/')` já tinha rodado no primeiro efeito. Prometia uma coisa
 *    que já havia acontecido, e no fim da contagem só sumia. Mensagem que não
 *    corresponde ao que o sistema fez custa mais tempo do que mensagem
 *    nenhuma (`CLAUDE.md` §1.5).
 * 3. **Tomava a tela toda a cada reload**, virando estorvo em vez de aviso.
 *
 * ── A regra que ficou no lugar ──────────────────────────────────────────────
 *
 * Fora do ar bloqueia **só o que depende do banco**. O que é estático continua
 * de pé: landing e "Sobre" não fazem uma consulta sequer — conferido, elas não
 * importam o cliente Supabase. Quem barra rota interna é o `RequireAuth`, que
 * já existia para exatamente esse trabalho.
 *
 * ── Por que faixa fixa e não algo que se possa fechar ───────────────────────
 *
 * O problema é contínuo: enquanto o banco não voltar, entrar não funciona. Uma
 * faixa fina informa sem atrapalhar, e o incômodo do desenho antigo vinha de
 * ocupar a tela inteira — não de existir. Esconder erro que continua valendo
 * seria trocar um estorvo por uma mentira silenciosa.
 *
 * Ela some sozinha: o `dbHealth` tenta reconectar a cada 20 s e, quando o banco
 * responde, o estado volta e a faixa sai.
 */
export default function AvisoSemBanco() {
  return (
    <div
      role="status"
      className="sticky top-0 z-[9998] w-full border-b border-yellow-500/30
                 bg-yellow-500/10 backdrop-blur px-4 py-2"
    >
      <p className="flex items-center justify-center gap-2 text-center
                    text-xs font-mono text-yellow-300">
        <DatabaseZap size={14} className="shrink-0" />
        <span>
          Sem conexão com o banco — entrar e publicar estão indisponíveis.
          A leitura desta página continua funcionando.
        </span>
      </p>
    </div>
  );
}
