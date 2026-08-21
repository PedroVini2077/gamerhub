// Os botões de decisão apareciam sete vezes no CargosTab com a mesma cadeia de
// classes e só a cor mudando — três variantes copiadas à mão.
const ACCENT = {
  green:  'border-neon-green/30 text-neon-green hover:bg-neon-green/10',
  red:    'border-red-400/30 text-red-400 hover:bg-red-400/10',
  yellow: 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10',
};

export default function DecisionButton({ icon: Icon, accent = 'green', onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded transition-colors ${ACCENT[accent]}`}>
      {Icon && <Icon size={12} />} {children}
    </button>
  );
}
