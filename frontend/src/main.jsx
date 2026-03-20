import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ensureIconfontLoaded } from './components/icons/iconfontLoader.js'
import './styles/global.css'

ensureIconfontLoaded(import.meta.env.VITE_ICONFONT_URL)

const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

