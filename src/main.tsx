import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { setupChatFont } from './app/fontSettings.js'
import { setupExternalLinks } from './app/systemBars.js'
import { setupTheme } from './app/theme.js'
import { ensureKatex } from './services/markdown/katex.js'
import './app/theme.css'
import './app/global.css'

ensureKatex()
setupTheme()
setupChatFont()
setupExternalLinks()

createRoot(document.getElementById('root') as HTMLElement).render(<App />)