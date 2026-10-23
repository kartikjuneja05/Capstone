import catalog from './data/asana-reference.json' with {type:'json'};
import {ROM_EXERCISES,calibrationPlan,measurement,missingCalibration} from './rom.js';
export {catalog,calibrationPlan,measurement,missingCalibration};
export const POSES=Object.fromEntries(catalog.poses.map(p=>[p.id,p]));
export const ROUTINES=catalog.routines;
export const EXERCISES=ROM_EXERCISES;
export const NEEDS={
 tadasana:['arms_up'],vrikshasana:['arms_up','squat','wide_stance'],vajrasana:['squat'],
 makarasana:['elbow_bend'],shavasana:['wide_stance'],ardhashalabhasana:['wide_stance'],
 ardhahalasana:['forward_fold'],niralamba_bhujangasana:['elbow_bend'],
 trikonasana:['wide_stance'],hastottanasana:['arms_up'],
 paschimottanasana:['forward_fold'],uttanapadasana:['forward_fold'],naukasana:['forward_fold']
};
export function routineQueue(routine){return routine.poseIds.flatMap(id=>POSES[id].requiresBothSides?['left','right'].map(side=>({poseId:id,side})):[{poseId:id,side:'both'}]);}
export function estimateSeconds(routine,holdSeconds){return routineQueue(routine).length*(holdSeconds+3+15+5);}
export function eligibleQueue(routine,profile){
 const excluded=[];const allowed=routineQueue(routine).filter(entry=>{
  const sides=entry.side==='both'?['left','right']:[entry.side];
  if(NEEDS[entry.poseId].some(id=>sides.some(side=>!measurement(profile,id,side)))){
   excluded.push({...entry,reason:'A relevant movement in the shared ROM assessment was skipped or has expired.'});return false;
  }
  // These only screen measured joint limitations; they do not certify balance, strength or medical suitability.
  const ready=sides.every(side=>{
   const get=id=>measurement(profile,id,side);
   if(['tadasana','vrikshasana','hastottanasana'].includes(entry.poseId)&&get('arms_up').shoulder<=70)return false;
   if(['vajrasana','vrikshasana'].includes(entry.poseId)&&get('squat').knee>=110)return false;
   if(entry.poseId==='trikonasana'&&get('wide_stance').hipAbduction<8)return false;
   if(entry.poseId==='paschimottanasana'&&get('forward_fold').hip>=125)return false;
   return true;
  });
  if(!ready)excluded.push({...entry,reason:'Your recorded joint reach is below this evaluator’s minimum recognizable shape. Repeat the shared assessment only if comfortable.'});return ready;
 });return {allowed,excluded};
}
export function cameraGuidance(view,side='left',floor=false){return view==='front'?`Face the camera with your whole body visible. Keep your shoulders and hips facing forward. ${side==='both'?'':`Use your ${side} side for the indicated movement.`}`:`Turn your ${side} side toward the camera. ${floor?'Place the camera low enough to see you on the mat, keep it level with the floor, and leave room for your raised legs.':'Place the camera at hip-to-chest height, keep it level, and leave space above your hands and below your feet.'}`;}
export const FLOOR_POSES=new Set(['makarasana','shavasana','ardhashalabhasana','ardhahalasana','niralamba_bhujangasana','paschimottanasana','uttanapadasana','naukasana']);
export const FRONT_POSES=new Set(['vrikshasana','trikonasana','hastottanasana']);
