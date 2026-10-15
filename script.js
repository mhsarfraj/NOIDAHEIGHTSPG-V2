/* NOIDA HEIGHTS PG — public site + owner portal */
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxzhNOLAiiFOpllADca6KqKZWSsrvO0Yl3frhDl7p7bI9oay7ZzXrdhCZ8Yxvi8U674sQ/exec";
let OWNER_TOKEN = "";
let OWNER_DATA = {students:[],payments:[],maintenance:[],enquiries:[],notices:[],leaves:[],expenses:[],tickets:[]};
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);
const money = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(action, payload={}) {
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL.includes("PASTE_")) throw new Error("The portal is not available right now. Please try again later.");
  const res = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,token:OWNER_TOKEN,...payload})});
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}
function msg(id,text,type=""){const el=$(id);if(el){el.textContent=text;el.className="owner-msg "+type;}}
document.addEventListener("DOMContentLoaded", () => {
  const enquiry=$("enquiry-form"), enquiryMsg=$("formmsg");
  document.querySelectorAll("[data-room]").forEach(b=>b.addEventListener("click",()=>{if($("f_room"))$("f_room").value=b.dataset.room;}));
  const burger=$("burger"); if(burger)burger.addEventListener("click",()=>{const o=document.querySelector(".hdr-nav")?.classList.toggle("mobile-open");burger.setAttribute("aria-expanded",o?"true":"false");});
  if(enquiry)enquiry.addEventListener("submit",e=>{
    if(!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL.includes("PASTE_")){e.preventDefault();if(enquiryMsg){enquiryMsg.textContent="Enquiries are temporarily unavailable. Please call or WhatsApp us on 8799731416.";enquiryMsg.className="formmsg error";}return;}
    enquiry.action=GOOGLE_SHEETS_WEB_APP_URL;
    if(enquiryMsg){enquiryMsg.textContent="Sending your enquiry…";enquiryMsg.className="formmsg success";}
  });
  const lightbox=$("lightbox"), lightboxImg=$("lightbox-img");
  document.querySelectorAll(".gallery-grid img").forEach(img=>img.addEventListener("click",()=>{if(lightbox&&lightboxImg){lightboxImg.src=img.src;lightboxImg.alt=img.alt||"Property photo";lightbox.classList.add("open");lightbox.setAttribute("aria-hidden","false");}}));
  const close=()=>{lightbox?.classList.remove("open");lightbox?.setAttribute("aria-hidden","true");};
  document.querySelector(".lightbox-close")?.addEventListener("click",close);
  lightbox?.addEventListener("click",e=>{if(e.target===lightbox)close();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  document.querySelectorAll(".hdr-nav a").forEach(a=>a.addEventListener("click",()=>document.querySelector(".hdr-nav")?.classList.remove("mobile-open")));

  if($("owner-login-form")){
    try{const uid=localStorage.getItem("nh_owner_uid");if(uid){$("owner-userid").value=uid;if($("owner-remember"))$("owner-remember").checked=true;}
      const t=sessionStorage.getItem("nh_owner_t");
      if(t){OWNER_TOKEN=t;$("owner-login-card").hidden=true;$("owner-dashboard").hidden=false;startIdle(ownerSignOut);loadDashboard();}}catch(_){}
  }
  $("owner-open")?.addEventListener("click",()=>{$("owner-area").scrollIntoView({behavior:"smooth"});$("owner-userid")?.focus();});
  $("owner-login-form")?.addEventListener("submit",async e=>{
    e.preventDefault(); msg("owner-login-msg","Signing in…");
    try{const d=await api("login",{userId:$("owner-userid").value.trim(),password:$("owner-password").value});if(d.role!=="owner") throw new Error("This account is not an owner account. Please use the Student Resident Portal."); OWNER_TOKEN=d.token;try{sessionStorage.setItem("nh_owner_t",d.token);if($("owner-remember")?.checked)localStorage.setItem("nh_owner_uid",$("owner-userid").value.trim());else localStorage.removeItem("nh_owner_uid");}catch(_){}
      $("owner-login-card").hidden=true;$("owner-dashboard").hidden=false;msg("owner-login-msg","");$("owner-password").value="";startIdle(ownerSignOut);
      await loadDashboard();
    }catch(err){msg("owner-login-msg",err.message,"error");}
  });
  $("owner-logout")?.addEventListener("click",()=>ownerSignOut());
  $("password-form")?.addEventListener("submit",async e=>{e.preventDefault();const n=$("pw-new").value;if(n!==$("pw-confirm").value){msg("password-msg","The new passwords do not match.","error");return;}try{await api("changePassword",{current:$("pw-current").value,next:n});$("password-form").reset();msg("password-msg","Password updated.","success");}catch(err){msg("password-msg",err.message,"error");}});
  document.querySelectorAll(".owner-tab").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".owner-tab").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-selected",x===b?"true":"false");});
    document.querySelectorAll(".owner-pane").forEach(x=>{x.classList.toggle("active",x.id==="pane-"+b.dataset.tab);x.hidden=x.id!=="pane-"+b.dataset.tab;});
    const pane=$("pane-"+b.dataset.tab); if(window.matchMedia("(max-width: 700px)").matches && pane) pane.scrollIntoView({behavior:"smooth",block:"start"});
  }));
  $("refresh-data")?.addEventListener("click",loadDashboard);
  $("student-search")?.addEventListener("input",renderStudents);
  $("student-status-filter")?.addEventListener("change",renderStudents);
  $("overview-refresh")?.addEventListener("click",loadDashboard);
  document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>{const tab=document.querySelector(`.owner-tab[data-tab="${b.dataset.jump}"]`);if(tab)tab.click();}));
  document.querySelectorAll("[data-export]").forEach(b=>b.addEventListener("click",()=>exportOwnerCsv(b.dataset.export)));
  $("add-student-btn")?.addEventListener("click",()=>showStudentForm());
  $("cancel-student")?.addEventListener("click",()=>{$("student-form").hidden=true;});
  $("student-form")?.addEventListener("submit",saveStudent);
  $("refresh-leaves")?.addEventListener("click",loadDashboard);
  if($("notice-date")) $("notice-date").value=today();
  if($("expense-date")) $("expense-date").value=today();
  $("notice-form")?.addEventListener("submit",saveNotice);
  $("expense-form")?.addEventListener("submit",saveExpense);
  $("add-payment-btn")?.addEventListener("click",()=>{$("payment-form").hidden=false;$("payment-date").value=today();populatePaymentStudents();});
  $("cancel-payment")?.addEventListener("click",()=>{$("payment-form").hidden=true;});
  $("payment-form")?.addEventListener("submit",savePayment);
  $("add-maintenance-btn")?.addEventListener("click",()=>{$("maintenance-form").hidden=false;$("maintenance-date").value=today();});
  $("cancel-maintenance")?.addEventListener("click",()=>{$("maintenance-form").hidden=true;});
  $("maintenance-form")?.addEventListener("submit",saveMaintenance);
  document.addEventListener("click",async e=>{
    const b=e.target.closest("[data-action]");if(!b)return;
    const {action,id}=b.dataset;
    if(action==="edit-student"){const s=OWNER_DATA.students.find(x=>String(x.id)===id);if(s)showStudentForm(s);}
    if(action==="reset-student"&&confirm("Issue a new temporary password for this resident? Their current password will stop working.")){try{const d=await api("resetStudentPassword",{id});msg("dashboard-msg",`New login for ${d.userId}. Temporary password: ${d.password}. Share it privately.`,"success");window.scrollTo({top:0,behavior:"smooth"});}catch(err){msg("dashboard-msg",err.message,"error");}}
    if(action==="delete-student"&&confirm("Remove this student record?"))runAction("deleteStudent",{id});
    if(action==="delete-payment"&&confirm("Delete this payment record?"))runAction("deletePayment",{id});
    if(action==="delete-maintenance"&&confirm("Delete this maintenance request?"))runAction("deleteMaintenance",{id});
    if(action==="complete-maintenance")runAction("updateMaintenance",{id,status:"Completed"});
    if(action==="update-resident-ticket")runAction("updateResidentTicket",{id,status:b.dataset.status});
    if(action==="approve-leave")runAction("updateLeave",{id,status:"Approved"});
    if(action==="decline-leave")runAction("updateLeave",{id,status:"Declined"});
    if(action==="delete-notice"&&confirm("Delete this notice from the resident board?"))runAction("deleteNotice",{id});
    if(action==="delete-expense"&&confirm("Delete this expense record?"))runAction("deleteExpense",{id});
  });
});
function ownerSignOut(msgText){const t=OWNER_TOKEN;OWNER_TOKEN="";try{sessionStorage.removeItem("nh_owner_t");}catch(_){}OWNER_DATA={students:[],payments:[],maintenance:[],enquiries:[],notices:[],leaves:[],expenses:[],tickets:[]};if(t&&GOOGLE_SHEETS_WEB_APP_URL&&!GOOGLE_SHEETS_WEB_APP_URL.includes("PASTE_"))fetch(GOOGLE_SHEETS_WEB_APP_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"logout",token:t})}).catch(()=>{});stopIdle();$("owner-dashboard").hidden=true;$("owner-login-card").hidden=false;$("owner-password").value="";msg("owner-login-msg",typeof msgText==="string"?msgText:"You have been signed out.");}
let IDLE_T=null,IDLE_FN=null;const IDLE_MS=15*60*1000;
function idleReset(){clearTimeout(IDLE_T);if(IDLE_FN)IDLE_T=setTimeout(()=>IDLE_FN("Signed out after 15 minutes of inactivity."),IDLE_MS);}
function startIdle(fn){IDLE_FN=fn;["click","keydown","touchstart","scroll"].forEach(ev=>addEventListener(ev,idleReset,{passive:true}));idleReset();}
function stopIdle(){IDLE_FN=null;clearTimeout(IDLE_T);}
async function loadDashboard(){
  msg("dashboard-msg","Loading latest records…");
  try{const d=await api("dashboard");OWNER_DATA=d.data;renderDashboard();msg("dashboard-msg","");}
  catch(e){if(/session expired/i.test(e.message)){ownerSignOut(e.message);return;}msg("dashboard-msg",e.message,"error");}
}
function renderDashboard(){
  const active=OWNER_DATA.students.filter(s=>(s.status||"Active")==="Active");
  const monthlyExpected=active.reduce((sum,s)=>sum+Number(s.monthlyFee||0),0);
  const outstanding=active.reduce((sum,s)=>sum+Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0)),0);
  const month=today().slice(0,7);
  const collectedThisMonth=OWNER_DATA.payments.filter(p=>String(p.date||"").slice(0,7)===month).reduce((sum,p)=>sum+Number(p.amount||0),0);
  const overdue=active.filter(s=>s.dueDate&&s.dueDate<today()&&Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0))>0).length;
  const roomFood=active.filter(s=>(s.service||"")==="Room + Food").length;
  const occupancy=Math.min(100,Math.round(active.length/20*100));
  const openMaintenance=OWNER_DATA.maintenance.filter(m=>!["Completed","Cancelled"].includes(m.status));
  const mIc=["users","rupee","alert","wallet","building","clock","fork","wrench"],mTone=["indigo","emerald","rose","sky","aqua","amber","violet","coral"];
  $("owner-metrics").innerHTML=[
    ["Active residents",active.length,"of 20 beds"],["Expected monthly fees",money(monthlyExpected),"Active residents"],
    ["Fee outstanding",money(outstanding),"Fee less amount paid"],["Collected this month",money(collectedThisMonth),month],
    ["Occupancy",occupancy+"%",active.length+" of 20 beds"],["Overdue accounts",overdue,"Past due date with balance"],
    ["Room + Food plans",roomFood,"Meal-plan residents"],["Open maintenance",openMaintenance.length,"Needs follow-up"]
  ].map(([l,v,n],i)=>`<div class="owner-metric tone-${mTone[i]}"><span class="m-ic">${ic(mIc[i])}</span><strong>${esc(v)}</strong><span class="m-l">${esc(l)}</span><small>${esc(n)}</small></div>`).join("");
  const plans=["Room only","Room + Food","Food only"].map(plan=>[plan,active.filter(s=>(s.service||"Room only")===plan).length]);
  const maintenanceCost=openMaintenance.reduce((a,m)=>a+Number(m.cost||0),0);
  const collectPct=monthlyExpected?Math.min(100,Math.round(collectedThisMonth/monthlyExpected*100)):0;
  $("owner-insights").innerHTML=`<article class="owner-insight tone-indigo"><div class="insight-title"><span>${ic("users")}Resident mix</span><b>${active.length} active</b></div>${plans.map(([n,c])=>`<div class="insight-row"><span>${esc(n)}</span><b>${c}</b></div>`).join("")}<div class="insight-bar"><span style="width:${occupancy}%"></span></div><small>${occupancy}% of 20 beds occupied</small></article><article class="owner-insight tone-emerald"><div class="insight-title"><span>${ic("wallet")}Collections</span><b>${collectPct}%</b></div><div class="insight-row"><span>Collected this month</span><b>${money(collectedThisMonth)}</b></div><div class="insight-row"><span>Expected monthly fees</span><b>${money(monthlyExpected)}</b></div><div class="insight-row"><span>Outstanding balance</span><b>${money(outstanding)}</b></div><div class="insight-bar"><span style="width:${collectPct}%"></span></div><small>${overdue} overdue account${overdue===1?"":"s"}</small></article><article class="owner-insight tone-amber"><div class="insight-title"><span>${ic("wrench")}Maintenance</span><b>${openMaintenance.length} open</b></div><div class="insight-row"><span>Urgent requests</span><b>${openMaintenance.filter(m=>m.priority==="Urgent").length}</b></div><div class="insight-row"><span>Estimated open cost</span><b>${money(maintenanceCost)}</b></div><div class="insight-row"><span>Completed requests</span><b>${OWNER_DATA.maintenance.filter(m=>m.status==="Completed").length}</b></div></article>`;
  renderStudents();renderPayments();renderMaintenance();renderEnquiries();renderResidentTickets();renderLeaves();renderNotices();renderExpenses();populatePaymentStudents();renderOverview();
}
function renderOverview(){
 const payments=OWNER_DATA.payments||[], students=OWNER_DATA.students||[], maintenance=OWNER_DATA.maintenance||[], tickets=OWNER_DATA.tickets||[];
 const chart=$("owner-collection-chart");
 if(chart){
  const now=new Date(), months=[];
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;months.push({key,label:d.toLocaleDateString("en-IN",{month:"short"}),amount:payments.filter(p=>String(p.date||"").slice(0,7)===key).reduce((a,p)=>a+Number(p.amount||0),0)});}
  const max=Math.max(1,...months.map(m=>m.amount));
  chart.innerHTML=months.map(m=>`<div class="collection-month" title="${esc(m.key)} · ${money(m.amount)}"><b>${esc(m.amount?money(m.amount):"₹0")}</b><div class="bar-track"><div class="bar-fill" style="height:${Math.max(m.amount?4:0,m.amount/max*100)}%"></div></div><small>${esc(m.label)}</small></div>`).join("");
 }
 const dues=$("owner-dues-watch");
 if(dues){const dueRows=students.filter(s=>(s.status||"Active")==="Active"&&Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0))>0).sort((a,b)=>{const ad=a.dueDate||"9999-99-99",bd=b.dueDate||"9999-99-99";return ad.localeCompare(bd)||Number(b.monthlyFee||0)-Number(a.monthlyFee||0)}).slice(0,6);
  dues.innerHTML=dueRows.map(s=>{const late=!!(s.dueDate&&s.dueDate<today());const phone=String(s.phone||"").replace(/\D/g,"");const wa=phone?`https://wa.me/${phone.length===10?"91"+phone:phone}?text=${encodeURIComponent(`Hi ${s.name}, this is a reminder from NOIDA HEIGHTS PG regarding your recorded fee balance of ${money(Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0)))}. Please contact us if you have already paid.`)}`:"";return `<div class="due-row"><div class="due-person"><b>${esc(s.name)}</b><small>${esc(s.id)} · Room ${esc(s.room||"not assigned")} · ${late?"Past due":"Due "+esc(s.dueDate||"date not set")}</small></div><div class="due-amount"><b>${money(Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0)))}</b>${wa?`<a href="${wa}" target="_blank" rel="noopener">${ic("chat")}Send reminder</a>`:"<small>Phone missing</small>"}</div></div>`}).join("")||'<p class="overview-footnote">No pending balances.</p>';
 }
 const rooms=$("owner-room-board");
 if(rooms){const active=students.filter(s=>(s.status||"Active")==="Active");const grouped={};active.forEach(s=>{const room=String(s.room||"Room not assigned").trim();(grouped[room]??=[]).push(s)});const list=Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).slice(0,7);rooms.innerHTML=list.map(([room,people])=>`<div class="room-row"><div class="room-main"><b>${esc(room)}</b><small>${people.slice(0,2).map(s=>esc(s.name)).join(", ")}${people.length>2?` +${people.length-2} more`:""}</small></div><span class="room-count">${people.length} resident${people.length===1?"":"s"}</span></div>`).join("")||'<p class="overview-footnote">No rooms assigned yet.</p>';}
 const activity=$("owner-recent-activity");
 if(activity){const events=[];payments.forEach(p=>events.push({date:p.date||"",icon:"rupee",title:`Payment recorded · ${money(p.amount)}`,detail:`${p.studentName||students.find(s=>String(s.id)===String(p.studentId))?.name||"Resident"} · ${p.method||"Payment"}`}));maintenance.forEach(m=>events.push({date:m.date||"",icon:"wrench",title:`Maintenance · ${m.status||"Open"}`,detail:`${m.type||"Request"} · ${m.area||m.reporter||"Property"}`}));tickets.forEach(t=>events.push({date:t.date||"",icon:"alert",title:`Resident ticket · ${t.status||"Open"}`,detail:`${t.studentName||"Resident"} · ${t.category||"Issue"}`}));events.sort((a,b)=>String(b.date).localeCompare(String(a.date)));activity.innerHTML=events.slice(0,6).map(e=>`<div class="activity-row"><span class="activity-dot">${ic(e.icon)}</span><div><b>${esc(e.title)}</b><small>${esc(e.detail)} · ${esc(e.date||"Date not recorded")}</small></div></div>`).join("")||'<p class="overview-footnote">No recent activity.</p>';}
}
function exportOwnerCsv(kind){
 const configs={students:{name:"noida-heights-residents.csv",rows:(OWNER_DATA.students||[]).map(s=>({studentId:s.id,name:s.name,phone:s.phone,email:s.email,room:s.room,bed:s.bed,plan:s.plan,service:s.service,monthlyFee:s.monthlyFee,paidRecorded:s.paid,balanceEstimate:Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0)),deposit:s.deposit,joined:s.joined,dueDate:s.dueDate,status:s.status,guardian:s.guardianName,guardianPhone:s.guardianPhone,college:s.college}))},payments:{name:"noida-heights-payments.csv",rows:(OWNER_DATA.payments||[]).map(p=>({paymentId:p.id,studentId:p.studentId,studentName:p.studentName||OWNER_DATA.students.find(s=>String(s.id)===String(p.studentId))?.name,date:p.date,amount:p.amount,method:p.method,month:p.month,reference:p.reference,notes:p.notes}))},expenses:{name:"noida-heights-expenses.csv",rows:(OWNER_DATA.expenses||[]).map(x=>({expenseId:x.id,date:x.date,category:x.category,description:x.description,vendor:x.vendor,amount:x.amount,paymentMethod:x.paymentMethod,reference:x.reference}))}};
 const cfg=configs[kind];if(!cfg)return;if(!cfg.rows.length){msg("dashboard-msg","There are no records to export yet.","error");return;}const headers=[...new Set(cfg.rows.flatMap(r=>Object.keys(r)))];const cell=v=>{let s=String(v??"");if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};const csv=[headers.map(cell).join(","),...cfg.rows.map(r=>headers.map(h=>cell(r[h])).join(","))].join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=cfg.name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);msg("dashboard-msg",`Exported ${cfg.rows.length} records to ${cfg.name}.`,"success");
}
function renderStudents(){
 const q=($("student-search")?.value||"").toLowerCase();
 const statusFilter=$("student-status-filter")?.value||"";
 const rows=OWNER_DATA.students.filter(s=>(!statusFilter||(s.status||"Active")===statusFilter)&&[s.id,s.name,s.phone,s.room,s.service,s.email].join(" ").toLowerCase().includes(q));
 if($("student-result-count"))$("student-result-count").textContent=`${rows.length} of ${OWNER_DATA.students.length} residents`;
 $("students-body").innerHTML=rows.map(s=>`<tr><td><b>${esc(s.name)}</b><small>ID: ${esc(s.id)}</small><small>${esc(s.email||"")}</small><span class="status-pill ${s.status==="Checked out"?"bad":s.status==="Notice period"?"warn":""}">${esc(s.status||"Active")}</span></td><td>${esc(s.phone)}</td><td>${esc(s.room||"—")}<small>${esc(s.plan||"")}</small></td><td>${esc(s.service||"Room only")}</td><td>${esc(s.joined||"—")}</td><td>${money(s.monthlyFee)}<small>Paid ${money(s.paid)} · Due ${money(Math.max(0,Number(s.monthlyFee||0)-Number(s.paid||0)))}</small></td><td><button data-action="edit-student" data-id="${esc(s.id)}">${ic("edit")}Edit</button><button data-action="reset-student" data-id="${esc(s.id)}">${ic("key")}Reset login</button><button class="danger" data-action="delete-student" data-id="${esc(s.id)}">${ic("trash")}Remove</button></td></tr>`).join("")||'<tr><td colspan="7">No residents found.</td></tr>';
}
async function showStudentForm(s={}){
 $("student-form").hidden=false;$("student-form-title").textContent=s.id?"Edit resident record":"New resident admission";
 const map={id:"student-id",name:"student-name",phone:"student-phone",email:"student-email",room:"student-room",plan:"student-plan",service:"student-service",monthlyFee:"student-fee",joined:"student-joined",paid:"student-paid",paidDate:"student-paid-date",dueDate:"student-due",status:"student-status",notes:"student-notes",deposit:"student-deposit",bed:"student-bed",guardianName:"student-guardian",guardianPhone:"student-guardian-phone",emergencyContact:"student-emergency",college:"student-college",foodPreference:"student-food",idProofType:"student-idproof-type",idProofNumber:"student-idproof-number",agreementStatus:"student-agreement",checkoutDate:"student-checkout",address:"student-address"};
 Object.entries(map).forEach(([k,id])=>{const el=$(id);if(el)el.value=s[k]??(k==="plan"?"Double Sharing":k==="service"?"Room + Food":k==="monthlyFee"?6000:k==="paid"||k==="deposit"?0:k==="joined"?today():k==="status"?"Active":k==="foodPreference"?"Standard":k==="idProofType"?"Not recorded":k==="agreementStatus"?"Pending":"")});
 $("student-id").value=s.id||"";$("student-id-display").value=s.id||"Generating ID…";$("student-id-display").readOnly=true;
 if(!s.id){try{const d=await api("previewStudentId");$("student-id-display").value=d.studentId;}catch(e){$("student-id-display").value="ID generated when saved";msg("student-form-msg",e.message,"error");}}
 $("student-form").scrollIntoView({behavior:"smooth",block:"center"});
}
async function saveStudent(e){
 e.preventDefault();const student={};const map={id:"student-id",name:"student-name",phone:"student-phone",email:"student-email",room:"student-room",plan:"student-plan",service:"student-service",monthlyFee:"student-fee",joined:"student-joined",paid:"student-paid",paidDate:"student-paid-date",dueDate:"student-due",status:"student-status",notes:"student-notes",deposit:"student-deposit",bed:"student-bed",guardianName:"student-guardian",guardianPhone:"student-guardian-phone",emergencyContact:"student-emergency",college:"student-college",foodPreference:"student-food",idProofType:"student-idproof-type",idProofNumber:"student-idproof-number",agreementStatus:"student-agreement",checkoutDate:"student-checkout",address:"student-address"};
 Object.entries(map).forEach(([k,id])=>{if($(id))student[k]=$(id).value});student.monthlyFee=Number(student.monthlyFee);student.paid=Number(student.paid);student.deposit=Number(student.deposit||0);if(!student.id)student.previewId=$("student-id-display").value;
 try{const result=await api("saveStudent",{student});const savedId=result.studentId||student.id;$("student-id-display").value=savedId;$("student-form-title").textContent="Admission saved · "+savedId;await loadDashboard();const c=result.credentials;msg("dashboard-msg",c?`Resident saved. Login User ID: ${c.userId} · Temporary password: ${c.password}. Share it privately; it is shown only once.`:`Resident record updated · Student ID: ${savedId}.`,"success");$("student-form").hidden=true;}catch(e){msg("student-form-msg",e.message,"error");}
}
function populatePaymentStudents(){const sel=$("payment-student");if(!sel)return;const old=sel.value;sel.innerHTML=OWNER_DATA.students.filter(s=>s.status!=="Checked out").map(s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${esc(s.room||"No room")}</option>`).join("");if(old)sel.value=old;}
async function savePayment(e){
 e.preventDefault();const payment={studentId:$("payment-student").value,amount:Number($("payment-amount").value),date:$("payment-date").value,method:$("payment-method").value,month:$("payment-month").value,reference:$("payment-ref").value,notes:$("payment-notes").value};
 try{await api("savePayment",{payment});$("payment-form").reset();$("payment-form").hidden=true;await loadDashboard();msg("dashboard-msg","Payment saved.","success");}catch(e){msg("payment-msg",e.message,"error");}
}
function renderPayments(){
 $("payments-body").innerHTML=OWNER_DATA.payments.slice().reverse().map(p=>{const s=OWNER_DATA.students.find(x=>String(x.id)===String(p.studentId));return `<tr><td>${esc(p.date||"—")}</td><td>${esc(s?.name||p.studentName||"Removed student")}</td><td><b>${money(p.amount)}</b></td><td>${esc(p.method||"—")}</td><td>${esc(p.month||"—")}</td><td>${esc(p.reference||"—")}</td><td><button class="danger" data-action="delete-payment" data-id="${esc(p.id)}">${ic("trash")}Delete</button></td></tr>`;}).join("")||'<tr><td colspan="7">No payments recorded yet.</td></tr>';
}
async function saveMaintenance(e){
 e.preventDefault();const maintenance={reporter:$("maintenance-reporter").value,area:$("maintenance-area").value,type:$("maintenance-type").value,priority:$("maintenance-priority").value,date:$("maintenance-date").value,cost:Number($("maintenance-cost").value),assigned:$("maintenance-assigned").value,status:$("maintenance-status").value,details:$("maintenance-details").value};
 try{await api("saveMaintenance",{maintenance});$("maintenance-form").reset();$("maintenance-form").hidden=true;await loadDashboard();msg("dashboard-msg","Maintenance request saved.","success");}catch(e){msg("maintenance-msg",e.message,"error");}
}
function renderMaintenance(){
 $("maintenance-body").innerHTML=OWNER_DATA.maintenance.slice().reverse().map(m=>`<tr><td>${esc(m.date||"—")}</td><td><b>${esc(m.reporter)}</b><small>${esc(m.area)}</small></td><td>${esc(m.type)}<small>${esc(m.details)}</small><small>Assigned: ${esc(m.assigned||"—")}</small></td><td>${esc(m.priority)}</td><td>${money(m.cost)}</td><td><span class="status-pill ${m.status==="Completed"?"":m.priority==="Urgent"?"bad":"warn"}">${esc(m.status)}</span></td><td>${m.status!=="Completed"?`<button data-action="complete-maintenance" data-id="${esc(m.id)}">${ic("check")}Complete</button>`:""}<button class="danger" data-action="delete-maintenance" data-id="${esc(m.id)}">${ic("trash")}Delete</button></td></tr>`).join("")||'<tr><td colspan="7">No maintenance requests recorded.</td></tr>';
}
function renderEnquiries(){
 $("enquiries-body").innerHTML=OWNER_DATA.enquiries.slice().reverse().map(x=>`<tr><td>${esc(x.timestamp||"—")}</td><td>${esc(x.name)}</td><td>${esc(x.phone)}</td><td>${esc(x.email||"—")}</td><td>${esc(x.room||"—")}</td><td>${esc(x.status||"New")}</td></tr>`).join("")||'<tr><td colspan="6">No enquiries available.</td></tr>';
}
async function runAction(action,payload){try{await api(action,payload);await loadDashboard();}catch(e){msg("dashboard-msg",e.message,"error");}}


async function saveNotice(e){e.preventDefault();const notice={title:$("notice-title").value,category:$("notice-category").value,audience:$("notice-audience").value,targetRoom:$("notice-target-room").value,priority:$("notice-priority").value,publishDate:$("notice-date").value,expiryDate:$("notice-expiry").value,body:$("notice-body").value};try{await api("saveNotice",{notice});$("notice-form").reset();$("notice-date").value=today();await loadDashboard();msg("notice-msg","Notice published to resident portal.","success");}catch(e){msg("notice-msg",e.message,"error");}}
async function saveExpense(e){e.preventDefault();const expense={date:$("expense-date").value,category:$("expense-category").value,amount:Number($("expense-amount").value),vendor:$("expense-vendor").value,paymentMethod:$("expense-method").value,reference:$("expense-ref").value,description:$("expense-description").value};try{await api("saveExpense",{expense});$("expense-form").reset();$("expense-date").value=today();await loadDashboard();msg("expense-msg","Expense recorded.","success");}catch(e){msg("expense-msg",e.message,"error");}}
function renderLeaves(){const body=$("leaves-body");if(!body)return;body.innerHTML=(OWNER_DATA.leaves||[]).slice().reverse().map(x=>`<tr><td><b>${esc(x.studentName)}</b><small>${esc(x.studentId)} · ${esc(x.room||"")}</small></td><td>${esc(x.fromDate)}<small>to ${esc(x.toDate)}</small></td><td>${esc(x.destination||"—")}<small>${esc(x.reason||"")}</small></td><td>${esc(x.emergencyPhone||"—")}</td><td><span class="status-pill ${x.status==="Declined"?"bad":x.status==="Approved"?"":"warn"}">${esc(x.status||"Pending")}</span>${x.status==="Pending"?`<div><button data-action="approve-leave" data-id="${esc(x.id)}">${ic("check")}Approve</button><button class="danger" data-action="decline-leave" data-id="${esc(x.id)}">${ic("x")}Decline</button></div>`:""}</td></tr>`).join("")||'<tr><td colspan="5">No leave requests yet.</td></tr>';}
function renderNotices(){const body=$("notices-body");if(!body)return;body.innerHTML=(OWNER_DATA.notices||[]).slice().reverse().map(n=>`<tr><td>${esc(n.publishDate||"—")}<small>Expires: ${esc(n.expiryDate||"No expiry")}</small></td><td><b>${esc(n.title)}</b><small>${esc(n.body)}</small></td><td>${esc(n.category||"General")}</td><td>${esc(n.audience||"All residents")}<small>${esc(n.targetRoom||"")}</small></td><td>${esc(n.priority||"Normal")}</td><td><button class="danger" data-action="delete-notice" data-id="${esc(n.id)}">${ic("trash")}Delete</button></td></tr>`).join("")||'<tr><td colspan="6">No notices published yet.</td></tr>';}
function renderExpenses(){const body=$("expenses-body");if(!body)return;const list=(OWNER_DATA.expenses||[]).slice().reverse();const total=list.reduce((a,x)=>a+Number(x.amount||0),0);if($("expense-total"))$("expense-total").textContent=money(total)+" total recorded";body.innerHTML=list.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.category)}</td><td>${esc(x.description||"—")}</td><td>${esc(x.vendor||"—")}</td><td>${esc(x.paymentMethod||"—")}<small>${esc(x.reference||"")}</small></td><td><b>${money(x.amount)}</b></td><td><button class="danger" data-action="delete-expense" data-id="${esc(x.id)}">${ic("trash")}Delete</button></td></tr>`).join("")||'<tr><td colspan="7">No expense records yet.</td></tr>';}

function renderResidentTickets(){const body=$("resident-tickets-body");if(!body)return;body.innerHTML=(OWNER_DATA.tickets||[]).slice().reverse().map(t=>`<tr><td>${esc(t.date||"—")}</td><td><b>${esc(t.studentName||"Resident")}</b><small>${esc(t.studentId||"")} · ${esc(t.room||"")}</small></td><td><b>${esc(t.category||"Issue")}</b><small>${esc(t.details||"")}</small></td><td>${esc(t.priority||"Normal")}</td><td><span class="status-pill ${t.status==="Completed"?"":t.priority==="Urgent"?"bad":"warn"}">${esc(t.status||"Open")}</span><div>${t.status!=="Completed"?`<button data-action="update-resident-ticket" data-status="In progress" data-id="${esc(t.id)}">In progress</button><button data-action="update-resident-ticket" data-status="Completed" data-id="${esc(t.id)}">${ic("check")}Complete</button>`:""}</div></td></tr>`).join("")||'<tr><td colspan="5">No resident tickets yet.</td></tr>'; }
