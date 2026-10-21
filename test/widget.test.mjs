import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import gtfs from 'gtfs-realtime-bindings';
const bundle=await build({entryPoints:['src/widget.js'],bundle:true,write:false,format:'iife',globalName:'Widget',platform:'browser',target:'es2020'});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
async function run({gps=true,keys=false,liveFailure=false}={}) {
  const now=Date.now(),texts=[],requests=[];let widget,complete=false;
  const station={id:'59TH-UP',name:'59th St. (U. of Chicago)',lat:41.788,lon:-87.589};
  const trains=['to','from'].map((direction,i)=>({id:'T'+i,date:'20261022',sequence:3,direction,depart:now/1000+1200,arrive:now/1000+1170,board:true}));
  const feed={header:{gtfsRealtimeVersion:'2.0',timestamp:Math.floor(now/1000)},entity:trains.map(t=>({id:t.id,tripUpdate:{trip:{tripId:t.id,startDate:t.date},stopTimeUpdate:[{stopId:station.id,departure:{time:Math.floor(now/1000)+1500},arrival:{time:Math.floor(now/1000)+1470}}]}}))};
  class Request {constructor(url){this.url=url;this.response={statusCode:200};requests.push(url);}async loadJSON(){if(this.url.includes('stations.json'))return {version:2,generatedAt:now,stations:[station]};if(this.url.includes('59TH-UP.json'))return {version:2,generatedAt:now,station,trains};return {routes:[{summary:{duration:300,distance:400}}]};}async load(){if(liveFailure)throw Error('offline');const bytes=gtfs.transit_realtime.FeedMessage.encode(feed).finish();return {getBytes:()=>Array.from(bytes)}}}
  class Stack{addText(s){texts.push(s);return {}}addStack(){return new Stack()}addSpacer(){}layoutVertically(){}centerAlignContent(){}addImage(){return {}}setPadding(){}async presentMedium(){}}
  class Color {constructor(){}static dynamic(){return {}}}
  const env={Request,FileManager:{local:()=>({cacheDirectory:()=>'/tmp',joinPath:(a,b)=>a+'/'+b,readString:()=>{throw Error('none')},writeString:()=>{}})},Keychain:{contains:()=>keys,get:()=> 'TEST-ONLY'},Location:{setAccuracyToHundredMeters:()=>{},current:async()=>{if(!gps)throw Error('denied');return {latitude:41.789,longitude:-87.59,horizontalAccuracy:10,timestamp:now/1000}}},config:{runsInApp:false,widgetFamily:'medium'},ListWidget:Stack,Color,Font:{systemFont:()=>{},boldSystemFont:()=>{}},SFSymbol:{named:()=>({image:{}})},Size:class{},URLScheme:{forRunningScript:()=> 'scriptable:///run'},Script:{setWidget:w=>widget=w,complete:()=>complete=true}};
  await new AsyncFunction(...Object.keys(env),bundle.outputFiles[0].text+'\nawait Widget.default();')(...Object.values(env));
  assert.ok(complete&&widget);return {texts,requests};
}
test('widget shows both directions with no keys and no false live/walk values',async()=>{const {texts}=await run();assert.ok(texts.includes('TO MILLENNIUM'));assert.ok(texts.includes('FROM MILLENNIUM'));assert.ok(texts.includes('Walking key needed'));assert.ok(texts.includes('Scheduled'));assert.ok(!texts.includes('Live prediction'));});
test('widget decodes protobuf fixture and shows walking time and leave-by',async()=>{const {texts,requests}=await run({keys:true});assert.ok(texts.includes('Live prediction'));assert.ok(texts.includes('~5 min walk'));assert.ok(texts.some(t=>t.startsWith('Leave ')));assert.ok(requests.some(t=>t.startsWith('https://api.heigit.org/')));});
test('live network failure falls back honestly',async()=>{const {texts}=await run({keys:true,liveFailure:true});assert.ok(texts.includes('Scheduled'));assert.ok(texts.some(t=>t.startsWith('Live unavailable')));});
test('location denial produces helpful error',async()=>{const {texts}=await run({gps:false});assert.ok(texts.some(t=>t.includes('allow location access')));});
