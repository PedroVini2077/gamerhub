import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import ConfirmModal from '../ui/ConfirmModal';
import ConfirmarComSenha from '../ui/ConfirmarComSenha';
import { deleteOwnAccount } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth.jsx';

/**
 * A ZONA DE PERIGO das configurações — hoje, apagar a própria conta.
 *
 * ── Por que ela saiu do `Settings.jsx` `[12/09]` ────────────────────────────
 *
 * Porque eu a fiz crescer. A confirmação por senha (SEC-012) levaria o
 * `Settings.jsx` de 286 para 304 linhas, e o §4 manda dividir o arquivo que
 * **eu mesmo** inchei, no mesmo trabalho — não anotar para depois.
 *
 * O corte também é por responsabilidade e não só por tamanho: o resto da tela
 * são preferências reversíveis (senha, e-mail, notificação). Isto é a única
 * coisa ali que **não tem volta**, e misturá-la com o resto é o que faz uma
 * ação irreversível parecer mais uma opção.
 *
 * ── As DUAS etapas, e por que elas perguntam coisas diferentes ──────────────
 *
 * | etapa | o que ela pergunta |
 * | --- | --- |
 * | `ConfirmModal` | **intenção** — você quer mesmo? |
 * | `ConfirmarComSenha` | **identidade** — você é mesmo o dono desta conta? |
 *
 * A segunda existe porque a primeira não protege nada contra quem está numa
 * sessão que não é dele. E ela não valida nada aqui: **quem confere a senha é
 * a RPC, no servidor** — a tela só coleta. É o §1.3 na letra: validação de
 * cliente não vale nada quando a `anon key` permite chamar a REST direto.
 *
 * ── A trilha NÃO é gravada aqui, e isso é conserto ──────────────────────────
 *
 * Havia um `logAudit` nesta função, rodando **depois** de a conta ser apagada —
 * ou seja, como um usuário que já não existe. A trilha da própria exclusão
 * podia se perder em silêncio (§1.5). Hoje quem grava é a RPC, **antes** do
 * `DELETE`, e por isso ela é garantida.
 */
export default function ZonaDePerigo() {
  const { signOut } = useAuth();
  const [etapa, setEtapa] = useState(null);
  const [apagando, setApagando] = useState(false);
  const [erroDaSenha, setErroDaSenha] = useState('');

  async function apagarConta(senha) {
    setApagando(true);
    setErroDaSenha('');
    try {
      const { error } = await deleteOwnAccount(senha);
      if (error) {
        // Senha errada e falha de rede são coisas DIFERENTES (§1.5): dizer
        // "senha incorreta" quando o banco não respondeu manda a pessoa
        // digitar de novo achando que errou.
        setErroDaSenha(
          /senha/i.test(error.message || '')
            ? 'Senha incorreta.'
            : 'Não deu para concluir agora. Tente de novo em instantes.',
        );
        setApagando(false);
        return;
      }
      await signOut();
      toast.success('Conta deletada.');
    } catch {
      setErroDaSenha('Não deu para concluir agora. Tente de novo em instantes.');
    }
    setApagando(false);
  }

  return (
    <>
      <div className="card p-5 border-red-500/20">
        <h2 className="font-display text-xs text-red-400 tracking-widest uppercase mb-2">
          Zona de Perigo
        </h2>
        <p className="text-xs text-gray-500 font-mono mb-3">
          Ações irreversíveis. Pense bem antes de continuar.
        </p>
        <button
          onClick={() => setEtapa('primeira')}
          disabled={apagando}
          className="text-xs font-mono text-red-400/70 hover:text-red-400 border
                     border-red-400/30 hover:border-red-400/60 px-4 py-2 rounded transition-all"
        >
          {apagando ? 'Deletando...' : 'Deletar minha conta'}
        </button>
      </div>

      {etapa === 'primeira' && (
        <ConfirmModal
          title="Deletar conta"
          icon={Trash2}
          accent="red"
          message="Tem certeza? Essa ação é IRREVERSÍVEL. Todos os seus dados (posts, comentários e perfil) serão apagados para sempre."
          confirmLabel="Continuar"
          confirmIcon={Trash2}
          onConfirm={() => setEtapa('senha')}
          onClose={() => setEtapa(null)}
        />
      )}

      {etapa === 'senha' && (
        <ConfirmarComSenha
          titulo="Última chance"
          Icone={Trash2}
          aviso="Isto apaga sua conta e tudo que você publicou, para sempre. Confirme com a senha da sua conta."
          rotuloDoBotao="Deletar conta"
          ocupado={apagando}
          erro={erroDaSenha}
          aoConfirmar={apagarConta}
          aoFechar={() => { if (!apagando) { setEtapa(null); setErroDaSenha(''); } }}
          nota="A senha é conferida no servidor. Nenhuma tela sozinha impede esta ação."
        />
      )}
    </>
  );
}
