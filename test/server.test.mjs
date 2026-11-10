import {resolveLink} from './platforms.mjs';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {readFile,mkdir,readdir,stat,rm,mkdtemp} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8787), host=process.env.HOST||'127.0.0.1';
const production=process.env.NODE_ENV==='production';
const engine=process.env.YTDLP_PATH||'yt-dlp';
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
const ready=[engine,ffmpeg].every(p=>spawnSync(p,[p===engine?'--version':'-version'],{windowsHide:true,timeout:15000,stdio:'ignore'}).status===0);
const base=path.resolve(process.env.DOWNLOAD_DIR||path.join(root,'downloads'));
await mkdir(base,{recursive:true});
// Each server process owns one directory. Old process directories expire on startup.
for(const name of await readdir(base)){if(!/^run-[A-Za-z0-9]+$/.test(name))continue;const p=path.join(base,name);if(Date.now()-(await stat(p)).mtimeMs>3600000)await rm(p,{recursive:true,force:true});}
const storage=await mkdtemp(path.join(base,'run-'));
const allowedOrigins=new Set((process.env.FRONTEND_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean));
const sessions=new Map(), jobs=new Map(), children=new Set();
const maxBytes=200*1024*1024, lifetime=30*60*1000;
let active=0;
const common=['--playlist-items','1','--use-extractors','youtube.*,tiktok.*,instagram.*,pinterest.*','--ignore-config','--no-playlist','--no-colors','--no-warnings','--socket-timeout','20','--retries','1','--js-runtimes',`node:${process.execPath}`];
if(process.env.FFMPEG_PATH)common.push('--ffmpeg-location',ffmpeg);
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function session(req,res){const cookie=req.headers['x-media-session'];let s=sessions.get(cookie);if(!s){if(sessions.size>=1000)throw Error('Server is busy. Please try later.');const id=randomBytes(24).toString('hex');s={id,token:randomBytes(24).toString('hex'),created:Date.now(),requests:[]};sessions.set(id,s);}return s;}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>8192)throw Error('Request too large.');}try{return JSON.parse(s);}catch{throw Error('Invalid request.');}}
function run(args,onLine,timeout=90000){return new Promise((resolve,reject)=>{let out='',buffer='',stderr='';const child=spawn(engine,[...common,...args],{windowsHide:true,shell:false});children.add(child);const timer=setTimeout(()=>{child.kill();reject(Error('The request timed out. Please try a shorter video.'));},timeout);child.stdout.on('data',b=>{out+=b;buffer+=b;if(out.length>8e6){child.kill();return;}const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const l of lines)onLine?.(l);});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});child.on('error',()=>{clearTimeout(timer);children.delete(child);reject(Error('Download engine is unavailable. Please contact the site owner.'));});child.on('close',code=>{clearTimeout(timer);children.delete(child);if(buffer)onLine?.(buffer);if(code===0)resolve(out);else {console.error('Downloader failed:',stderr);reject(Error('Platform tidak menyediakan video ini. It may be restricted, unavailable, or blocking this server. Try another video later.'));}});});}
function publicJob(j){const {owner,folder,...visible}=j;return visible;}
async function cleanup(){const now=Date.now();for(const [id,j]of jobs){if(!['downloading','inspecting'].includes(j.state)&&now-j.finished>lifetime){await rm(j.folder,{recursive:true,force:true});jobs.delete(id);}}for(const [id,s]of sessions){if(now-s.created>86400000)sessions.delete(id);}}
setInterval(()=>cleanup().catch(console.error),60000).unref();
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local');
 res.setHeader('Referrer-Policy','no-referrer');
 if(u.pathname==='/health')return json(res,ready?200:503,{ok:ready});
 const requestOrigin=req.headers.origin;
 const sameOrigin=requestOrigin && (()=>{try{return new URL(requestOrigin).host===req.headers.host;}catch{return false;}})();
 if(requestOrigin && !sameOrigin && !allowedOrigins.has(requestOrigin))return json(res,403,{error:'Alamat website belum diizinkan backend. Atur FRONTEND_ORIGIN.'});
 if(requestOrigin && allowedOrigins.has(requestOrigin)){res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Clipnest-Token, X-Media-Session');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 if(req.headers['sec-fetch-site']==='cross-site'&&!allowedOrigins.has(requestOrigin))return json(res,403,{error:'Open the configured website to continue.'});
 const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/tiktok.js':['tiktok.js','text/javascript'],'/youtube.js':['youtube.js','text/javascript'],'/config.js':['config.js','text/javascript'],'/style.css':['style.css','text/css']};
 if(req.method==='GET'&&files[u.pathname]){const [name,type]=files[u.pathname];res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' https: data: blob:; script-src 'self'; style-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});return res.end(await readFile(path.join(root,'public',name)));}
 const s=session(req,res);
 if(req.method==='GET'&&u.pathname==='/api/status')return json(res,200,{sessionId:s.id,token:s.token,ready,jobs:[...jobs.values()].filter(j=>j.owner===s.id).map(publicJob)});
 if(req.method==='GET'&&u.pathname.startsWith('/api/file/')){const j=jobs.get(u.pathname.slice(10));if(!j||j.owner!==s.id||j.state!=='complete')return json(res,404,{error:'File unavailable or expired.'});const file=path.join(j.folder,j.filename),info=await stat(file);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(j.filename)}`});const stream=createReadStream(file);res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());return stream.pipe(res);}
 if(req.method!=='POST'||!['/api/inspect','/api/download'].includes(u.pathname))return json(res,404,{error:'Not found.'});
 if(req.headers['x-clipnest-token']!==s.token)return json(res,403,{error:'Refresh the page and try again.'});
 if(!ready)return json(res,503,{error:'The download service is temporarily unavailable.'});
 const now=Date.now();s.requests=s.requests.filter(t=>now-t<3600000);if(s.requests.length>=20)return json(res,429,{error:'Hourly request limit reached. Please try again later.'});
 const data=await body(req),media=await resolveLink(data.url),url=media.url;
 if(active>=2)return json(res,429,{error:'Both download slots are busy. Please try again shortly.'});
 if(jobs.size>=10)return json(res,429,{error:'Temporary storage is full. Please try again after older files expire.'});
 if([...jobs.values()].some(j=>j.owner===s.id&&j.state==='downloading'))return json(res,409,{error:'Wait for your current download to finish.'});
 s.requests.push(now);
 if(u.pathname==='/api/inspect'){active++;try{const raw=JSON.parse(await run(['--dump-single-json','--skip-download','--',url]));const info=raw.entries?.find(Boolean)||raw;if(info.is_live||(info.duration&&info.duration>1200))throw Error('Pilih video selesai berdurasi maksimal 20 menit.');if(!info.formats?.length&&!info.url)throw Error('Post ini tidak berisi video yang dapat diunduh. Foto Instagram/Pinterest belum didukung.');let heights=[...new Set((info.formats||[]).filter(f=>f.vcodec!=='none'&&f.height&&f.height<=1080).map(f=>f.height))].sort((a,b)=>b-a);if(!heights.length)heights=[720];const thumbnail=/^https:\/\//.test(info.thumbnail||'')?info.thumbnail:'';return json(res,200,{url,platform:media.name,title:info.title||media.name+' video',channel:info.uploader||media.name,duration:info.duration||null,thumbnail,heights});}finally{active--;}}
 if(!['video','audio'].includes(data.mode))throw Error('Select video or audio.');const quality=Number(data.quality);if(data.mode==='video'&&(!Number.isInteger(quality)||quality<144||quality>1080))throw Error('Choose a quality up to 1080p.');
 // Reserve capacity before asynchronous directory creation.
 active++;let folder;try{folder=await mkdtemp(path.join(storage,'job-'));}catch(e){active--;throw e;}
 const id=randomUUID(),j={id,owner:s.id,folder,title:String(data.title||'Media video').slice(0,200),mode:data.mode,state:'downloading',progress:0,message:'Menghubungkan ke platform…',createdAt:now};jobs.set(id,j);
 const opts=data.mode==='audio'?['-f','bestaudio/best','-x','--audio-format','mp3','--audio-quality','5']:['-f',`bv*[height<=?${quality}]+ba/b[height<=?${quality}]`,'--merge-output-format','mkv'];
 run(['--match-filters','!is_live & duration <=? 1200','--max-filesize',String(maxBytes),'--newline','--progress','--progress-template','download:PROGRESS:%(progress._percent_str)s','--print','after_move:FILE:%(filepath)s','--no-simulate','--windows-filenames','-P',folder,'-o','%(title).80B.%(ext)s',...opts,'--',url],line=>{if(line.startsWith('PROGRESS:')){j.progress=Math.min(99,parseFloat(line.slice(9))||0);j.message=j.progress>=99?'Preparing file…':`Downloading ${j.progress.toFixed(1)}%`;}},600000).then(async()=>{const names=(await readdir(folder)).filter(n=>!n.endsWith('.part')&&!n.endsWith('.ytdl'));if(names.length!==1)throw Error('No completed file. The video may exceed the 20-minute or 200 MB limit.');const info=await stat(path.join(folder,names[0]));if(info.size>maxBytes)throw Error('File exceeds 200 MB. Try a lower quality.');j.filename=names[0];j.state='complete';j.progress=100;j.message='Ready to save · available for 30 minutes';}).catch(async e=>{j.state='error';j.message=e.message;await rm(folder,{recursive:true,force:true}).catch(console.error);}).finally(()=>{j.finished=Date.now();active--;});
 return json(res,202,{id});
 }catch(e){if(!res.headersSent)json(res,400,{error:e.message});else res.destroy();}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,host,()=>console.log(`ClipNest listening on ${host}:${port}; download engine ${ready?'ready':'unavailable'}`));
async function stop(){for(const child of children)child.kill();server.close();await rm(storage,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
