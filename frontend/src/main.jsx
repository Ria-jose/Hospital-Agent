import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, Check, Clock3, HeartPulse, ShieldCheck, Stethoscope, UsersRound } from 'lucide-react';
import './styles.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const wardLabels = { general: 'General care', emergency: 'Emergency care', mental_health: 'Mental health' };

function App() {
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ name: '', age: '', symptoms: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refreshDoctors() {
    try {
      const response = await fetch(`${API}/api/doctors`);
      if (response.ok) setDoctors(await response.json());
    } catch { /* The intake form remains usable while the API reconnects. */ }
  }
  useEffect(() => { refreshDoctors(); }, []);

  async function submit(event) {
    event.preventDefault(); setError(''); setResult(null); setLoading(true);
    try {
      const response = await fetch(`${API}/api/triage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, age: Number(form.age) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || 'Could not submit intake. Please try again.');
      setResult(body); setForm({ name: '', age: '', symptoms: '' }); await refreshDoctors();
    } catch (err) { setError(err.message === 'Failed to fetch' ? 'The intake service is unavailable. Please try again shortly.' : err.message); }
    finally { setLoading(false); }
  }

  const available = doctors.filter(d => d.status === 'active').length;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><HeartPulse size={20}/></span> carepath<span className="brand-dot">.</span></a><div className="secure"><ShieldCheck size={15}/> Private patient intake</div></header>
    <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot"/> HERE FOR YOU, EVERY STEP</div><h1>Let’s get you to<br/><em>the right care.</em></h1><p>Tell us what’s going on. We’ll connect you with the right care team and help you take the next step.</p><div className="hero-meta"><span><ShieldCheck size={16}/> Your information is handled privately</span><span><Clock3 size={16}/> Takes about 2 minutes</span></div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-icon"><Activity size={47} strokeWidth={1.4}/></div><div className="float-card float-top"><span className="float-icon mint"><Stethoscope size={17}/></span><span><b>Care, connected</b><small>One thoughtful step at a time</small></span></div><div className="float-card float-bottom"><span className="float-icon peach"><HeartPulse size={17}/></span><span><b>Here when it matters</b><small>Support for every kind of need</small></span></div></div></section>
      <section className="workspace"><div className="intake-card"><div className="card-heading"><div><div className="section-kicker">PATIENT INTAKE</div><h2>How can we help?</h2><p>Share a little about yourself and what you’re experiencing.</p></div><div className="step-badge"><span>01</span> OF 01</div></div>
        {result ? <div className={`result ${result.emergency_notice ? 'result-urgent' : ''}`}><div className="result-check"><Check size={21}/></div><div className="result-kicker">YOUR CARE PATH</div><h3>{result.queued ? 'You’re in the queue.' : 'We’ve found your care team.'}</h3><p className="result-ward">{wardLabels[result.ward]}</p>{result.assigned_doctor && <div className="assigned"><Stethoscope size={18}/><span><b>{result.assigned_doctor}</b><small>Next available · {result.next_slot} · {result.slot_minutes} min</small></span></div>}{result.queued && <p className="notice">No available clinician in this service right now. Please contact the hospital directly for assistance.</p>}{result.crisis_notice && <p className="notice urgent">If you may be in immediate danger, call your local emergency number or go to the nearest emergency department now.</p>}{result.emergency_notice && !result.crisis_notice && <p className="notice urgent">If you may be experiencing a medical emergency, call your local emergency number now.</p>}<button className="text-button" onClick={() => setResult(null)}>Start another intake <ArrowRight size={16}/></button></div> : <form onSubmit={submit}><div className="form-row"><label>Full name<input required maxLength="100" autoComplete="name" placeholder="e.g. Alex Morgan" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Age<input required type="number" min="0" max="125" inputMode="numeric" placeholder="Your age" value={form.age} onChange={e => setForm({...form, age:e.target.value})}/></label></div><label>What are you experiencing?<textarea required minLength="3" maxLength="2000" rows="4" placeholder="Describe your symptoms or what kind of support you need…" value={form.symptoms} onChange={e => setForm({...form, symptoms:e.target.value})}/><span className="field-hint">Please don’t include information you don’t want to share.</span></label>{error && <div className="error" role="alert">{error}</div>}<button className="submit" type="submit" disabled={loading}>{loading ? 'Finding your care team…' : 'Find the right care'} <ArrowRight size={17}/></button><div className="form-foot"><ShieldCheck size={14}/> Your details are only used to help route your care.</div></form>}
      </div><aside className="side-panel"><div className="side-title"><div className="section-kicker">YOUR CARE TEAM</div><span className="live"><i/> LIVE</span></div><h3>People ready<br/>to help you.</h3><p>Our care team is here to listen and guide you.</p><div className="team-stat"><div className="stat-icon"><UsersRound size={18}/></div><span><b>{available || '—'}</b><small>clinicians available</small></span><span className="stat-arrow"><ArrowRight size={16}/></span></div><div className="doctor-list">{doctors.slice(0, 4).map(d => <div className="doctor-row" key={d.doctor_name}><span className={`avatar ward-${d.ward}`}>{d.doctor_name.replace('Dr. ','').slice(0,1)}</span><span className="doctor-info"><b>{d.doctor_name}</b><small>{wardLabels[d.ward]}</small></span><span className={`availability ${d.status === 'active' ? 'is-active' : ''}`}><i/>{d.status === 'active' ? 'Available' : 'Busy'}</span></div>)}{!doctors.length && <div className="loading-roster">Connecting to care team…</div>}</div><div className="side-note"><span>✳</span><p>Not sure where to start? That’s okay. We’ll help you find the right place.</p></div></aside></section>
      <section className="emergency-bar"><div className="emergency-symbol"><Activity size={19}/></div><p><b>Need urgent help right now?</b><span>If you’re in immediate danger, call your local emergency number.</span></p><span className="emergency-tag">24 / 7 SUPPORT</span></section>
    </main><footer><span>© 2026 Carepath Health</span><span><ShieldCheck size={13}/> Your care starts with a conversation.</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
