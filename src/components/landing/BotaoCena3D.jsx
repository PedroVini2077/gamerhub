import { useState } from 'react';
import { Boxes, Layers, RotateCw } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';
import { modoDaCena, gravarPreferencia, podeEscolher } from '../../lib/cena3D';

// Deixa o visitante escolher entre a cena 3D e a versão leve, sobrepondo o que
// o site decidiu pelo aparelho dele.
//
// ── Por que existe ──────────────────────────────────────────────────────────
//
// O corte por largura de tela é um palpite nosso, e palpite erra: um celular
// bom aguenta a cena 3D tranquilamente. Tirar o 3D do celular resolveu o
// desempenho, mas transformar isso numa porta trancada seria decidir pelos
// outros. O botão devolve a decisão a quem está usando — com o aviso na frente,
// para a escolha ser informada e não surpresa.
//
// ── Por que recarrega a página ──────────────────────────────────────────────
//
// A cena 3D é montada uma vez, na montagem do Hero, e o chunk de 887 KB é
// buscado a partir daí. Trocar o modo ao vivo exigiria desmontar o Canvas,
// devolver o contexto WebGL e remontar o Hero inteiro — bastante coisa para
// dar errado num caminho que é usado uma vez ou outra. O reload é o caminho
// simples e honesto, e o aviso já prepara o visitante para ele.

export default function BotaoCena3D() {
  // `useState(fn)` roda uma vez, na montagem: a decisão não muda no meio da
  // sessão, e reler o localStorage a cada render seria trabalho à toa.
  const [modo] = useState(modoDaCena);
  const [oferecer] = useState(podeEscolher);
  const [confirmando, setConfirmando] = useState(false);
  const [falhouAoSalvar, setFalhouAoSalvar] = useState(false);

  if (!oferecer) return null;

  const querAtivar = modo === 'leve';

  function aplicar() {
    // `gravarPreferencia` devolve `false` quando o navegador recusa o storage
    // (aba anônima, cookies bloqueados). Recarregar a página nesse caso traria
    // o site de volta exatamente igual, e o visitante concluiria que o botão
    // está quebrado. Melhor dizer o que houve.
    if (!gravarPreferencia(querAtivar ? 'sim' : 'nao')) {
      setFalhouAoSalvar(true);
      setConfirmando(false);
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-400 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors font-mono text-[11px] uppercase tracking-wider"
      >
        {querAtivar ? <Boxes size={12} /> : <Layers size={12} />}
        {querAtivar ? 'Ativar landing 3D' : 'Voltar para a versão leve'}
      </button>

      {falhouAoSalvar && (
        <p className="mt-2 max-w-xs font-mono text-[11px] text-yellow-400/80 leading-relaxed">
          Não consegui guardar a preferência neste navegador — em aba anônima ou
          com o armazenamento bloqueado ela não sobrevive ao recarregamento.
        </p>
      )}

      {confirmando && (
        <ConfirmModal
          title={querAtivar ? 'Ativar a landing 3D' : 'Voltar para a versão leve'}
          icon={querAtivar ? Boxes : Layers}
          accent={querAtivar ? 'yellow' : 'green'}
          message={querAtivar
            ? 'A cena 3D baixa cerca de 890 KB de código e usa a placa de vídeo do '
              + 'aparelho. Num celular ela pode esquentar, gastar mais bateria e '
              + 'deixar a página lenta — foi por isso que o site escolheu a versão '
              + 'leve aqui. A escolha fica guardada neste navegador e você pode '
              + 'voltar atrás pelo mesmo botão. A página vai recarregar.'
            : 'A landing volta à decoração leve, feita em SVG, que não baixa nem '
              + 'executa a cena 3D. A página vai recarregar.'}
          confirmLabel={querAtivar ? 'Ativar e recarregar' : 'Voltar e recarregar'}
          confirmIcon={RotateCw}
          onConfirm={aplicar}
          onClose={() => setConfirmando(false)}
        />
      )}
    </>
  );
}
