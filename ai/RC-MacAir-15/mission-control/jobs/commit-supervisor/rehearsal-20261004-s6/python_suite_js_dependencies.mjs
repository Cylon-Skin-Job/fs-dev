import fs from 'node:fs';
import path from 'node:path';
import {createRequire,isBuiltin} from 'node:module';
const root='/Users/rccurtrightjr./projects/fs-dev';
const req=createRequire(path.join(root,'fusion-studio-client/package.json'));
const ts=req('typescript');
const entries=[path.join(root,'fusion-studio-server/scripts/wiki.js'),req.resolve('gray-matter')];
const visited=new Set(), packages=new Set(), edges=[], builtins=new Set(), dynamic=[];
function packageOwner(file){let p=path.dirname(file);while(p!==path.dirname(p)){if(fs.existsSync(path.join(p,'package.json'))){packages.add(p);break;}p=path.dirname(p);}}
function walk(file){
 file=fs.realpathSync(file);if(visited.has(file))return;visited.add(file);packageOwner(file);
 if(!/\.[cm]?js$/.test(file))return;
 const text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const local=createRequire(file);
 function scan(n){
  if(ts.isCallExpression(n)&&(n.expression.getText(ast)==='require'||n.expression.getText(ast)==='require.resolve')){
   const a=n.arguments[0];
   if(a&&ts.isStringLiteralLike(a)){const spec=a.text;if(isBuiltin(spec)){builtins.add(spec);}else{const resolved=local.resolve(spec);edges.push({from:file,spec,resolved});walk(resolved);}}
   else dynamic.push({file,line:ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1,expression:n.getText(ast)});
  }
  ts.forEachChild(n,scan);
 }
 scan(ast);
}
for(const e of entries)walk(e);
const packageFiles=new Set();
function files(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=path.join(p,e.name);if(e.isDirectory()&&e.name!=='node_modules'&&e.name!=='.git')files(q);else if(e.isFile()||e.isSymbolicLink())packageFiles.add(q);}}
for(const p of packages)if(p.includes('/node_modules/'))files(p);
console.log(JSON.stringify({entries,code_files:[...visited].sort(),package_files:[...packageFiles].sort(),package_roots:[...packages].sort(),edges,builtins:[...builtins].sort(),dynamic,parser_tool:req.resolve('typescript')},null,2));
