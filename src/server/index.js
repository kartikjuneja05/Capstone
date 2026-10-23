import {createServer} from 'node:http';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {openStore} from './store.js';
import {createApp} from './app.js';
const production=process.env.NODE_ENV==='production';
if(production&&!process.env.APP_ORIGIN?.startsWith('https://'))throw new Error('Set APP_ORIGIN to the HTTPS origin for production.');
mkdirSync('src/server/storage',{recursive:true,mode:0o700});
const store=openStore(process.env.DATABASE_PATH||'src/server/storage/still.sqlite');
const api=createApp(store,{production,origin:process.env.APP_ORIGIN||'http://localhost:5173'});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const root=resolve('src/dist');
const server=createServer((req,res)=>{
 if(req.url.startsWith('/api/'))return api(req,res);
 if(!production){res.writeHead(404);res.end('Use the Vite frontend at http://localhost:5173');return;}
 const pathname=new URL(req.url,'http://localhost').pathname;
 let path=resolve(root,'.'+pathname);
 if(!path.startsWith(root+'/'))path=resolve(root,'index.html');
 if(!existsSync(path)||pathname.endsWith('/'))path=resolve(root,'index.html');
 try{const bytes=readFileSync(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(bytes);}catch{res.writeHead(404);res.end('Build the frontend with npm run build first.');}
});
const port=Number(process.env.PORT||3001);
server.on('error',error=>{
 console.error(error.code==='EADDRINUSE'
  ? `Port ${port} is already in use. Stop the other YogKinetix development server (Ctrl+C in its terminal), then run npm run dev again.`
  : `Could not start the API: ${error.message}`);
 store.close();
 process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>console.log('YogKinetix API listening at http://127.0.0.1:'+server.address().port));
function close(){server.close(()=>{store.close();process.exit(0);});}
process.on('SIGTERM',close);process.on('SIGINT',close);
