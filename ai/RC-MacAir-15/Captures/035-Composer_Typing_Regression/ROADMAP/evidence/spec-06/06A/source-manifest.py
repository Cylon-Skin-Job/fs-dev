from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[8]
paths=[]
for folder in ['fusion-studio-client/src','fusion-studio-client/electron','fusion-studio-client/dist','fusion-studio-client/e2e','fusion-studio-server','System_Manager/ai-template','System_Manager/global-configs']:
    for p in (root/folder).rglob('*'):
        if p.is_file() and not p.is_symlink() and not any(n in p.relative_to(root).parts for n in ['node_modules','data','resources','release','coverage','.git','test-results','playwright-report']): paths.append(p)
paths += [root/p for p in ['fusion-studio-client/package.json','fusion-studio-client/package-lock.json','fusion-studio-client/playwright.chat-architecture.config.ts']]
data={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set(paths))}
out=Path(__file__).parent/sys.argv[1]
out.write_text(json.dumps(data,indent=2)+'\n')
print(f'{len(data)} files; manifest SHA256 {hashlib.sha256(out.read_bytes()).hexdigest()}')
groups={'source':{},'build':{},'incidental-runtime':{}}
for name,digest in data.items():
    kind='source'
    if name.startswith('fusion-studio-client/dist/') or '/native/secure-file-observer/build/' in name: kind='build'
    if '.log' in Path(name).name: kind='incidental-runtime'
    groups[kind][name]=digest
for kind,items in groups.items():
    target=out.with_name(out.stem+'-'+kind+'.json')
    target.write_text(json.dumps(items,indent=2)+'\n')
    print(f'{kind}: {len(items)} files; SHA256 {hashlib.sha256(target.read_bytes()).hexdigest()}')
