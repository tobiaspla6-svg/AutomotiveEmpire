import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/700.css';
import './lab.css';
import { TuningLab } from './TuningLab';
createRoot(document.getElementById('root')!).render(<TuningLab />);
