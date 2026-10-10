import fs from 'node:fs';
const versions=JSON.parse(fs.readFileSync('design-review/versions.json','utf8'));
const results=[];
for(let i=0;i<versions.length;i+=4){
  const batch=await Promise.all(versions.slice(i,i+4).map(async v=>{
    try {
      const response=await fetch(v.url,{signal:AbortSignal.timeout(15000)});
      const body=await response.text();
      return {id:v.id,url:v.url,status:response.status,ok:response.ok&&body.toLowerCase().includes('<html'),bytes:body.length};
    }catch(e){return{id:v.id,url:v.url,status:null,ok:false,error:String(e)}}
  }));
  results.push(...batch);
}
const summary={checkedAt:new Date().toISOString(),checked:results.length,reachable:results.filter(r=>r.ok).length,unreachable:results.filter(r=>!r.ok).length,results};
fs.writeFileSync('/tmp/binrat-preview-link-status.json',JSON.stringify(summary,null,2));
for(const r of results)console.log((r.ok?'OK':'WARN')+' '+r.id+' status='+r.status+' '+(r.error||''));
console.log('Archive link check: '+summary.reachable+'/'+summary.checked+' HTTP HTML responses. GitHack runtime APIs are not covered.');
