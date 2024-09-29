import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initializeDatabase } from './utils/setupDatabase';

// Initialize the database before rendering the app
initializeDatabase().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}).catch(error => {
  console.error('Failed to initialize database:', error);
});