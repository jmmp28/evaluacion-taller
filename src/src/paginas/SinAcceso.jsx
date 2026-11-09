import { useApp } from '../contexto'

export default function SinAcceso({ sinGrupo }) {
  const { sesion, salir } = useApp()
  return (
    <main className="pantalla-centro">
      <div className="tarjeta acceso">
        <h1 className="titulo">{sinGrupo ? 'Aún no tienes grupos' : 'Sin acceso a la evaluación'}</h1>
        <p>
          {sinGrupo
            ? 'Tu cuenta ya está dada de alta. Pide al administrador que te asigne un grupo.'
            : 'Tu cuenta funciona, pero no está dada de alta como profesor en esta aplicación. Pídeselo al administrador.'}
        </p>
        <p className="suave">{sesion?.user?.email}</p>
        <button className="boton" onClick={salir}>Cerrar sesión</button>
      </div>
    </main>
  )
}
