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

const BELTS = [
  { label: "أبيض", color: "#f0f0f0", textColor: "#000" },
  { label: "(10)أصفر", color: "#FFD700", textColor: "#000" },
    { label: "أصفر(9)", color: "#FFD702", textColor: "#000" },
  { label: "برتقالي(8)", color: "#FF8C00", textColor: "#fff" },
  { label: "برتقالي(7)", color: "#FF8C02", textColor: "#fff" },
  { label: "أخضر(6)", color: "#228B22", textColor: "#fff" },
  { label: "أخضر(5)", color: "#228B25", textColor: "#fff" },
  { label: "أزرق(4)", color: "#1E90FF", textColor: "#fff" },
  { label: "أزرق(3)", color: "#1E95FF", textColor: "#fff" },
  { label: "بني(2)", color: "#8B4513", textColor: "#fff" },
  { label: "بني(1)", color: "#8B4517", textColor: "#fff" },
  { label: "أسود", color: "#1a1a1a", textColor: "#fff" },
];


const SUB_TYPES = [
  { label: "أخوات (اتنين)", price: 135, color: "#7c3aed", icon: "👫" },
  { label: "عضو بالنادي", price: 150, color: "#0099ff", icon: "🏅" },
  { label: "غير عضو", price: 300, color: "#00d4aa", icon: "🥋" },
];

const BADGES = [
  { id: "streak10", label: "ملتزم 🔥", desc: "10 أيام متتالية", color: "#ff7a00", icon: "🔥" },
  { id: "streak20", label: "أسطورة ⚡", desc: "20 يوم متتالي", color: "#ffc300", icon: "⚡" },
  { id: "perfect", label: "مثالي 💎", desc: "حضور 100% الشهر", color: "#00d4aa", icon: "💎" },
  { id: "top", label: "الأفضل 🏆", desc: "لاعب الشهر", color: "#FFD700", icon: "🏆" },
];

const getPlayerBadges = (pId, coachId, attendance) => {
  const earned = [];
  const keys = Object.keys(attendance).filter(k => k.startsWith(`${coachId}_`)).sort();
  
  // streak checker
  let streak = 0; let maxStreak = 0;
  keys.forEach(k => {
    if (attendance[k]?.[pId] === "present") { streak++; maxStreak = Math.max(maxStreak, streak); }
    else streak = 0;
  });
  if (maxStreak >= 10) earned.push(BADGES[0]);
  if (maxStreak >= 20) earned.push(BADGES[1]);
  
  // perfect month
  const att = getDetailedAttendance(pId, coachId, attendance);
  if (att.percentage === 100 && att.count > 0) earned.push(BADGES[2]);
  
  return earned;
};

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


// ─────────── واتساب شير ───────────
const shareWhatsApp = (text) => {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
};

// ─────────── لاعب الشهر ───────────
const getPlayerOfMonth = (players, coachId, attendance, payments) => {
  const myPlayers = coachId 
    ? players.filter(p => String(p.coachId) === String(coachId))
    : players;
  if (!myPlayers.length) return null;
  return myPlayers.reduce((best, p) => {
    const att = getDetailedAttendance(p.id, coachId || p.coachId, attendance);
    const bestAtt = getDetailedAttendance(best.id, coachId || best.coachId, attendance);
    return att.count > bestAtt.count ? p : best;
  });
};


// ─────────── تنبيهات ذكية ───────────
const getSmartAlerts = (players, attendance, payments, coaches, playerDetails = {}) => {
  const alerts = [];
  const today = new Date();

  players.forEach(p => {
    const coach = coaches.find(c => c.id === p.coachId);
    const pd = playerDetails[p.id] || {};

    // لاعب غاب أكتر من 2 أسبوع
    const recentKeys = Object.keys(attendance)
      .filter(k => k.startsWith(`${p.coachId}_`))
      .sort().slice(-14);
    const recentAbsent = recentKeys.filter(k => attendance[k]?.[p.id] !== "present").length;
    if (recentAbsent >= 10) {
      alerts.push({ type: "absence", msg: `${p.name} غاب أكتر من أسبوعين متتاليين`, coach: coach?.name, color: "var(--red)", icon: "⚠️" });
    }

    // اشتراك منتهي
    if (!checkSubStatus(payments[p.id]?.date).valid && payments[p.id]?.date) {
      alerts.push({ type: "subscription", msg: `اشتراك ${p.name} منتهي`, coach: coach?.name, color: "var(--yellow)", icon: "💳" });
    }

    // عيد ميلاد النهارده
    if (pd.birthdate) {
      const bd = new Date(pd.birthdate);
      if (bd.getDate() === today.getDate() && bd.getMonth() === today.getMonth()) {
        const age = today.getFullYear() - bd.getFullYear();
        alerts.push({ type: "birthday", msg: `🎂 عيد ميلاد ${p.name} النهارده! (${age} سنة)`, coach: coach?.name, color: "var(--yellow)", icon: "🎂" });
      }
    }

    // قيد غير مسدد مع وجود فعالية
    if (pd.examRegistered && !pd.feePaid) {
      alerts.push({ type: "fee", msg: `${p.name} مسجل في فعالية ولم يسدد القيد`, coach: coach?.name, color: "var(--orange)", icon: "💰" });
    }
  });

  return alerts.slice(0, 15);
};

// Toast notification system
let toastSetters = [];
const showToast = (msg, type = "success") => {
  toastSetters.forEach(fn => fn(prev => [...prev, { id: Date.now(), msg, type }]));
};

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => { toastSetters.push(setToasts); return () => { toastSetters = toastSetters.filter(f => f !== setToasts); }; }, []);
  useEffect(() => {
    if (toasts.length > 0) {
      const t = setTimeout(() => setToasts(prev => prev.slice(1)), 3000);
      return () => clearTimeout(t);
    }
  }, [toasts]);
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, minWidth: 260, maxWidth: 380 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "success" ? "linear-gradient(135deg,#00d4aa,#009980)" : t.type === "error" ? "linear-gradient(135deg,#ff4560,#cc0000)" : "linear-gradient(135deg,#ffc300,#e6a800)",
          color: "#fff", padding: "12px 20px", borderRadius: 12, fontFamily: "'Tajawal',sans-serif", fontWeight: 700,
          fontSize: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", animation: "slideDown 0.3s ease", textAlign: "center", direction: "rtl"
        }}>
          {t.type === "success" ? "✅ " : t.type === "error" ? "❌ " : "ℹ️ "}{t.msg}
        </div>
      ))}
    </div>
  );
}

// Confirm Modal
function ConfirmModal({ open, msg, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 8888, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 28, maxWidth: 320, width: "90%", textAlign: "center", direction: "rtl" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: "var(--text)" }}>{msg}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onConfirm} className="btn btn-red" style={{ flex: 1 }}>تأكيد</button>
          <button onClick={onCancel} className="btn btn-ghost" style={{ flex: 1 }}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #060b14; --surface: #0c1525; --surface2: #101d35; --surface3: #152040;
  --border: #182a44; --border2: #1e3458;
  --accent: #00d4aa; --accent2: #0099ff; --accent3: #7c3aed;
  --red: #ff4560; --yellow: #ffc300; --orange: #ff7a00;
  --text: #e8edf5; --muted: #4a6080; --muted2: #6a80a0;
  --card-glow: 0 0 0 1px var(--border), 0 4px 24px rgba(0,0,0,0.5);
  --card-glow-active: 0 0 0 1px var(--accent), 0 4px 32px rgba(0,212,170,0.15);
}
@keyframes slideDown { from { opacity:0; transform: translateY(-10px); } to { opacity:1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
@keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
@keyframes barGrow { from { width: 0%; } to { width: var(--target-w); } }

body { background: var(--bg); font-family: 'Tajawal', sans-serif; direction: rtl; color: var(--text); min-height: 100vh; }

.card {
  background: var(--surface);
  border-radius: 18px;
  border: 1px solid var(--border);
  box-shadow: var(--card-glow);
  padding: 18px;
  margin-bottom: 14px;
  transition: box-shadow 0.2s;
}
.card:hover { box-shadow: var(--card-glow-active); }

.glass {
  background: rgba(12,21,37,0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.06);
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(6,11,20,0.8);
  color: var(--text);
  outline: none;
  transition: border 0.2s, box-shadow 0.2s;
  margin-bottom: 8px;
  font-family: 'Tajawal', sans-serif;
  font-size: 14px;
}
.input-field:focus { border-color: var(--accent2); box-shadow: 0 0 0 3px rgba(0,153,255,0.12); }
select.input-field option { background: var(--surface); }

.btn {
  padding: 11px 22px;
  border-radius: 12px;
  border: none;
  color: white;
  cursor: pointer;
  font-weight: 700;
  font-family: 'Tajawal', sans-serif;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  font-size: 14px;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
.btn:active { transform: translateY(0); }
.btn-primary { background: linear-gradient(135deg, #00d4aa, #009980); box-shadow: 0 2px 12px rgba(0,212,170,0.2); }
.btn-blue { background: linear-gradient(135deg, #0099ff, #0077cc); box-shadow: 0 2px 12px rgba(0,153,255,0.2); }
.btn-red { background: linear-gradient(135deg, #ff4560, #cc0000); box-shadow: 0 2px 12px rgba(255,69,96,0.2); }
.btn-yellow { background: linear-gradient(135deg, #ffc300, #e6a800); color: #000; }
.btn-ghost {
  background: var(--surface2);
  border: 1px solid var(--border2);
  color: var(--text);
}
.btn-ghost:hover { border-color: var(--accent2); }
.btn-full { width: 100%; }
.btn-sm { padding: 7px 14px; font-size: 12px; border-radius: 9px; }
.btn-xs { padding: 5px 10px; font-size: 11px; border-radius: 8px; }

.tab-bar {
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 4px;
  margin-bottom: 16px;
  overflow-x: auto;
}
.tab-item {
  flex: 1;
  min-width: 70px;
  padding: 9px 6px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-weight: 700;
  background: transparent;
  font-family: 'Tajawal', sans-serif;
  font-size: 12px;
  transition: all 0.2s;
  white-space: nowrap;
}
.tab-item.active { background: linear-gradient(135deg, var(--accent), #009980); color: #fff; box-shadow: 0 2px 10px rgba(0,212,170,0.3); }
.tab-item:not(.active):hover { background: var(--surface2); color: var(--text); }

.player-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 8px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.15s;
  animation: fadeIn 0.3s ease;
}
.player-row:hover { transform: translateX(-2px); border-color: var(--border2); }

.header-bar {
  background: rgba(12,21,37,0.95);
  border-bottom: 1px solid var(--border);
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(16px);
}
.logo-text {
  font-size: 20px;
  font-weight: 900;
  background: linear-gradient(135deg, var(--accent), var(--accent2), var(--accent3));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

.att-btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1.5px solid var(--border);
  cursor: pointer;
  background: var(--surface2);
  color: var(--muted);
  font-family: 'Tajawal', sans-serif;
  font-weight: 700;
  font-size: 13px;
  transition: all 0.15s;
}
.att-btn:hover { border-color: var(--accent); }
.att-btn-present {
  background: rgba(0,212,170,0.15);
  border-color: var(--accent);
  color: var(--accent);
}

.progress-bar {
  position: absolute;
  bottom: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent2), var(--accent));
  border-radius: 0 0 16px 16px;
  transition: width 0.6s ease;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px 16px;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
.stat-card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--accent-line, linear-gradient(90deg, var(--accent), var(--accent2)));
}
.stat-value { font-size: 26px; font-weight: 900; line-height: 1; }
.stat-label { font-size: 11px; color: var(--muted); margin-top: 4px; }

.belt-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.section-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--muted2);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

.donut-ring {
  transform: rotate(-90deg);
  transition: stroke-dashoffset 0.8s ease;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}
.badge-green { background: rgba(0,212,170,0.15); color: var(--accent); border: 1px solid rgba(0,212,170,0.3); }
.badge-red { background: rgba(255,69,96,0.15); color: var(--red); border: 1px solid rgba(255,69,96,0.3); }
.badge-yellow { background: rgba(255,195,0,0.15); color: var(--yellow); border: 1px solid rgba(255,195,0,0.3); }
.badge-blue { background: rgba(0,153,255,0.15); color: var(--accent2); border: 1px solid rgba(0,153,255,0.3); }

.chart-bar {
  transition: height 0.6s ease;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
}
.chart-bar:hover { opacity: 0.85; }

.divider { height: 1px; background: var(--border); margin: 14px 0; }

.checkbox-custom {
  width: 20px; height: 20px;
  border-radius: 6px;
  border: 2px solid var(--border2);
  background: var(--bg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.checkbox-custom.checked {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(0,212,170,0.4);
}

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

@media (max-width: 500px) {
  .grid-3 { grid-template-columns: 1fr 1fr; }
}
`;

// ───────────── Donut Chart ─────────────
function DonutChart({ value, max, color, size = 60, label }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / max) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color || "var(--accent)"}
          strokeWidth={6} strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" className="donut-ring" />
        <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color || "var(--accent)"} fontSize={size * 0.22} fontWeight="900" fontFamily="Tajawal">
          {value}
        </text>
      </svg>
      {label && <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center" }}>{label}</div>}
    </div>
  );
}

// ───────────── Bar Chart ─────────────
function BarChart({ data, height = 120 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, paddingBottom: 20, position: "relative" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 10, color: "var(--muted2)", fontWeight: 700 }}>{d.value}</div>
          <div className="chart-bar" title={d.label}
            style={{ width: "100%", height: `${(d.value / max) * (height - 30)}px`, background: d.color || "linear-gradient(180deg, var(--accent2), var(--accent3))", minHeight: d.value ? 4 : 0 }} />
          <div style={{ fontSize: 9, color: "var(--muted)", textAlign: "center", position: "absolute", bottom: 0 }}>{d.label?.slice(0, 4)}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 🎙️ نظام التحيات الكوميدية
// ═══════════════════════════════════════════════════
// eslint-disable-next-line no-unused-vars
const coachTaunts = {
  "SHIBL": [
    "آلووو يا شبل! كنت فاكرك نسيت البابسورد تاني! ماشي ماشي جيت!",
    "يا عم شبل والله وحشتنا! فين كنت؟ ماشي ماشي متقولش!",
    "شبل بيه! التطبيق فتح لوحده... يعني إيه ده؟ يعني انت إيه... مش مهم يلا!",
  ],
  "ALAA": [
    "علاء! علاء! علاء! آه آه آه انت فاتح التطبيق... تمام اتمسح عيني!",
    "يا عم علاء... انا كنت فاكرك نسيتنا! طب ماشي... يلا يلا!",
    "علاء أفندي! التطبيق بيقولك مرحبتين وبوسة على راسك... بس من بعيد!",
  ],
  "SAYED": [
    "سيد! يا سيد! أيوه انت اللي بتبص في التليفون ده... إيه رأيك تفتح؟ آه فتحت... تمام!",
    "يا عم سيد والله انت راجل محترم... بس التطبيق مش هيقولك كده كل يوم!",
    "سيد بيه! فين الكابتن ده؟ آه... ها هو! يلا بسم الله!",
  ],
  "ahmed": [
    "أحمد عبدالحفيظ! الاسم ده لوحده بياخد نص بطارية التليفون لما بنكتبه!",
    "يا عم أحمد... عبدالحفيظ... الجزء التاني ده ليه؟ ماشي ماشي مش وقته!",
    "أحمد! عبد! الحفيظ! تلات كلمات... تلات تحيات... يلا بسم الله!",
  ],
  "ahmed2": [
    "أحمد عبدالحفيظ! الاسم ده لوحده بياخد نص بطارية التليفون لما بنكتبه!",
    "يا عم أحمد... عبدالحفيظ... الجزء التاني ده ليه؟ ماشي ماشي مش وقته!",
    "أحمد! عبد! الحفيظ! تلات كلمات... تلات تحيات... يلا بسم الله!",
  ],
  "EMAN": [
    "إيمان هانم! التطبيق بيقولك أهلاً... وبيقولك كمان إنتي النهارده تحفة!",
    "يا ستي إيمان... فتحتي التطبيق؟ تمام... انتي دايماً الأحسن!",
    "إيمان! إيمان! إيمان! تلاتة عشان نتأكد إنك صحية وبخير... يلا!",
  ],
  "OMAR": [
    "عمر! يا عمر! قوم قوم قوم... آه انت صاحي؟ تمام إذن فتح التطبيق صح!",
    "يا عم عمر... انت عارف إنك حبيبنا؟ بس متقولش لحد قلنالك!",
    "عمر أفندي! التطبيق بيقولك أهلاً وسهلاً... وبيقولك كمان اعمل القهوة الأول!",
  ],
  "OMAR2": [
    "عمر! يا عمر! قوم قوم قوم... آه انت صاحي؟ تمام إذن فتح التطبيق صح!",
    "يا عم عمر... انت عارف إنك حبيبنا؟ بس متقولش لحد قلنالك!",
    "عمر أفندي! التطبيق بيقولك أهلاً وسهلاً... وبيقولك كمان اعمل القهوة الأول!",
  ],
  "ANAS": [
    "أنس! يا أنس! آه انت هنا... كنت فاكر التليفون فتح لوحده!",
    "يا عم أنس... انت عارف إن اسمك قصير؟ ده بيريّح... شكراً!",
    "أنس أفندي! التطبيق بيقولك أهلاً... وبيقولك كمان تشرب مية!",
  ],
};


// ───────────── Belt Badge ─────────────
function BeltBadge({ belt }) {
  const b = BELTS.find(x => x.label === belt) || BELTS[0];
  return (
    <span className="belt-badge" style={{ background: b.color, color: b.textColor, border: `1px solid ${b.color}88` }}>
      🥋 {b.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [payments, setPayments] = useState({});
  const [notes, setNotes] = useState({});
  const [playerDetails, setPlayerDetails] = useState({});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [playerExtra, setPlayerExtra] = useState({});
  const [trainingSettings, setTrainingSettings] = useState({ startHour: 17, duration: 90 });

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);

    const fetchData = async () => {
      try {
        const [cSnap, pSnap, aSnap, paySnap, nSnap, pdSnap, evSnap, logsSnap, pExtraSnap, trainSnap] = await Promise.all([
          getDoc(doc(db, "clubData", "coaches")),
          getDoc(doc(db, "clubData", "players")),
          getDoc(doc(db, "clubData", "attendance")),
          getDoc(doc(db, "clubData", "payments")),
          getDoc(doc(db, "clubData", "notes")),
          getDoc(doc(db, "clubData", "playerDetails")),
          getDoc(doc(db, "clubData", "events")),
          getDoc(doc(db, "clubData", "logs")),
          getDoc(doc(db, "clubData", "playerExtra")),
          getDoc(doc(db, "clubData", "trainingSettings")),
        ]);
        const adminData = [{ id: 100, username: "admin", password: "2201", name: "المدير الإدارى", isAdmin: true }];
        let dbCoaches = cSnap.exists() ? JSON.parse(cSnap.data().value) : adminData;
        setCoaches(dbCoaches.map(c => c.username === "admin" ? { ...c, password: "2201" } : c));
        setPlayers(pSnap.exists() ? JSON.parse(pSnap.data().value) : []);
        setAttendance(aSnap.exists() ? JSON.parse(aSnap.data().value) : {});
        setPayments(paySnap.exists() ? JSON.parse(paySnap.data().value) : {});
        setNotes(nSnap.exists() ? JSON.parse(nSnap.data().value) : {});
        setPlayerDetails(pdSnap.exists() ? JSON.parse(pdSnap.data().value) : {});
        setEvents(evSnap.exists() ? JSON.parse(evSnap.data().value) : []);
        setLogs(logsSnap.exists() ? JSON.parse(logsSnap.data().value) : []);
        setPlayerExtra(pExtraSnap.exists() ? JSON.parse(pExtraSnap.data().value) : {});
        setTrainingSettings(trainSnap.exists() ? JSON.parse(trainSnap.data().value) : { startHour: 17, duration: 90 });
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const save = async (key, data) => {
    try { await setDoc(doc(db, "clubData", key), { value: JSON.stringify(data) }); }
    catch (e) { console.error("Save error:", e); }
  };

  if (loading) return (
    <div style={{ color: "white", textAlign: "center", marginTop: "20%", fontFamily: "'Tajawal',sans-serif", direction: "rtl" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🥋</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>جاري تحميل نادي الطالبية...</div>
    </div>
  );

  return (
    <div style={{ direction: "rtl", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{globalCSS}</style>
      <ToastContainer />
      {!user ? (
        <LoginPage coaches={coaches} onLogin={setUser} />
      ) : (
        <>
          <div className="header-bar">
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{user.name}</div>
              <small style={{ color: "var(--muted)", fontSize: 11 }}>{user.isAdmin ? "🛡 مدير الإدارى" : "🥋 مدرب"}</small>
            </div>
            <div className="logo-text">الطالبية</div>
            <button onClick={() => { setUser(null); showToast("تم تسجيل الخروج بنجاح", "info"); }} className="btn btn-ghost btn-sm">خروج</button>
          </div>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
            {user.isAdmin ? (
              <AdminDashboard
                coaches={coaches} setCoaches={(d) => { setCoaches(d); save("coaches", d); }}
                players={players} setPlayers={(d) => { setPlayers(d); save("players", d); }}
                attendance={attendance} setAttendance={(d) => { setAttendance(d); save("attendance", d); }}
                payments={payments} setPayments={(d) => { setPayments(d); save("payments", d); }}
                notes={notes} setNotes={(d) => { setNotes(d); save("notes", d); }}
                playerDetails={playerDetails} setPlayerDetails={(d) => { setPlayerDetails(d); save("playerDetails", d); }}
                events={events} setEvents={(d) => { setEvents(d); save("events", d); }}
                logs={logs} setLogs={(d) => { setLogs(d); save("logs", d); }}
                playerExtra={playerExtra} setPlayerExtra={(d) => { setPlayerExtra(d); save("playerExtra", d); }}
                trainingSettings={trainingSettings} setTrainingSettings={(d) => { setTrainingSettings(d); save("trainingSettings", d); }}
              />
            ) : (
              <CoachView
                coach={user}
                players={players} setPlayers={(d) => { setPlayers(d); save("players", d); }}
                attendance={attendance} setAttendance={(d) => { setAttendance(d); save("attendance", d); }}
                payments={payments}
                notes={notes} setNotes={(d) => { setNotes(d); save("notes", d); }}
                playerDetails={playerDetails} setPlayerDetails={(d) => { setPlayerDetails(d); save("playerDetails", d); }}
                events={events}
                logs={logs} setLogs={(d) => { setLogs(d); save("logs", d); }}
                playerExtra={playerExtra} setPlayerExtra={(d) => { setPlayerExtra(d); save("playerExtra", d); }}
                trainingSettings={trainingSettings} setTrainingSettings={(d) => { setTrainingSettings(d); save("trainingSettings", d); }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════ LOGIN ═══════════════════════════
function LoginPage({ coaches, onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [audioReady, setAudioReady] = useState(false);

  // تفعيل الصوت لما المستخدم يعمل أي click
  const enableAudio = () => {
    if (audioReady) return;
    // بنشغل صوت فاضي عشان المتصفح يسمح بالصوت
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(() => setAudioReady(true));
    setAudioReady(true);
  };

  return (
    <div onClick={enableAudio} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🥋</div>
          <div className="logo-text" style={{ fontSize: 28 }}>نادي الطالبية</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>نظام إدارة الأكاديمية</div>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <input className="input-field" placeholder="اسم المستخدم" value={u} onChange={e => setU(e.target.value)}
            onKeyDown={e => e.key === "Enter" && document.getElementById("loginBtn").click()} />
          <input className="input-field" type="password" placeholder="كلمة المرور" value={p} onChange={e => setP(e.target.value)}
            onKeyDown={e => e.key === "Enter" && document.getElementById("loginBtn").click()} />
          <button id="loginBtn" onClick={() => {
            const found = coaches.find(c => c.username.toLowerCase() === u.toLowerCase() && c.password === p);
            if (found) {
              // بنشغل صوت صامت أول عشان نفتح الـ AudioContext مع الـ click
              const unlock = new Audio();
              unlock.play().catch(() => {});
              // بعدين بنشغل الصوت الحقيقي
              setTimeout(() => {
                const audio = new Audio(`/sounds/${found.username.toLowerCase()}.mp3`);
                audio.volume = 1.0;
                audio.play()
                  .then(() => console.log("✅ Sound!"))
                  .catch(e => console.log("❌", e.message));
              }, 100);
              onLogin(found);
              showToast(`مرحباً ${found.name}! 👋`, "success");
            }
            else { showToast("اسم المستخدم أو كلمة المرور خطأ", "error"); }
          }} className="btn btn-primary btn-full" style={{ marginTop: 4, padding: 14 }}>دخول</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════ ADMIN ═══════════════════════════
function AdminDashboard({ coaches, setCoaches, players, setPlayers, attendance, setAttendance, payments, setPayments, notes, setNotes, playerDetails, setPlayerDetails, events, setEvents, logs, setLogs, playerExtra, setPlayerExtra, trainingSettings, setTrainingSettings }) {
  const [tab, setTab] = useState("dashboard");
  const expired = players.filter(p => !checkSubStatus(payments[p.id]?.date).valid);
  const active = players.filter(p => checkSubStatus(payments[p.id]?.date).valid);
  const totalAttDays = players.reduce((sum, p) => sum + getDetailedAttendance(p.id, p.coachId, attendance).count, 0);
  const avgAtt = players.length ? Math.round(totalAttDays / players.length) : 0;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { val: players.length, label: "إجمالي اللاعبين", color: "var(--accent2)", icon: "👥" },
          { val: coaches.filter(c => !c.isAdmin).length, label: "المدربين", color: "var(--accent)", icon: "🏅" },
          { val: active.length, label: "مشتركين نشطين", color: "#00d4aa", icon: "✅" },
          { val: expired.length, label: "اشتراك منتهي", color: "var(--red)", icon: "⚠️" },
          { val: avgAtt, label: "متوسط الحضور", color: "var(--yellow)", icon: "📊" },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ "--accent-line": `linear-gradient(90deg, ${s.color}, transparent)` }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="tab-bar">
        {[["dashboard", "🏠 الرئيسية"], ["reports", "📊 تقارير"], ["players", "👥 لاعبين"], ["coaches", "🏅 مدربين"], ["payments", "💰 مالية"], ["events", "🏆 فعاليات"], ["alerts", "🔔 تنبيهات"], ["leaderboard", "🏅 ترتيب"], ["logs", "📋 سجل"], ["reset", "🔄 إعادة"], ["settings", "⚙️ إعدادات"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab-item ${tab === k ? "active" : ""}`}>{l}</button>
        ))}
      </div>

      {tab === "dashboard" && <AdminMainDashboard coaches={coaches} players={players} attendance={attendance} payments={payments} events={events} playerDetails={playerDetails} />}
      {tab === "reports" && <AdminReports coaches={coaches} players={players} attendance={attendance} payments={payments} playerDetails={playerDetails} />}
      {tab === "players" && <AdminPlayers coaches={coaches} players={players} setPlayers={setPlayers} playerDetails={playerDetails} setPlayerDetails={setPlayerDetails} />}
      {tab === "coaches" && <AdminCoaches coaches={coaches} setCoaches={setCoaches} />}
      {tab === "payments" && <AdminPayments players={players} payments={payments} setPayments={setPayments} />}
      {tab === "events" && <AdminEvents events={events} setEvents={setEvents} players={players} playerDetails={playerDetails} setPlayerDetails={setPlayerDetails} />}
      {tab === "alerts" && <AdminAlerts players={players} attendance={attendance} payments={payments} coaches={coaches} playerDetails={playerDetails} />}
      {tab === "leaderboard" && <AdminLeaderboard players={players} coaches={coaches} attendance={attendance} payments={payments} playerDetails={playerDetails} />}
      {tab === "settings" && <AdminSettings trainingSettings={trainingSettings} setTrainingSettings={setTrainingSettings} coaches={coaches} />}
      {tab === "logs" && <AdminLogs logs={logs} setLogs={setLogs} />}
      {tab === "reset" && <AdminReset attendance={attendance} setAttendance={setAttendance} payments={payments} setPayments={setPayments} logs={logs} setLogs={setLogs} players={players} coaches={coaches} />}
    </div>
  );
}

// ─────────── Admin Main Dashboard ───────────
function AdminMainDashboard({ coaches, players, attendance, payments, events, playerDetails = {} }) {
  const beltCounts = BELTS.map(b => ({
    label: b.label,
    value: players.filter(p => playerDetails[p.id]?.belt === b.label).length,
    color: b.color
  }));

  const coachStats = coaches.filter(c => !c.isAdmin).map(c => {
    const myPlayers = players.filter(p => String(p.coachId) === String(c.id));
    const totalAtt = myPlayers.reduce((s, p) => s + getDetailedAttendance(p.id, c.id, attendance).count, 0);
    return { label: c.name.split(" ")[0], value: myPlayers.length, att: totalAtt };
  });

  const upcomingEvents = events.filter(e => e.date >= getToday()).slice(0, 3);
  const expiredPlayers = players.filter(p => !checkSubStatus(payments[p.id]?.date).valid);

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        {/* Players by coach bar chart */}
        <div className="card">
          <div className="section-title">📊 لاعبون لكل مدرب</div>
          {coachStats.length > 0
            ? <BarChart data={coachStats.map(c => ({ label: c.label, value: c.value, color: "linear-gradient(180deg,var(--accent2),var(--accent3))" }))} height={110} />
            : <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 20 }}>لا يوجد بيانات</div>}
        </div>
        {/* Sub status */}
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="section-title">💳 حالة الاشتراكات</div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <DonutChart value={players.filter(p => checkSubStatus(payments[p.id]?.date).valid).length} max={players.length || 1} color="var(--accent)" size={70} label="نشط" />
            <DonutChart value={expiredPlayers.length} max={players.length || 1} color="var(--red)" size={70} label="منتهي" />
          </div>
        </div>
      </div>

      {/* Belts distribution */}
      {beltCounts.some(b => b.value > 0) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title">🥋 توزيع الأحزمة</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {beltCounts.filter(b => b.value > 0).map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--surface2)", borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.color, display: "inline-block", border: "1px solid rgba(255,255,255,0.2)" }} />
                <span style={{ fontSize: 12 }}>{b.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent2)" }}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* أعياد الميلاد النهارده */}
      {(() => {
        const today = new Date();
        const birthdays = players.filter(p => {
          const bd = playerDetails[p.id]?.birthdate;
          if (!bd) return false;
          const d = new Date(bd);
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
        });
        return birthdays.length > 0 ? (
          <div className="card" style={{ borderColor: "var(--yellow)", background: "rgba(255,195,0,0.05)", marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>🎂</div>
            <div style={{ fontWeight: 800, color: "var(--yellow)", marginBottom: 8 }}>أعياد ميلاد النهارده!</div>
            {birthdays.map(p => {
              const age = today.getFullYear() - new Date(playerDetails[p.id].birthdate).getFullYear();
              return <div key={p.id} style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎉 {p.name} — {age} سنة</div>;
            })}
            <button onClick={() => {
              const msg = birthdays.map(p => {
                const age = today.getFullYear() - new Date(playerDetails[p.id].birthdate).getFullYear();
                return `🎂 عيد ميلاد سعيد ${p.name}! كل سنة وانت بخير 🎉 (${age} سنة)`;
              }).join("\n");
              shareWhatsApp(msg);
            }} className="btn btn-yellow btn-sm" style={{ marginTop: 8, color: "#000" }}>📤 بعت تهنئة واتساب</button>
          </div>
        ) : null;
      })()}

      {/* Upcoming events */}
      {upcomingEvents.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-title">🏆 الفعاليات القادمة</div>
          {upcomingEvents.map(e => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{e.type === "exam" ? "🎓 اختبار" : "🏆 بطولة"} · {e.date}</div>
              </div>
              <span className="badge badge-blue">{e.registrations?.length || 0} مسجل</span>
            </div>
          ))}
        </div>
      )}

      {/* إيرادات الشهر */}
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="section-title">💰 إيرادات الشهر</div>
          {(() => {
            const total = players.filter(p => checkSubStatus(payments[p.id]?.date).valid).reduce((sum, p) => {
              const st = SUB_TYPES.find(s => s.label === (playerDetails[p.id]?.subType));
              return sum + (st ? st.price : 300);
            }, 0);
            return (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>{total}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>جنيه</div>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {SUB_TYPES.map(st => {
                    const count = players.filter(p => checkSubStatus(payments[p.id]?.date).valid && playerDetails[p.id]?.subType === st.label).length;
                    return count > 0 ? (
                      <div key={st.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: st.color }}>{st.icon} {st.label}</span>
                        <span style={{ fontWeight: 700 }}>{count} × {st.price} = {count * st.price} جنيه</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </>
            );
          })()}
          <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 10 }} onClick={() => {
            const activeP = players.filter(p => checkSubStatus(payments[p.id]?.date).valid);
            const lines = [
              "💰 تقرير الإيرادات - نادي الطالبية",
              `📅 ${getToday()}`,
              "━━━━━━━━━━━━━━━",
              `المشتركين النشطين: ${activeP.length}`,
              `إجمالي الإيرادات: ${activeP.length * 300} جنيه`,
              "━━━━━━━━━━━━━━━",
              ...coaches.filter(c => !c.isAdmin).map(c => {
                const cp = players.filter(p => String(p.coachId) === String(c.id) && checkSubStatus(payments[p.id]?.date).valid);
                return `${c.name}: ${cp.length} مشترك`;
              })
            ].join("\n");
            shareWhatsApp(lines);
          }}>📤 شير على واتساب</button>
        </div>
        {/* لاعب الشهر - كل النادي */}
        {(() => {
          const star = getPlayerOfMonth(players, null, attendance, payments);
          const starAtt = star ? getDetailedAttendance(star.id, star.coachId, attendance) : null;
          const starCoach = star ? coaches.find(c => c.id === star.coachId) : null;
          const starPd = star ? (playerDetails[star.id] || {}) : {};
          return star ? (
            <div className="card" style={{ border: "1px solid var(--yellow)", background: "rgba(255,195,0,0.05)", textAlign: "center" }}>
              <div className="section-title" style={{ color: "var(--yellow)", justifyContent: "center" }}>🏆 لاعب الشهر</div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{star.name}</div>
              {starPd.belt && <BeltBadge belt={starPd.belt} />}
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{starCoach?.name}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8 }}>
                <div><div style={{ fontSize: 18, fontWeight: 900, color: "var(--accent)" }}>{starAtt.count}</div><div style={{ fontSize: 10, color: "var(--muted)" }}>يوم</div></div>
                <div><div style={{ fontSize: 18, fontWeight: 900, color: "var(--accent2)" }}>{starAtt.percentage}%</div><div style={{ fontSize: 10, color: "var(--muted)" }}>نسبة</div></div>
              </div>
            </div>
          ) : <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>لا يوجد بيانات حضور بعد</div>;
        })()}
      </div>

      {/* Expired subscriptions alert */}
      {expiredPlayers.length > 0 && (
        <div className="card" style={{ borderColor: "var(--red)", background: "rgba(255,69,96,0.05)" }}>
          <div className="section-title" style={{ color: "var(--red)" }}>⚠️ اشتراكات منتهية ({expiredPlayers.length})</div>
          {expiredPlayers.slice(0, 5).map(p => {
            const coach = coaches.find(c => c.id === p.coachId);
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span>{p.name}</span>
                <span style={{ color: "var(--muted)" }}>{coach?.name || "---"}</span>
              </div>
            );
          })}
          {expiredPlayers.length > 5 && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>و {expiredPlayers.length - 5} آخرين...</div>}
        </div>
      )}
    </div>
  );
}

// ─────────── Admin Reports ───────────
function AdminReports({ coaches, players, attendance, payments, playerDetails }) {
  const [search, setSearch] = useState("");

  const exportExcel = () => {
    if (!window.XLSX) return showToast("جاري تحميل مكتبة الإكسل...", "info");
    const data = players.map(p => {
      const coach = coaches.find(c => c.id === p.coachId);
      const sub = checkSubStatus(payments[p.id]?.date);
      const att = getDetailedAttendance(p.id, p.coachId, attendance);
      const pd = playerDetails[p.id] || {};
      return {
        "الاسم": p.name,
        "المدرب": coach?.name || "غير محدد",
        "الحزام": pd.belt || "---",
        "تاريخ الانضمام": pd.joinDate || "---",
        "الحالة": sub.msg,
        "عدد أيام الحضور": att.count,
        "نسبة الحضور": `${att.percentage}%`,
        "تاريخ آخر سداد": payments[p.id]?.date || "لم يسدد",
        "سداد القيد": pd.regFeePaid ? "مسدد" : "لم يسدد",
        "قيد الاختبار": pd.examRegistered ? "نعم" : "لا",
        "اسم الفعالية": pd.eventName || "---",
        "تاريخ الميلاد": pd.birthdate || "---",
        "تليفون ولي الأمر": pd.phone || "---",
        "الوزن": pd.weight || "---",
        "الطول": pd.height || "---",
        "التقييم": pd.rating ? `${pd.rating}/5` : "---",
      };
    });
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "التقرير العام");
    window.XLSX.writeFile(wb, `تقرير_نادي_الطلبية_${getToday()}.xlsx`);
    showToast("تم تصدير التقرير بنجاح ✅", "success");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={exportExcel} className="btn btn-blue" style={{ flex: 1 }}>📥 تصدير إكسل</button>
        <button onClick={() => {
          const activeP = players.filter(p => checkSubStatus(payments[p.id]?.date).valid);
          const expiredP = players.filter(p => !checkSubStatus(payments[p.id]?.date).valid);
          const lines = [
            "📊 تقرير نادي الطالبية",
            `📅 ${getToday()}`,
            "━━━━━━━━━━━━━━━",
            `👥 إجمالي اللاعبين: ${players.length}`,
            `✅ مشتركين نشطين: ${activeP.length}`,
            `❌ اشتراك منتهي: ${expiredP.length}`,
            "━━━━━━━━━━━━━━━",
            ...coaches.filter(c => !c.isAdmin).map(c => {
              const cp = players.filter(p => String(p.coachId) === String(c.id));
              const active = cp.filter(p => checkSubStatus(payments[p.id]?.date).valid).length;
              return `🥋 ${c.name}: ${cp.length} لاعب (${active} نشط)`;
            }),
            "━━━━━━━━━━━━━━━",
            `💰 الإيرادات: ${activeP.reduce((sum, p) => { const st = SUB_TYPES.find(s => s.label === (playerDetails[p.id]?.subType)); return sum + (st ? st.price : 300); }, 0)} جنيه`,
          ].join("\n");
          shareWhatsApp(lines);
        }} className="btn btn-primary" style={{ flex: 1 }}>📤 واتساب</button>
      </div>
      <input className="input-field" placeholder="🔍 بحث باسم اللاعب..." onChange={e => setSearch(e.target.value)} />

      {players.filter(p => p.name.includes(search)).map(p => {
        const att = getDetailedAttendance(p.id, p.coachId, attendance);
        const sub = checkSubStatus(payments[p.id]?.date);
        const coach = coaches.find(c => c.id === p.coachId);
        const pd = playerDetails[p.id] || {};

        return (
          <div key={p.id} className="player-row" style={{ borderRight: `4px solid ${sub.valid ? "var(--accent)" : "var(--red)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 16 }}>{p.name}</b>
                  {pd.belt && <BeltBadge belt={pd.belt} />}
                  <span className={`badge ${sub.valid ? "badge-green" : "badge-red"}`}>{sub.msg}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  المدرب: {coach?.name || "---"}
                  {pd.joinDate && <span> · انضم: {pd.joinDate}</span>}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>حضور: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{att.count} يوم</span></span>
                  {payments[p.id]?.date && <span>💰 آخر دفع: <span style={{ color: "var(--yellow)" }}>{payments[p.id].date}</span></span>}
                  {pd.examRegistered && <span className="badge badge-yellow">🎓 مسجل بفعالية</span>}
                  <span className={`badge ${pd.regFeePaid ? "badge-green" : "badge-red"}`}>🏷 القيد: {pd.regFeePaid ? "مسدد" : "لم يسدد"}</span>
                </div>
                {pd.eventName && <div style={{ fontSize: 11, color: "var(--accent2)", marginTop: 2 }}>🏆 {pd.eventName}</div>}
              </div>
              <div style={{ textAlign: "center", marginRight: 8 }}>
                <DonutChart value={att.percentage} max={100} color={att.percentage >= 75 ? "var(--accent)" : att.percentage >= 50 ? "var(--yellow)" : "var(--red)"} size={52} />
              </div>
            </div>
            <div className="progress-bar" style={{ width: `${att.percentage}%` }} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────── Admin Coaches ───────────
function AdminCoaches({ coaches, setCoaches }) {
  const [n, setN] = useState(""); const [t, setT] = useState(""); const [u, setU] = useState(""); const [p, setP] = useState("");
  const [confirm, setConfirm] = useState(null);

  const add = () => {
    if (n && t && u && p) {
      setCoaches([...coaches, { id: Date.now(), name: n, team: t, username: u, password: p, isAdmin: false }]);
      setN(""); setT(""); setU(""); setP("");
      showToast(`تم إضافة المدرب ${n} بنجاح`, "success");
    } else showToast("يرجى ملء جميع الحقول", "error");
  };
  const update = (id, field, val) => setCoaches(coaches.map(c => c.id === id ? { ...c, [field]: val } : c));

  return (
    <div>
      <ConfirmModal open={!!confirm} msg={confirm?.msg} onConfirm={() => { confirm?.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 15 }}>➕ إضافة مدرب جديد</div>
        <div className="grid-2">
          <input className="input-field" placeholder="الاسم الكامل" value={n} onChange={e => setN(e.target.value)} />
          <input className="input-field" placeholder="اسم الفرقة" value={t} onChange={e => setT(e.target.value)} />
          <input className="input-field" placeholder="اسم المستخدم" value={u} onChange={e => setU(e.target.value)} />
          <input className="input-field" placeholder="كلمة المرور" value={p} onChange={e => setP(e.target.value)} />
        </div>
        <button onClick={add} className="btn btn-blue btn-full">➕ إضافة مدرب</button>
      </div>

      {coaches.filter(c => !c.isAdmin).map(c => (
        <div key={c.id} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 800 }}>🏅 {c.name}</span>
            <button onClick={() => setConfirm({ msg: `هل تريد حذف المدرب "${c.name}"؟`, fn: () => { setCoaches(coaches.filter(x => x.id !== c.id)); showToast(`تم حذف المدرب ${c.name}`, "info"); } })} className="btn btn-red btn-sm">🗑 حذف</button>
          </div>
          <input className="input-field" value={c.name} onChange={e => update(c.id, "name", e.target.value)} placeholder="الاسم" />
          <div className="grid-2">
            <input className="input-field" value={c.team || ""} onChange={e => update(c.id, "team", e.target.value)} placeholder="الفرقة" />
            <input className="input-field" value={c.password} onChange={e => update(c.id, "password", e.target.value)} placeholder="الباسورد" />
          </div>
          <button onClick={() => showToast(`تم حفظ بيانات ${c.name}`, "success")} className="btn btn-ghost btn-sm btn-full">💾 حفظ التغييرات</button>
        </div>
      ))}
    </div>
  );
}

// ─────────── Admin Players ───────────
function AdminPlayers({ coaches, players, setPlayers, playerDetails, setPlayerDetails }) {
  const [n, setN] = useState(""); const [cId, setCId] = useState(""); const [belt, setBelt] = useState("أبيض"); const [joinDate, setJoinDate] = useState(getToday()); const [subType, setSubType] = useState("غير عضو");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [editId, setEditId] = useState(null);

  const add = () => {
    if (n && cId) {
      const newId = Date.now();
      setPlayers([...players, { id: newId, name: n, coachId: Number(cId) }]);
      setPlayerDetails({ ...playerDetails, [newId]: { belt, joinDate, regFeePaid: false, subType: "غير عضو" } });
      showToast(`تم إضافة اللاعب ${n} بنجاح 🎉`, "success");
      setN(""); setCId(""); setBelt("أبيض"); setJoinDate(getToday());
    } else showToast("يرجى ملء الاسم واختيار المدرب", "error");
  };

  const filtered = players.filter(p => p.name.includes(search));

  return (
    <div>
      <ConfirmModal open={!!confirm} msg={confirm?.msg} onConfirm={() => { confirm?.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 15 }}>➕ إضافة لاعب جديد</div>
        <input className="input-field" placeholder="اسم اللاعب" value={n} onChange={e => setN(e.target.value)} />
        <select className="input-field" value={cId} onChange={e => setCId(e.target.value)}>
          <option value="">اختر المدرب</option>
          {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "block" }}>الحزام</label>
            <select className="input-field" value={belt} onChange={e => setBelt(e.target.value)}>
              {BELTS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "block" }}>تاريخ الانضمام</label>
            <input type="date" className="input-field" value={joinDate} onChange={e => setJoinDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, display: "block" }}>نوع الاشتراك</label>
          <select className="input-field" value={subType} onChange={e => setSubType(e.target.value)}>
            {SUB_TYPES.map(s => <option key={s.label} value={s.label}>{s.icon} {s.label} - {s.price} جنيه</option>)}
          </select>
        </div>
        <button onClick={add} className="btn btn-primary btn-full">➕ إضافة اللاعب</button>
      </div>

      <input className="input-field" placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.map(p => {
        const coach = coaches.find(c => c.id === p.coachId);
        const pd = playerDetails[p.id] || {};
        const isEdit = editId === p.id;

        return (
          <div key={p.id} className="player-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b>{p.name}</b>
                  {pd.belt && <BeltBadge belt={pd.belt} />}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span>{coach?.name || "---"}</span>
                  {pd.joinDate && <span>· انضم: {pd.joinDate}</span>}
                  {pd.subType && (() => { const st = SUB_TYPES.find(s => s.label === pd.subType); return st ? <span style={{ color: st.color, fontWeight: 700, fontSize: 11 }}>{st.icon} {st.price} جنيه</span> : null; })()}
                  <span className={`badge ${pd.regFeePaid ? "badge-green" : "badge-red"}`} style={{ fontSize: 10 }}>🏷 {pd.regFeePaid ? "قيد مسدد" : "قيد غير مسدد"}</span>
                  {pd.birthdate && (() => { const bd = new Date(pd.birthdate); const today = new Date(); const isToday = bd.getDate() === today.getDate() && bd.getMonth() === today.getMonth(); const age = today.getFullYear() - bd.getFullYear(); return <span style={{ fontSize: 10, color: isToday ? "var(--yellow)" : "var(--muted)" }}>{isToday ? "🎂 عيد ميلاده النهارده!" : `${age} سنة`}</span>; })()}
                  {pd.phone && <a href={`tel:${pd.phone}`} style={{ fontSize: 10, color: "var(--accent2)" }}>📞 {pd.phone}</a>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditId(isEdit ? null : p.id)} className="btn btn-ghost btn-xs">✏️</button>
                <button onClick={() => setConfirm({ msg: `حذف اللاعب "${p.name}"؟`, fn: () => { setPlayers(players.filter(x => x.id !== p.id)); showToast(`تم حذف اللاعب ${p.name}`, "info"); } })} className="btn btn-red btn-xs">🗑</button>
              </div>
            </div>
            {isEdit && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div className="grid-2">
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>الحزام</label>
                    <select className="input-field" value={pd.belt || "أبيض"} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, belt: e.target.value } })}>
                      {BELTS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>تاريخ الانضمام</label>
                    <input type="date" className="input-field" value={pd.joinDate || ""} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, joinDate: e.target.value } })} />
                  </div>
                </div>
                {/* سداد القيد الموسمي */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface2)", borderRadius: 12, padding: "10px 14px", marginBottom: 10, border: `1px solid ${pd.regFeePaid ? "var(--accent)" : "var(--border)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className={`checkbox-custom ${pd.regFeePaid ? "checked" : ""}`}
                      onClick={() => {
                        setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, regFeePaid: !pd.regFeePaid } });
                        showToast(!pd.regFeePaid ? `تم تسجيل سداد قيد ${p.name} ✅` : `تم إلغاء سداد قيد ${p.name}`, !pd.regFeePaid ? "success" : "info");
                      }}>
                      {pd.regFeePaid && <span style={{ color: "white", fontSize: 13 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>سداد القيد</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>رسوم القيد الموسمي</div>
                    </div>
                  </div>
                  <span className={`badge ${pd.regFeePaid ? "badge-green" : "badge-red"}`}>
                    {pd.regFeePaid ? "مسدد ✅" : "لم يسدد"}
                  </span>
                </div>
                {/* نوع الاشتراك */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>نوع الاشتراك</label>
                  <select className="input-field" value={pd.subType || "غير عضو"} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, subType: e.target.value } })}>
                    {SUB_TYPES.map(s => <option key={s.label} value={s.label}>{s.icon} {s.label} - {s.price} جنيه</option>)}
                  </select>
                </div>
                {/* تاريخ الميلاد */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>🎂 تاريخ الميلاد</label>
                  <input type="date" className="input-field" value={pd.birthdate || ""} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, birthdate: e.target.value } })} />
                </div>
                {/* تليفون ولي الأمر */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📞 تليفون ولي الأمر</label>
                  <input className="input-field" placeholder="01xxxxxxxxx" value={pd.phone || ""} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, phone: e.target.value } })} />
                </div>
                {/* قياسات */}
                <div className="grid-2">
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>⚖️ الوزن (كجم)</label>
                    <input type="number" className="input-field" placeholder="65" value={pd.weight || ""} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, weight: e.target.value } })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📏 الطول (سم)</label>
                    <input type="number" className="input-field" placeholder="170" value={pd.height || ""} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, height: e.target.value } })} />
                  </div>
                </div>
                <button onClick={() => { setEditId(null); showToast(`تم حفظ بيانات ${p.name}`, "success"); }} className="btn btn-primary btn-sm btn-full">💾 حفظ</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────── Admin Payments ───────────
function AdminPayments({ players, payments, setPayments }) {
  const [d, setD] = useState(getToday());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = players.filter(p => {
    const nameMatch = p.name.includes(search);
    if (filter === "paid") return nameMatch && payments[p.id]?.paid;
    if (filter === "unpaid") return nameMatch && !payments[p.id]?.paid;
    return nameMatch;
  });

  return (
    <div>
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>تاريخ الدفع</label>
          <input type="date" className="input-field" style={{ marginBottom: 0 }} value={d} onChange={e => setD(e.target.value)} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>{players.filter(p => payments[p.id]?.paid).length}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>مسددين</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all", "الكل"], ["paid", "مسددين ✅"], ["unpaid", "غير مسددين ❌"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      <input className="input-field" placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.map(p => (
        <div key={p.id} className="player-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            {payments[p.id]?.date && <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 2 }}>📅 {payments[p.id].date}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge ${payments[p.id]?.paid ? "badge-green" : "badge-red"}`}>
              {payments[p.id]?.paid ? "مسدد ✅" : "غير مسدد"}
            </span>
            <button onClick={() => {
              const cur = payments[p.id]?.paid;
              setPayments({ ...payments, [p.id]: { paid: !cur, date: !cur ? d : null } });
              showToast(!cur ? `تم تسجيل دفع ${p.name} ✅` : `تم إلغاء دفع ${p.name}`, !cur ? "success" : "info");
            }} className={`btn btn-sm ${payments[p.id]?.paid ? "btn-ghost" : "btn-primary"}`}>
              {payments[p.id]?.paid ? "إلغاء" : "تسجيل دفع"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────── Admin Events ───────────
function AdminEvents({ events, setEvents, players, playerDetails, setPlayerDetails }) {
  const [name, setName] = useState(""); const [date, setDate] = useState(getToday()); const [type, setType] = useState("exam");
  const [confirm, setConfirm] = useState(null);

  const add = () => {
    if (name && date) {
      const newEv = { id: Date.now(), name, date, type, registrations: [] };
      setEvents([...events, newEv]);
      showToast(`تم إضافة "${name}" بنجاح 🏆`, "success");
      setName(""); setDate(getToday());
    } else showToast("يرجى ملء اسم وتاريخ الفعالية", "error");
  };

  return (
    <div>
      <ConfirmModal open={!!confirm} msg={confirm?.msg} onConfirm={() => { confirm?.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 15 }}>➕ إضافة فعالية / اختبار</div>
        <input className="input-field" placeholder="اسم الفعالية أو الاختبار" value={name} onChange={e => setName(e.target.value)} />
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>النوع</label>
            <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
              <option value="exam">🎓 اختبار</option>
              <option value="tournament">🏆 بطولة</option>
              <option value="event">🎯 فعالية</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>التاريخ</label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <button onClick={add} className="btn btn-yellow btn-full">➕ إضافة</button>
      </div>

      {events.sort((a, b) => b.date.localeCompare(a.date)).map(ev => {
        const registeredPlayers = players.filter(p => playerDetails[p.id]?.examRegistered && playerDetails[p.id]?.eventName === ev.name);
        return (
          <div key={ev.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {ev.type === "exam" ? "🎓" : ev.type === "tournament" ? "🏆" : "🎯"} {ev.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>📅 {ev.date}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="badge badge-blue">{registeredPlayers.length} مسجل</span>
                <button onClick={() => setConfirm({ msg: `حذف "${ev.name}"؟`, fn: () => { setEvents(events.filter(e => e.id !== ev.id)); showToast("تم حذف الفعالية", "info"); } })} className="btn btn-red btn-xs">🗑</button>
              </div>
            </div>
            {registeredPlayers.length > 0 && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>المسجلون:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {registeredPlayers.map(p => {
                    const pd = playerDetails[p.id] || {};
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 13, background: "var(--surface2)", padding: "3px 10px", borderRadius: 8 }}>{p.name}</span>
                        {pd.feePaid && <span className="badge badge-green" style={{ fontSize: 10 }}>✅ مسدد قيد</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─────────── Admin Alerts ───────────
function AdminAlerts({ players, attendance, payments, coaches, playerDetails }) {
  const alerts = getSmartAlerts(players, attendance, payments, coaches, playerDetails);
  return (
    <div>
      <div className="section-title">🔔 التنبيهات الذكية</div>
      {alerts.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--accent)", padding: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700 }}>كل حاجة تمام! مفيش تنبيهات</div>
        </div>
      )}
      {alerts.map((a, i) => (
        <div key={i} className="card" style={{ borderRight: `4px solid ${a.color}`, borderColor: a.color }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 }}>{a.icon}</span>
            <div>
              <div style={{ fontWeight: 700, color: a.color }}>{a.msg}</div>
              {a.coach && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>المدرب: {a.coach}</div>}
            </div>
          </div>
        </div>
      ))}

      {/* إحصائيات متقدمة */}
      <div className="section-title" style={{ marginTop: 16 }}>📊 إحصائيات الشهر</div>
      <div className="grid-2">
        {/* أكتر لاعب غياباً */}
        {(() => {
          const worst = players.length ? players.reduce((w, p) => {
            const att = getDetailedAttendance(p.id, p.coachId, attendance);
            const wAtt = getDetailedAttendance(w.id, w.coachId, attendance);
            return att.count < wAtt.count ? p : w;
          }) : null;
          const worstAtt = worst ? getDetailedAttendance(worst.id, worst.coachId, attendance) : null;
          return worst ? (
            <div className="card" style={{ textAlign: "center", borderColor: "var(--red)" }}>
              <div style={{ fontSize: 11, color: "var(--red)", fontWeight: 800, marginBottom: 6 }}>🔴 أكتر غياباً</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{worst.name}</div>
              <div style={{ color: "var(--red)", fontWeight: 700, fontSize: 20, marginTop: 4 }}>{worstAtt.count} يوم</div>
            </div>
          ) : null;
        })()}
        {/* أكتر التزاماً */}
        {(() => {
          const best = players.length ? players.reduce((b, p) => {
            const att = getDetailedAttendance(p.id, p.coachId, attendance);
            const bAtt = getDetailedAttendance(b.id, b.coachId, attendance);
            return att.count > bAtt.count ? p : b;
          }) : null;
          const bestAtt = best ? getDetailedAttendance(best.id, best.coachId, attendance) : null;
          return best ? (
            <div className="card" style={{ textAlign: "center", borderColor: "var(--accent)" }}>
              <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 800, marginBottom: 6 }}>🏆 الأكثر التزاماً</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{best.name}</div>
              <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 20, marginTop: 4 }}>{bestAtt.count} يوم</div>
            </div>
          ) : null;
        })()}
      </div>

      {/* مقارنة المدربين */}
      <div className="section-title">🥋 مقارنة المدربين</div>
      {coaches.filter(c => !c.isAdmin).map(c => {
        const myP = players.filter(p => String(p.coachId) === String(c.id));
        const totalAtt = myP.reduce((s, p) => s + getDetailedAttendance(p.id, c.id, attendance).count, 0);
        const avgAtt = myP.length ? Math.round(totalAtt / myP.length) : 0;
        const active = myP.filter(p => checkSubStatus(payments[p.id]?.date).valid).length;
        return (
          <div key={c.id} className="player-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>🥋 {c.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {myP.length} لاعب · {active} نشط · متوسط حضور: {avgAtt} يوم
                </div>
              </div>
              <DonutChart value={avgAtt} max={12} color="var(--accent2)" size={50} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────── Admin Logs ───────────
function AdminLogs({ logs, setLogs }) {
  const [confirm, setConfirm] = useState(null);
  return (
    <div>
      <ConfirmModal open={!!confirm} msg={confirm?.msg} onConfirm={() => { confirm?.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>📋 سجل العمليات</div>
        <button onClick={() => setConfirm({ msg: "مسح سجل العمليات كله؟", fn: () => { setLogs([]); showToast("تم مسح السجل", "info"); } })} className="btn btn-red btn-sm">🗑 مسح الكل</button>
      </div>
      {logs.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>لا يوجد عمليات مسجلة بعد</div>}
      {logs.map((l, i) => (
        <div key={l.id || i} className="player-row" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{l.action}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>👤 {l.user} · 🕐 {l.time}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────── Admin Reset ───────────
function AdminReset({ attendance, setAttendance, payments, setPayments, logs, setLogs, players, coaches }) {
  const [confirm, setConfirm] = useState(null);

  const logAction = (action) => {
    const entry = { id: Date.now(), action, user: "الأدمن", time: new Date().toLocaleString("ar-EG") };
    const updated = [entry, ...logs].slice(0, 50);
    setLogs(updated);
  };

  return (
    <div>
      <ConfirmModal open={!!confirm} msg={confirm?.msg} onConfirm={() => { confirm?.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />

      <div className="card" style={{ borderColor: "var(--red)", background: "rgba(255,69,96,0.05)" }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: "var(--red)" }}>⚠️ منطقة إعادة التعيين</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>تأكد قبل أي عملية — لا يمكن التراجع!</div>

        {/* إعادة عداد الحضور */}
        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🔄 إعادة عداد الحضور الشهري</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>بيمسح كل سجلات الحضور ويبدأ من الصفر للشهر الجديد</div>
          <button onClick={() => setConfirm({
            msg: "هتمسح كل سجلات الحضور! متأكد؟",
            fn: () => {
              setAttendance({});
              logAction(`تم إعادة تعيين عداد الحضور الشهري — ${Object.keys(attendance).length} سجل اتمسح`);
              showToast("تم إعادة تعيين الحضور ✅", "success");
            }
          })} className="btn btn-red btn-full">🔄 إعادة تعيين الحضور</button>
        </div>

        {/* إعادة سجلات الدفع */}
        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>💳 إعادة سجلات الدفع الشهرية</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>بيمسح حالة الدفع لكل اللاعبين للشهر الجديد</div>
          <button onClick={() => setConfirm({
            msg: "هتمسح كل سجلات الدفع! متأكد؟",
            fn: () => {
              setPayments({});
              logAction(`تم إعادة تعيين سجلات الدفع — ${players.length} لاعب`);
              showToast("تم إعادة تعيين الدفع ✅", "success");
            }
          })} className="btn btn-red btn-full">🔄 إعادة تعيين الدفع</button>
        </div>

        {/* إعادة الاتنين مع بعض */}
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🔄 إعادة تعيين شهر جديد (الكل)</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>بيمسح الحضور والدفع مع بعض — لبداية شهر جديد</div>
          <button onClick={() => setConfirm({
            msg: "هتبدأ شهر جديد وتمسح الحضور والدفع كلهم! متأكد؟",
            fn: () => {
              setAttendance({});
              setPayments({});
              logAction(`تم بدء شهر جديد — مسح الحضور والدفع لـ ${players.length} لاعب`);
              showToast("🎉 تم بدء الشهر الجديد بنجاح!", "success");
            }
          })} className="btn btn-yellow btn-full" style={{ color: "#000" }}>🌟 بدء شهر جديد</button>
        </div>
      </div>
    </div>
  );
}


// ─────────── Leaderboard ───────────
function AdminLeaderboard({ players, coaches, attendance, payments, playerDetails }) {
  const [filter, setFilter] = useState("all");
  
  const ranked = players
    .map(p => {
      const att = getDetailedAttendance(p.id, p.coachId, attendance);
      const coach = coaches.find(c => c.id === p.coachId);
      const pd = playerDetails[p.id] || {};
      const badges = getPlayerBadges(p.id, p.coachId, attendance);
      const sub = checkSubStatus(payments[p.id]?.date);
      return { ...p, att, coach, pd, badges, sub };
    })
    .filter(p => filter === "all" || String(p.coachId) === filter)
    .sort((a, b) => b.att.count - a.att.count);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <div className="section-title">🏅 ترتيب اللاعبين</div>
      <select className="input-field" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">كل اللاعبين</option>
        {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
      </select>

      {ranked.map((p, i) => (
        <div key={p.id} className="player-row" style={{ borderRight: `4px solid ${i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "var(--border)"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: i < 3 ? "#FFD700" : "var(--muted)", minWidth: 32 }}>
                {medals[i] || `#${i + 1}`}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 15 }}>{p.name}</b>
                  {p.pd.belt && <BeltBadge belt={p.pd.belt} />}
                  {p.badges.map(b => (
                    <span key={b.id} style={{ fontSize: 10, background: b.color + "22", color: b.color, border: `1px solid ${b.color}44`, borderRadius: 6, padding: "2px 6px", fontWeight: 800 }}>{b.icon} {b.label}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.coach?.name || "---"}</div>
              </div>
            </div>
            <DonutChart value={p.att.count} max={12} color={i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "var(--accent2)"} size={52} label="يوم" />
          </div>
          <div className="progress-bar" style={{ width: `${p.att.percentage}%` }} />
        </div>
      ))}
    </div>
  );
}

// ─────────── Admin Settings ───────────
function AdminSettings({ trainingSettings, setTrainingSettings, coaches }) {
  const [localSettings, setLocalSettings] = useState(trainingSettings);

  return (
    <div>
      <div className="section-title">⚙️ إعدادات النادي</div>
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12 }}>⏰ وقت التدريب</div>
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>ساعة البداية</label>
            <select className="input-field" value={localSettings.startHour} onChange={e => setLocalSettings({ ...localSettings, startHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>المدة (دقيقة)</label>
            <select className="input-field" value={localSettings.duration} onChange={e => setLocalSettings({ ...localSettings, duration: Number(e.target.value) })}>
              {[60, 90, 120, 150, 180].map(d => <option key={d} value={d}>{d} دقيقة</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => { setTrainingSettings(localSettings); showToast("تم حفظ إعدادات التدريب ✅", "success"); }} className="btn btn-primary btn-full">💾 حفظ الإعدادات</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════ COACH VIEW ═══════════════════════
function CoachView({ coach, players, setPlayers, attendance, setAttendance, payments, notes, setNotes, playerDetails, setPlayerDetails, events, logs, setLogs, playerExtra, setPlayerExtra, trainingSettings }) {
  const [tab, setTab] = useState("today");
  const [newName, setNewName] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [absenceNotes, setAbsenceNotes] = useState({});
  const myPlayers = players.filter(p => String(p.coachId) === String(coach.id));

  const logAction = (action) => {
    const entry = { id: Date.now(), action, user: coach.name, time: new Date().toLocaleString("ar-EG") };
    const updated = [entry, ...(logs||[])].slice(0, 50);
    setLogs(updated);
  };

  const totalAtt = myPlayers.reduce((s, p) => s + getDetailedAttendance(p.id, coach.id, attendance).count, 0);
  const avgAtt = myPlayers.length ? Math.round(totalAtt / myPlayers.length) : 0;
  const activeSubs = myPlayers.filter(p => checkSubStatus(payments[p.id]?.date).valid).length;

  return (
    <div>
      {/* تذكير موعد التدريب */}
      {(() => {
        const now = new Date();
        const hour = now.getHours();
        const startH = trainingSettings?.startHour || 17;
        const endH = startH + Math.floor((trainingSettings?.duration || 90) / 60);
        const isTrainingTime = hour >= startH - 1 && hour <= endH;
        if (!isTrainingTime) return null;
        return (
          <div className="card" style={{ borderColor: "var(--accent)", background: "rgba(0,212,170,0.05)", marginBottom: 10, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>⏰</div>
            <div style={{ fontWeight: 800, color: "var(--accent)", fontSize: 15 }}>
              {hour < startH ? `التدريب بعد ساعة! (${startH}:00)` : "وقت التدريب دلوقتي! 💪"}
            </div>
          </div>
        );
      })()}

      {/* تنبيه اشتراكات منتهية */}
      {myPlayers.filter(p => !checkSubStatus(payments[p.id]?.date).valid).length > 0 && (
        <div className="card" style={{ borderColor: "var(--red)", background: "rgba(255,69,96,0.05)", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, color: "var(--red)", marginBottom: 6, fontSize: 13 }}>
            ⚠️ اشتراكات منتهية ({myPlayers.filter(p => !checkSubStatus(payments[p.id]?.date).valid).length} لاعبين)
          </div>
          {myPlayers.filter(p => !checkSubStatus(payments[p.id]?.date).valid).map(p => (
            <div key={p.id} style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span>{p.name}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>منتهي</span>
            </div>
          ))}
        </div>
      )}
      {/* Coach stats */}
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="stat-card" style={{ "--accent-line": "linear-gradient(90deg, var(--accent2), transparent)" }}>
          <div style={{ fontSize: 18 }}>👥</div>
          <div className="stat-value" style={{ color: "var(--accent2)", fontSize: 20 }}>{myPlayers.length}</div>
          <div className="stat-label">لاعبيني</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": "linear-gradient(90deg, var(--accent), transparent)" }}>
          <div style={{ fontSize: 18 }}>✅</div>
          <div className="stat-value" style={{ color: "var(--accent)", fontSize: 20 }}>{activeSubs}</div>
          <div className="stat-label">نشطين</div>
        </div>
        <div className="stat-card" style={{ "--accent-line": "linear-gradient(90deg, var(--yellow), transparent)" }}>
          <div style={{ fontSize: 18 }}>📊</div>
          <div className="stat-value" style={{ color: "var(--yellow)", fontSize: 20 }}>{avgAtt}</div>
          <div className="stat-label">متوسط الحضور</div>
        </div>
      </div>

      <div className="card" style={{ border: "1px dashed var(--border2)", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>➕ إضافة لاعب جديد</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input-field" style={{ marginBottom: 0 }} placeholder="اسم اللاعب" value={newName} onChange={e => setNewName(e.target.value)} />
          <button onClick={() => {
            if (newName) {
              setPlayers([...players, { id: Date.now(), name: newName, coachId: Number(coach.id) }]);
              showToast(`تم إضافة ${newName} لفريقك 🎉`, "success");
              setNewName("");
            }
          }} className="btn btn-primary btn-sm">إضافة</button>
        </div>
      </div>

      <div className="tab-bar">
        {[["today", "📋 تحضير"], ["reports", "📊 تقارير"], ["notes", "📝 ملاحظات"], ["events", "🏆 فعاليات"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab-item ${tab === k ? "active" : ""}`}>{l}</button>
        ))}
      </div>

      {tab === "today" && (
        <div>
          {/* اختيار التاريخ */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <input type="date" className="input-field" style={{ marginBottom: 0, flex: 1 }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} max={getToday()} />
            <button onClick={() => setSelectedDate(getToday())} className="btn btn-ghost btn-sm">اليوم</button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>📅 {selectedDate}</div>
            <div style={{ fontSize: 13 }}>
              حضر: <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                {myPlayers.filter(p => attendance[`${coach.id}_${selectedDate}`]?.[p.id] === "present").length}
              </span> / {myPlayers.length}
            </div>
          </div>
          {/* أزرار تحضير سريع */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => {
              const key = `${coach.id}_${selectedDate}`;
              const allPresent = {};
              myPlayers.forEach(p => { allPresent[p.id] = "present"; });
              setAttendance({ ...attendance, [key]: allPresent });
              logAction(`تم تحضير كل اللاعبين (${myPlayers.length} لاعب) - ${selectedDate}`);
              showToast("تم تحضير كل اللاعبين ✅", "success");
            }}>✅ حضور الكل</button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => {
              const key = `${coach.id}_${selectedDate}`;
              const allAbsent = {};
              myPlayers.forEach(p => { allAbsent[p.id] = "absent"; });
              setAttendance({ ...attendance, [key]: allAbsent });
              showToast("تم تغيير الكل لغائب", "info");
            }}>❌ غياب الكل</button>
            <button className="btn btn-blue btn-sm" style={{ flex: 1 }} onClick={() => {
              const key = `${coach.id}_${selectedDate}`;
              const todayAtt = attendance[key] || {};
              const presentCount = myPlayers.filter(p => todayAtt[p.id] === "present").length;
              const lines = [
                `📋 تقرير حضور ${coach.name}`,
                `📅 ${selectedDate}`,
                `━━━━━━━━━━━━━━━`,
                ...myPlayers.map(p => `${todayAtt[p.id] === "present" ? "✅" : "❌"} ${p.name}`),
                `━━━━━━━━━━━━━━━`,
                `الحضور: ${presentCount} / ${myPlayers.length}`,
              ].join("\n");
              shareWhatsApp(lines);
            }}>📤 واتساب</button>
          </div>
          {myPlayers.map(p => {
            const sub = checkSubStatus(payments[p.id]?.date);
            const isP = attendance[`${coach.id}_${selectedDate}`]?.[p.id] === "present";
            const pd = playerDetails[p.id] || {};
            return (
              <div key={p.id} className="player-row" style={{ opacity: sub.valid ? 1 : 0.7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <b>{p.name}</b>
                      {pd.belt && <BeltBadge belt={pd.belt} />}
                      {pd.birthdate && (() => { const d = new Date(pd.birthdate); const t = new Date(); return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth() ? <span style={{fontSize:12}}>🎂</span> : null; })()}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: sub.valid ? "var(--accent)" : "var(--red)" }}>{sub.msg}</span>
                      {pd.phone && <a href={`https://wa.me/2${pd.phone}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#25D366", textDecoration: "none" }}>📱 واتساب</a>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <button onClick={() => {
                      const key = `${coach.id}_${selectedDate}`;
                      const wasP = attendance[key]?.[p.id] === "present";
                      setAttendance({ ...attendance, [key]: { ...attendance[key], [p.id]: wasP ? "absent" : "present" } });
                      if (!wasP) {
                        showToast(`تم تسجيل حضور ${p.name} ✅`, "success");
                        logAction(`حضور: ${p.name} - ${selectedDate}`);
                      }
                    }} className={`att-btn ${isP ? "att-btn-present" : ""}`}>
                      {isP ? "حاضر ✅" : "غائب ❌"}
                    </button>
                    {!isP && (
                      <input
                        placeholder="سبب الغياب..."
                        style={{ fontSize: 11, padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--muted)", width: 120 }}
                        value={absenceNotes[`${p.id}_${selectedDate}`] || ""}
                        onChange={e => setAbsenceNotes({ ...absenceNotes, [`${p.id}_${selectedDate}`]: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "reports" && (() => {
        const star = getPlayerOfMonth(myPlayers, coach.id, attendance, payments);
        const starAtt = star ? getDetailedAttendance(star.id, coach.id, attendance) : null;
        const starPd = star ? (playerDetails[star.id] || {}) : {};
        return star ? (
          <div className="card" style={{ marginBottom: 14, border: "1px solid var(--yellow)", background: "rgba(255,195,0,0.05)", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--yellow)", fontWeight: 800, letterSpacing: 2, marginBottom: 8 }}>🏆 لاعب الشهر</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{star.name}</div>
            {starPd.belt && <BeltBadge belt={starPd.belt} />}
            <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 16 }}>
              <div><div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>{starAtt.count}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>يوم حضور</div></div>
              <div><div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent2)" }}>{starAtt.percentage}%</div><div style={{ fontSize: 11, color: "var(--muted)" }}>نسبة</div></div>
            </div>
          </div>
        ) : null;
      })()}
      {tab === "reports" && myPlayers.map(p => {
        const att = getDetailedAttendance(p.id, coach.id, attendance);
        const sub = checkSubStatus(payments[p.id]?.date);
        const pd = playerDetails[p.id] || {};
        const badges = getPlayerBadges(p.id, coach.id, attendance);
        const today = new Date();
        const isBirthday = pd.birthdate && (() => { const d = new Date(pd.birthdate); return d.getDate() === today.getDate() && d.getMonth() === today.getMonth(); })();
        return (
          <div key={p.id} className="player-row" style={{ borderRight: `4px solid ${sub.valid ? "var(--accent)" : "var(--red)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b>{p.name}</b>
                  {pd.belt && <BeltBadge belt={pd.belt} />}
                  {isBirthday && <span style={{ fontSize: 11, color: "var(--yellow)", fontWeight: 800 }}>🎂 عيد ميلاده!</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  حضور: <b style={{ color: "var(--accent)" }}>{att.count}</b> يوم · {sub.msg}
                  {pd.weight && pd.height && <span> · {pd.weight}كجم / {pd.height}سم</span>}
                </div>
                {payments[p.id]?.date && <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 2 }}>💰 آخر دفع: {payments[p.id].date}</div>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {pd.examRegistered && <span className="badge badge-yellow">🎓 {pd.eventName || "مسجل بفعالية"}</span>}
                  <span className={`badge ${pd.regFeePaid ? "badge-green" : "badge-red"}`}>🏷 القيد: {pd.regFeePaid ? "مسدد" : "لم يسدد"}</span>
                  {badges.map(b => <span key={b.id} style={{ fontSize: 10, background: b.color + "22", color: b.color, border: `1px solid ${b.color}44`, borderRadius: 6, padding: "2px 6px", fontWeight: 800 }}>{b.icon}</span>)}
                  {pd.phone && <a href={`tel:${pd.phone}`} style={{ fontSize: 10, color: "var(--accent2)" }}>📞</a>}
                </div>
                {/* تقييم المدرب */}
                <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>تقييم:</span>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} onClick={() => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, rating: star } })}
                      style={{ fontSize: 18, cursor: "pointer", color: star <= (pd.rating || 0) ? "var(--yellow)" : "var(--border2)" }}>★</span>
                  ))}
                </div>
              </div>
              <DonutChart value={att.percentage} max={100} color={att.percentage >= 75 ? "var(--accent)" : att.percentage >= 50 ? "var(--yellow)" : "var(--red)"} size={54} />
            </div>
            <div className="progress-bar" style={{ width: `${att.percentage}%` }} />
          </div>
        );
      })}

      {tab === "notes" && myPlayers.map(p => (
        <div key={p.id} className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📝 {p.name}</div>
          <textarea className="input-field" style={{ marginBottom: 0, height: 70, resize: "none" }}
            value={notes[p.id] || ""}
            onChange={e => setNotes({ ...notes, [p.id]: e.target.value })}
            onBlur={() => showToast(`تم حفظ ملاحظات ${p.name}`, "success")}
            placeholder="اكتب ملاحظاتك هنا..." />
        </div>
      ))}

      {tab === "events" && (
        <CoachEvents myPlayers={myPlayers} events={events} playerDetails={playerDetails} setPlayerDetails={setPlayerDetails} />
      )}
    </div>
  );
}

// ─────────── Coach Events Tab ───────────
function CoachEvents({ myPlayers, events, playerDetails, setPlayerDetails }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <div>
      <div className="section-title">🏆 الفعاليات والاختبارات القادمة</div>
      {events.length === 0 && <div style={{ color: "var(--muted)", textAlign: "center", padding: 30, fontSize: 14 }}>لا توجد فعاليات مضافة حتى الآن</div>}

      {events.sort((a, b) => a.date.localeCompare(b.date)).map(ev => {
        const isSelected = selectedEvent === ev.id;
        return (
          <div key={ev.id} className="card" style={{ borderColor: isSelected ? "var(--yellow)" : "var(--border)" }}>
            <div onClick={() => setSelectedEvent(isSelected ? null : ev.id)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {ev.type === "exam" ? "🎓" : ev.type === "tournament" ? "🏆" : "🎯"} {ev.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>📅 {ev.date}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="badge badge-yellow">{myPlayers.filter(p => playerDetails[p.id]?.examRegistered && playerDetails[p.id]?.eventName === ev.name).length} مسجل</span>
                <span style={{ color: "var(--muted)", fontSize: 18 }}>{isSelected ? "▲" : "▼"}</span>
              </div>
            </div>

            {isSelected && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: 13, color: "var(--muted2)", marginBottom: 8, fontWeight: 700 }}>اختر اللاعبين المشاركين:</div>
                {myPlayers.map(p => {
                  const pd = playerDetails[p.id] || {};
                  const isReg = pd.examRegistered && pd.eventName === ev.name;
                  const feePaid = pd.feePaid && pd.eventName === ev.name;

                  return (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className={`checkbox-custom ${isReg ? "checked" : ""}`} onClick={() => {
                          const newPd = { ...pd };
                          if (isReg) { newPd.examRegistered = false; newPd.eventName = null; newPd.feePaid = false; }
                          else { newPd.examRegistered = true; newPd.eventName = ev.name; }
                          setPlayerDetails({ ...playerDetails, [p.id]: newPd });
                          showToast(isReg ? `تم إلغاء تسجيل ${p.name}` : `تم تسجيل ${p.name} في ${ev.name} ✅`, isReg ? "info" : "success");
                        }}>
                          {isReg && <span style={{ color: "white", fontSize: 13 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                          {pd.belt && <BeltBadge belt={pd.belt} />}
                        </div>
                      </div>
                      {isReg && (
                        <div style={{ display: "flex", align: "center", gap: 8 }}>
                          <div className={`checkbox-custom ${feePaid ? "checked" : ""}`} style={{ borderColor: feePaid ? "var(--yellow)" : "var(--border2)", background: feePaid ? "var(--yellow)" : "var(--bg)" }} onClick={() => {
                            setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, feePaid: !feePaid } });
                            showToast(!feePaid ? `تم تأكيد سداد قيد ${p.name} 💰` : `تم إلغاء سداد قيد ${p.name}`, !feePaid ? "success" : "info");
                          }}>
                            {feePaid && <span style={{ color: "#000", fontSize: 13 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: feePaid ? "var(--yellow)" : "var(--muted)" }}>سدد القيد</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}