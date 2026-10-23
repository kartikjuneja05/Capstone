const rawAssets=import.meta.glob('../assets/yoga-poses/*.{jpg,png}',{eager:true,query:'?url',import:'default'});
export const images=Object.fromEntries(Object.entries(rawAssets).map(([path,url])=>[path.split('/').pop(),url]));
export const poseImage=pose=>images[pose.source.referenceImage.entry.split('/').pop()];
// Display the user's photos, but avoid comparing incompatible variants to textbook rules.
export const conflictingReferences=new Set(['makarasana','niralamba_bhujangasana','uttanapadasana','hastottanasana']);
const rawROM=import.meta.glob('../assets/rom/*.svg',{eager:true,query:'?url',import:'default'});
export const romImages=Object.fromEntries(Object.entries(rawROM).map(([path,url])=>[path.split('/').pop().replace('.svg',''),url]));
