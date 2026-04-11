import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCZWM-r42zo_-8o_ve4CU9q_Qs06EuesXg",
  authDomain: "talbia-app.firebaseapp.com",
  projectId: "talbia-app",
  storageBucket: "talbia-app.firebasestorage.app",
  messagingSenderId: "70097632377",
  appId: "1:70097632377:web:384030acbe430966b8e8a8",
  measurementId: "G-3TZKBEX2RV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getToday = () => new Date().toISOString().split("T")[0];

const checkSubStatus = (startDate) => {
  if (!startDate) return { valid: false, msg: "غير مشترك" };
  const now = new Date();
  const start = new Date(startDate);
  const isValid = now.getMonth() === start.getMonth() && now.getFullYear() === start.getFullYear();
  return { valid: isValid, msg: isValid ? "نشط" : "انتهى (مطلوب اشتراك جديد)" };
};

const getDetailedAttendance = (pId, coachId, attendance) => {
  const coachKeys = Object.keys(attendance).filter(k => k.startsWith(`${coachId}_`));
  const count = coachKeys.filter(k => attendance[k]?.[pId] === "present").length;
  const percentage = Math.min(100, Math.round((count / 12) * 100));
  return { count, percentage };
};

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #070b14; --surface: #0d1526; --surface2: #111d35; --border: #1a2d4a;
  --accent: #00d4aa; --accent2: #0099ff; --red: #ff4560; --yellow: #ffc300;
  --text: #e8edf5; --muted: #4a6080; --card-glow: 0 0 0 1px var(--border), 0 4px 24px rgba(0,0,0,0.4);
}
body { background: var(--bg); font-family: 'Tajawal', sans-serif; direction: rtl; color: var(--text); min-height: 100vh; }
.card { background: var(--surface); border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--card-glow); padding: 16px; margin-bottom: 16px; }
.input-field { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); color: var(--text); outline: none; transition: 0.2s; margin-bottom: 8px; }
.btn { padding: 11px 22px; border-radius: 12px; border: none; color: white; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
.btn-primary { background: linear-gradient(135deg, var(--accent), #009980); }
.btn-blue { background: linear-gradient(135deg, var(--accent2), #0077cc); }
.btn-red { background: linear-gradient(135deg, var(--red), #cc0000); }
.btn-ghost { background: var(--surface2); border: 1px solid var(--border); color: var(--text); }
.btn-full { width: 100%; } .btn-sm { padding: 6px 12px; font-size: 12px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; text-align: center; }
.stat-value { font-size: 24px; font-weight: 900; } .stat-label { font-size: 11px; color: var(--muted); }
.tab-bar { display: flex; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 5px; margin-bottom: 16px; }
.tab-item { flex: 1; padding: 10px 4px; border-radius: 10px; border: none; cursor: pointer; color: var(--muted); font-weight: 700; background: transparent; }
.tab-item.active { background: var(--accent); color: #fff; }
.player-row { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; margin-bottom: 8px; position: relative; overflow: hidden; }
.header-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 20px; display: flex; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px); }
.logo-text { font-size: 18px; font-weight: 900; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.att-btn { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border); cursor: pointer; background: var(--surface2); color: var(--muted); }
.att-btn-present { background: rgba(0,212,170,0.2); border-color: var(--accent); color: var(--accent); }
.progress-bar { position: absolute; bottom: 0; right: 0; height: 3px; background: var(--accent2); transition: width 0.3s; }
`;
export default function App() {
  const [user, setUser] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [payments, setPayments] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
    script.async = true; document.body.appendChild(script);
    const fetchData = async () => {
      try {
        const [cSnap, pSnap, aSnap, paySnap, nSnap] = await Promise.all([
          getDoc(doc(db, "clubData", "coaches")), getDoc(doc(db, "clubData", "players")),
          getDoc(doc(db, "clubData", "attendance")), getDoc(doc(db, "clubData", "payments")),
          getDoc(doc(db, "clubData", "notes"))
        ]);
        const adminData = [{ id: 100, username: "admin", password: "2201", name: "المدير العام", isAdmin: true }];
        let dbCoaches = cSnap.exists() ? JSON.parse(cSnap.data().value) : adminData;
        setCoaches(dbCoaches.map(c => c.username === "admin" ? {...c, password: "2201"} : c));
        setPlayers(pSnap.exists() ? JSON.parse(pSnap.data().value) : []);
        setAttendance(aSnap.exists() ? JSON.parse(aSnap.data().value) : {});
        setPayments(paySnap.exists() ? JSON.parse(paySnap.data().value) : {});
        setNotes(nSnap.exists() ? JSON.parse(nSnap.data().value) : {});
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const save = async (key, data) => {
    try { await setDoc(doc(db, "clubData", key), { value: JSON.stringify(data) }); }
    catch (e) { console.error("Save error:", e); }
  };

  if (loading) return <div style={{ color: "white", textAlign: "center", marginTop: "20%" }}>🥋 جاري التحميل...</div>;

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{globalCSS}</style>
      {!user ? ( <LoginPage coaches={coaches} onLogin={setUser} /> ) : (
        <>
          <div className="header-bar no-print">
            <div><div style={{fontWeight:800}}>{user.name}</div><small style={{color:'var(--muted)'}}>{user.isAdmin?"🛡 مدير":"🥋 مدرب"}</small></div>
            <div className="logo-text">الطالبية</div>
            <button onClick={()=>setUser(null)} className="btn btn-ghost btn-sm">خروج</button>
          </div>
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px" }}>
            {user.isAdmin ? (
              <AdminDashboard coaches={coaches} setCoaches={(d)=>{setCoaches(d); save("coaches",d)}} players={players} setPlayers={(d)=>{setPlayers(d); save("players",d)}} attendance={attendance} payments={payments} setPayments={(d)=>{setPayments(d); save("payments",d)}} notes={notes} setNotes={(d)=>{setNotes(d); save("notes",d)}} />
            ) : (
              <CoachView coach={user} players={players} setPlayers={(d)=>{setPlayers(d); save("players",d)}} attendance={attendance} setAttendance={(d)=>{setAttendance(d); save("attendance",d)}} payments={payments} notes={notes} setNotes={(d)=>{setNotes(d); save("notes",d)}} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LoginPage({ coaches, onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="card" style={{ width: 340, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}><div className="logo-text" style={{fontSize:24}}>نادي الطالبية</div></div>
        <input className="input-field" placeholder="اسم المستخدم" onChange={e => setU(e.target.value)} />
        <input className="input-field" type="password" placeholder="كلمة المرور" onChange={e => setP(e.target.value)} />
        <button onClick={() => {
          const found = coaches.find(c => c.username === u && c.password === p);
          if (found) onLogin(found); else alert("بيانات خطأ");
        }} className="btn btn-primary btn-full">دخول</button>
      </div>
    </div>
  );
}
function AdminDashboard({ coaches, setCoaches, players, setPlayers, attendance, payments, setPayments, notes, setNotes }) {
  const [tab, setTab] = useState("reports");
  const expired = players.filter(p => !checkSubStatus(payments[p.id]?.date).valid);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{players.length}</div><div className="stat-label">لاعبين</div></div>
        <div className="stat-card"><div className="stat-value" style={{color:"var(--accent2)"}}>{coaches.filter(c=>!c.isAdmin).length}</div><div className="stat-label">مدربين</div></div>
        <div className="stat-card"><div className="stat-value" style={{color:"var(--red)"}}>{expired.length}</div><div className="stat-label">منتهي</div></div>
      </div>
      <div className="tab-bar no-print">
        {[['reports','📊 تقارير'],['players','👥 لاعبين'],['coaches','🏅 مدربين'],['payments','💰 مالية']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} className={`tab-item ${tab===k?'active':''}`}>{l}</button>
        ))}
      </div>
      {tab === "reports" && <AdminReports coaches={coaches} players={players} attendance={attendance} payments={payments} />}
      {tab === "players" && <AdminPlayers coaches={coaches} players={players} setPlayers={setPlayers} />}
      {tab === "coaches" && <AdminCoaches coaches={coaches} setCoaches={setCoaches} />}
      {tab === "payments" && <AdminPayments players={players} payments={payments} setPayments={setPayments} />}
    </div>
  );
}

function AdminReports({ coaches, players, attendance, payments }) {
  const [search, setSearch] = useState("");
  
  const exportExcel = () => {
    if (!window.XLSX) return alert("جاري تحميل المكتبة...");
    const data = players.map(p => {
      const coach = coaches.find(c => c.id === p.coachId);
      const sub = checkSubStatus(payments[p.id]?.date);
      const att = getDetailedAttendance(p.id, p.coachId, attendance);
      return { 
        "الاسم": p.name, 
        "المدرب": coach?.name || "غير محدد", 
        "الحالة": sub.msg, 
        "عدد أيام الحضور": att.count,
        "نسبة الحضور": `${att.percentage}%`, 
        "تاريخ آخر سداد": payments[p.id]?.date || "لم يسدد" 
      };
    });
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "التقرير العام");
    window.XLSX.writeFile(wb, `تقرير_نادي_الطلبية_${getToday()}.xlsx`);
  };

  return (
    <div>
      <button onClick={exportExcel} className="btn btn-blue btn-full" style={{marginBottom: 12}}>📥 تصدير التقرير للاكسل</button>
      <input className="input-field" placeholder="بحث باسم اللاعب..." onChange={e=>setSearch(e.target.value)} />
      
      {players.filter(p=>p.name.includes(search)).map(p => {
        const att = getDetailedAttendance(p.id, p.coachId, attendance);
        const sub = checkSubStatus(payments[p.id]?.date);
        const coach = coaches.find(c => c.id === p.coachId);

        return (
          <div key={p.id} className="player-row" style={{borderRight: `4px solid ${sub.valid?'var(--accent)':'var(--red)'}`}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <b style={{fontSize: 16}}>{p.name}</b>
                <div style={{fontSize: 12, color: 'var(--muted)', marginTop: 4}}>
                  <span>المدرب: {coach?.name || "---"}</span> | <span>الحالة: {sub.msg}</span>
                </div>
                <div style={{fontSize: 12, marginTop: 4}}>
                  حضور: <span style={{color:'var(--accent)'}}>{att.count} أيام</span> 
                  {payments[p.id]?.date && (
                    <span style={{marginRight: 12}}>
                      📅 تاريخ الدفع: <span style={{color:'var(--yellow)'}}>{payments[p.id].date}</span>
                    </span>
                  )}
                </div>
              </div>
              <div style={{textAlign: 'left'}}>
                <div style={{color:'var(--accent2)', fontWeight:900, fontSize: 20}}>{att.percentage}%</div>
                <small style={{fontSize: 10, color: 'var(--muted)'}}>نسبة الشهر</small>
              </div>
            </div>
            <div className="progress-bar" style={{width: `${att.percentage}%`}}></div>
          </div>
        );
      })}
    </div>
  );
}function AdminCoaches({ coaches, setCoaches }) {
  const [n, setN] = useState(""); const [t, setT] = useState(""); const [u, setU] = useState(""); const [p, setP] = useState("");
  const add = () => { if(n&&t&&u&&p) setCoaches([...coaches, {id:Date.now(), name:n, team:t, username:u, password:p, isAdmin:false}]); setN(""); setT(""); setU(""); setP(""); };
  const update = (id, field, val) => setCoaches(coaches.map(c => c.id === id ? {...c, [field]: val} : c));

  return (
    <div>
      <div className="card">
        <h4>إضافة مدرب جديد</h4>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
          <input className="input-field" placeholder="الاسم" value={n} onChange={e=>setN(e.target.value)} />
          <input className="input-field" placeholder="الفريق" value={t} onChange={e=>setT(e.target.value)} />
          <input className="input-field" placeholder="User" value={u} onChange={e=>setU(e.target.value)} />
          <input className="input-field" placeholder="Pass" value={p} onChange={e=>setP(e.target.value)} />
        </div>
        <button onClick={add} className="btn btn-blue btn-full">إضافة مدرب</button>
      </div>
      {coaches.filter(c=>!c.isAdmin).map(c => (
        <div key={c.id} className="card">
          <input className="input-field" value={c.name} onChange={e=>update(c.id, 'name', e.target.value)} />
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <input className="input-field" value={c.team} onChange={e=>update(c.id, 'team', e.target.value)} placeholder="اسم الفرقة" />
            <input className="input-field" value={c.password} onChange={e=>update(c.id, 'password', e.target.value)} placeholder="الباسورد" />
          </div>
          <button onClick={()=>setCoaches(coaches.filter(x=>x.id!==c.id))} className="btn btn-red btn-sm">حذف</button>
        </div>
      ))}
    </div>
  );
}

function AdminPlayers({ coaches, players, setPlayers }) {
  const [n, setN] = useState(""); const [cId, setCId] = useState("");
  return (
    <div>
      <div className="card">
        <h4>إضافة لاعب</h4>
        <input className="input-field" placeholder="الاسم" value={n} onChange={e=>setN(e.target.value)} />
        <select className="input-field" value={cId} onChange={e=>setCId(e.target.value)}>
          <option value="">اختر المدرب</option>
          {coaches.filter(c=>!c.isAdmin).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={()=>{if(n&&cId)setPlayers([...players,{id:Date.now(), name:n, coachId:Number(cId)}]);setN("")}} className="btn btn-primary btn-full">إضافة</button>
      </div>
      {players.map(p => (
        <div key={p.id} className="player-row" style={{display:'flex', justifyContent:'space-between'}}>
          <span>{p.name}</span>
          <button onClick={()=>setPlayers(players.filter(x=>x.id!==p.id))} className="btn btn-red btn-sm">حذف</button>
        </div>
      ))}
    </div>
  );
}

function AdminPayments({ players, payments, setPayments }) {
  const [d, setD] = useState(getToday());
  return (
    <div>
      <input type="date" className="input-field" value={d} onChange={e=>setD(e.target.value)} />
      {players.map(p => (
        <div key={p.id} className="player-row" style={{display:'flex', justifyContent:'space-between'}}>
          <span>{p.name}</span>
          <button onClick={()=>{
            const cur = payments[p.id]?.paid;
            setPayments({...payments, [p.id]: {paid:!cur, date: !cur?d:null}});
          }} className={`btn btn-sm ${payments[p.id]?.paid?'btn-ghost':'btn-primary'}`}>
            {payments[p.id]?.paid ? "إلغاء دفع" : "تسجيل دفع"}
          </button>
        </div>
      ))}
    </div>
  );
}
function CoachView({ coach, players, setPlayers, attendance, setAttendance, payments, notes, setNotes }) {
  const [tab, setTab] = useState("today");
  const [newName, setNewName] = useState("");
  const myPlayers = players.filter(p => String(p.coachId) === String(coach.id));

  return (
    <div>
      <div className="card" style={{border: '1px dashed var(--accent)'}}>
        <h4 style={{marginBottom: 8}}>➕ إضافة لاعب جديد</h4>
        <div style={{display:'flex', gap:8}}>
          <input className="input-field" style={{marginBottom:0}} placeholder="اسم اللاعب" value={newName} onChange={e=>setNewName(e.target.value)} />
          <button onClick={()=>{if(newName){setPlayers([...players,{id:Date.now(),name:newName,coachId:Number(coach.id)}]);setNewName("")}}} className="btn btn-primary btn-sm">إضافة</button>
        </div>
      </div>
      <div className="tab-bar">
        {[['today','📋 تحضير'],['reports','📊 تقارير'],['notes','📝 ملاحظات']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`tab-item ${tab===k?'active':''}`}>{l}</button>
        ))}
      </div>

      {tab === "today" && myPlayers.map(p => {
        const sub = checkSubStatus(payments[p.id]?.date);
        const isP = attendance[`${coach.id}_${getToday()}`]?.[p.id] === 'present';
        return (
          <div key={p.id} className="player-row" style={{opacity: sub.valid?1:0.6}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div><b>{p.name}</b><br/><small style={{color:sub.valid?'var(--accent)':'var(--red)'}}>{sub.msg}</small></div>
              <button onClick={()=>{
                const key = `${coach.id}_${getToday()}`;
                setAttendance({...attendance, [key]: {...attendance[key], [p.id]: isP?'absent':'present'}});
              }} className={`att-btn ${isP?'att-btn-present':''}`}>{isP?'حاضر ✅':'غائب ❌'}</button>
            </div>
          </div>
        );
      })}

      {tab === "reports" && myPlayers.map(p => {
        const att = getDetailedAttendance(p.id, coach.id, attendance);
        const sub = checkSubStatus(payments[p.id]?.date);
        return (
          <div key={p.id} className="player-row" style={{borderRight: `4px solid ${sub.valid?'var(--accent)':'var(--red)'}`}}>
            <div style={{display:'flex', justifyContent:'space-between'}}>
              <div><b>{p.name}</b><br/><small>حضور: {att.count} | {sub.msg}</small></div>
              <div style={{color:'var(--accent2)', fontWeight:900, fontSize:18}}>{att.percentage}%</div>
            </div>
            <div className="progress-bar" style={{width: `${att.percentage}%`}}></div>
            {payments[p.id]?.date && <div style={{fontSize:10, color:'var(--accent2)', marginTop:4}}>تاريخ الدفع: {payments[p.id].date}</div>}
          </div>
        );
      })}

      {tab === "notes" && myPlayers.map(p => (
        <div key={p.id} className="card">
          <b>{p.name}:</b>
          <textarea className="input-field" style={{marginTop:8, height:60}} value={notes[p.id]||""} onChange={e=>setNotes({...notes, [p.id]: e.target.value})} placeholder="اكتب ملاحظاتك هنا..." />
        </div>
      ))}
    </div>
  );
}