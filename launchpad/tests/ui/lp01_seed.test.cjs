const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
test('pure timeline geometry retains main and four branches with convergence',()=>{
  const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../assets/layout.js'),'utf8'),sandbox);
  const tracks=Array.from({length:4},(_,i)=>({uuid:'track'+i,order:i}));const placements=tracks.map((t,i)=>({ticket_uuid:'ticket'+i,track_uuid:t.uuid,position:'track'}));
  placements.push({ticket_uuid:'opening',position:'opening',slot:0},{ticket_uuid:'closing',position:'convergence'});
  const layout=sandbox.LPLayout({plan:{body:{tracks}},placements});assert.equal(layout.rails.length,5);assert.equal(layout.positions.size,6);
  assert.equal(layout.rails[1].points[0][1],layout.mainY);assert.equal(layout.rails[1].points.at(-1)[1],layout.mainY);
});
test('all embedded asset scripts have valid syntax',()=>{for(const file of fs.readdirSync(path.join(__dirname,'../../assets')).filter(x=>x.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(__dirname,'../../assets',file),'utf8'));});
