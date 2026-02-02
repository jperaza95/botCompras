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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // Cargar rubros disponibles
  useEffect(() => {
    cargarRubros()
  }, [])

  // Cargar licitaciones cuando cambien filtros
  useEffect(() => {
    cargarLicitaciones()
  }, [filtros])

  const cargarRubros = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/rubros`)
      if (response.data.success) {
        setRubros(response.data.data)
      }
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

      const response = await axios.get(`${API_URL}/api/licitaciones?${params}`)
      if (response.data.success) {
        setLicitaciones(response.data.data)
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
  }

  const handleFiltroRubro = (rubro) => {
    setFiltros(prev => ({ ...prev, rubro }))
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
          <LicitacionesList 
            licitaciones={licitaciones}
            total={licitaciones.length}
          />
        )}
      </main>
    </div>
  )
}

export default App
