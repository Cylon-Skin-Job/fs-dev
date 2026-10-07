// Cumulative documentation check. --read-only never writes; no application modules executed.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const matter = require('../../../../fusion-studio-client/node_modules/gray-matter');
const C = 'ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation';
const read = p => fs.readFileSync(p, 'utf8');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const sha = p => hash(fs.readFileSync(p));
const load = n => JSON.parse(read(`${C}/${n}`));
const assert = (yes, reason) => { if (!yes) throw Error(reason); };
const map = load('PAGE-MAP.json'), baseline = load('EXECUTION-BASELINE.json'), candidate = load('CANDIDATE.json');
const disposition = load('S06-DISPOSITIONS.json'), source = load('S06-SOURCE-EVIDENCE.json');
const manifest = load('S06-CHANGE-MANIFEST.json'), final = load('FINAL-ARTICLE-HASHES.json');
const results = {at: new Date().toISOString(), candidate: candidate.candidate_id, commands: [], links: [], vocabulary: [], lineage: [], sources: [], exceptions: []};
function run(args) {
  const r = cp.spawnSync(args[0], args.slice(1), {encoding: 'utf8'});
  results.commands.push({command: args, at: new Date().toISOString(), exit: r.status, stdout: r.stdout, stderr: r.stderr});
  return r;
}
const blocks = t => [...t.matchAll(/<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->/g)].map(m => m[0]);
const slug = s => s.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
function anchors(t) {
  const seen = new Map(), out = [];
  for (const m of t.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(m[1]), count = seen.get(base) || 0;
    out.push(count ? `${base}-${count}` : base); seen.set(base, count + 1);
  }
  for (const m of t.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) out.push(m[1]);
  return out;
}
const normative = candidate.artifacts.slice().sort((a,b) => a.path.localeCompare(b.path));
assert(normative.length === 9, 'normative census');
for (const a of normative) assert(sha(`${C}/${a.path}`) === a.sha256, `normative identity ${a.path}`);
assert(hash(normative.map(a => `${a.path}\t${a.sha256}\n`).join('')) === candidate.aggregate_sha256, 'candidate aggregate');
assert(run(['git','rev-parse','HEAD']).stdout.trim() === baseline.head, 'HEAD changed: re-inspect baseline');
assert(map.pages.length === 27 && map.pages.filter(p => p.scope === 'primary').length === 24, 'map census');
assert(new Set(map.pages.map(p => p.path)).size === 27, 'duplicate map page');
const actualPrimary = [];
function walk(dir) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { if(e.name === '.versions') continue; const p = `${dir}/${e.name}`; if(e.isDirectory()) walk(p); else if(e.name === 'PAGE.md') actualPrimary.push(p); } }
walk('ai/RC-MacAir-15/Wiki/010-Events_And_Ledger');
assert(JSON.stringify(actualPrimary.sort()) === JSON.stringify(map.pages.filter(r => r.scope === 'primary').map(r => r.path).sort()), 'primary on-disk census');
const histories = Array.from({length:6}, (_,i) => ({slice:`S0${i+1}`, ...load(`S0${i+1}-CHANGE-MANIFEST.json`)}));
const snapshotPaths = new Set();
for (const row of map.pages) {
  const b = baseline.pages.find(r => r.path === row.path), text = read(row.path), parsed = matter(text), data = parsed.data;
  assert(text.startsWith('---\n') && typeof data.name === 'string' && data.name.trim() && typeof data.description === 'string' && data.description.trim(), `frontmatter ${row.path}`);
  assert(data.name === b.name, `page name changed ${row.path}`);
  const md = data.metadata;
  assert(md && Array.isArray(md['source-files']), `metadata ${row.path}`);
  assert(typeof md['last-modified'] === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(md['last-modified']), `timestamp ${row.path}`);
  assert(/^  last-modified: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"$/m.test(text), `timestamp quoting ${row.path}`);
  for (const k of ['incoming-edges','outgoing-edges','connected-skills','related-trigger-files']) assert(!(k in md), `legacy metadata ${row.path}`);
  assert(new Set(md['source-files']).size === md['source-files'].length, `duplicate sources ${row.path}`);
  for (const p of md['source-files']) {
    assert(typeof p === 'string' && !path.isAbsolute(p) && !/[\\*<>]/.test(p) && !p.split('/').includes('..') && fs.existsSync(p) && fs.statSync(p).isFile() && /\.(?:[cm]?js|tsx?|json|c|h|py|sh)$/.test(p), `exact code source ${row.path}: ${p}`);
    results.sources.push({page:row.path, path:p, sha256:sha(p)});
  }
  assert(JSON.stringify(blocks(text)) === JSON.stringify(b.generated_blocks), `TOC baseline ${row.path}`);
  assert((text.match(/<!-- section-toc:start -->/g)||[]).length === blocks(text).length, `TOC markers ${row.path}`);
  let previous = b.sha256;
  const stages = [];
  for (const h of histories) {
    for (const r of h.pages.filter(r => r.path === row.path)) {
      assert(r.before_sha256 === previous, `slice lineage ${h.slice} ${row.path}`);
      const versions = [r, ...(r.repair_snapshots || [])];
      for (let i=0; i<versions.length; i++) {
        const v = versions[i];
        assert(path.dirname(v.snapshot) === path.join(path.dirname(row.path), '.versions'), `snapshot owner ${v.snapshot}`);
        assert(/^\d{4}-\d{2}-\d{2}-\d{6}\.md$/.test(path.basename(v.snapshot)), `snapshot local name ${v.snapshot}`);
        assert(!snapshotPaths.has(v.snapshot), `snapshot reused ${v.snapshot}`); snapshotPaths.add(v.snapshot);
        assert(sha(v.snapshot) === v.before_sha256 && v.snapshot_sha256 === v.before_sha256, `snapshot bytes ${v.snapshot}`);
        const next = i+1 < versions.length ? versions[i+1].before_sha256 : r.after_sha256;
        if(i>0 && v.after_sha256) assert(v.after_sha256 === next, `repair chain ${v.snapshot}`);
        assert(matter(read(v.snapshot)).data.name === b.name, `snapshot title ${v.snapshot}`);
        assert(JSON.stringify(blocks(read(v.snapshot))) === JSON.stringify(b.generated_blocks), `snapshot navigation ${v.snapshot}`);
        stages.push({slice:h.slice, snapshot:v.snapshot, before_sha256:v.before_sha256, after_sha256:next, intermediate_evidence:i+1<versions.length?'next complete repair predecessor':'recorded slice final'});
      }
      previous = r.after_sha256;
    }
  }
  assert(stages.length && sha(row.path) === previous, `current final lineage ${row.path}`);
  results.lineage.push({path:row.path, baseline:b.sha256, stages, current_sha256:previous});
  const body = parsed.content;
  let fence = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if(m) { if(!fence) fence=m[1]; else if(m[1][0]===fence[0] && m[1].length>=fence.length) fence=null; }
  }
  assert(!fence, `unclosed fence ${row.path}`);
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  assert(!/^\s*\[[^\]]+\]:/m.test(prose), `reference links need review ${row.path}`);
  assert(!/<a\s+[^>]*href=/i.test(prose), `HTML links need review ${row.path}`);
  for (const m of prose.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const target=m[2];
    if(/^https?:\/\//.test(target)) { new URL(target); results.links.push({page:row.path,target,status:'external syntax only'}); continue; }
    const [file,fragment] = target.split('#'), resolved = file ? path.resolve(path.dirname(row.path), decodeURIComponent(file)) : path.resolve(row.path);
    assert(fs.existsSync(resolved), `missing link ${row.path} ${target}`);
    if(fragment) assert(anchors(read(resolved)).includes(decodeURIComponent(fragment)), `missing fragment ${row.path} ${target}`);
    results.links.push({page:row.path,target,status:'resolved'});
  }
  if(row.scope === 'primary') {
    assert(/Status:/.test(body), `primary status ${row.path}`);
    const ordinary = body.replace(/<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->/g, '');
    for(const p of ordinary.split(/\n\s*\n/)) if(p.trim() && !/^\s*(?:[#|\-]|[0-9]+\.)/.test(p)) assert(p.trim().split('\n').length === 1, `hard wrap ${row.path}`);
  }
  const pattern=/Captures\/|SPEC-|ULV-D|LED-D|TOOL-D|AUT-D|UEB-D|RSC-D|CHAT-D|AUD-D|acceptedRef|PreparedCanonicalCandidate|uiActionSeed|ledger_events|file\.version|resource:invalidate|fully built|stub/g;
  for(const m of text.matchAll(pattern)) {
    const line=text.slice(0,m.index).split('\n').length, content=text.split('\n')[line-1];
    const generated=blocks(text).some(s => text.indexOf(s)<=m.index && m.index<text.indexOf(s)+s.length);
    const exception=row.scope==='supporting_limited' && b.text.includes(content);
    const meaning=generated?'preserved generated topic-map; adjacent status limits deployment meaning':exception?'unchanged unrelated supporting text, outside prose recertification':['ledger_events','file.version'].includes(m[0]) && /not|unimplemented|propos|broader|outside|general/i.test(content)?'explicitly unimplemented or broader proposed schema; current bounded stores separate':null;
    assert(meaning, `undisposed vocabulary ${row.path}:${line} ${content}`);
    results.vocabulary.push({page:row.path,line,match:m[0],text:content,disposition:meaning});
  }
}
for(const r of source.files) assert(sha(r.path) === r.sha256, `current source/authority changed: inspect ${r.path}`);
const inputs=load('S00-INPUT-INVENTORY.json').claims;
assert(inputs.length===438 && disposition.claims.length===438 && new Set(disposition.claims.map(r=>r.id)).size===438, 'input dispositions census');
assert(disposition.pages.length===27 && new Set(disposition.pages.map(r=>r.path)).size===27, 'page disposition census');
for(const input of inputs) {
  const d=disposition.claims.find(r=>r.id===input.id);
  assert(d && d.page===input.page && d.input_sha256===hash(input.text) && d.input_text===input.text && d.resolution && d.authority, `claim identity ${input.id}`);
  assert(['preserved_unrelated_supporting_scope','retained_with_current_scope','ephemeral_authority_relocated','replaced_by_scoped_current_and_future_guidance'].includes(d.final_disposition), `pending disposition ${input.id}`);
  for(const h of d.final_sections) assert(read(d.page).includes(`## ${h}`), `claim destination ${input.id}`);
  for(const e of d.evidence) { const [file,anchor]=e.split('#'); assert(fs.existsSync(`${C}/${file}`), `claim evidence ${e}`); if(anchor) assert(anchors(read(`${C}/${file}`)).includes(anchor), `claim evidence anchor ${e}`); }
  if(d.final_disposition==='preserved_unrelated_supporting_scope') assert(read(d.page).includes(input.text), `supporting original lost ${input.id}`);
}
for(const r of disposition.pages) assert(sha(r.path)===r.current_sha256 && r.claim_ids.length===inputs.filter(i=>i.page===r.path).length, `page disposition identity ${r.path}`);
const ac=read(`${C}/S06-EVIDENCE.md`);
for(let i=1;i<=10;i++) assert(ac.includes(`| AC${String(i).padStart(2,'0')} |`), `missing AC${i}`);
assert(final.count===27 && final.articles.length===27 && new Set(final.articles.map(r=>r.path)).size===27 && final.candidate===candidate.candidate_id, 'final article hash census');
assert(JSON.stringify(final.articles.map(r=>r.path).sort())===JSON.stringify(map.pages.map(r=>r.path).sort()), 'final hash scope');
for(const r of final.articles) assert(sha(r.path)===r.sha256, `final article identity ${r.path}`);
// S03 records only prefix hashes; locate exact complete-line prefixes without inventing bytes.
for(const r of load('S03-SUPPLEMENT-MANIFEST.json').files) {
  const bytes=fs.readFileSync(r.path), prefixes=new Set();
  for(let i=0;i<bytes.length;i++) if(bytes[i]===10) prefixes.add(hash(bytes.subarray(0,i+1)));
  assert(prefixes.has(r.before_sha256) && prefixes.has(r.after_sha256), `historical append prefix ${r.path}`);
}
for(const n of ['S04','S05','S06']) {
  for(const r of load(`${n}-SUPPLEMENT-MANIFEST.json`).supplements) {
    const bytes=fs.readFileSync(r.path), end=r.before_bytes+Buffer.byteLength(r.append);
    assert(hash(bytes.subarray(0,r.before_bytes))===r.before_sha256 && bytes.subarray(r.before_bytes,end).toString()===r.append, `append lineage ${n} ${r.path}`);
    assert(hash(bytes.subarray(0,end))===r.after_sha256, `append recorded hash ${n} ${r.path}`);
  }
}
const scoped=['ai/RC-MacAir-15/Wiki/010-Events_And_Ledger',...map.pages.filter(r=>r.scope==='supporting_limited').map(r=>r.path),C];
assert(run(['git','diff','--check','--',...scoped]).status===0, 'scoped whitespace');
const v4=run(['rg','-n','Captures/|SPEC-|ULV-D|LED-D|TOOL-D|AUT-D|UEB-D|RSC-D|CHAT-D|AUD-D|acceptedRef|PreparedCanonicalCandidate|uiActionSeed|ledger_events|file\\.version|resource:invalidate|fully built|stub',...scoped.slice(0,-1),'-g','PAGE.md','-g','!**/.versions/**']);
assert(v4.status===0 || v4.status===1, 'V4 command failed');
run(['git','status','--short']);
for(const n of fs.readdirSync(C).filter(n=>/^(?:S06-|s06-|FINAL-ARTICLE-HASHES)/.test(n))) {
  if(n.endsWith('.diff')) continue; // Unified context lines intentionally begin with a space.
  assert(!read(`${C}/${n}`).split('\n').some(l=>/[\t ]+$/.test(l)), `untracked whitespace ${n}`);
}
results.status='PASS';
results.summary={status:'PASS',candidate:candidate.candidate_id,pages:27,primary:24,supporting:3,changedS06:manifest.pages.length,snapshots:snapshotPaths.size,sourceIdentities:source.files.length,sourcePointers:results.sources.length,links:results.links.length,vocabulary:results.vocabulary.length,inputDispositions:438,normative:9,acceptanceRows:10,productRuntime:'not run: prohibited documentation scope'};
if(!process.argv.includes('--read-only')) fs.writeFileSync(`${C}/S06-CHECKS.json`, JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.summary,null,2));
