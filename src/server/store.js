import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const digest=t=>createHash('sha256').update(t).digest('hex');
export function openStore(path){
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS practice_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS practice_by_user ON practice_sessions(user_id,created_at);`);
 const safe=u=>u?{id:u.id,email:u.email,name:u.name}:null;
 const dummySalt=randomBytes(16).toString('hex');
 return {
  async signup(email,name,password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64,{N:32768,maxmem:64*1024*1024});const id=randomUUID();try{db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,email,name,`${salt}:${key.toString('hex')}`);}catch(e){if(String(e.message).includes('UNIQUE'))throw Object.assign(new Error('An account with this email already exists.'),{status:409});throw e;}return {id,email,name};},
  async login(email,password){const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);const [salt,hex]=(user?.password||`${dummySalt}:${'00'.repeat(64)}`).split(':');const key=await derive(password,salt,64,{N:32768,maxmem:64*1024*1024});return timingSafeEqual(key,Buffer.from(hex,'hex'))?safe(user):null;},
  createSession(userId){db.prepare('DELETE FROM auth_sessions WHERE expires<?').run(Date.now());const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(digest(token),userId,Date.now()+7*86400000);return token;},
  user(token){if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return safe(db.prepare('SELECT u.* FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?').get(digest(token),Date.now()));},
  logout(token){if(token)db.prepare('DELETE FROM auth_sessions WHERE token=?').run(digest(token));},
  profile(userId){const row=db.prepare('SELECT data FROM profiles WHERE user_id=?').get(userId);return row?JSON.parse(row.data):{version:3,measurements:{}};},
  saveProfile(userId,profile){db.prepare('INSERT INTO profiles VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(userId,JSON.stringify(profile));},
  savePractice(userId,entry){const existing=db.prepare('SELECT user_id FROM practice_sessions WHERE id=?').get(entry.id);if(existing){if(existing.user_id!==userId)throw Object.assign(new Error('Invalid session identifier.'),{status:409});return;}db.prepare('INSERT INTO practice_sessions VALUES(?,?,?,?)').run(entry.id,userId,new Date().toISOString(),JSON.stringify(entry));},
  history(userId){return db.prepare('SELECT created_at,data FROM practice_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(userId).map(row=>({...JSON.parse(row.data),createdAt:row.created_at}));},
  close(){db.close();}
 };
}
