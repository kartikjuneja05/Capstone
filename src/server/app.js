import catalog from '../data/asana-reference.json' with {type:'json'};
import {validateProfile} from '../shared/calibration-schema.js';
const routineIds=new Set(catalog.routines.map(r=>r.id)),poseIds=new Set(catalog.poses.map(p=>p.id));
const response=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('Expected JSON.'),{status:415});let length=0,text='';for await(const chunk of req){length+=chunk.length;if(length>65536)throw Object.assign(new Error('Request too large.'),{status:413});text+=chunk;}try{return JSON.parse(text);}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}}
const cookieToken=req=>req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('still_session='))?.slice(14);
export function validPractice(e){return e && /^[a-f0-9-]{36}$/.test(e.id||'') && routineIds.has(e.routineId) && [10,15,20].includes(e.holdSeconds) && typeof e.completed==='boolean' && Array.isArray(e.poses) && e.poses.length<=24 && e.poses.every(p=>poseIds.has(p.poseId)&&catalog.routines.find(r=>r.id===e.routineId).poseIds.includes(p.poseId)&&(catalog.poses.find(a=>a.id===p.poseId).requiresBothSides?['left','right'].includes(p.side):p.side==='both')&&['completed','skipped'].includes(p.status)&&[p.trackedSeconds,p.inRangeSeconds].every(n=>Number.isFinite(n)&&n>=0&&n<=1800)&&p.inRangeSeconds<=p.trackedSeconds);}
export function createApp(store,{origin='http://localhost:5173',production=false}={}){
 const attempts=new Map();
 function limited(req){const key=req.socket.remoteAddress,now=Date.now();if(attempts.size>1000)for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);let entry=attempts.get(key);if(!entry||entry.until<now){entry={count:0,until:now+900000};attempts.set(key,entry);}return ++entry.count>30;}
 const allowed=new Set([origin,...(!production?['http://127.0.0.1:5173']:[])]);
 const setCookie=(res,token,clear=false)=>res.setHeader('Set-Cookie',`still_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear?0:604800}${production?'; Secure':''}`);
 return async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname==='/api/health'&&req.method==='GET')return response(res,200,{ok:true});
   if(!pathname.startsWith('/api/'))return response(res,404,{error:'Not found.'});
   if(['POST','PUT','DELETE'].includes(req.method)&&!allowed.has(req.headers.origin))return response(res,403,{error:'Request origin is not allowed.'});
   const token=cookieToken(req),user=store.user(token);
   if(pathname==='/api/auth/me'&&req.method==='GET')return response(res,200,{user});
   if(['/api/auth/signup','/api/auth/login'].includes(pathname)&&req.method==='POST'){
    if(limited(req))return response(res,429,{error:'Too many sign-in attempts. Try again in 15 minutes.'});
    const input=await body(req),email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof input.password!=='string'||input.password.length<10||input.password.length>128)return response(res,400,{error:'Enter a valid email and a password between 10 and 128 characters.'});
    let account;
    if(pathname.endsWith('signup')){if(typeof input.name!=='string'||input.name.trim().length<1||input.name.trim().length>80)return response(res,400,{error:'Enter your name (up to 80 characters).'});account=await store.signup(email,input.name.trim(),input.password);}
    else account=await store.login(email,input.password);
    if(!account)return response(res,401,{error:'Email or password is incorrect.'});
    store.logout(token);setCookie(res,store.createSession(account.id));return response(res,200,{user:account});
   }
   if(pathname==='/api/auth/logout'&&req.method==='POST'){store.logout(token);setCookie(res,'',true);return response(res,200,{ok:true});}
   if(!user)return response(res,401,{error:'Please sign in to save your practice.'});
   if(pathname==='/api/profile'&&req.method==='GET')return response(res,200,store.profile(user.id));
   if(pathname==='/api/profile'&&req.method==='PUT'){const profile=await body(req);if(!validateProfile(profile))return response(res,400,{error:'Invalid calibration measurements.'});store.saveProfile(user.id,profile);return response(res,200,{ok:true});}
   if(pathname==='/api/sessions'&&req.method==='GET')return response(res,200,{sessions:store.history(user.id)});
   if(pathname==='/api/sessions'&&req.method==='POST'){const session=await body(req);if(!validPractice(session))return response(res,400,{error:'Invalid session summary.'});store.savePractice(user.id,session);return response(res,201,{ok:true});}
   response(res,404,{error:'Not found.'});
  }catch(error){if(!error.status)console.error('API error:',error.message);response(res,error.status||500,{error:error.status?error.message:'Unable to complete the request. Please try again.'});}
 };
}
