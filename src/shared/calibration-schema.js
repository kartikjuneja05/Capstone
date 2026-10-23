export const CALIBRATION_IDS=['arms_up','wide_stance','squat','forward_fold','elbow_bend'];
export const MEASUREMENT_KEYS=['shoulder','elbow','hip','knee','torsoTilt','torsoElevation','legElevation','wristToAnkle','hipAbduction'];
export function validateProfile(input){
 if(input?.version!==3 || !input.measurements || typeof input.measurements!=='object' || Array.isArray(input.measurements))return false;
 const entries=Object.entries(input.measurements);if(entries.length>10)return false;
 return entries.every(([key,m])=>CALIBRATION_IDS.some(id=>key===`${id}:left`||key===`${id}:right`) && m && Number.isFinite(Date.parse(m.measuredAt)) && Date.parse(m.measuredAt)<=Date.now()+60000 && m.values && typeof m.values==='object' && !Array.isArray(m.values) && Object.keys(m.values).length>0 && Object.entries(m.values).every(([k,v])=>MEASUREMENT_KEYS.includes(k)&&Number.isFinite(v)&&v>=0&&v<=(k==='wristToAnkle'?10:180)));
}
