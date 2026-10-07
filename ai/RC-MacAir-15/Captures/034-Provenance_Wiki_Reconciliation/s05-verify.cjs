// Documentation-only checks; imports the YAML parser, never application modules.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const matter=require('../../../../fusion-studio-client/node_modules/gray-matter');
const C='ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation';
const read=p=>fs.readFileSync(p,'utf8'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
const manifest=JSON.parse(read(`${C}/S05-CHANGE-MANIFEST.json`));
const baseline=JSON.parse(read(`${C}/EXECUTION-BASELINE.json`));
const map=JSON.parse(read(`${C}/PAGE-MAP.json`));
const candidate=JSON.parse(read(`${C}/CANDIDATE.json`));
const results={at:new Date().toISOString(),candidate:candidate.candidate_id,commands:[],sources:[],links:[],vocabulary:[],limitations:[]};
function run(args){const r=cp.spawnSync(args[0],args.slice(1),{encoding:'utf8'});results.commands.push({command:args,at:new Date().toISOString(),exit:r.status,stdout:r.stdout,stderr:r.stderr});return r;}
for(const a of candidate.artifacts)assert(sha(`${C}/${a.path}`)===a.sha256,`normative drift ${a.path}`);
for(const row of map.pages){const {data}=matter(read(row.path));assert(typeof data.name==='string'&&typeof data.description==='string'&&data.metadata,`frontmatter ${row.path}`);assert(Array.isArray(data.metadata['source-files']),`sources schema ${row.path}`); if(manifest.pages.some(p=>p.path===row.path)){assert(typeof data.metadata['last-modified']==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(data.metadata['last-modified']),`timestamp ${row.path}`);for(const k of ['incoming-edges','outgoing-edges','connected-skills','related-trigger-files'])assert(!(k in data.metadata),`legacy metadata ${row.path}`);}}
const blocks=t=>[...t.matchAll(/<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->/g)].map(m=>m[0]);
const slug=s=>s.toLowerCase().replace(/[`*_]/g,'').replace(/[^\p{L}\p{N}\s_-]/gu,'').trim().replace(/\s/g,'-');
for(const row of manifest.pages){
 assert(sha(row.snapshot)===row.before_sha256&&row.snapshot_sha256===row.before_sha256,`snapshot ${row.path}`);
 for(const repair of row.repair_snapshots||[])assert(sha(repair.snapshot)===repair.before_sha256&&repair.snapshot_sha256===repair.before_sha256,`repair snapshot ${row.path}`);
 assert(sha(row.path)===row.after_sha256,`current byte drift ${row.path}`);
 const t=read(row.path),old=read(row.snapshot),b=baseline.pages.find(x=>x.path===row.path);
 assert(JSON.stringify(blocks(t))===JSON.stringify(blocks(old))&&JSON.stringify(blocks(t))===JSON.stringify(b.generated_blocks),`navigation ${row.path}`);
 assert(matter(t).data.name===matter(old).data.name,`page identity ${row.path}`);
 const primary=row.path.includes('/010-Events_And_Ledger/');
 const sources = matter(t).data.metadata['source-files'];
 assert(new Set(sources).size===sources.length,`duplicate source ${row.path}`);
 assert(/last-modified: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/.test(t),`unquoted timestamp ${row.path}`);
 for(const p of sources){
  const file=fs.existsSync(p)&&fs.statSync(p).isFile();
  const source={page:row.path,path:p,status:file?'file':'pre-existing supporting limitation'};results.sources.push(source);
  if(!file){assert(!primary&&matter(old).data.metadata['source-files'].includes(p),`bad edited source ${p}`);results.limitations.push(source);}
 }
 const prose=matter(t).content.replace(/```[\s\S]*?```/g,'');
 assert(!/^\s*\[[^\]]+\]:/m.test(prose),'reference-style link requires explicit review');
 assert(!/<a\s+[^>]*href=/i.test(prose),'HTML link requires explicit review');
 for(const m of prose.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)){
  const target=m[2];if(/^https?:\/\//.test(target)){new URL(target);results.links.push({page:row.path,target,status:'external syntax only'});continue;}
  const [file,fragment]=target.split('#');const resolved=path.resolve(path.dirname(row.path),decodeURIComponent(file));assert(fs.existsSync(resolved),`link ${row.path}: ${target}`);
  if(fragment){const headings=[...read(resolved).matchAll(/^#{1,6}\s+(.+)$/gm)].map(m=>slug(m[1]));assert(headings.includes(fragment),`anchor ${target}`);}
  results.links.push({page:row.path,target,status:'resolved'});
 }
 // Primary prose was completely rewritten; ordinary paragraphs are one physical line.
 if(primary){const without=matter(t).content.replace(/<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->/g,'');for(const p of without.split(/\n\s*\n/)){if(!p.trim()||/^\s*(?:[#|\-]|[0-9]+\.)/.test(p))continue;assert(p.trim().split('\n').length===1,`hard-wrapped prose ${row.path}`);}}
 const pattern=/Captures\/|SPEC-|ULV-D|LED-D|TOOL-D|AUT-D|UEB-D|RSC-D|CHAT-D|AUD-D|acceptedRef|PreparedCanonicalCandidate|uiActionSeed|ledger_events|file\.version|resource:invalidate|fully built|stub/g;
 for(const m of t.matchAll(pattern)){
  const inGenerated=blocks(t).some(x=>t.indexOf(x)<=m.index&&m.index<t.indexOf(x)+x.length);
  const line=t.slice(0,m.index).split('\n').length;
  const disposition=inGenerated?'generated topic-map bytes preserved; adjacent status disclaims implementation':['file.version','ledger_events'].includes(m[0])?'explicitly labeled unimplemented broader schema or canonical version scope':!primary&&old.includes(t.split('\n')[line-1])?'unchanged unrelated supporting prose':'requires manual disposition';
  assert(disposition!=='requires manual disposition',`undisposed vocabulary ${row.path}:${line}`);results.vocabulary.push({page:row.path,line,match:m[0],disposition});
 }
}
const sourceEvidence=JSON.parse(read(`${C}/S05-SOURCE-EVIDENCE.json`));
for(const row of sourceEvidence.files)assert(sha(row.path)===row.sha256,`source drift ${row.path}`);
// Evidence citations must locate real lines in the current hashed sources.
results.evidenceAnchors=0;
for(const m of read(`${C}/S05-EVIDENCE.md`).matchAll(/([A-Za-z0-9_./-]+\.(?:js|ts|c)):([0-9–,]+)/g)){
 const owners=sourceEvidence.files.filter(r=>r.path.endsWith(m[1]));
 assert(owners.length===1,`ambiguous evidence source ${m[1]}`);
 const lines=m[2].match(/\d+/g).map(Number);
 assert(Math.min(...lines)>0&&Math.max(...lines)<=owners[0].line_count,`evidence line bounds ${m[1]}:${m[2]}`);
 results.evidenceAnchors++;
}
const supplements=JSON.parse(read(`${C}/S05-SUPPLEMENT-MANIFEST.json`));
for(const r of supplements.supplements){
 const bytes=fs.readFileSync(r.path);
 assert(crypto.createHash('sha256').update(bytes.subarray(0,r.before_bytes)).digest('hex')===r.before_sha256,`supplement prefix ${r.path}`);
 assert(bytes.subarray(r.before_bytes).toString('utf8')===r.append,`supplement append ${r.path}`);
 assert(sha(r.path)===r.after_sha256,`supplement identity ${r.path}`);
}

const scoped=['ai/RC-MacAir-15/Wiki/010-Events_And_Ledger','ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md','ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md','ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md',C];
assert(run(['git','diff','--check','--',...scoped]).status===0,'diff whitespace');
run(['rg','-n','Captures/|SPEC-|ULV-D|LED-D|TOOL-D|AUT-D|UEB-D|RSC-D|CHAT-D|AUD-D|acceptedRef|PreparedCanonicalCandidate|uiActionSeed|ledger_events|file\\.version|resource:invalidate|fully built|stub',...scoped.slice(0,-1),'-g','PAGE.md','-g','!**/.versions/**']);
run(['git','status','--short']);
for(const filename of ['s05-verify.cjs','s05-write.py','s05-evidence.py','S05-SOURCE-EVIDENCE.json','S05-CHANGE-MANIFEST.json','S05-EVIDENCE.md','S05-HANDOFF.md'])assert(!read(`${C}/${filename}`).split('\n').some(x=>/[\t ]+$/.test(x)),`untracked whitespace ${filename}`);
results.status='PASS';results.frontmatters=map.pages.length;results.changedPages=manifest.pages.length;results.sourceHashes=sourceEvidence.files.length;results.snapshots=manifest.pages.reduce((n,r)=>n+1+(r.repair_snapshots||[]).length,0);results.generatedBlocksUnchanged=true;results.productRuntime='not run: prohibited by approved documentation contract';
if(!process.argv.includes('--read-only'))fs.writeFileSync(`${C}/S05-CHECKS.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({status:results.status,frontmatters:results.frontmatters,changedPages:results.changedPages,sourceHashes:results.sourceHashes,evidenceAnchors:results.evidenceAnchors,snapshots:results.snapshots,links:results.links.length,vocabulary:results.vocabulary.length,preexistingSupportingLimitations:results.limitations.length},null,2));
