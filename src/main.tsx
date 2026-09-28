import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@primer/react'
import './index.css'
import App from './App.tsx'
import SpeakerPairProposal from './SpeakerPairProposal.tsx'

const SHELL_THEME_KEY = 'devdays-shell-theme-v1'
type ShellMode = 'light' | 'dark'

// eslint-disable-next-line react-refresh/only-export-components
function Application() {
  const [shellMode, setShellMode] = useState<ShellMode>(() => {
    try {
      return window.localStorage.getItem(SHELL_THEME_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const isProposal = new URLSearchParams(window.location.search).get('proposal') === 'two-speakers'
  const toggleShellMode = () => {
    const next = shellMode === 'light' ? 'dark' : 'light'
    setShellMode(next)
    try {
      window.localStorage.setItem(SHELL_THEME_KEY, next)
    } catch {
      // Keep the in-session selection usable when storage is unavailable.
    }
  }

  return (
    <ThemeProvider colorMode={shellMode === 'dark' ? 'night' : 'day'} dayScheme="light" nightScheme="dark">
      {isProposal
        ? <SpeakerPairProposal />
        : <App shellMode={shellMode} onToggleShellMode={toggleShellMode} />}
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
