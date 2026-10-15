/* NOIDA HEIGHTS PG — public site enhancements (script.js keeps the form, menu and lightbox logic) */
document.addEventListener("DOMContentLoaded",()=>{
  const $=id=>document.getElementById(id), reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;

  // header gains a shadow once the page scrolls
  const hdr=$("hdr"); const onScroll=()=>hdr?.classList.toggle("scrolled",scrollY>8);
  onScroll(); addEventListener("scroll",onScroll,{passive:true});

  // hero: the 400 m counter runs while the route line draws
  const dist=$("dist");
  if(dist&&!reduce){dist.textContent="0";const t0=performance.now()+1000,dur=1800;
    const tick=n=>{const p=Math.min(1,Math.max(0,(n-t0)/dur));dist.textContent=Math.round(400*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick);}

  // restrained reveal: only rooms, panels and the move-in steps
  const items=document.querySelectorAll(".reveal");
  if("IntersectionObserver" in window&&!reduce){
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.15});
    items.forEach((el,i)=>{if(!el.style.getPropertyValue("--i"))el.style.setProperty("--i",i%3);io.observe(el)});
    const steps=$("steps"); if(steps)new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){steps.classList.add("in");o.disconnect()}}),{threshold:.3}).observe(steps);
  }else{items.forEach(el=>el.classList.add("in"));$("steps")?.classList.add("in");}

  // gallery photos open from the keyboard too
  document.querySelectorAll(".gallery-grid img").forEach(img=>img.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();img.click()}}));

  // enquiry form: min date, confirmation and reset after the hidden frame responds
  const form=$("enquiry-form"),frame=$("enquiry-frame"),msg=$("formmsg"),date=$("f_date");
  if(date)date.min=new Date().toISOString().slice(0,10);
  let sent=false;
  form?.addEventListener("submit",e=>{if(!e.defaultPrevented){sent=true;const b=form.querySelector("button[type=submit]");if(b){b.disabled=true;setTimeout(()=>{b.disabled=false},6000);}}});
  frame?.addEventListener("load",()=>{if(!sent)return;sent=false;form.reset();if(msg){msg.textContent="Thanks. Your enquiry has been submitted. For an urgent reply, call or message us on WhatsApp.";msg.className="formmsg success"}});
});
