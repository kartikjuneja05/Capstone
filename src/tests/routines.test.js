import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTINES,POSES,calibrationPlan,routineQueue,eligibleQueue} from '../routines.js';
import {recognize,evaluate,personalTarget,stableSample,extractFeatures,referenceDistance,calibrationShape} from '../evaluation.js';
import {initialSession,advanceSession,finishEntry} from '../session-machine.js';
const poseFeatures=(changes={},otherChanges={})=>{const f={shoulder:180,elbow:180,hip:180,knee:180,torsoTilt:0,torsoElevation:90,legElevation:90,upright:true,wristToFace:1,wristToAnkle:2,ankleToOtherHip:1,wristAboveShoulder:true,heelAboveToe:.08,...changes};return {selected:f,bySide:{left:f,right:{...f,...otherChanges}},side:'left',view:'side',armSeparation:180};};
const profileFor=entries=>({version:3,measurements:Object.fromEntries(entries.map(([key,values])=>[key,{values,measuredAt:new Date().toISOString()}]))});
test('six routines have known poses, alternating flags expand into separate holds',()=>{
 assert.equal(ROUTINES.length,6);assert.equal(Object.keys(POSES).length,13);
 for(const r of ROUTINES){for(const id of r.poseIds){assert.ok(POSES[id]);assert.equal(calibrationPlan(r).length,7);}const queue=routineQueue(r);assert.equal(queue.length,r.poseIds.reduce((sum,id)=>sum+(POSES[id].requiresBothSides?2:1),0));}
 assert.deepEqual(routineQueue(ROUTINES[0]).map(p=>p.side),['left','right','both']);
});
test('shared profile is reused across every routine and skips exclude only dependent poses',()=>{
 assert.equal(eligibleQueue(ROUTINES[0],{version:3,measurements:{}}).allowed.length,0);
 const values={arms_up:{shoulder:150,elbow:175,hip:175,knee:175},wide_stance:{hipAbduction:30,knee:175},squat:{hip:70,knee:50},forward_fold:{hip:90,knee:175},elbow_bend:{elbow:40}};
 const complete=profileFor(Object.entries(values).flatMap(([id,v])=>['left','right'].map(side=>[`${id}:${side}`,v])));
 for(const r of ROUTINES)assert.equal(eligibleQueue(r,complete).allowed.length,routineQueue(r).length);
 const skipped=structuredClone(complete);delete skipped.measurements['squat:left'];
 assert.deepEqual(eligibleQueue(ROUTINES[0],skipped).allowed.map(p=>[p.poseId,p.side]),[['vrikshasana','right']]);
 const stale=structuredClone(complete);for(const m of Object.values(stale.measurements))m.measuredAt='2000-01-01';
 assert.equal(eligibleQueue(ROUTINES[0],stale).allowed.length,0);
 const legacy={...complete,version:2};assert.equal(eligibleQueue(ROUTINES[0],legacy).allowed.length,0);
});
test('assessment has exactly five supplied movements and seven visibility steps',()=>{
 const a=calibrationPlan(ROUTINES[0]),b=calibrationPlan(ROUTINES[5]);assert.deepEqual(a,b);
 assert.deepEqual([...new Set(a.map(e=>e.id))],['arms_up','wide_stance','squat','forward_fold','elbow_bend']);
 assert.deepEqual(a.filter(e=>e.view==='front').map(e=>e.side),['both','both','both']);
 assert.deepEqual(a.filter(e=>e.id==='squat').map(e=>e.side),['left','right']);
});
test('recognition is separate from ideal alignment and rejects unrelated pose families',()=>{
 const tadas=poseFeatures({shoulder:100});assert.equal(recognize('tadasana',tadas).recognized,true);assert.equal(recognize('shavasana',tadas).recognized,false);
 const resting=poseFeatures({torsoElevation:0,legElevation:0,upright:false,shoulder:10,wristToFace:2});assert.equal(recognize('shavasana',resting).recognized,true);assert.equal(recognize('uttanapadasana',resting).recognized,false);
 const cobra=poseFeatures({torsoElevation:30,legElevation:0,upright:false,elbow:90,wristToFace:.3});assert.equal(recognize('niralamba_bhujangasana',cobra).recognized,true);assert.equal(recognize('niralamba_bhujangasana',poseFeatures({torsoElevation:30,legElevation:0,upright:false,elbow:180,wristToFace:1.3})).recognized,false);
});
test('shared measured arm reach personalizes the full target-to-ideal interval',()=>{
 const p=profileFor([['arms_up:left',{shoulder:130,elbow:175,hip:175,knee:175}]]);
 assert.equal(personalTarget('tadasana','shoulder',180,p,'left'),130);
 assert.equal(evaluate(POSES.tadasana,poseFeatures({shoulder:150}),p).inRange,true);
 assert.equal(evaluate(POSES.tadasana,poseFeatures({shoulder:100}),p).inRange,false);
 assert.equal(personalTarget('ardhahalasana','hip',90,p,'left'),90);
});
test('unquantified knee fold is personalized rather than given a fabricated ideal',()=>{
 const p=profileFor([['squat:left',{hip:90,knee:40}]]);const assessed=evaluate(POSES.vajrasana,poseFeatures({hip:90,knee:45}),p);
 const knee=assessed.metrics.find(m=>m.label==='Comfortable knee fold');assert.equal(knee.ideal,null);assert.equal(knee.target,40);assert.equal(knee.ok,true);
});
test('capture rejects moving samples and uses comfortable percentiles',()=>{assert.equal(stableSample([],{hip:'min'}),null);assert.deepEqual(stableSample(Array.from({length:30},()=>({hip:110})),{hip:'min'}),{hip:110});assert.equal(stableSample(Array.from({length:30},(_,i)=>({hip:i*3})),{hip:'min'}),null);});
test('uncertain or clipped landmarks never become a pose match',()=>{const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.9}));lm[15].visibility=.1;assert.ok(extractFeatures(lm,1280,720).error);assert.equal(recognize('tadasana',{error:'hidden'}).recognized,false);lm[15].visibility=.9;lm[31].x=1.1;assert.ok(extractFeatures(lm,1280,720).error);assert.equal(referenceDistance({error:'hidden'},null),null);});
test('countdowns are 5-second preparation and 15-second rest with automatic next side',()=>{
 let s=initialSession([{poseId:'vrikshasana',side:'left'},{poseId:'vrikshasana',side:'right'}],10);
 s=advanceSession(s,5);assert.equal(s.phase,'recognize');
 s=advanceSession(s,2,{visible:true,recognized:true,steady:true});assert.equal(s.phase,'recognize');
 s=advanceSession(s,1,{visible:true,recognized:true,steady:true});assert.equal(s.phase,'hold');
 s=advanceSession(s,10,{visible:true,recognized:true,steady:true,inRange:true});assert.equal(s.phase,'rest');assert.equal(s.remaining,15);assert.equal(s.results[0].inRangeSeconds,10);
 s=advanceSession(s,15);assert.equal(s.index,1);assert.equal(s.phase,'prepare');assert.equal(s.remaining,5);
 s=finishEntry(s);s=advanceSession(s,15);assert.equal(s.phase,'done');
});
test('wrong shape, tracking loss, bad alignment and pause do not consume a hold',()=>{
 let s={...initialSession([{poseId:'tadasana',side:'both'}],15),phase:'hold',remaining:15};
 s=advanceSession(s,.5,{visible:false});assert.equal(s.remaining,15);
 s=advanceSession(s,.5,{visible:true,recognized:false});assert.equal(s.remaining,15);
 s=advanceSession(s,.5,{visible:true,recognized:true,inRange:false});assert.equal(s.remaining,15);
 const paused={...s,paused:true};assert.equal(advanceSession(paused,10,{visible:true,recognized:true,inRange:true}),paused);
 s=advanceSession(s,2,{visible:false});assert.equal(s.phase,'recognize');
});

test('aspect correction preserves pixel-space joint geometry',()=>{
 const lm=Array.from({length:33},()=>({x:.5,y:.5,visibility:.9,presence:.9}));
 const coordinates={0:[320,160],11:[320,200],13:[400,120],15:[480,200],23:[320,400],25:[320,450],27:[320,480],29:[318,480],31:[330,480]};
 for(const [id,[x,y]] of Object.entries(coordinates)){lm[id].x=x/1000;lm[id].y=y/500;}lm[12].visibility=.1;
 const f=extractFeatures(lm,1000,500,'side','left');assert.equal(f.error,undefined);assert.equal(f.selected.elbow,90);
});
test('high tree placement is recognized using the supporting leg, not raised-knee height',()=>{
 const f=poseFeatures({knee:50,upright:false,ankleToOtherHip:.3},{knee:180,upright:true});f.view='front';
 assert.equal(recognize('vrikshasana',f).recognized,true);
});
test('proportional hand reach captures decimals and rejects unstable movement',()=>{
 assert.deepEqual(stableSample(Array.from({length:30},()=>({wristToAnkle:.67})),{wristToAnkle:'min'}),{wristToAnkle:.67});
 assert.equal(stableSample(Array.from({length:30},(_,i)=>({wristToAnkle:i/20})),{wristToAnkle:'min'}),null);
});

test('capture accepts limited comfortable reach instead of requiring an ideal pose',()=>{
 assert.equal(calibrationShape({id:'arms_up',side:'both'},poseFeatures({shoulder:40})),true);
 assert.equal(calibrationShape({id:'elbow_bend',side:'both'},poseFeatures({elbow:120})),true);
 assert.equal(calibrationShape({id:'squat',side:'left'},poseFeatures({knee:155,torsoElevation:60})),true);
 assert.equal(calibrationShape({id:'forward_fold',side:'left'},poseFeatures({hip:155,knee:175})),true);
 assert.equal(calibrationShape({id:'wide_stance',side:'both'},poseFeatures({knee:70})),false);
});
