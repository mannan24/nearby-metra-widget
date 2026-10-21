import gtfs from 'gtfs-realtime-bindings';
import {nearest,predictions,usableFeed,leaveBy,distance} from './logic.mjs';
const BASE='https://mannan24.github.io/nearby-metra-widget';
const METRA_KEY='nearby-metra-api-key-v2',WALK_KEY='nearby-metra-walk-key-v2';
const fm=FileManager.local(),now=Date.now();
const cachePath=name=>fm.joinPath(fm.cacheDirectory(),'nearby-metra-'+name+'.json');
function read(name){try{return JSON.parse(fm.readString(cachePath(name)));}catch(_){return null;}}
function save(name,value){fm.writeString(cachePath(name),JSON.stringify(value));}
function key(name){return Keychain.contains(name)?Keychain.get(name):'';}
async function json(url,options={}) {
  const r=new Request(url);r.timeoutInterval=12;
  if(options.body){r.method='POST';r.body=JSON.stringify(options.body);r.headers={'Content-Type':'application/json',...options.headers};}
  const value=await r.loadJSON();
  if(r.response.statusCode!==200)throw Error('Service unavailable');
  return value;
}
async function schedule(name) {
  const cached=read(name);
  if(cached&&now-cached.checkedAt<3600000&&now-cached.value.generatedAt<172800000)return cached.value;
  try {
    const value=await json(BASE+'/data/'+name+'.json?hour='+Math.floor(now/3600000));
    if(value.version!==2||!Number.isFinite(value.generatedAt)||now-value.generatedAt>172800000||value.generatedAt>now+60000)throw Error('Timetable is out of date');
    save(name,{checkedAt:now,value});return value;
  }catch(e){if(cached&&now-cached.value.generatedAt<172800000)return cached.value;throw e;}
}
async function setup() {
  const a=new Alert();a.title='Nearby Metra';
  a.message='Uses your location to find the nearest Metra Electric station. Walking requests send your location to HeiGIT. Keys are saved only in this phone’s Keychain. Leave either blank for scheduled times / no walk estimate.';
  a.addSecureTextField('Metra API key',key(METRA_KEY));a.addSecureTextField('HeiGIT walking API key',key(WALK_KEY));
  a.addAction('Save');a.addCancelAction('Cancel');
  if(await a.presentAlert()===0){for(const [i,k] of [METRA_KEY,WALK_KEY].entries()){const v=a.textFieldValue(i).trim();if(v)Keychain.set(k,v);else if(Keychain.contains(k))Keychain.remove(k);}}
}
async function liveFeed() {
  if(!key(METRA_KEY))return {feed:null,status:'Live key needed'};
  const cached=read('live');
  if(cached&&now-cached.fetchedAt<45000&&usableFeed(cached.feed,now))return {feed:cached.feed,status:'Live'};
  try {
    const r=new Request('https://gtfspublic.metrarr.com/gtfs/public/tripupdates?api_token='+encodeURIComponent(key(METRA_KEY)));r.timeoutInterval=12;
    const data=await r.load();
    if(r.response.statusCode!==200)throw Error('Live feed unavailable');
    const message=gtfs.transit_realtime.FeedMessage.decode(new Uint8Array(data.getBytes()));
    const feed=gtfs.transit_realtime.FeedMessage.toObject(message,{longs:Number,enums:Number});
    if(!usableFeed(feed,now))return {feed:null,status:'Live feed stale'};
    save('live',{feed,fetchedAt:now});return {feed,status:'Live'};
  }catch(_){return {feed:null,status:'Live unavailable'};}
}
async function walking(position,station) {
  if(!key(WALK_KEY))return {seconds:null,status:'Walking key needed'};
  const cached=read('walk');
  if(cached&&cached.station===station.id&&now-cached.fetchedAt<300000&&distance(position,cached.position)<25)return {...cached,status:'Estimated walk'};
  try {
    const data=await json('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/json',{
      headers:{Authorization:key(WALK_KEY)},body:{coordinates:[[position.lon,position.lat],[station.lon,station.lat]],instructions:false,radiuses:[100,150]}
    });
    const s=data.routes?.[0]?.summary;
    if(!s||!Number.isFinite(s.duration)||s.duration<0||!Number.isFinite(s.distance))throw Error('No route');
    const value={seconds:s.duration,meters:s.distance,position,station:station.id,fetchedAt:now};save('walk',value);return {...value,status:'Estimated walk'};
  }catch(_){return {seconds:null,status:'Walk unavailable'};}
}
const time=ms=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(ms));
const date=ms=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(ms));
const when=ms=>(date(ms)!==date(now)?date(ms)+' ':'')+time(ms);
function text(parent,value,size=12,bold=false,color) {
  const t=parent.addText(value);t.font=bold?Font.boldSystemFont(size):Font.systemFont(size);t.textColor=color||Color.dynamic(new Color('291F23'),new Color('F8F1F4'));t.lineLimit=1;t.minimumScaleFactor=0.75;return t;
}
async function main() {
  if(config.runsInApp){const menu=new Alert();menu.title='Nearby Metra';menu.message='Choose an action. Once installed, the widget refreshes automatically when iOS permits.';menu.addAction('Refresh and preview');menu.addAction('Configure API keys');menu.addAction('Setup guide');menu.addCancelAction('Cancel');const choice=await menu.presentSheet();if(choice===-1)return;if(choice===1)await setup();if(choice===2){await Safari.open(BASE);return;}}
  const w=new ListWidget();w.setPadding(12,14,12,14);w.backgroundColor=Color.dynamic(new Color('FAF7F8'),new Color('211B1E'));w.url=URLScheme.forRunningScript();w.refreshAfterDate=new Date(now+300000);
  const muted=Color.dynamic(new Color('65535B'),new Color('CCB8C1'));
  let station,position,locationWarning='';
  try {
    const index=await schedule('stations');
    Location.setAccuracyToHundredMeters();
    try {
      const p=await Location.current();
      if(!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||p.horizontalAccuracy<0||p.horizontalAccuracy>250)throw Error('Imprecise location');
      // Some Scriptable versions expose a location timestamp; reject old fixes when available.
      const stamp=Number(p.timestamp);const locationTime=stamp>1e12?stamp:stamp*1000;
      if(Number.isFinite(locationTime)&&now-locationTime>300000)throw Error('Old location');
      position={lat:p.latitude,lon:p.longitude};save('location',{position,fetchedAt:now});
    }catch(_){const c=read('location');if(!c||now-c.fetchedAt>300000)throw Error('Location unavailable. Open Scriptable and allow location access.');position=c.position;locationWarning='Recent location';}
    station=nearest(index.stations,position);
    if(station.meters>10000)throw Error('No Metra Electric station within 10 km. Location must be near Chicago.');
    const [data,live,walk]=await Promise.all([schedule(station.id),liveFeed(),walking(position,station)]);
    const trains=predictions(data.trains,live.feed,station.id,now);
    const small=config.widgetFamily==='small';
    text(w,station.name,small?13:15,true);
    const walkRow=w.addStack();walkRow.centerAlignContent();
    const symbol=walkRow.addImage(SFSymbol.named('figure.walk').image);symbol.imageSize=new Size(13,15);symbol.tintColor=muted;walkRow.addSpacer(4);
    text(walkRow,walk.seconds!==null?'~'+Math.ceil(walk.seconds/60)+' min walk':walk.status,11,false,muted);
    text(walkRow,' · nearest ME',10,false,muted);
    w.addSpacer(5);
    const board=w.addStack();if(small)board.layoutVertically();
    const directions=[['to','TO MILLENNIUM'],['from','FROM MILLENNIUM']];
    for(let i=0;i<directions.length;i++) {
      if(i&&!small)board.addSpacer(14);
      const [direction,label]=directions[i],col=board.addStack();col.layoutVertically();
      text(col,label,small?8:10,true,muted);
      const list=trains.filter(t=>t.direction===direction),first=list[0];
      if(direction==='to'&&station.id==='MILLENNIUM'){text(col,'You are here',14,true);continue;}
      text(col,first?when(first.when)+(small?' '+(first.mode==='live'?'live':'sched.'):''):'No train listed',small?15:23,true);
      if(!small) {
        text(col,first?(first.mode==='live'?'Live prediction':'Scheduled'):'Check Metra service',10,false,muted);
        if(first&&walk.seconds!==null) {
          const catchable=list.find(t=>t.board&&leaveBy(t,walk.seconds)>=now);
          if(catchable)text(col,'Leave '+time(leaveBy(catchable,walk.seconds))+(catchable!==first?' for '+time(catchable.when):''),10,true);
          else text(col,'No walkable departure listed',9,false,muted);
        }
      }
    }
    w.addSpacer();
    text(w,(locationWarning?locationWarning+' · ':'')+'As of '+time(now)+' CT',small?8:10,false,muted);
    if(!small)text(w,live.status==='Live'?'Live where available · leave time includes 3 min':live.status+' · scheduled times shown',9,false,muted);
    if(!small&&walk.seconds!==null)text(w,'Walk: openrouteservice · © OSM contributors',8,false,muted);
    const map='https://maps.apple.com/?daddr='+station.lat+','+station.lon+'&dirflg=w';walkRow.url=map;
  }catch(error){text(w,'Nearby Metra',16,true);w.addSpacer(6);const t=text(w,String(error.message||'Unable to load. Tap to retry.'),12,false,muted);t.lineLimit=4;}
  Script.setWidget(w);if(config.runsInApp)await w.presentMedium();Script.complete();
}
export default main;
