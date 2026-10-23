import {measurement} from './rom.js';
import {angle} from './geometry.js';
const IDS={left:{shoulder:11,elbow:13,wrist:15,hip:23,knee:25,ankle:27,heel:29,foot:31},right:{shoulder:12,elbow:14,wrist:16,hip:24,knee:26,ankle:28,heel:30,foot:32}};
const degrees=(x,y)=>Math.atan2(Math.abs(y),Math.abs(x))*180/Math.PI;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function extractFeatures(landmarks,width,height,view='side',side='left'){
 if(!landmarks||landmarks.length<33)return {error:'Step into view so the camera can find your body.'};
 const sides=view==='front'?['left','right']:[side];
 const required=[0,...sides.flatMap(s=>Object.values(IDS[s]))];
 if(required.some(i=>(landmarks[i]?.visibility??0)<.6||(landmarks[i]?.presence??1)<.6))return {error:'Some joints are hidden. Adjust your position or camera for a clearer view.'};
 if(required.some(i=>landmarks[i].x<.01||landmarks[i].x>.99||landmarks[i].y<.01||landmarks[i].y>.99))return {error:'Move back a little. Keep your head, hands and feet fully inside the frame.'};
 const points=landmarks.map(l=>({x:l.x*width,y:l.y*height}));
 const bySide={};
 for(const s of sides){const p=Object.fromEntries(Object.entries(IDS[s]).map(([key,i])=>[key,points[i]]));
 const length=dist(p.shoulder,p.hip);if(length<height*.065)return {error:'Move a little closer, keeping your whole body visible.'};
 const f={
  hipAbduction:degrees(p.knee.y-p.hip.y,p.knee.x-p.hip.x),
  shoulder:angle(p.hip,p.shoulder,p.elbow),elbow:angle(p.shoulder,p.elbow,p.wrist),hip:angle(p.shoulder,p.hip,p.knee),knee:angle(p.hip,p.knee,p.ankle),
  torsoTilt:degrees(p.shoulder.y-p.hip.y,p.shoulder.x-p.hip.x),
  torsoElevation:degrees(p.shoulder.x-p.hip.x,p.shoulder.y-p.hip.y),
  legElevation:degrees(p.ankle.x-p.hip.x,p.ankle.y-p.hip.y),
  upright:p.shoulder.y<p.hip.y&&p.hip.y<p.knee.y,
  wristToFace:dist(p.wrist,points[0])/length,
  wristToAnkle:dist(p.wrist,p.ankle)/length,
  ankleToOtherHip:dist(p.ankle,points[IDS[s==='left'?'right':'left'].hip])/length,
  wristAboveShoulder:p.wrist.y<p.shoulder.y,
  heelAboveToe:(p.foot.y-p.heel.y)/length,
  kneeHeight:p.knee.y/length,ankleHeight:p.ankle.y/length,
  bodyLength:length,
 };
 if(['shoulder','elbow','hip','knee'].some(k=>f[k]===null))return {error:'Hold still while your joints are located.'};
 bySide[s]=f;
 }
 const f=bySide[side]||bySide.left;
 const shoulderWidth=dist(points[11],points[12])/f.bodyLength;
 // Only check orientation when both shoulders are reliable; hidden shoulder uncertainty is expected side-on.
 if(landmarks[11].visibility>.65&&landmarks[12].visibility>.65){
  if(view==='front'&&shoulderWidth<.24)return {error:'Face the camera directly so both sides are visible.'};
  if(view==='side'&&Math.abs(points[11].x-points[12].x)/f.bodyLength>.7)return {error:'Turn sideways so the camera sees your profile.'};
 }
 let armSeparation=null;
 if(view==='front')armSeparation=angle({x:points[13].x-points[11].x,y:points[13].y-points[11].y},{x:0,y:0},{x:points[14].x-points[12].x,y:points[14].y-points[12].y});
 return {bySide,selected:f,points,view,side,armSeparation};
}
// Broad recognition is intentionally independent of ideal alignment and personal ROM.
export function recognize(poseId,features,activeSide='left'){
 if(features.error)return {recognized:false,cue:features.error};
 const f=features.bySide[activeSide]||features.selected;
 const other=features.bySide[activeSide==='left'?'right':'left'];
 const standing=f.upright&&f.torsoElevation>35;
 const flat=f.torsoElevation<25;
 let ok=false,cue='Follow the reference and hold comfortably so we can recognize the pose.';
 switch(poseId){
  case 'tadasana':ok=standing&&f.knee>125&&f.shoulder>70;cue='Stand tall and lift both arms overhead.';break;
  case 'vrikshasana':ok=!!other&&other.upright&&f.torsoElevation>35&&f.knee<150&&other.knee>125&&f.ankleToOtherHip<1.25;cue=`Lift your ${activeSide} foot against the opposite inner leg and keep your torso upright.`;break;
  case 'vajrasana':ok=f.torsoElevation>55&&f.knee<110&&f.hip>35&&f.hip<135;cue='Sit gently on your folded legs with your spine upright.';break;
  case 'makarasana':ok=flat&&f.knee>120&&f.elbow<145&&f.wristToFace<.95;cue='Rest on your stomach with your head on the cushion of your folded arms.';break;
  case 'shavasana':ok=flat&&f.legElevation<20&&f.knee>125&&f.shoulder<65&&f.wristToFace>1;cue='Lie on your back with legs resting on the floor and arms relaxed beside you.';break;
  case 'ardhashalabhasana':ok=flat&&f.legElevation>5&&f.legElevation<65&&f.shoulder<65;cue=`Lie on your stomach and gently lift your ${activeSide} leg, leaving the other leg down.`;break;
  case 'ardhahalasana':case 'uttanapadasana':ok=flat&&f.legElevation>12&&f.shoulder<65&&f.hip<170;cue='Lie on your back and raise your straight legs together, keeping your head down.';break;
  case 'niralamba_bhujangasana':ok=f.torsoElevation>10&&f.torsoElevation<75&&f.legElevation<25&&f.elbow<145&&f.wristToFace<.85;cue='Use your forearms to lift your chest gently and rest your chin in your open palms.';break;
  case 'trikonasana':ok=standing&&f.torsoTilt>8&&f.knee>120&&!!other&&other.knee>120&&features.armSeparation>115;cue=`Bend toward your ${activeSide} side, lowering that hand and extending the other arm upward.`;break;
  case 'hastottanasana':ok=standing&&f.torsoTilt>7&&f.shoulder>85&&f.wristAboveShoulder;cue=`With arms overhead, bend gently toward your ${activeSide} side.`;break;
  case 'paschimottanasana':ok=!standing&&f.hip<125&&f.knee>120&&f.legElevation<25;cue='Sit with legs extended and gently fold forward toward your feet.';break;
  case 'naukasana':ok=f.torsoElevation>10&&f.torsoElevation<75&&f.legElevation>10&&f.legElevation<75&&f.hip<165&&!standing;cue='From lying on your back, lift your upper trunk and legs together into a gentle boat shape.';break;
 }
 // Front-view asymmetric bends must be in the requested direction.
 if(ok&&['trikonasana','hastottanasana'].includes(poseId)){
  const p=features.points,midHip={x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2},midShoulder={x:(p[11].x+p[12].x)/2,y:(p[11].y+p[12].y)/2};
  const direction=p[IDS[activeSide].hip].x-midHip.x;
  ok=(midShoulder.x-midHip.x)*direction>0;
 }
 return {recognized:ok,cue:ok?'Pose shape recognized. Hold comfortably.':cue};
}
export function referenceDistance(live,reference){
 if(!reference||reference.error||live.error)return null;
 const a=live.selected,b=reference.selected;
 const keys=['shoulder','elbow','hip','knee'];
 return keys.reduce((sum,k)=>sum+Math.abs(a[k]-b[k])/180,0)/keys.length;
}
export function stableSample(samples,keys){
 if(samples.length<20)return null;const values={};
 for(const [key,direction] of Object.entries(keys)){
  const sorted=samples.map(s=>s[key]).filter(Number.isFinite).sort((a,b)=>a-b);
  if(sorted.length<20||sorted[Math.floor(sorted.length*.9)]-sorted[Math.floor(sorted.length*.1)]>(key==='wristToAnkle'?.2:14))return null;
  const value=sorted[Math.floor(sorted.length*(direction==='min'?.25:.75))];values[key]=key==='wristToAnkle'?Math.round(value*100)/100:Math.round(value);
 }
 return values;
}
export function calibrationShape(exercise,features){
 if(features.error)return false;
 const sides=exercise.side==='both'?['left','right']:[exercise.side];
 return sides.every(side=>{const f=features.bySide[side];if(!f)return false;
  if(exercise.id==='arms_up')return f.upright&&f.torsoTilt<20;
  if(exercise.id==='wide_stance')return f.upright&&f.torsoTilt<20&&f.knee>120;
  if(exercise.id==='squat')return f.torsoElevation>30&&f.knee<170;
  if(exercise.id==='forward_fold')return f.knee>120&&f.hip<175;
  if(exercise.id==='elbow_bend')return f.upright&&f.elbow<170;
  return false;
 });
}
function profileValues(profile,id,side){return measurement(profile,id,side);}
export function personalTarget(poseId,key,ideal,profile,side){
 const get=id=>profileValues(profile,id,side)||{};
 if(key==='shoulder'&&ideal===180)return Math.min(ideal,get('arms_up').shoulder??ideal);
 if(key==='elbow'&&ideal===180)return Math.min(ideal,get('arms_up').elbow??ideal);
 if(key==='knee'&&ideal===180)return Math.min(ideal,Math.max(get('arms_up').knee??ideal,get('wide_stance').knee??ideal,get('forward_fold').knee??ideal));
 if(key==='hip'&&ideal===180)return Math.min(ideal,get('arms_up').hip??ideal);
 // Standing folds and squats must not be treated as measured supine raises, prone lifts or seated bends.
 return ideal;
}
function directionalCue(poseId,key,value,target,ideal){
 const low=Math.min(target,ideal),high=Math.max(target,ideal);
 if(key==='shoulder'&&ideal===0)return 'Let your arms rest beside your body.';
 if(key==='legElevation')return value<low?'Raise your legs a little within your comfortable range.':'Lower your legs a little toward the instructed angle.';
 if(key==='torsoElevation'&&ideal===0)return 'Let your head and trunk rest on the mat.';
 if(key==='torsoElevation'&&poseId==='naukasana')return value<low?'Lift your upper trunk a little within comfort.':'Ease your upper trunk down a little.';
 if(key==='hip'&&['ardhahalasana','uttanapadasana'].includes(poseId))return value>high?'Raise your legs a little within comfort.':'Lower your legs a little toward your target.';
 if(key==='hip'&&ideal===180)return 'Stand tall with your chest above your hips.';
 return CUES[key];
}
const CUES={shoulder:'Lift your arms a little higher within your comfortable reach.',elbow:'Gently straighten your elbows without forcing them.',knee:'Gently lengthen your legs without locking your knees.',hip:'Adjust your torso and hips toward your comfortable position.',torsoTilt:'Bring your chest back over your hips.',torsoElevation:'Adjust your chest lift toward your comfortable range.',legElevation:'Adjust your leg lift toward your comfortable range.',armSeparation:'Extend your arms in opposite directions, one down and one up.'};
export function evaluate(pose,features,profile,activeSide='left'){
 if(features.error)return {inRange:false,metrics:[],cue:features.error};
 const f=features.bySide[activeSide]||features.selected,metrics=[];
 const sides=features.view==='front'?['left','right']:[features.side];
 for(const [name,spec] of Object.entries(pose.idealAngles)){
  if(spec.degrees===null)continue;
  let key=name;if(name==='supportingHip'||name==='restingHip')key='hip';if(name==='supportingKnee')key='knee';
  const apply=['supporting_leg','resting_leg'].includes(spec.appliesTo)?[activeSide==='left'?'right':'left']:sides;
  if(name==='armSeparation'){metrics.push({label:'Arm separation',value:features.armSeparation,target:180,ideal:180,ok:features.armSeparation!==null&&features.armSeparation>=160});continue;}
  for(const side of apply){const values=features.bySide[side];if(!values||!Number.isFinite(values[key]))continue;
   const target=personalTarget(pose.id,key,spec.degrees,profile,side),lo=Math.min(target,spec.degrees),hi=Math.max(target,spec.degrees),value=values[key],tolerance=['torsoTilt','torsoElevation'].includes(key)?10:8;
   metrics.push({label:(features.view==='front'?side+' ':'')+name,value,target,ideal:spec.degrees,ok:value>=lo-tolerance&&value<=hi+tolerance,cue:directionalCue(pose.id,key,value,target,spec.degrees)});
  }
 }
 // Null numeric ideals stay null: compare individual comfortable excursion or observable arrangement instead.
 const add=(label,value,target,ok,cue)=>metrics.push({label,value,target,ideal:null,ok,cue});
 if(pose.id==='vajrasana'||pose.id==='vrikshasana'){
  const side=pose.id==='vrikshasana'?activeSide:features.side,target=profileValues(profile,'squat',side)?.knee;
  if(Number.isFinite(target))add('Comfortable knee fold',f.knee,target,f.knee<=target+12,'Bend your knee gently toward your recorded comfortable range. Stop before strain.');
 }
 if(pose.id==='paschimottanasana')add('Slight elbow bend',f.elbow,null,f.elbow<175,'Soften your elbows a little as you reach.');
 if(pose.id==='niralamba_bhujangasana')add('Hands near chin',null,null,f.wristToFace<.65,'Bring your open palms beneath your chin.');
 if(pose.id==='tadasana')add('Heel lift visible',null,null,f.heelAboveToe>.015,'Lift your heels gently while keeping your balance.');
 const failed=metrics.find(m=>!m.ok),inRange=metrics.length>0&&!failed;
 return {inRange,metrics,cue:failed?.cue|| (inRange?'Your visible alignment is in range. Breathe naturally and hold comfortably.':'Hold still for a reliable measurement.'),coverage:'Visible alignment only. Floor contact, palm position, spinal curvature, pain and comfort are not fully measurable.'};
}
