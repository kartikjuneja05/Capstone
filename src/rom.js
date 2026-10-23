export const ROM_EXERCISES={
 arms_up:{title:'Comfortable arm raise',view:'front',keys:{shoulder:'max',elbow:'max',hip:'max',knee:'max'},text:'Stand tall facing the camera. Move both arms out and upward, stopping at your comfortable limit. Keep your elbows gently straight and your chest over your hips. Do not arch your back or lift your heels to reach higher.'},
 wide_stance:{title:'Comfortable wide stance',view:'front',keys:{hipAbduction:'max',knee:'max'},text:'Face the camera. Move your feet apart gradually to a comfortable width. Keep your legs gently straight, feet grounded and torso upright. Do not slide into a split. Stop before strain.'},
 squat:{title:'Comfortable squat',view:'side',keys:{knee:'min',hip:'min'},text:'Turn sideways to the camera. With feet comfortably apart, slowly bend your knees and lower your hips as far as comfortable. Keep your heels down. Use a sturdy support if needed, without hiding your joints. You do not need a deep squat.'},
 forward_fold:{title:'Comfortable forward fold',view:'side',keys:{hip:'min',knee:'max'},text:'Turn sideways to the camera. Keep your legs comfortably straight and fold forward gently from your hips. Let your arms hang. Stop at your comfortable limit; touching the floor is not required. Rise slowly afterward.'},
 elbow_bend:{title:'Comfortable elbow bend',view:'front',keys:{elbow:'min'},text:'Face the camera. Keep your upper arms near your sides and bend both elbows, bringing your hands toward your shoulders as far as comfortable. Keep the elbows visible and do not force contact.'}
};
// Five movements: front views capture both sides together; side views are repeated for visibility.
export function calibrationPlan(){return Object.entries(ROM_EXERCISES).flatMap(([id,e])=>(e.view==='front'?['both']:['left','right']).map(side=>({id,side,...e})));}
export function measurement(profile,id,side){
 if(profile?.version!==3)return null;
 const m=profile.measurements?.[`${id}:${side}`],time=Date.parse(m?.measuredAt);
 return Number.isFinite(time)&&time<=Date.now()+60000&&Date.now()-time<30*86400000?m.values:null;
}
export function missingCalibration(_routine,profile){return calibrationPlan().filter(e=>(e.side==='both'?['left','right']:[e.side]).some(side=>!measurement(profile,e.id,side)));}
export function normalizeProfile(profile){return profile?.version===3?profile:{version:3,measurements:{}};}
