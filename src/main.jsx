import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializePostHog } from './utils/analytics.js'
import { initializeErrorReporting } from './utils/errorReporting.js'

initializePostHog();
initializeErrorReporting();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)