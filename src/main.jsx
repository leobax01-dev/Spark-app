import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import SparkCommandCenter from './components/SparkCommandCenter.jsx'

// Dev entry point for the standalone Command Center HUD: /?command-center
const isCommandCenter = new URLSearchParams(window.location.search).has('command-center')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isCommandCenter ? <SparkCommandCenter /> : <App />}
  </React.StrictMode>,
)
