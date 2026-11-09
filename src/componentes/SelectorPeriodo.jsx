import { opcionesPeriodo } from '../informes/periodos'

// Elegir periodo: { id, desde, hasta } (desde/hasta sólo con id = 'fechas')
export default function SelectorPeriodo({ valor, onCambio, anio, conTodos = true }) {
  const o = opcionesPeriodo(anio)
  return (
    <div className="pila sin-relleno">
      <label className="campo">
        <span>Periodo</span>
        <select value={valor.id} onChange={(e) => onCambio({ ...valor, id: e.target.value })}>
          <option value="mes">Mes actual</option>
          <option value="mesant">Mes anterior</option>
          <optgroup label="Meses">
            {o.meses.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
          </optgroup>
          {conTodos && (
            <optgroup label="Trimestres y curso">
              {o.trimestres.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
              <option value="curso">{o.curso.texto}</option>
            </optgroup>
          )}
          <option value="fechas">Unas fechas…</option>
        </select>
      </label>
      {valor.id === 'fechas' && (
        <div className="dos-columnas">
          <label className="campo"><span>Desde</span><input type="date" value={valor.desde ?? ''} onChange={(e) => onCambio({ ...valor, desde: e.target.value })} /></label>
          <label className="campo"><span>Hasta</span><input type="date" value={valor.hasta ?? ''} onChange={(e) => onCambio({ ...valor, hasta: e.target.value })} /></label>
        </div>
      )}
    </div>
  )
}
