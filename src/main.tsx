import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/menu.css';
import './styles/dashboard.css';
import './styles/studio.css';
import './styles/factory.css';
import './styles/motorsport.css';
import './styles/corporate.css';
import './styles.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
