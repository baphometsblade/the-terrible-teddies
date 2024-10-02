import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializePostHog } from './utils/analytics.js'
import { initializeSentry } from './utils/errorReporting.js'

initializePostHog();
initializeSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)