/** Barra de abas do painel admin, com badge de pendências. */
export default function AdminTabs({ tabs, tab, setTab }) {
  return (
    <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 pt-2">
      {tabs.map(({ id, label, icon: Icon, badge }) => {
        const active = tab === id;
        return (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={active}
            className={`relative flex items-center gap-2 py-2 px-4 text-xs font-display tracking-wider uppercase rounded border transition-all shrink-0 ${
              active
                ? id === 'super'
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-neon-purple bg-neon-purple/10 text-neon-purple'
                : 'border-dark-400 text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={13} /> {label}
            {badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center font-mono font-bold"
                style={{ fontSize: 9 }}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
