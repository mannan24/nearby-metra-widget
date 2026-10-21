export function distance(a,b) {
  const rad=x=>x*Math.PI/180, dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function nearest(stations,position) {
  if(!Number.isFinite(position.lat)||!Number.isFinite(position.lon))throw Error('Location unavailable');
  return stations.map(s=>({...s,meters:distance(position,s)})).sort((a,b)=>a.meters-b.meters)[0];
}
export function usableFeed(feed,now) {
  const stamp=Number(feed?.header?.timestamp)*1000;
  return Number.isFinite(stamp)&&now-stamp<=300000&&stamp-now<=60000&&Number(feed.header.incrementality||0)===0;
}
// Exact stop predictions only: no inferred delay propagation through missing stops.
export function predictions(trains,feed,stationId,now) {
  const live=usableFeed(feed,now),updates=new Map();
  if(live)for(const e of feed.entity||[])if(e.tripUpdate&&!e.isDeleted) {
    const u=e.tripUpdate;
    if(u.trip?.tripId&&u.trip.startDate)updates.set(u.trip.tripId+'|'+u.trip.startDate,u);
  }
  return trains.flatMap(t=>{
    let when=t.direction==='to'||stationId==='MILLENNIUM'?t.depart:t.arrive;
    let mode='scheduled';
    const u=updates.get(t.id+'|'+t.date);
    if(u) {
      const relation=Number(u.trip.scheduleRelationship||0);
      if(relation===3||relation===7)return [];
      if(relation!==0)return []; // Unsupported replacement/added trips are not misrepresented.
      const updateTime=Number(u.timestamp||feed.header.timestamp)*1000;
      if(now-updateTime<=300000&&updateTime-now<=60000) {
        const stop=(u.stopTimeUpdate||[]).find(s=>s.stopId===stationId||Number(s.stopSequence)===t.sequence);
        if(stop&&Number(stop.scheduleRelationship||0)===1)return [];
        if(stop&&Number(stop.scheduleRelationship||0)===0) {
          const event=t.direction==='to'||stationId==='MILLENNIUM'?stop.departure:stop.arrival;
          if(event&&Object.hasOwn(event,'time')&&Number(event.time)>0) {when=Number(event.time);mode='live';}
          else if(event&&Object.hasOwn(event,'delay')&&Number.isFinite(Number(event.delay))) {when+=Number(event.delay);mode='live';}
        }
      }
    }
    return when*1000>now?[{...t,when:when*1000,mode}]:[];
  }).sort((a,b)=>a.when-b.when);
}
export function leaveBy(train,walkSeconds,bufferSeconds=180) {
  return train.when-(walkSeconds+bufferSeconds)*1000;
}
