// Etiqueta de categoría con su color
export default function Chip({ texto, color }) {
  return (
    <span className="chip" style={{ background: color.claro, color: color.texto }}>{texto}</span>
  )
}
