import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LearnPage } from './components/LearnPage.tsx'

function Router() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    
    const onPushState = (e: CustomEvent<string>) => {
      window.history.pushState({}, '', e.detail);
      setPath(e.detail);
    };
    window.addEventListener('navigate', onPushState as EventListener);
    
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('navigate', onPushState as EventListener);
    };
  }, []);

  const currentPath = path.replace(/\/$/, '') || '/';
  if (currentPath === '/learn') return <LearnPage />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
