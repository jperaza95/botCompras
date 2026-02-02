import './LicitacionesList.css'

function LicitacionesList({ licitaciones, total }) {
  if (licitaciones.length === 0) {
    return (
      <div className="empty-state">
        <p>No se encontraron licitaciones</p>
      </div>
    )
  }

  return (
    <div className="licitaciones-list">
      <div className="results-header">
        <h2>Resultados ({total})</h2>
      </div>

      <div className="licitaciones-grid">
        {licitaciones.map(licitacion => (
          <div key={licitacion.id} className="licitacion-card">
            <div className="card-header">
              <h3>{licitacion.titulo}</h3>
              <span className="rubro-badge">{licitacion.rubro_ia}</span>
            </div>

            <div className="card-body">
              <p className="organismo">
                <strong>Organismo:</strong> {licitacion.organismo}
              </p>
              <p className="fecha">
                <strong>Publicado:</strong> {new Date(licitacion.fecha_publicacion).toLocaleDateString('es-AR')}
              </p>
            </div>

            <div className="card-footer">
              <a 
                href={licitacion.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="link-button"
              >
                Ver detalles →
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LicitacionesList
