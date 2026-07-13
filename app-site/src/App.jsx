import React, { useState, useMemo } from "react";
import { Activity, ChevronRight, CheckCircle2, XCircle, TrendingUp, Lock } from "lucide-react";

// ---- Blueprint data (subset, mirrors tmc_blueprint.json weighting) ----
const DOMAINS = [
  { id: "I", name: "Patient Data", items: 50, pct: 0.357, color: "#2D8B6F" },
  { id: "II", name: "Troubleshooting & Infection Control", items: 20, pct: 0.143, color: "#C9A227" },
  { id: "III", name: "Interventions", items: 70, pct: 0.50, color: "#E85D3D" },
];

// ---- Sample generated questions (pre-baked demo output, calibrated to blueprint) ----
const SAMPLE_QUESTIONS = [
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · COPD",
    stem: "A 64-year-old man with severe COPD is receiving volume-control ventilation. The ventilator graphics show the expiratory flow waveform failing to return to zero before the next breath is delivered. Peak and plateau pressures have both increased over the last hour, and the patient appears to be actively exhaling against the ventilator.",
    question: "What should the respiratory therapist recommend FIRST?",
    options: [
      { label: "A", text: "Increase the set respiratory rate to improve minute ventilation", correct: false, tag: "harmful", rationale: "Increasing rate shortens expiratory time further, worsening the air-trapping already shown on the waveform." },
      { label: "B", text: "Decrease the respiratory rate and/or increase expiratory time to reduce auto-PEEP", correct: true, tag: null, rationale: "The waveform pattern is classic auto-PEEP (breath stacking). The correct first response is extending expiratory time — lowering rate or increasing flow to shorten inspiratory time — to let the patient fully exhale before the next breath." },
      { label: "C", text: "Administer a paralytic to eliminate patient effort", correct: false, tag: "unsatisfactory", rationale: "Jumping to paralysis skips the correctable ventilator-mechanics issue and adds unnecessary risk before simpler adjustments are tried." },
      { label: "D", text: "Switch to pressure-control ventilation without changing timing", correct: false, tag: "reasonable_but_incorrect", rationale: "Mode change alone doesn't address the core problem — expiratory time — and could be reasonable later but isn't the first move." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Adult · General",
    stem: "ABG on room air: pH 7.48, PaCO2 30 mmHg, HCO3 22 mEq/L, PaO2 88 mmHg. The patient reports numbness around the mouth and lightheadedness.",
    question: "This ABG and clinical picture are most consistent with which condition?",
    options: [
      { label: "A", text: "Acute respiratory acidosis", correct: false, tag: "unsatisfactory", rationale: "Acidosis would show a low pH, not elevated — this doesn't match the direction of the pH shift." },
      { label: "B", text: "Acute respiratory alkalosis from hyperventilation", correct: true, tag: null, rationale: "Elevated pH with low PaCO2 and a near-normal HCO3 (uncompensated) points to acute respiratory alkalosis — commonly from anxiety-driven hyperventilation, which also explains the perioral numbness from hypocapnia-induced hypocalcemia symptoms." },
      { label: "C", text: "Metabolic alkalosis", correct: false, tag: "reasonable_but_incorrect", rationale: "HCO3 is essentially normal, not elevated, so the primary disturbance is respiratory, not metabolic." },
      { label: "D", text: "Normal ABG with anxiety-related symptoms only", correct: false, tag: "reasonable_but_incorrect", rationale: "The PaCO2 of 30 is outside normal range — this is an active acid-base disturbance, not a normal gas." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A high-pressure alarm is sounding on a ventilator. The RT notes the peak pressure is elevated but the plateau pressure is unchanged from baseline.",
    question: "Which of the following is the most likely cause?",
    options: [
      { label: "A", text: "Decreased lung compliance", correct: false, tag: "unsatisfactory", rationale: "Decreased compliance raises both peak AND plateau pressure together — plateau here is unchanged, which rules this out." },
      { label: "B", text: "Increased airway resistance, e.g. secretions or bronchospasm", correct: true, tag: null, rationale: "A rising peak pressure with a stable plateau pressure isolates the problem to the resistive (airway) pathway, not the lung tissue itself — think secretions, kinked tubing, or bronchospasm, not a compliance problem." },
      { label: "C", text: "Pneumothorax", correct: false, tag: "unsatisfactory", rationale: "A pneumothorax typically drops compliance and raises both peak and plateau pressure, not peak alone." },
      { label: "D", text: "Auto-triggering", correct: false, tag: "reasonable_but_incorrect", rationale: "Auto-triggering affects breath delivery timing, not the peak/plateau pressure relationship described here." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.B — Ensure Infection Prevention",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Which precaution category is appropriate for a patient with suspected active pulmonary tuberculosis?",
    options: [
      { label: "A", text: "Contact precautions", correct: false, tag: "unsatisfactory", rationale: "Contact precautions address organisms spread by touch/surfaces, not airborne droplet nuclei — TB requires more than this alone." },
      { label: "B", text: "Droplet precautions", correct: false, tag: "unsatisfactory", rationale: "Droplet precautions are for larger respiratory particles (e.g., influenza) that don't stay airborne over distance — TB requires the stricter airborne category." },
      { label: "C", text: "Airborne precautions with an N95 or higher respirator", correct: true, tag: null, rationale: "TB is spread via small airborne droplet nuclei that remain suspended and travel on air currents, requiring a negative-pressure room and fit-tested N95/PAPR — this is a high-yield recall fact on the exam." },
      { label: "D", text: "Standard precautions only", correct: false, tag: "harmful", rationale: "Standard precautions alone are insufficient for an airborne pathogen and would put staff at real risk of exposure." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Neonatal · RDS",
    stem: "A 29-week gestation neonate with respiratory distress syndrome is on nasal CPAP at 6 cmH2O and 30% FiO2. The infant develops increasing retractions, grunting, and SpO2 drifts to 88%.",
    question: "What is the most appropriate next step?",
    options: [
      { label: "A", text: "Increase CPAP pressure and reassess", correct: true, tag: null, rationale: "Worsening work of breathing and desaturation on CPAP in RDS is first addressed by optimizing the CPAP level to improve lung recruitment and FRC before escalating to intubation." },
      { label: "B", text: "Immediately intubate and initiate mechanical ventilation", correct: false, tag: "reasonable_but_incorrect", rationale: "Intubation may eventually be needed, but it's not the first step — CPAP optimization should be tried first unless the infant is in extremis." },
      { label: "C", text: "Decrease FiO2 to reduce oxygen toxicity risk", correct: false, tag: "harmful", rationale: "Decreasing FiO2 while the infant is desaturating and working harder to breathe would worsen hypoxemia." },
      { label: "D", text: "Switch to a high-flow nasal cannula", correct: false, tag: "unsatisfactory", rationale: "HFNC provides less consistent distending pressure than CPAP and is a step down in support — inappropriate when the infant is already worsening on CPAP." },
    ],
  },
];

// ---- CSE branching scenario library ----
const CSE_SCENARIOS = [
  {
    id: "postop",
    condition: "Post-Operative",
    title: "Adult, Post-Operative Atelectasis Risk",
    opening: "A 58-year-old woman is 6 hours post-op following an open cholecystectomy. She has a history of moderate COPD. Her respiratory rate is 26/min, SpO2 is 90% on 2L nasal cannula, and she reports shallow breathing due to incisional pain.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST action?",
        branches: [
          { label: "Increase oxygen to 4L nasal cannula and reassess", correct: true, consequence: "SpO2 improves to 94%. The patient remains tachypneic and guards her abdomen when asked to breathe deeply." },
          { label: "Administer IV opioid pain medication immediately without reassessing O2", correct: false, consequence: "Pain improves slightly, but opioids risk further respiratory depression in a COPD patient with borderline saturation — this was addressed out of order.", suboptimal: true },
          { label: "Order a STAT chest X-ray before addressing oxygenation", correct: false, consequence: "The imaging is reasonable eventually, but delays correcting the immediate hypoxemia — not the right first move.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Given her guarding and shallow breathing from incisional pain, what do you recommend next?",
        branches: [
          { label: "Recommend incentive spirometry and adequate pain control to enable deep breathing", correct: true, consequence: "With better-controlled pain, the patient performs incentive spirometry effectively. Breath sounds improve on reassessment." },
          { label: "Recommend chest physiotherapy with percussion over the incision site", correct: false, consequence: "Percussion directly over a fresh surgical incision would cause unnecessary pain and isn't indicated here.", suboptimal: true },
          { label: "Do nothing further — vitals are now acceptable", correct: false, consequence: "Shallow breathing from splinting raises atelectasis risk post-op; this needs active management, not just monitoring.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "copd",
    condition: "COPD",
    title: "Adult, COPD Exacerbation",
    opening: "A 67-year-old man with a 40 pack-year smoking history presents to the ED with worsening dyspnea, increased sputum production, and wheezing over 3 days. RR is 28/min, SpO2 is 86% on room air, and he is using accessory muscles.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST action?",
        branches: [
          { label: "Start low-flow supplemental oxygen titrated to SpO2 88-92%", correct: true, consequence: "SpO2 rises to 90%. The patient remains tachypneic with audible wheeze; ABG is drawn showing pH 7.32, PaCO2 58, PaO2 62." },
          { label: "Apply high-flow oxygen to normalize SpO2 to 98-100%", correct: false, consequence: "Over-oxygenating a chronic CO2 retainer can blunt hypoxic drive and worsen hypercapnia — this target was too aggressive for a COPD patient.", suboptimal: true },
          { label: "Intubate immediately given the low SpO2", correct: false, consequence: "The patient is not yet in extremis; less invasive measures should be tried first.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Given the ABG showing compensated respiratory acidosis with hypoxemia, what do you recommend next?",
        branches: [
          { label: "Initiate bronchodilator therapy and trial noninvasive ventilation (BiPAP)", correct: true, consequence: "The patient tolerates BiPAP well. Work of breathing decreases and a repeat ABG in 1 hour shows improving pH and PaCO2." },
          { label: "Administer a sedative to reduce work of breathing", correct: false, consequence: "Sedation in a hypercapnic, spontaneously breathing patient risks further respiratory depression — this is not appropriate here.", suboptimal: true },
          { label: "Wait and reassess in 4 hours without intervention", correct: false, consequence: "This patient is actively decompensating; delaying intervention risks progression to respiratory failure.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "ards",
    condition: "ARDS",
    title: "Adult, ARDS Following Sepsis",
    opening: "A 45-year-old woman with sepsis from pneumonia is intubated and on volume-control ventilation. PaO2/FiO2 ratio is 140 on FiO2 60% and PEEP 5 cmH2O. Bilateral infiltrates are present on chest X-ray with no evidence of cardiac cause.",
    steps: [
      {
        id: 1,
        prompt: "This presentation meets criteria for moderate ARDS. What is your FIRST recommendation?",
        branches: [
          { label: "Implement lung-protective ventilation: reduce tidal volume to 6 mL/kg PBW and increase PEEP", correct: true, consequence: "Plateau pressure is checked and kept under 30 cmH2O. Oxygenation improves modestly with higher PEEP; the patient remains stable." },
          { label: "Increase tidal volume to improve minute ventilation and CO2 clearance", correct: false, consequence: "Higher tidal volumes in ARDS increase the risk of ventilator-induced lung injury — this goes against lung-protective strategy.", suboptimal: true },
          { label: "Switch to pressure-support ventilation immediately", correct: false, consequence: "The patient isn't ready for a spontaneous mode yet given the severity of oxygenation impairment.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite these changes, PaO2/FiO2 remains under 150. What do you recommend next?",
        branches: [
          { label: "Recommend prone positioning", correct: true, consequence: "After proning, oxygenation improves significantly with PaO2/FiO2 rising above 180. The team continues protocol-driven proning sessions." },
          { label: "Recommend increasing FiO2 to 100% and maintaining current position", correct: false, consequence: "Maximizing FiO2 alone doesn't address the underlying V/Q mismatch and risks oxygen toxicity without proning's recruitment benefit.", suboptimal: true },
          { label: "Recommend paralysis without addressing positioning", correct: false, consequence: "Neuromuscular blockade may be considered in severe ARDS, but proning has stronger mortality benefit evidence and should be prioritized first.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "asthma",
    condition: "Asthma",
    title: "Pediatric, Acute Asthma Exacerbation",
    opening: "An 8-year-old girl with a known asthma history presents with acute dyspnea, audible wheeze, and a peak flow at 55% of her personal best. RR is 32/min, and she is speaking in short phrases.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Administer a short-acting beta-agonist (albuterol) via nebulizer or MDI with spacer", correct: true, consequence: "After the first treatment, wheeze decreases somewhat but the child remains tachypneic with a peak flow at 65% of personal best." },
          { label: "Start inhaled corticosteroids alone as the first-line acute treatment", correct: false, consequence: "Inhaled corticosteroids are for long-term control, not acute bronchospasm relief — a fast-acting bronchodilator is needed first.", suboptimal: true },
          { label: "Recommend immediate intubation given the wheeze", correct: false, consequence: "The child is not in respiratory failure yet; this is premature and skips standard stepwise management.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Peak flow remains under 70% of personal best after the first treatment. What's next?",
        branches: [
          { label: "Give repeat/continuous SABA treatments and add systemic corticosteroids", correct: true, consequence: "After a second treatment plus oral corticosteroids, peak flow improves to 80% and work of breathing visibly decreases." },
          { label: "Switch immediately to a long-acting beta-agonist (LABA)", correct: false, consequence: "LABAs are not for acute exacerbations and carry a black-box warning against monotherapy use in asthma — inappropriate here.", suboptimal: true },
          { label: "Discharge home with instructions to follow up in one week", correct: false, consequence: "A peak flow still under 70% predicted indicates ongoing significant obstruction — not safe for discharge yet.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "tbi",
    condition: "Traumatic Brain Injury",
    title: "Adult, Traumatic Brain Injury with Elevated ICP",
    opening: "A 30-year-old man is intubated after a motor vehicle collision with a severe traumatic brain injury. ICP monitor reads 24 mmHg (goal <20). He is on volume-control ventilation with PaCO2 currently at 46 mmHg.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation to help manage the elevated ICP?",
        branches: [
          { label: "Adjust ventilation to achieve mild, brief hyperventilation targeting PaCO2 around 30-35 mmHg", correct: true, consequence: "PaCO2 decreases to 32 mmHg and ICP transiently improves to 19 mmHg. The team notes this is a temporizing measure, not definitive treatment." },
          { label: "Aggressively hyperventilate to PaCO2 below 25 mmHg for sustained ICP control", correct: false, consequence: "Excessive hyperventilation causes cerebral vasoconstriction severe enough to risk cerebral ischemia — this goes too far.", suboptimal: true },
          { label: "Allow permissive hypercapnia to avoid affecting cerebral vessels", correct: false, consequence: "Permissive hypercapnia raises PaCO2, which would worsen cerebral vasodilation and increase ICP further — wrong direction for this patient.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "ICP rises again to 25 mmHg after the transient improvement. What do you recommend next?",
        branches: [
          { label: "Recommend elevating the head of bed to 30 degrees and ensuring neutral neck positioning", correct: true, consequence: "ICP decreases to 21 mmHg with improved venous drainage. The team continues multimodal ICP management per protocol." },
          { label: "Recommend placing the patient flat to improve cerebral perfusion pressure", correct: false, consequence: "A flat position impairs venous drainage from the head and would likely worsen ICP, not improve it.", suboptimal: true },
          { label: "Recommend increasing sedation only, without addressing positioning", correct: false, consequence: "Sedation may help but skips a simple, evidence-based first step (positioning) that should be addressed alongside or before escalating sedation.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "sepsis",
    condition: "Sepsis",
    title: "Adult, Sepsis-Induced Respiratory Failure",
    opening: "A 71-year-old woman with a UTI-source sepsis is hypotensive (82/50), tachypneic (RR 30), and increasingly lethargic. SpO2 is 89% on a non-rebreather mask. Lactate is elevated at 4.2 mmol/L.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST priority regarding her respiratory status?",
        branches: [
          { label: "Prepare for likely intubation given declining mental status and hypoxemia despite high-flow oxygen", correct: true, consequence: "The team proceeds with rapid sequence intubation. Post-intubation, the patient is placed on lung-protective ventilation settings." },
          { label: "Continue non-rebreather mask only and reassess in 2 hours", correct: false, consequence: "Waiting risks further deterioration — a patient this hypoxemic and obtunded needs more definitive airway management addressed promptly.", suboptimal: true },
          { label: "Switch to a simple face mask to reduce oxygen flow", correct: false, consequence: "This would decrease FiO2 delivery in a patient already hypoxemic on maximal non-rebreather support — wrong direction.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Post-intubation, what ventilation strategy do you recommend given her risk for sepsis-related ARDS?",
        branches: [
          { label: "Use lung-protective ventilation with low tidal volume (6 mL/kg PBW) and monitor plateau pressure", correct: true, consequence: "The patient is maintained on lung-protective settings. Plateau pressure stays under 30 cmH2O, reducing risk of further lung injury." },
          { label: "Use high tidal volumes to compensate for her elevated lactate and metabolic demand", correct: false, consequence: "Tidal volume should be based on protecting the lungs, not compensating for metabolic acidosis directly — this risks lung injury.", suboptimal: true },
          { label: "Prioritize sedation depth over ventilator settings", correct: false, consequence: "Both matter, but skipping lung-protective settings in a sepsis patient at high ARDS risk is a meaningful omission.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "neonatal",
    condition: "Neonatal RDS",
    title: "Neonatal, Respiratory Distress Syndrome",
    opening: "A 29-week gestation neonate with respiratory distress syndrome is on nasal CPAP at 6 cmH2O and 30% FiO2. The infant develops increasing retractions, grunting, and SpO2 drifts to 88%.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Increase CPAP pressure and reassess", correct: true, consequence: "Work of breathing improves modestly and SpO2 rises to 91%. Grunting persists intermittently." },
          { label: "Immediately intubate and initiate mechanical ventilation", correct: false, consequence: "Intubation may eventually be needed, but it's not the first step — CPAP optimization should be tried first unless the infant is in extremis.", suboptimal: true },
          { label: "Decrease FiO2 to reduce oxygen toxicity risk", correct: false, consequence: "Decreasing FiO2 while the infant is desaturating and working harder to breathe would worsen hypoxemia.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite optimized CPAP, the infant now has worsening retractions, rising CO2 on capillary gas, and SpO2 85%. What's next?",
        branches: [
          { label: "Recommend intubation, surfactant administration, and mechanical ventilation", correct: true, consequence: "The infant is intubated, receives surfactant, and is placed on gentle ventilation. Oxygenation and work of breathing improve within the hour." },
          { label: "Add high-flow nasal cannula on top of CPAP", correct: false, consequence: "Combining supports like this isn't standard practice and doesn't address the infant's escalating need for surfactant and ventilatory support.", suboptimal: true },
          { label: "Continue current CPAP settings and recheck gas in 4 hours", correct: false, consequence: "This infant is showing signs of surfactant deficiency with worsening respiratory failure — waiting risks further deterioration.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "cf",
    condition: "Cystic Fibrosis",
    title: "Pediatric, Cystic Fibrosis Exacerbation",
    opening: "A 12-year-old with known cystic fibrosis is admitted with increased cough, thick sputum production, and a 10% decline in FEV1 from baseline. SpO2 is 93% on room air.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Initiate airway clearance therapy (e.g., HFCWO vest or manual chest physiotherapy) and inhaled bronchodilator", correct: true, consequence: "After the first session, the patient mobilizes more secretions and reports easier breathing. Repeat spirometry shows slight improvement." },
          { label: "Start antibiotics only, without addressing airway clearance", correct: false, consequence: "Antibiotics matter for the underlying infection, but skipping airway clearance in a CF exacerbation ignores a cornerstone of standard management.", suboptimal: true },
          { label: "Recommend chest tube placement", correct: false, consequence: "There's no indication of pneumothorax or effusion here — this procedure isn't warranted by the presentation.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "The patient continues to have thick, difficult-to-clear secretions despite initial therapy. What do you recommend next?",
        branches: [
          { label: "Add inhaled mucolytic therapy (e.g., dornase alfa) alongside continued airway clearance", correct: true, consequence: "Sputum becomes easier to mobilize with the added mucolytic. The patient's oxygenation and comfort continue to improve." },
          { label: "Increase FiO2 significantly without addressing secretions", correct: false, consequence: "Raising oxygen doesn't address the underlying mucus plugging problem driving the exacerbation.", suboptimal: true },
          { label: "Discontinue airway clearance since it hasn't fully resolved symptoms yet", correct: false, consequence: "Airway clearance in CF is an ongoing, cumulative therapy — stopping early would worsen mucus retention.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "burn",
    condition: "Burn / Inhalation Injury",
    title: "Adult, Smoke Inhalation Injury",
    opening: "A 34-year-old man is brought in after a house fire with facial burns, singed nasal hair, and carbonaceous sputum. He is hoarse and has audible stridor. SpO2 reads 97% on room air.",
    steps: [
      {
        id: 1,
        prompt: "Despite the reassuring SpO2, what is your FIRST priority?",
        branches: [
          { label: "Prepare for early elective intubation given signs of impending airway obstruction", correct: true, consequence: "The team proceeds with early intubation before swelling progresses. Airway is secured without complication." },
          { label: "Reassure the team that the normal SpO2 rules out significant injury", correct: false, consequence: "Pulse oximetry can look falsely normal in carbon monoxide exposure and doesn't rule out impending airway swelling — this is a dangerous assumption.", suboptimal: true },
          { label: "Wait until stridor worsens before considering intubation", correct: false, consequence: "Airway edema from inhalation injury can progress rapidly to complete obstruction — waiting risks losing the airway entirely.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Given the fire exposure, what additional test do you recommend to evaluate for occult injury?",
        branches: [
          { label: "Recommend carboxyhemoglobin level via co-oximetry", correct: true, consequence: "Co-oximetry reveals an elevated carboxyhemoglobin level. The patient is started on 100% oxygen therapy to accelerate CO elimination." },
          { label: "Recommend a routine pulse oximetry reading only", correct: false, consequence: "Standard pulse oximetry cannot distinguish carboxyhemoglobin from oxyhemoglobin and will read falsely normal — co-oximetry is needed instead.", suboptimal: true },
          { label: "Recommend no further gas testing since SpO2 is normal", correct: false, consequence: "This misses a common and dangerous complication of smoke inhalation — CO poisoning must be actively ruled out.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "neuromuscular",
    condition: "Neuromuscular Disease",
    title: "Adult, Guillain-Barré Syndrome with Respiratory Involvement",
    opening: "A 40-year-old man with progressive ascending weakness diagnosed as Guillain-Barré syndrome is being monitored. His vital capacity has dropped from 3.0L to 1.4L over 24 hours, and his voice has become weaker.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation based on this trend?",
        branches: [
          { label: "Recommend close monitoring of MIP, MEP, and vital capacity with escalation planning for likely ventilatory failure", correct: true, consequence: "Serial measurements confirm a continued downward trend. The team prepares for elective intubation before a crisis develops." },
          { label: "Wait until the patient shows overt respiratory distress before acting", correct: false, consequence: "In neuromuscular disease, respiratory failure can occur with deceptively few overt signs — waiting for distress risks a crash intubation.", suboptimal: true },
          { label: "Discharge home with outpatient pulmonary function follow-up", correct: false, consequence: "A rapidly declining vital capacity like this is a red flag for impending ventilatory failure — this is not safe for discharge.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Vital capacity continues to drop below 15 mL/kg. What do you recommend next?",
        branches: [
          { label: "Recommend elective intubation and mechanical ventilation before further decline", correct: true, consequence: "The patient is intubated electively in a controlled setting and tolerates the procedure well, avoiding an emergent crisis." },
          { label: "Recommend noninvasive ventilation only, indefinitely", correct: false, consequence: "NIV is often poorly tolerated and less effective in progressive neuromuscular weakness with bulbar involvement — invasive ventilation is more appropriate here.", suboptimal: true },
          { label: "Recommend increasing supplemental oxygen alone", correct: false, consequence: "This is a ventilatory pump failure problem, not primarily an oxygenation problem — oxygen alone won't address the underlying issue.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "pe",
    condition: "Pulmonary Embolism",
    title: "Adult, Acute Pulmonary Embolism",
    opening: "A 55-year-old woman recently post-op from hip surgery develops sudden-onset dyspnea, pleuritic chest pain, and tachycardia. SpO2 is 89% on room air. She is hemodynamically stable.",
    steps: [
      {
        id: 1,
        prompt: "Given the clinical suspicion for PE, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend supplemental oxygen and urgent CT pulmonary angiography", correct: true, consequence: "SpO2 improves to 94% on oxygen. CTPA confirms a segmental pulmonary embolism, and anticoagulation is initiated." },
          { label: "Recommend a ventilation/perfusion scan only, without addressing oxygenation first", correct: false, consequence: "Oxygenation should be addressed immediately while diagnostic workup proceeds — this delays a simple, low-risk intervention.", suboptimal: true },
          { label: "Recommend reassurance and observation without imaging", correct: false, consequence: "This presentation is highly suspicious for PE and requires prompt diagnostic confirmation, not watchful waiting.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "The patient's oxygenation remains borderline despite supplemental oxygen. What do you recommend next?",
        branches: [
          { label: "Continue titrated oxygen therapy and closely monitor for hemodynamic decompensation", correct: true, consequence: "The patient remains stable on titrated oxygen while anticoagulation takes effect. No further escalation is needed." },
          { label: "Recommend immediate intubation given the low initial SpO2", correct: false, consequence: "The patient is hemodynamically stable and responding to oxygen — intubation is premature and adds unnecessary risk.", suboptimal: true },
          { label: "Discontinue oxygen therapy once SpO2 briefly reaches 92%", correct: false, consequence: "Stopping oxygen prematurely in a PE patient with ongoing V/Q mismatch risks desaturation recurring.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "overdose",
    condition: "Drug Overdose",
    title: "Adult, Opioid Overdose with Respiratory Depression",
    opening: "A 26-year-old man is found unresponsive with pinpoint pupils and a respiratory rate of 6/min. SpO2 is 82% on room air. Track marks are noted on his arms.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST action?",
        branches: [
          { label: "Support ventilation with a bag-valve mask while preparing naloxone administration", correct: true, consequence: "Manual ventilation improves oxygenation while naloxone is prepared. The team proceeds to administer it per protocol." },
          { label: "Wait for naloxone to be drawn up before providing any ventilatory support", correct: false, consequence: "Delaying ventilatory support in a severely bradypneic, hypoxemic patient risks further deterioration — support should start immediately.", suboptimal: true },
          { label: "Apply a non-rebreather mask only, without addressing ventilation", correct: false, consequence: "A non-rebreather doesn't provide the ventilatory support this patient needs given a respiratory rate of only 6/min.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "After naloxone administration, the patient's respiratory rate improves to 14/min but he remains lethargic. What do you recommend?",
        branches: [
          { label: "Continue close monitoring, as naloxone's effects may wear off before the opioid's, requiring repeat dosing", correct: true, consequence: "About 30 minutes later, respiratory rate begins to decline again, and a repeat naloxone dose is given per protocol as anticipated." },
          { label: "Discharge the patient once he is arousable", correct: false, consequence: "Naloxone has a shorter half-life than many opioids — discharging too early risks re-sedation and respiratory depression recurring unsupervised.", suboptimal: true },
          { label: "Administer a large additional dose of naloxone immediately regardless of current status", correct: false, consequence: "Over-dosing naloxone can precipitate severe withdrawal without added benefit — titrated, monitored dosing is preferred.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "cardiac",
    condition: "Heart Failure",
    title: "Adult, Acute Decompensated Heart Failure",
    opening: "A 72-year-old man with a history of heart failure presents with severe dyspnea, bilateral crackles, and frothy sputum. SpO2 is 84% on room air with obvious accessory muscle use.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend high-flow oxygen and trial of noninvasive ventilation (CPAP or BiPAP)", correct: true, consequence: "SpO2 improves to 92% on CPAP. Work of breathing decreases noticeably, and the patient's mental status remains intact." },
          { label: "Recommend immediate intubation as the first step", correct: false, consequence: "Noninvasive ventilation has strong evidence for reducing intubation need in acute pulmonary edema and should be tried first if the patient is not in extremis.", suboptimal: true },
          { label: "Recommend fluid bolus to support blood pressure", correct: false, consequence: "This patient is fluid-overloaded based on the presentation — additional fluid would worsen pulmonary edema.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "The patient improves on CPAP but remains hypoxemic with ongoing crackles. What do you recommend next?",
        branches: [
          { label: "Recommend continued CPAP alongside diuretic therapy addressing the underlying fluid overload", correct: true, consequence: "With diuresis underway, the patient's oxygenation and lung sounds gradually improve over the following hours." },
          { label: "Recommend discontinuing CPAP since the patient is talking comfortably", correct: false, consequence: "Comfort while on support doesn't mean the underlying problem is resolved — removing support prematurely risks rapid decompensation.", suboptimal: true },
          { label: "Recommend increasing FiO2 only, without addressing fluid status", correct: false, consequence: "This treats the symptom, not the underlying pulmonary edema — diuresis is the definitive treatment needed here.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "pneumothorax",
    condition: "Trauma",
    title: "Adult, Tension Pneumothorax",
    opening: "A 24-year-old man involved in a motorcycle collision develops sudden severe dyspnea, absent breath sounds on the left, tracheal deviation to the right, and dropping blood pressure.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation given this presentation?",
        branches: [
          { label: "Recommend immediate needle decompression of the affected side", correct: true, consequence: "After decompression, a rush of air is heard, and the patient's blood pressure and breath sounds begin to improve immediately." },
          { label: "Recommend obtaining a chest X-ray before any intervention", correct: false, consequence: "This presentation is a clinical diagnosis of tension pneumothorax — waiting for imaging in an unstable patient risks cardiac arrest.", suboptimal: true },
          { label: "Recommend high-flow oxygen only and reassess in 10 minutes", correct: false, consequence: "Oxygen alone doesn't relieve the mechanical problem causing the hemodynamic collapse — decompression is urgently needed.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "After decompression, the patient stabilizes. What do you recommend next?",
        branches: [
          { label: "Recommend chest tube placement for definitive management", correct: true, consequence: "A chest tube is placed and connected to a pleural drainage system. The patient remains hemodynamically stable with improving breath sounds." },
          { label: "Recommend removing all support since the patient improved after decompression alone", correct: false, consequence: "Needle decompression is a temporizing measure — a chest tube is needed for definitive, sustained management.", suboptimal: true },
          { label: "Recommend a second needle decompression on the same side as a permanent fix", correct: false, consequence: "Repeat needle decompression isn't a definitive solution — a formal chest tube is the appropriate next step.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "bronchiolitis",
    condition: "Bronchiolitis",
    title: "Pediatric, RSV Bronchiolitis",
    opening: "A 4-month-old infant presents with rhinorrhea, cough, wheezing, and mild retractions. SpO2 is 91% on room air, and the infant is feeding poorly due to respiratory effort.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend supportive care: nasal suctioning, supplemental oxygen as needed, and close monitoring", correct: true, consequence: "After nasal suctioning, work of breathing improves somewhat and SpO2 rises to 94% on minimal supplemental oxygen." },
          { label: "Recommend routine bronchodilator therapy as first-line treatment", correct: false, consequence: "Bronchodilators have not shown consistent benefit in bronchiolitis and are not recommended as routine first-line therapy per current guidelines.", suboptimal: true },
          { label: "Recommend systemic corticosteroids as first-line treatment", correct: false, consequence: "Corticosteroids are not recommended for routine bronchiolitis management, which is primarily viral and self-limited.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite supportive care, the infant shows increasing work of breathing and poor feeding tolerance. What's next?",
        branches: [
          { label: "Recommend a trial of high-flow nasal cannula therapy", correct: true, consequence: "HFNC improves the infant's work of breathing and oxygenation, allowing better feeding tolerance and avoiding escalation to intubation." },
          { label: "Recommend immediate intubation given the desaturation", correct: false, consequence: "This infant is not yet in respiratory failure — less invasive escalation (HFNC) should be tried first.", suboptimal: true },
          { label: "Recommend discharge home with close outpatient follow-up", correct: false, consequence: "Increasing work of breathing and poor feeding indicate the infant needs continued inpatient support, not discharge.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "vap",
    condition: "Infectious Disease",
    title: "Adult, Suspected Ventilator-Associated Pneumonia",
    opening: "A 60-year-old man on mechanical ventilation for 5 days develops new fever, purulent secretions, and worsening oxygenation with new infiltrates on chest X-ray.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend obtaining a lower respiratory tract culture before starting empiric antibiotics", correct: true, consequence: "A culture is obtained promptly, and empiric broad-spectrum antibiotics are started without delay while awaiting results." },
          { label: "Recommend withholding any treatment until final culture results return in 48-72 hours", correct: false, consequence: "Delaying empiric treatment in suspected VAP risks worse outcomes — empiric therapy should start promptly alongside culture collection.", suboptimal: true },
          { label: "Recommend increasing sedation only to manage the fever", correct: false, consequence: "Sedation doesn't address the underlying suspected infection driving the fever and worsening oxygenation.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "What ventilator bundle practices should be reinforced to reduce further VAP risk?",
        branches: [
          { label: "Recommend head-of-bed elevation, oral care protocol, and daily sedation vacation with spontaneous breathing trials", correct: true, consequence: "The VAP prevention bundle is reinforced across the care team, reducing risk of further ventilator-associated complications." },
          { label: "Recommend keeping the patient flat to reduce hemodynamic stress", correct: false, consequence: "Flat positioning increases aspiration risk and is specifically discouraged by VAP prevention bundles — head-of-bed elevation is preferred.", suboptimal: true },
          { label: "Recommend continuous deep sedation without daily interruption", correct: false, consequence: "Continuous deep sedation without daily interruption is associated with prolonged ventilation and higher VAP risk — daily sedation vacations are part of the standard bundle.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "transplant",
    condition: "Lung Transplantation",
    title: "Adult, Post-Lung Transplant Acute Rejection",
    opening: "A 50-year-old man 3 months post bilateral lung transplant presents with progressive dyspnea and a 15% decline in FEV1 from his post-transplant baseline. He denies fever or infectious symptoms.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation given this presentation?",
        branches: [
          { label: "Recommend prompt evaluation for acute rejection, including bronchoscopy with transbronchial biopsy", correct: true, consequence: "Bronchoscopy is performed and biopsy results support a diagnosis of acute cellular rejection. High-dose corticosteroid therapy is initiated." },
          { label: "Recommend reassurance that this decline is expected variability and no workup is needed", correct: false, consequence: "A significant FEV1 decline in a transplant recipient is a red flag that requires prompt evaluation, not reassurance.", suboptimal: true },
          { label: "Recommend empiric antibiotics only, without further workup", correct: false, consequence: "The patient denies infectious symptoms, and empiric antibiotics alone would miss a likely rejection process requiring different treatment.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Following diagnosis, what supportive respiratory care do you recommend during treatment?",
        branches: [
          { label: "Recommend close monitoring of spirometry trends and oxygenation while immunosuppressive treatment takes effect", correct: true, consequence: "Serial spirometry shows gradual improvement in FEV1 over the following two weeks as rejection treatment takes effect." },
          { label: "Recommend discontinuing all pulmonary function monitoring until symptoms fully resolve", correct: false, consequence: "Ongoing monitoring is essential to track treatment response and catch further decline early — stopping monitoring would be a missed opportunity.", suboptimal: true },
          { label: "Recommend immediate re-transplant evaluation without trialing rejection treatment first", correct: false, consequence: "Acute rejection is often treatable with immunosuppressive therapy — re-transplant evaluation is premature before trying standard treatment.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "apnea",
    condition: "Apnea",
    title: "Neonatal, Apnea of Prematurity",
    opening: "A 32-week gestation infant, now 5 days old, has three episodes of apnea lasting over 20 seconds in the past hour, each accompanied by bradycardia and desaturation to the low 80s.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend tactile stimulation for each episode and initiation of caffeine citrate therapy", correct: true, consequence: "Caffeine therapy is started, and the frequency of apnea episodes decreases significantly over the following 24 hours." },
          { label: "Recommend immediate intubation after the first apnea episode", correct: false, consequence: "Apnea of prematurity is typically managed first with stimulation and methylxanthine therapy — intubation is reserved for episodes unresponsive to these measures.", suboptimal: true },
          { label: "Recommend no intervention, as apnea of prematurity always resolves on its own without treatment", correct: false, consequence: "While apnea of prematurity often improves with maturity, recurrent episodes with bradycardia and desaturation warrant active management, not watchful waiting alone.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite caffeine therapy, the infant continues to have frequent apnea episodes requiring stimulation. What do you recommend next?",
        branches: [
          { label: "Recommend a trial of nasal CPAP to help stabilize the airway and reduce apnea frequency", correct: true, consequence: "CPAP significantly reduces the frequency of apnea episodes by providing pharyngeal splinting and support." },
          { label: "Recommend increasing caffeine dose far beyond standard therapeutic range", correct: false, consequence: "Exceeding standard dosing risks toxicity (tachycardia, irritability) without proven added benefit — CPAP is a more appropriate next step.", suboptimal: true },
          { label: "Recommend discontinuing caffeine since it hasn't fully resolved the problem", correct: false, consequence: "Caffeine still provides benefit even if not complete resolution — discontinuing it would likely worsen apnea frequency.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "bariatric",
    condition: "Bariatric",
    title: "Adult, Obesity Hypoventilation Syndrome Post-Op",
    opening: "A 45-year-old man with a BMI of 48 and known obstructive sleep apnea is 4 hours post-op from an unrelated abdominal surgery. He is difficult to arouse, with shallow breathing and SpO2 88% on room air.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend positioning the patient upright/reverse Trendelenburg and applying his home CPAP or BiPAP settings", correct: true, consequence: "With positioning and his usual PAP therapy applied, SpO2 improves to 93% and the patient becomes more arousable." },
          { label: "Recommend keeping the patient flat to conserve energy while healing", correct: false, consequence: "Flat positioning worsens airway obstruction and hypoventilation risk in a patient with OSA and obesity hypoventilation syndrome.", suboptimal: true },
          { label: "Recommend high-dose opioids for post-op comfort without addressing the airway", correct: false, consequence: "Additional opioids in a patient who is already difficult to arouse and hypoxemic risks further respiratory depression.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "The patient remains somnolent with intermittent desaturation despite PAP therapy. What do you recommend next?",
        branches: [
          { label: "Recommend an ABG to assess for hypercapnia and closer monitoring, possibly in a higher level of care", correct: true, consequence: "ABG reveals significant hypercapnia. The patient is transferred to a monitored unit for closer observation and escalation planning." },
          { label: "Recommend discharge to the general floor with routine hourly vital sign checks", correct: false, consequence: "A somnolent, hypoxemic patient with likely hypercapnia needs closer monitoring than routine floor checks can provide.", suboptimal: true },
          { label: "Recommend withholding further oxygen entirely to avoid blunting respiratory drive", correct: false, consequence: "Withholding all oxygen in a desaturating patient is dangerous — oxygen should be titrated carefully, not eliminated.", suboptimal: true },
        ],
      },
    ],
  },
];

const LEVEL_LABEL = { recall: "Recall", application: "Application", analysis: "Analysis" };
const LEVEL_COLOR = { recall: "#8A8578", application: "#C9A227", analysis: "#E85D3D" };

export default function RTBoardPrep() {
  const [screen, setScreen] = useState("home");
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState({});
  const [chatOpen, setChatOpen] = useState(false);

  const q = SAMPLE_QUESTIONS[qIndex];
  const allAnswered = Object.keys(answered).length === SAMPLE_QUESTIONS.length;

  const domainProgress = useMemo(() => {
    return DOMAINS.map((d) => ({ ...d, answeredCorrect: Object.values(answered).filter((a) => a.domain === d.id && a.correct).length, answeredTotal: Object.values(answered).filter((a) => a.domain === d.id).length }));
  }, [answered]);

  function selectOption(opt) {
    if (revealed) return;
    setSelected(opt.label);
    setRevealed(true);
    setAnswered((prev) => ({ ...prev, [qIndex]: { domain: q.domain, correct: opt.correct } }));
  }

  function nextQuestion() {
    setSelected(null);
    setRevealed(false);
    if (qIndex + 1 >= SAMPLE_QUESTIONS.length) {
      setScreen("results");
    } else {
      setQIndex((i) => i + 1);
    }
  }

  function restart() {
    setAnswered({});
    setQIndex(0);
    setSelected(null);
    setRevealed(false);
    setScreen("practice");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif", color: "#1B2A4A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Lora', Georgia, serif; }
        button { font-family: inherit; cursor: pointer; }
        button:focus-visible, .opt:focus-visible { outline: 2px solid #1B2A4A; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #DCD7C9", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F5F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={22} color="#E85D3D" strokeWidth={2.5} />
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>CRT/RRT Board Prep</span>
        </div>
        <nav style={{ display: "flex", gap: 20 }}>
          <button onClick={() => setScreen("home")} className="mono" style={{ background: "none", border: "none", fontSize: 12, letterSpacing: "0.04em", color: screen === "home" ? "#1B2A4A" : "#8A8578", fontWeight: 600 }}>OVERVIEW</button>
          <button onClick={() => setScreen("practice")} className="mono" style={{ background: "none", border: "none", fontSize: 12, letterSpacing: "0.04em", color: screen === "practice" ? "#1B2A4A" : "#8A8578", fontWeight: 600 }}>TMC PRACTICE</button>
          <button onClick={() => setScreen("cse")} className="mono" style={{ background: "none", border: "none", fontSize: 12, letterSpacing: "0.04em", color: screen === "cse" ? "#1B2A4A" : "#8A8578", fontWeight: 600 }}>CSE SIMULATION</button>
        </nav>
      </header>

      {screen === "home" && <Home domainProgress={domainProgress} goPractice={() => setScreen("practice")} />}
      {screen === "practice" && (
        <Practice
          q={q}
          selected={selected}
          revealed={revealed}
          onSelect={selectOption}
          onNext={nextQuestion}
          qNum={qIndex + 1}
          total={SAMPLE_QUESTIONS.length}
        />
      )}
      {screen === "results" && <Results answered={answered} domainProgress={domainProgress} onRestart={restart} />}
      {screen === "cse" && <CSESimulation />}

      {/* Support chatbot */}
      <SupportChat open={chatOpen} setOpen={setChatOpen} />
    </div>
  );
}

function Home({ domainProgress, goPractice }) {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "56px 24px 80px" }}>
      <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#E85D3D", fontWeight: 700, marginBottom: 10 }}>TMC · CSE · 2027 RT EXAM READY</p>
      <h1 className="serif" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.15, margin: "0 0 16px", maxWidth: 620 }}>
        Practice questions that never repeat, weighted exactly like the real exam.
      </h1>
      <p style={{ fontSize: 16, color: "#4A4536", maxWidth: 560, lineHeight: 1.6, marginBottom: 36 }}>
        Every question is generated fresh against the official NBRC content outline —
        same domain weighting, same cognitive-level mix, same patient-type quotas as
        the exam you'll actually sit for.
      </p>
      <button onClick={goPractice} style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "13px 28px", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
        Start practicing <ChevronRight size={16} />
      </button>

      {/* Signature element: live blueprint mirror */}
      <section style={{ marginTop: 64, borderTop: "1px solid #DCD7C9", paddingTop: 40 }}>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.06em", color: "#8A8578", fontWeight: 600, marginBottom: 20 }}>THE EXAM BLUEPRINT — AND YOUR PROGRESS AGAINST IT</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {domainProgress.map((d) => (
            <div key={d.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{d.id}. {d.name}</span>
                <span className="mono" style={{ fontSize: 12, color: "#8A8578" }}>{d.items} items · {(d.pct * 100).toFixed(0)}% of exam</span>
              </div>
              <div style={{ height: 10, background: "#EAE6DA", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${d.pct * 100}%`, background: d.color, opacity: 0.25 }} />
              </div>
              {d.answeredTotal > 0 && (
                <p className="mono" style={{ fontSize: 11, color: "#8A8578", marginTop: 4 }}>{d.answeredCorrect}/{d.answeredTotal} correct in this session</p>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "#8A8578", marginTop: 20, maxWidth: 520 }}>
          Domain III alone is half the exam — and mostly Analysis-level judgment
          calls, not recall. That's where this tool concentrates practice by default.
        </p>
      </section>
    </main>
  );
}

function Practice({ q, selected, revealed, onSelect, onNext, qNum, total }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <span className="mono" style={{ fontSize: 12, color: "#8A8578" }}>Question {qNum} of {total}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 11, padding: "3px 9px", borderRadius: 2, background: LEVEL_COLOR[q.level] + "22", color: LEVEL_COLOR[q.level], fontWeight: 700, letterSpacing: "0.04em" }}>{LEVEL_LABEL[q.level].toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 11, color: "#8A8578" }}>{q.subdomain}</span>
        </div>
      </div>

      <p className="mono" style={{ fontSize: 11, color: "#8A8578", marginBottom: 8 }}>{q.patient}</p>
      <p className="serif" style={{ fontSize: 17, lineHeight: 1.65, marginBottom: 10 }}>{q.stem}</p>
      <p className="serif" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, marginBottom: 24 }}>{q.question}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.options.map((opt) => {
          const isSelected = selected === opt.label;
          const showState = revealed && (isSelected || opt.correct);
          let bg = "#FFFFFF", border = "#DCD7C9";
          if (showState) {
            if (opt.correct) { bg = "#2D8B6F14"; border = "#2D8B6F"; }
            else if (isSelected) { bg = "#E85D3D14"; border = "#E85D3D"; }
          }
          return (
            <button key={opt.label} className="opt" onClick={() => onSelect(opt)} disabled={revealed} style={{ textAlign: "left", background: bg, border: `1.5px solid ${border}`, borderRadius: 4, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: "#8A8578", marginTop: 1 }}>{opt.label}</span>
              <span style={{ flex: 1 }}>
                <span style={{ fontSize: 15, lineHeight: 1.5 }}>{opt.text}</span>
                {revealed && (isSelected || opt.correct) && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "flex-start" }}>
                    {opt.correct ? <CheckCircle2 size={15} color="#2D8B6F" style={{ flexShrink: 0, marginTop: 2 }} /> : <XCircle size={15} color="#E85D3D" style={{ flexShrink: 0, marginTop: 2 }} />}
                    <span style={{ fontSize: 13, color: "#4A4536", lineHeight: 1.5 }}>{opt.rationale}</span>
                  </div>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <button onClick={onNext} style={{ marginTop: 28, background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "12px 24px", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
          Next question <ChevronRight size={16} />
        </button>
      )}

      <div style={{ marginTop: 48, borderTop: "1px solid #DCD7C9", paddingTop: 20, display: "flex", alignItems: "center", gap: 8, color: "#8A8578" }}>
        <Lock size={13} />
        <span style={{ fontSize: 12 }}>Unlimited generated practice, adaptive weak-area targeting, and full CSE simulations are part of CRT/RRT Board Prep Plus.</span>
      </div>
    </main>
  );
}

function Results({ answered, domainProgress, onRestart }) {
  const total = Object.keys(answered).length;
  const correct = Object.values(answered).filter((a) => a.correct).length;
  const weakest = [...domainProgress].filter((d) => d.answeredTotal > 0).sort((a, b) => (a.answeredCorrect / a.answeredTotal) - (b.answeredCorrect / b.answeredTotal))[0];

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px 80px" }}>
      <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#8A8578", fontWeight: 700, marginBottom: 10 }}>SESSION COMPLETE</p>
      <h1 className="serif" style={{ fontSize: 34, fontWeight: 600, marginBottom: 8 }}>{correct} of {total} correct</h1>
      <p style={{ color: "#4A4536", marginBottom: 40 }}>Here's how that breaks down against the exam blueprint.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 40 }}>
        {domainProgress.filter((d) => d.answeredTotal > 0).map((d) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#FFFFFF", border: "1px solid #DCD7C9", borderRadius: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{d.id}. {d.name}</span>
            <span className="mono" style={{ fontSize: 13, color: d.answeredCorrect === d.answeredTotal ? "#2D8B6F" : "#E85D3D", fontWeight: 700 }}>{d.answeredCorrect}/{d.answeredTotal}</span>
          </div>
        ))}
      </div>

      {weakest && (
        <div style={{ background: "#1B2A4A", color: "#F7F5F0", borderRadius: 4, padding: "20px 22px", marginBottom: 32 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <TrendingUp size={16} />
            <span className="mono" style={{ fontSize: 12, letterSpacing: "0.04em", fontWeight: 700 }}>ADAPTIVE TARGETING</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            Domain {weakest.id} ({weakest.name}) is your weakest area this session. In the full
            version, your next practice set automatically weights more heavily toward this domain
            until your accuracy catches up — this is the "adaptive" part of adaptive practice.
          </p>
        </div>
      )}

      <button onClick={onRestart} style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "12px 24px", fontSize: 14, fontWeight: 600 }}>
        Practice again
      </button>
    </main>
  );
}

function CSESimulation() {
  const [scenarioId, setScenarioId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [pendingConsequence, setPendingConsequence] = useState(null);

  const scenario = CSE_SCENARIOS.find((s) => s.id === scenarioId);

  function choose(branch) {
    setPendingConsequence(branch);
  }

  function proceed() {
    setHistory((h) => [...h, pendingConsequence]);
    setPendingConsequence(null);
    setStepIndex((i) => i + 1);
  }

  function selectScenario(id) {
    setScenarioId(id);
    setStepIndex(0);
    setHistory([]);
    setPendingConsequence(null);
  }

  function backToLibrary() {
    setScenarioId(null);
  }

  if (!scenario) {
    return (
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 90px" }}>
        <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#E85D3D", fontWeight: 700, marginBottom: 10 }}>CSE SIMULATION MODE</p>
        <h1 className="serif" style={{ fontSize: 30, fontWeight: 600, marginBottom: 10 }}>Pick a case to work through.</h1>
        <p style={{ fontSize: 15, color: "#4A4536", marginBottom: 32, maxWidth: 560 }}>
          Each case is a branching scenario across multiple decision points — information-gathering,
          diagnosis, and treatment — the same structure as the real Clinical Simulation Exam.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {CSE_SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => selectScenario(s.id)} className="opt" style={{ textAlign: "left", background: "#FFFFFF", border: "1.5px solid #DCD7C9", borderRadius: 5, padding: "18px 20px" }}>
              <span className="mono" style={{ fontSize: 11, color: "#E85D3D", fontWeight: 700, letterSpacing: "0.04em" }}>{s.condition.toUpperCase()}</span>
              <p style={{ fontSize: 15, fontWeight: 600, margin: "6px 0 6px" }}>{s.title}</p>
              <p style={{ fontSize: 13, color: "#8A8578", margin: 0 }}>{s.steps.length} decision points</p>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const step = scenario.steps[stepIndex];
  const done = stepIndex >= scenario.steps.length;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 100px" }}>
      <button onClick={backToLibrary} className="mono" style={{ background: "none", border: "none", fontSize: 12, color: "#8A8578", marginBottom: 18, padding: 0 }}>← All cases</button>
      <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#E85D3D", fontWeight: 700, marginBottom: 10 }}>{scenario.condition.toUpperCase()}</p>
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, marginBottom: 18 }}>{scenario.title}</h1>

      <div style={{ background: "#FFFFFF", border: "1px solid #DCD7C9", borderRadius: 4, padding: "18px 20px", marginBottom: 24 }}>
        <p className="serif" style={{ fontSize: 15, lineHeight: 1.65, margin: 0 }}>{scenario.opening}</p>
      </div>

      {history.map((h, i) => (
        <div key={i} style={{ marginBottom: 18, paddingLeft: 16, borderLeft: `3px solid ${h.correct ? "#2D8B6F" : "#E85D3D"}` }}>
          <p className="mono" style={{ fontSize: 11, color: "#8A8578", marginBottom: 4 }}>STEP {i + 1} — YOU CHOSE:</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{h.label}</p>
          <p style={{ fontSize: 13, color: "#4A4536", lineHeight: 1.55 }}>{h.consequence}</p>
        </div>
      ))}

      {!done && !pendingConsequence && (
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{step.prompt}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {step.branches.map((b, i) => (
              <button key={i} className="opt" onClick={() => choose(b)} style={{ textAlign: "left", background: "#FFFFFF", border: "1.5px solid #DCD7C9", borderRadius: 4, padding: "13px 16px", fontSize: 14, lineHeight: 1.5 }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!done && pendingConsequence && (
        <div style={{ background: pendingConsequence.correct ? "#2D8B6F14" : "#E85D3D14", border: `1.5px solid ${pendingConsequence.correct ? "#2D8B6F" : "#E85D3D"}`, borderRadius: 4, padding: "16px 18px" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            {pendingConsequence.correct ? <CheckCircle2 size={16} color="#2D8B6F" /> : <XCircle size={16} color="#E85D3D" />}
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: pendingConsequence.correct ? "#2D8B6F" : "#E85D3D" }}>{pendingConsequence.correct ? "SOUND CHOICE" : pendingConsequence.suboptimal ? "SUBOPTIMAL — NOT DANGEROUS, BUT OUT OF ORDER" : "RECONSIDER"}</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>{pendingConsequence.consequence}</p>
          <button onClick={proceed} style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "10px 20px", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Continue scenario <ChevronRight size={14} />
          </button>
        </div>
      )}

      {done && (
        <div style={{ background: "#1B2A4A", color: "#F7F5F0", borderRadius: 4, padding: "22px 24px" }}>
          <p className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", marginBottom: 8 }}>SCENARIO COMPLETE</p>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Real CSE problems continue for 4-6 decision points across information-gathering,
            diagnosis, and treatment branches. This demo shows the branching mechanic — the full
            product includes complete scored scenarios across every content domain.
          </p>
          <button onClick={backToLibrary} style={{ background: "#F7F5F0", color: "#1B2A4A", border: "none", borderRadius: 3, padding: "10px 20px", fontSize: 13, fontWeight: 600 }}>
            Try another case
          </button>
        </div>
      )}
    </main>
  );
}

// ---- Automated support chatbot mockup ----
const FAQ = [
  { q: "How is this different from a static question bank?", a: "Every question is generated fresh against the real NBRC blueprint weighting, so you never run out and the mix always matches the actual exam's domain and difficulty balance." },
  { q: "Is this affiliated with the NBRC?", a: "No. CRT/RRT Board Prep is an independent study tool. Questions are original practice items modeled on the publicly available NBRC content outline, not real or retired exam questions." },
  { q: "Can I cancel my subscription anytime?", a: "Yes — cancel anytime from your account settings and you'll keep access through the end of your current billing period." },
  { q: "Does this cover the new 2027 RT Exam?", a: "Yes — we maintain both a legacy TMC/CSE track and a 2027 RT Exam track, updated as the NBRC finalizes the new blueprint." },
];

function SupportChat({ open, setOpen }) {
  const [messages, setMessages] = useState([{ from: "bot", text: "Hi! I'm the CRT/RRT Board Prep assistant. Ask me anything about the product, billing, or how studying works here." }]);
  const [input, setInput] = useState("");

  function send(text) {
    if (!text.trim()) return;
    const match = FAQ.find((f) => text.toLowerCase().includes(f.q.toLowerCase().split(" ").slice(0, 3).join(" ").toLowerCase())) || FAQ.find((f) => f.q.toLowerCase().includes(text.toLowerCase()) || text.toLowerCase().split(" ").some((w) => w.length > 3 && f.q.toLowerCase().includes(w)));
    setMessages((m) => [...m, { from: "user", text }, { from: "bot", text: match ? match.a : "I don't have a specific answer for that yet, but I'll flag it — in the full version, unanswered questions get logged so the FAQ keeps improving without manual work." }]);
    setInput("");
  }

  return (
    <>
      <button onClick={() => setOpen(!open)} style={{ position: "fixed", bottom: 20, right: 20, background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: "50%", width: 52, height: 52, fontSize: 20, boxShadow: "0 4px 14px rgba(27,42,74,0.3)" }}>
        {open ? "×" : "?"}
      </button>
      {open && (
        <div style={{ position: "fixed", bottom: 84, right: 20, width: 320, maxHeight: 440, background: "#FFFFFF", border: "1px solid #DCD7C9", borderRadius: 6, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: "#1B2A4A", color: "#F7F5F0", padding: "12px 16px" }}>
            <p className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", margin: 0 }}>SUPPORT — AUTOMATED</p>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 260 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.from === "bot" ? "flex-start" : "flex-end", background: m.from === "bot" ? "#F0EEE6" : "#1B2A4A14", color: "#1B2A4A", borderRadius: 4, padding: "8px 11px", fontSize: 13, maxWidth: "85%", lineHeight: 1.5 }}>
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ padding: 10, borderTop: "1px solid #DCD7C9", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              {FAQ.map((f, i) => (
                <button key={i} onClick={() => send(f.q)} className="mono" style={{ fontSize: 10, background: "#F0EEE6", border: "1px solid #DCD7C9", borderRadius: 12, padding: "4px 9px", color: "#4A4536" }}>{f.q.slice(0, 24)}…</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask a question…" style={{ flex: 1, border: "1px solid #DCD7C9", borderRadius: 3, padding: "7px 10px", fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={() => send(input)} style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "0 12px", fontSize: 13 }}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
