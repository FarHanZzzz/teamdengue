import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import { endpoints, API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { RISK_HEX } from "../lib/risk";
import RiskBadge from "../components/RiskBadge";

const PROFILE_KEY = "pd_community_profile";
const TABS_BASE = [
  { id: "areas", label: "Areas", icon: "🗺️" },
  { id: "tasks", label: "Tasks", icon: "📋" },
  { id: "chat", label: "Chat", icon: "💬" },
];

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null;
  } catch {
    return null;
  }
}

function ClickPicker({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function Community() {
  const { isAdmin } = useAuth();
  const [districts, setDistricts] = useState([]);
  const [districtId, setDistrictId] = useState("");
  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState(null);
  const [tab, setTab] = useState("areas");
  const [profile, setProfile] = useState(loadProfile());
  const [showJoin, setShowJoin] = useState(false);

  const tabs = isAdmin ? [...TABS_BASE, { id: "dispatch", label: "Dispatch", icon: "🚀" }] : TABS_BASE;

  useEffect(() => {
    endpoints.districts().then((d) => {
      setDistricts(d);
      const def = d.find((x) => x.name === "Dhaka") || d[0];
      if (def) setDistrictId(String(def.id));
    });
  }, []);

  useEffect(() => {
    if (!districtId) return;
    endpoints.wards(districtId).then((w) => {
      setWards(w);
      setWard((cur) => (cur && w.some((x) => x.id === cur.id) ? cur : w[0] || null));
    });
  }, [districtId]);

  const saveProfile = (p) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setProfile(p);
  };

  const district = districts.find((d) => String(d.id) === String(districtId));

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">Community response</p>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Mobilise your ward</h1>
        </div>
        <button
          onClick={() => setShowJoin(true)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            profile ? "bg-emerald-50 text-emerald-700" : "bg-brand-600 text-white"
          }`}
        >
          {profile ? `👤 ${profile.name.split(" ")[0]}` : "Join community"}
        </button>
      </div>

      {/* City + ward selectors */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <select className="input" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className="input"
          value={ward?.id || ""}
          onChange={(e) => setWard(wards.find((w) => w.id === Number(e.target.value)) || null)}
        >
          {wards.map((w) => (
            <option key={w.id} value={w.id}>{w.name} · {w.area_name}</option>
          ))}
        </select>
      </div>

      {/* Selected ward summary */}
      {ward && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-ink-900 p-4 text-white">
          <div>
            <p className="text-sm font-bold">{ward.name} · {ward.area_name}</p>
            <p className="text-xs text-slate-300">{district?.name} · pop {ward.population.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <RiskBadge level={ward.risk_level} score={ward.risk_score} />
            <p className="mt-1 text-xs text-slate-300">~{ward.est_affected.toLocaleString()} may be affected</p>
          </div>
        </div>
      )}

      {/* Tabs (segmented, mobile-first) */}
      <div className="sticky top-[60px] z-20 mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tt) => (
          <button
            key={tt.id}
            onClick={() => setTab(tt.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
              tab === tt.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
            }`}
          >
            <span className="mr-1">{tt.icon}</span>{tt.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "areas" && <AreasTab district={district} wards={wards} selected={ward} onSelect={(w) => { setWard(w); }} />}
        {tab === "tasks" && ward && <TasksTab ward={ward} profile={profile} requireProfile={() => setShowJoin(true)} />}
        {tab === "chat" && ward && <ChatTab ward={ward} profile={profile} requireProfile={() => setShowJoin(true)} />}
        {tab === "dispatch" && isAdmin && ward && <DispatchTab wards={wards} initialWard={ward} />}
      </div>

      {showJoin && (
        <JoinModal
          wards={wards}
          profile={profile}
          onClose={() => setShowJoin(false)}
          onSave={async (p) => {
            try {
              await endpoints.communityJoin({ ward_id: p.ward_id, name: p.name, phone: p.phone || "", role: p.role });
            } catch { /* still save locally */ }
            saveProfile(p);
            setShowJoin(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Areas ---------------- */
function AreasTab({ district, wards, selected, onSelect }) {
  if (!district) return null;
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div style={{ height: 280 }}>
          <MapContainer center={[district.lat, district.lon]} zoom={11} className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM &copy; CARTO" />
            {wards.map((w) => (
              <CircleMarker
                key={w.id}
                center={[w.lat, w.lon]}
                radius={selected?.id === w.id ? 11 : 8}
                pathOptions={{ color: "#fff", weight: selected?.id === w.id ? 3 : 1.5, fillColor: RISK_HEX[w.risk_level], fillOpacity: 0.9 }}
                eventHandlers={{ click: () => onSelect(w) }}
              >
                <Tooltip direction="top">{w.name} · {w.area_name} — {w.risk_level}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <p className="bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Each dot is a ward. Tap a hotspot to focus its community. Colour = predicted dengue risk.
        </p>
      </div>

      <div className="space-y-2">
        {wards.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelect(w)}
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
              selected?.id === w.id ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: RISK_HEX[w.risk_level] }} />
              <div>
                <p className="text-sm font-semibold text-slate-800">{w.name} · {w.area_name}</p>
                <p className="text-xs text-slate-500">~{w.est_affected.toLocaleString()} may be affected · {w.breeding_sites} breeding sites</p>
              </div>
            </div>
            <RiskBadge level={w.risk_level} score={w.risk_score} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Tasks ---------------- */
function TasksTab({ ward, profile, requireProfile }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(0);

  const load = () => endpoints.dispatchList(ward.id).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, [ward.id]);

  const act = async (id, status) => {
    if (!profile) return requireProfile();
    setBusy(id);
    try {
      await endpoints.dispatchUpdate(id, status, profile.name);
      await load();
    } finally {
      setBusy(0);
    }
  };

  if (items.length === 0)
    return <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">No active field tasks for this ward yet.</div>;

  const STATUS = {
    pending: { c: "bg-amber-50 text-amber-700", t: "Pending" },
    acknowledged: { c: "bg-blue-50 text-blue-700", t: "Team en route" },
    completed: { c: "bg-emerald-50 text-emerald-700", t: "Completed" },
  };

  return (
    <div className="space-y-3">
      {items.map((d) => (
        <div key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {d.image_url && (
            <img src={`${API_BASE}${d.image_url}`} alt="location" className="h-40 w-full object-cover" />
          )}
          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${RISK_HEX[d.priority]}22`, color: RISK_HEX[d.priority] }}>
                {d.priority.toUpperCase()}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[d.status]?.c}`}>{STATUS[d.status]?.t}</span>
            </div>
            <h3 className="mt-2 font-bold text-slate-900">{d.title}</h3>
            {d.message && <p className="mt-1 text-sm text-slate-600">{d.message}</p>}
            {d.location_label && <p className="mt-2 text-sm font-medium text-slate-700">📍 {d.location_label}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`https://www.google.com/maps?q=${d.target_lat},${d.target_lon}`}
                target="_blank" rel="noreferrer"
                className="btn-outline px-3 py-1.5 text-xs"
              >
                🧭 Navigate
              </a>
              {d.status === "pending" && (
                <button onClick={() => act(d.id, "acknowledged")} disabled={busy === d.id} className="btn-primary px-3 py-1.5 text-xs">
                  ✋ I'm on it
                </button>
              )}
              {d.status === "acknowledged" && (
                <button onClick={() => act(d.id, "completed")} disabled={busy === d.id} className="btn px-3 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700">
                  ✓ Mark done
                </button>
              )}
            </div>
            {d.acknowledged_by && <p className="mt-2 text-[11px] text-slate-400">Responder: {d.acknowledged_by}{d.completed_by && ` · done by ${d.completed_by}`}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Chat ---------------- */
function ChatTab({ ward, profile, requireProfile }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [announce, setAnnounce] = useState(false);
  const endRef = useRef();

  const load = () => endpoints.chatList(ward.id).then(setMsgs).catch(() => setMsgs([]));
  useEffect(() => { load(); }, [ward.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!profile) return requireProfile();
    if (!text.trim()) return;
    const body = { ward_id: ward.id, author_name: profile.name, role: profile.role, text, kind: announce ? "announcement" : "message" };
    setText("");
    await endpoints.chatPost(body);
    await load();
  };

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
        {ward.name} · {ward.area_name} community
      </div>
      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => {
          const mine = profile && m.author_name === profile.name && m.kind !== "announcement";
          if (m.kind === "announcement")
            return (
              <div key={m.id} className="mx-auto max-w-[90%] rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
                📢 {m.text}
              </div>
            );
          return (
            <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "ml-auto bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {!mine && <p className="text-[10px] font-bold opacity-70">{m.author_name}</p>}
              {m.text}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="border-t border-slate-100 p-2">
        {profile?.role === "commissioner" || profile?.role === "admin" ? (
          <label className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} /> Post as announcement
          </label>
        ) : null}
        <div className="flex gap-2">
          <input className="input" placeholder={profile ? "Message your community…" : "Join to chat"} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary px-4">Send</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Dispatch (admin) ---------------- */
function DispatchTab({ wards, initialWard }) {
  const [wardId, setWardId] = useState(initialWard.id);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState("High");
  const [point, setPoint] = useState({ lat: initialWard.lat, lon: initialWard.lon });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [recent, setRecent] = useState([]);

  const w = wards.find((x) => x.id === Number(wardId)) || initialWard;
  useEffect(() => { setPoint({ lat: w.lat, lon: w.lon }); }, [wardId]);
  useEffect(() => { endpoints.dispatchList().then((d) => setRecent(d.slice(0, 5))).catch(() => {}); }, [toast]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await endpoints.communityUpload(file);
      setImageUrl(r.url);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await endpoints.dispatchCreate({
      ward_id: Number(wardId), title, message, location_label: label, priority,
      target_lat: point.lat, target_lon: point.lon, image_url: imageUrl, created_by: "Super Admin",
    });
    setToast(`Dispatched to ${w.name} · ${w.area_name}. Residents notified.`);
    setTitle(""); setMessage(""); setLabel(""); setImageUrl("");
    setTimeout(() => setToast(""), 4000);
  };

  return (
    <div className="space-y-4">
      {toast && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{toast}</div>}
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={wardId} onChange={(e) => setWardId(e.target.value)}>
            {wards.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.area_name}</option>)}
          </select>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {["Critical", "High", "Medium", "Low"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <input className="input" placeholder="Task title (e.g. Clear stagnant pond)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" rows={2} placeholder="Instructions for the team…" value={message} onChange={(e) => setMessage(e.target.value)} />
        <input className="input" placeholder="Location label (e.g. behind Ward 30 school)" value={label} onChange={(e) => setLabel(e.target.value)} />

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">Tap the map to mark exactly where to go</p>
          <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height: 220 }}>
            <MapContainer center={[w.lat, w.lon]} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OSM &copy; CARTO" />
              <ClickPicker onPick={(lat, lon) => setPoint({ lat, lon })} />
              <CircleMarker center={[point.lat, point.lon]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#C0392B", fillOpacity: 1 }} />
            </MapContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Pin: {point.lat.toFixed(4)}, {point.lon.toFixed(4)}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600">Location photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} className="mt-1 text-sm" />
          {uploading && <p className="text-xs text-slate-400">Uploading…</p>}
          {imageUrl && <img src={`${API_BASE}${imageUrl}`} alt="preview" className="mt-2 h-24 rounded-lg object-cover" />}
        </div>

        <button className="btn-primary w-full py-2.5">🚀 Dispatch to community</button>
      </form>

      {recent.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent dispatches</p>
          <div className="space-y-2">
            {recent.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 text-sm">
                <span className="font-medium text-slate-700">{d.title} <span className="text-slate-400">· {d.ward}</span></span>
                <span className="text-xs text-slate-500">{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Join modal ---------------- */
function JoinModal({ wards, profile, onClose, onSave }) {
  const [name, setName] = useState(profile?.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [wardId, setWardId] = useState(profile?.ward_id || wards[0]?.id || "");
  const [role, setRole] = useState(profile?.role || "volunteer");

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900">Join your community</h2>
        <p className="text-sm text-slate-500">Become a potential responder — every citizen can help.</p>
        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select className="input" value={wardId} onChange={(e) => setWardId(Number(e.target.value))}>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.area_name}</option>)}
          </select>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="volunteer">Volunteer</option>
            <option value="commissioner">Ward Commissioner</option>
          </select>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button
            onClick={() => name.trim() && wardId && onSave({ name, phone, ward_id: Number(wardId), role })}
            className="btn-primary flex-1"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
