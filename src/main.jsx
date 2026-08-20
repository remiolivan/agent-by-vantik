import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Keep the app addable to the home screen via the browser's own menu,
// but don't let Chrome auto-surface its own "Install app" banner.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
})
