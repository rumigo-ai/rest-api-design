import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TestBooks from './TestBooks.tsx'

const path = window.location.pathname.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/test-book' ? <TestBooks /> : <App />}
  </StrictMode>,
)
