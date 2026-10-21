import {unzipSync,strFromU8} from 'fflate';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {csv,seconds,chicagoParts,dayKey,serviceOrigin,activeServices} from '../src/time.mjs';
export function compile(bytes, now = new Date()) {
  const files=unzipSync(bytes), rows=name=>{const out=[];csv(strFromU8(files[name]),r=>out.push(r));return out;};
  const trips=new Map(rows('trips.txt').filter(t=>t.route_id==='ME').map(t=>[t.trip_id,{...t,stops:[]} ]));
  csv(strFromU8(files['stop_times.txt']),s=>{if(trips.has(s.trip_id))trips.get(s.trip_id).stops.push(s);});
  const feed={calendars:rows('calendar.txt'),exceptions:files['calendar_dates.txt']?rows('calendar_dates.txt'):[]};
  const selected=[...trips.values()].map(t=>({...t,stops:t.stops.sort((a,b)=>+a.stop_sequence-+b.stop_sequence)})).filter(t=>t.stops.some(s=>s.stop_id==='MILLENNIUM'));
  const stopIds=new Set(selected.flatMap(t=>t.stops.map(s=>s.stop_id)));
  const stations=rows('stops.txt').filter(s=>stopIds.has(s.stop_id)).map(s=>({id:s.stop_id,name:s.stop_name,lat:+s.stop_lat,lon:+s.stop_lon}));
  if(stations.length<10)throw Error('Unexpected Metra station data');
  const byStation=Object.fromEntries(stations.map(s=>[s.id,[]]));
  const p=chicagoParts(now);
  for(let offset=-1;offset<=7;offset++) {
    const day=new Date(Date.UTC(p.year,p.month-1,p.day+offset)),active=activeServices(feed,day),origin=serviceOrigin(day)/1000;
    for(const t of selected) {
      if(!active.has(t.service_id))continue;
      const m=t.stops.find(s=>s.stop_id==='MILLENNIUM');
      for(const s of t.stops) {
        const inbound=+s.stop_sequence < +m.stop_sequence;
        if(s.stop_id==='MILLENNIUM' && t.stops.at(-1).stop_id==='MILLENNIUM')continue;
        if(inbound ? s.pickup_type==='1'||m.drop_off_type==='1' : s.stop_id!=='MILLENNIUM'&&s.drop_off_type==='1')continue;
        const depart=origin+seconds(s.departure_time),arrive=origin+seconds(s.arrival_time);
        if(Math.max(depart,arrive)<now.getTime()/1000-7200)continue;
        byStation[s.stop_id].push({id:t.trip_id,date:dayKey(day),sequence:+s.stop_sequence,direction:inbound?'to':'from',depart,arrive,millennium:origin+seconds(inbound?m.arrival_time:m.departure_time),headsign:t.trip_headsign,board:s.pickup_type!=='1'});
      }
    }
  }
  if(!Object.values(byStation).some(a=>a.length))throw Error('No upcoming service; refusing to publish an expired feed');
  return {stations,byStation,generatedAt:now.getTime()};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  const response=process.env.METRA_ZIP?null:await fetch('https://schedules.metrarail.com/gtfs/schedule.zip',{signal:AbortSignal.timeout(30000)});
  if(response&&!response.ok)throw Error('Metra timetable download failed: '+response.status);
  const bytes=process.env.METRA_ZIP?await readFile(process.env.METRA_ZIP):new Uint8Array(await response.arrayBuffer());
  const data=compile(bytes);
  await mkdir('docs/data',{recursive:true});
  await writeFile('docs/data/stations.json',JSON.stringify({version:2,generatedAt:data.generatedAt,stations:data.stations}));
  for(const s of data.stations)await writeFile(`docs/data/${s.id}.json`,JSON.stringify({version:2,generatedAt:data.generatedAt,station:s,trains:data.byStation[s.id]}));
  console.log(`Published schedules for ${data.stations.length} Metra Electric stations.`);
}
