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
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · Pneumonia",
    stem: "A patient's chart shows: WBC 16,500/mm³, temperature 101.8°F, and a sputum culture pending. The patient was started on IV antibiotics 2 hours ago.",
    question: "Which additional lab value would be MOST useful to trend for assessing treatment response over the next 48 hours?",
    options: [
      { label: "A", text: "Repeat WBC count and temperature trend", correct: true, tag: null, rationale: "Serial WBC and temperature trends are the standard bedside markers for infection response to antibiotic therapy, more immediately actionable than waiting on culture results alone." },
      { label: "B", text: "Serum creatinine only", correct: false, tag: null, rationale: "Renal function matters for drug dosing but doesn't directly indicate infection treatment response." },
      { label: "C", text: "Platelet count only", correct: false, tag: null, rationale: "Platelets aren't a primary marker of infection resolution in routine pneumonia management." },
      { label: "D", text: "Serum glucose only", correct: false, tag: null, rationale: "Glucose isn't a direct marker of infection response unless the patient is diabetic and glycemic control is a separate concern." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A DNR (Do Not Resuscitate) order specifically addresses which of the following?",
    options: [
      { label: "A", text: "Withholding all medical treatment", correct: false, tag: null, rationale: "A DNR does not mean withholding all care — it specifically addresses resuscitation efforts, not general treatment." },
      { label: "B", text: "Withholding cardiopulmonary resuscitation in the event of cardiac or respiratory arrest", correct: true, tag: null, rationale: "A DNR order specifically applies to CPR in the event of arrest; it does not limit other treatments like antibiotics, oxygen, or comfort care unless separately specified." },
      { label: "C", text: "Withholding pain medication", correct: false, tag: null, rationale: "DNR status has no bearing on pain management or comfort care, which continue regardless." },
      { label: "D", text: "Automatic transfer to hospice care", correct: false, tag: null, rationale: "A DNR order does not trigger hospice enrollment — these are separate, distinct processes." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "application",
    patient: "Adult · Pneumothorax",
    stem: "On palpation of the chest wall, the RT notes a crackling sensation under the skin extending from the neck to the upper chest.",
    question: "This finding is most consistent with:",
    options: [
      { label: "A", text: "Subcutaneous emphysema", correct: true, tag: null, rationale: "A crackling, crepitant sensation under the skin is the classic finding of subcutaneous emphysema — air trapped in subcutaneous tissue, often from a pneumothorax or barotrauma." },
      { label: "B", text: "Pleural friction rub", correct: false, tag: null, rationale: "A friction rub is an auscultated sound, not a palpable finding, and reflects inflamed pleural surfaces rubbing together." },
      { label: "C", text: "Pitting edema", correct: false, tag: null, rationale: "Pitting edema is fluid-related and presents as indentation that slowly resolves, not a crackling sensation." },
      { label: "D", text: "Normal chest wall texture", correct: false, tag: null, rationale: "Crepitus under the skin is not a normal finding and warrants further investigation for an air leak source." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Neonatal · General",
    stem: null,
    question: "A normal APGAR score at 5 minutes is defined as a total score of:",
    options: [
      { label: "A", text: "0-3", correct: false, tag: null, rationale: "A score of 0-3 indicates severe distress requiring immediate resuscitation, not a normal finding." },
      { label: "B", text: "4-6", correct: false, tag: null, rationale: "A score of 4-6 indicates moderate distress requiring intervention, not a normal result." },
      { label: "C", text: "7-10", correct: true, tag: null, rationale: "An APGAR score of 7-10 at 5 minutes is considered normal/reassuring, indicating the infant is transitioning well to extrauterine life." },
      { label: "D", text: "APGAR scoring does not apply at 5 minutes", correct: false, tag: null, rationale: "APGAR is routinely assessed at both 1 and 5 minutes after birth, sometimes longer if scores remain low." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "application",
    patient: "Adult · COPD",
    stem: "An RT is calculating the P(A-a)O2 gradient for a patient on room air with a PaO2 of 70 mmHg and PaCO2 of 45 mmHg at sea level.",
    question: "An elevated A-a gradient in this context would most suggest:",
    options: [
      { label: "A", text: "A problem with oxygen diffusion, V/Q mismatch, or shunt rather than pure hypoventilation", correct: true, tag: null, rationale: "An elevated A-a gradient indicates the problem lies within the lung itself (diffusion, V/Q mismatch, shunt) rather than simple hypoventilation, which would show a normal A-a gradient despite hypoxemia." },
      { label: "B", text: "Pure hypoventilation as the only cause of hypoxemia", correct: false, tag: null, rationale: "Pure hypoventilation typically presents with a NORMAL A-a gradient — an elevated gradient points to an intrapulmonary problem instead." },
      { label: "C", text: "A normal, healthy gas exchange process", correct: false, tag: null, rationale: "An elevated A-a gradient is, by definition, an abnormal finding requiring further evaluation." },
      { label: "D", text: "Laboratory error requiring immediate redraw", correct: false, tag: null, rationale: "There's no indication of lab error here — the calculation reflects a real physiological finding." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Auto-PEEP is best identified by which of the following methods?",
    options: [
      { label: "A", text: "An end-expiratory hold maneuver on the ventilator", correct: true, tag: null, rationale: "An end-expiratory hold allows pressure to equilibrate throughout the circuit, revealing trapped pressure (auto-PEEP) that isn't visible on the standard airway pressure display." },
      { label: "B", text: "A standard inspiratory hold maneuver", correct: false, tag: null, rationale: "An inspiratory hold measures plateau pressure, not auto-PEEP, which occurs during exhalation." },
      { label: "C", text: "Checking the set PEEP value on the ventilator display", correct: false, tag: null, rationale: "The set PEEP value doesn't capture unintentional, trapped auto-PEEP, which is additional to what's set." },
      { label: "D", text: "Auscultation alone", correct: false, tag: null, rationale: "Auscultation cannot directly measure auto-PEEP — a specific ventilator maneuver is required." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Adult · Renal Failure",
    stem: "ABG: pH 7.30, PaCO2 32 mmHg, HCO3 15 mEq/L, PaO2 95 mmHg on room air. The patient has a history of chronic kidney disease.",
    question: "This ABG is most consistent with:",
    options: [
      { label: "A", text: "Partially compensated metabolic acidosis", correct: true, tag: null, rationale: "Low pH with low HCO3 indicates a primary metabolic acidosis (consistent with renal failure and its inability to excrete acid); the low PaCO2 reflects respiratory compensation attempting to correct the pH — but pH remains abnormal, making this partial, not full, compensation." },
      { label: "B", text: "Fully compensated respiratory alkalosis", correct: false, tag: null, rationale: "The primary disturbance here is metabolic (low HCO3), not respiratory — this is not primarily a respiratory process." },
      { label: "C", text: "Uncompensated respiratory acidosis", correct: false, tag: null, rationale: "PaCO2 is low, not elevated, which rules out a primary respiratory acidosis." },
      { label: "D", text: "Normal acid-base status", correct: false, tag: null, rationale: "A pH of 7.30 is outside normal range (7.35-7.45), indicating active acidosis." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Pediatric · Asthma",
    stem: "A 10-year-old with acute asthma has a peak flow reading at 40% of personal best despite two back-to-back bronchodilator treatments. RR is 34/min, and the child is using accessory muscles.",
    question: "This clinical picture should be interpreted as:",
    options: [
      { label: "A", text: "Adequate response to therapy, continue current plan", correct: false, tag: null, rationale: "A peak flow at only 40% of personal best after treatment, with ongoing accessory muscle use, indicates a poor — not adequate — response." },
      { label: "B", text: "Severe exacerbation with inadequate treatment response, requiring escalation of care", correct: true, tag: null, rationale: "A peak flow under 50% predicted after initial treatment, combined with tachypnea and accessory muscle use, signals a severe exacerbation not responding to standard bronchodilator therapy — this requires prompt escalation, not continued observation." },
      { label: "C", text: "Normal findings for a pediatric asthma patient", correct: false, tag: null, rationale: "These findings are far from normal and represent significant ongoing respiratory distress." },
      { label: "D", text: "Signs of anxiety only, no physiological concern", correct: false, tag: null, rationale: "Objective findings — low peak flow, tachypnea, accessory muscle use — indicate a real physiological exacerbation, not simply anxiety." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "application",
    patient: "Adult · Suspected PE",
    stem: "A patient presents with sudden dyspnea, pleuritic chest pain, and a normal chest X-ray. D-dimer is elevated.",
    question: "What diagnostic test would the RT most appropriately recommend next?",
    options: [
      { label: "A", text: "CT pulmonary angiography", correct: true, tag: null, rationale: "CTPA is the standard confirmatory test for suspected pulmonary embolism when clinical suspicion and D-dimer results warrant further workup, especially with a normal chest X-ray ruling out other causes." },
      { label: "B", text: "Repeat chest X-ray only", correct: false, tag: null, rationale: "A repeat chest X-ray is unlikely to add diagnostic value when PE is already suspected based on clinical presentation and labs." },
      { label: "C", text: "Pulmonary function testing", correct: false, tag: null, rationale: "PFTs assess chronic lung function and aren't the appropriate acute diagnostic tool for suspected PE." },
      { label: "D", text: "Sleep study", correct: false, tag: null, rationale: "A sleep study is entirely unrelated to the acute presentation described." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Bronchoalveolar lavage (BAL) is most useful for diagnosing which of the following?",
    options: [
      { label: "A", text: "Rib fractures", correct: false, tag: null, rationale: "Rib fractures are diagnosed via imaging (X-ray/CT), not BAL, which samples fluid from the airways." },
      { label: "B", text: "Lower respiratory tract infections and certain interstitial lung diseases", correct: true, tag: null, rationale: "BAL retrieves cellular and microbiological samples from the alveolar level, making it valuable for diagnosing infections (especially in immunocompromised patients) and certain interstitial lung diseases." },
      { label: "C", text: "Pulmonary embolism", correct: false, tag: null, rationale: "PE is diagnosed via imaging like CTPA, not bronchoscopic sampling." },
      { label: "D", text: "Pneumothorax", correct: false, tag: null, rationale: "Pneumothorax is a clinical/imaging diagnosis, not one requiring fluid sampling from the airway." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A patient using a bubble humidifier reports the flowmeter ball is bouncing erratically and audible gurgling has stopped.",
    question: "What is the most likely cause?",
    options: [
      { label: "A", text: "The humidifier bottle has run low or empty on water", correct: true, tag: null, rationale: "Loss of gurgling sound and erratic flow often indicates the humidifier reservoir is low or empty, reducing the resistance that normally causes the bubbling and steady flow pattern." },
      { label: "B", text: "The oxygen source pressure is too high", correct: false, tag: null, rationale: "High source pressure wouldn't specifically explain the loss of gurgling — an empty or low humidifier bottle is the more direct explanation." },
      { label: "C", text: "The patient's nasal cannula is disconnected", correct: false, tag: null, rationale: "A disconnected cannula would show a different pattern — typically a hissing or open-circuit sound at the connection point, not this description." },
      { label: "D", text: "This is normal, expected function", correct: false, tag: null, rationale: "A sudden change from gurgling to silence along with erratic flow indicates a problem, not normal function." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Which color coding is used for an oxygen (E-cylinder) tank in the United States?",
    options: [
      { label: "A", text: "Green", correct: true, tag: null, rationale: "In the US, green is the standard color coding for oxygen cylinders, per CGA (Compressed Gas Association) convention." },
      { label: "B", text: "Yellow", correct: false, tag: null, rationale: "Yellow is used for air cylinders in the US, not oxygen." },
      { label: "C", text: "Gray", correct: false, tag: null, rationale: "Gray is used for carbon dioxide cylinders in the US." },
      { label: "D", text: "Black and white", correct: false, tag: null, rationale: "Black and white is the color scheme for medical air in some coding systems, not oxygen." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A ventilator displays a persistent \"check circuit\" alarm. Inspection shows the exhalation valve diaphragm appears cracked.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Replace the exhalation valve diaphragm before continuing to use the ventilator", correct: true, tag: null, rationale: "A cracked exhalation valve diaphragm can cause leaks and inaccurate volume/pressure delivery — it should be replaced before the ventilator is used on a patient." },
      { label: "B", text: "Silence the alarm and continue using the ventilator as-is", correct: false, tag: null, rationale: "Silencing the alarm without addressing the underlying hardware defect risks inaccurate ventilation and patient harm." },
      { label: "C", text: "Increase the tidal volume setting to compensate", correct: false, tag: null, rationale: "Adjusting settings doesn't fix a hardware defect — the faulty component itself needs to be addressed." },
      { label: "D", text: "Document the issue only, no further action needed", correct: false, tag: null, rationale: "A cracked diaphragm is a safety issue requiring correction, not just documentation." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.B — Ensure Infection Prevention",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Hand hygiene using alcohol-based hand rub is appropriate in all of the following situations EXCEPT:",
    options: [
      { label: "A", text: "Before and after patient contact", correct: false, tag: null, rationale: "This is an appropriate and recommended use of alcohol-based hand rub." },
      { label: "B", text: "After removing gloves", correct: false, tag: null, rationale: "This is also an appropriate and recommended use." },
      { label: "C", text: "When hands are visibly soiled or contaminated with bodily fluids", correct: true, tag: null, rationale: "When hands are visibly soiled, soap and water must be used instead of alcohol-based hand rub, which is not effective at removing visible organic material." },
      { label: "D", text: "Before donning gloves", correct: false, tag: null, rationale: "This is an appropriate and recommended use of alcohol-based hand rub." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.C — Perform Quality Control Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "A blood gas analyzer's daily quality control run shows results outside the acceptable range for the low-level control, but within range for the normal and high-level controls.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Do not report patient results until the issue is resolved and troubleshoot the analyzer for the low-range discrepancy", correct: true, tag: null, rationale: "Any QC result outside acceptable range — even for just one level — means the analyzer cannot be trusted for patient samples in that range until the problem is identified and corrected; reporting results in the meantime risks reporting inaccurate patient data." },
      { label: "B", text: "Proceed with patient testing since two of three levels passed", correct: false, tag: null, rationale: "A single failed QC level invalidates confidence in results across that range — proceeding with patient testing risks reporting values that are actually inaccurate." },
      { label: "C", text: "Recalibrate only the high-level control", correct: false, tag: null, rationale: "The high-level control passed — the issue is specifically with the low-level range and needs troubleshooting there, not recalibration of an already-passing level." },
      { label: "D", text: "Ignore the discrepancy since it's a minor QC issue", correct: false, tag: null, rationale: "QC failures are never appropriate to ignore — they exist specifically to catch problems before they affect patient results." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Adult · General",
    stem: "An intubated patient is being assessed for extubation readiness. Spontaneous breathing trial is successful, cuff leak test is positive, and mental status is appropriate.",
    question: "Which additional factor is MOST important to confirm before proceeding with extubation?",
    options: [
      { label: "A", text: "The patient's ability to protect their airway (adequate cough, gag reflex, secretion management)", correct: true, tag: null, rationale: "Even with a passed SBT and cuff leak, airway protection is a separate and critical requirement — a patient who can breathe spontaneously but can't clear secretions or protect against aspiration is still a poor extubation candidate." },
      { label: "B", text: "The patient's most recent chest X-ray appearance", correct: false, tag: null, rationale: "While relevant to overall status, chest X-ray isn't the deciding factor for extubation readiness when SBT and cuff leak are already favorable." },
      { label: "C", text: "The time of day the extubation would occur", correct: false, tag: null, rationale: "Timing (e.g. avoiding overnight extubation when staffing is lower) is a secondary logistical consideration, not a primary clinical readiness factor." },
      { label: "D", text: "The patient's family's preference", correct: false, tag: null, rationale: "Family communication matters for care overall, but airway protection is the clinical safety factor that determines extubation readiness." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A properly sized oropharyngeal airway (OPA) is measured from:",
    options: [
      { label: "A", text: "The corner of the mouth to the tip of the earlobe or angle of the jaw", correct: true, tag: null, rationale: "This is the standard sizing method for an OPA — an incorrectly sized OPA (too long or too short) can worsen airway obstruction rather than relieve it." },
      { label: "B", text: "The tip of the nose to the earlobe", correct: false, tag: null, rationale: "This measurement is used for sizing a nasopharyngeal airway (NPA), not an OPA." },
      { label: "C", text: "The chin to the sternal notch", correct: false, tag: null, rationale: "This isn't a standard airway sizing landmark for either OPA or NPA." },
      { label: "D", text: "Standard adult sizing regardless of patient anatomy", correct: false, tag: null, rationale: "OPA sizing must be individualized to each patient's anatomy — a one-size-fits-all approach risks airway complications." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "analysis",
    patient: "Adult · General",
    stem: "A tracheostomy patient develops sudden difficulty breathing, with the RT unable to pass a suction catheter through the tracheostomy tube. Breath sounds are diminished bilaterally.",
    question: "What is the most appropriate IMMEDIATE action?",
    options: [
      { label: "A", text: "Remove/replace the tracheostomy tube, as this presentation suggests possible tube obstruction or displacement", correct: true, tag: null, rationale: "Inability to pass a suction catheter combined with acute respiratory difficulty strongly suggests the trach tube itself is obstructed or displaced — this is an emergency requiring prompt tube exchange, not further troubleshooting of the airway around an obstructed tube." },
      { label: "B", text: "Increase suction pressure and try again with the same catheter", correct: false, tag: null, rationale: "If the catheter can't pass, increasing pressure won't fix an obstruction or displacement — this wastes critical time in an airway emergency." },
      { label: "C", text: "Administer a bronchodilator and reassess in 15 minutes", correct: false, tag: null, rationale: "This presentation suggests a mechanical tube problem, not bronchospasm — a bronchodilator won't address an obstructed or displaced tracheostomy tube, and waiting risks further deterioration." },
      { label: "D", text: "Reposition the patient's head and neck only", correct: false, tag: null, rationale: "Repositioning alone doesn't address a likely obstructed or displaced tube and delays definitive correction in an emergency." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.B — Airway Clearance and Lung Expansion",
    level: "application",
    patient: "Adult · Neuromuscular",
    stem: "A patient with a neuromuscular disorder has a weak, ineffective cough and difficulty clearing secretions despite adequate hydration and standard chest physiotherapy.",
    question: "Which technique would be MOST appropriate to add to this patient's care?",
    options: [
      { label: "A", text: "Mechanical insufflation-exsufflation (cough assist device)", correct: true, tag: null, rationale: "For patients with a weak cough due to neuromuscular weakness, mechanical insufflation-exsufflation directly assists both the inhale and the forceful exhale needed to clear secretions — more effective than standard chest physiotherapy alone when the underlying problem is muscle weakness, not just secretion viscosity." },
      { label: "B", text: "Increased postural drainage frequency only", correct: false, tag: null, rationale: "Postural drainage relies on gravity to move secretions but doesn't address the patient's fundamentally weak, ineffective cough needed to expel them." },
      { label: "C", text: "Incentive spirometry only", correct: false, tag: null, rationale: "Incentive spirometry encourages deep inspiration but doesn't assist with the expiratory force needed for effective secretion clearance in a weak-cough patient." },
      { label: "D", text: "Discontinue airway clearance since standard methods aren't working", correct: false, tag: null, rationale: "Stopping airway clearance entirely would leave the patient at high risk for mucus plugging and atelectasis — the right move is escalating to a more effective technique, not stopping." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.B — Airway Clearance and Lung Expansion",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Incentive spirometry is primarily used to:",
    options: [
      { label: "A", text: "Prevent or reverse atelectasis by encouraging sustained maximal inspiration", correct: true, tag: null, rationale: "Incentive spirometry works by encouraging slow, deep, sustained inspiratory effort, which helps re-expand collapsed alveoli and prevent postoperative or bedridden-patient atelectasis." },
      { label: "B", text: "Actively remove secretions from the airway", correct: false, tag: null, rationale: "Incentive spirometry doesn't directly mobilize or remove secretions — that's the role of airway clearance techniques like chest physiotherapy or cough assist." },
      { label: "C", text: "Deliver aerosolized medication to the lower airways", correct: false, tag: null, rationale: "Incentive spirometry is a breathing exercise device, not a medication delivery system." },
      { label: "D", text: "Measure arterial oxygen saturation", correct: false, tag: null, rationale: "Incentive spirometry measures inspiratory volume/flow, not oxygen saturation — that's the function of pulse oximetry." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · ARDS",
    stem: "A patient with ARDS on mechanical ventilation has a plateau pressure of 24 cmH2O and driving pressure (plateau minus PEEP) of 18 cmH2O. Current settings: Vt 6 mL/kg PBW, PEEP 6 cmH2O.",
    question: "What does the elevated driving pressure suggest, and what is the most appropriate action?",
    options: [
      { label: "A", text: "It suggests reduced compliance relative to lung size; consider a PEEP titration trial to see if driving pressure improves at a different PEEP level", correct: true, tag: null, rationale: "Driving pressure reflects lung compliance relative to the tidal volume delivered — an elevated value despite already-protective Vt suggests the current PEEP may not be optimal for this patient's lung mechanics, and a titration trial can help identify a setting that lowers driving pressure without exceeding safe plateau pressure." },
      { label: "B", text: "It is a normal, expected finding requiring no action", correct: false, tag: null, rationale: "A driving pressure this elevated is associated with increased mortality risk in ARDS literature and should prompt further optimization, not be dismissed as normal." },
      { label: "C", text: "It indicates the need to increase tidal volume for better ventilation", correct: false, tag: null, rationale: "Increasing tidal volume would raise driving pressure further and risk more lung injury — this moves in the wrong direction for lung-protective ventilation." },
      { label: "D", text: "It only reflects ventilator circuit resistance, not lung mechanics", correct: false, tag: null, rationale: "Driving pressure (plateau minus PEEP) specifically reflects lung and chest wall compliance, not circuit resistance." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A ventilated patient shows a ventilator graphic with a pressure-time waveform that spikes sharply above the set pressure at the start of each breath, and the patient appears to be triggering extra breaths between set breaths.",
    question: "This waveform pattern is most consistent with:",
    options: [
      { label: "A", text: "Patient-ventilator asynchrony from flow starvation or trigger sensitivity mismatch", correct: true, tag: null, rationale: "A pressure spike at breath initiation combined with extra patient-triggered breaths is a classic sign of asynchrony — often from insufficient flow delivery relative to patient demand or a trigger threshold that's poorly matched to the patient's effort." },
      { label: "B", text: "Normal, well-synchronized ventilation", correct: false, tag: null, rationale: "Pressure spikes and extra triggered breaths are signs of asynchrony, not normal synchronized ventilation." },
      { label: "C", text: "Ventilator circuit disconnection", correct: false, tag: null, rationale: "A disconnection would typically show a loss of pressure and volume delivery, not pressure spikes with extra triggering." },
      { label: "D", text: "Cuff leak around the ET tube", correct: false, tag: null, rationale: "A cuff leak typically presents as a failure to reach set pressure/volume, not sharp pressure spikes with extra patient triggering." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient is undergoing a spontaneous breathing trial. After 20 minutes: RR 32/min, HR increased from 82 to 118, SpO2 dropped from 97% to 89%, and the patient appears diaphoretic and anxious.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Terminate the SBT and return the patient to full ventilatory support", correct: true, tag: null, rationale: "This combination of findings — significant tachypnea, tachycardia, desaturation, and visible distress — are classic SBT failure criteria. Continuing risks patient decompensation; the trial should be stopped and support resumed." },
      { label: "B", text: "Continue the trial for another 20 minutes to gather more data", correct: false, tag: null, rationale: "Continuing despite clear failure criteria risks further patient deterioration — these findings warrant immediate termination, not prolonged observation." },
      { label: "C", text: "Increase FiO2 only and continue the trial unchanged otherwise", correct: false, tag: null, rationale: "Addressing oxygenation alone doesn't resolve the underlying failure to tolerate spontaneous breathing — the whole trial should be stopped, not partially modified." },
      { label: "D", text: "Administer a sedative to calm the patient and continue", correct: false, tag: null, rationale: "Sedating a patient in respiratory distress during an SBT masks worsening symptoms and delays needed support — this is not appropriate management." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.D — Administer Medications and Specialty Gases",
    level: "application",
    patient: "Pediatric · Persistent Pulmonary Hypertension",
    stem: "A neonate with persistent pulmonary hypertension of the newborn (PPHN) is being considered for inhaled nitric oxide (iNO) therapy.",
    question: "What is the primary therapeutic goal of iNO in this condition?",
    options: [
      { label: "A", text: "Selective pulmonary vasodilation to reduce pulmonary vascular resistance and improve oxygenation", correct: true, tag: null, rationale: "iNO acts as a selective pulmonary vasodilator, targeting only the ventilated areas of lung it reaches, which reduces pulmonary vascular resistance and improves V/Q matching in PPHN without causing significant systemic hypotension." },
      { label: "B", text: "Systemic vasodilation to reduce blood pressure", correct: false, tag: null, rationale: "iNO's key advantage is that it acts selectively on pulmonary vasculature, largely sparing systemic blood pressure — that's precisely why it's preferred over systemic vasodilators in this setting." },
      { label: "C", text: "Bronchodilation to reduce airway resistance", correct: false, tag: null, rationale: "iNO's primary mechanism is pulmonary vascular, not bronchodilatory — it doesn't primarily target airway smooth muscle." },
      { label: "D", text: "Sedation to reduce oxygen consumption", correct: false, tag: null, rationale: "iNO is not a sedative — its therapeutic role is specifically pulmonary vasodilation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "analysis",
    patient: "Adult · COPD",
    stem: "A COPD patient on a fixed-dose combination bronchodilator inhaler reports ongoing dyspnea and has had 2 exacerbations requiring oral steroids in the past 6 months, despite reportedly good adherence.",
    question: "What is the most appropriate recommendation?",
    options: [
      { label: "A", text: "Recommend physician evaluation for escalation of maintenance therapy (e.g., triple therapy or add-on treatment)", correct: true, tag: null, rationale: "Recurrent exacerbations despite confirmed adherence to current maintenance therapy is a recognized indication to step up treatment per COPD management guidelines (e.g., GOLD) — this requires physician-directed escalation, not just reassurance or lifestyle advice alone." },
      { label: "B", text: "Recommend discontinuing the current inhaler since it isn't working", correct: false, tag: null, rationale: "Stopping current therapy outright would likely worsen symptoms — escalation/addition of therapy is more appropriate than discontinuation." },
      { label: "C", text: "Recommend no changes since exacerbations are expected in COPD", correct: false, tag: null, rationale: "While COPD exacerbations do occur, recurrent exacerbations despite good adherence is a specific trigger for reassessing and escalating the treatment plan, not something to simply accept as expected." },
      { label: "D", text: "Recommend increasing the dose of the current inhaler beyond labeled dosing", correct: false, tag: null, rationale: "Exceeding labeled dosing isn't an appropriate or safe way to address inadequate control — escalation should follow guideline-based stepwise therapy changes instead." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient receiving IV sedation and mechanical ventilation has been on a fentanyl and propofol infusion for 6 days. The team is now attempting daily sedation interruption per protocol, but the patient becomes severely agitated and tachycardic each time, requiring the infusion to be restarted.",
    question: "What should the RT recommend regarding the ventilation and sedation plan?",
    options: [
      { label: "A", text: "Recommend the team reassess for withdrawal or under-treated pain/anxiety as a contributing factor, alongside continued attempts at lighter sedation targets", correct: true, tag: null, rationale: "Severe agitation on sedation interruption after prolonged infusion raises concern for withdrawal or inadequately controlled underlying pain/anxiety — this needs multidisciplinary reassessment rather than simply abandoning the goal of lighter sedation, since prolonged deep sedation itself carries risks (prolonged ventilation, delirium)." },
      { label: "B", text: "Recommend permanently discontinuing all sedation interruption attempts going forward", correct: false, tag: null, rationale: "Abandoning sedation interruption entirely ignores its evidence-based benefits (shorter ventilation duration, less delirium) — the more appropriate step is investigating the cause of the agitation, not giving up on lighter sedation altogether." },
      { label: "C", text: "Recommend increasing the baseline sedation dose beyond current levels", correct: false, tag: null, rationale: "Simply increasing sedation deepens the very problem (prolonged deep sedation) that daily interruption is meant to address, without investigating the underlying cause of the agitation." },
      { label: "D", text: "Recommend no changes to the current approach", correct: false, tag: null, rationale: "Repeated failed attempts with severe agitation each time warrants reassessment, not continuing the identical approach without adjustment." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · Asthma",
    stem: "An asthma patient in the ED has received 3 back-to-back albuterol/ipratropium nebulizer treatments with minimal improvement in wheeze or peak flow.",
    question: "What is the most appropriate next recommendation?",
    options: [
      { label: "A", text: "Recommend systemic corticosteroids if not already given, and consider continuous nebulized bronchodilator therapy", correct: true, tag: null, rationale: "Minimal response to repeated short-acting bronchodilators is an indication to add systemic corticosteroids (which take longer to act but address underlying inflammation) and consider escalating to continuous nebulization for more sustained bronchodilator delivery." },
      { label: "B", text: "Recommend stopping bronchodilator therapy since it isn't working", correct: false, tag: null, rationale: "Stopping bronchodilators entirely would remove a needed therapy — the right move is escalating and adding complementary treatment, not withdrawing what's already been started." },
      { label: "C", text: "Recommend discharge home with a rescue inhaler", correct: false, tag: null, rationale: "A patient with minimal response to aggressive ED treatment is not a safe discharge candidate — this presentation requires escalation of care, not discharge." },
      { label: "D", text: "Recommend no further intervention, only continued observation", correct: false, tag: null, rationale: "Passive observation without escalating therapy risks the patient progressing to respiratory failure — active escalation is warranted here." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Naloxone is specifically indicated to reverse the effects of which class of medication?",
    options: [
      { label: "A", text: "Opioids", correct: true, tag: null, rationale: "Naloxone is an opioid antagonist specifically used to reverse opioid-induced respiratory depression and sedation." },
      { label: "B", text: "Benzodiazepines", correct: false, tag: null, rationale: "Benzodiazepine reversal requires flumazenil, not naloxone — these are different antagonist/reversal agents for different drug classes." },
      { label: "C", text: "Neuromuscular blocking agents", correct: false, tag: null, rationale: "Neuromuscular blockade reversal uses agents like neostigmine or sugammadex, not naloxone." },
      { label: "D", text: "Beta-blockers", correct: false, tag: null, rationale: "Beta-blocker overdose is managed with agents like glucagon, not naloxone, which is specific to opioid reversal." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "application",
    patient: "Adult · ARDS",
    stem: "A patient meets Berlin criteria for moderate ARDS. The care team is deciding on a ventilation strategy.",
    question: "Which evidence-based strategy is most strongly supported for this patient population?",
    options: [
      { label: "A", text: "Lung-protective ventilation with low tidal volume (6 mL/kg PBW) and plateau pressure kept under 30 cmH2O", correct: true, tag: null, rationale: "The ARDSNet low tidal volume strategy is one of the most robustly evidence-supported interventions in critical care, shown to reduce mortality in ARDS by limiting ventilator-induced lung injury." },
      { label: "B", text: "High tidal volume ventilation to minimize sedation needs", correct: false, tag: null, rationale: "High tidal volumes in ARDS increase ventilator-induced lung injury risk and go against the well-established evidence base for this condition." },
      { label: "C", text: "Permissive hyperoxia targeting SpO2 100%", correct: false, tag: null, rationale: "Current evidence favors avoiding unnecessary hyperoxia in critically ill patients, targeting more conservative oxygenation goals rather than maximal saturation." },
      { label: "D", text: "Early tracheostomy within 24 hours regardless of clinical trajectory", correct: false, tag: null, rationale: "Tracheostomy timing is individualized based on anticipated ventilation duration, not a blanket early intervention supported by evidence for all ARDS patients." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "The GOLD guidelines are primarily used to guide the classification and management of which condition?",
    options: [
      { label: "A", text: "COPD", correct: true, tag: null, rationale: "GOLD (Global Initiative for Chronic Obstructive Lung Disease) guidelines specifically address COPD classification, severity staging, and stepwise management." },
      { label: "B", text: "Asthma", correct: false, tag: null, rationale: "Asthma management is primarily guided by NAEPP/GINA guidelines, not GOLD, which is COPD-specific." },
      { label: "C", text: "ARDS", correct: false, tag: null, rationale: "ARDS management is guided by criteria like the Berlin Definition and ARDSNet protocols, not GOLD." },
      { label: "D", text: "Cystic fibrosis", correct: false, tag: null, rationale: "Cystic fibrosis has its own specific management guidelines through organizations like the Cystic Fibrosis Foundation, not GOLD." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "application",
    patient: "Adult · General",
    stem: "During intrahospital transport of a ventilated patient, the transport ventilator's low-pressure alarm sounds and the RT notices the patient's chest is not rising with delivered breaths.",
    question: "What is the most appropriate immediate action?",
    options: [
      { label: "A", text: "Disconnect from the transport ventilator and manually ventilate with a bag-valve device while troubleshooting", correct: true, tag: null, rationale: "When ventilation is clearly inadequate during transport and the cause isn't immediately obvious, switching to manual ventilation ensures the patient continues receiving breaths while the equipment problem is identified — patient safety takes priority over continuing with malfunctioning equipment." },
      { label: "B", text: "Continue on the transport ventilator and increase the set tidal volume", correct: false, tag: null, rationale: "If the chest isn't rising, the problem may be a circuit disconnection or equipment failure — simply increasing settings on a possibly malfunctioning device doesn't ensure the patient is actually being ventilated." },
      { label: "C", text: "Stop the transport and wait for hospital engineering to arrive", correct: false, tag: null, rationale: "This delays addressing an acute ventilation failure — immediate manual ventilation is needed while troubleshooting happens in parallel, not instead of, addressing the patient's needs." },
      { label: "D", text: "Silence the alarm and continue transport as planned", correct: false, tag: null, rationale: "Silencing an alarm indicating inadequate ventilation without addressing the underlying problem risks significant patient harm." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A Rapid Response Team (RRT) or Medical Emergency Team (MET) is typically activated for which of the following situations?",
    options: [
      { label: "A", text: "Acute clinical deterioration of a patient outside the ICU, before cardiac or respiratory arrest occurs", correct: true, tag: null, rationale: "RRT/MET systems exist specifically to intervene early when a patient shows signs of deterioration on a general unit, aiming to prevent progression to full arrest through early intervention." },
      { label: "B", text: "Routine daily rounding on stable patients", correct: false, tag: null, rationale: "Routine rounding is standard nursing/physician workflow, not the purpose of a rapid response activation." },
      { label: "C", text: "Scheduling elective procedures", correct: false, tag: null, rationale: "This is unrelated to the emergency-response purpose of an RRT/MET." },
      { label: "D", text: "Only after a patient has already coded", correct: false, tag: null, rationale: "By the time a patient has fully coded, the response shifts to a code/cardiac arrest team — RRT/MET is specifically for EARLY intervention before that point." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "The RT is assisting with a bedside percutaneous tracheostomy procedure and is responsible for monitoring the patient's ventilation throughout.",
    question: "What is the RT's most important responsibility during the procedure itself?",
    options: [
      { label: "A", text: "Continuously monitor oxygenation, ventilation, and be prepared to manage the airway if the ET tube is dislodged during the procedure", correct: true, tag: null, rationale: "During a percutaneous trach, there's real risk of losing the airway mid-procedure (e.g., ET tube being pulled back too far or dislodged) — the RT's critical role is continuous monitoring and being ready to immediately manage the airway if this occurs." },
      { label: "B", text: "Documenting the physician's technique in detail for the chart", correct: false, tag: null, rationale: "While documentation matters, it's secondary to the RT's primary safety responsibility of active airway and ventilation monitoring during a high-risk procedure." },
      { label: "C", text: "Preparing discharge paperwork for after the procedure", correct: false, tag: null, rationale: "This is entirely unrelated to the RT's real-time responsibilities during the procedure itself." },
      { label: "D", text: "Ensuring the room temperature is comfortable for the physician", correct: false, tag: null, rationale: "This is not a clinically relevant responsibility during a procedure with real airway risk." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "application",
    patient: "Adult · COPD",
    stem: "A COPD patient being discharged home on supplemental oxygen asks the RT why they can't just turn up the oxygen flow whenever they feel short of breath.",
    question: "What is the most appropriate education to provide?",
    options: [
      { label: "A", text: "Explain that in some COPD patients, too much supplemental oxygen can blunt the drive to breathe and lead to dangerous CO2 retention, so flow should only be adjusted as directed by their care team", correct: true, tag: null, rationale: "This is accurate, patient-appropriate education about the risk of over-oxygenation in certain chronic CO2-retaining COPD patients — explaining the 'why' helps improve adherence to prescribed oxygen flow rather than just issuing a rule without context." },
      { label: "B", text: "Tell the patient there's no real risk and they can adjust the flow freely", correct: false, tag: null, rationale: "This is inaccurate and potentially dangerous education — uncontrolled oxygen titration in some COPD patients carries real clinical risk." },
      { label: "C", text: "Avoid discussing the reasoning and simply tell them not to ask questions about it", correct: false, tag: null, rationale: "This is poor patient education practice — explaining the clinical reasoning improves understanding and adherence, and patients have a right to understand their own care." },
      { label: "D", text: "Tell the patient oxygen flow adjustments are only a physician's concern and refuse to discuss it", correct: false, tag: null, rationale: "Patient education on oxygen therapy safety is squarely within the RT's scope and responsibility, not something to redirect away from entirely." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "recall",
    patient: "Pediatric · Asthma",
    stem: null,
    question: "When teaching a child and their family how to use a metered-dose inhaler (MDI) with a spacer, which technique point is essential to emphasize?",
    options: [
      { label: "A", text: "Actuate the inhaler into the spacer, then have the child take slow, deep breaths through the spacer mouthpiece", correct: true, tag: null, rationale: "A spacer is designed to hold the medication in suspension after actuation, allowing the child to breathe it in over several slow breaths — this is the key technique point that maximizes medication delivery to the lungs rather than the mouth/throat." },
      { label: "B", text: "The child should exhale forcefully into the spacer immediately after actuation", correct: false, tag: null, rationale: "Exhaling into the spacer would blow the medication back out rather than allowing it to be inhaled — this is incorrect technique." },
      { label: "C", text: "The spacer isn't necessary for pediatric patients and can be skipped", correct: false, tag: null, rationale: "Spacers are particularly valuable for pediatric patients, who often struggle with the hand-breath coordination MDIs require without one." },
      { label: "D", text: "The inhaler should be actuated only after the mouthpiece is removed from the mouth", correct: false, tag: null, rationale: "This description doesn't reflect correct spacer technique, which requires the mouthpiece in place while the medication is inhaled from the spacer chamber." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a trend of increasing BUN and creatinine over 3 days, along with decreasing urine output documented on the I&O record.",
    question: "This trend is most consistent with:",
    options: [
      { label: "A", text: "Acute kidney injury", correct: true, tag: null, rationale: "Rising BUN/creatinine paired with declining urine output is the classic pattern for acute kidney injury — relevant to the RT for drug dosing adjustments and fluid management considerations in respiratory care." },
      { label: "B", text: "Improving renal function", correct: false, tag: null, rationale: "Rising, not falling, BUN/creatinine with declining urine output indicates worsening — not improving — renal function." },
      { label: "C", text: "Normal expected postoperative lab trend", correct: false, tag: null, rationale: "This trend is not a normal or expected postoperative finding and warrants clinical attention." },
      { label: "D", text: "Dehydration only, requiring no further workup", correct: false, tag: null, rationale: "While dehydration can contribute to AKI, this trend alone requires broader evaluation, not a single-cause dismissal without workup." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A sputum culture and sensitivity report is most useful for:",
    options: [
      { label: "A", text: "Identifying the causative organism and guiding targeted antibiotic selection", correct: true, tag: null, rationale: "Culture and sensitivity testing identifies the specific pathogen present and which antibiotics it's susceptible to, allowing de-escalation from broad-spectrum empiric therapy to targeted treatment." },
      { label: "B", text: "Measuring lung volumes", correct: false, tag: null, rationale: "Lung volumes are assessed via pulmonary function testing, entirely unrelated to sputum culture results." },
      { label: "C", text: "Assessing cardiac function", correct: false, tag: null, rationale: "Cardiac function is assessed via echocardiography or other cardiac-specific tests, not sputum culture." },
      { label: "D", text: "Determining oxygenation status", correct: false, tag: null, rationale: "Oxygenation status is assessed via ABG or pulse oximetry, not sputum culture and sensitivity." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "application",
    patient: "Neonatal · General",
    stem: "On inspection of a newborn, the RT notes nasal flaring, intercostal retractions, and an expiratory grunt.",
    question: "These findings together indicate:",
    options: [
      { label: "A", text: "Signs of respiratory distress requiring further evaluation", correct: true, tag: null, rationale: "Nasal flaring, retractions, and grunting are the classic triad of neonatal respiratory distress — grunting specifically represents the infant's attempt to maintain positive end-expiratory pressure and prevent alveolar collapse." },
      { label: "B", text: "Normal newborn findings requiring no action", correct: false, tag: null, rationale: "This triad is a well-recognized indicator of respiratory distress, not a normal newborn presentation." },
      { label: "C", text: "Signs of adequate respiratory function", correct: false, tag: null, rationale: "These findings specifically indicate increased work of breathing and distress, the opposite of adequate, unlabored respiratory function." },
      { label: "D", text: "Signs specific to a cardiac, not respiratory, problem", correct: false, tag: null, rationale: "While cardiac issues can contribute to respiratory symptoms, this specific triad is a primary respiratory distress indicator, not a cardiac-specific finding." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Egophony (the \"E to A\" change) heard on auscultation is most associated with:",
    options: [
      { label: "A", text: "Lung consolidation, such as from pneumonia", correct: true, tag: null, rationale: "Egophony occurs when consolidated lung tissue transmits sound differently, causing a spoken 'E' to sound like 'A' through the stethoscope — a classic sign of consolidation." },
      { label: "B", text: "Normal lung tissue", correct: false, tag: null, rationale: "Egophony is an abnormal finding specifically associated with consolidation, not a normal lung exam finding." },
      { label: "C", text: "Pneumothorax", correct: false, tag: null, rationale: "Pneumothorax typically presents with absent or diminished breath sounds, not egophony, which requires consolidated (not air-filled) lung tissue to transmit sound this way." },
      { label: "D", text: "Bronchospasm alone", correct: false, tag: null, rationale: "Bronchospasm alone typically presents with wheeze, not the specific sound transmission change of egophony, which requires consolidation." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is performing a 12-lead ECG and notices the patient is unusually anxious, causing significant muscle tremor artifact on the tracing.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Reassure the patient, ensure they're relaxed and warm, and reposition/repeat leads with poor tracing as needed", correct: true, tag: null, rationale: "Muscle tremor artifact is often reduced by helping the patient relax, keeping them warm (shivering also causes artifact), and ensuring proper limb support — addressing the root cause produces a more diagnostically useful tracing than proceeding with a poor-quality one." },
      { label: "B", text: "Proceed with the tracing as-is regardless of artifact quality", correct: false, tag: null, rationale: "Significant artifact can obscure important diagnostic information — it's worth addressing correctable causes before finalizing the tracing." },
      { label: "C", text: "Cancel the ECG entirely and do not attempt again", correct: false, tag: null, rationale: "Canceling isn't necessary — most tremor artifact is correctable with simple interventions like patient repositioning and reassurance." },
      { label: "D", text: "Sedate the patient to eliminate movement", correct: false, tag: null, rationale: "Sedation is an excessive, inappropriate response to a routine artifact issue that can typically be resolved with simple non-pharmacologic measures." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Which of the following is the correct definition of the P/F ratio?",
    options: [
      { label: "A", text: "PaO2 divided by FiO2 (as a decimal)", correct: true, tag: null, rationale: "The P/F ratio (PaO2/FiO2) is a standard bedside index of oxygenation efficiency, widely used in criteria like the Berlin Definition of ARDS to categorize severity." },
      { label: "B", text: "PaCO2 divided by FiO2", correct: false, tag: null, rationale: "This is not the P/F ratio — PaCO2 is not part of this specific calculation." },
      { label: "C", text: "PaO2 divided by PaCO2", correct: false, tag: null, rationale: "This is not the standard P/F ratio calculation used clinically." },
      { label: "D", text: "FiO2 divided by PaO2", correct: false, tag: null, rationale: "This is the inverse of the correct formula — the P/F ratio is PaO2 over FiO2, not the reverse." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Pediatric · General",
    stem: "A 6-year-old's spirometry shows FEV1/FVC ratio of 65% predicted, with a scooped-out shape on the flow-volume loop.",
    question: "These findings are most consistent with:",
    options: [
      { label: "A", text: "An obstructive pattern, such as asthma", correct: true, tag: null, rationale: "A reduced FEV1/FVC ratio with a scooped/concave expiratory flow-volume curve is the classic signature of an obstructive ventilatory defect, commonly seen in asthma." },
      { label: "B", text: "A restrictive pattern", correct: false, tag: null, rationale: "Restrictive patterns typically show a preserved or elevated FEV1/FVC ratio with reduced lung volumes overall, not this specific obstructive signature." },
      { label: "C", text: "Normal pulmonary function", correct: false, tag: null, rationale: "A reduced FEV1/FVC ratio with this flow-volume loop shape is an abnormal, not normal, finding." },
      { label: "D", text: "A purely technical/effort-related artifact requiring no clinical interpretation", correct: false, tag: null, rationale: "While technique matters in spirometry, this specific pattern (reduced ratio + scooped curve) is a recognized, clinically meaningful obstructive signature, not simply an effort artifact." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "application",
    patient: "Adult · Suspected OSA",
    stem: "A patient reports loud snoring, witnessed apneas during sleep, and daytime somnolence. BMI is 34.",
    question: "What diagnostic test would the RT most appropriately recommend?",
    options: [
      { label: "A", text: "Polysomnography (sleep study)", correct: true, tag: null, rationale: "This presentation — snoring, witnessed apneas, daytime somnolence, elevated BMI — is classic for obstructive sleep apnea, and polysomnography is the gold-standard diagnostic test to confirm and characterize severity." },
      { label: "B", text: "Pulmonary function testing only", correct: false, tag: null, rationale: "PFTs assess lung mechanics during wakefulness and don't diagnose sleep-related breathing disorders." },
      { label: "C", text: "Chest X-ray only", correct: false, tag: null, rationale: "A chest X-ray doesn't evaluate sleep-related breathing patterns and wouldn't confirm or rule out OSA." },
      { label: "D", text: "Bronchoscopy", correct: false, tag: null, rationale: "Bronchoscopy is not indicated for evaluating suspected sleep apnea — it's used for airway/lung tissue visualization and sampling, unrelated to this presentation." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A patient using a portable liquid oxygen system reports the device is making a hissing sound and frost is visibly forming on the outside of the unit.",
    question: "What is the most likely explanation?",
    options: [
      { label: "A", text: "Normal function — liquid oxygen systems commonly show frost and a slight hiss as the liquid converts to gas", correct: true, tag: null, rationale: "Frost formation and a mild hiss are expected, normal characteristics of liquid oxygen systems due to the very cold temperature of the liquid oxygen and the conversion process to breathable gas — this doesn't necessarily indicate malfunction." },
      { label: "B", text: "A dangerous leak requiring immediate evacuation", correct: false, tag: null, rationale: "While any oxygen system issue should be assessed, mild frosting and hissing are expected features of liquid oxygen systems, not automatically signs of a dangerous leak." },
      { label: "C", text: "The unit is broken and needs replacement immediately, no further assessment needed", correct: false, tag: null, rationale: "Jumping straight to replacement without assessing whether this is expected normal function isn't appropriate — these signs alone don't confirm malfunction." },
      { label: "D", text: "This indicates the oxygen concentration is too low", correct: false, tag: null, rationale: "Frost and hissing don't directly indicate oxygen concentration issues — they relate to the physical liquid-to-gas conversion process." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A pin index safety system is specifically designed to:",
    options: [
      { label: "A", text: "Prevent incorrect gas cylinders from being connected to the wrong regulator or equipment", correct: true, tag: null, rationale: "The pin index safety system uses a specific pin arrangement unique to each gas type on small cylinders, physically preventing an incompatible regulator from being attached to the wrong gas — a critical safety feature preventing dangerous gas mix-ups." },
      { label: "B", text: "Measure the remaining gas volume in a cylinder", correct: false, tag: null, rationale: "Gas volume is measured via the pressure gauge, not the pin index system, which serves a connection-safety purpose." },
      { label: "C", text: "Regulate the flow rate of gas delivery", correct: false, tag: null, rationale: "Flow rate regulation is handled by the flowmeter, not the pin index safety system." },
      { label: "D", text: "Filter contaminants from the gas supply", correct: false, tag: null, rationale: "The pin index system has no filtration function — it exists purely to prevent incorrect cylinder-to-regulator connections." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.B — Ensure Infection Prevention",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is about to perform suctioning on a patient with a known multidrug-resistant organism (MDRO) infection under contact precautions.",
    question: "What PPE is minimally required for this procedure?",
    options: [
      { label: "A", text: "Gown and gloves, in addition to standard precautions PPE appropriate for the suctioning procedure itself", correct: true, tag: null, rationale: "Contact precautions specifically require gown and gloves for any patient contact, layered on top of whatever standard precautions PPE the procedure itself already calls for (e.g., mask/eye protection for suctioning due to splash risk)." },
      { label: "B", text: "Gloves only, no additional PPE needed", correct: false, tag: null, rationale: "Contact precautions specifically require a gown in addition to gloves — gloves alone don't meet the contact precautions standard." },
      { label: "C", text: "No PPE beyond what's normally used, since suctioning is a routine procedure", correct: false, tag: null, rationale: "A known MDRO under contact precautions specifically requires additional PPE (gown, gloves) beyond routine baseline practice." },
      { label: "D", text: "N95 respirator only", correct: false, tag: null, rationale: "Contact precautions address organisms spread by touch, not primarily airborne transmission — an N95 alone doesn't fulfill the gown/glove requirement of contact precautions." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.C — Perform Quality Control Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "During daily ventilator QC checks, a self-test reveals the ventilator's oxygen sensor is reading 15% below the known calibration gas concentration.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Take the ventilator out of service and recalibrate or repair the oxygen sensor before use on a patient", correct: true, tag: null, rationale: "An oxygen sensor reading significantly outside the expected calibration range cannot be trusted to deliver accurate FiO2 to a patient — the device should be taken out of service and corrected before any patient use." },
      { label: "B", text: "Use the ventilator as-is and mentally adjust for the known discrepancy", correct: false, tag: null, rationale: "Manually compensating for a known-faulty sensor introduces unnecessary risk of error — the equipment itself should be corrected, not worked around." },
      { label: "C", text: "Document the discrepancy only and proceed with patient use", correct: false, tag: null, rationale: "A significant calibration failure like this means the device isn't safe for patient use until corrected — documentation alone doesn't address the safety issue." },
      { label: "D", text: "Increase the delivered FiO2 setting by 15% to compensate", correct: false, tag: null, rationale: "This assumes the error is perfectly linear and predictable, which isn't a safe assumption — the correct action is fixing the sensor, not guessing at a workaround." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient on pressure support ventilation shows a respiratory rate that has gradually climbed from 16 to 34/min over several hours, with decreasing tidal volumes on each breath, though the pressure support level hasn't changed.",
    question: "This pattern most likely indicates:",
    options: [
      { label: "A", text: "Rapid shallow breathing pattern suggesting the patient may not tolerate continued weaning at the current support level", correct: true, tag: null, rationale: "A rising rate with falling tidal volumes — rapid shallow breathing — is a recognized sign of impending weaning failure or fatigue, and this trend should prompt reassessment of the pressure support level rather than continuing unchanged." },
      { label: "B", text: "Successful weaning progress requiring no intervention", correct: false, tag: null, rationale: "This trend (rising rate, falling volumes) actually signals the opposite — a warning sign of fatigue or failure to tolerate the current support level, not successful progress." },
      { label: "C", text: "A ventilator malfunction unrelated to the patient's respiratory status", correct: false, tag: null, rationale: "This pattern reflects the patient's own physiological response to their current level of support, not equipment malfunction." },
      { label: "D", text: "An expected, benign fluctuation requiring no further evaluation", correct: false, tag: null, rationale: "A sustained trend like this over several hours is a meaningful clinical signal, not just a benign fluctuation to ignore." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Neonatal · General",
    stem: "A neonate on high-frequency oscillatory ventilation (HFOV) has an oxygenation index that has been trending upward over 6 hours despite no changes to mean airway pressure or FiO2.",
    question: "What should the RT investigate?",
    options: [
      { label: "A", text: "Whether lung recruitment has been lost, potentially requiring a recruitment maneuver or mean airway pressure adjustment", correct: true, tag: null, rationale: "A worsening oxygenation index on HFOV without setting changes suggests the lung may have lost recruitment (derecruitment), which often requires reassessing and adjusting mean airway pressure or performing a recruitment maneuver to restore adequate lung volume." },
      { label: "B", text: "Whether the infant needs less respiratory support given improving status", correct: false, tag: null, rationale: "A worsening (rising) oxygenation index indicates deteriorating, not improving, status — this doesn't support reducing support." },
      { label: "C", text: "Whether the infant's diaper needs changing", correct: false, tag: null, rationale: "This is unrelated to the oxygenation index trend and not a clinically relevant consideration for this finding." },
      { label: "D", text: "Nothing further — this is an expected, benign trend on HFOV", correct: false, tag: null, rationale: "A sustained worsening trend in oxygenation index is a clinically significant finding requiring investigation, not something to dismiss as expected." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Pressure-regulated volume control (PRVC) ventilation is best described as:",
    options: [
      { label: "A", text: "A mode that delivers a target tidal volume using the lowest pressure possible, adjusting pressure breath-to-breath as needed", correct: true, tag: null, rationale: "PRVC combines the guaranteed tidal volume delivery of volume control with the variable, decelerating flow pattern and pressure-limiting benefit of pressure control, automatically adjusting the pressure each breath to achieve the set volume with the least pressure necessary." },
      { label: "B", text: "A mode that only guarantees pressure, with no regard for volume delivered", correct: false, tag: null, rationale: "This describes standard pressure control, not PRVC — PRVC specifically targets a set volume while adjusting pressure to get there." },
      { label: "C", text: "A purely spontaneous mode with no set parameters", correct: false, tag: null, rationale: "PRVC is a mandatory/mixed mode with set parameters, not a purely spontaneous mode." },
      { label: "D", text: "A mode used exclusively for noninvasive ventilation", correct: false, tag: null, rationale: "PRVC is typically used in invasive mechanical ventilation, not exclusively or specifically for noninvasive applications." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "analysis",
    patient: "Adult · Heart Failure",
    stem: "A patient with known heart failure on 2L nasal cannula develops worsening dyspnea, new bilateral crackles, and a 4-pound weight gain over 2 days.",
    question: "What should the RT recommend?",
    options: [
      { label: "A", text: "Recommend physician evaluation for likely fluid overload/decompensated heart failure, with possible diuretic therapy and closer respiratory monitoring", correct: true, tag: null, rationale: "Rapid weight gain, new crackles, and worsening dyspnea in a heart failure patient is a classic pattern of fluid overload/decompensation — this needs prompt evaluation and likely diuresis, not just an oxygen adjustment." },
      { label: "B", text: "Recommend increasing oxygen flow only, without further evaluation", correct: false, tag: null, rationale: "While oxygen may need adjustment, treating only the symptom without addressing the likely underlying fluid overload misses the actual driver of the patient's decline." },
      { label: "C", text: "Recommend no changes since this is expected in heart failure patients", correct: false, tag: null, rationale: "This acute change (rapid weight gain, new crackles, worsening dyspnea) is not something to dismiss as expected — it signals active decompensation requiring intervention." },
      { label: "D", text: "Recommend increasing the patient's fluid intake", correct: false, tag: null, rationale: "Increasing fluid intake in a likely fluid-overloaded heart failure patient would worsen, not improve, the clinical picture." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on a bronchodilator nebulizer treatment develops a heart rate increase from 78 to 132 bpm and reports palpitations and tremor partway through the treatment.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Stop the treatment and notify the physician of the adverse reaction", correct: true, tag: null, rationale: "A significant heart rate increase with palpitations and tremor during a bronchodilator treatment represents a notable adverse reaction (common with beta-agonists) — the treatment should be stopped and the physician notified rather than continuing through these symptoms." },
      { label: "B", text: "Continue the treatment since these are expected, mild side effects", correct: false, tag: null, rationale: "While mild tremor can be a known bronchodilator side effect, a heart rate this elevated with palpitations warrants stopping treatment and physician notification, not simply continuing through it." },
      { label: "C", text: "Double the medication dose to complete the treatment faster", correct: false, tag: null, rationale: "Increasing the dose during an apparent adverse reaction would worsen the symptoms, not resolve the treatment more safely." },
      { label: "D", text: "Ignore the vital sign change and finish the treatment as prescribed", correct: false, tag: null, rationale: "Ignoring a significant vital sign change during treatment risks patient harm — this requires active response, not disregard." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Which of the following would be an appropriate indication to recommend discontinuing airway clearance therapy for a patient?",
    options: [
      { label: "A", text: "The patient has minimal to no secretions and clear breath sounds on ongoing assessment", correct: true, tag: null, rationale: "Airway clearance therapy is indicated for active secretion management — once a patient consistently shows minimal secretions and clear breath sounds, continuing therapy no longer provides benefit and can be reasonably discontinued." },
      { label: "B", text: "The patient requests to stop, regardless of clinical secretion burden", correct: false, tag: null, rationale: "While patient preference matters and should be discussed, the clinical decision to discontinue should be grounded in objective secretion/breath sound findings, not solely patient request without clinical context." },
      { label: "C", text: "The patient has just been diagnosed with a new pneumonia", correct: false, tag: null, rationale: "A new pneumonia diagnosis with likely secretions is generally an indication to continue or even increase airway clearance, not discontinue it." },
      { label: "D", text: "It is a scheduled treatment time regardless of clinical status", correct: false, tag: null, rationale: "Discontinuation decisions should be based on clinical status and secretion burden, not simply because it's a scheduled time." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Adult · General",
    stem: "A newly intubated patient's end-tidal CO2 waveform shows no CO2 detected, and breath sounds are absent bilaterally on auscultation, though the chest appears to rise with bagging.",
    question: "What does this most likely indicate?",
    options: [
      { label: "A", text: "Esophageal intubation, requiring immediate tube removal and reintubation", correct: true, tag: null, rationale: "Absent end-tidal CO2 combined with absent breath sounds strongly indicates the tube is in the esophagus, not the trachea — chest rise alone can be misleading (air can enter the stomach and cause visible abdominal/chest movement) and this requires immediate correction, not continued ventilation through the misplaced tube." },
      { label: "B", text: "Correct tracheal placement requiring no further action", correct: false, tag: null, rationale: "Absent CO2 detection is a critical finding inconsistent with correct tracheal placement — this combination specifically indicates the tube is NOT in the trachea." },
      { label: "C", text: "A faulty CO2 detector requiring replacement before reassessing placement", correct: false, tag: null, rationale: "While equipment can occasionally malfunction, the combination of absent CO2 AND absent breath sounds should be treated as esophageal intubation until proven otherwise — this is a patient safety emergency, not primarily an equipment troubleshooting situation." },
      { label: "D", text: "Right mainstem intubation", correct: false, tag: null, rationale: "Right mainstem intubation typically shows breath sounds on the right side with diminished sounds on the left, plus a normal CO2 waveform — this doesn't match the complete absence of both CO2 and bilateral breath sounds described." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "application",
    patient: "Adult · General",
    stem: "During a mass casualty incident, the RT is assigned to triage patients with respiratory complaints. One patient has a respiratory rate of 6/min and is unresponsive; another has a rate of 28/min and is talking but anxious.",
    question: "Using standard triage principles, how should these two patients be categorized?",
    options: [
      { label: "A", text: "The unresponsive patient with RR 6 requires immediate/highest priority intervention; the anxious patient with RR 28 who is still talking is a lower immediate priority", correct: true, tag: null, rationale: "In mass casualty triage, patients with inadequate respiratory effort and altered consciousness (RR 6, unresponsive) represent immediate life threats requiring highest priority, while a patient who is tachypneic but still able to talk and maintain airway/consciousness, though needing attention, is a comparatively lower immediate priority." },
      { label: "B", text: "Both patients should be treated with equal priority", correct: false, tag: null, rationale: "Mass casualty triage specifically requires prioritization — treating all patients with equal priority defeats the purpose of triage in a resource-limited situation." },
      { label: "C", text: "The anxious talking patient should be prioritized first since they are easier to treat quickly", correct: false, tag: null, rationale: "Ease of treatment isn't the triage principle — severity and immediacy of life threat determines priority, and the unresponsive, severely bradypneic patient is the more urgent threat." },
      { label: "D", text: "Neither patient requires prioritization since both are still breathing", correct: false, tag: null, rationale: "Both patients need attention, but their vastly different levels of respiratory adequacy and consciousness mean they clearly warrant different priority levels, not equal deprioritization." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a coagulation panel with INR 3.8 (therapeutic range 2-3 for their indication) drawn this morning. A bronchoscopy is scheduled for this afternoon.",
    question: "What should the RT recommend based on this finding?",
    options: [
      { label: "A", text: "Notify the physician of the supratherapeutic INR before the procedure proceeds, given increased bleeding risk", correct: true, tag: null, rationale: "An INR above the therapeutic range significantly increases bleeding risk for an invasive procedure like bronchoscopy — this needs physician awareness and likely correction or rescheduling before proceeding." },
      { label: "B", text: "Proceed with the bronchoscopy as scheduled without mentioning the lab value", correct: false, tag: null, rationale: "Proceeding without flagging a significantly abnormal coagulation study before an invasive procedure risks a serious bleeding complication." },
      { label: "C", text: "Cancel all future procedures for this patient permanently", correct: false, tag: null, rationale: "This is an overreaction — the appropriate step is addressing the current elevated INR before this specific procedure, not permanently canceling all future procedures." },
      { label: "D", text: "Administer the patient's anticoagulant medication early to prepare for the procedure", correct: false, tag: null, rationale: "Giving more anticoagulant would worsen, not correct, an already elevated INR before a bleeding-risk procedure." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Tactile fremitus is typically INCREASED over an area of:",
    options: [
      { label: "A", text: "Lung consolidation", correct: true, tag: null, rationale: "Consolidated lung tissue transmits vibration more effectively than normal aerated lung, increasing palpable fremitus over the affected area." },
      { label: "B", text: "Pneumothorax", correct: false, tag: null, rationale: "Fremitus is typically decreased or absent over a pneumothorax, since air doesn't transmit vibration as effectively as consolidated tissue." },
      { label: "C", text: "Pleural effusion", correct: false, tag: null, rationale: "Fremitus is typically decreased over a pleural effusion, since fluid dampens vibration transmission." },
      { label: "D", text: "Normal, well-aerated lung tissue", correct: false, tag: null, rationale: "Normal lung tissue has a baseline, moderate fremitus — increased fremitus specifically points toward consolidation, not normal tissue." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is measuring maximum inspiratory pressure (MIP) on a patient being assessed for ventilator liberation readiness. The initial reading seems inconsistent with the patient's clinical presentation.",
    question: "What technique factor is most important to ensure an accurate MIP measurement?",
    options: [
      { label: "A", text: "Ensuring a proper seal around the mouthpiece and allowing sufficient effort/time (typically 20 seconds) to capture the true maximal effort", correct: true, tag: null, rationale: "MIP measurement requires a tight seal to prevent air leak (which falsely lowers the reading) and adequate time for the patient to generate their true maximal inspiratory effort, since the lowest pressure achieved during the measurement period is recorded." },
      { label: "B", text: "Taking the measurement as quickly as possible, within 2 seconds", correct: false, tag: null, rationale: "A very brief measurement window doesn't allow the patient to generate their true maximal effort, potentially underestimating their actual respiratory muscle strength." },
      { label: "C", text: "Measuring without any seal around the mouthpiece", correct: false, tag: null, rationale: "A leak at the mouthpiece would cause a falsely low (less negative) reading, not reflecting the patient's true inspiratory muscle strength." },
      { label: "D", text: "Measuring only during passive, resting breathing", correct: false, tag: null, rationale: "MIP requires a maximal, effortful inspiratory attempt, not passive resting breathing, to accurately assess respiratory muscle strength." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Adult · General",
    stem: "ABG: pH 7.22, PaCO2 68 mmHg, HCO3 27 mEq/L, PaO2 58 mmHg on room air. The patient is a known COPD patient at their reported baseline HCO3 of 30.",
    question: "This ABG is most consistent with:",
    options: [
      { label: "A", text: "Acute-on-chronic respiratory acidosis with hypoxemia, representing an acute exacerbation superimposed on chronic CO2 retention", correct: true, tag: null, rationale: "The significantly low pH despite an elevated (compensating) HCO3 indicates the respiratory acidosis has worsened acutely beyond what the patient's chronic compensation can handle — a classic acute-on-chronic picture in a COPD exacerbation." },
      { label: "B", text: "Fully compensated chronic respiratory acidosis, a stable baseline finding", correct: false, tag: null, rationale: "A pH this low (7.22) indicates the patient is NOT fully compensated — this represents an acute worsening, not a stable, fully compensated chronic state." },
      { label: "C", text: "Acute metabolic acidosis", correct: false, tag: null, rationale: "The primary disturbance here is respiratory (elevated PaCO2), not metabolic — HCO3 is actually elevated, reflecting chronic renal compensation, not a primary metabolic acidosis." },
      { label: "D", text: "Normal ABG for a COPD patient", correct: false, tag: null, rationale: "A pH of 7.22 is significantly abnormal and represents acute decompensation, not a normal or stable baseline finding even for a chronic CO2 retainer." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Exhaled nitric oxide (FeNO) testing is most useful for:",
    options: [
      { label: "A", text: "Assessing airway inflammation, particularly in asthma, and guiding anti-inflammatory therapy decisions", correct: true, tag: null, rationale: "FeNO correlates with eosinophilic airway inflammation and is used clinically to support an asthma diagnosis and help guide decisions about inhaled corticosteroid therapy." },
      { label: "B", text: "Diagnosing pulmonary embolism", correct: false, tag: null, rationale: "FeNO has no role in diagnosing PE, which is assessed via imaging like CTPA." },
      { label: "C", text: "Measuring lung volumes", correct: false, tag: null, rationale: "Lung volumes are measured via plethysmography or other PFT methods, not FeNO, which specifically measures exhaled nitric oxide as an inflammation marker." },
      { label: "D", text: "Assessing cardiac output", correct: false, tag: null, rationale: "FeNO is unrelated to cardiac output assessment, which uses different hemodynamic monitoring methods." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A significant rise in B-type natriuretic peptide (BNP) is most useful for supporting a diagnosis of:",
    options: [
      { label: "A", text: "Heart failure / cardiogenic causes of dyspnea", correct: true, tag: null, rationale: "BNP is released in response to ventricular wall stress and is a well-established marker for supporting a diagnosis of heart failure, particularly useful in distinguishing cardiac from pulmonary causes of acute dyspnea." },
      { label: "B", text: "Pneumonia", correct: false, tag: null, rationale: "BNP isn't a marker for infectious pulmonary processes like pneumonia — that's better assessed with markers like WBC count and imaging." },
      { label: "C", text: "Pulmonary embolism specifically", correct: false, tag: null, rationale: "While BNP can be elevated in PE due to right heart strain, it isn't the specific diagnostic marker for PE — D-dimer and imaging are more specific for that diagnosis." },
      { label: "D", text: "Asthma exacerbation", correct: false, tag: null, rationale: "BNP isn't a marker used in the diagnosis or monitoring of asthma exacerbations." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "application",
    patient: "Pediatric · General",
    stem: "On assessment of a 3-year-old with respiratory distress, the RT notes stridor that is present both on inspiration and expiration, along with a barky quality to the cough.",
    question: "Biphasic stridor (present on both inspiration and expiration) most suggests:",
    options: [
      { label: "A", text: "A fixed or severe airway obstruction, warranting prompt further evaluation", correct: true, tag: null, rationale: "While inspiratory-only stridor often suggests a variable extrathoracic obstruction, biphasic stridor suggests a more severe or fixed obstruction affecting the airway throughout the respiratory cycle, warranting more urgent evaluation." },
      { label: "B", text: "A normal finding in pediatric patients with a cold", correct: false, tag: null, rationale: "Biphasic stridor is not a normal or benign finding — it suggests a more significant obstruction requiring evaluation, not something to dismiss as a routine cold symptom." },
      { label: "C", text: "Lower airway disease exclusively, with no upper airway involvement", correct: false, tag: null, rationale: "Stridor itself is generally a sign of upper airway (extrathoracic) obstruction, not primarily lower airway disease, which more typically presents with wheeze." },
      { label: "D", text: "A benign finding requiring no further assessment", correct: false, tag: null, rationale: "Biphasic stridor specifically raises concern for more severe obstruction and should prompt further evaluation, not be dismissed as benign." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "During a 6-minute walk test, the test should be stopped early if the patient develops:",
    options: [
      { label: "A", text: "Chest pain, severe dyspnea, or a significant drop in SpO2 below the pre-established stopping threshold", correct: true, tag: null, rationale: "Standard 6-minute walk test protocols include specific stopping criteria for safety, including chest pain, intolerable dyspnea, and significant desaturation below a pre-set threshold — these require stopping the test early." },
      { label: "B", text: "Mild fatigue only, typical of any exercise test", correct: false, tag: null, rationale: "Mild, expected fatigue during an exercise test isn't itself a stopping criterion — the test is designed to assess functional exercise tolerance, which naturally involves some fatigue." },
      { label: "C", text: "Reaching the 6-minute mark, which never requires early stopping regardless of symptoms", correct: false, tag: null, rationale: "Safety stopping criteria can require early termination before the full 6 minutes if concerning symptoms develop — the time limit doesn't override safety concerns." },
      { label: "D", text: "The test should never be stopped early under any circumstances", correct: false, tag: null, rationale: "Safety stopping criteria exist specifically to allow early termination when needed — this option ignores necessary safety protocols." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's noninvasive ventilation mask is causing a significant air leak around the bridge of the nose, and the device is compensating with increasing delivered pressure, though the patient reports discomfort and eye irritation from air blowing into their eyes.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Reassess and adjust the mask fit and sizing, or consider an alternative interface, to eliminate the leak source", correct: true, tag: null, rationale: "A leak causing eye irritation and requiring pressure compensation is a mask-fit problem — the appropriate fix is addressing the fit or trying an alternative interface, not simply tolerating the leak or over-tightening, which can cause skin breakdown." },
      { label: "B", text: "Significantly over-tighten the mask straps to eliminate any leak", correct: false, tag: null, rationale: "Over-tightening risks pressure injury to the skin and doesn't address the underlying fit/sizing problem causing the leak in the first place." },
      { label: "C", text: "Ignore the leak since the device is compensating with increased pressure", correct: false, tag: null, rationale: "While the device may compensate to some degree, ongoing leak causing patient discomfort (eye irritation) should be addressed directly rather than simply tolerated." },
      { label: "D", text: "Discontinue NIV entirely due to this issue", correct: false, tag: null, rationale: "This is an excessive response to a correctable fit issue — adjusting the mask or trying an alternative interface is the appropriate step, not discontinuing needed therapy." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A Venturi mask delivers oxygen concentration primarily based on:",
    options: [
      { label: "A", text: "The specific jet/adapter size, which controls air entrainment and thus the fixed FiO2 delivered", correct: true, tag: null, rationale: "Venturi masks use interchangeable color-coded jet adapters that create a specific, fixed air entrainment ratio, allowing precise, consistent FiO2 delivery regardless of the patient's inspiratory flow demand — this is their key clinical advantage." },
      { label: "B", text: "The patient's own respiratory rate", correct: false, tag: null, rationale: "The Venturi mask's entrainment design is specifically meant to deliver a FIXED FiO2 largely independent of the patient's own respiratory pattern, unlike simple low-flow devices." },
      { label: "C", text: "Random variation with no consistent mechanism", correct: false, tag: null, rationale: "Venturi masks are specifically designed for precise, consistent FiO2 delivery via their entrainment mechanism, not random variation." },
      { label: "D", text: "The humidification level set on the device", correct: false, tag: null, rationale: "Humidification is a separate consideration from the FiO2 delivery mechanism, which is governed by the jet adapter's entrainment ratio." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.C — Perform Quality Control Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Two-level (or multi-level) quality control testing on a blood gas analyzer is performed to:",
    options: [
      { label: "A", text: "Verify accuracy across the clinically relevant range of values the analyzer will report on real patient samples", correct: true, tag: null, rationale: "Testing at multiple levels (low, normal, high) ensures the analyzer is accurate across the full range of values likely to be encountered clinically, since an analyzer could pass at one level but be inaccurate at another." },
      { label: "B", text: "Save time compared to single-level testing", correct: false, tag: null, rationale: "Multi-level QC actually takes more time than single-level testing — the purpose is more thorough accuracy verification, not time savings." },
      { label: "C", text: "Replace the need for daily maintenance", correct: false, tag: null, rationale: "QC testing and routine maintenance serve different purposes and don't substitute for one another — both are typically required." },
      { label: "D", text: "Calibrate the device automatically without any further verification needed", correct: false, tag: null, rationale: "QC testing verifies existing calibration accuracy; it doesn't itself perform calibration adjustments — a QC failure would prompt separate calibration or troubleshooting steps." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A ventilated patient's inspiratory flow-time waveform shows the flow reaching zero and remaining flat before the set inspiratory time ends, before the next breath is delivered.",
    question: "This finding indicates:",
    options: [
      { label: "A", text: "Inspiratory time is longer than needed to deliver the breath, creating an inspiratory pause/plateau that could potentially be shortened", correct: true, tag: null, rationale: "When flow reaches zero before the set inspiratory time ends, this represents time where no gas is being delivered — essentially an unintended inspiratory hold — which can sometimes be shortened to improve patient synchrony without affecting delivered volume." },
      { label: "B", text: "The patient is receiving inadequate tidal volume", correct: false, tag: null, rationale: "This waveform finding relates to the timing of flow delivery, not necessarily the total volume delivered — inadequate volume would show differently on the volume waveform." },
      { label: "C", text: "A ventilator malfunction requiring immediate replacement", correct: false, tag: null, rationale: "This is a recognized, correctable waveform pattern related to inspiratory time settings, not necessarily an equipment malfunction requiring replacement." },
      { label: "D", text: "Normal, ideal ventilator function requiring no assessment", correct: false, tag: null, rationale: "While not dangerous, this pattern often indicates an opportunity to optimize inspiratory time settings for better patient synchrony — it's worth assessing, not simply ignoring." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "In pressure control ventilation, tidal volume delivered is primarily determined by:",
    options: [
      { label: "A", text: "The set pressure level, patient's lung compliance and airway resistance, and inspiratory time", correct: true, tag: null, rationale: "Unlike volume control, pressure control ventilation delivers a variable tidal volume that depends on the interaction between the set pressure, the patient's own lung mechanics (compliance/resistance), and how long that pressure is applied (inspiratory time) — it isn't a fixed, guaranteed volume." },
      { label: "B", text: "A fixed, guaranteed tidal volume regardless of lung mechanics", correct: false, tag: null, rationale: "This describes volume control ventilation, not pressure control, where tidal volume varies with the patient's lung mechanics rather than being fixed." },
      { label: "C", text: "The respiratory rate setting alone", correct: false, tag: null, rationale: "Respiratory rate affects how many breaths are delivered per minute, not the tidal volume of each individual breath in pressure control ventilation." },
      { label: "D", text: "The FiO2 setting", correct: false, tag: null, rationale: "FiO2 controls oxygen concentration delivered, entirely separate from the tidal volume delivered during each breath." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Pediatric · Cystic Fibrosis",
    stem: "A pediatric CF patient's routine sputum culture returns positive for Pseudomonas aeruginosa for the first time, though the patient remains clinically stable with no acute symptom change.",
    question: "What should the RT recommend?",
    options: [
      { label: "A", text: "Recommend physician awareness of this new pathogen for consideration of eradication therapy, given the significance of new Pseudomonas colonization in CF", correct: true, tag: null, rationale: "New Pseudomonas acquisition in CF patients is clinically significant even without acute symptoms, as early eradication therapy can delay chronic colonization, which is associated with faster lung function decline — this warrants prompt physician awareness and action, not routine dismissal." },
      { label: "B", text: "Recommend no action since the patient has no acute symptoms", correct: false, tag: null, rationale: "New Pseudomonas colonization in CF is significant regardless of current symptom status — early intervention (eradication therapy) is often recommended specifically to prevent future decline, not deferred until symptoms appear." },
      { label: "C", text: "Recommend discontinuing routine sputum cultures going forward since this one was positive", correct: false, tag: null, rationale: "Routine surveillance cultures remain important for ongoing CF monitoring — a positive result doesn't mean surveillance should stop, quite the opposite." },
      { label: "D", text: "Recommend immediate hospitalization regardless of clinical stability", correct: false, tag: null, rationale: "A clinically stable patient with new Pseudomonas colonization doesn't necessarily require hospitalization — outpatient eradication therapy is often appropriate, reserving hospitalization for more significant clinical change." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Which of the following would be an appropriate reason to recommend a change from a simple face mask to a non-rebreather mask?",
    options: [
      { label: "A", text: "The patient requires a higher FiO2 than a simple mask can reliably deliver", correct: true, tag: null, rationale: "A non-rebreather mask can deliver a higher FiO2 (up to roughly 90-100% with a good seal and adequate flow) compared to a simple face mask's more limited range, making it the appropriate escalation when a patient needs more oxygen support." },
      { label: "B", text: "The patient prefers a different mask style for comfort alone, with no change in oxygen needs", correct: false, tag: null, rationale: "While comfort matters, mask escalation decisions should primarily be driven by the patient's oxygenation needs, not preference alone when there's no clinical indication for the change." },
      { label: "C", text: "The patient's oxygen needs have decreased significantly", correct: false, tag: null, rationale: "If oxygen needs have decreased, this would typically prompt de-escalation to a simpler, lower-FiO2 device, not escalation to a non-rebreather, which delivers higher FiO2." },
      { label: "D", text: "The simple mask is currently unavailable in the supply closet", correct: false, tag: null, rationale: "Equipment availability isn't a clinical indication for changing oxygen delivery devices — the decision should be based on the patient's oxygenation needs." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "During interfacility air transport of a ventilated patient, which of the following is a specific consideration unique to air transport (compared to ground transport)?",
    options: [
      { label: "A", text: "Changes in cabin pressure/altitude can affect gas volumes (e.g., ET tube cuff pressure, pneumothorax size) and require monitoring", correct: true, tag: null, rationale: "Altitude-related pressure changes during air transport can cause gas expansion (per Boyle's law), affecting ET tube cuff pressures and the size of any undrained pneumothorax — this requires specific monitoring and precautions not typically relevant to ground transport." },
      { label: "B", text: "Ventilator settings never need adjustment during air transport", correct: false, tag: null, rationale: "Altitude-related changes can actually necessitate ventilator adjustments during air transport, contrary to this statement." },
      { label: "C", text: "Patient monitoring is not necessary during flight", correct: false, tag: null, rationale: "Continuous patient monitoring remains essential during air transport, arguably even more critical given the additional physiological stressors of flight." },
      { label: "D", text: "Oxygen requirements typically decrease at higher cabin altitudes", correct: false, tag: null, rationale: "Lower cabin pressure at altitude typically reduces available oxygen partial pressure, often INCREASING a patient's oxygen requirement, not decreasing it." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A Fenestrated tracheostomy tube is specifically designed to:",
    options: [
      { label: "A", text: "Allow airflow through an opening in the tube to facilitate speech and upper airway breathing when the tube is capped or the inner cannula removed", correct: true, tag: null, rationale: "The fenestration (opening) in this type of tracheostomy tube allows air to pass up through the vocal cords when capped, facilitating speech and assessment of the patient's ability to breathe through their upper airway before decannulation." },
      { label: "B", text: "Provide a more secure cuff seal than standard tracheostomy tubes", correct: false, tag: null, rationale: "The fenestration doesn't relate to cuff seal quality — its purpose is specifically to allow airflow through the opening for speech/upper airway assessment purposes." },
      { label: "C", text: "Increase suctioning efficiency", correct: false, tag: null, rationale: "The fenestration's purpose is related to speech and upper airway airflow, not suctioning efficiency." },
      { label: "D", text: "Deliver medication directly through the tube wall", correct: false, tag: null, rationale: "This isn't the function of a fenestrated tube — its specific design purpose relates to enabling airflow through the fenestration for speech and airway assessment." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.B — Airway Clearance and Lung Expansion",
    level: "application",
    patient: "Pediatric · Cystic Fibrosis",
    stem: "A pediatric CF patient uses a high-frequency chest wall oscillation (HFCWO) vest twice daily as prescribed but reports the sessions feel less effective lately, with more retained secretions noted on exam.",
    question: "What should the RT assess first?",
    options: [
      { label: "A", text: "Proper vest fit, device settings (frequency/pressure), and technique adherence, since effectiveness depends heavily on correct use", correct: true, tag: null, rationale: "HFCWO effectiveness is highly dependent on proper vest fit and correct device settings — reassessing these factors first is appropriate before assuming the therapy itself has become ineffective or the disease has progressed." },
      { label: "B", text: "Assume disease progression is the only explanation and escalate to more invasive therapy immediately", correct: false, tag: null, rationale: "Jumping to assuming disease progression skips the simpler, more common explanation of technique or equipment issues, which should be assessed first." },
      { label: "C", text: "Discontinue HFCWO therapy since it's no longer working", correct: false, tag: null, rationale: "Discontinuing a needed airway clearance therapy without first troubleshooting fit/technique issues isn't appropriate — the therapy may simply need adjustment, not discontinuation." },
      { label: "D", text: "Increase the frequency of sessions without assessing current technique", correct: false, tag: null, rationale: "Simply adding more sessions without first checking whether the current sessions are being performed correctly may not solve the underlying problem." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "During moderate (conscious) sedation for a procedure, the RT's primary monitoring responsibility typically includes:",
    options: [
      { label: "A", text: "Continuous monitoring of oxygenation, ventilation, and level of consciousness throughout the sedation period", correct: true, tag: null, rationale: "Moderate sedation carries real risk of respiratory depression — continuous monitoring of oxygenation (pulse ox), ventilation (capnography/observation), and consciousness level is essential throughout the procedure to catch early signs of over-sedation." },
      { label: "B", text: "Monitoring only at the start and end of the procedure", correct: false, tag: null, rationale: "Intermittent monitoring only at the start/end misses the real-time changes that can occur throughout a sedation period — continuous monitoring is the standard of care." },
      { label: "C", text: "No specific monitoring responsibility during sedation procedures", correct: false, tag: null, rationale: "The RT typically has an active, important monitoring role during procedural sedation given the respiratory risks involved." },
      { label: "D", text: "Monitoring the physician's technique rather than the patient", correct: false, tag: null, rationale: "The RT's monitoring responsibility is specifically patient-focused (oxygenation, ventilation, consciousness), not evaluating the proceduralist's technique." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "application",
    patient: "Adult · General",
    stem: "A patient newly diagnosed with obstructive sleep apnea is being set up on CPAP therapy for the first time and expresses frustration, saying they don't think they'll be able to tolerate wearing a mask all night.",
    question: "What is the most appropriate initial response?",
    options: [
      { label: "A", text: "Acknowledge the concern, provide education on gradual acclimatization strategies, and discuss different mask/interface options that might improve tolerance", correct: true, tag: null, rationale: "Validating the patient's concern while providing practical strategies (gradual wear-time increases, trying different interfaces) addresses both the emotional and practical barriers to adherence, which is critical since CPAP only works if it's actually used consistently." },
      { label: "B", text: "Tell the patient they have no choice and must simply comply", correct: false, tag: null, rationale: "This dismissive approach doesn't address the patient's real concerns and is more likely to reduce long-term adherence than genuine, supportive education." },
      { label: "C", text: "Immediately discontinue the recommendation for CPAP therapy", correct: false, tag: null, rationale: "Abandoning an indicated therapy at the first expression of concern skips an opportunity to problem-solve and support adherence — most patients can improve tolerance with proper support and troubleshooting." },
      { label: "D", text: "Provide no specific guidance and simply send the patient home with the equipment", correct: false, tag: null, rationale: "Sending a frustrated, hesitant new CPAP user home without addressing their concerns or providing acclimatization guidance significantly reduces the likelihood of successful long-term adherence." },
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
  {
    id: "immunocompromised",
    condition: "Immunocompromised Host",
    title: "Adult, Neutropenic Fever with Respiratory Symptoms",
    opening: "A 52-year-old woman undergoing chemotherapy for leukemia, currently neutropenic, develops fever, new cough, and mild dyspnea. SpO2 is 92% on room air. Chest X-ray shows a subtle new infiltrate.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend prompt broad-spectrum diagnostic workup and empiric antimicrobial coverage given her neutropenic status", correct: true, consequence: "Cultures and imaging are expedited, and empiric broad-spectrum antibiotics are started promptly given the high risk of rapid deterioration in neutropenic fever." },
          { label: "Recommend waiting for the fever to persist 48 hours before any workup", correct: false, consequence: "Neutropenic fever is a medical emergency — delaying evaluation and treatment risks rapid progression to sepsis in a patient with minimal immune defense.", suboptimal: true },
          { label: "Recommend only supportive oxygen therapy with no further workup", correct: false, consequence: "This misses the urgency of identifying and treating a potential serious infection in an immunocompromised, neutropenic patient.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Given her immunocompromised status, what additional precaution should guide her respiratory care?",
        branches: [
          { label: "Recommend neutropenic precautions (protective isolation) alongside standard respiratory care to minimize her infection exposure risk", correct: true, consequence: "Neutropenic precautions are implemented, reducing her risk of acquiring additional infections while her immune system is severely compromised." },
          { label: "Recommend no special precautions since she's already infected", correct: false, consequence: "Even with a current infection, neutropenic patients remain at high risk for acquiring additional infections — protective precautions still matter.", suboptimal: true },
          { label: "Recommend moving her to a standard shared room for easier monitoring", correct: false, consequence: "A shared room increases her exposure to other potential pathogens at a time when her immune defenses are minimal — this is the wrong direction for her safety.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "ild",
    condition: "Interstitial Lung Disease",
    title: "Adult, Idiopathic Pulmonary Fibrosis Exacerbation",
    opening: "A 68-year-old man with known idiopathic pulmonary fibrosis presents with a 1-week history of worsening dyspnea beyond his usual baseline. SpO2 is 88% on his home 2L oxygen. New bilateral ground-glass opacities are seen on CT, without clear infectious cause identified.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend increasing supplemental oxygen to maintain adequate saturation and support for a likely acute IPF exacerbation", correct: true, consequence: "Oxygen is titrated up, improving SpO2 to 92%. The team begins evaluating for acute exacerbation of IPF, a recognized and serious complication." },
          { label: "Recommend decreasing his oxygen since he's a chronic CO2 retainer like COPD patients", correct: false, consequence: "IPF patients are not typically CO2 retainers in the same way some COPD patients are — under-oxygenating this desaturating patient isn't appropriate here.", suboptimal: true },
          { label: "Recommend no changes to his home oxygen regimen", correct: false, consequence: "His saturation has dropped meaningfully below his baseline — this acute change requires an active response, not maintaining unchanged therapy.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite oxygen escalation, his oxygenation remains marginal. What should guide further ventilatory planning discussions?",
        branches: [
          { label: "Recommend early discussion of goals of care and ventilatory support preferences, given the historically poor prognosis of invasive ventilation in acute IPF exacerbation", correct: true, consequence: "The team engages the patient and family in a goals-of-care discussion, respecting his values while being honest about the limited benefit mechanical ventilation has shown in this specific condition." },
          { label: "Recommend proceeding straight to intubation without any goals-of-care discussion", correct: false, consequence: "Given the poor evidence for invasive ventilation improving outcomes in acute IPF exacerbations, skipping a goals-of-care conversation misses an important opportunity for patient-centered decision-making.", suboptimal: true },
          { label: "Recommend against ANY further escalation of care regardless of patient wishes", correct: false, consequence: "Decisions about care escalation should involve the patient's own values and preferences, not be made unilaterally without their input.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "lung-cancer",
    condition: "Lung Cancer",
    title: "Adult, Post-Lobectomy for Lung Cancer",
    opening: "A 61-year-old man is post-op day 2 from a right upper lobectomy for lung cancer. He has a chest tube in place, is reluctant to cough due to pain, and his SpO2 has drifted from 95% to 91% on 2L oxygen.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend optimizing pain control alongside incentive spirometry and directed coughing to prevent atelectasis", correct: true, consequence: "With better pain control, the patient performs incentive spirometry more effectively and his SpO2 improves to 94% over the next few hours." },
          { label: "Recommend simply increasing oxygen flow without addressing the pain-limited breathing", correct: false, consequence: "This treats the symptom but ignores the underlying cause — pain-limited shallow breathing risking atelectasis — which needs to be addressed directly.", suboptimal: true },
          { label: "Recommend strict bed rest and no respiratory therapy until pain resolves on its own", correct: false, consequence: "Withholding airway clearance and lung expansion therapy in a post-lobectomy patient significantly raises atelectasis and pneumonia risk — this is the wrong direction.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "The chest tube's air leak, previously stable, has increased and his subcutaneous emphysema is spreading. What do you recommend?",
        branches: [
          { label: "Recommend prompt surgical/thoracic evaluation for a possible new or worsening air leak from the bronchial stump or lung surface", correct: true, consequence: "Thoracic surgery is consulted promptly. Further evaluation confirms a correctable issue with the chest tube system, which is addressed before it worsens further." },
          { label: "Recommend simply clamping the chest tube to stop the leak", correct: false, consequence: "Clamping a chest tube with an active air leak can cause a tension pneumothorax — this is a dangerous action, not an appropriate management step.", suboptimal: true },
          { label: "Recommend no action since some air leak is expected after lung surgery", correct: false, consequence: "While some air leak is expected initially, a WORSENING leak with spreading subcutaneous emphysema is a red flag requiring prompt evaluation, not routine dismissal.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "congenital",
    condition: "Congenital Defects",
    title: "Neonatal, Congenital Diaphragmatic Hernia",
    opening: "A newborn with a prenatally diagnosed congenital diaphragmatic hernia is delivered and shows immediate respiratory distress, a scaphoid abdomen, and absent breath sounds on the affected side.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation for initial respiratory management?",
        branches: [
          { label: "Recommend immediate intubation and avoid bag-mask ventilation, which can worsen bowel distension in the chest", correct: true, consequence: "The infant is intubated promptly. Avoiding mask ventilation prevents further gastric distension from pushing abdominal contents further into the thoracic cavity, which would worsen lung compression." },
          { label: "Recommend routine bag-mask ventilation as the first approach", correct: false, consequence: "Bag-mask ventilation in CDH risks forcing air into the stomach and bowel, which are displaced into the chest, further compressing the already hypoplastic lung — this is specifically avoided in known or suspected CDH.", suboptimal: true },
          { label: "Recommend delaying any airway intervention until the infant is more stable", correct: false, consequence: "This infant is showing significant respiratory distress at delivery — delaying airway management risks rapid deterioration.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "After intubation, what additional early step should be taken to help decompress the abdominal contents in the chest?",
        branches: [
          { label: "Recommend placement of an orogastric or nasogastric tube to decompress the stomach and reduce thoracic compression", correct: true, consequence: "An OG tube is placed, decompressing the stomach and providing some relief to the compressed lung, improving ventilation slightly while the team prepares for further management." },
          { label: "Recommend withholding gastric decompression until after surgical repair", correct: false, consequence: "Early gastric decompression is a standard, important early step in CDH management — waiting until after surgery unnecessarily prolongs thoracic compression from a distended stomach.", suboptimal: true },
          { label: "Recommend chest tube placement on the affected side instead", correct: false, consequence: "A chest tube isn't the primary early intervention for CDH-related compression — gastric decompression addresses the actual displaced structure causing compression.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "pulm-htn",
    condition: "Pulmonary Vascular Disease",
    title: "Adult, Pulmonary Arterial Hypertension Decompensation",
    opening: "A 40-year-old woman with known pulmonary arterial hypertension on home therapy presents with worsening dyspnea, lower extremity edema, and syncope with exertion. SpO2 is 90% on room air.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend supplemental oxygen titrated carefully alongside prompt cardiology/pulmonary hypertension specialist evaluation", correct: true, consequence: "Oxygen improves her saturation to 94%. Specialist evaluation confirms right heart strain, and her home PAH therapy regimen is reassessed for adjustment." },
          { label: "Recommend aggressive IV fluid administration to support blood pressure", correct: false, consequence: "Patients with PAH and signs of right heart failure (edema, syncope) are often volume-sensitive — aggressive fluids can worsen right ventricular strain rather than help.", suboptimal: true },
          { label: "Recommend discontinuing her home pulmonary hypertension medications given her syncope", correct: false, consequence: "Abruptly stopping PAH-specific therapy can cause dangerous rebound pulmonary hypertension — this decision requires specialist input, not unilateral discontinuation.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "She continues to show signs of right heart strain despite initial measures. What is an important respiratory consideration in her ongoing management?",
        branches: [
          { label: "Recommend avoiding hypoxemia, hypercapnia, and acidosis, all of which can further increase pulmonary vascular resistance and worsen right heart strain", correct: true, consequence: "Close attention is paid to maintaining adequate oxygenation and normal acid-base status, avoiding factors that would further elevate her pulmonary vascular resistance and worsen her right heart function." },
          { label: "Recommend permissive hypercapnia to reduce ventilatory demands", correct: false, consequence: "Hypercapnia and the resulting acidosis actually increase pulmonary vascular resistance in PAH patients, worsening right heart strain — this is the wrong strategy for this specific condition.", suboptimal: true },
          { label: "Recommend no specific respiratory considerations beyond routine care", correct: false, consequence: "PAH patients require specific attention to factors that affect pulmonary vascular resistance — this isn't a routine respiratory care situation.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "cardiogenic-shock",
    condition: "Shock",
    title: "Adult, Cardiogenic Shock Post-MI",
    opening: "A 70-year-old man post-anterior myocardial infarction develops hypotension (78/50), cool extremities, and worsening dyspnea with bilateral crackles. SpO2 is 87% on a non-rebreather mask.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation regarding his respiratory support?",
        branches: [
          { label: "Recommend a trial of noninvasive ventilation while the cardiology team addresses the underlying cardiogenic shock", correct: true, consequence: "NIV improves his oxygenation and reduces work of breathing while the team initiates treatment for the underlying cardiogenic shock, including consideration of mechanical circulatory support." },
          { label: "Recommend increasing IV fluids to address his hypotension before considering respiratory support", correct: false, consequence: "In cardiogenic shock, aggressive fluid administration can worsen pulmonary edema and cardiac strain — this is generally avoided in favor of addressing the pump failure directly.", suboptimal: true },
          { label: "Recommend no change to current oxygen therapy despite the low SpO2", correct: false, consequence: "An SpO2 of 87% on maximal non-rebreather support with worsening symptoms requires escalation, not maintaining unchanged therapy.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite NIV, he remains hypotensive and increasingly lethargic. What should the RT anticipate and prepare for?",
        branches: [
          { label: "Recommend preparing for likely intubation given his declining mental status, as NIV requires a cooperative, protective airway to be effective", correct: true, consequence: "The team prepares for intubation given his declining mental status, recognizing that NIV is becoming less safe and effective as his level of consciousness deteriorates." },
          { label: "Recommend increasing NIV pressure settings indefinitely regardless of his mental status", correct: false, consequence: "A declining level of consciousness is a contraindication to continued NIV, regardless of pressure settings, due to aspiration risk and inability to protect the airway.", suboptimal: true },
          { label: "Recommend discontinuing all respiratory support given the severity of his condition", correct: false, consequence: "Discontinuing support entirely isn't appropriate — the situation calls for escalating to a more secure and controlled means of ventilatory support (intubation), not withdrawing support altogether.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "panic-hyperventilation",
    condition: "Psychiatric",
    title: "Adult, Panic-Related Hyperventilation",
    opening: "A 27-year-old woman presents to the ED with acute anxiety, rapid breathing at 32/min, perioral tingling, and carpopedal spasm. She denies chest pain, and her SpO2 is 99% on room air.",
    steps: [
      {
        id: 1,
        prompt: "Given her normal SpO2 and symptom pattern, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend a calm, reassuring approach with coached slow breathing, after first ruling out other causes of tachypnea", correct: true, consequence: "After other causes are appropriately screened for, the patient responds well to coaching and reassurance, and her respiratory rate and symptoms gradually improve." },
          { label: "Recommend immediate high-flow oxygen therapy despite her normal SpO2", correct: false, consequence: "Her oxygenation is already normal — administering unnecessary oxygen doesn't address the actual physiological process (hyperventilation-induced respiratory alkalosis) driving her symptoms.", suboptimal: true },
          { label: "Recommend having her breathe into a paper bag as the definitive treatment without further evaluation", correct: false, consequence: "While rebreathing techniques have historically been suggested for hyperventilation, ruling out more serious causes of tachypnea (like PE or cardiac issues) must come first — assuming this is purely psychiatric without appropriate screening risks missing a dangerous diagnosis.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Her symptoms are confirmed to be from acute hyperventilation syndrome. What explains her perioral tingling and carpopedal spasm?",
        branches: [
          { label: "Recommend recognizing these as symptoms of hypocapnia-induced hypocalcemia from excessive CO2 elimination during hyperventilation", correct: true, consequence: "The team understands and explains to the patient that her tingling and muscle spasm are physiological effects of low CO2 from hyperventilation, not a separate dangerous process — this understanding helps guide reassurance-based treatment." },
          { label: "Recommend assuming this indicates a primary neurological emergency requiring immediate imaging", correct: false, consequence: "While ruling out serious causes is important initially, once hyperventilation syndrome is confirmed, these specific symptoms are well-explained by the hypocapnia itself, not a separate neurological emergency requiring further emergent imaging.", suboptimal: true },
          { label: "Recommend assuming these symptoms are unrelated and require no explanation", correct: false, consequence: "These symptoms have a clear physiological explanation tied to her hyperventilation — dismissing them without explanation misses an opportunity for patient reassurance and education." },
        ],
      },
    ],
  },
  {
    id: "bpd",
    condition: "Disorders of Prematurity",
    title: "Neonatal, Bronchopulmonary Dysplasia",
    opening: "A former 26-week premature infant, now 6 weeks old, remains ventilator-dependent with chronic changes on chest X-ray consistent with evolving bronchopulmonary dysplasia. FiO2 requirement has been slowly increasing over the past week.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation given this trend?",
        branches: [
          { label: "Recommend evaluating for a superimposed acute process (infection, fluid overload) rather than assuming this is simply BPD progression", correct: true, consequence: "Workup reveals a mild fluid overload contributing to the increased oxygen requirement, which is addressed with diuresis, and the FiO2 requirement improves." },
          { label: "Recommend assuming this is simply expected BPD progression with no further workup", correct: false, consequence: "An acute increase in oxygen requirement, even in a BPD patient, should prompt evaluation for a superimposed treatable process rather than automatically being attributed to the chronic underlying disease.", suboptimal: true },
          { label: "Recommend immediately increasing ventilator pressures significantly without further evaluation", correct: false, consequence: "Escalating pressure settings without first identifying the cause of the change risks unnecessary lung injury in an already vulnerable premature lung.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "As the infant's chronic lung disease is managed long-term, what ventilator strategy consideration is most important?",
        branches: [
          { label: "Recommend a lung-protective strategy with attention to avoiding both volutrauma and atelectrauma, given the infant's vulnerable, developing lung", correct: true, consequence: "The team adopts a careful, lung-protective ventilation strategy, balancing adequate lung recruitment against the risk of further chronic lung injury in this premature, BPD-affected infant." },
          { label: "Recommend using the highest tolerable tidal volumes to speed ventilator weaning", correct: false, consequence: "High tidal volumes risk significant volutrauma in an already injured, developing premature lung — this works against, not toward, long-term lung protection.", suboptimal: true },
          { label: "Recommend no special ventilation strategy considerations for BPD patients", correct: false, consequence: "BPD patients have specific vulnerabilities requiring a tailored, lung-protective approach — treating this the same as a routine ventilation case misses important considerations for their long-term lung development." },
        ],
      },
    ],
  },
  {
    id: "geriatric-aspiration",
    condition: "Geriatric",
    title: "Geriatric, Aspiration Pneumonia",
    opening: "An 84-year-old woman with a history of dementia and dysphagia is admitted with fever, new hypoxemia (SpO2 88% on room air), and a right lower lobe infiltrate after being found coughing during meals at her care facility.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend supplemental oxygen, NPO status pending swallow evaluation, and empiric antibiotic workup for aspiration pneumonia", correct: true, consequence: "SpO2 improves to 93% on supplemental oxygen. A formal swallow evaluation is arranged, and antibiotics targeting likely aspiration-associated organisms are started." },
          { label: "Recommend continuing her regular oral diet as tolerated", correct: false, consequence: "Continuing oral intake before a swallow evaluation in a patient with known dysphagia and witnessed aspiration risk could cause further aspiration events.", suboptimal: true },
          { label: "Recommend no oxygen therapy since some hypoxemia is expected with age", correct: false, consequence: "An SpO2 of 88% is a clinically significant finding requiring treatment regardless of age — this shouldn't be dismissed as an expected aging change.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "The swallow evaluation confirms significant aspiration risk with thin liquids. What should guide her ongoing respiratory and nutritional care planning?",
        branches: [
          { label: "Recommend a multidisciplinary discussion including speech therapy, the family, and the care team regarding diet texture modification and aspiration precautions, respecting patient/family goals of care", correct: true, consequence: "A care conference is held, diet modifications are implemented per speech therapy recommendations, and the plan aligns with the family's expressed wishes for her care given her underlying dementia." },
          { label: "Recommend immediate feeding tube placement without discussing goals of care", correct: false, consequence: "Feeding tube decisions in patients with dementia and dysphagia are complex and should involve a goals-of-care discussion with family, not be implemented unilaterally.", suboptimal: true },
          { label: "Recommend no dietary changes despite the confirmed aspiration risk", correct: false, consequence: "Ignoring a confirmed aspiration risk on formal swallow evaluation would leave her vulnerable to recurrent aspiration events — some modification or precaution is clinically warranted.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "post-cabg",
    condition: "Cardiovascular",
    title: "Adult, Post-CABG Atelectasis and Pleural Effusion",
    opening: "A 66-year-old man is post-op day 3 from coronary artery bypass grafting. He has decreased breath sounds at the left base, dullness to percussion, and his SpO2 has drifted down to 90% on 2L oxygen.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend a chest X-ray to evaluate for pleural effusion or atelectasis, common post-CABG complications", correct: true, consequence: "Chest X-ray confirms a moderate left pleural effusion with associated basilar atelectasis, common after cardiac surgery, guiding the next steps in his care." },
          { label: "Recommend immediate chest tube placement without imaging confirmation first", correct: false, consequence: "Proceeding directly to an invasive procedure without first confirming the diagnosis and effusion size via imaging skips an important, low-risk diagnostic step.", suboptimal: true },
          { label: "Recommend no further evaluation since this is expected after cardiac surgery", correct: false, consequence: "While some findings are common post-CABG, a new desaturation trend and exam changes still warrant evaluation to confirm the cause and its significance, not automatic dismissal.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Given the confirmed atelectasis and small-to-moderate effusion, what respiratory therapy should be prioritized?",
        branches: [
          { label: "Recommend incentive spirometry, early mobilization, and directed coughing to address the atelectasis, reserving drainage for a larger or symptomatic effusion", correct: true, consequence: "With focused lung expansion therapy and mobilization, his atelectasis improves and SpO2 recovers to 94% without needing invasive drainage of the modest effusion." },
          { label: "Recommend immediate thoracentesis regardless of effusion size or symptoms", correct: false, consequence: "A small-to-moderate, non-symptomatic effusion often doesn't require immediate invasive drainage — addressing the atelectasis first is a reasonable, less invasive initial approach.", suboptimal: true },
          { label: "Recommend strict bed rest to avoid stressing the surgical site", correct: false, consequence: "Early mobilization is actually protective against atelectasis and other post-surgical pulmonary complications — prolonged bed rest would likely worsen his respiratory status.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "stroke-dysphagia",
    condition: "Neurologic",
    title: "Adult, Acute Stroke with Aspiration Risk",
    opening: "A 71-year-old man is admitted with an acute ischemic stroke causing right-sided weakness and dysarthria. He is alert but has a weak cough and pooling secretions noted at the back of his throat.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend NPO status and formal swallow evaluation before any oral intake, given his weak cough and pooling secretions", correct: true, consequence: "He remains NPO pending evaluation. A bedside swallow screen confirms significant aspiration risk, preventing what could have been an aspiration event from premature oral intake." },
          { label: "Recommend allowing oral intake since he is alert and able to speak", correct: false, consequence: "Alertness alone doesn't rule out aspiration risk — his weak cough and pooling secretions are specific red flags that warrant formal evaluation before oral intake.", suboptimal: true },
          { label: "Recommend no specific precautions since this is expected after a stroke", correct: false, consequence: "Dysphagia and aspiration risk after stroke require active screening and precautions, not being treated as an inevitable, unaddressed finding.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "His secretions continue to pool despite positioning changes, and he has an episode of coughing with oxygen desaturation to 89% during suctioning. What should the RT recommend?",
        branches: [
          { label: "Recommend closer monitoring, more frequent oral suctioning as needed, and reassessment of his airway protection ability with the care team", correct: true, consequence: "With more frequent suctioning and close monitoring, his desaturation events are caught and managed promptly while the team continues to assess his evolving airway protection status." },
          { label: "Recommend discontinuing all suctioning since it caused a desaturation", correct: false, consequence: "Suctioning is still necessary to manage his secretions — the desaturation during the procedure is a reason for careful technique and monitoring, not for stopping a needed intervention altogether.", suboptimal: true },
          { label: "Recommend no changes to his current monitoring plan", correct: false, consequence: "A desaturation event during a routine procedure like suctioning is a signal that his airway status may be evolving and warrants closer attention, not an unchanged plan.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "foreign-body",
    condition: "Pediatric",
    title: "Pediatric, Foreign Body Aspiration",
    opening: "A previously healthy 2-year-old is brought to the ED with sudden-onset coughing, wheezing localized to the right side, and decreased breath sounds on the right, witnessed by a parent while the child was eating peanuts.",
    steps: [
      {
        id: 1,
        prompt: "Given this history and exam, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend prompt evaluation for suspected foreign body aspiration, including likely bronchoscopy for retrieval", correct: true, consequence: "The child is evaluated urgently, and bronchoscopy confirms and successfully retrieves a peanut fragment from the right mainstem bronchus, resolving the localized findings." },
          { label: "Recommend routine nebulized bronchodilator treatment as the first-line approach", correct: false, consequence: "Unilateral wheeze with a clear witnessed choking history strongly suggests foreign body aspiration, not typical bronchospasm — bronchodilators won't address a mechanical obstruction and delay definitive treatment.", suboptimal: true },
          { label: "Recommend reassurance and discharge home with follow-up in one week", correct: false, consequence: "This presentation with a witnessed choking event and unilateral findings is a red flag requiring prompt same-visit evaluation, not delayed outpatient follow-up.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "While awaiting bronchoscopy, the child develops increasing respiratory distress. What should the RT prioritize?",
        branches: [
          { label: "Recommend close monitoring with oxygen as needed, positioning for comfort, and expediting definitive airway/bronchoscopic intervention", correct: true, consequence: "The child is kept comfortable and monitored closely while the team expedites the bronchoscopy, avoiding unnecessary delay given his worsening distress." },
          { label: "Recommend blind finger sweep of the airway to attempt removal", correct: false, consequence: "A blind finger sweep risks pushing the foreign body further into the airway and is not an appropriate technique for this situation — definitive removal should be done under direct visualization.", suboptimal: true },
          { label: "Recommend delaying bronchoscopy further to allow the child to calm down first", correct: false, consequence: "Worsening respiratory distress in the setting of a likely foreign body is a reason to expedite, not further delay, definitive intervention.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "croup",
    condition: "Pediatric",
    title: "Pediatric, Croup (Viral Laryngotracheobronchitis)",
    opening: "A 14-month-old presents with a barky cough, inspiratory stridor at rest, and mild suprasternal retractions. The child has had cold symptoms for 2 days. Temperature is 100.9°F.",
    steps: [
      {
        id: 1,
        prompt: "Given stridor at rest, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend nebulized racemic epinephrine and systemic corticosteroids", correct: true, consequence: "The child receives racemic epinephrine with rapid improvement in stridor, and corticosteroids are given to reduce airway inflammation and prevent rebound symptoms." },
          { label: "Recommend antibiotics as the first-line treatment", correct: false, consequence: "Croup is caused by a virus in the vast majority of cases — antibiotics don't address the underlying cause and aren't first-line treatment here.", suboptimal: true },
          { label: "Recommend discharge home with reassurance only, given the child is not in severe distress", correct: false, consequence: "Stridor AT REST (not just with agitation) indicates at least moderate severity requiring active treatment, not discharge without intervention.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "After treatment, the child's stridor improves significantly. What determines safe discharge readiness?",
        branches: [
          { label: "Recommend observing for an adequate period after racemic epinephrine to ensure no rebound stridor before considering discharge", correct: true, consequence: "After an appropriate observation period showing no return of stridor at rest, the child is discharged home with clear return-precautions given to the family." },
          { label: "Recommend immediate discharge right after the epinephrine treatment with no observation period", correct: false, consequence: "Racemic epinephrine's effects can wear off, and rebound stridor is a known risk — an observation period is needed before discharge is considered safe.", suboptimal: true },
          { label: "Recommend admission for all children who receive racemic epinephrine regardless of response", correct: false, consequence: "Not all children who receive racemic epinephrine and respond well with no rebound require admission — appropriate observation followed by discharge is often appropriate, avoiding unnecessary admission.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "flail-chest",
    condition: "Trauma",
    title: "Adult, Flail Chest from Blunt Trauma",
    opening: "A 45-year-old man involved in a motor vehicle collision has multiple rib fractures with paradoxical chest wall movement on the left, significant pain with breathing, and SpO2 91% on room air.",
    steps: [
      {
        id: 1,
        prompt: "What is your FIRST recommendation?",
        branches: [
          { label: "Recommend supplemental oxygen, aggressive pain control, and close monitoring for underlying pulmonary contusion", correct: true, consequence: "With improved pain control, the patient breathes more effectively despite the flail segment, and oxygenation improves to 95%. The team continues monitoring for pulmonary contusion, which often worsens over the following 24-48 hours." },
          { label: "Recommend immediate intubation for all flail chest patients regardless of clinical status", correct: false, consequence: "Not all flail chest patients require immediate intubation — many can be managed with aggressive pain control and supportive care, reserving intubation for those who show respiratory failure despite these measures.", suboptimal: true },
          { label: "Recommend withholding pain medication to avoid respiratory depression", correct: false, consequence: "Inadequate pain control in flail chest leads to shallow breathing and poor cough, worsening atelectasis and respiratory status — effective pain management is actually a cornerstone of flail chest care.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Over the next 24 hours, his oxygenation gradually worsens despite good pain control, and chest X-ray shows a developing infiltrate in the affected area. What does this suggest, and what's the next step?",
        branches: [
          { label: "Recommend recognizing this as likely evolving pulmonary contusion and escalating respiratory support (e.g., high-flow oxygen or noninvasive ventilation) as needed", correct: true, consequence: "The team recognizes the classic delayed worsening pattern of pulmonary contusion and escalates support appropriately, closely monitoring for further deterioration that might require intubation." },
          { label: "Recommend assuming this represents new pneumonia and starting antibiotics as the primary intervention", correct: false, consequence: "While infection is possible, this delayed worsening pattern in a trauma patient with a flail segment is classic for pulmonary contusion evolving over 24-48 hours — respiratory support should be the primary initial focus.", suboptimal: true },
          { label: "Recommend no change in management since some worsening is expected", correct: false, consequence: "While some contusion-related worsening is expected, it still requires an active response (escalating support) rather than being passively observed without intervention.", suboptimal: true },
        ],
      },
    ],
  },
  {
    id: "severe-cap",
    condition: "Infectious Disease",
    title: "Adult, Severe Community-Acquired Pneumonia",
    opening: "A 58-year-old man presents with fever, productive cough, and confusion. RR is 32/min, blood pressure 88/56, and SpO2 is 84% on room air. Chest X-ray shows multilobar infiltrates.",
    steps: [
      {
        id: 1,
        prompt: "Given these severity markers, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend ICU-level care with prompt oxygen support, likely early consideration of advanced respiratory support, and rapid empiric antibiotics", correct: true, consequence: "The patient is triaged to ICU-level care; oxygen support is escalated quickly, and broad-spectrum antibiotics are started within the hour, following severe CAP management principles." },
          { label: "Recommend routine floor-level care with standard nasal cannula oxygen", correct: false, consequence: "This presentation — hypotension, tachypnea, multilobar infiltrates, confusion — meets severity criteria for critical illness requiring a higher level of care than a routine floor admission.", suboptimal: true },
          { label: "Recommend delaying antibiotics until specific pathogen identification", correct: false, consequence: "In severe CAP, prompt empiric antibiotic therapy is critical and shouldn't be delayed for pathogen identification, which can take days — delays are associated with worse outcomes.", suboptimal: true },
        ],
      },
      {
        id: 2,
        prompt: "Despite high-flow oxygen, his oxygenation remains poor and work of breathing is increasing. What should the RT anticipate?",
        branches: [
          { label: "Recommend preparing for likely intubation and mechanical ventilation given failure of high-flow oxygen to adequately support him", correct: true, consequence: "The team prepares for and proceeds with intubation given his failure to improve on maximal noninvasive support, transitioning to lung-protective mechanical ventilation." },
          { label: "Recommend simply increasing the high-flow oxygen device's flow rate indefinitely without considering escalation", correct: false, consequence: "Continuing to escalate the same modality without recognizing signs of failure delays needed definitive airway management in a patient who is clearly deteriorating.", suboptimal: true },
          { label: "Recommend discontinuing respiratory support given the severity of his illness", correct: false, consequence: "Discontinuing support isn't appropriate for a patient who may benefit significantly from escalated, definitive respiratory support — this isn't a case for withdrawing care." },
        ],
      },
    ],
  },
  {
    id: "myasthenic-crisis",
    condition: "Neurologic",
    title: "Adult, Myasthenic Crisis",
    opening: "A 38-year-old woman with known myasthenia gravis presents with rapidly progressive weakness, difficulty swallowing, and a weak voice. Her vital capacity has dropped from 2.8L to 1.2L over several hours.",
    steps: [
      {
        id: 1,
        prompt: "Given this rapid decline, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend close monitoring of vital capacity, MIP/MEP, and preparation for likely need for ventilatory support given the rapid trajectory", correct: true, consequence: "Serial measurements confirm continued decline, and the team proceeds with early, controlled intubation before a respiratory crisis develops unpredictably." },
          { label: "Recommend waiting until she shows overt respiratory failure before any intervention", correct: false, consequence: "In myasthenic crisis, respiratory failure can occur somewhat unpredictably and rapidly — waiting for overt failure risks a crash intubation rather than a controlled one.", suboptimal: true },
          { label: "Recommend increasing her home cholinesterase inhibitor dose as the primary acute intervention", correct: false, consequence: "While her chronic medications matter, simply increasing the dose acutely isn't the primary emergency intervention for a rapidly declining vital capacity — respiratory monitoring and support preparedness take priority." },
        ],
      },
      {
        id: 2,
        prompt: "She is intubated for airway protection and ventilatory support. What is an important consideration regarding her underlying disease during this admission?",
        branches: [
          { label: "Recommend considering disease-specific treatments (such as plasmapheresis or IVIG) in coordination with neurology, alongside supportive ventilation", correct: true, consequence: "Neurology is consulted, and plasmapheresis is initiated alongside her ventilatory support, targeting the underlying autoimmune process driving her crisis." },
          { label: "Recommend focusing only on ventilator management with no need for neurology involvement", correct: false, consequence: "Myasthenic crisis has specific disease-modifying treatments beyond supportive ventilation — neurology involvement for targeted therapy is an important part of her care, not something to overlook.", suboptimal: true },
          { label: "Recommend discontinuing all her home myasthenia medications during the acute crisis", correct: false, consequence: "Abruptly stopping her baseline myasthenia treatment isn't appropriate — management during a crisis should be coordinated with neurology, not unilaterally discontinued." },
        ],
      },
    ],
  },
  {
    id: "meconium-aspiration",
    condition: "Neonatal",
    title: "Neonatal, Meconium Aspiration Syndrome",
    opening: "A term infant is born through thick meconium-stained fluid and is limp with poor respiratory effort at delivery. Heart rate is 90 bpm.",
    steps: [
      {
        id: 1,
        prompt: "Given the infant's limp tone and poor respiratory effort, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend proceeding with standard neonatal resuscitation steps, prioritizing positive pressure ventilation for the depressed infant rather than routine tracheal suctioning", correct: true, consequence: "PPV is initiated promptly per current resuscitation guidelines. Heart rate improves, and the team continues resuscitation while monitoring for signs of meconium aspiration syndrome." },
          { label: "Recommend delaying all resuscitation efforts to first perform tracheal suctioning below the cords", correct: false, consequence: "Current neonatal resuscitation guidance prioritizes prompt ventilation for a depressed infant over routine intrapartum or intrapartum tracheal suctioning, which has not been shown to improve outcomes and delays needed ventilation.", suboptimal: true },
          { label: "Recommend no intervention since the infant will likely improve on its own", correct: false, consequence: "A limp infant with poor respiratory effort and a heart rate of 90 requires active resuscitation — this is not a situation for watchful waiting." },
        ],
      },
      {
        id: 2,
        prompt: "The infant is stabilized but develops grunting, retractions, and patchy infiltrates on chest X-ray consistent with meconium aspiration syndrome. What ventilation consideration is important?",
        branches: [
          { label: "Recommend a ventilation strategy that accounts for the risk of air trapping and potential need for higher PEEP given the heterogeneous lung involvement in MAS", correct: true, consequence: "The team carefully titrates ventilator settings, monitoring for signs of air trapping given the mixed atelectasis/hyperinflation pattern often seen in MAS, and the infant's oxygenation gradually improves." },
          { label: "Recommend a generic ventilation strategy identical to a preterm RDS infant", correct: false, consequence: "MAS has a different underlying pathophysiology (airway obstruction, chemical pneumonitis, surfactant inactivation, risk of air trapping) than surfactant-deficient RDS, and management should be tailored accordingly rather than using an identical approach.", suboptimal: true },
          { label: "Recommend no specific ventilation considerations for MAS", correct: false, consequence: "MAS has specific pathophysiological features that warrant a tailored ventilation approach — this isn't a condition to manage without disease-specific considerations." },
        ],
      },
    ],
  },
  {
    id: "general-hypoxemia-workup",
    condition: "General",
    title: "Adult, Undifferentiated Acute Hypoxemic Respiratory Failure",
    opening: "A 55-year-old man with no significant prior medical history presents with acute dyspnea and hypoxemia (SpO2 85% on room air). Chest X-ray is unremarkable. He denies chest pain, fever, or recent travel or surgery.",
    steps: [
      {
        id: 1,
        prompt: "Given a clear chest X-ray despite significant hypoxemia, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend supplemental oxygen and a broadened diagnostic workup, including consideration of pulmonary embolism, given the mismatch between clinical severity and a clear chest X-ray", correct: true, consequence: "Oxygen improves his saturation to 92%. Further workup including CTPA reveals a pulmonary embolism, explaining the hypoxemia despite the initially unremarkable chest X-ray." },
          { label: "Recommend no further workup since the chest X-ray is normal", correct: false, consequence: "A normal chest X-ray does not rule out significant causes of hypoxemia like pulmonary embolism — this mismatch between severity and imaging should prompt further investigation, not reassurance." },
          { label: "Recommend assuming this is anxiety-related hyperventilation without further workup", correct: false, consequence: "An SpO2 of 85% is objectively low and inconsistent with a purely anxiety-related presentation, which typically doesn't cause true hypoxemia — this requires real diagnostic evaluation." },
        ],
      },
      {
        id: 2,
        prompt: "This diagnostic reasoning process illustrates an important general principle. What is it?",
        branches: [
          { label: "Recommend recognizing that a normal chest X-ray does not exclude significant causes of hypoxemia, and clinical severity should guide the breadth of further workup", correct: true, consequence: "This case reinforces that imaging findings must always be interpreted alongside the full clinical picture — normal imaging with significant physiological derangement warrants continued investigation, not reassurance." },
          { label: "Recommend concluding that chest X-ray is the definitive test for all causes of hypoxemia", correct: false, consequence: "This is the opposite of what this case demonstrates — chest X-ray has real limitations and cannot be relied upon as the definitive test for every cause of hypoxemia." },
          { label: "Recommend concluding that further workup is rarely worthwhile when initial imaging is normal", correct: false, consequence: "This case specifically illustrates why further workup IS worthwhile despite normal initial imaging, when the clinical picture doesn't fit." },
        ],
      },
    ],
  },
  {
    id: "hemothorax",
    condition: "Trauma",
    title: "Adult, Traumatic Hemothorax",
    opening: "A 29-year-old man involved in a fall from height has decreased breath sounds on the left, dullness to percussion, and hypotension (84/56). SpO2 is 90% on a non-rebreather mask.",
    steps: [
      {
        id: 1,
        prompt: "Given the combination of decreased breath sounds, dullness, and hypotension, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend prompt chest tube placement for suspected hemothorax, alongside resuscitation for likely associated blood loss", correct: true, consequence: "A chest tube is placed, draining a significant volume of blood, confirming hemothorax. Resuscitation is initiated simultaneously to address the associated hemorrhagic shock." },
          { label: "Recommend needle decompression as the definitive treatment", correct: false, consequence: "Needle decompression is the treatment for tension pneumothorax, not hemothorax — dullness to percussion (versus hyperresonance in pneumothorax) points toward fluid/blood, which requires chest tube drainage instead." },
          { label: "Recommend observation only, given he is not in cardiac arrest", correct: false, consequence: "Hypotension with suspected ongoing hemothorax is a time-sensitive emergency requiring prompt intervention, not observation." },
        ],
      },
      {
        id: 2,
        prompt: "After chest tube placement, there is an immediate large blood return (1,500 mL) with continued brisk drainage. What should the RT anticipate?",
        branches: [
          { label: "Recommend anticipating likely surgical intervention (thoracotomy), given the large initial output and continued brisk bleeding meeting criteria for operative management", correct: true, consequence: "Given the significant initial blood volume and ongoing drainage, thoracic surgery is emergently consulted, and the patient is prepared for operative intervention to control the bleeding source." },
          { label: "Recommend clamping the chest tube to slow the blood loss", correct: false, consequence: "Clamping a chest tube with ongoing significant hemorrhage doesn't stop the bleeding — it just prevents drainage, which could lead to a retained hemothorax or tension physiology from accumulating blood." },
          { label: "Recommend no further escalation since the chest tube is already in place", correct: false, consequence: "This volume and rate of blood loss meets criteria suggesting a source requiring surgical control — simply having a chest tube in place doesn't address an ongoing significant bleeding source." },
        ],
      },
    ],
  },
  {
    id: "viral-ards",
    condition: "Infectious Disease",
    title: "Adult, Viral Pneumonia Progressing to ARDS",
    opening: "A 62-year-old man with a severe viral respiratory infection has progressively worsening hypoxemia over 3 days despite high-flow oxygen. PaO2/FiO2 ratio is now 110 with bilateral infiltrates on imaging.",
    steps: [
      {
        id: 1,
        prompt: "Given his PaO2/FiO2 ratio and bilateral infiltrates, what does this presentation represent, and what is your FIRST recommendation?",
        branches: [
          { label: "Recommend recognizing this as moderate-to-severe ARDS from his viral illness, and prepare for likely intubation with lung-protective ventilation", correct: true, consequence: "The team recognizes ARDS criteria are met and proceeds with controlled intubation, initiating lung-protective ventilation with low tidal volumes given his severity of oxygenation impairment." },
          { label: "Recommend continuing high-flow oxygen indefinitely without considering escalation", correct: false, consequence: "A PaO2/FiO2 ratio this low with ongoing decline despite maximal noninvasive support indicates the need for escalation to invasive ventilation, not continuing an already-failing approach unchanged.", suboptimal: true },
          { label: "Recommend assuming this is purely fluid overload and treating with diuresis alone", correct: false, consequence: "While fluid status should be assessed, the clinical picture (viral illness, progressive bilateral infiltrates, worsening P/F ratio) fits ARDS from the underlying infection, not primarily fluid overload — diuresis alone wouldn't address the core problem." },
        ],
      },
      {
        id: 2,
        prompt: "Despite lung-protective ventilation, his oxygenation remains severely impaired. What adjunctive strategy should be considered per ARDS evidence?",
        branches: [
          { label: "Recommend prone positioning, which has strong evidence for improving oxygenation and outcomes in moderate-to-severe ARDS", correct: true, consequence: "The patient is proned per protocol, and his oxygenation improves significantly, consistent with the well-established benefit of proning in this severity of ARDS." },
          { label: "Recommend increasing tidal volume to improve oxygenation", correct: false, consequence: "Increasing tidal volume in ARDS worsens the risk of ventilator-induced lung injury and goes against lung-protective strategy — this isn't an appropriate way to address persistent hypoxemia." },
          { label: "Recommend no further adjunctive measures beyond current ventilator settings", correct: false, consequence: "Severe, persistent hypoxemia despite lung-protective ventilation is a specific indication to consider evidence-based adjuncts like proning, not to leave the current approach unchanged." },
        ],
      },
    ],
  },
  {
    id: "copd-home-niv",
    condition: "COPD",
    title: "Adult, Chronic COPD with Recurrent Hypercapnic Respiratory Failure",
    opening: "A 70-year-old man with severe COPD has had 3 hospitalizations in the past year for hypercapnic respiratory failure, each requiring noninvasive ventilation. His baseline PaCO2 between admissions remains elevated at 58 mmHg.",
    steps: [
      {
        id: 1,
        prompt: "Given this pattern of recurrent hypercapnic decompensation, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend evaluation for home noninvasive ventilation given his pattern of recurrent hypercapnic respiratory failure and elevated baseline PaCO2", correct: true, consequence: "He is evaluated and started on home NIV, which evidence supports for reducing hospital readmissions in COPD patients with persistent hypercapnia like his." },
          { label: "Recommend no changes to his outpatient management since exacerbations are expected in COPD", correct: false, consequence: "A pattern of recurrent hypercapnic hospitalizations with a persistently elevated baseline PaCO2 is a specific, evidence-based indication to consider home NIV, not something to accept as routine expected COPD progression without intervention." },
          { label: "Recommend permanent tracheostomy and home mechanical ventilation as the first-line option", correct: false, consequence: "Home NIV via mask interface is the appropriate first-line consideration for this pattern, reserving invasive tracheostomy ventilation for more specific circumstances, not as the default first step." },
        ],
      },
      {
        id: 2,
        prompt: "He is started on home NIV. What education point is most important for his long-term success with this therapy?",
        branches: [
          { label: "Recommend thorough education on mask fit, device use, and the importance of consistent nightly adherence, since benefit depends on regular use", correct: true, consequence: "With proper education and mask fitting, he demonstrates good adherence, and his subsequent PaCO2 trends and hospitalization frequency improve over the following months." },
          { label: "Recommend minimal education since the device is self-explanatory", correct: false, consequence: "Home NIV has a significant learning curve and adherence is closely tied to outcomes — inadequate education upfront often leads to poor compliance and reduced benefit." },
          { label: "Recommend use only during acute symptoms rather than consistent nightly use", correct: false, consequence: "Home NIV for chronic hypercapnic COPD is typically intended for regular, consistent nightly use to control baseline CO2 levels, not just intermittent use during acute symptoms." },
        ],
      },
    ],
  },
  {
    id: "cf-transplant-eval",
    condition: "Cystic Fibrosis",
    title: "Adult, Advanced Cystic Fibrosis — Lung Transplant Evaluation",
    opening: "A 32-year-old man with cystic fibrosis has had progressive decline in FEV1 to 28% predicted over the past year, with increasing hospitalization frequency and now requiring supplemental oxygen with exertion.",
    steps: [
      {
        id: 1,
        prompt: "Given this trajectory, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend referral for lung transplant evaluation given his declining FEV1, increasing exacerbation frequency, and new oxygen requirement", correct: true, consequence: "He is referred to a transplant center for evaluation, consistent with guideline-recommended timing based on his declining trajectory and functional status." },
          { label: "Recommend waiting until he requires continuous oxygen at rest before considering transplant referral", correct: false, consequence: "Waiting until end-stage disease markers appear can miss the optimal referral window — transplant evaluation timing is meant to occur before a patient becomes too debilitated for the process, not at the latest possible point.", suboptimal: true },
          { label: "Recommend continuing his current CF management unchanged with no additional referrals", correct: false, consequence: "This trajectory (declining FEV1, increasing exacerbations, new oxygen need) meets recognized criteria warranting transplant evaluation referral — this shouldn't be deferred without action." },
        ],
      },
      {
        id: 2,
        prompt: "While awaiting transplant evaluation, what ongoing respiratory therapy remains essential to his care?",
        branches: [
          { label: "Recommend continuing aggressive airway clearance therapy and CF-specific pulmonary care to maintain his best possible function while awaiting transplant", correct: true, consequence: "His airway clearance regimen and CF-specific therapies are continued and optimized, helping maintain his functional status and improving his overall candidacy while the transplant process proceeds." },
          { label: "Recommend discontinuing airway clearance therapy since transplant will replace his lungs eventually", correct: false, consequence: "Maintaining the best possible lung function and overall health is important both for quality of life and for remaining a good transplant candidate — discontinuing standard CF care isn't appropriate simply because transplant referral has occurred.", suboptimal: true },
          { label: "Recommend no changes to his care plan since transplant evaluation is now the primary focus", correct: false, consequence: "Ongoing CF-specific respiratory care remains essential during the evaluation and waiting period, not something to deprioritize once a transplant referral has been made." },
        ],
      },
    ],
  },
  {
    id: "afib-hypoxemia",
    condition: "Cardiovascular",
    title: "Adult, New-Onset Atrial Fibrillation with Rapid Ventricular Response",
    opening: "A 68-year-old post-operative patient develops new atrial fibrillation with a heart rate of 155 bpm, associated hypotension, and worsening dyspnea with SpO2 dropping to 89% on 2L oxygen.",
    steps: [
      {
        id: 1,
        prompt: "Given the hemodynamic instability associated with his rapid AFib, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend prompt physician evaluation for rate/rhythm control given the hemodynamically significant presentation, alongside supplemental oxygen support", correct: true, consequence: "Cardiology is emergently consulted; rate control is initiated, and his heart rate, blood pressure, and oxygenation all improve as the rapid ventricular response is controlled." },
          { label: "Recommend increasing oxygen only, without addressing the underlying arrhythmia", correct: false, consequence: "While oxygen support is appropriate, the underlying driver of his hypoxemia and instability here is the rapid, hemodynamically significant arrhythmia itself — this needs to be addressed directly, not just the downstream symptom.", suboptimal: true },
          { label: "Recommend no intervention since AFib is a common post-operative finding", correct: false, consequence: "While post-op AFib is common, THIS presentation with hypotension and desaturation represents hemodynamically significant instability requiring active intervention, not routine dismissal." },
        ],
      },
      {
        id: 2,
        prompt: "As his rate is controlled and hemodynamics stabilize, what should the RT continue to monitor closely?",
        branches: [
          { label: "Recommend continued monitoring of oxygenation and hemodynamic status, since respiratory status often improves in parallel with cardiac rhythm/rate control but should be confirmed, not assumed", correct: true, consequence: "Close monitoring confirms his oxygenation and hemodynamics both continue to stabilize as the rhythm is controlled, and no further respiratory intervention is needed beyond his baseline oxygen therapy." },
          { label: "Recommend discontinuing all respiratory monitoring now that cardiology is managing his rhythm", correct: false, consequence: "Respiratory status and cardiac rhythm are interrelated in this case — ongoing respiratory monitoring remains relevant even as cardiology addresses the primary rhythm issue." },
          { label: "Recommend assuming his respiratory status is fully resolved without further assessment", correct: false, consequence: "Improvement should be confirmed through ongoing assessment, not assumed automatically just because the rhythm is being treated." },
        ],
      },
    ],
  },
  {
    id: "tet-spell",
    condition: "Congenital Defects",
    title: "Pediatric, Tetralogy of Fallot with Hypercyanotic Spell",
    opening: "A 4-month-old with known Tetralogy of Fallot becomes acutely more cyanotic and irritable during feeding, with oxygen saturation dropping from a baseline of 85% to 65%.",
    steps: [
      {
        id: 1,
        prompt: "Recognizing this as a likely hypercyanotic (\"tet\") spell, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend calming the infant and positioning in a knee-to-chest position, which increases systemic vascular resistance and improves pulmonary blood flow", correct: true, consequence: "With knee-to-chest positioning and calming measures, the infant's saturation improves back toward baseline as the spell resolves." },
          { label: "Recommend placing the infant flat and encouraging vigorous crying to increase respiratory effort", correct: false, consequence: "Crying and agitation actually worsen a tet spell by further increasing right-to-left shunting — calming the infant, not increasing agitation, is the appropriate response." },
          { label: "Recommend no specific positioning intervention, only supplemental oxygen", correct: false, consequence: "While supplemental oxygen can be part of management, positioning (knee-to-chest) is a key, specific intervention for tet spells that directly addresses the underlying shunt physiology — it shouldn't be omitted." },
        ],
      },
      {
        id: 2,
        prompt: "The spell resolves with initial measures, but recurs shortly after. What escalation should the RT anticipate?",
        branches: [
          { label: "Recommend anticipating the need for medications (such as morphine or a beta-blocker) to reduce infundibular spasm if positioning alone becomes insufficient, per pediatric cardiology guidance", correct: true, consequence: "Pediatric cardiology is consulted, and medical therapy is added per protocol, successfully managing the recurrent spell alongside supportive measures." },
          { label: "Recommend immediate surgical intervention as the only next step regardless of response to medical therapy", correct: false, consequence: "Medical management is typically tried and often effective before proceeding to more invasive or emergent surgical intervention for recurrent spells — jumping straight to surgery skips appropriate intermediate steps." },
          { label: "Recommend no further escalation since the first episode resolved on its own", correct: false, consequence: "A recurrence shortly after the first episode signals the need for escalation and specialist involvement, not assuming the situation is fully resolved." },
        ],
      },
    ],
  },
  {
    id: "status-epilepticus",
    condition: "Neurologic",
    title: "Adult, Status Epilepticus with Respiratory Compromise",
    opening: "A 40-year-old man is having a generalized tonic-clonic seizure that has persisted for over 10 minutes despite two doses of benzodiazepines. SpO2 has dropped to 82%, and he is cyanotic.",
    steps: [
      {
        id: 1,
        prompt: "Given the prolonged seizure and hypoxemia, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend positioning to protect the airway, supplemental oxygen, and preparation for likely advanced airway management if the seizure and hypoxemia persist", correct: true, consequence: "The airway is positioned to minimize aspiration risk, oxygen is applied, and the team prepares for possible intubation as additional anti-seizure medications are administered." },
          { label: "Recommend attempting to place an oral airway or bite block during the active seizure", correct: false, consequence: "Attempting to place objects in the mouth during an active tonic-clonic seizure risks injury to the patient and rescuer and is not recommended — positioning and oxygen are the priority instead.", suboptimal: true },
          { label: "Recommend no respiratory intervention since the seizure will likely resolve on its own soon", correct: false, consequence: "A seizure persisting beyond 5 minutes meets criteria for status epilepticus, a medical emergency — combined with significant hypoxemia, this requires active respiratory support, not passive waiting." },
        ],
      },
      {
        id: 2,
        prompt: "The seizure finally stops after additional medication, but the patient remains unresponsive with poor respiratory effort and persistent hypoxemia. What is the next step?",
        branches: [
          { label: "Recommend proceeding with intubation to protect the airway and support ventilation given his persistent poor respiratory effort and unresponsiveness", correct: true, consequence: "The patient is intubated for airway protection and ventilatory support, and the team continues working up the underlying cause of his status epilepticus." },
          { label: "Recommend simply continuing to observe since the seizure activity itself has stopped", correct: false, consequence: "The seizure stopping doesn't resolve his ongoing poor respiratory effort and hypoxemia — post-ictal respiratory compromise still requires active airway management." },
          { label: "Recommend administering another anti-seizure medication as the primary respiratory intervention", correct: false, consequence: "With the seizure already stopped, further anti-seizure medication doesn't address his current airway and ventilation problem — this calls for airway management, not additional seizure medication." },
        ],
      },
    ],
  },
  {
    id: "anaphylaxis",
    condition: "General",
    title: "Adult, Anaphylaxis with Airway Compromise",
    opening: "A 26-year-old woman develops sudden facial swelling, hives, and stridor within minutes of a bee sting. Her voice is muffled, and SpO2 is 91% on room air with audible upper airway sounds.",
    steps: [
      {
        id: 1,
        prompt: "Recognizing this as anaphylaxis with airway involvement, what is your FIRST recommendation?",
        branches: [
          { label: "Recommend immediate intramuscular epinephrine as the first-line treatment, alongside preparation for possible airway intervention given the stridor and voice change", correct: true, consequence: "Epinephrine is administered promptly, and her airway swelling begins to improve, though the team remains prepared for advanced airway management given her initial presentation." },
          { label: "Recommend starting with antihistamines only, reserving epinephrine for if symptoms worsen further", correct: false, consequence: "In anaphylaxis with airway compromise, epinephrine is the first-line, time-critical treatment — antihistamines are adjunctive and should not delay or substitute for epinephrine administration." },
          { label: "Recommend observation only, since she is still able to speak", correct: false, consequence: "A muffled voice and stridor are signs of significant, potentially rapidly progressive airway compromise — this requires immediate treatment, not observation while symptoms could worsen." },
        ],
      },
      {
        id: 2,
        prompt: "After epinephrine, her stridor improves somewhat but doesn't fully resolve, and swelling is still visibly present. What should the RT anticipate?",
        branches: [
          { label: "Recommend continued close monitoring with low threshold for advanced airway management (intubation), given that anaphylaxis-related airway swelling can progress rapidly and unpredictably even after initial treatment", correct: true, consequence: "The team maintains close monitoring and readiness for airway intervention. She continues to improve with additional supportive treatment, and definitive airway intervention isn't ultimately needed, but the team's preparedness was appropriate given the initial severity." },
          { label: "Recommend discharge home now that epinephrine has been given", correct: false, consequence: "Anaphylaxis can have a biphasic reaction with symptom recurrence, and her airway swelling hasn't fully resolved — this isn't a safe point for discharge without further observation." },
          { label: "Recommend no further monitoring since epinephrine was administered", correct: false, consequence: "One dose of epinephrine doesn't guarantee complete, lasting resolution — continued close monitoring is essential given the potential for rapid progression or recurrence." },
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
