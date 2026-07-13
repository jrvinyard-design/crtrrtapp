import React, { useState } from "react";
import { Activity, ChevronRight, Check, TrendingUp, Zap, ShieldCheck, ChevronDown } from "lucide-react";

const DOMAINS = [
  { id: "I", name: "Patient Data", items: 50, pct: 0.357, color: "#2D8B6F", desc: "History, labs, ABGs, imaging, monitoring trends" },
  { id: "II", name: "Troubleshooting & Infection Control", items: 20, pct: 0.143, color: "#C9A227", desc: "Equipment failures, QC, isolation precautions" },
  { id: "III", name: "Interventions", items: 70, pct: 0.50, color: "#E85D3D", desc: "Vent management, airway, meds, care plan changes" },
];

const FAQS = [
  { q: "Is this affiliated with the NBRC?", a: "No. CRT/RRT Board Prep is an independent study tool built from the publicly available NBRC Detailed Content Outline. All practice questions are original — modeled on the exam's structure and difficulty, never copied from real or retired NBRC items." },
  { q: "How is this different from a static question bank or study book?", a: "Books and static banks run out — you eventually memorize the answer, not the reasoning. Every question here is generated fresh, weighted to match the real domain and cognitive-level mix, so you keep getting new scenarios until the reasoning actually sticks." },
  { q: "Does this cover the new 2027 RT Exam?", a: "Yes. The TMC/CSE track covers exams through December 2026; the RT Exam track is built for the combined format starting 2027. Pick your track when you sign up, or study both." },
  { q: "Can I cancel anytime?", a: "Yes — cancel from your account settings whenever you want. You'll keep full access through the end of your current billing period." },
  { q: "Is a free trial available?", a: "Yes. You get 15 free practice questions with full explanations, no card required, so you can see the question quality before subscribing." },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif", color: "#1B2A4A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Lora', Georgia, serif; }
        button, a { font-family: inherit; cursor: pointer; }
        button:focus-visible, a:focus-visible { outline: 2px solid #1B2A4A; outline-offset: 2px; }
        .waveform-bar { animation: pulse-wave 2.4s ease-in-out infinite; }
        @keyframes pulse-wave { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .waveform-bar { animation: none; } }
        @media (max-width: 720px) { .hide-mobile { display: none !important; } .stack-mobile { flex-direction: column !important; } }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #DCD7C9", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#F7F5FEE", backdropFilter: "blur(6px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={22} color="#E85D3D" strokeWidth={2.5} />
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>CRT/RRT Board Prep</span>
        </div>
        <nav className="hide-mobile" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <a href="#blueprint" style={{ fontSize: 13, color: "#4A4536", textDecoration: "none" }}>How it works</a>
          <a href="#pricing" style={{ fontSize: 13, color: "#4A4536", textDecoration: "none" }}>Pricing</a>
          <a href="#faq" style={{ fontSize: 13, color: "#4A4536", textDecoration: "none" }}>FAQ</a>
        </nav>
        <button onClick={() => window.location.href = "https://crtrrtapp.netlify.app/"} style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Start free</button>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 980, margin: "0 auto", padding: "72px 24px 48px", display: "flex", gap: 56, alignItems: "center" }} className="stack-mobile">
        <div style={{ flex: 1, minWidth: 280 }}>
          <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#E85D3D", fontWeight: 700, marginBottom: 14 }}>TMC · CSE · 2027 RT EXAM READY</p>
          <h1 className="serif" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.14, margin: "0 0 18px" }}>
            Study the exam you'll actually sit for — not a book someone wrote in 2019.
          </h1>
          <p style={{ fontSize: 16, color: "#4A4536", lineHeight: 1.65, marginBottom: 28, maxWidth: 460 }}>
            Every practice question is generated fresh against the official NBRC content
            outline — same domain weighting, same cognitive-level mix, same patient-type
            quotas as the real TMC and CSE. No memorized banks. No stale editions.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <button onClick={() => window.location.href = "https://crtrrtapp.netlify.app/"} style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "13px 26px", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              Try 15 questions free <ChevronRight size={16} />
            </button>
          </div>
          <p className="mono" style={{ fontSize: 11, color: "#8A8578" }}>No card required · Cancel anytime</p>
        </div>

        {/* Signature element: live waveform + blueprint mirror */}
        <div style={{ flex: 1, minWidth: 280, background: "#1B2A4A", borderRadius: 6, padding: "28px 26px", color: "#F7F5F0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44, marginBottom: 20 }}>
            {[0.3, 0.7, 0.5, 1, 0.4, 0.85, 0.6, 0.95, 0.35, 0.75, 0.5, 0.9].map((h, i) => (
              <div key={i} className="waveform-bar" style={{ flex: 1, height: `${h * 100}%`, background: "#E85D3D", borderRadius: 1, animationDelay: `${i * 0.08}s`, transformOrigin: "bottom" }} />
            ))}
          </div>
          <p className="mono" style={{ fontSize: 11, letterSpacing: "0.06em", color: "#B8C4D9", marginBottom: 18 }}>EXAM BLUEPRINT, BY THE NUMBERS</p>
          {DOMAINS.map((d) => (
            <div key={d.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{d.id}. {d.name}</span>
                <span className="mono" style={{ fontSize: 12, color: "#B8C4D9" }}>{(d.pct * 100).toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, background: "#2A3B5C", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${d.pct * 100}%`, height: "100%", background: d.color }} />
              </div>
            </div>
          ))}
          <p style={{ fontSize: 12, color: "#8FA0BE", marginTop: 12, lineHeight: 1.5 }}>
            Domain III is half the real exam. Most study tools treat every topic equally —
            ours doesn't.
          </p>
        </div>
      </section>

      {/* Problem/solution strip */}
      <section style={{ background: "#FFFFFF", borderTop: "1px solid #DCD7C9", borderBottom: "1px solid #DCD7C9", padding: "48px 24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", gap: 40 }} className="stack-mobile">
          {[
            { icon: Zap, title: "Never run out of questions", body: "Static banks get memorized, not understood. Ours generates new scenarios every session, so you're always being tested on reasoning, not recall of a specific question you've seen before." },
            { icon: TrendingUp, title: "Weighted like the real exam", body: "Domain III alone is half the TMC. Practice sets here mirror that exactly — not an even split across topics that don't matter equally on test day." },
            { icon: ShieldCheck, title: "Explanations that teach", body: "Every option — right and wrong — comes with a rationale, including whether a wrong choice would be actively harmful or just suboptimal. That's how you build judgment, not just memorize keys." },
          ].map((f, i) => (
            <div key={i} style={{ flex: 1 }}>
              <f.icon size={20} color="#E85D3D" strokeWidth={2} style={{ marginBottom: 10 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#4A4536", lineHeight: 1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Blueprint detail */}
      <section id="blueprint" style={{ maxWidth: 980, margin: "0 auto", padding: "64px 24px" }}>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#8A8578", fontWeight: 700, marginBottom: 10 }}>HOW IT WORKS</p>
        <h2 className="serif" style={{ fontSize: 30, fontWeight: 600, marginBottom: 36, maxWidth: 560 }}>Three domains. One blueprint. Questions that respect both.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DOMAINS.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 20, alignItems: "center", background: "#FFFFFF", border: "1px solid #DCD7C9", borderRadius: 5, padding: "18px 22px" }} className="stack-mobile">
              <div style={{ width: 54, height: 54, borderRadius: 4, background: d.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: d.color }}>{d.id}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }} className="stack-mobile">
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{d.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: "#8A8578" }}>{d.items} items · {(d.pct * 100).toFixed(0)}% of exam</span>
                </div>
                <p style={{ fontSize: 13, color: "#4A4536", margin: 0 }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: "#1B2A4A", padding: "72px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#E88A6D", fontWeight: 700, marginBottom: 10 }}>PRICING</p>
          <h2 className="serif" style={{ fontSize: 30, fontWeight: 600, color: "#F7F5F0", marginBottom: 32 }}>One plan. Everything included.</h2>

          <div style={{ background: "#F7F5F0", borderRadius: 8, padding: "36px 32px", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span className="serif" style={{ fontSize: 42, fontWeight: 700 }}>$19</span>
              <span style={{ fontSize: 14, color: "#8A8578" }}>/ month</span>
            </div>
            <p style={{ fontSize: 13, color: "#8A8578", marginBottom: 24 }}>Cancel anytime. No long-term contract.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                "Unlimited AI-generated TMC practice questions",
                "Full CSE branching simulations",
                "Blueprint-weighted practice sets — not random",
                "Adaptive targeting of your weakest domains",
                "2026 legacy track + 2027 RT Exam track",
                "Progress tracking by domain and cognitive level",
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Check size={16} color="#2D8B6F" strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 14 }}>{f}</span>
                </div>
              ))}
            </div>
            <button onClick={() => window.location.href = "https://crtrrtapp.netlify.app/"} style={{ width: "100%", background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Start free, upgrade anytime</button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 700, margin: "0 auto", padding: "72px 24px 90px" }}>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#8A8578", fontWeight: 700, marginBottom: 10 }}>FAQ</p>
        <h2 className="serif" style={{ fontSize: 28, fontWeight: 600, marginBottom: 28 }}>Questions, answered plainly.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ borderTop: "1px solid #DCD7C9", borderBottom: i === FAQS.length - 1 ? "1px solid #DCD7C9" : "none" }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", background: "none", border: "none", padding: "18px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{f.q}</span>
                <ChevronDown size={18} color="#8A8578" style={{ transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginLeft: 12 }} />
              </button>
              {openFaq === i && <p style={{ fontSize: 14, color: "#4A4536", lineHeight: 1.65, padding: "0 4px 20px", margin: 0 }}>{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #DCD7C9", padding: "24px", textAlign: "center" }}>
        <p className="mono" style={{ fontSize: 11, color: "#8A8578" }}>CRT/RRT Board Prep is an independent study tool and is not affiliated with or endorsed by the NBRC.</p>
      </footer>
    </div>
  );
}
