import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const result=await build({entryPoints:['src/widget.js'],bundle:true,write:false,format:'iife',globalName:'MetraWidget',platform:'browser',target:'es2020',minify:true,legalComments:'inline'});
const license=await readFile('GTFS-LICENSE.txt','utf8');
await mkdir('docs',{recursive:true});
await writeFile('docs/Nearby Metra.js','// Nearby Metra • automatic station, two directions, walking time\n// icon-color: deep-red; icon-glyph: train;\n/* GTFS realtime bindings license:\n'+license+'\n*/\n'+result.outputFiles[0].text+'\nawait MetraWidget.default();\n');
