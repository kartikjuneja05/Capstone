export async function api(path,options={}){
 const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
 const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
 if(!response.ok)throw Object.assign(new Error(data.error||'Request failed.'),{status:response.status});return data;
}
