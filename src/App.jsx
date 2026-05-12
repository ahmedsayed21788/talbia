import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCtLUMqhDA-0onHdHoJh3nUP_NgOTHaAd8",
  authDomain: "talbia-6cc1d.firebaseapp.com",
  projectId: "talbia-6cc1d",
  storageBucket: "talbia-6cc1d.firebasestorage.app",
  messagingSenderId: "782962151275",
  appId: "1:782962151275:web:bbd0394e148e2c87c8862e",
  measurementId: "G-M4M28869RT"
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



// ─────────── تصدير PDF ───────────
const exportPDF = (title, rows, filename) => {
  const html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; color: #1a2540; }
        h1 { color: #00d4aa; text-align: center; font-size: 22px; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #6a7a9a; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #0c1525; color: #00d4aa; padding: 10px 8px; text-align: right; }
        tr:nth-child(even) { background: #f0f4f8; }
        td { padding: 8px; border-bottom: 1px solid #d0d8e8; }
        .footer { text-align: center; color: #aaa; font-size: 10px; margin-top: 20px; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <h1>🥋 نادي الطالبية</h1>
      <div class="subtitle">${title} — ${new Date().toLocaleDateString("ar-EG")}</div>
      <table>
        <tr>${Object.keys(rows[0]).map(k => `<th>${k}</th>`).join("")}</tr>
        ${rows.map(r => `<tr>${Object.values(r).map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}
      </table>
      <div class="footer">نظام إدارة نادي الطالبية</div>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
};


// ─────────── نسخة احتياطية تلقائية ───────────
const checkAndAutoBackup = (players, coaches, attendance, payments, playerDetails, logs) => {
  const lastBackup = localStorage.getItem("lastBackupDate");
  const today = getToday();
  const lastMonth = localStorage.getItem("lastMonthlyReport");
  const currentMonth = today.slice(0, 7); // YYYY-MM

  // نسخة احتياطية أسبوعية
  const shouldWeeklyBackup = !lastBackup || 
    (new Date(today) - new Date(lastBackup)) / (1000 * 60 * 60 * 24) >= 7;
  
  if (shouldWeeklyBackup) {
    const backup = { date: today, players, coaches, attendance, payments, playerDetails };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_talbia_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem("lastBackupDate", today);
    showToast("📦 تم تحميل النسخة الاحتياطية الأسبوعية تلقائياً", "success");
  }

  // تقرير شهري
  if (!lastMonth || lastMonth !== currentMonth) {
    const now = new Date();
    const isLastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
    if (isLastDayOfMonth) {
      generateMonthlyReport(players, coaches, attendance, payments, playerDetails, currentMonth);
      localStorage.setItem("lastMonthlyReport", currentMonth);
    }
  }
};

const generateMonthlyReport = (players, coaches, attendance, payments, playerDetails, month) => {
  const activeP = players.filter(p => checkSubStatus(payments[p.id]?.date).valid);
  const totalRevenue = activeP.reduce((sum, p) => {
    const st = SUB_TYPES.find(s => s.label === (playerDetails[p.id]?.subType));
    return sum + (st ? st.price : 300);
  }, 0);

  const reportData = {
    month,
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlayers: players.length,
      activePlayers: activeP.length,
      expiredPlayers: players.length - activeP.length,
      totalRevenue,
    },
    coaches: coaches.filter(c => !c.isAdmin).map(c => {
      const myP = players.filter(p => String(p.coachId) === String(c.id));
      const totalAtt = myP.reduce((s, p) => s + getDetailedAttendance(p.id, c.id, attendance).count, 0);
      return {
        name: c.name,
        players: myP.length,
        avgAttendance: myP.length ? Math.round(totalAtt / myP.length) : 0,
      };
    }),
    players: players.map(p => {
      const att = getDetailedAttendance(p.id, p.coachId, attendance);
      const coach = coaches.find(c => c.id === p.coachId);
      const pd = playerDetails[p.id] || {};
      return {
        name: p.name,
        coach: coach?.name || "---",
        belt: pd.belt || "---",
        attendance: att.count,
        percentage: att.percentage,
        subscription: checkSubStatus(payments[p.id]?.date).msg,
        subType: pd.subType || "---",
      };
    }),
  };

  // حفظ التقرير في localStorage
  const reports = JSON.parse(localStorage.getItem("monthlyReports") || "[]");
  reports.unshift(reportData);
  localStorage.setItem("monthlyReports", JSON.stringify(reports.slice(0, 24))); // آخر 24 شهر

  // تحميل التقرير
  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `تقرير_شهر_${month}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`📊 تم تحميل تقرير شهر ${month} ✅`, "success");
};


// ─────────── شهادة رقمية ───────────
const generateCertificate = (playerName, belt, coachName, eventName) => {
  const html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8"/>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap');
        body { margin: 0; background: #060b14; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: 'Tajawal', sans-serif; }
        .cert { width: 800px; padding: 60px; background: linear-gradient(135deg, #0c1525, #152040); border: 3px solid #ffc300; border-radius: 20px; text-align: center; color: white; position: relative; }
        .cert::before { content: ''; position: absolute; inset: 8px; border: 1px solid rgba(255,195,0,0.3); border-radius: 14px; pointer-events: none; }
        .logo { font-size: 60px; margin-bottom: 10px; }
        .club { font-size: 28px; font-weight: 900; color: #00d4aa; margin-bottom: 4px; }
        .title { font-size: 20px; color: #ffc300; margin: 20px 0; letter-spacing: 3px; }
        .name { font-size: 42px; font-weight: 900; color: white; margin: 10px 0; text-shadow: 0 0 20px rgba(0,212,170,0.5); }
        .belt { font-size: 18px; color: #0099ff; margin: 10px 0; }
        .event { font-size: 16px; color: #e8edf5; margin: 20px 0; opacity: 0.8; }
        .coach { font-size: 14px; color: #4a6080; margin-top: 30px; }
        .date { font-size: 13px; color: #4a6080; margin-top: 8px; }
        .stars { color: #ffc300; font-size: 24px; margin: 10px 0; }
        @media print { body { background: white; } .cert { border-color: #gold; } }
      </style>
    </head>
    <body>
      <div class="cert">
        <div class="logo">🥋</div>
        <div class="club">نادي الطالبية</div>
        <div class="title">شـهـادة تـقـدير</div>
        <div class="stars">★ ★ ★ ★ ★</div>
        <p style="color:#4a6080;font-size:16px">يُشهد بأن</p>
        <div class="name">${playerName}</div>
        <div class="belt">🥋 حزام ${belt}</div>
        <div class="event">قد اجتاز بنجاح ${eventName}</div>
        <div class="coach">تحت إشراف المدرب: ${coachName}</div>
        <div class="date">📅 ${new Date().toLocaleDateString('ar-EG', {year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 800);
};

// ─────────── ذكرى الانضمام ───────────
const getAnniversaryAlerts = (players, playerDetails) => {
  const today = new Date();
  return players.filter(p => {
    const pd = playerDetails[p.id] || {};
    if (!pd.joinDate) return false;
    const join = new Date(pd.joinDate);
    return join.getDate() === today.getDate() && join.getMonth() === today.getMonth() && join.getFullYear() !== today.getFullYear();
  }).map(p => {
    const years = today.getFullYear() - new Date(playerDetails[p.id].joinDate).getFullYear();
    return { ...p, years };
  });
};


// ─────────── إشعار غياب واتساب ───────────
const notifyAbsence = (player, pd, coachName, daysAbsent) => {
  if (!pd.phone) return showToast("مفيش رقم لولي أمر " + player.name, "error");
  const msg = `السلام عليكم،
هذا إشعار من نادي الطالبية
اللاعب: ${player.name}
غائب منذ ${daysAbsent} أيام متتالية
يرجى التواصل مع المدرب ${coachName}
📞 نادي الطالبية`;
  window.open(`https://wa.me/2${pd.phone}?text=${encodeURIComponent(msg)}`, "_blank");
};


// ─────────── رسالة تهنئة نجاح الاختبار ───────────
const sendExamCongrats = (player, pd, belt, eventName, coachName) => {
  if (!pd.phone) return showToast(`مفيش رقم لولي أمر ${player.name}`, "error");
  const msg = `🎉 مبروك يا ${player.name}!

يسعدنا في نادي الطالبية أن نبشركم بأن نجمنا
🥋 ${player.name}
قد اجتاز اختبار ${eventName} بنجاح

🏅 الحزام الجديد: ${belt || "---"}
👨‍🏫 تحت إشراف: ${coachName}

كل التهانئ وإلى الأمام دائماً! 💪

🏫 نادي الطالبية`;
  window.open(`https://wa.me/2${pd.phone}?text=${encodeURIComponent(msg)}`, "_blank");
  showToast(`تم إرسال تهنئة لولي أمر ${player.name} 🎉`, "success");
};


// ─────────── تنسيق التاريخ ───────────
const formatDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const isBirthday = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return false;
  const today = new Date();
  const d = new Date(dateStr);
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
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
      const bd = pd.birthdate && typeof pd.birthdate === "string" ? new Date(pd.birthdate) : new Date();
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
  /* Premium Blue & Gold Theme */
  --bg: #04080f;
  --surface: #080f1e;
  --surface2: #0c1628;
  --surface3: #101e34;
  --border: #1a2d4a;
  --border2: #243d60;
  --accent: #c9a84c;      /* Gold */
  --accent2: #1e6fbf;     /* Royal Blue */
  --accent3: #2d8ae0;     /* Bright Blue */
  --gold: #c9a84c;
  --gold2: #e8c96d;
  --blue: #1e6fbf;
  --blue2: #2d8ae0;
  --red: #e05555;
  --yellow: #c9a84c;
  --orange: #e07a30;
  --text: #eef2f8;
  --muted: #4a6080;
  --muted2: #6a85a8;
  --card-glow: 0 0 0 1px rgba(201,168,76,0.15), 0 4px 24px rgba(0,0,0,0.6);
  --card-glow-active: 0 0 0 1px rgba(201,168,76,0.4), 0 8px 32px rgba(201,168,76,0.12);
}
.light-mode {
  --bg: #f0f4fa;
  --surface: #ffffff;
  --surface2: #e8eef8;
  --surface3: #dde5f5;
  --border: #c8d8f0;
  --border2: #b0c4e8;
  --text: #0a1628;
  --muted: #5a7090;
  --muted2: #7a90b0;
  --card-glow: 0 0 0 1px var(--border), 0 4px 16px rgba(0,0,0,0.06);
  --card-glow-active: 0 0 0 1px var(--accent), 0 4px 20px rgba(201,168,76,0.15);
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
.card:hover { box-shadow: var(--card-glow-active); border-color: rgba(201,168,76,0.25); }

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
.btn-primary { background: linear-gradient(135deg, #c9a84c, #a07830); box-shadow: 0 2px 16px rgba(201,168,76,0.3); color: #fff; }
.btn-blue { background: linear-gradient(135deg, #1e6fbf, #155090); box-shadow: 0 2px 16px rgba(30,111,191,0.3); }
.btn-red { background: linear-gradient(135deg, #e05555, #b03030); box-shadow: 0 2px 12px rgba(224,85,85,0.25); }
.btn-yellow { background: linear-gradient(135deg, #c9a84c, #a07830); color: #fff; }
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
.tab-item.active { background: linear-gradient(135deg, #c9a84c, #a07830); color: #fff; box-shadow: 0 2px 14px rgba(201,168,76,0.35); letter-spacing: 0.3px; }
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
  background: rgba(4,8,15,0.97);
  border-bottom: 1px solid rgba(201,168,76,0.2);
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
  background: linear-gradient(135deg, #e8c96d, #c9a84c, #2d8ae0);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 1px;
  text-shadow: none;
  filter: drop-shadow(0 0 8px rgba(201,168,76,0.3));
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
  background: rgba(201,168,76,0.12);
  border-color: var(--gold);
  color: var(--gold);
  box-shadow: 0 0 8px rgba(201,168,76,0.2);
}

.progress-bar {
  position: absolute;
  bottom: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #1e6fbf, #c9a84c);
  border-radius: 0 0 16px 16px;
  transition: width 0.6s ease;
  box-shadow: 0 0 6px rgba(201,168,76,0.4);
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
  background: var(--accent-line, linear-gradient(90deg, #c9a84c, #2d8ae0));
  border-radius: 18px 18px 0 0;
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

/* Swipe tabs on mobile */
.tab-bar { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.tab-bar::-webkit-scrollbar { display: none; }

/* Smooth transitions */
.player-row, .card, .stat-card { animation: fadeIn 0.3s ease; }

/* Mobile optimizations */
@media (max-width: 500px) {
  .btn { padding: 10px 14px; font-size: 13px; }
  .stat-value { font-size: 20px; }
  .player-row { padding: 12px 14px; }
  .header-bar { padding: 12px 16px; }
}

/* Calendar styles */
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-day { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
.cal-day:hover { background: var(--surface2); }
.cal-day.training { background: rgba(0,212,170,0.15); border: 1px solid var(--accent); color: var(--accent); font-weight: 800; }
.cal-day.event { background: rgba(255,195,0,0.15); border: 1px solid var(--yellow); color: var(--yellow); font-weight: 800; }
.cal-day.today { background: var(--accent2); color: white; font-weight: 900; }
.cal-day.other-month { opacity: 0.3; }

/* Message notification dot */
.notif-dot { width: 8px; height: 8px; background: var(--red); border-radius: 50%; position: absolute; top: -2px; left: -2px; animation: pulse 1.5s infinite; }

/* Glassmorphism for cards */
.glass-card {
  background: rgba(12,21,37,0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 18px;
}

/* Neon glow effects */
.glow-green { box-shadow: 0 0 15px rgba(0,212,170,0.3); }
.glow-blue { box-shadow: 0 0 15px rgba(0,153,255,0.3); }
.glow-red { box-shadow: 0 0 15px rgba(255,69,96,0.3); }
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



// ─────────── Heatmap الحضور ───────────
function AttendanceHeatmap({ playerId, coachId, attendance }) {
  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${coachId}_${d.toISOString().split("T")[0]}`;
    const present = attendance[key]?.[playerId] === "present";
    days.push({ date: d.toISOString().split("T")[0], present });
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>آخر 30 يوم</div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {days.map((d, i) => (
          <div key={i} title={d.date}
            style={{ width: 14, height: 14, borderRadius: 3, background: d.present ? "var(--accent)" : "var(--border)", opacity: d.present ? 1 : 0.5, transition: "all 0.2s" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)" }}/>
        <span style={{ fontSize: 9, color: "var(--muted)" }}>حاضر</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--border)" }}/>
        <span style={{ fontSize: 9, color: "var(--muted)" }}>غائب</span>
      </div>
    </div>
  );
}

// ─────────── Dark/Light Mode Toggle ───────────
function ThemeToggle({ darkMode, setDarkMode }) {
  return (
    <button onClick={() => setDarkMode(!darkMode)} style={{
      background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20,
      padding: "4px 12px", cursor: "pointer", fontSize: 16, transition: "all 0.3s"
    }}>
      {darkMode ? "☀️" : "🌙"}
    </button>
  );
}


// ─────────── مقارنة شهرية ───────────
function MonthlyComparison({ players, coaches, attendance, payments, coachId }) {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
    const myPlayers = coachId
      ? players.filter(p => String(p.coachId) === String(coachId))
      : players;
    const totalAtt = myPlayers.reduce((sum, p) => {
      const keys = Object.keys(attendance).filter(k => k.includes(monthKey) && k.startsWith(`${p.coachId}_`));
      return sum + keys.filter(k => attendance[k]?.[p.id] === "present").length;
    }, 0);
    const avg = myPlayers.length ? Math.round(totalAtt / myPlayers.length) : 0;
    months.push({ label, avg, total: totalAtt });
  }
  const maxVal = Math.max(...months.map(m => m.avg), 1);
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="section-title">📈 مقارنة الحضور (آخر 6 شهور)</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 24, position: "relative" }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, marginBottom: 2 }}>{m.avg}</div>
            <div style={{ width: "100%", background: `linear-gradient(180deg, var(--accent2), var(--accent3))`,
              height: `${(m.avg / maxVal) * 80}px`, borderRadius: "4px 4px 0 0", minHeight: m.avg ? 4 : 0,
              opacity: i === 5 ? 1 : 0.6 + (i * 0.08), transition: "height 0.5s" }} />
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, position: "absolute", bottom: 0 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── كارت اللاعب للطباعة ───────────
const printPlayerCard = (player, pd, coach) => {
  const beltObj = (pd.belt && [{label:"أبيض",color:"#f0f0f0"},{label:"أصفر",color:"#FFD700"},{label:"برتقالي",color:"#FF8C00"},{label:"أخضر",color:"#228B22"},{label:"أزرق",color:"#1E90FF"},{label:"بنفسجي",color:"#800080"},{label:"بني",color:"#8B4513"},{label:"أحمر",color:"#DC143C"},{label:"أسود",color:"#1a1a1a"}].find(b => b.label === pd.belt)) || {color:"#f0f0f0"};
  const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"/>
  <style>
    body{margin:0;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;}
    .card{width:340px;background:linear-gradient(135deg,#0c1525,#1a2d4a);border-radius:20px;padding:28px;color:white;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);}
    .logo{font-size:40px;margin-bottom:8px;}
    .club{font-size:16px;color:#00d4aa;font-weight:900;margin-bottom:16px;}
    .avatar{width:80px;height:80px;border-radius:50%;background:${beltObj.color};display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 12px;border:3px solid rgba(255,255,255,0.2);}
    .name{font-size:22px;font-weight:900;margin-bottom:4px;}
    .belt{font-size:13px;color:#ffc300;margin-bottom:12px;}
    .info{background:rgba(255,255,255,0.06);border-radius:12px;padding:12px;text-align:right;font-size:12px;line-height:2;}
    .label{color:#4a6080;}
    .val{color:white;font-weight:700;}
    .footer{margin-top:14px;font-size:10px;color:#4a6080;}
    @media print{body{background:white;}}
  </style></head><body>
  <div class="card">
    <div class="logo">🥋</div>
    <div class="club">نادي الطالبية</div>
    <div class="avatar">🥋</div>
    <div class="name">${player.name}</div>
    <div class="belt">🥋 حزام ${pd.belt || "أبيض"}</div>
    <div class="info">
      <div><span class="label">المدرب: </span><span class="val">${coach?.name || "---"}</span></div>
      ${pd.birthdate ? `<div><span class="label">مواليد: </span><span class="val">${new Date(pd.birthdate).getFullYear()}</span></div>` : ""}
      ${pd.phone ? `<div><span class="label">التليفون: </span><span class="val">${pd.phone}</span></div>` : ""}
      ${pd.subType ? `<div><span class="label">الاشتراك: </span><span class="val">${pd.subType}</span></div>` : ""}
      ${pd.joinDate ? `<div><span class="label">الانضمام: </span><span class="val">${pd.joinDate}</span></div>` : ""}
    </div>
    <div class="footer">نادي الطالبية · تطوير Ahmed Sayed</div>
  </div></body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
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
  const [darkMode, setDarkMode] = useState(true);
  const [messages, setMessages] = useState([]);
  const [trainingPlan, setTrainingPlan] = useState({});
  const lastActivityRef = useRef(Date.now());

  // تسجيل خروج تلقائي بعد 30 دقيقة
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);
    const interval = setInterval(() => {
      if (user && Date.now() - lastActivityRef.current > 30 * 60 * 1000) {
        setUser(null);
        showToast("تم تسجيل الخروج تلقائياً بسبب عدم النشاط", "info");
      }
    }, 60000);
    return () => { window.removeEventListener('click', updateActivity); window.removeEventListener('keypress', updateActivity); clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);

    const fetchData = async () => {
      const adminData = [{ id: 100, username: "admin", password: "2201", name: "المدير العام", isAdmin: true }];
      try {
        const [cSnap, pSnap, aSnap, paySnap, nSnap, pdSnap, evSnap, logsSnap, pExtraSnap, trainSnap, msgSnap, tPlanSnap] = await Promise.all([
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
          getDoc(doc(db, "clubData", "messages")),
          getDoc(doc(db, "clubData", "trainingPlan")),
        ]);
        let dbCoaches = cSnap.exists() ? JSON.parse(cSnap.data().value) : adminData;
        const hasAdmin = dbCoaches.some(c => c.username === "admin");
        if (!hasAdmin) dbCoaches = [adminData[0], ...dbCoaches];
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
        setMessages(msgSnap.exists() ? JSON.parse(msgSnap.data().value) : []);
        setTrainingPlan(tPlanSnap.exists() ? JSON.parse(tPlanSnap.data().value) : {});
      } catch (e) { 
        console.error("Firebase error:", e);
        setCoaches(adminData);
        showToast("تحقق من إعدادات Firebase", "error");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // تحقق من النسخة الاحتياطية التلقائية كل يوم
  useEffect(() => {
    if (!loading && players.length > 0) {
      const timer = setTimeout(() => {
        checkAndAutoBackup(players, coaches, attendance, payments, playerDetails, logs);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (key, data) => {
    try { await setDoc(doc(db, "clubData", key), { value: JSON.stringify(data) }); }
    catch (e) { console.error("Save error:", e); }
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", fontFamily: "'Tajawal',sans-serif", direction: "rtl" }}>
      <style>{`
        @keyframes splashPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.1);opacity:0.85} }
        @keyframes splashFade { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes goldSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes goldPulse { 0%,100%{box-shadow:0 0 20px rgba(201,168,76,0.3)} 50%{box-shadow:0 0 40px rgba(201,168,76,0.6)} }
        .splash-logo { animation: splashPulse 2s ease-in-out infinite; }
        .splash-text { animation: splashFade 0.8s ease forwards; }
        .splash-ring { animation: goldSpin 2s linear infinite; }
        .splash-wrapper { animation: goldPulse 2s ease-in-out infinite; }
      `}</style>
      <div className="splash-wrapper" style={{ position: "relative", marginBottom: 28, borderRadius: "50%", padding: 8 }}>
        <svg className="splash-ring" width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(201,168,76,0.15)" strokeWidth="3"/>
          <circle cx="60" cy="60" r="54" fill="none" stroke="url(#goldGrad)" strokeWidth="3"
            strokeDasharray="339" strokeDashoffset="240" strokeLinecap="round"/>
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c9a84c"/>
              <stop offset="100%" stopColor="#2d8ae0"/>
            </linearGradient>
          </defs>
        </svg>
        <img src="/logo192.png" alt="logo" className="splash-logo" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 70, height: 70, objectFit: "contain", borderRadius: 16 }} />
      </div>
      <div className="splash-text" style={{ fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg,#e8c96d,#c9a84c,#2d8ae0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2 }}>نادي الطالبية</div>
      <div className="splash-text" style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, animationDelay: "0.3s", letterSpacing: 3, textTransform: "uppercase" }}>Academy Management</div>
      <div style={{ marginTop: 20, display: "flex", gap: 6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 1 ? "#c9a84c" : "var(--border)", animation: `splashPulse ${1 + i * 0.3}s ease-in-out infinite` }} />)}
      </div>
    </div>
  );

  return (
    <div className={darkMode ? "" : "light-mode"} style={{ direction: "rtl", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{globalCSS}</style>
      <ToastContainer />
      {!user ? (
        <LoginPage coaches={coaches} onLogin={setUser} />
      ) : (
        <>
          <div className="header-bar">
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{user.name}</div>
              <small style={{ color: "var(--muted)", fontSize: 11 }}>{user.isAdmin ? "🛡 مدير" : "🥋 مدرب"}</small>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <img src="/logo192.png" alt="logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 8, filter: "drop-shadow(0 0 6px rgba(201,168,76,0.4))" }} />
              </div>
              <div>
                <div className="logo-text" style={{ fontSize: 18 }}>الطالبية</div>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1 }}>ACADEMY</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              <button onClick={() => { setUser(null); showToast("تم تسجيل الخروج بنجاح", "info"); }} className="btn btn-ghost btn-sm">خروج</button>
            </div>
          </div>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
            {user.isAdmin ? (
              <AdminDashboard
                coaches={coaches} setCoaches={(d) => { setCoaches(d); save("coaches", d); }}
                messages={messages} setMessages={(d) => { setMessages(d); save("messages", d); }}
                trainingPlan={trainingPlan} setTrainingPlan={(d) => { setTrainingPlan(d); save("trainingPlan", d); }}
                players={players} setPlayers={(d) => { setPlayers(d); save("players", d); }}
                attendance={attendance} setAttendance={(d) => { setAttendance(d); save("attendance", d); }}
                payments={payments} setPayments={(d) => { setPayments(d); save("payments", d); }}
                notes={notes} setNotes={(d) => { setNotes(d); save("notes", d); }}
                playerDetails={playerDetails} setPlayerDetails={(d) => { setPlayerDetails(d); save("playerDetails", d); }}
                events={events} setEvents={(d) => { setEvents(d); save("events", d); }}
                logs={logs} setLogs={(d) => { setLogs(d); save("logs", d); }}
                playerExtra={playerExtra} setPlayerExtra={(d) => { setPlayerExtra(d); save("playerExtra", d); }}
                trainingSettings={trainingSettings} setTrainingSettings={(d) => { setTrainingSettings(d); save("trainingSettings", d); }}
                messages={messages} setMessages={(d) => { setMessages(d); save("messages", d); }}
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
                trainingSettings={trainingSettings}
                coaches={coaches} setCoaches={(d) => { setCoaches(d); save("coaches", d); }}
                messages={messages} setMessages={(d) => { setMessages(d); save("messages", d); }}
                trainingPlan={trainingPlan} setTrainingPlan={(d) => { setTrainingPlan(d); save("trainingPlan", d); }} setTrainingSettings={(d) => { setTrainingSettings(d); save("trainingSettings", d); }}
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
    <div onClick={enableAudio} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 16, position: "relative", overflow: "hidden" }}>
      {/* Animated background */}
      <style>{`
        @keyframes float1 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(20px,-30px) rotate(180deg)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(-15px,25px) rotate(-180deg)} }
        @keyframes loginFade { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        .login-card-anim { animation: loginFade 0.6s ease forwards; }
      `}</style>
      <div style={{ position:"absolute", width:200, height:200, borderRadius:"50%", background:"rgba(0,212,170,0.04)", top:-50, right:-50, animation:"float1 8s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", width:150, height:150, borderRadius:"50%", background:"rgba(0,153,255,0.04)", bottom:-30, left:-30, animation:"float2 6s ease-in-out infinite" }}/>
      <div className="login-card-anim" style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ position: "relative", display: "inline-block", marginBottom: 4 }}>
            <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.2) 0%, transparent 70%)", animation: "goldPulse 2s ease-in-out infinite" }} />
            <img src="/logo512.png" alt="logo" style={{ width: 100, height: 100, objectFit: "contain", borderRadius: 24, filter: "drop-shadow(0 0 24px rgba(201,168,76,0.5))", position: "relative" }} />
          </div>
          <div className="logo-text" style={{ fontSize: 32, marginTop: 8 }}>نادي الطالبية</div>
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, letterSpacing: 4, textTransform: "uppercase" }}>Academy Management System</div>
          <div style={{ width: 40, height: 2, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)", margin: "10px auto 0" }} />
        </div>
        <div className="card" style={{ padding: 28 }}>
          <input className="input-field" placeholder="اسم المستخدم" value={u} onChange={e => setU(e.target.value)}
            onKeyDown={e => e.key === "Enter" && document.getElementById("loginBtn").click()} />
          <input className="input-field" type="password" placeholder="كلمة المرور" value={p} onChange={e => setP(e.target.value)}
            onKeyDown={e => e.key === "Enter" && document.getElementById("loginBtn").click()} />
          <button id="loginBtn" className="btn btn-primary btn-full" style={{ marginTop: 4, background: "linear-gradient(135deg, #c9a84c, #a07830)", boxShadow: "0 4px 20px rgba(201,168,76,0.4)", letterSpacing: 1, fontSize: 15, padding: 15 }} onClick={() => {
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
          }}>دخول</button>
        </div>
        {/* Developer Credit */}
        <div style={{ textAlign: "center", marginTop: 24, padding: "12px 0" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>تم التطوير بواسطة</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "var(--accent2)" }}>Ahmed Sayed</div>
          <a href="https://wa.me/201142126158" target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "6px 14px", background: "#25D36622", border: "1px solid #25D36644", borderRadius: 20, textDecoration: "none" }}>
            <span style={{ fontSize: 14 }}>📱</span>
            <span style={{ fontSize: 12, color: "#25D366", fontWeight: 700 }}>01142126158</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════ ADMIN ═══════════════════════════
function AdminDashboard({ coaches, setCoaches, players, setPlayers, attendance, setAttendance, payments, setPayments, notes, setNotes, playerDetails, setPlayerDetails, events, setEvents, logs, setLogs, playerExtra, setPlayerExtra, trainingSettings, setTrainingSettings, messages, setMessages }) {
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
        {[["dashboard", "🏠 الرئيسية"], ["reports", "📊 تقارير"], ["players", "👥 لاعبين"], ["coaches", "🏅 مدربين"], ["payments", "💰 مالية"], ["events", "🏆 فعاليات"], ["calendar", "📅 تقويم"], ["messages", "💬 رسائل"], ["alerts", "🔔 تنبيهات"], ["leaderboard", "🏅 ترتيب"], ["logs", "📋 سجل"], ["reset", "🔄 إعادة"], ["settings", "⚙️ إعدادات"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab-item ${tab === k ? "active" : ""}`}>{l}</button>
        ))}
      </div>

      {tab === "dashboard" && <AdminMainDashboard coaches={coaches} players={players} attendance={attendance} payments={payments} events={events} playerDetails={playerDetails} />}
      {tab === "reports" && <AdminReports coaches={coaches} players={players} attendance={attendance} payments={payments} playerDetails={playerDetails} />}
      {tab === "players" && <AdminPlayers coaches={coaches} players={players} setPlayers={setPlayers} playerDetails={playerDetails} setPlayerDetails={setPlayerDetails} />}
      {tab === "coaches" && <AdminCoaches coaches={coaches} setCoaches={setCoaches} />}
      {tab === "payments" && <AdminPayments players={players} payments={payments} setPayments={setPayments} playerDetails={playerDetails} />}
      {tab === "events" && <AdminEvents events={events} setEvents={setEvents} players={players} playerDetails={playerDetails} setPlayerDetails={setPlayerDetails} coaches={coaches} />}
      {tab === "calendar" && <ClubCalendar events={events} trainingSettings={trainingSettings} coaches={coaches} coachId={null} />}
      {tab === "messages" && <InternalMessages user={{ id: 100, name: "المدير العام", isAdmin: true }} coaches={coaches} messages={messages} setMessages={setMessages} />}
      {tab === "alerts" && <AdminAlerts players={players} attendance={attendance} payments={payments} coaches={coaches} playerDetails={playerDetails} />}
      {tab === "leaderboard" && <AdminLeaderboard players={players} coaches={coaches} attendance={attendance} payments={payments} playerDetails={playerDetails} />}
      {tab === "settings" && <AdminSettings trainingSettings={trainingSettings} setTrainingSettings={setTrainingSettings} coaches={coaches} />}
      {tab === "logs" && <AdminLogs logs={logs} setLogs={setLogs} />}
      {tab === "reset" && <AdminReset attendance={attendance} setAttendance={setAttendance} payments={payments} setPayments={setPayments} logs={logs} setLogs={setLogs} players={players} coaches={coaches} playerDetails={playerDetails} />}
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

      {/* أفضل 3 لاعبين */}
      {players.length > 0 && (() => {
        const top3 = [...players]
          .map(p => ({ ...p, att: getDetailedAttendance(p.id, p.coachId, attendance) }))
          .sort((a, b) => b.att.count - a.att.count)
          .slice(0, 3);
        const medals = ["🥇", "🥈", "🥉"];
        const colors = ["#FFD700", "#C0C0C0", "#CD7F32"];
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-title">🏆 أفضل 3 لاعبين حضوراً</div>
            {top3.map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{medals[i]}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{coaches.find(c => c.id === p.coachId)?.name || "---"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 900, color: colors[i], fontSize: 18 }}>{p.att.count}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>يوم</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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

      {/* ذكرى الانضمام */}
      {(() => {
        const anniversaries = getAnniversaryAlerts(players, playerDetails);
        if (!anniversaries.length) return null;
        return (
          <div className="card" style={{ borderColor: "var(--accent2)", background: "rgba(0,153,255,0.05)", marginBottom: 14, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🎊</div>
            <div style={{ fontWeight: 800, color: "var(--accent2)", marginBottom: 8 }}>ذكرى انضمام!</div>
            {anniversaries.map(p => (
              <div key={p.id} style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                🎉 {p.name} — {p.years} {p.years === 1 ? "سنة" : "سنوات"} في النادي!
              </div>
            ))}
          </div>
        );
      })()}

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
  const [coachFilter, setCoachFilter] = useState("all");

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
        "تاريخ الميلاد": pd.birthdate ? (() => { const p = typeof pd.birthdate === "string" ? pd.birthdate.split("-") : []; return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : String(pd.birthdate || "---"); })() : "---",
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
        <button onClick={exportExcel} className="btn btn-blue" style={{ flex: 1 }}>📥 إكسل</button>
        <button onClick={() => {
          const rows = players.filter(p => p.name.includes(search)).map(p => {
            const att = getDetailedAttendance(p.id, p.coachId, attendance);
            const sub = checkSubStatus(payments[p.id]?.date);
            const coach = coaches.find(c => c.id === p.coachId);
            const pd = playerDetails[p.id] || {};
            return { "الاسم": p.name, "المدرب": coach?.name||"---", "الحزام": pd.belt||"---", "الحضور": `${att.count} يوم`, "النسبة": `${att.percentage}%`, "الاشتراك": sub.msg };
          });
          if (rows.length) exportPDF("تقرير اللاعبين", rows, "تقرير");
          else showToast("لا يوجد بيانات", "info");
        }} className="btn btn-ghost" style={{ flex: 1 }}>🖨️ PDF</button>
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
      <MonthlyComparison players={players} coaches={coaches} attendance={attendance} payments={payments} coachId={coachFilter === "all" ? null : coachFilter} />
      <div className="grid-2" style={{ marginBottom: 8 }}>
        <input className="input-field" style={{ marginBottom: 0 }} placeholder="🔍 بحث باسم اللاعب..." onChange={e => setSearch(e.target.value)} />
        <select className="input-field" style={{ marginBottom: 0 }} value={coachFilter} onChange={e => setCoachFilter(e.target.value)}>
          <option value="all">🥋 كل المدربين</option>
          {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      {players.filter(p => p.name.includes(search) && (coachFilter === "all" || String(p.coachId) === coachFilter)).map(p => {
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
                  {pd.examResult && pd.examResult !== "لم يمتحن" && <span className={`badge ${pd.examResult === "نجح ✅" ? "badge-green" : "badge-red"}`}>{pd.examResult}</span>}
                  <span className={`badge ${pd.regFeePaid ? "badge-green" : "badge-red"}`}>🏷 القيد: {pd.regFeePaid ? "مسدد" : "لم يسدد"}</span>
                  {pd.medical && <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700 }}>⚕️ {pd.medical}</span>}
                </div>
                {pd.eventName && <div style={{ fontSize: 11, color: "var(--accent2)", marginTop: 2 }}>🏆 {pd.eventName}</div>}
              </div>
              <div style={{ textAlign: "center", marginRight: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                <DonutChart value={att.percentage} max={100} color={att.percentage >= 75 ? "var(--accent)" : att.percentage >= 50 ? "var(--yellow)" : "var(--red)"} size={52} />
                <button onClick={() => printPlayerCard(p, pd, coach)} className="btn btn-ghost btn-xs" style={{ fontSize: 10 }}>🪪 كارت</button>
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
          <div className="grid-2">
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📞 التليفون</label>
              <input className="input-field" value={c.phone || ""} onChange={e => update(c.id, "phone", e.target.value)} placeholder="01xxxxxxxxx" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>🎂 سنة الميلاد</label>
              <input type="number" className="input-field" value={c.birthYear || ""} onChange={e => update(c.id, "birthYear", e.target.value)} placeholder="1990" />
            </div>
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
  const [newBirthdate, setNewBirthdate] = useState(""); const [newPhone, setNewPhone] = useState(""); const [newWeight, setNewWeight] = useState(""); const [newHeight, setNewHeight] = useState(""); const [newRegFeePaid, setNewRegFeePaid] = useState(false); const [newMedical, setNewMedical] = useState("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [filterCoach, setFilterCoach] = useState("all");
  const [transferMode, setTransferMode] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [targetCoach, setTargetCoach] = useState("");
  const [copyMode, setCopyMode] = useState(false);

  const add = () => {
    if (n && cId) {
      const newId = Date.now();
      setPlayers([...players, { id: newId, name: n, coachId: Number(cId) }]);
      setPlayerDetails({ ...playerDetails, [newId]: { 
        belt, joinDate, subType,
        birthdate: newBirthdate, phone: newPhone,
        weight: newWeight, height: newHeight,
        regFeePaid: newRegFeePaid, medical: newMedical
      }});
      showToast(`تم إضافة اللاعب ${n} بنجاح 🎉`, "success");
      setN(""); setCId(""); setBelt("أبيض"); setJoinDate(getToday()); setSubType("غير عضو");
      setNewBirthdate(""); setNewPhone(""); setNewWeight(""); setNewHeight(""); setNewRegFeePaid(false); setNewMedical("");
    } else showToast("يرجى ملء الاسم واختيار المدرب", "error");
  };

  const filtered = players.filter(p => p.name.includes(search) && (filterCoach === "all" || String(p.coachId) === filterCoach));

  return (
    <div>
      <ConfirmModal open={!!confirm} msg={confirm?.msg} onConfirm={() => { confirm?.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />

      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 14, fontSize: 15 }}>➕ إضافة لاعب جديد</div>
        
        {/* الاسم والمدرب */}
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>اسم اللاعب *</label>
            <input className="input-field" placeholder="الاسم كاملاً" value={n} onChange={e => setN(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>المدرب *</label>
            <select className="input-field" value={cId} onChange={e => setCId(e.target.value)}>
              <option value="">اختر المدرب</option>
              {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* الحزام ونوع الاشتراك */}
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>الحزام</label>
            <select className="input-field" value={belt} onChange={e => setBelt(e.target.value)}>
              {BELTS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>نوع الاشتراك</label>
            <select className="input-field" value={subType} onChange={e => setSubType(e.target.value)}>
              {SUB_TYPES.map(s => <option key={s.label} value={s.label}>{s.icon} {s.label} - {s.price} جنيه</option>)}
            </select>
          </div>
        </div>

        {/* تاريخ الميلاد وتاريخ الانضمام */}
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>🎂 تاريخ الميلاد</label>
            <input type="date" className="input-field" value={newBirthdate} onChange={e => setNewBirthdate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📅 تاريخ الانضمام</label>
            <input type="date" className="input-field" value={joinDate} onChange={e => setJoinDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📝 ملاحظة طبية</label>
            <input className="input-field" placeholder="إصابة / حالة خاصة..." value={newMedical || ""} onChange={e => setNewMedical(e.target.value)} />
          </div>
        </div>

        {/* التليفون */}
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📞 تليفون ولي الأمر</label>
          <input className="input-field" placeholder="01xxxxxxxxx" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
        </div>

        {/* الوزن والطول */}
        <div className="grid-2">
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>⚖️ الوزن (كجم)</label>
            <input type="number" className="input-field" placeholder="65" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📏 الطول (سم)</label>
            <input type="number" className="input-field" placeholder="170" value={newHeight} onChange={e => setNewHeight(e.target.value)} />
          </div>
        </div>

        {/* سداد القيد */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface2)", borderRadius: 12, padding: "10px 14px", marginBottom: 8 }}>
          <div className={`checkbox-custom ${newRegFeePaid ? "checked" : ""}`} onClick={() => setNewRegFeePaid(!newRegFeePaid)}>
            {newRegFeePaid && <span style={{ color: "white", fontSize: 13 }}>✓</span>}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>سداد القيد الموسمي</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>هل سدد رسوم القيد؟</div>
          </div>
          <span className={`badge ${newRegFeePaid ? "badge-green" : "badge-red"}`} style={{ marginRight: "auto" }}>
            {newRegFeePaid ? "مسدد ✅" : "لم يسدد"}
          </span>
        </div>

        <button onClick={add} className="btn btn-primary btn-full" style={{ marginTop: 4 }}>➕ إضافة اللاعب</button>
      </div>

      {/* فلتر + بحث */}
      <div className="grid-2" style={{ marginBottom: 8 }}>
        <input className="input-field" style={{ marginBottom: 0 }} placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-field" style={{ marginBottom: 0 }} value={filterCoach} onChange={e => setFilterCoach(e.target.value)}>
          <option value="all">🥋 كل المدربين</option>
          {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={String(c.id)}>{c.name} ({players.filter(p => String(p.coachId) === String(c.id)).length})</option>)}
        </select>
      </div>

      {/* نقل ونسخ لاعبين */}
      <div className="card" style={{ marginBottom: 12, borderColor: (transferMode || copyMode) ? "var(--accent2)" : "var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (transferMode || copyMode) ? 12 : 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>🔄 نقل / نسخ لاعبين</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setTransferMode(!transferMode); setCopyMode(false); setSelectedPlayers([]); setTargetCoach(""); }}
              className={`btn btn-sm ${transferMode ? "btn-red" : "btn-blue"}`}>
              {transferMode ? "إلغاء" : "🔄 نقل"}
            </button>
            <button onClick={() => { setCopyMode(!copyMode); setTransferMode(false); setSelectedPlayers([]); setTargetCoach(""); }}
              className={`btn btn-sm ${copyMode ? "btn-red" : "btn-ghost"}`}>
              {copyMode ? "إلغاء" : "📋 نسخ"}
            </button>
          </div>
        </div>
        {(transferMode || copyMode) && (
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              {transferMode ? "اختر اللاعبين للنقل" : "اختر اللاعبين للنسخ"} ثم اختر المدرب
            </div>
            <select className="input-field" value={targetCoach} onChange={e => setTargetCoach(e.target.value)}>
              <option value="">اختر المدرب</option>
              {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selectedPlayers.length > 0 && targetCoach && (
              <button onClick={() => {
                const targetName = coaches.find(c => String(c.id) === targetCoach)?.name;
                setConfirm({
                  msg: `${transferMode ? "نقل" : "نسخ"} ${selectedPlayers.length} لاعب للمدرب ${targetName}؟`,
                  fn: () => {
                    if (transferMode) {
                      setPlayers(players.map(p => selectedPlayers.includes(p.id) ? { ...p, coachId: Number(targetCoach) } : p));
                      showToast(`تم نقل ${selectedPlayers.length} لاعب ✅`, "success");
                    } else {
                      const newPlayers = selectedPlayers.map(id => {
                        const original = players.find(p => p.id === id);
                        const newId = Date.now() + Math.random();
                        return { ...original, id: newId, coachId: Number(targetCoach) };
                      });
                      setPlayers([...players, ...newPlayers]);
                      showToast(`تم نسخ ${selectedPlayers.length} لاعب ✅`, "success");
                    }
                    setSelectedPlayers([]); setTargetCoach(""); setTransferMode(false); setCopyMode(false);
                  }
                });
              }} className="btn btn-primary btn-full">
                {transferMode ? "🔄" : "📋"} {transferMode ? "نقل" : "نسخ"} {selectedPlayers.length} لاعب
              </button>
            )}
            {selectedPlayers.length > 0 && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }}>✅ تم اختيار {selectedPlayers.length} لاعب</div>}
          </div>
        )}
      </div>

      {/* استيراد من إكسل */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>📤 استيراد من إكسل</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          ارفع ملف Excel فيه أعمدة: <span style={{ color: "var(--accent)" }}>الاسم، المدرب، الحزام، تاريخ الميلاد، التليفون، نوع الاشتراك</span>
        </div>
        <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} id="importFile"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!window.XLSX) return showToast("جاري تحميل مكتبة الإكسل...", "info");
            try {
              const data = await file.arrayBuffer();
              const wb = window.XLSX.read(data);
              const ws = wb.Sheets[wb.SheetNames[0]];
              const rows = window.XLSX.utils.sheet_to_json(ws);
              let added = 0;
              const newPlayers = [];
              const newDetails = { ...playerDetails };
              rows.forEach(row => {
                const name = row["الاسم"] || row["Name"] || row["name"];
                const coachName = row["المدرب"] || row["Coach"];
                if (!name) return;
                const coach = coaches.find(c => c.name === coachName || String(c.id) === coachName);
                const newId = Date.now() + Math.random();
                newPlayers.push({ id: newId, name: String(name), coachId: coach ? coach.id : (coaches.find(c => !c.isAdmin)?.id || 0) });
                newDetails[newId] = {
                  belt: row["الحزام"] || "أبيض",
                  birthdate: row["تاريخ الميلاد"] || "",
                  phone: String(row["التليفون"] || ""),
                  subType: row["نوع الاشتراك"] || "غير عضو",
                  joinDate: getToday(),
                  regFeePaid: false,
                };
                added++;
              });
              setPlayers([...players, ...newPlayers]);
              setPlayerDetails(newDetails);
              showToast(`تم استيراد ${added} لاعب بنجاح 🎉`, "success");
              e.target.value = "";
            } catch(err) {
              showToast("خطأ في قراءة الملف — تأكد من الصيغة", "error");
            }
          }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => document.getElementById("importFile").click()} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>📥 رفع ملف Excel</button>
          <button onClick={() => {
            if (!window.XLSX) return showToast("جاري تحميل مكتبة الإكسل...", "info");
            const template = [{ "الاسم": "مثال", "المدرب": "اسم المدرب", "الحزام": "أبيض", "تاريخ الميلاد": "2000-01-01", "التليفون": "01000000000", "نوع الاشتراك": "غير عضو" }];
            const ws = window.XLSX.utils.json_to_sheet(template);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "لاعبين");
            window.XLSX.writeFile(wb, "template_لاعبين.xlsx");
            showToast("تم تحميل النموذج ✅", "success");
          }} className="btn btn-blue btn-sm" style={{ flex: 1 }}>📋 تحميل نموذج</button>
        </div>
      </div>

      {filtered.map(p => {
        const coach = coaches.find(c => c.id === p.coachId);
        const pd = playerDetails[p.id] || {};
        const isEdit = editId === p.id;

        return (
          <div key={p.id} className="player-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                {/* Checkbox للنقل والنسخ */}
                {(transferMode || copyMode) && (
                  <div className={`checkbox-custom ${selectedPlayers.includes(p.id) ? "checked" : ""}`}
                    onClick={() => setSelectedPlayers(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}>
                    {selectedPlayers.includes(p.id) && <span style={{ color: "white", fontSize: 13 }}>✓</span>}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b>{p.name}</b>
                    {pd.belt && <BeltBadge belt={pd.belt} />}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span>{coach?.name || "---"}</span>
                    {(() => { const lastBelt = pd.beltHistory?.[pd.beltHistory?.length - 1]; const beltDate = lastBelt?.date || pd.joinDate; return beltDate ? <span>· حزام منذ: {formatDate(beltDate)}</span> : null; })()}
                    {pd.subType && (() => { const st = SUB_TYPES.find(s => s.label === pd.subType); return st ? <span style={{ color: st.color, fontWeight: 700, fontSize: 11 }}>{st.icon} {st.price} جنيه</span> : null; })()}
                    <span className={`badge ${pd.regFeePaid ? "badge-green" : "badge-red"}`} style={{ fontSize: 10 }}>🏷 {pd.regFeePaid ? "قيد مسدد" : "قيد غير مسدد"}</span>
                    {pd.birthdate && (() => { const bd = pd.birthdate && typeof pd.birthdate === "string" ? new Date(pd.birthdate) : new Date(); const today = new Date(); const isToday = bd.getDate() === today.getDate() && bd.getMonth() === today.getMonth(); const parts2 = typeof pd.birthdate === "string" ? pd.birthdate.split("-") : []; return <span style={{ fontSize: 10, color: isToday ? "var(--yellow)" : "var(--muted)" }}>{isToday ? "🎂 عيد ميلاده النهارده!" : `${parts2.length===3 ? parts2[2]+"/"+parts2[1]+"/"+parts2[0] : pd.birthdate}`}</span>; })()}
                    {pd.phone && <a href={`tel:${pd.phone}`} style={{ fontSize: 10, color: "var(--accent2)" }}>📞 {pd.phone}</a>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {!transferMode && !copyMode && <>
                  <button onClick={() => setEditId(isEdit ? null : p.id)} className="btn btn-ghost btn-xs">✏️</button>
                  <button onClick={() => setConfirm({ msg: `حذف اللاعب "${p.name}"؟`, fn: () => { setPlayers(players.filter(x => x.id !== p.id)); showToast(`تم حذف اللاعب ${p.name}`, "info"); } })} className="btn btn-red btn-xs">🗑</button>
                </>}
              </div>
            </div>
            {isEdit && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div className="grid-2">
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>الحزام</label>
                    <select className="input-field" value={pd.belt || "أبيض"} onChange={e => {
                      const newBelt = e.target.value;
                      const history = pd.beltHistory || [];
                      const newHistory = [...history, { belt: newBelt, date: getToday() }];
                      setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, belt: newBelt, beltHistory: newHistory } });
                      showToast(`تم تحديث حزام ${p.name} إلى ${newBelt} 🥋`, "success");
                    }}>
                      {BELTS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
                    </select>
                    {pd.beltHistory && pd.beltHistory.length > 0 && (
                      <div style={{ marginTop: 8, background: "var(--surface2)", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 11, color: "var(--muted2)", marginBottom: 8, fontWeight: 700 }}>📅 تاريخ الأحزمة — اضغط للتعديل:</div>
                        {pd.beltHistory.map((h, i) => {
                          const beltObj = BELTS.find(b => b.label === h.belt);
                          const parts = (h.date && typeof h.date === "string") ? h.date.split("-") : [];
                          const fDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(h.date || "");
                          const isLast = i === pd.beltHistory.length - 1;
                          return (
                            <div key={i} style={{ padding: "8px 0", borderBottom: i < pd.beltHistory.length - 1 ? "1px solid var(--border)" : "none" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: beltObj?.color || "#888", border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
                                  <select value={h.belt} onChange={e => {
                                    const newHistory = pd.beltHistory.map((bh, bi) => bi === i ? { ...bh, belt: e.target.value } : bh);
                                    const newBelt = isLast ? e.target.value : pd.belt;
                                    setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, beltHistory: newHistory, belt: newBelt } });
                                    showToast("تم تحديث الحزام ✅", "success");
                                  }} style={{ fontSize: 12, background: "var(--bg)", color: isLast ? "var(--text)" : "var(--muted2)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px", fontWeight: isLast ? 800 : 400, fontFamily: "Tajawal" }}>
                                    {BELTS.map(b => <option key={b.label} value={b.label}>{b.label}</option>)}
                                  </select>
                                  {isLast && <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>الحالي</span>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <input type="date" value={h.date || ""} onChange={e => {
                                    const newHistory = pd.beltHistory.map((bh, bi) => bi === i ? { ...bh, date: e.target.value } : bh);
                                    setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, beltHistory: newHistory } });
                                    showToast("تم تحديث تاريخ الحزام ✅", "success");
                                  }} style={{ fontSize: 11, background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 6px", fontFamily: "Tajawal" }} />
                                  <button onClick={() => {
                                    if (pd.beltHistory.length <= 1) return showToast("لازم يفضل حزام واحد على الأقل", "error");
                                    setConfirm({ msg: `حذف حزام ${h.belt}؟`, fn: () => {
                                      const newHistory = pd.beltHistory.filter((_, bi) => bi !== i);
                                      const newBelt = newHistory[newHistory.length - 1]?.belt || "أبيض";
                                      setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, beltHistory: newHistory, belt: newBelt } });
                                      showToast("تم حذف الحزام", "info");
                                    }});
                                  }} className="btn btn-red btn-xs">🗑</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {/* إضافة حزام جديد */}
                        <button onClick={() => {
                          const newHistory = [...(pd.beltHistory || []), { belt: "أبيض", date: getToday() }];
                          setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, beltHistory: newHistory } });
                          showToast("تم إضافة حزام جديد ✅", "success");
                        }} className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 8 }}>➕ إضافة حزام</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>📅 تاريخ الحزام الحالي</label>
                    <input type="date" className="input-field" value={(() => { const last = pd.beltHistory?.[pd.beltHistory.length - 1]; return last?.date || pd.joinDate || ""; })()} onChange={e => {
                      const newHistory = pd.beltHistory?.length > 0
                        ? pd.beltHistory.map((h, i) => i === pd.beltHistory.length - 1 ? { ...h, date: e.target.value } : h)
                        : [{ belt: pd.belt || "أبيض", date: e.target.value }];
                      setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, beltHistory: newHistory, joinDate: e.target.value } });
                    }} />
                    {pd.joinDate && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>تاريخ الانضمام: {formatDate(pd.joinDate)}</div>}
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
                {/* ملاحظة طبية */}
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>⚕️ ملاحظة طبية</label>
                  <input className="input-field" placeholder="إصابة / حالة خاصة..." value={pd.medical || ""} onChange={e => setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, medical: e.target.value } })} />
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
function AdminPayments({ players, payments, setPayments, playerDetails = {} }) {
  const [d, setD] = useState(getToday());
  const [receiptNo, setReceiptNo] = useState("");
  const [receiptImg, setReceiptImg] = useState({});
  const [viewReceipt, setViewReceipt] = useState(null);
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
      {/* عارض صورة الإيصال */}
      {viewReceipt && (
        <div onClick={() => setViewReceipt(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img src={viewReceipt} alt="إيصال" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 12, boxShadow: "0 0 40px rgba(201,168,76,0.3)" }} />
            <button onClick={() => setViewReceipt(null)} className="btn btn-red btn-sm" style={{ position: "absolute", top: -12, left: -12 }}>✕</button>
          </div>
        </div>
      )}
      <div className="card">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>📅 تاريخ الدفع</label>
            <input type="date" className="input-field" style={{ marginBottom: 8 }} value={d} onChange={e => setD(e.target.value)} />
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>🧾 رقم الإيصال</label>
            <input className="input-field" style={{ marginBottom: 0 }} placeholder="مثال: 00123" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} />
          </div>
          <div style={{ textAlign: "center", paddingTop: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--accent)" }}>{players.filter(p => payments[p.id]?.paid).length}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>مسددين</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all", "الكل"], ["paid", "مسددين ✅"], ["unpaid", "غير مسددين ❌"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      <input className="input-field" placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.map(p => (
        <div key={p.id} className="player-row">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              {payments[p.id]?.date && <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 2 }}>📅 آخر دفع: {payments[p.id].date}</div>}
              {payments[p.id]?.receiptNo && <div style={{ fontSize: 11, color: "var(--accent2)", marginTop: 1 }}>🧾 إيصال رقم: {payments[p.id].receiptNo}</div>}
              {payments[p.id]?.history?.length > 0 && (
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  إجمالي: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{payments[p.id].history.reduce((s, h) => s + (h.amount || 0), 0)} جنيه</span>
                  · ({payments[p.id].history.length} دفعة)
                </div>
              )}
              {/* رفع صورة الإيصال */}
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input type="file" accept="image/*" id={`receipt_${p.id}`} style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      setReceiptImg(prev => ({ ...prev, [p.id]: ev.target.result }));
                      setPayments({ ...payments, [p.id]: { ...payments[p.id], receiptImg: ev.target.result } });
                      showToast("تم رفع صورة الإيصال ✅", "success");
                    };
                    reader.readAsDataURL(file);
                  }} />
                <button onClick={() => document.getElementById(`receipt_${p.id}`).click()}
                  className="btn btn-ghost btn-xs">📸 رفع إيصال</button>
                {payments[p.id]?.receiptImg && (
                  <button onClick={() => setViewReceipt(payments[p.id].receiptImg)}
                    className="btn btn-xs" style={{ background: "rgba(201,168,76,0.15)", color: "var(--gold)", border: "1px solid rgba(201,168,76,0.3)" }}>🧾 عرض</button>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={`badge ${payments[p.id]?.paid ? "badge-green" : "badge-red"}`}>
                {payments[p.id]?.paid ? "مسدد ✅" : "غير مسدد"}
              </span>
              <button onClick={() => {
                const cur = payments[p.id]?.paid;
                const currentHistory = payments[p.id]?.history || [];
                const newHistory = !cur ? [...currentHistory, { date: d, amount: (() => { const st = SUB_TYPES.find(s => s.label === (playerDetails?.[p.id]?.subType)); return st ? st.price : 300; })() }] : currentHistory;
                setPayments({ ...payments, [p.id]: { paid: !cur, date: !cur ? d : null, history: newHistory, receiptNo: !cur ? receiptNo : null, receiptImg: !cur ? (receiptImg[p.id] || null) : null } });
                showToast(!cur ? `تم تسجيل دفع ${p.name} ✅` : `تم إلغاء دفع ${p.name}`, !cur ? "success" : "info");
                if (!cur) setReceiptNo("");
              }} className={`btn btn-sm ${payments[p.id]?.paid ? "btn-ghost" : "btn-primary"}`}>
                {payments[p.id]?.paid ? "إلغاء" : "تسجيل دفع"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────── Admin Events ───────────
function AdminEvents({ events, setEvents, players, playerDetails, setPlayerDetails, coaches }) {
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>المسجلون ({registeredPlayers.length}):</div>
                  <button onClick={() => {
                    if (!window.XLSX) return showToast("جاري تحميل مكتبة الإكسل...", "info");
                    const today = new Date();
                    const data = registeredPlayers.map((p, idx) => {
                      const pd = playerDetails[p.id] || {};
                      const coach = coaches?.find(c => c.id === p.coachId);
                      const age = pd.birthdate ? today.getFullYear() - new Date(pd.birthdate).getFullYear() : "---";
                      return {
                        "م": idx + 1,
                        "اسم اللاعب": p.name,
                        "المدرب": coach?.name || "---",
                        "الحزام": pd.belt || "---",
                        "تاريخ الميلاد": pd.birthdate ? (() => { const p = typeof pd.birthdate === "string" ? pd.birthdate.split("-") : []; return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : String(pd.birthdate || "---"); })() : "---",
                        "السن": age,
                        "الوزن (كجم)": pd.weight || "---",
                        "الطول (سم)": pd.height || "---",
                        "نوع الاشتراك": pd.subType || "---",
                        "سداد رسوم الفعالية": pd.feePaid ? "✅ مسدد" : "❌ لم يسدد",
                        "سداد القيد": pd.regFeePaid ? "✅ مسدد" : "❌ لم يسدد",
                        "تليفون ولي الأمر": pd.phone || "---",
                        "تاريخ الانضمام": pd.joinDate || "---",
                      };
                    });
                    const ws = window.XLSX.utils.json_to_sheet(data);
                    // Set column widths
                    ws['!cols'] = [
                      {wch:4},{wch:20},{wch:15},{wch:12},{wch:14},{wch:6},
                      {wch:10},{wch:10},{wch:16},{wch:18},{wch:14},{wch:16},{wch:14}
                    ];
                    const wb = window.XLSX.utils.book_new();
                    window.XLSX.utils.book_append_sheet(wb, ws, ev.name.slice(0, 30));
                    window.XLSX.writeFile(wb, `مشاركين_${ev.name}_${ev.date}.xlsx`);
                    showToast(`تم تصدير بيانات ${registeredPlayers.length} لاعب ✅`, "success");
                  }} className="btn btn-blue btn-sm">📥 تصدير إكسل</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {registeredPlayers.map(p => {
                    const pd = playerDetails[p.id] || {};
                    const coach = coaches?.find(c => c.id === p.coachId);
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{p.name}</span>
                        {pd.feePaid ? <span className="badge badge-green" style={{ fontSize: 10 }}>✅ مسدد</span> : <span className="badge badge-red" style={{ fontSize: 10 }}>❌ لم يسدد</span>}
                        {pd.belt && <BeltBadge belt={pd.belt} />}
                        <button onClick={() => generateCertificate(p.name, pd.belt || "أبيض", coach?.name || "---", ev.name)}
                          className="btn btn-yellow btn-xs" style={{ color: "#000" }}>📜 شهادة</button>
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
function AdminReset({ attendance, setAttendance, payments, setPayments, logs, setLogs, players, coaches, playerDetails }) {
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

      {/* عن المطور */}
      <div className="card" style={{ marginTop: 14, textAlign: "center", borderColor: "var(--accent2)", background: "rgba(0,153,255,0.04)" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍💻</div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>عن التطبيق</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          تم تطوير هذا التطبيق خصيصاً لنادي الطالبية
        </div>
        <div style={{ fontWeight: 800, color: "var(--accent2)", fontSize: 16, marginBottom: 8 }}>Ahmed Sayed</div>
        <a href="https://wa.me/201142126158" target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "#25D36622", border: "1px solid #25D36644", borderRadius: 12, textDecoration: "none" }}>
          <span style={{ fontSize: 18 }}>📱</span>
          <span style={{ color: "#25D366", fontWeight: 800, fontSize: 14 }}>01142126158</span>
        </a>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>للتواصل والدعم الفني</div>
      </div>

      {/* نسخة احتياطية */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>💾 نسخة احتياطية يدوية</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          احفظ بيانات النادي كاملة على جهازك
          <br/><span style={{ color: "var(--accent)", fontSize: 11 }}>✅ النسخة الاحتياطية الأسبوعية تنزل تلقائياً كل 7 أيام</span>
        </div>
        <button onClick={() => {
          const backup = { date: new Date().toISOString(), players, coaches, attendance, payments, playerDetails };
          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `backup_talbia_${getToday()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          logAction("تم تصدير نسخة احتياطية يدوية");
          showToast("تم تحميل النسخة الاحتياطية ✅", "success");
        }} className="btn btn-blue btn-full" style={{ marginBottom: 8 }}>💾 تحميل نسخة احتياطية الآن</button>

        <button onClick={() => {
          const month = getToday().slice(0, 7);
          generateMonthlyReport(players, coaches, attendance, payments, playerDetails, month);
        }} className="btn btn-ghost btn-full" style={{ marginBottom: 8 }}>📊 تحميل تقرير الشهر الحالي</button>
      </div>

      {/* التقارير الشهرية السابقة */}
      {(() => {
        const reports = JSON.parse(localStorage.getItem("monthlyReports") || "[]");
        if (!reports.length) return null;
        return (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>📁 التقارير الشهرية السابقة</div>
            {reports.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>📊 تقرير {r.month}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {r.summary?.totalPlayers} لاعب · {r.summary?.activePlayers} نشط · {r.summary?.totalRevenue} جنيه
                  </div>
                </div>
                <button onClick={() => {
                  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `تقرير_${r.month}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast(`تم تحميل تقرير ${r.month}`, "success");
                }} className="btn btn-ghost btn-sm">📥 تحميل</button>
              </div>
            ))}
          </div>
        );
      })()}
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
const DAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

function AdminSettings({ trainingSettings, setTrainingSettings, coaches }) {
  const [localSettings, setLocalSettings] = useState(trainingSettings || {});
  const [selectedCoach, setSelectedCoach] = useState(coaches.filter(c=>!c.isAdmin)[0]?.id || "");

  const getCoachSchedule = (coachId) => localSettings[coachId] || { days: [], sessions: {} };

  const toggleDay = (coachId, dayIdx) => {
    const schedule = getCoachSchedule(coachId);
    const days = schedule.days.includes(dayIdx)
      ? schedule.days.filter(d => d !== dayIdx)
      : [...schedule.days, dayIdx].sort();
    const newSched = { ...schedule, days };
    setLocalSettings({ ...localSettings, [coachId]: newSched });
  };

  const setSessionTime = (coachId, dayIdx, field, val) => {
    const schedule = getCoachSchedule(coachId);
    const sessions = { ...schedule.sessions, [dayIdx]: { ...(schedule.sessions[dayIdx] || {}), [field]: val } };
    setLocalSettings({ ...localSettings, [coachId]: { ...schedule, sessions } });
  };

  const coach = coaches.find(c => String(c.id) === String(selectedCoach));
  const schedule = selectedCoach ? getCoachSchedule(selectedCoach) : null;

  return (
    <div>
      <div className="section-title">⚙️ جداول التدريب</div>
      <select className="input-field" value={selectedCoach} onChange={e => setSelectedCoach(e.target.value)}>
        {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {coach && schedule && (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 12 }}>📅 أيام تدريب {coach.name}</div>
          {/* اختيار الأيام */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {DAYS_AR.map((day, idx) => (
              <button key={idx} onClick={() => toggleDay(selectedCoach, idx)}
                className={`btn btn-sm ${schedule.days.includes(idx) ? "btn-primary" : "btn-ghost"}`}>
                {day}
              </button>
            ))}
          </div>
          {/* وقت كل يوم */}
          {schedule.days.map(dayIdx => (
            <div key={dayIdx} className="card" style={{ marginBottom: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--accent)" }}>📅 {DAYS_AR[dayIdx]}</div>
              <div className="grid-2">
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>وقت البداية</label>
                  <select className="input-field" style={{ marginBottom: 0 }}
                    value={schedule.sessions[dayIdx]?.startHour ?? 17}
                    onChange={e => setSessionTime(selectedCoach, dayIdx, "startHour", Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}:00</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>المدة</label>
                  <select className="input-field" style={{ marginBottom: 0 }}
                    value={schedule.sessions[dayIdx]?.duration ?? 60}
                    onChange={e => setSessionTime(selectedCoach, dayIdx, "duration", Number(e.target.value))}>
                    {[60, 90, 120].map(d => <option key={d} value={d}>{d} دقيقة</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => { setTrainingSettings(localSettings); showToast(`تم حفظ جدول ${coach.name} ✅`, "success"); }} className="btn btn-primary btn-full">💾 حفظ الجدول</button>
        </div>
      )}

      {/* عرض جداول كل المدربين */}
      <div className="section-title" style={{ marginTop: 16 }}>📋 ملخص الجداول</div>
      {coaches.filter(c => !c.isAdmin).map(c => {
        const sch = getCoachSchedule(c.id);
        return sch.days.length > 0 ? (
          <div key={c.id} className="player-row" style={{ padding: "10px 14px" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🥋 {c.name}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {sch.days.map(d => (
                <span key={d} className="badge badge-blue">
                  {DAYS_AR[d]} {sch.sessions[d]?.startHour ?? 17}:00
                </span>
              ))}
            </div>
          </div>
        ) : null;
      })}
    </div>
  );
}


// ─────────── تغيير الباسورد ───────────
function ChangePassword({ coach, coaches, setCoaches }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  const handleChange = () => {
    if (oldPass !== coach.password) return showToast("كلمة المرور القديمة غلط ❌", "error");
    if (newPass.length < 4) return showToast("كلمة المرور الجديدة أقل من 4 أرقام", "error");
    if (newPass !== confirm) return showToast("كلمة المرور الجديدة مش متطابقة ❌", "error");
    setCoaches(coaches.map(c => c.id === coach.id ? { ...c, password: newPass } : c));
    showToast("تم تغيير كلمة المرور بنجاح ✅", "success");
    setOldPass(""); setNewPass(""); setConfirm(""); setShow(false);
  };

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>🔐 تغيير كلمة المرور</div>
        <button onClick={() => setShow(!show)} className="btn btn-ghost btn-sm">{show ? "إغلاق" : "تغيير"}</button>
      </div>
      {show && (
        <div style={{ marginTop: 12 }}>
          <input className="input-field" type="password" placeholder="كلمة المرور القديمة" value={oldPass} onChange={e => setOldPass(e.target.value)} />
          <input className="input-field" type="password" placeholder="كلمة المرور الجديدة" value={newPass} onChange={e => setNewPass(e.target.value)} />
          <input className="input-field" type="password" placeholder="تأكيد كلمة المرور" value={confirm} onChange={e => setConfirm(e.target.value)} />
          <button onClick={handleChange} className="btn btn-primary btn-full">💾 حفظ</button>
        </div>
      )}
    </div>
  );
}


// ─────────── تقويم النادي ───────────
function ClubCalendar({ events, trainingSettings, coaches, coachId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const DAYS_AR_SHORT = ["أح", "إث", "ثل", "أر", "خم", "جم", "سب"];
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  const isTrainingDay = (dayNum) => {
    const d = new Date(year, month, dayNum);
    const dayIdx = d.getDay();
    if (coachId) {
      const sched = trainingSettings?.[coachId];
      return sched?.days?.includes(dayIdx) || false;
    }
    return Object.values(trainingSettings || {}).some(s => s?.days?.includes(dayIdx));
  };

  const getEventForDay = (dayNum) => {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`;
    return events.find(e => e.date === dateStr);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setCurrentDate(new Date(year, month-1, 1))} className="btn btn-ghost btn-sm">◀</button>
        <div style={{ fontWeight: 800, fontSize: 15 }}>📅 {MONTHS_AR[month]} {year}</div>
        <button onClick={() => setCurrentDate(new Date(year, month+1, 1))} className="btn btn-ghost btn-sm">▶</button>
      </div>
      <div className="calendar-grid" style={{ marginBottom: 8 }}>
        {DAYS_AR_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--muted)", fontWeight: 700, padding: "4px 0" }}>{d}</div>)}
      </div>
      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const training = isTrainingDay(day);
          const ev = getEventForDay(day);
          return (
            <div key={i} className={`cal-day ${isToday ? "today" : ev ? "event" : training ? "training" : ""}`} title={ev ? ev.name : training ? "يوم تدريب" : ""}>
              <span>{day}</span>
              {ev && <span style={{ fontSize: 7 }}>🏆</span>}
              {!ev && training && <span style={{ fontSize: 7 }}>🥋</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11 }}>
        <span style={{ color: "var(--accent)" }}>🥋 تدريب</span>
        <span style={{ color: "var(--yellow)" }}>🏆 فعالية</span>
        <span style={{ color: "white" }}>⬜ اليوم</span>
      </div>
    </div>
  );
}

// ─────────── نظام الرسائل الداخلية ───────────
function InternalMessages({ user, coaches, messages, setMessages }) {
  const [newMsg, setNewMsg] = useState("");
  const [toCoach, setToCoach] = useState("");
  const myMessages = messages.filter(m => m.to === String(user.id) || (user.isAdmin && m.toAdmin));
  const unread = myMessages.filter(m => !m.read).length;

  const send = () => {
    if (!newMsg.trim()) return showToast("اكتب رسالة أولاً", "error");
    const target = user.isAdmin ? toCoach : "admin";
    const msg = {
      id: Date.now(), from: String(user.id), fromName: user.name,
      to: target, toAdmin: target === "admin",
      text: newMsg, time: new Date().toLocaleString("ar-EG"), read: false
    };
    setMessages([...messages, msg]);
    showToast("تم إرسال الرسالة ✅", "success");
    setNewMsg(""); setToCoach("");
  };

  const markRead = (msgId) => setMessages(messages.map(m => m.id === msgId ? { ...m, read: true } : m));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div className="section-title" style={{ margin: 0 }}>💬 الرسائل الداخلية</div>
        {unread > 0 && <span className="badge badge-red">{unread} جديد</span>}
      </div>

      {/* إرسال رسالة */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📤 رسالة جديدة</div>
        {user.isAdmin && (
          <select className="input-field" value={toCoach} onChange={e => setToCoach(e.target.value)}>
            <option value="">اختر المدرب</option>
            {coaches.filter(c => !c.isAdmin).map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        )}
        <textarea className="input-field" style={{ height: 70, resize: "none" }} placeholder="اكتب رسالتك..." value={newMsg} onChange={e => setNewMsg(e.target.value)} />
        <button onClick={send} className="btn btn-primary btn-full">📤 إرسال</button>
      </div>

      {/* الرسائل الواردة */}
      <div className="section-title">📥 الرسائل الواردة</div>
      {myMessages.length === 0 && <div style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>لا توجد رسائل</div>}
      {myMessages.sort((a,b) => b.id - a.id).map(m => (
        <div key={m.id} className="player-row" style={{ borderRight: `4px solid ${m.read ? "var(--border)" : "var(--accent2)"}` }} onClick={() => markRead(m.id)}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>من: {m.fromName}</div>
            {!m.read && <span className="badge badge-blue">جديد</span>}
          </div>
          <div style={{ fontSize: 13, margin: "6px 0" }}>{m.text}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>🕐 {m.time}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────── التقييم الأسبوعي ───────────
function WeeklyRating({ myPlayers, playerDetails, setPlayerDetails, coachName }) {
  const weekKey = `week_${Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))}`;
  return (
    <div>
      <div className="section-title">⭐ التقييم الأسبوعي</div>
      {myPlayers.map(p => {
        const pd = playerDetails[p.id] || {};
        const ratings = pd.weeklyRatings || {};
        const currentRating = ratings[weekKey] || { stars: 0, note: "" };
        return (
          <div key={p.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 2 }}>
                {[1,2,3,4,5].map(star => (
                  <span key={star} onClick={() => {
                    const newRatings = { ...ratings, [weekKey]: { ...currentRating, stars: star } };
                    setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, weeklyRatings: newRatings } });
                    showToast(`تم تقييم ${p.name} بـ ${star} نجوم`, "success");
                  }} style={{ fontSize: 22, cursor: "pointer", color: star <= currentRating.stars ? "var(--yellow)" : "var(--border2)" }}>★</span>
                ))}
              </div>
            </div>
            <input className="input-field" style={{ marginBottom: 0, fontSize: 12 }}
              placeholder="ملاحظة أسبوعية..." value={currentRating.note}
              onChange={e => {
                const newRatings = { ...ratings, [weekKey]: { ...currentRating, note: e.target.value } };
                setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, weeklyRatings: newRatings } });
              }} />
          </div>
        );
      })}
    </div>
  );
}

// ─────────── خطة التدريب ───────────
function TrainingPlan({ coach, trainingPlan, setTrainingPlan }) {
  const DAYS_AR_LOCAL = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(today);
  const planKey = `${coach.id}_${selectedDay}`;
  const plan = trainingPlan[planKey] || { warmup: "", main: "", cool: "", notes: "" };

  const update = (field, val) => setTrainingPlan({ ...trainingPlan, [planKey]: { ...plan, [field]: val } });

  return (
    <div>
      <div className="section-title">📋 خطة التدريب</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {DAYS_AR_LOCAL.map((d, i) => (
          <button key={i} onClick={() => setSelectedDay(i)}
            className={`btn btn-sm ${selectedDay === i ? "btn-primary" : "btn-ghost"}`}>
            {d}
          </button>
        ))}
      </div>
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 12, color: "var(--accent)" }}>📅 {DAYS_AR_LOCAL[selectedDay]}</div>
        {[["warmup", "🔥 الإحماء"], ["main", "💪 التدريب الأساسي"], ["cool", "🧘 التهدئة"], ["notes", "📝 ملاحظات"]].map(([field, label]) => (
          <div key={field} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{label}</label>
            <textarea className="input-field" style={{ height: 60, resize: "none", marginBottom: 0 }}
              placeholder={`اكتب ${label.replace(/[🔥💪🧘📝]/g, "")}...`}
              value={plan[field]} onChange={e => update(field, e.target.value)} />
          </div>
        ))}
        <button onClick={() => showToast("تم حفظ خطة التدريب ✅", "success")} className="btn btn-primary btn-full">💾 حفظ الخطة</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════ COACH VIEW ═══════════════════════
function CoachView({ coach, players, setPlayers, attendance, setAttendance, payments, notes, setNotes, playerDetails, setPlayerDetails, events, logs, setLogs, playerExtra, setPlayerExtra, trainingSettings, coaches, setCoaches, messages, setMessages, trainingPlan, setTrainingPlan }) {
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
      {/* تذكير موعد التدريب - مخصص لكل مدرب */}
      {(() => {
        const now = new Date();
        const hour = now.getHours();
        const todayIdx = now.getDay();
        const coachSched = trainingSettings?.[coach.id];
        if (!coachSched) return null;
        const session = coachSched.sessions?.[todayIdx];
        if (!coachSched.days?.includes(todayIdx) || !session) return null;
        const startH = session.startHour ?? 17;
        const endH = startH + Math.floor((session.duration ?? 60) / 60);
        const isTrainingTime = hour >= startH - 1 && hour <= endH;
        if (!isTrainingTime) return null;
        const DAYS_AR_LOCAL = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
        return (
          <div className="card" style={{ borderColor: "var(--accent)", background: "rgba(0,212,170,0.05)", marginBottom: 10, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>⏰</div>
            <div style={{ fontWeight: 800, color: "var(--accent)", fontSize: 15 }}>
              {hour < startH ? `تدريب ${DAYS_AR_LOCAL[todayIdx]} بعد شوية! (${startH}:00) 💪` : `وقت التدريب دلوقتي! يلا يا كابتن 🔥`}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>المدة: {session.duration ?? 60} دقيقة</div>
          </div>
        );
      })()}

      {/* اقتراحات ذكية */}
      {(() => {
        const suggestions = [];
        myPlayers.forEach(p => {
          const att = getDetailedAttendance(p.id, coach.id, attendance);
          const pd = playerDetails[p.id] || {};
          if (att.count <= 2 && att.count > 0) suggestions.push({ name: p.name, msg: "محتاج تشجيع — حضر أقل من 3 أيام 💪", color: "var(--orange)" });
          if (att.percentage === 100 && att.count >= 8) suggestions.push({ name: p.name, msg: "أداء ممتاز — يستاهل مكافأة ⭐", color: "var(--accent)" });
          if (!checkSubStatus(payments[p.id]?.date).valid && att.count > 5) suggestions.push({ name: p.name, msg: "منتظم في الحضور لكن الاشتراك منتهي — تذكيره 📞", color: "var(--yellow)" });
          if (pd.rating && pd.rating >= 4 && att.count < 5) suggestions.push({ name: p.name, msg: "تقييمه عالي بس حضوره قليل — يحتاج متابعة 🎯", color: "var(--accent2)" });
        });
        if (!suggestions.length) return null;
        return (
          <div className="card" style={{ marginBottom: 10, borderColor: "var(--accent2)", background: "rgba(0,153,255,0.04)" }}>
            <div style={{ fontWeight: 800, color: "var(--accent2)", marginBottom: 8, fontSize: 13 }}>🤖 اقتراحات ذكية</div>
            {suggestions.slice(0, 3).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: s.color, fontWeight: 700, minWidth: 70 }}>{s.name}</span>
                <span style={{ fontSize: 11, color: "var(--muted2)" }}>{s.msg}</span>
              </div>
            ))}
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

      <ChangePassword coach={coach} coaches={coaches} setCoaches={setCoaches} />

      <div className="tab-bar">
        {[["today", "📋 تحضير"], ["reports", "📊 تقارير"], ["notes", "📝 ملاحظات"], ["events", "🏆 فعاليات"], ["calendar", "📅 تقويم"], ["plan", "📋 خطة"], ["rating", "⭐ تقييم"], ["messages", "💬 رسائل"]].map(([k, l]) => (
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b>{p.name}</b>
                      {pd.belt && <BeltBadge belt={pd.belt} />}
                      {pd.birthdate && typeof pd.birthdate === "string" && (() => { const d = new Date(pd.birthdate); const t = new Date(); return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth() ? <span style={{fontSize:12}}>🎂</span> : null; })()}
                      {pd.medical && <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, background: "rgba(255,69,96,0.1)", padding: "2px 6px", borderRadius: 6 }}>⚕️ {pd.medical}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: sub.valid ? "var(--accent)" : "var(--red)" }}>{sub.msg}</span>
                      {pd.phone && <a href={`https://wa.me/2${pd.phone}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#25D366", textDecoration: "none" }}>📱 واتساب</a>}
                      {!isP && pd.phone && (() => {
                        const keys = Object.keys(attendance).filter(k => k.startsWith(`${coach.id}_`)).sort().slice(-3);
                        const consecutive = keys.filter(k => attendance[k]?.[p.id] !== "present").length;
                        return consecutive >= 2 ? (
                          <button onClick={() => notifyAbsence(p, pd, coach.name, consecutive)}
                            className="btn btn-xs" style={{ fontSize: 10, background: "#25D36622", color: "#25D366", border: "1px solid #25D36644" }}>
                            ⚠️ إشعار غياب
                          </button>
                        ) : null;
                      })()}
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

      {tab === "reports" && <MonthlyComparison players={myPlayers} coaches={[coach]} attendance={attendance} payments={payments} coachId={coach.id} />}
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
            <AttendanceHeatmap playerId={p.id} coachId={coach.id} attendance={attendance} />
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
      {tab === "calendar" && <ClubCalendar events={events} trainingSettings={trainingSettings} coaches={coaches} coachId={coach.id} />}
      {tab === "plan" && <TrainingPlan coach={coach} trainingPlan={trainingPlan} setTrainingPlan={setTrainingPlan} />}
      {tab === "rating" && <WeeklyRating myPlayers={myPlayers} playerDetails={playerDetails} setPlayerDetails={setPlayerDetails} coachName={coach.name} />}
      {tab === "messages" && (() => {
        const unread = messages.filter(m => m.to === String(coach.id) && !m.read).length;
        return (
          <div>
            {unread > 0 && <div className="card" style={{ borderColor: "var(--accent2)", background: "rgba(0,153,255,0.05)", marginBottom: 10, textAlign: "center" }}>
              <span className="badge badge-blue" style={{ fontSize: 14, padding: "6px 16px" }}>🔔 عندك {unread} رسالة جديدة!</span>
            </div>}
            <InternalMessages user={coach} coaches={coaches} messages={messages} setMessages={setMessages} />
          </div>
        );
      })()}
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div className={`checkbox-custom ${feePaid ? "checked" : ""}`} style={{ borderColor: feePaid ? "var(--yellow)" : "var(--border2)", background: feePaid ? "var(--yellow)" : "var(--bg)" }} onClick={() => {
                              setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, feePaid: !feePaid } });
                              showToast(!feePaid ? `تم تأكيد سداد قيد ${p.name} 💰` : `تم إلغاء سداد قيد ${p.name}`, !feePaid ? "success" : "info");
                            }}>
                              {feePaid && <span style={{ color: "#000", fontSize: 13 }}>✓</span>}
                            </div>
                            <span style={{ fontSize: 12, color: feePaid ? "var(--yellow)" : "var(--muted)" }}>سدد القيد</span>
                          </div>
                          {/* نتيجة الاختبار */}
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {["لم يمتحن", "نجح ✅", "رسب ❌"].map(result => (
                              <button key={result} onClick={() => {
                                setPlayerDetails({ ...playerDetails, [p.id]: { ...pd, examResult: result } });
                                if (result === "نجح ✅") {
                                  showToast(`🎉 ${p.name} نجح في الاختبار!`, "success");
                                  // رسالة تهنئة تلقائية
                                  if (pd.phone) setTimeout(() => sendExamCongrats(p, pd, pd.belt, ev.name, "المدرب"), 500);
                                }
                              }} className={`btn btn-xs ${pd.examResult === result ? (result === "نجح ✅" ? "btn-primary" : result === "رسب ❌" ? "btn-red" : "btn-ghost") : "btn-ghost"}`}>
                                {result}
                              </button>
                            ))}
                            {pd.examResult === "نجح ✅" && pd.phone && (
                              <button onClick={() => sendExamCongrats(p, pd, pd.belt, ev.name, "المدرب")}
                                className="btn btn-xs" style={{ background: "#25D36622", color: "#25D366", border: "1px solid #25D36644", fontSize: 10 }}>
                                🎉 بعت تهنئة
                              </button>
                            )}
                          </div>
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