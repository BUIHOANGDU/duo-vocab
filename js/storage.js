import { freshProfile } from './profile-manager.js';
import { migrateBoekiProfile } from './boeki-engine.js';
import { migrateLearningModel } from './progress-model.js';
let database;
export function openDB() {
  if(database) return database;
  database=new Promise((resolve,reject)=>{const req=indexedDB.open('duo-vocab',1);req.onupgradeneeded=()=>{req.result.createObjectStore('profiles',{keyPath:'id'});req.result.createObjectStore('meta');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Hãy đóng tab Duo Vocab cũ và thử lại.'));});
  return database;
}
export async function readProfile(id) { const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction('profiles').objectStore('profiles').get(id);r.onsuccess=()=>resolve(r.result||freshProfile(id));r.onerror=()=>reject(r.error);}); }
// Every change is a single read-modify-write transaction, including answer + history.
export async function updateProfile(id, mutate) {const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('profiles','readwrite');const store=tx.objectStore('profiles');let value;const r=store.get(id);r.onsuccess=()=>{try{value=r.result||freshProfile(id);mutate(value);store.put(value);}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Không thể lưu dữ liệu.'));});}
export async function meta(key, value) {const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('meta',value===undefined?'readonly':'readwrite');const r=value===undefined?tx.objectStore('meta').get(key):tx.objectStore('meta').put(value,key);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}
export async function migrateProfiles() {
  await updateProfile('boeki', profile => migrateLearningModel(migrateBoekiProfile(profile)));
  await updateProfile('toeic', profile => { profile.schemaVersion ||= 1; profile.skillProgress ||= {};migrateLearningModel(profile); });
}
