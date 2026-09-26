import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@primer/react'
import './index.css'
import App from './App.tsx'
import SpeakerPairProposal from './SpeakerPairProposal.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="day">
      {new URLSearchParams(window.location.search).get('proposal') === 'two-speakers'
        ? <SpeakerPairProposal />
        : <App />}
    </ThemeProvider>
  </StrictMode>,
)
