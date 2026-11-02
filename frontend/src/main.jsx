import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { api } from './api'
import App from './App'
import { AppProvider } from './context'
import './index.css'

// The home page renders from bundled data, so use that time to wake the API.
api.warmUp()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
