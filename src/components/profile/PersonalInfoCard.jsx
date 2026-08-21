import { MapPin } from 'lucide-react';

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function PersonalInfoCard({ form, setField, maxBirthDate }) {
  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-display text-xs text-gray-500 tracking-widest uppercase flex items-center gap-2">
        <MapPin size={12} />Informações
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Nascimento</label>
          <input aria-label="Data de nascimento" type="date"
            className="input-gamer w-full text-sm" value={form.birth_date}
            onChange={e => setField('birth_date', e.target.value)} max={maxBirthDate} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Estado</label>
          <select aria-label="Estado" className="input-gamer w-full text-sm appearance-none"
            value={form.state} onChange={e => setField('state', e.target.value)}>
            <option value="" className="bg-dark-800">— UF —</option>
            {BR_STATES.map(s => <option key={s} value={s} className="bg-dark-800">{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
