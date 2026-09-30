const C=window.SITE_CONFIG||{},$=id=>document.getElementById(id);
const set=v=>v&&!/^\[.*\]$/.test(v.trim());
// Booking scheduler link (optional)
if(set(C.bookingUrl)&&$("scheduler")){$("scheduler").href=C.bookingUrl;$("scheduler").style.display=""}
// Email links
if(set(C.email)){if($("partnerLink"))$("partnerLink").href="mailto:"+C.email+"?subject="+encodeURIComponent("Emma's Pretty Mommy Partnership");$("footEmail").href="mailto:"+C.email;$("footEmail").textContent=C.email}
else if($("partnerLink")){$("partnerLink").href="book.html"}
// Social chips: hide any without a link
document.querySelectorAll("[data-social]").forEach(a=>{const u=(C.social||{})[a.dataset.social];if(set(u))a.href=u;else a.remove()});
// Shop: show only when affiliate links exist
const aff=C.affiliate||[],btns=document.querySelectorAll(".aff");let any=false;
btns.forEach((b,i)=>{if(set(aff[i])){b.href=aff[i];any=true}else b.style.display="none"});
if(any&&$("shop"))$("shop").style.display="";
// Prefill service + source from ad links (?service=prom&utm_source=meta)
const qp=new URLSearchParams(location.search),sp=qp.get("service"),up=qp.get("utm_source");
const svcMap={photography:"photography",prom:"prom",event:"special event",bridal:"bridal",wedding:"bridal",avant:"avant-garde",editorial:"avant-garde"};
if(sp&&$("service")){const want=svcMap[sp.toLowerCase()]||sp.toLowerCase(),s=$("service");[...s.options].forEach(o=>{if(o.text.toLowerCase().includes(want))s.value=o.value})}
if(up&&$("source")){const s=up.toLowerCase(),x=$("source");if(s.includes("instagram"))x.value="Instagram";else if(s.includes("tiktok"))x.value="TikTok";else if(s.includes("youtube"))x.value="YouTube";else if(s.includes("pinterest"))x.value="Pinterest";else if(s.includes("weddingwire"))x.value="WeddingWire";else if(s.includes("knot"))x.value="The Knot";else if(s.includes("chatgpt"))x.value="ChatGPT Ad";else if(s.includes("meta")||s.includes("facebook"))x.value="Meta / Facebook Ad"}
const esc=s=>(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
// Booking form -> Google Sheet (and email to you); falls back to an email draft
if($("bookingForm"))$("bookingForm").onsubmit=async e=>{
  e.preventDefault();
  const g=id=>$(id).value.trim(),r=$("result"),btn=e.target.querySelector("button");
  if(g("website"))return; // spam bot
  const data={type:"booking",name:g("name"),contact:g("contact"),instagram:g("ig"),service:g("service"),date:g("date"),time:g("time"),location:g("location"),notes:g("notes"),source:g("source"),utm:up||"",party:g("party")};
  const done=msg=>{r.style.display="block";r.innerHTML=`<div class="eyebrow">REQUEST RECEIVED</div><h3 style="font-family:Georgia,serif;margin:7px 0">Thank you, ${esc(data.name)}!</h3><p style="font-size:13px;line-height:1.55;color:#62565d">${msg}</p>`;r.scrollIntoView({behavior:"smooth",block:"nearest"})};
  if(set(C.backendUrl)){
    btn.disabled=true;btn.textContent="SENDING…";
    try{const res=await fetch(C.backendUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(data)});const j=await res.json();if(!j.ok)throw 0;
      e.target.reset();done(`I got your request for <b>${esc(data.service)}</b> on <b>${esc(data.date)}</b>. I'll reach out personally to confirm availability and your deposit.`)}
    catch(_){done(`Something went wrong sending your request. Please email me${set(C.email)?` at <a href="mailto:${C.email}">${C.email}</a>`:""} and I'll get right back to you.`)}
    btn.disabled=false;btn.textContent="SEND MY BOOKING REQUEST →";
  }else if(set(C.email)){
    const body=Object.entries(data).map(([k,v])=>k+": "+v).join("\n");
    location.href="mailto:"+C.email+"?subject="+encodeURIComponent("Booking request: "+data.service)+"&body="+encodeURIComponent(body);
    done("Your email app should open with your request filled in. Just press send.");
  }else done("Online booking is opening soon. Please message me on Instagram to book.");
};
