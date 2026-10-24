import { createRoot } from 'react-dom/client';
import './styles.css';
import { Controller } from './app/controller';
import App from './app/App';
import { loadCatalog } from './catalog';
import { STORAGE_KEY } from './state/preferences';
let hasPreferences=false;
try{hasPreferences=!!localStorage.getItem(STORAGE_KEY);}catch{/* URL-only mode remains available. */}
if(location.search||hasPreferences)await loadCatalog();
const controller=new Controller({href:()=>location.href,history:(url,push)=>push?history.pushState(null,'',url):history.replaceState(null,'',url),storage:()=>localStorage});
createRoot(document.getElementById('root')!).render(<App controller={controller}/>);
