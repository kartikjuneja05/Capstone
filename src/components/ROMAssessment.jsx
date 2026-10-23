import React,{useEffect,useRef,useState} from 'react';
import {calibrationPlan,ROM_EXERCISES} from '../rom.js';
import {romImages} from '../assets.js';
import {cameraGuidance} from '../routines.js';
import {extractFeatures,calibrationShape,stableSample} from '../evaluation.js';
import {useCamera} from '../useCamera.js';

const plan=calibrationPlan();
const LABELS={shoulder:'Arm raise',elbow:'Elbow angle',hip:'Hip angle',knee:'Knee angle',hipAbduction:'Thigh spread'};
export function ROMAssessment({profile,user,onSave,onSignIn,onBack}){
 const [stage,setStage]=useState('intro'),[index,setIndex]=useState(0),[audio,setAudio]=useState(true),[progress,setProgress]=useState(0),[remaining,setRemaining]=useState(5),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[results,setResults]=useState(null);
 const current=useRef({stage,index,audio}),draft=useRef({version:3,measurements:{}}),samples=useRef({}),started=useRef(null),deadline=useRef(0),lastFrame=useRef(0);
 current.current={stage,index,audio};
 function speak(text){if(!current.current.audio||!window.speechSynthesis)return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.rate=.95;window.speechSynthesis.speak(utterance);}
 function clear(){samples.current={};started.current=null;setProgress(0);}
 async function save(value){setSaving(true);setError('');try{await onSave(value);setSaved(true);}catch(e){setError(e.message);}finally{setSaving(false);}}
 function advance(){
  clear();setMessage('');const next=current.current.index+1;
  if(next>=plan.length){current.current.stage='results';setStage('results');setResults(draft.current);camera.stop();window.speechSynthesis?.cancel();save(draft.current);}
  else{current.current.index=next;setIndex(next);deadline.current=performance.now()+5000;setRemaining(5);}
 }
 function frame(raw,now){
  if(current.current.stage!=='measure')return;
  lastFrame.current=now;
  if(!raw){clear();setMessage('Tracking is unavailable. Enable your camera to continue.');return;}
  const exercise=plan[current.current.index],side=exercise.side==='both'?'left':exercise.side;
  const features=extractFeatures(raw.landmarks,raw.width,raw.height,exercise.view,side);
  const speaking=current.current.audio&&window.speechSynthesis?.speaking;
  if(document.hidden||now<deadline.current||speaking||features.error||!calibrationShape(exercise,features)){
   clear();setMessage(features.error||(!speaking&&now>=deadline.current?'Follow the reference at your comfortable limit; keep all joints visible.':''));return;
  }
  const sides=exercise.side==='both'?['left','right']:[side];
  if(started.current===null)started.current=now;
  for(const s of sides){(samples.current[s]??=[]).push(features.bySide[s]);if(samples.current[s].length>100)samples.current[s].shift();}
  setProgress(Math.min(100,(now-started.current)/3000*100));setMessage('Measuring your comfortable position. Hold steady and breathe.');
  if(now-started.current>=3000){
   const captured=sides.map(s=>[s,stableSample(samples.current[s],exercise.keys)]);
   if(captured.some(([,values])=>!values)){clear();setMessage('Move less while holding comfortably; we’ll measure again.');return;}
   for(const [s,values] of captured)draft.current.measurements[`${exercise.id}:${s}`]={values,measuredAt:new Date().toISOString()};
   advance();
  }
 }
 const camera=useCamera(frame,{loadReferences:false});
 function begin(){draft.current={version:3,measurements:{}};setSaved(false);setError('');setIndex(0);current.current={stage:'measure',index:0,audio};setStage('measure');deadline.current=performance.now()+5000;setRemaining(5);clear();}
 useEffect(()=>{if(stage==='measure'){const e=plan[index];speak(`${e.title}. ${cameraGuidance(e.view,e.side)} ${e.text} Hold your comfortable limit steady for three seconds. You can skip this movement.`);}},[stage,index]);
 useEffect(()=>{const timer=setInterval(()=>{if(current.current.stage!=='measure')return;const now=performance.now();setRemaining(Math.max(0,Math.ceil((deadline.current-now)/1000)));if(now-lastFrame.current>500||document.hidden)clear();},100);return()=>clearInterval(timer);},[]);
 useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
 const exercise=plan[index];
 return <><div className="workout-heading"><button className="text-button" onClick={()=>{camera.stop();onBack();}}>← All routines</button><p className="eyebrow">SHARED RANGE OF MOTION ASSESSMENT</p><h1>Your range.<br/>Your comfortable pace.</h1></div>
 {stage==='intro'?<section className="rom-intro"><h2>One profile for every routine.</h2><p>Perform these five movements only to your comfortable limit. The camera records a stable three-second position. Front views measure both sides together; the squat and forward fold repeat with each side facing the camera. Allow about 4–6 minutes, including instructions and positioning.</p><div className="overview-poses">{Object.entries(ROM_EXERCISES).map(([id,e])=><div key={id}><img src={romImages[id]} alt={e.title}/><span>{e.title}</span></div>)}</div><p>Use good lighting, a level camera and enough space to keep your head, hands and feet in view. Wear clothing that lets the camera see your body outline. Move slowly, breathe naturally and stop before pain or strain.</p><p className="note">These are visible 2D joint-reach estimates, not a clinical ROM examination. Neck motion, spinal curvature, balance and floor-pose strength are not measured. Saved measurements last 30 days. Skipping a movement leaves out routine holds that need that measurement. A new assessment replaces the previous profile when saved.</p><label className="toggle"><input type="checkbox" checked={audio} onChange={e=>setAudio(e.target.checked)}/> Spoken instructions</label>{user?<button className="primary" onClick={begin}>Begin shared assessment →</button>:<button className="primary" onClick={onSignIn}>Sign in to save my assessment →</button>}{Object.keys(profile.measurements).length>0&&<p>You already have a saved profile. Retest when your comfortable reach changes.</p>}</section>:stage==='results'?<section className="result-card"><p className="eyebrow">ASSESSMENT COMPLETE</p><h2>Your comfortable reach.</h2><p>{Object.keys(results.measurements).length} of 10 side measurements recorded. Relevant saved measurements will be reused across all routines.</p><div className="rom-results">{Object.entries(results.measurements).map(([key,m])=>{const [id,side]=key.split(':');return <div key={key}><h3>{ROM_EXERCISES[id].title} · {side}</h3><p>{Object.entries(m.values).map(([name,value])=>`${LABELS[name]}: ${value}°`).join(' · ')}</p></div>;})}</div><p className="note">Joint angles describe your captured position; smaller knee/elbow angles mean more bending. These values do not establish safe maximums for untested movements.</p><p role="status">{saving?'Saving your assessment…':saved?'Saved to your account. Choose a routine from the homepage.':'Your assessment has not been saved.'}</p>{error&&<p className="error" role="alert">{error}</p>}{!saving&&!saved&&<button className="primary" onClick={()=>save(results)}>Retry saving</button>}<button className="primary" disabled={saving||!saved} onClick={onBack}>Back to routines →</button><button className="secondary" disabled={saving} onClick={begin}>Repeat assessment</button></section>:<div className="workspace"><section className="camera-panel"><div className="camera"><video ref={camera.video} playsInline muted/><canvas ref={camera.canvas}/>{!camera.active&&<div className="camera-placeholder"><span>◎</span><h2>Your comfortable range</h2><p>{camera.loading?camera.modelStatus:'Enable your camera to begin measuring.'}</p></div>}<span className="camera-tag">{exercise.view.toUpperCase()} VIEW · {exercise.side==='both'?'BOTH SIDES':exercise.side.toUpperCase()}</span></div><div className="camera-bottom"><p role="status">{camera.error||message||camera.modelStatus}</p><button onClick={camera.active||camera.loading?camera.stop:camera.start}>{camera.loading?'Cancel':camera.active?'Stop camera':'Enable camera'}</button></div><div className="position"><h3>Position your camera</h3><p>{cameraGuidance(exercise.view,exercise.side)} Keep a margin around your body and use good lighting.</p><label className="toggle"><input type="checkbox" checked={audio} onChange={e=>{setAudio(e.target.checked);if(!e.target.checked)window.speechSynthesis?.cancel();}}/> Audio guidance</label></div></section><aside><p className="eyebrow">STEP {index+1} OF {plan.length} · FIVE MOVEMENTS</p><h2>{exercise.title}</h2><figure className="pose-reference"><img src={romImages[exercise.id]} alt={exercise.title}/><figcaption>Your supplied ROM reference</figcaption></figure><p className="side-note">{exercise.side==='both'?'Both sides together':`${exercise.side} side nearest camera`}</p><p>{exercise.text}</p>{remaining>0?<p className="countdown">{remaining}<small>seconds to prepare</small></p>:<><div className="progress"><div style={{width:`${progress}%`}}/></div><p className="capture">{message||'Hold your comfortable limit steady for three seconds.'}</p></>}<button className="secondary" onClick={()=>speak(`${cameraGuidance(exercise.view,exercise.side)} ${exercise.text}`)}>Repeat spoken instructions</button><button className="secondary" onClick={advance}>Skip this movement {exercise.side==='both'?'':`/ ${exercise.side} side`}</button><p className="note">Stay within comfort. You do not need to match the depth shown in the reference.</p></aside></div>}
 </>;
}
