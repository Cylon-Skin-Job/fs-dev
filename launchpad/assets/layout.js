/* Pure source-derived timeline geometry: main rail, four branches and convergence. */
globalThis.LPLayout = function (model) {
  const cardWidth=200,gap=100,rowGap=120,pitch=cardWidth+gap,mainY=340;
  const tracks=model.plan.body.tracks.slice().sort((a,b)=>a.order-b.order);
  const trackYs=[mainY-rowGap*2,mainY-rowGap,mainY+rowGap,mainY+rowGap*2];
  const opening=model.placements.filter(x=>x.position==='opening').sort((a,b)=>(a.slot||0)-(b.slot||0));
  const offset=160+opening.length*pitch;
  const positions=new Map(), counts=new Map();
  for(const placement of model.placements){let left,y;
    if(placement.position==='opening'){left=160+(placement.slot||0)*pitch;y=mainY;}
    else if(placement.position==='convergence')continue;
    else {const index=tracks.findIndex(x=>x.uuid===placement.track_uuid),count=counts.get(index)||0;
      const slot=Number.isInteger(placement.slot)?placement.slot:count;counts.set(index,Math.max(count,slot+1));
      left=offset+slot*pitch+(index%2?0:pitch/2);y=trackYs[index];}
    positions.set(placement.ticket_uuid,{left,y});
  }
  const join=Math.max(offset+pitch,...[...positions.values()].map(x=>x.left+cardWidth+gap));
  model.placements.filter(x=>x.position==='convergence').forEach((p,i)=>positions.set(p.ticket_uuid,{left:join+i*pitch,y:mainY}));
  const width=Math.max(1200,join+pitch*2),height=680;
  const rails=[{kind:'main',points:[[40,mainY],[width-40,mainY]]}];
  trackYs.forEach(y=>rails.push({kind:'branch',points:[[Math.max(70,offset-80),mainY],[offset-40,mainY],[offset,y],[join-60,y],[join,mainY]]}));
  return {cardWidth,gap,rowGap,pitch,mainY,tracks,trackYs,positions,width,height,rails};
};
