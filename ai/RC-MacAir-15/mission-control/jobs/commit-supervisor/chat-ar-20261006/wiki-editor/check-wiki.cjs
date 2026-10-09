'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), cp=require('node:child_process');
const {createRequire}=require('node:module');
const root='/private/tmp/chat-ar-integration-r6pe5gmi/candidate';
const home='/Users/rccurtrightjr./projects/fs-dev/ai/RC-MacAir-15/mission-control';
const out=path.join(home,'jobs/commit-supervisor/chat-ar-20261006/wiki-editor');
const matter=createRequire(path.join(root,'fusion-studio-client/package.json'))('gray-matter');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const freeze=JSON.parse(fs.readFileSync(path.join(out,'pre-edit-freeze.json'),'utf8'));
const edit=JSON.parse(fs.readFileSync(path.join(out,'edit-receipt.json'),'utf8'));
const corrections=JSON.parse(fs.readFileSync(path.join(out,'selfcheck-correction-receipt.json'),'utf8'));
const fail=[];let sources=0,links=0;
const pages=freeze.pages.map(f=>{
 const p=path.join(root,f.path),b=fs.readFileSync(p),t=b.toString('utf8');let parsed;
 try{parsed=matter(t);}catch(e){fail.push({path:f.path,check:'strict-gray-matter',error:e.message});return {path:f.path,error:e.message};}
 const d=parsed.data,m=d.metadata||{};
 if(typeof d.name!=='string'||!d.name.trim()||typeof d.description!=='string'||!d.description.trim())fail.push({path:f.path,check:'envelope'});
 if(!Array.isArray(m['source-files'])||new Set(m['source-files']).size!==m['source-files'].length)fail.push({path:f.path,check:'unique-source-list'});
 for(const s of m['source-files']||[]){sources++;if(typeof s!=='string'||path.isAbsolute(s)||/[\*<>]/.test(s)||!fs.statSync(path.join(root,s)).isFile())fail.push({path:f.path,check:'exact-code-source',source:s});}
 for(const match of parsed.content.matchAll(/\]\(([^)]+)\)/g)){
  const href=match[1].replace(/^<|>$/g,'');if(/^(https?:|app:|codex:|#)/.test(href))continue;
  const target=href.split('#')[0];if(!target)continue;
  links++;const resolved=path.resolve(path.dirname(p),decodeURIComponent(target));if(!fs.existsSync(resolved))fail.push({path:f.path,check:'local-link',href});
 }
 const changed=edit.pages.find(e=>e.page===f.path);
 if(changed){
  if(sha(b)!==changed.final_sha256)fail.push({path:f.path,check:'final-byte-match'});
  const front=t.split('\n---\n')[0];
  if((front.match(/^  last-modified:/gm)||[]).length!==1||!/^  last-modified: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"$/m.test(front)||m['last-modified']!==changed.last_modified)fail.push({path:f.path,check:'quoted-actual-utc'});
  for(const key of ['incoming','outgoing','incoming-edges','outgoing-edges','connected-skills','related-trigger-files'])if(key in m)fail.push({path:f.path,check:'legacy-metadata',key});
 }else if(sha(b)!==f.sha256)fail.push({path:f.path,check:'retained-byte-match'});
 return {path:f.path,sha256:sha(b),sourceCount:(m['source-files']||[]).length,parsedTitle:d.name,description:d.description,lastModified:m['last-modified'],changed:!!changed,bodySha256:sha(Buffer.from(parsed.content))};
});
const versions=edit.pages.concat(corrections).map(e=>{
 const b=fs.readFileSync(path.join(root,e.version));if(sha(b)!==e.preimage_sha256||b.length!==e.preimage_bytes)fail.push({path:e.version,check:'complete-preimage'});
 return {path:e.version,sha256:sha(b),bytes:b.length,mode:(fs.statSync(path.join(root,e.version)).mode&0o777).toString(8),absentBeforeCreation:true};
});
for(const suffix of ['007-Chat_System/006-Runtime_Model/PAGE.md','010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md']){
 const e=edit.pages.find(e=>e.page.endsWith(suffix));const before=fs.readFileSync(path.join(root,e.version),'utf8'),after=fs.readFileSync(path.join(root,e.page),'utf8');if(before.split('\n---\n').slice(1).join('\n---\n')!==after.split('\n---\n').slice(1).join('\n---\n'))fail.push({path:e.page,check:'body-preserved'});
}
for(const f of freeze.sources){const b=fs.readFileSync(path.join(root,f.path));if(sha(b)!==f.sha256)fail.push({path:f.path,check:'supporting-source-drift'});}
for(const f of freeze.deleted_source_absences)if(fs.existsSync(path.join(root,f.path)))fail.push({path:f.path,check:'retired-source-absence'});
const idx=cp.execFileSync('git',['ls-files','--stage','-z'],{cwd:root,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
if(sha(idx)!==freeze.candidate_index_semantic_sha256)fail.push({check:'index-semantic-preservation'});
const result={at:new Date().toISOString(),command:'node '+path.join(out,'check-wiki.cjs'),parserResolved:createRequire(path.join(root,'fusion-studio-client/package.json')).resolve('gray-matter'),pageCount:pages.length,changedPageCount:edit.pages.length,uniqueSourceFilesChecked:freeze.sources.length,declaredSourceReferencesChecked:sources,localLinksChecked:links,retiredSourceAbsences:freeze.deleted_source_absences.length,completeVersionCount:versions.length,candidateIndexPreserved:sha(idx)===freeze.candidate_index_semantic_sha256,pages,versions,failures:fail};
fs.writeFileSync(path.join(out,'mechanical-checks.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(fail.length)process.exitCode=1;
