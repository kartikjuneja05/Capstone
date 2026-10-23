import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {api} from './api.js';
import {Auth} from './components/Auth.jsx';
import {Home} from './components/Home.jsx';
import {Workout} from './components/Workout.jsx';
import {ROMAssessment} from './components/ROMAssessment.jsx';
import {normalizeProfile} from './rom.js';
import './style.css';
function App(){
 const [user,setUser]=useState(null),[profile,setProfile]=useState({version:3,measurements:{}}),[history,setHistory]=useState([]),[routine,setRoutine]=useState(null),[rom,setROM]=useState(false),[auth,setAuth]=useState(false),[serverError,setServerError]=useState(''),[booting,setBooting]=useState(true);
 async function refresh(account){setUser(account);const results=await Promise.allSettled([api('/profile'),api('/sessions')]);if(results[0].status==='fulfilled')setProfile(normalizeProfile(results[0].value));else throw results[0].reason;if(results[1].status==='fulfilled')setHistory(results[1].value.sessions);else throw results[1].reason;setServerError('');}
 useEffect(()=>{api('/auth/me').then(async r=>{if(r.user)await refresh(r.user);}).catch(e=>setServerError('Account service unavailable. Start the backend to sign in and save sessions.')).finally(()=>setBooting(false));},[]);
 async function saveProfile(p){await api('/profile',{method:'PUT',body:p});setProfile(p);}
 async function refreshHistory(){const data=await api('/sessions');setHistory(data.sessions);}
 async function logout(){try{await api('/auth/logout',{method:'POST',body:{}});setUser(null);setProfile({version:3,measurements:{}});setHistory([]);setRoutine(null);setROM(false);}catch(e){setServerError(e.message);}}
 return <div className="app"><header><button className="brand" onClick={()=>{setRoutine(null);setROM(false);}}>YogKinetix<span> / yoga, at your pace</span></button><div className="header-right"><span className="private">● Camera stays on your device</span>{booting?<span>Loading…</span>:user?<><span className="user-name">Hi, {user.name}</span><button onClick={logout}>Sign out</button></>:<button onClick={()=>setAuth(true)}>Sign in</button>}</div></header>{serverError&&<p className="error server-banner" role="alert">{serverError}</p>}<main>{rom?<ROMAssessment profile={profile} user={user} onSave={saveProfile} onSignIn={()=>setAuth(true)} onBack={()=>setROM(false)}/>:routine?<Workout key={routine.id} routine={routine} user={user} profile={profile} onROM={()=>{setRoutine(null);setROM(true);}} onProfile={saveProfile} onSaved={refreshHistory} onSignIn={()=>setAuth(true)} onBack={()=>setRoutine(null)}/>:<Home onROM={()=>setROM(true)} profile={profile} history={history} user={user} onSelect={r=>{setRoutine(r);window.scrollTo(0,0);}}/>}</main><footer>YOGKINETIX <span>A moment of movement. A little room to grow.</span></footer>{auth&&<Auth onClose={()=>setAuth(false)} onSignedIn={refresh}/>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
