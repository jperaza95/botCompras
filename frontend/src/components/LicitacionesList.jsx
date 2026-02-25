import './LicitacionesList.css'

function LicitacionesList({ licitaciones, total }) {
  const formatDate = (fecha) => {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-AR')
  }

  const formatCurrency = (monto) => {
    if (!monto || monto === 0) return '—'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto)
  }

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
            {/* Header */}
            <div className="card-header">
              <div className="header-content">
                <h3>{licitacion.titulo}</h3>
                <div className="badges">
                  <span className="rubro-badge">{licitacion.rubro_ia}</span>
                  {licitacion.scrapeado && <span className="status-badge scrapeado">✓ Procesado</span>}
                  {!licitacion.scrapeado && <span className="status-badge pendiente">Pendiente</span>}
                </div>
              </div>
            </div>

            {/* Body - Información principal */}
            <div className="card-body">
              {/* Organismo y datos básicos */}
              <section className="info-section">
                <div className="info-row">
                  <span className="label">Organismo:</span>
                  <span className="value">{licitacion.organismo || '—'}</span>
                </div>
                {licitacion.unidad_ejecutora && (
                  <div className="info-row">
                    <span className="label">Unidad Ejecutora:</span>
                    <span className="value">{licitacion.unidad_ejecutora}</span>
                  </div>
                )}
                {licitacion.tipo_licitacion && (
                  <div className="info-row">
                    <span className="label">Tipo:</span>
                    <span className="value">{licitacion.tipo_licitacion}</span>
                  </div>
                )}
              </section>

              {/* Fechas importantes */}
              <section className="info-section">
                <h4>Fechas</h4>
                <div className="info-row">
                  <span className="label">Publicado:</span>
                  <span className="value">{formatDate(licitacion.fecha_publicacion)}</span>
                </div>
                {licitacion.fecha_apertura && (
                  <div className="info-row">
                    <span className="label">Apertura:</span>
                    <span className="value">{formatDate(licitacion.fecha_apertura)}</span>
                  </div>
                )}
                {licitacion.aclaraciones_hasta && (
                  <div className="info-row">
                    <span className="label">Aclaraciones hasta:</span>
                    <span className="value">{formatDate(licitacion.aclaraciones_hasta)}</span>
                  </div>
                )}
                {licitacion.prorrogas_hasta && (
                  <div className="info-row">
                    <span className="label">Prórrogas hasta:</span>
                    <span className="value">{formatDate(licitacion.prorrogas_hasta)}</span>
                  </div>
                )}
              </section>

              {/* Lugares */}
              {(licitacion.lugar_apertura || licitacion.lugar_entrega) && (
                <section className="info-section">
                  <h4>Lugares</h4>
                  {licitacion.lugar_apertura && (
                    <div className="info-row">
                      <span className="label">Apertura:</span>
                      <span className="value">{licitacion.lugar_apertura}</span>
                    </div>
                  )}
                  {licitacion.lugar_entrega && (
                    <div className="info-row">
                      <span className="label">Entrega:</span>
                      <span className="value">{licitacion.lugar_entrega}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Montos */}
              {(licitacion.precio_pliego || licitacion.monto_total) && (
                <section className="info-section">
                  <h4>Montos</h4>
                  {licitacion.precio_pliego && (
                    <div className="info-row">
                      <span className="label">Precio pliego:</span>
                      <span className="value">{licitacion.precio_pliego}</span>
                    </div>
                  )}
                  {licitacion.monto_total && (
                    <div className="info-row">
                      <span className="label">Monto total:</span>
                      <span className="value amount">{formatCurrency(licitacion.monto_total)}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Resolución */}
              {(licitacion.estado_resolucion || licitacion.nro_resolucion) && (
                <section className="info-section">
                  <h4>Resolución</h4>
                  {licitacion.nro_resolucion && (
                    <div className="info-row">
                      <span className="label">Número:</span>
                      <span className="value">{licitacion.nro_resolucion}</span>
                    </div>
                  )}
                  {licitacion.estado_resolucion && (
                    <div className="info-row">
                      <span className="label">Estado:</span>
                      <span className="value">{licitacion.estado_resolucion}</span>
                    </div>
                  )}
                </section>
              )}

              {/* Contacto */}
              {(licitacion.contacto_nombre || licitacion.contacto_email || licitacion.contacto_telefono) && (
                <section className="info-section">
                  <h4>Contacto</h4>
                  {licitacion.contacto_nombre && (
                    <div className="info-row">
                      <span className="label">Nombre:</span>
                      <span className="value">{licitacion.contacto_nombre}</span>
                    </div>
                  )}
                  {licitacion.contacto_email && (
                    <div className="info-row">
                      <span className="label">Email:</span>
                      <span className="value email">{licitacion.contacto_email}</span>
                    </div>
                  )}
                  {licitacion.contacto_telefono && (
                    <div className="info-row">
                      <span className="label">Teléfono:</span>
                      <span className="value">{licitacion.contacto_telefono}</span>
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* Footer - Links */}
            <div className="card-footer">
              <div className="footer-links">
                <a 
                  href={licitacion.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="link-button primary"
                  title="Ver en sitio oficial"
                >
                  Sitio oficial →
                </a>
                {licitacion.url_pliego && (
                  <a 
                    href={licitacion.url_pliego} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="link-button secondary"
                    title="Descargar pliego"
                  >
                    Pliego
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LicitacionesList
