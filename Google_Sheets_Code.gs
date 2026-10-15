/**
 * NOIDA HEIGHTS PG — database and portal API (Google Apps Script)
 * Deploy as Web app: Execute as Me, access Anyone. Run setup() once.
 * Passwords are salted and hashed; the first owner password is generated at setup.
 */
const DEFAULT_OWNER_EMAIL = 'noidaheightspg@gmail.com';
const MAX_LOGIN_FAILS = 5, LOCKOUT_SECONDS = 900, SESSION_SECONDS = 3600, HASH_ROUNDS = 200;
const SHEETS = {
  Students: ['id','name','phone','email','room','plan','service','monthlyFee','joined','paid','paidDate','dueDate','status','notes','guardianName','guardianPhone','emergencyContact','college','address','deposit','bed','foodPreference','idProofType','idProofNumber','agreementStatus','checkoutDate','updatedAt'],
  Payments: ['id','studentId','amount','date','method','month','reference','notes','createdAt'],
  Maintenance: ['id','reporter','area','type','priority','date','cost','assigned','status','details','createdAt'],
  Enquiries: ['timestamp','name','phone','email','room','moveInDate','message','status'],
  Users: ['userId','password','role','studentId','name','active','createdAt'],
  ResidentTickets: ['id','studentId','studentName','room','category','priority','details','date','status','ownerNote','createdAt'],
  Notices: ['id','title','category','body','audience','targetRoom','priority','publishDate','expiryDate','createdBy','createdAt'],
  LeaveRequests: ['id','studentId','studentName','room','fromDate','toDate','destination','reason','emergencyPhone','status','ownerNote','createdAt'],
  Expenses: ['id','date','category','description','vendor','amount','paymentMethod','reference','createdAt']
};
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
    ensureHeaders_(sh, SHEETS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold');
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('OWNER_EMAIL')) props.setProperty('OWNER_EMAIL', DEFAULT_OWNER_EMAIL);
  const owner = ensureOwnerUser_();
  const result = owner
    ? 'Setup complete. Owner login -> User ID: ' + owner.userId + '  Password: ' + owner.password + '  (shown once; sign in and change it under Security).'
    : 'Setup complete. Sheets and headers are up to date.';
  Logger.log(result);
  return result;
}
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ok:true,message:'Service is running.'})).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    let p = raw ? JSON.parse(raw) : (e && e.parameter ? e.parameter : {});
    // Public enquiry form (plain form fields, no action).
    if (!p.action) {
      if (String(p.website||'').trim()) return json_({ok:true}); // honeypot
      const name=clip_(p.name,80), phone=clip_(p.phone,20), email=clip_(p.email,100), room=clip_(p.room,40), moveIn=clip_(p.moveInDate,12), message=clip_(p.message,600);
      if (!name || !/^[0-9+\-\s()]{7,20}$/.test(phone)) return json_({ok:false,error:'Enter a valid name and phone number.'});
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ok:false,error:'Enter a valid email address.'});
      const cache=CacheService.getScriptCache(), key='enq_'+phone.replace(/\D/g,'');
      const n=Number(cache.get(key)||0); if(n>=3) return json_({ok:false,error:'Too many enquiries from this number. Please call us instead.'});
      cache.put(key,String(n+1),3600);
      getSheet_('Enquiries').appendRow([new Date(),safeCell_(name),safeCell_(phone),safeCell_(email),safeCell_(room),safeCell_(moveIn),safeCell_(message),'New']);
      return json_({ok:true});
    }
    const action = p.action;
    if (action === 'login') {
      const userId = String(p.userId || p.email || '').trim().slice(0,60);
      const password = String(p.password || '').slice(0,200);
      const cache = CacheService.getScriptCache(), failKey = 'fail_'+userId.toLowerCase();
      if (Number(cache.get(failKey)||0) >= MAX_LOGIN_FAILS) return json_({ok:false,error:'Too many failed attempts. Try again in 15 minutes.'});
      const user = readObjects_('Users').find(u => String(u.userId).toLowerCase() === userId.toLowerCase() && String(u.active).toLowerCase() !== 'false');
      if (!user || !verifyPassword_(password, user.password)) {
        cache.put(failKey, String(Number(cache.get(failKey)||0)+1), LOCKOUT_SECONDS);
        Utilities.sleep(500);
        return json_({ok:false,error:'User ID or password is incorrect.'});
      }
      cache.remove(failKey);
      if (String(user.password).indexOf('h1$') !== 0) setUserPassword_(user.userId, password);
      const token = Utilities.getUuid()+Utilities.getUuid();
      const session = {userId:user.userId,role:user.role,studentId:user.studentId||'',name:user.name||''};
      cache.put('session_'+token, JSON.stringify(session), SESSION_SECONDS);
      return json_({ok:true,token:token,role:user.role,name:user.name||user.userId,studentId:user.studentId||''});
    }
    if (action === 'logout') { if (p.token) CacheService.getScriptCache().remove('session_'+String(p.token).slice(0,200)); return json_({ok:true}); }
    const session = getSession_(p.token);
    if (!session) return json_({ok:false,error:'Session expired. Please log in again.'});
    if (action === 'changePassword') {
      const user = readObjects_('Users').find(u => String(u.userId) === String(session.userId));
      if (!user || !verifyPassword_(String(p.current||''), user.password)) { Utilities.sleep(500); throw new Error('Current password is incorrect.'); }
      const next = String(p.next||'');
      if (next.length < 8 || next.length > 100 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) throw new Error('Use at least 8 characters with letters and numbers.');
      setUserPassword_(user.userId, next);
      return json_({ok:true});
    }
    if (action === 'residentData') {
      if (session.role !== 'student') return json_({ok:false,error:'Student login required.'});
      const student = readObjects_('Students').find(x => String(x.id) === String(session.studentId));
      if (!student) return json_({ok:false,error:'Resident record was not found. Contact the owner.'});
      const payments = readObjects_('Payments').filter(x => String(x.studentId) === String(student.id));
      const tickets = readObjects_('ResidentTickets').filter(x => String(x.studentId) === String(student.id));
      const leaves = readObjects_('LeaveRequests').filter(x => String(x.studentId) === String(student.id));
      const notices = readObjects_('Notices').filter(n => (!n.expiryDate || String(n.expiryDate) >= formatDate_(new Date())) && (String(n.audience||'All residents')==='All residents' || (String(n.audience)==='Active residents' && String(student.status||'Active')==='Active') || (String(n.audience)==='Room-specific' && String(n.targetRoom||'')===String(student.room||''))));
      const keep=['id','name','phone','email','room','plan','service','monthlyFee','joined','paid','paidDate','dueDate','status','guardianName','guardianPhone','college','deposit','bed','foodPreference','agreementStatus'];
      const safeStudent={}; keep.forEach(k=>safeStudent[k]=student[k]);
      return json_({ok:true,data:{student:safeStudent,payments:payments,tickets:tickets,leaves:leaves,notices:notices}});
    }
    if (action === 'submitLeave') {
      if (session.role !== 'student') return json_({ok:false,error:'Student login required.'});
      const student=readObjects_('Students').find(x=>String(x.id)===String(session.studentId)); if(!student)throw new Error('Resident record not found.');
      const x=p.leave||{}; if(!x.fromDate||!x.toDate||!x.reason)throw new Error('Enter leave dates and reason.'); if(String(x.toDate)<String(x.fromDate))throw new Error('Return date must be on or after the leave start date.');
      appendObject_('LeaveRequests',{id:'LEAVE-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase(),studentId:student.id,studentName:student.name,room:student.room||'',fromDate:x.fromDate,toDate:x.toDate,destination:x.destination||'',reason:x.reason,emergencyPhone:x.emergencyPhone||student.phone||'',status:'Pending',ownerNote:'',createdAt:new Date().toISOString()});
      return json_({ok:true,message:'Leave request sent to the owner.'});
    }
    if (action === 'submitTicket') {
      if (session.role !== 'student') return json_({ok:false,error:'Student login required.'});
      const student = readObjects_('Students').find(x => String(x.id) === String(session.studentId));
      if (!student) throw new Error('Resident record not found.');
      const x=p.ticket||{};
      if (!x.category || !x.details) throw new Error('Choose a category and describe the issue.');
      appendObject_('ResidentTickets',{id:Utilities.getUuid(),studentId:student.id,studentName:student.name,room:student.room||'',category:x.category,priority:x.priority||'Normal',details:x.details,date:formatDate_(new Date()),status:'Open',ownerNote:'',createdAt:new Date().toISOString()});
      return json_({ok:true,message:'Request sent to the owner.'});
    }
    if (session.role !== 'owner') return json_({ok:false,error:'Owner access required.'});
    if (action === 'dashboard') return json_({ok:true,data:{
      students:readObjects_('Students'),payments:readObjects_('Payments'),
      maintenance:readObjects_('Maintenance'),enquiries:readObjects_('Enquiries'),tickets:readObjects_('ResidentTickets'),
      notices:readObjects_('Notices'),leaves:readObjects_('LeaveRequests'),expenses:readObjects_('Expenses')
    }});
    if (action === 'previewStudentId') return json_({ok:true,studentId:nextStudentId_()});
    if (action === 'saveStudent') {
      const x = p.student || {};
      if (!x.name || !x.phone || !x.joined) throw new Error('Name, phone and joining date are required.');
      x.name=clip_(x.name,100); x.phone=clip_(x.phone,20);
      if (!/^[0-9+\-\s()]{7,20}$/.test(x.phone)) throw new Error('Enter a valid phone number.');
      ['email','room','plan','service','college','address','notes','guardianName','guardianPhone','emergencyContact','idProofType','idProofNumber','foodPreference','agreementStatus','bed'].forEach(k=>{if(x[k]!==undefined)x[k]=clip_(x[k],k==='notes'||k==='address'?300:100);});
      x.monthlyFee = Math.max(0,Number(x.monthlyFee||0)); x.paid = Math.max(0,Number(x.paid||0));
      const isNew = !x.id;
      if (isNew) { const lock=LockService.getScriptLock(); lock.waitLock(10000); try { const proposed=String(x.previewId||''); const existing=readObjects_('Students').some(s=>String(s.id)===proposed); x.id=(/^NH-\d{4}-\d{4,}$/.test(proposed)&&!existing)?proposed:nextStudentId_(); } finally { lock.releaseLock(); } delete x.previewId; }
      x.updatedAt = new Date().toISOString(); upsert_('Students',x);
      let credentials = null;
      const users = readObjects_('Users');
      if (!users.some(u=>String(u.studentId)===String(x.id))) {
        const temporaryPassword = tempPassword_();
        appendObject_('Users',{userId:x.id,password:hashPassword_(temporaryPassword),role:'student',studentId:x.id,name:x.name,active:'TRUE',createdAt:new Date().toISOString()});
        credentials = {userId:x.id,password:temporaryPassword};
      } else { updateStudentUser_(x.id, x.name); }
      return json_({ok:true,studentId:x.id,credentials:credentials});
    }
    if (action === 'resetStudentPassword') {
      const u = readObjects_('Users').find(r => String(r.studentId) === String(p.id) && String(r.role) === 'student');
      if (!u) throw new Error('No login exists for this resident.');
      const temp = tempPassword_(); setUserPassword_(u.userId, temp);
      CacheService.getScriptCache().remove('fail_'+String(u.userId).toLowerCase());
      return json_({ok:true,userId:u.userId,password:temp});
    }
    if (action === 'deleteStudent') { deleteById_('Students',p.id); disableStudentUser_(p.id); return json_({ok:true}); }
    if (action === 'saveNotice') { const x=p.notice||{}; if(!x.title||!x.body)throw new Error('Notice title and message are required.'); x.id='NOTICE-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase(); x.createdBy=session.name||session.userId; x.createdAt=new Date().toISOString(); appendObject_('Notices',x); return json_({ok:true}); }
    if (action === 'deleteNotice') { deleteById_('Notices',p.id); return json_({ok:true}); }
    if (action === 'updateLeave') { const x=readObjects_('LeaveRequests').find(r=>String(r.id)===String(p.id)); if(!x)throw new Error('Leave request not found.'); x.status=p.status||x.status; x.ownerNote=p.ownerNote||x.ownerNote||''; upsert_('LeaveRequests',x); return json_({ok:true}); }
    if (action === 'saveExpense') { const x=p.expense||{}; if(!x.date||!x.category||!(Number(x.amount)>0))throw new Error('Enter expense date, category and an amount above zero.'); x.id='EXP-'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase(); x.amount=Number(x.amount); x.createdAt=new Date().toISOString(); appendObject_('Expenses',x); return json_({ok:true}); }
    if (action === 'deleteExpense') { deleteById_('Expenses',p.id); return json_({ok:true}); }
    if (action === 'savePayment') {
      const x=p.payment||{};
      if (!x.studentId || !(Number(x.amount)>0) || !x.date) throw new Error('Select a student and enter a valid payment amount and date.');
      x.id=Utilities.getUuid();x.createdAt=new Date().toISOString();appendObject_('Payments',x);
      // Update lifetime amount paid and last payment date on student record.
      const s=readObjects_('Students').find(r=>String(r.id)===String(x.studentId));
      if(s){s.paid=Number(s.paid||0)+Number(x.amount);s.paidDate=x.date;upsert_('Students',s);}
      return json_({ok:true});
    }
    if (action === 'deletePayment') {
      const payment=readObjects_('Payments').find(r=>String(r.id)===String(p.id));
      if(payment){const s=readObjects_('Students').find(r=>String(r.id)===String(payment.studentId));if(s){s.paid=Math.max(0,Number(s.paid||0)-Number(payment.amount||0));upsert_('Students',s);}}
      deleteById_('Payments',p.id);return json_({ok:true});
    }
    if (action === 'saveMaintenance') {
      const x=p.maintenance||{};if(!x.reporter||!x.area||!x.details)throw new Error('Reporter, area and issue details are required.');
      x.id=Utilities.getUuid();x.createdAt=new Date().toISOString();appendObject_('Maintenance',x);return json_({ok:true});
    }
    if (action === 'updateResidentTicket') { const x=readObjects_('ResidentTickets').find(r=>String(r.id)===String(p.id)); if(!x)throw new Error('Resident ticket not found.'); x.status=p.status||x.status; upsert_('ResidentTickets',x); return json_({ok:true}); }
    if (action === 'updateMaintenance') {
      const x=readObjects_('Maintenance').find(r=>String(r.id)===String(p.id));if(!x)throw new Error('Request not found.');
      x.status=p.status||x.status;upsert_('Maintenance',x);return json_({ok:true});
    }
    if (action === 'deleteMaintenance') {deleteById_('Maintenance',p.id);return json_({ok:true});}
    return json_({ok:false,error:'Unknown action.'});
  } catch(err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

function ensureHeaders_(sh, expected) {
  const lastCol=Math.max(1,sh.getLastColumn()); const current=sh.getRange(1,1,1,lastCol).getValues()[0].map(String);
  expected.forEach(h=>{if(!current.includes(h)){sh.getRange(1,sh.getLastColumn()+1).setValue(h);current.push(h);}});
}
function nextStudentId_() {
  const year=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy'); const prefix='NH-'+year+'-';
  const ids=readObjects_('Students').map(s=>String(s.id||'')); let max=0;
  ids.forEach(id=>{if(id.indexOf(prefix)===0){const n=parseInt(id.slice(prefix.length),10);if(Number.isFinite(n))max=Math.max(max,n);}});
  return prefix+String(max+1).padStart(4,'0');
}
function getSheet_(name) {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  let sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);sh.appendRow(SHEETS[name]||[]);sh.setFrozenRows(1);}
  if(sh.getLastRow()===0)sh.appendRow(SHEETS[name]||[]);
  if(SHEETS[name])ensureHeaders_(sh,SHEETS[name]);
  return sh;
}
function readObjects_(name) {
  const sh=getSheet_(name), values=sh.getDataRange().getValues();
  if(values.length<2)return [];
  const headers=values[0].map(String);
  const aliases={'Timestamp':'timestamp','Name':'name','Phone':'phone','Email':'email','Room Preference':'room','Move-in Date':'moveInDate','Message':'message','Status':'status'};
  return values.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>{
    const o={};headers.forEach((h,i)=>o[aliases[h]||h]=r[i] instanceof Date?formatDate_(r[i]):r[i]);
    return o;
  });
}
function appendObject_(name,obj) {
  const sh=getSheet_(name), headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(headers.map(h=>obj[h]===undefined?'':safeCell_(obj[h])));
}
function upsert_(name,obj) {
  const sh=getSheet_(name), headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  if(!obj.id)obj.id=Utilities.getUuid();
  const values=sh.getDataRange().getValues(), idCol=headers.indexOf('id');
  if(idCol>=0) {
    for(let i=1;i<values.length;i++) if(String(values[i][idCol])===String(obj.id)) {
      sh.getRange(i+1,1,1,headers.length).setValues([headers.map(h=>obj[h]===undefined?values[i][headers.indexOf(h)]:safeCell_(obj[h]))]);return;
    }
  }
  sh.appendRow(headers.map(h=>obj[h]===undefined?'':safeCell_(obj[h])));
}
function deleteById_(name,id) {
  const sh=getSheet_(name),values=sh.getDataRange().getValues(),headers=values[0].map(String),col=headers.indexOf('id');
  if(col<0)return;
  for(let i=values.length-1;i>=1;i--)if(String(values[i][col])===String(id)){sh.deleteRow(i+1);return;}
}
function getSession_(token) {
  if(!token || String(token).length>100)return null;
  const raw=CacheService.getScriptCache().get('session_'+token);
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(e){return null;}
}
function updateStudentUser_(studentId, name) {
  const sh=getSheet_('Users'), data=sh.getDataRange().getValues(); if(!data.length)return; const h=data[0].map(String),sid=h.indexOf('studentId'),nameCol=h.indexOf('name');
  for(let r=1;r<data.length;r++)if(sid>=0&&String(data[r][sid])===String(studentId)){if(nameCol>=0)sh.getRange(r+1,nameCol+1).setValue(name);}
}
function disableStudentUser_(studentId) {
  const sh=getSheet_('Users'), data=sh.getDataRange().getValues(); if(!data.length)return; const h=data[0].map(String),sid=h.indexOf('studentId'),active=h.indexOf('active');
  for(let r=1;r<data.length;r++)if(sid>=0&&String(data[r][sid])===String(studentId)&&active>=0)sh.getRange(r+1,active+1).setValue('FALSE');
}
function ensureOwnerUser_() {
  const sh=getSheet_('Users');
  if(readObjects_('Users').some(u=>String(u.role)==='owner')) return null;
  const password=tempPassword_();
  sh.appendRow(['OWNER001',hashPassword_(password),'owner','','Owner','TRUE',new Date().toISOString()]);
  return {userId:'OWNER001',password:password};
}
function bytesToHex_(bytes){return bytes.map(b=>('0'+(b&0xff).toString(16)).slice(-2)).join('');}
function hashPassword_(plain,salt){
  salt=salt||Utilities.getUuid().replace(/-/g,'');
  let h=salt+String(plain);
  for(let i=0;i<HASH_ROUNDS;i++) h=bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,h+salt,Utilities.Charset.UTF_8));
  return 'h1$'+salt+'$'+h;
}
function verifyPassword_(plain,stored){
  stored=String(stored||'');
  if(stored.indexOf('h1$')===0){const parts=stored.split('$');return parts.length===3&&constantTimeEqual_(hashPassword_(plain,parts[1]),stored);}
  return constantTimeEqual_(stored,String(plain)); // legacy plain-text rows are upgraded at next login
}
function setUserPassword_(userId,plain){
  const sh=getSheet_('Users'),data=sh.getDataRange().getValues(),h=data[0].map(String),uc=h.indexOf('userId'),pc=h.indexOf('password');
  for(let r=1;r<data.length;r++) if(String(data[r][uc])===String(userId)){sh.getRange(r+1,pc+1).setValue(hashPassword_(plain));return;}
}
function tempPassword_(){return 'NH@'+Utilities.getUuid().replace(/-/g,'').slice(0,8);}
function clip_(v,n){return String(v===undefined||v===null?'':v).trim().slice(0,n);}
function safeCell_(v){ // stop spreadsheet formula injection
  if(typeof v!=='string')return v;
  return /^[=+\-@\t\r]/.test(v)?"'"+v:v;
}
function constantTimeEqual_(a,b) {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
function formatDate_(d) {return Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');}
function json_(obj) {return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
