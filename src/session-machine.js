export const REST_SECONDS=15,PREPARE_SECONDS=5,RECOGNITION_SECONDS=3;
export function initialSession(queue,holdSeconds){return {phase:'prepare',remaining:PREPARE_SECONDS,index:0,queue,holdSeconds,recognizedSeconds:0,wrongSeconds:0,trackedSeconds:0,inRangeSeconds:0,results:[],paused:false};}
export function advanceSession(state,dt,observation={}){
 if(state.paused||state.phase==='done')return state;
 const s={...state};
 if(['prepare','rest'].includes(s.phase)){
  s.remaining=Math.max(0,s.remaining-dt);
  if(s.remaining===0){if(s.phase==='rest'){if(s.index+1>=s.queue.length)s.phase='done';else{s.index++;s.phase='prepare';s.remaining=PREPARE_SECONDS;}}else{s.phase='recognize';s.recognizedSeconds=0;s.wrongSeconds=0;}}
  return s;
 }
 if(!observation.visible){s.recognizedSeconds=0;s.wrongSeconds+=dt;if(s.phase==='hold'&&s.wrongSeconds>=1.5){s.phase='recognize';s.recognizedSeconds=0;}return s;}
 if(s.phase==='recognize'){
  s.recognizedSeconds=observation.recognized&&observation.steady?s.recognizedSeconds+dt:0;
  if(s.recognizedSeconds>=RECOGNITION_SECONDS){s.phase='hold';s.remaining=s.holdSeconds;s.recognizedSeconds=0;s.wrongSeconds=0;}
  return s;
 }
 if(s.phase==='hold'){
  if(!observation.recognized){s.wrongSeconds+=dt;if(s.wrongSeconds>=1.5){s.phase='recognize';s.recognizedSeconds=0;}return s;}
  s.wrongSeconds=0;s.trackedSeconds+=dt;
  if(observation.inRange){s.inRangeSeconds+=dt;s.remaining=Math.max(0,s.remaining-dt);}
  if(s.remaining===0)return finishEntry(s,'completed');
 }
 return s;
}
export function finishEntry(state,status='skipped'){
 const entry=state.queue[state.index];
 return {...state,phase:'rest',remaining:REST_SECONDS,recognizedSeconds:0,wrongSeconds:0,trackedSeconds:0,inRangeSeconds:0,results:[...state.results,{...entry,status,trackedSeconds:Math.round(state.trackedSeconds*10)/10,inRangeSeconds:Math.round(state.inRangeSeconds*10)/10}]};
}
