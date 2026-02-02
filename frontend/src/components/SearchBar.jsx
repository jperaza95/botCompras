import { useState } from 'react'
import './SearchBar.css'

function SearchBar({ onBuscar, rubros, onFiltroRubro, filtroActual }) {
  const [busqueda, setBusqueda] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onBuscar(busqueda)
  }

  const handleInputChange = (e) => {
    const valor = e.target.value
    setBusqueda(valor)
    if (valor.length > 2 || valor.length === 0) {
      onBuscar(valor)
    }
  }

  return (
    <div className="search-container">
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          placeholder="Buscar licitaciones..."
          value={busqueda}
          onChange={handleInputChange}
          className="search-input"
        />
        <button type="submit" className="search-button">Buscar</button>
      </form>

      <div className="filters">
        <select 
          value={filtroActual} 
          onChange={(e) => onFiltroRubro(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los rubros</option>
          {rubros.map(rubro => (
            <option key={rubro} value={rubro}>{rubro}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default SearchBar
