
(function(){
'use strict';

const SESSION_KEY='sequencer_current_user_v1';
const USERS_KEY='sequencer_users_v1';

function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function getUsers(){try{const u=JSON.parse(localStorage.getItem(USERS_KEY)||'[]');return Array.isArray(u)?u:[]}catch{return []}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u))}
function normalizeEmail(v){return String(v||'').trim().toLowerCase()}
function initials(user){return ((user.firstName||'')[0]||'').concat((user.lastName||'')[0]||'').toUpperCase()||'U'}
function userKey(name,id){return `sequencer_${name}_${id}`}
function getUserData(name,fallback=[]){
  const s=getSession(); if(!s?.id)return fallback;
  try{const v=localStorage.getItem(userKey(name,s.id));return v===null?fallback:JSON.parse(v)}catch{return fallback}
}
function setUserData(name,value){
  const s=getSession(); if(s?.id)localStorage.setItem(userKey(name,s.id),JSON.stringify(value))
}
function show(id,msg,type=''){
  const el=document.getElementById(id); if(!el)return;
  el.textContent=msg; el.className='form-message '+type;
  clearTimeout(el._timer); el._timer=setTimeout(()=>{el.textContent='';el.className='form-message'},4500)
}
function escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function randomSalt(){
  if(window.crypto?.getRandomValues){const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')}
  return Math.random().toString(36).slice(2)+Date.now().toString(36)
}
function bytesToHex(buffer){return Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('')}
async function hashPassword(password,salt){
  if(window.crypto?.subtle){
    const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
    return bytesToHex(bits);
  }
  return btoa(unescape(encodeURIComponent(salt+':'+password)));
}

const session=getSession();
if(!session){window.location.href='auth.html';return}
const users=getUsers();
let user=users.find(u=>u.id===session.id);
if(!user){localStorage.removeItem(SESSION_KEY);window.location.href='auth.html';return}

function refreshSession(){
  localStorage.setItem(SESSION_KEY,JSON.stringify({id:user.id,firstName:user.firstName,lastName:user.lastName,email:user.email,signedInAt:session.signedInAt||new Date().toISOString()}))
}

document.getElementById('profileAvatar').textContent=initials(user);
document.getElementById('profileName').textContent=`${user.firstName||''} ${user.lastName||''}`.trim()||'User';
document.getElementById('profileEmail').textContent=user.email||'';
document.getElementById('firstName').value=user.firstName||'';
document.getElementById('lastName').value=user.lastName||'';
document.getElementById('email').value=user.email||'';

function artwork(track){
  if(track?.artwork)return track.artwork;
  const seed=encodeURIComponent(String(track?.title||'Track').slice(0,2).toUpperCase());
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#21141b"/><text x="50" y="56" text-anchor="middle" fill="#ff3d81" font-family="Arial" font-size="28" font-weight="700">${decodeURIComponent(seed)}</text></svg>`)}`;
}
function formatDate(value){
  if(!value)return '';
  const d=new Date(value); if(Number.isNaN(d.getTime()))return '';
  return d.toLocaleString([], {day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
}
function render(){
  const tracks=getUserData('library',[]);
  const playlists=getUserData('playlists',[]);
  const history=getUserData('history',[]);
  document.getElementById('statTracks').textContent=tracks.length;
  document.getElementById('statPlaylists').textContent=playlists.length;
  document.getElementById('statHistory').textContent=history.length;
  document.getElementById('statLiked').textContent=tracks.filter(t=>t.liked).length;

  const pl=document.getElementById('playlistList');
  if(!playlists.length) pl.innerHTML='<div class="empty-state">No playlists yet. Create your first playlist from Sequence.</div>';
  else pl.innerHTML=playlists.slice().reverse().map(p=>`
    <a class="playlist-item" href="library.html">
      <div class="playlist-art">♫</div>
      <div class="playlist-meta"><strong>${escape(p.name||'Untitled playlist')}</strong><span>${Array.isArray(p.trackIds)?p.trackIds.length:0} tracks · ${formatDate(p.createdAt)||'Created recently'}</span></div>
    </a>`).join('');

  const hl=document.getElementById('historyList');
  if(!history.length) hl.innerHTML='<div class="empty-state">Songs you play in Library or Sequence will appear here.</div>';
  else hl.innerHTML=history.slice(0,50).map(item=>`
    <div class="history-item">
      <img class="history-art" src="${escape(artwork(item))}" alt="" onerror="this.style.display='none'">
      <div class="history-meta"><strong>${escape(item.title||'Unknown track')}</strong><span>${escape(item.artist||'Unknown artist')}</span></div>
      <span class="history-time">${escape(formatDate(item.playedAt))}</span>
    </div>`).join('');
}
render();

document.getElementById('detailsForm').addEventListener('submit',e=>{
  e.preventDefault();
  const firstName=document.getElementById('firstName').value.trim();
  const lastName=document.getElementById('lastName').value.trim();
  const email=normalizeEmail(document.getElementById('email').value);
  if(!firstName||!lastName)return show('detailsMessage','Please enter your first and last name.','error');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return show('detailsMessage','Please enter a valid email address.','error');
  const duplicate=users.find(u=>u.id!==user.id&&normalizeEmail(u.email)===email);
  if(duplicate)return show('detailsMessage','That email is already used by another account.','error');
  user.firstName=firstName;user.lastName=lastName;user.email=email;
  saveUsers(users);refreshSession();
  document.getElementById('profileAvatar').textContent=initials(user);
  document.getElementById('profileName').textContent=`${firstName} ${lastName}`;
  document.getElementById('profileEmail').textContent=email;
  show('detailsMessage','Profile details saved.','success');
});

document.getElementById('passwordForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const current=document.getElementById('currentPassword').value;
  const next=document.getElementById('newPassword').value;
  const confirm=document.getElementById('confirmPassword').value;
  if(next.length<6)return show('passwordMessage','New password must be at least 6 characters.','error');
  if(next!==confirm)return show('passwordMessage','New passwords do not match.','error');
  try{
    const oldHash=await hashPassword(current,user.salt);
    if(oldHash!==user.passwordHash)return show('passwordMessage','Current password is incorrect.','error');
    user.salt=randomSalt();user.passwordHash=await hashPassword(next,user.salt);saveUsers(users);
    e.target.reset();show('passwordMessage','Password changed successfully.','success');
  }catch(err){console.error(err);show('passwordMessage','Unable to change password. Please try again.','error')}
});

document.getElementById('clearHistory').addEventListener('click',()=>{
  if(!getUserData('history',[]).length)return;
  if(!confirm('Clear your complete song history?'))return;
  setUserData('history',[]);render();
});

document.getElementById('logoutProfile').addEventListener('click',()=>{
  localStorage.removeItem(SESSION_KEY);window.location.href='index.html';
});

document.getElementById('deleteAccount').addEventListener('click',()=>{
  const confirmation=prompt('This permanently deletes your Sequencer account and local music data. Type DELETE to continue.');
  if(confirmation!=='DELETE')return;
  const uid=user.id;
  for(let i=localStorage.length-1;i>=0;i--){
    const key=localStorage.key(i);
    if(key && key.startsWith('sequencer_') && key.endsWith('_'+uid))localStorage.removeItem(key);
  }
  saveUsers(users.filter(u=>u.id!==uid));
  localStorage.removeItem(SESSION_KEY);
  window.location.href='auth.html';
});
})();
