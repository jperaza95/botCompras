import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'
import SearchBar from './components/SearchBar'
import LicitacionesList from './components/LicitacionesList'

function App() {
  const [licitaciones, setLicitaciones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rubros, setRubros] = useState([])
  const [filtros, setFiltros] = useState({ buscar: '', rubro: '' })
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [inputPagina, setInputPagina] = useState('1')

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // Cargar rubros disponibles
  useEffect(() => {
    cargarRubros()
  }, [])

  // Cargar licitaciones cuando cambien filtros o página
  useEffect(() => {
    cargarLicitaciones()
    // Actualizar el input cuando cambia la página
    setInputPagina(pagination.page.toString())
  }, [filtros, pagination.page])

  const cargarRubros = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/rubros`)
      setRubros(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      console.error('Error cargando rubros:', err)
    }
  }

  const cargarLicitaciones = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.buscar) params.append('buscar', filtros.buscar)
      if (filtros.rubro) params.append('rubro', filtros.rubro)
      params.append('page', pagination.page)
      params.append('limit', pagination.limit)

      const response = await axios.get(`${API_URL}/api/licitaciones?${params}`)
      
      // Manejar respuesta con paginación
      if (response.data.data && response.data.pagination) {
        setLicitaciones(response.data.data)
        setPagination(response.data.pagination)
      } else if (Array.isArray(response.data)) {
        // Fallback para respuestas antiguas sin paginación
        setLicitaciones(response.data)
      }
    } catch (err) {
      setError('Error al cargar licitaciones: ' + err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = (busqueda) => {
    setFiltros(prev => ({ ...prev, buscar: busqueda }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset a página 1 al buscar
  }

  const handleFiltroRubro = (rubro) => {
    setFiltros(prev => ({ ...prev, rubro }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset a página 1 al filtrar
  }

  const handlePaginaAnterior = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }))
    }
  }

  const handlePaginaSiguiente = () => {
    if (pagination.page < pagination.pages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }))
    }
  }

  const handleIrAPagina = (e) => {
    const pagina = parseInt(e.target.value);
    if (!isNaN(pagina) && pagina >= 1 && pagina <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: pagina }))
    }
  }

  const handleInputPaginaChange = (e) => {
    setInputPagina(e.target.value)
  }

  const handleInputPaginaKeyDown = (e) => {
    if (e.key === 'Enter') {
      const pagina = parseInt(inputPagina);
      if (!isNaN(pagina) && pagina >= 1 && pagina <= pagination.pages) {
        setPagination(prev => ({ ...prev, page: pagina }))
      } else {
        // Si el número es inválido, revertir al valor anterior
        setInputPagina(pagination.page.toString())
      }
    }
  }

  const handleInputPaginaBlur = () => {
    const pagina = parseInt(inputPagina);
    if (!isNaN(pagina) && pagina >= 1 && pagina <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: pagina }))
    } else {
      // Si el número es inválido, revertir al valor anterior
      setInputPagina(pagination.page.toString())
    }
  }

  return (
    <div className="App">
      <header className="header">
        <h1>🔍 Buscador de Licitaciones</h1>
        <p>Encuentra las mejores oportunidades de compras</p>
      </header>

      <main className="container">
        <SearchBar 
          onBuscar={handleBuscar}
          rubros={rubros}
          onFiltroRubro={handleFiltroRubro}
          filtroActual={filtros.rubro}
        />

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading">Cargando licitaciones...</div>
        ) : (
          <>
            <LicitacionesList 
              licitaciones={licitaciones}
              total={pagination.total}
            />
            
            {pagination.pages > 1 && (
              <div className="pagination">
                <button 
                  onClick={handlePaginaAnterior}
                  disabled={pagination.page === 1}
                  className="pagination-btn"
                >
                  ← Anterior
                </button>
                
                <div className="pagination-controls">
                  <span className="pagination-info">
                    Página
                  </span>
                  <input 
                    type="number" 
                    min="1" 
                    max={pagination.pages}
                    value={inputPagina}
                    onChange={handleInputPaginaChange}
                    onKeyDown={handleInputPaginaKeyDown}
                    onBlur={handleInputPaginaBlur}
                    className="pagination-input"
                    placeholder="N°"
                  />
                  <span className="pagination-info">
                    de {pagination.pages}
                  </span>
                </div>
                
                <button 
                  onClick={handlePaginaSiguiente}
                  disabled={pagination.page === pagination.pages}
                  className="pagination-btn"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
