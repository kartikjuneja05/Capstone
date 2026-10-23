import {useState,useRef,useEffect} from 'react';
import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';
import {POSES,FRONT_POSES} from './routines';
import {poseImage,conflictingReferences} from './assets';
import {extractFeatures} from './evaluation';
const CONNECTIONS=[[11,13],[13,15],[12,14],[14,16],[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32]];
export function useCamera(onFrame,{loadReferences=true}={}){
 const video=useRef(null),canvas=useRef(null),model=useRef(null),stream=useRef(null),frame=useRef(null),callback=useRef(onFrame),token=useRef(0),references=useRef({}),initializing=useRef(null),disposed=useRef(false);
 const [active,setActive]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[modelStatus,setModelStatus]=useState('');
 callback.current=onFrame;
 const stop=()=>{token.current++;cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setActive(false);setLoading(false);callback.current(null,performance.now());canvas.current?.getContext('2d').clearRect(0,0,canvas.current.width,canvas.current.height);};
 async function initialize(){
  if(model.current)return;if(initializing.current)return initializing.current;
  initializing.current=(async()=>{
   setModelStatus('Loading the on-device pose model…');
   const resolver=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
   const detector=await PoseLandmarker.createFromOptions(resolver,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},runningMode:'IMAGE',numPoses:1,minPoseDetectionConfidence:.6,minTrackingConfidence:.6});
   if(disposed.current){detector.close();return;}
   if(loadReferences)setModelStatus('Reading compatible reference images…');
   for(const pose of loadReferences?Object.values(POSES):[]){
    if(conflictingReferences.has(pose.id)||pose.id==='makarasana')continue;
    try{const image=new Image();image.src=poseImage(pose);await image.decode();const result=detector.detect(image);const lm=result.landmarks?.[0];
     if(lm){const view=FRONT_POSES.has(pose.id)?'front':'side';let f=extractFeatures(lm,image.naturalWidth,image.naturalHeight,view,'left');if(f.error&&view==='side')f=extractFeatures(lm,image.naturalWidth,image.naturalHeight,view,'right');if(!f.error)references.current[pose.id]=f;}
    }catch{/* Rules remain available when an illustration cannot be detected reliably. */}
   }
   if(disposed.current){detector.close();return;}
   await detector.setOptions({runningMode:'VIDEO'});if(disposed.current){detector.close();return;}model.current=detector;setModelStatus('Tracking runs on this device');
  })();
  try{await initializing.current;}finally{initializing.current=null;}
 }
 async function start(){
  if(loading||active)return;const ownToken=++token.current;setLoading(true);setError('');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Open this app on localhost or HTTPS to use your camera.');
   const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
   if(ownToken!==token.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;await initialize();if(ownToken!==token.current)return;
   video.current.srcObject=media;await video.current.play();if(ownToken!==token.current)return;
   setLoading(false);setActive(true);let previousVideoTime=-1,lastDetection=0;
   const tick=now=>{
    if(ownToken!==token.current)return;
    const v=video.current;
    try{if(v?.readyState>=2&&v.currentTime!==previousVideoTime&&now-lastDetection>=70){
     lastDetection=now;previousVideoTime=v.currentTime;const result=model.current.detectForVideo(v,now);const landmarks=result.landmarks?.[0];
     const c=canvas.current;if(c){c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#b7efbd';ctx.lineWidth=4;
      if(landmarks)for(const [a,b] of CONNECTIONS){if(landmarks[a].visibility<.6||landmarks[b].visibility<.6)continue;ctx.beginPath();ctx.moveTo(landmarks[a].x*c.width,landmarks[a].y*c.height);ctx.lineTo(landmarks[b].x*c.width,landmarks[b].y*c.height);ctx.stroke();}}
     callback.current(landmarks?{landmarks,width:v.videoWidth,height:v.videoHeight}:null,now);
    }}catch(e){stop();setError('Tracking stopped. Restart the camera to try again.');return;}
    frame.current=requestAnimationFrame(tick);
   };frame.current=requestAnimationFrame(tick);
  }catch(e){if(ownToken!==token.current)return;stop();setError(e.name==='NotAllowedError'?'Camera access was denied. Allow this site in your browser and try again.':e.name==='NotFoundError'?'No camera was found. Connect a camera and try again.':e.message);}
 }
 useEffect(()=>()=>{disposed.current=true;token.current++;cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(t=>t.stop());model.current?.close();},[]);
 return {video,canvas,active,loading,error,modelStatus,start,stop,references};
}
