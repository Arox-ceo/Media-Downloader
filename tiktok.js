
const API = "https://www.tikwm.com/api/";   // third-party resolver (change here if it moves)
const HOST = "https://www.tikwm.com";
const $ = s => document.querySelector(s);
const urlIn = $("#url"), goBtn = $("#go"), out = $("#out"), msg = $("#msg");

// Make links absolute and https (an http file on an https page is blocked as mixed content)
const abs = u => !u ? "" : (/^https?:/i.test(u) ? u : HOST + u).replace(/^http:/i, "https:");
const wait = ms => new Promise(r => setTimeout(r, ms));
const prox = $("#prox");
const store = {
  get(k){ try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} }
};
prox.value = store.get("dl_prox");
prox.onchange = () => store.set("dl_prox", prox.value.trim());

function platform(u){
  if (/^https?:\/\/([\w-]+\.)?tiktok\.com\//i.test(u)) return "tiktok";
  try{const host=new URL(u).hostname;if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','pinterest.com','www.pinterest.com','id.pinterest.com','pinterest.co.uk','www.pinterest.co.uk','pin.it'].includes(host))return 'backend';}catch{}
  return '';
}
function say(t, err, busy){ msg.textContent = t; msg.className = err ? "err" : busy ? "busy" : ""; }
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

async function resolve(link){
  for (let tries = 0; tries < 3; tries++){
    let j;
    try {
      const r = await fetch(API + "?hd=1&url=" + encodeURIComponent(link));
      if (!r.ok) throw new Error("The resolver returned " + r.status + ". Try again in a few seconds.");
      j = await r.json();
    } catch (e) {
      if (e instanceof TypeError) throw new Error("Could not reach the resolver. Check your connection and open this page from a normal browser tab (a sandboxed preview blocks outside requests).");
      throw e;
    }
    if (j.code === 0 && j.data) return j.data;
    // The free resolver allows about one request per second
    if (/limit|second/i.test(j.msg || "") && tries < 2){ await wait(1500); continue; }
    throw new Error(j.msg || "Could not read that link. Check that the post is public.");
  }
}

/* ---------- saving files ---------- */
// Wrap the download proxy address around a file link (empty string when no proxy is set)
function proxied(u){
  const p = prox.value.trim();
  if (!p) return "";
  return p.includes("{url}") ? p.replace("{url}", encodeURIComponent(u)) : p + encodeURIComponent(u);
}

async function grab(u){
  const r = await fetch(u, { referrerPolicy: "no-referrer" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const b = await r.blob();
  if (!b.size) throw new Error("empty file");
  return b;
}

function putFile(blob, name){
  // Fix the extension when the real type differs (photos are often webp)
  const ext = { "image/webp": ".webp", "image/png": ".png", "image/jpeg": ".jpg", "video/mp4": ".mp4", "audio/mpeg": ".mp3" }[(blob.type || "").split(";")[0]];
  if (ext) name = name.replace(/\.\w+$/, ext);
  const a = el("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);   // long videos need time to start writing
}

// Direct fetch first, then the optional proxy. Returns true once a file was handed to the browser.
async function fetchAndSave(url, name){
  for (const u of [url, proxied(url)]){
    if (!u) continue;
    try { putFile(await grab(u), name); return true; } catch (e) {}
  }
  return false;
}

// If the host blocks saving from a web page (CORS), open the file itself in a new tab so it can be saved from there.
async function save(url, name, btn){
  if (btn.dataset.open){ window.open(url, "_blank"); return; }   // second tap: opened inside the click, so popups are allowed
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Downloading..."; say("Downloading...", false, true);
  const ok = await fetchAndSave(url, name);
  btn.disabled = false; btn.textContent = label;
  if (ok) return say("Saved " + name);
  const w = window.open(url, "_blank");
  if (w){
    w.opener = null;
    say("This host blocks direct saving, so the file opened in a new tab. Save it from there (right-click or long-press), or add a download proxy in Settings.", true);
  } else {
    btn.dataset.open = "1"; btn.textContent = "Open file";
    say("This host blocks direct saving and the browser blocked the new tab. Tap the button again to open the file.", true);
  }
}

/* ---------- save to gallery (mobile share sheet) ---------- */
const MOBILE = matchMedia("(pointer:coarse)").matches && typeof navigator.canShare === "function";
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", mp3: "audio/mpeg" };
function fixName(blob, name){
  const ext = { "image/webp": ".webp", "image/png": ".png", "image/jpeg": ".jpg", "video/mp4": ".mp4", "audio/mpeg": ".mp3" }[(blob.type || "").split(";")[0]];
  return ext ? name.replace(/\.\w+$/, ext) : name;
}

async function toGallery(items, btn){
  const label = btn.dataset.label || (btn.dataset.label = btn.textContent);
  let files = btn._files; btn._files = null;
  if (files){
    btn.textContent = label;
  } else {
    btn.disabled = true; btn.textContent = "Preparing..."; say("Preparing for your gallery...", false, true);
    files = [];
    for (const it of items){
      let blob = null;
      for (const u of [it.url, proxied(it.url)]){ if (!u) continue; try { blob = await grab(u); break; } catch (e) {} }
      if (!blob){
        btn.disabled = false; btn.textContent = label;
        return say("This host blocks the download, so it can't go to your gallery. Try the normal Save button.", true);
      }
      const name = fixName(blob, it.name);
      files.push(new File([blob], name, { type: MIME[name.split(".").pop().toLowerCase()] || blob.type }));
    }
    btn.disabled = false; btn.textContent = label;
  }
  if (!navigator.canShare({ files })) return say("This browser can't send these files to the gallery. Use the normal Save button.", true);
  try {
    await navigator.share({ files });
    say("Choose Save Image / Save Video (iPhone) or Gallery / Photos (Android) in the menu.");
  } catch (e) {
    if (e.name === "AbortError") return say("");
    if (e.name === "NotAllowedError"){   // too long since the tap: keep the files ready for one more tap
      btn._files = files; btn.textContent = "Tap again to open gallery";
      return say("Files are ready. Tap the button once more.");
    }
    say("Could not open the share menu. Use the normal Save button.", true);
  }
}

function gBtn(label, items, cls){
  const b = el("button", "btn " + (cls || ""), label); b.type = "button";
  b.onclick = () => toGallery(items, b);
  return b;
}

function dlBtn(label, url, name, cls){
  const b = el("button", "btn " + (cls || ""), label); b.type = "button";
  b.onclick = () => save(abs(url), name, b);
  return b;
}

function render(d){
  out.replaceChildren();
  const id = d.id || Date.now();
  const card = el("div", "card");

  const head = el("div", "head");
  const cover = el("img", "cover"); cover.src = abs(d.cover || (d.images && d.images[0])); cover.alt = ""; cover.referrerPolicy = "no-referrer";
  const meta = el("div", "meta");
  const by = [d.author && d.author.unique_id ? "@" + d.author.unique_id : "", d.duration ? d.duration + "s" : ""].filter(Boolean).join(" - ");
  meta.append(el("h2", "", d.title || "Untitled post"), el("p", "mute", by));
  head.append(cover, meta);
  card.append(head);

  const photos = (Array.isArray(d.images) ? d.images : []).map(abs);
  const row = el("div", "row");

  if (photos.length){
    const grid = el("div", "grid");
    photos.forEach((u, i) => {
      const f = el("figure"), im = el("img");
      im.src = u; im.alt = "Photo " + (i + 1); im.loading = "lazy"; im.referrerPolicy = "no-referrer";
      f.append(im, dlBtn("Save photo " + (i + 1), u, `tiktok_${id}_${i + 1}.jpg`, "sm"));
      if (MOBILE) f.append(gBtn("To gallery", [{ url: u, name: `tiktok_${id}_${i + 1}.jpg` }], "sm"));
      grid.append(f);
    });
    const label = "Save all " + photos.length + " photos";
    const all = el("button", "btn primary", label); all.type = "button";
    all.onclick = async () => {
      all.disabled = true; let n = 0;
      for (let i = 0; i < photos.length; i++){
        all.textContent = "Saving " + (i + 1) + "/" + photos.length + "...";
        if (!(await fetchAndSave(photos[i], `tiktok_${id}_${i + 1}.jpg`))) break;
        n++; await wait(400);
      }
      all.textContent = label; all.disabled = false;
      if (n === photos.length) say("Saved all " + n + " photos.");
      else say("This host blocks saving many files at once. Use the Save photo button under each image.", true);
    };
    row.append(all);
    if (MOBILE) row.append(gBtn("Save all " + photos.length + " to gallery", photos.map((u, i) => ({ url: u, name: `tiktok_${id}_${i + 1}.jpg` }))));
    card.append(grid);
  } else {
    if (d.hdplay) row.append(dlBtn("Video HD", d.hdplay, `tiktok_${id}_hd.mp4`, "primary"));
    if (d.play) row.append(dlBtn("Video", d.play, `tiktok_${id}.mp4`, d.hdplay ? "" : "primary"));
    if (d.wmplay) row.append(dlBtn("Video with watermark", d.wmplay, `tiktok_${id}_wm.mp4`));
    if (MOBILE && (d.hdplay || d.play)) row.append(gBtn("Video to gallery", [{ url: abs(d.hdplay || d.play), name: `tiktok_${id}.mp4` }]));
  }
  if (d.music) row.append(dlBtn("Audio", d.music, `tiktok_${id}_audio.mp3`));
  if (d.cover) row.append(dlBtn("Cover image", d.cover, `tiktok_${id}_cover.jpg`));

  card.append(row);
  if (MOBILE) card.append(el("p", "mute", "To gallery opens your share menu. Choose Save Image or Save Video on iPhone, or Gallery / Photos on Android."));
  out.append(card);
}

async function run(){
  const link = urlIn.value.trim();
  out.replaceChildren();
  const kind = platform(link);
  if (!kind) return say("Enter a YouTube, TikTok, Instagram, or Pinterest link.", true);
  if(kind==='backend'){if(window.mediaLookup)await window.mediaLookup(link);else say('Video service is still loading. Try again.',true);return;}
  goBtn.disabled = true; say("Reading the link...", false, true);
  try {
    render(await resolve(link));
    say("Ready. Choose what to save.");
  } catch (e) {
    say(e.message || "Something went wrong. Try again.", true);
  }
  goBtn.disabled = false;
}

goBtn.onclick = run;
urlIn.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
$("#paste").onclick = async () => {
  try { urlIn.value = (await navigator.clipboard.readText()).trim(); run(); }
  catch (e) { say("Clipboard access was blocked. Paste the link into the box instead.", true); }
};
