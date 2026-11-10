const names={youtube:'YouTube',tiktok:'TikTok',instagram:'Instagram',pinterest:'Pinterest'};
export function identify(value){
 let u;try{u=new URL(value);}catch{throw Error('Masukkan link lengkap yang valid.');}
 if(u.protocol!=='https:'||u.port||u.username||u.password)throw Error('Gunakan link HTTPS tanpa port atau kredensial.');
 const h=u.hostname.toLowerCase();let platform,url;
 if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(h)){
  const id=h==='youtu.be'?u.pathname.split('/')[1]:u.pathname==='/watch'?u.searchParams.get('v'):/^\/(shorts|live|embed)\//.test(u.pathname)?u.pathname.split('/')[2]:null;
  if(!/^[\w-]{11}$/.test(id||''))throw Error('Gunakan link video YouTube, bukan channel atau playlist.');
  platform='youtube';url=`https://www.youtube.com/watch?v=${id}`;
 }else if(['instagram.com','www.instagram.com'].includes(h)){
  const match=u.pathname.match(/^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/);
  if(!match)throw Error('Gunakan link post video atau Reel Instagram publik.');
  platform='instagram';url=`https://www.instagram.com/${match[1]==='reels'?'reel':match[1]}/${match[2]}/`;
 }else if(['pinterest.com','www.pinterest.com','id.pinterest.com','pinterest.co.uk','www.pinterest.co.uk'].includes(h)){
  const match=u.pathname.match(/^\/pin\/(?:[\w-]+--)?(\d+)\/?$/);
  if(!match)throw Error('Gunakan link satu Pin video, bukan profil atau board.');
  platform='pinterest';url=`https://www.pinterest.com/pin/${match[1]}/`;
 }else if(h==='pin.it'&&/^\/[A-Za-z0-9]+\/?$/.test(u.pathname)){
  platform='pinterest';url=`https://pin.it${u.pathname}`;
 }else if(['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(h)){
  if(!/^\/(?:@[\w.-]+\/(?:video|photo)\/\d+|t\/[A-Za-z0-9]+|[A-Za-z0-9]+)\/?$/.test(u.pathname))throw Error('Gunakan link satu post TikTok.');
  platform='tiktok';url=`https://${h}${u.pathname}`;
 }else throw Error('Link harus dari YouTube, TikTok, Instagram, atau Pinterest.');
 return {platform,name:names[platform],url};
}
export async function resolveLink(value){
 let media=identify(value);
 // Resolve Pinterest short links without permitting redirects to arbitrary hosts.
 if(new URL(media.url).hostname==='pin.it'){
  for(let i=0;i<5;i++){
   const response=await fetch(media.url,{redirect:'manual',signal:AbortSignal.timeout(10000)});
   await response.body?.cancel();
   if(response.status<300||response.status>=400)break;
   const location=response.headers.get('location');if(!location)break;
   const next=new URL(location,media.url);const host=next.hostname;
   if(next.protocol!=='https:'||next.username||next.password||next.port)throw Error('Redirect link tidak didukung.');
   if(host==='api.pinterest.com'&&next.pathname.startsWith('/url_shortener/')){
    const redirected=await fetch(next,{redirect:'manual',signal:AbortSignal.timeout(10000)});await redirected.body?.cancel();
    const final=redirected.headers.get('location');if(!final)throw Error('Buka link pendek di browser dan salin link /pin/ lengkap.');media=identify(new URL(final,next).href);
   }else media=identify(next.href);
   if(new URL(media.url).hostname!=='pin.it')return media;
  }
  throw Error('Buka pin.it di browser lalu salin link Pinterest /pin/ lengkap.');
 }
 return media;
}
