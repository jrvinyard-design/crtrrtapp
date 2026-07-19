import React, { useState, useMemo, useEffect } from "react";
import { Activity, ChevronRight, CheckCircle2, XCircle, TrendingUp, Lock, LogOut, Mail, KeyRound } from "lucide-react";
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

// ---- Blueprint data (subset, mirrors tmc_blueprint.json weighting) ----
const FREE_QUESTION_LIMIT = 15;
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
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "An advance directive differs from a DNR order in that it:",
    options: [
      { label: "A", text: "Is a broader legal document expressing a patient's wishes for various types of medical treatment, which may include but is not limited to resuscitation preferences", correct: true, tag: null, rationale: "An advance directive is a comprehensive document covering a range of potential medical decisions (e.g., mechanical ventilation, feeding tubes, DNR status), while a DNR order is a specific, narrower medical order addressing only resuscitation in the event of arrest." },
      { label: "B", text: "Only applies to respiratory therapy decisions specifically", correct: false, tag: null, rationale: "Advance directives are not respiratory-therapy-specific — they can address a wide range of medical decisions across specialties." },
      { label: "C", text: "Is identical in scope to a DNR order", correct: false, tag: null, rationale: "These are distinct documents with different scopes — an advance directive is broader, while DNR is narrowly focused on resuscitation." },
      { label: "D", text: "Can only be created by a physician, not the patient", correct: false, tag: null, rationale: "Advance directives are created by the patient (or their designated decision-maker) to express their own wishes, not authored by a physician on the patient's behalf." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a progressively rising procalcitonin level over 2 days, alongside worsening clinical signs of infection.",
    question: "This trend is most useful for:",
    options: [
      { label: "A", text: "Supporting an ongoing or worsening bacterial infectious process and potentially guiding antibiotic therapy decisions", correct: true, tag: null, rationale: "Procalcitonin is a biomarker that rises with bacterial infection and is used clinically to help support infection diagnosis and guide decisions about starting, continuing, or stopping antibiotic therapy." },
      { label: "B", text: "Diagnosing a purely viral illness", correct: false, tag: null, rationale: "Procalcitonin is more specifically associated with bacterial infection; it's typically less elevated in purely viral illness, making a rising trend more suggestive of bacterial involvement." },
      { label: "C", text: "Assessing kidney function", correct: false, tag: null, rationale: "Procalcitonin isn't a marker of kidney function — that's assessed via creatinine, BUN, and related studies." },
      { label: "D", text: "Measuring oxygenation status", correct: false, tag: null, rationale: "Procalcitonin has no direct relationship to oxygenation status, which is assessed through ABG or pulse oximetry." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Paradoxical abdominal movement (abdomen moving inward during inspiration) is a sign of:",
    options: [
      { label: "A", text: "Diaphragmatic fatigue or dysfunction", correct: true, tag: null, rationale: "Paradoxical abdominal movement occurs when the diaphragm is too fatigued or weak to contract properly, causing accessory muscles to dominate breathing and pull the abdomen inward during inspiration rather than the normal outward movement." },
      { label: "B", text: "Normal, healthy respiratory effort", correct: false, tag: null, rationale: "This is an abnormal finding indicating respiratory muscle compromise, not normal healthy breathing mechanics." },
      { label: "C", text: "Adequate diaphragmatic function", correct: false, tag: null, rationale: "This finding specifically indicates diaphragmatic fatigue or dysfunction, the opposite of adequate function." },
      { label: "D", text: "A sign specific to cardiac dysfunction only", correct: false, tag: null, rationale: "This is a respiratory muscle finding specifically related to diaphragm function, not a cardiac-specific sign." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is performing a spontaneous breathing trial and needs to calculate the rapid shallow breathing index (RSBI) to help assess readiness for extubation.",
    question: "The RSBI is calculated as:",
    options: [
      { label: "A", text: "Respiratory rate divided by tidal volume (in liters)", correct: true, tag: null, rationale: "RSBI = RR/Vt(L) — a value under 105 breaths/min/L is generally considered favorable for successful extubation, while higher values suggest a higher risk of weaning failure." },
      { label: "B", text: "Tidal volume divided by respiratory rate", correct: false, tag: null, rationale: "This is the inverse of the correct RSBI formula." },
      { label: "C", text: "Minute ventilation divided by PaCO2", correct: false, tag: null, rationale: "This isn't the RSBI formula — RSBI specifically uses respiratory rate and tidal volume." },
      { label: "D", text: "PaO2 divided by FiO2", correct: false, tag: null, rationale: "This describes the P/F ratio, a different and separate index used to assess oxygenation, not the RSBI, which assesses ventilatory pattern/weaning readiness." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's RSBI is calculated at 145 breaths/min/L during a spontaneous breathing trial.",
    question: "This value suggests:",
    options: [
      { label: "A", text: "A higher likelihood of weaning/extubation failure, and the trial should likely not proceed to extubation without further assessment", correct: true, tag: null, rationale: "An RSBI above 105 breaths/min/L is generally associated with a higher risk of weaning failure — this value suggests caution is warranted rather than proceeding directly to extubation." },
      { label: "B", text: "A favorable prediction for successful extubation", correct: false, tag: null, rationale: "An RSBI this high (145) is actually associated with an INCREASED risk of extubation failure, not a favorable prediction." },
      { label: "C", text: "No relevance to extubation readiness", correct: false, tag: null, rationale: "RSBI is specifically used as a predictive tool for extubation readiness — this value is directly relevant to that decision." },
      { label: "D", text: "A normal, expected value requiring no further consideration", correct: false, tag: null, rationale: "This value is well above the generally accepted favorable threshold (105) and shouldn't be treated as unremarkable." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "application",
    patient: "Adult · Suspected TB",
    stem: "A patient with a productive cough for 3 weeks, night sweats, and unintentional weight loss has recently immigrated from a region with high tuberculosis prevalence.",
    question: "What diagnostic workup should the RT recommend?",
    options: [
      { label: "A", text: "Recommend airborne precautions and sputum testing (AFB smear and culture) given the clinical presentation and risk factors for TB", correct: true, tag: null, rationale: "This presentation and risk factor profile (chronic cough, night sweats, weight loss, relevant geographic history) is classic for possible TB — airborne precautions should be initiated immediately alongside sputum AFB testing to evaluate for active disease." },
      { label: "B", text: "Recommend standard precautions only, with no specific TB workup", correct: false, tag: null, rationale: "This presentation carries significant TB risk factors and symptoms — standard precautions alone are insufficient, and specific testing/isolation should be initiated." },
      { label: "C", text: "Recommend routine chest X-ray only, with no sputum testing", correct: false, tag: null, rationale: "While chest imaging is part of the workup, sputum AFB testing is essential for confirming active TB and shouldn't be omitted." },
      { label: "D", text: "Recommend no further workup since symptoms could be from a common cold", correct: false, tag: null, rationale: "Three weeks of symptoms plus systemic signs (night sweats, weight loss) and relevant risk factors go well beyond a common cold presentation and require specific TB evaluation." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A heated humidifier for a ventilator circuit shows condensation (rainout) accumulating heavily in the tubing, occasionally causing gurgling and affecting delivered volumes.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Ensure proper water trap positioning and consider adjusting humidifier temperature settings to reduce excess condensation", correct: true, tag: null, rationale: "Excess rainout is a common issue with heated humidification, often addressed by ensuring water traps are positioned at the lowest point of the circuit and reassessing temperature settings — this is a routine circuit management issue with established troubleshooting steps." },
      { label: "B", text: "Discontinue humidification entirely to solve the problem", correct: false, tag: null, rationale: "Discontinuing needed humidification isn't an appropriate solution — proper airway humidification remains important; the excess condensation should be managed through circuit troubleshooting instead." },
      { label: "C", text: "Increase the humidifier temperature significantly to evaporate the condensation faster", correct: false, tag: null, rationale: "Increasing temperature can worsen rainout and creates risk of thermal injury to the airway — this isn't the appropriate fix for excess condensation." },
      { label: "D", text: "Ignore the gurgling and continue without any adjustment", correct: false, tag: null, rationale: "Gurgling that's affecting delivered volumes is a functional problem that should be addressed, not ignored, since it can impact actual ventilation delivered to the patient." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "The primary purpose of a heat and moisture exchanger (HME, or \"artificial nose\") is to:",
    options: [
      { label: "A", text: "Capture and recycle the patient's own exhaled heat and moisture to humidify subsequent inhaled breaths", correct: true, tag: null, rationale: "An HME works passively by trapping heat and moisture from exhaled air and returning it on the next inhalation, providing humidification without the need for an external heated humidifier system." },
      { label: "B", text: "Actively heat inspired gas using an external power source", correct: false, tag: null, rationale: "This describes an active heated humidifier system, not a passive HME, which requires no external power source and relies entirely on the patient's own exhaled heat/moisture." },
      { label: "C", text: "Filter bacteria from the ventilator circuit exclusively, with no humidification function", correct: false, tag: null, rationale: "While some HMEs do have filtration properties, the PRIMARY purpose described in its name and function is humidification via heat/moisture exchange, not filtration alone." },
      { label: "D", text: "Deliver aerosolized medication", correct: false, tag: null, rationale: "An HME's function is humidification, not medication delivery — in fact, some medications should not be given through a circuit with an HME in place due to potential filtration interference." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.B — Ensure Infection Prevention",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Droplet precautions are specifically appropriate for a patient with suspected:",
    options: [
      { label: "A", text: "Influenza", correct: true, tag: null, rationale: "Influenza is spread via larger respiratory droplets that don't remain suspended in air over distance, making droplet precautions (rather than airborne) the appropriate category." },
      { label: "B", text: "Active pulmonary tuberculosis", correct: false, tag: null, rationale: "TB requires airborne precautions (due to small, long-suspended droplet nuclei), not droplet precautions, which are for larger, shorter-range particles." },
      { label: "C", text: "Measles", correct: false, tag: null, rationale: "Measles is a classic airborne precaution disease due to its highly infectious, long-suspended airborne transmission, not droplet precautions." },
      { label: "D", text: "Disseminated varicella (chickenpox)", correct: false, tag: null, rationale: "Varicella requires airborne precautions given its airborne transmission route, not droplet precautions." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.C — Perform Quality Control Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "During routine PFT equipment QC using a 3-liter calibration syringe, the spirometer consistently reads 2.7 liters across multiple attempts.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Recalibrate the spirometer, since it is reading outside the acceptable accuracy tolerance for volume calibration", correct: true, tag: null, rationale: "A consistent 10% under-reading (2.7L vs the known 3.0L standard) exceeds typical acceptable calibration tolerance (usually ±3%) — the device needs recalibration before it can be trusted for patient testing." },
      { label: "B", text: "Continue using the spirometer for patient testing without any adjustment", correct: false, tag: null, rationale: "A calibration error this significant means patient results would be inaccurate — the device needs correction before further use, not continued use as-is." },
      { label: "C", text: "Assume the calibration syringe itself is broken without further investigation", correct: false, tag: null, rationale: "While possible, the more standard first step is recalibrating the spirometer using the known-volume syringe as the reference standard — jumping to blaming the syringe skips the standard troubleshooting sequence." },
      { label: "D", text: "Adjust patient results after testing to compensate for the known error", correct: false, tag: null, rationale: "Manually adjusting results after the fact introduces further error risk — the correct approach is fixing the calibration issue before testing patients, not compensating afterward." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Adult · General",
    stem: "A patient with a tracheostomy tube in place for 3 weeks is now being assessed for potential decannulation. They tolerate capping trials well with no distress.",
    question: "What additional factor is important to assess before proceeding with decannulation?",
    options: [
      { label: "A", text: "The patient's ability to manage their own secretions and protect their airway without the tracheostomy in place", correct: true, tag: null, rationale: "Beyond tolerating capping trials, successful decannulation requires confirming the patient can independently manage secretions and protect their airway — capping tolerance alone doesn't guarantee this broader airway safety requirement is met." },
      { label: "B", text: "Only the capping trial result, with no other factors needed", correct: false, tag: null, rationale: "While capping trials are an important part of the assessment, they don't capture the full picture — secretion management and airway protection ability are also essential considerations." },
      { label: "C", text: "The patient's personal preference alone, regardless of clinical readiness", correct: false, tag: null, rationale: "While patient preference matters in the conversation, decannulation decisions should be grounded in objective clinical readiness criteria, not preference alone." },
      { label: "D", text: "The time of day the procedure would occur", correct: false, tag: null, rationale: "Timing is a minor logistical consideration, not a primary clinical readiness factor for decannulation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient on volume control ventilation has a set tidal volume of 450 mL, but the ventilator display shows an exhaled tidal volume of 380 mL consistently across several breaths, with a stable but slightly elevated peak pressure.",
    question: "What should the RT investigate?",
    options: [
      { label: "A", text: "A possible leak in the circuit or around the ET tube cuff, given the discrepancy between set and exhaled volume", correct: true, tag: null, rationale: "A persistent, meaningful gap between set and exhaled tidal volume is a classic sign of a leak somewhere in the delivery system — this should be investigated by checking the circuit connections and cuff pressure/seal." },
      { label: "B", text: "Assume this is normal ventilator variation requiring no investigation", correct: false, tag: null, rationale: "A consistent 70 mL gap between set and exhaled volume across multiple breaths is a meaningful, persistent finding that warrants investigation, not normal breath-to-breath variation." },
      { label: "C", text: "Increase the set tidal volume to compensate without investigating the cause", correct: false, tag: null, rationale: "Simply increasing the set volume without identifying and addressing the underlying leak treats the symptom, not the cause, and could mask a worsening leak over time." },
      { label: "D", text: "Assume this indicates improved lung compliance", correct: false, tag: null, rationale: "A volume discrepancy between set and exhaled values relates to a leak in the delivery system, not lung compliance, which would show differently (e.g., via pressure changes at a given volume, not a volume discrepancy itself)." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Neonatal · General",
    stem: "A neonate on conventional mechanical ventilation has a PaCO2 of 55 mmHg (goal 45-55) and PaO2 of 45 mmHg (goal 50-70) on current settings.",
    question: "What adjustment would most directly address the low PaO2 while keeping the PaCO2 within its current acceptable range?",
    options: [
      { label: "A", text: "Increase mean airway pressure (e.g., via PEEP or inspiratory time) rather than adjusting rate or tidal volume", correct: true, tag: null, rationale: "Oxygenation is primarily influenced by mean airway pressure, while ventilation (CO2 clearance) is primarily influenced by minute ventilation (rate x tidal volume) — increasing mean airway pressure targets the oxygenation problem specifically without directly affecting the already-acceptable PaCO2." },
      { label: "B", text: "Increase the respiratory rate significantly", correct: false, tag: null, rationale: "Increasing rate primarily affects ventilation/CO2 clearance, not oxygenation directly, and could push the already-acceptable PaCO2 too low." },
      { label: "C", text: "Decrease FiO2 to improve oxygenation", correct: false, tag: null, rationale: "Decreasing FiO2 would worsen, not improve, oxygenation — this is the wrong direction for a low PaO2." },
      { label: "D", text: "Decrease mean airway pressure", correct: false, tag: null, rationale: "Decreasing mean airway pressure would likely worsen the already-low PaO2, moving in the wrong direction for this specific problem." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Airway pressure release ventilation (APRV) is best characterized as:",
    options: [
      { label: "A", text: "A mode using a prolonged high-pressure phase (P-high) with brief, intermittent releases to a lower pressure (P-low) to allow ventilation, while spontaneous breathing is generally permitted throughout", correct: true, tag: null, rationale: "APRV maintains a prolonged high CPAP-like pressure for lung recruitment, with brief pressure releases providing ventilation, while allowing the patient to breathe spontaneously at any point in the cycle — a distinctly different approach from conventional cycled ventilation." },
      { label: "B", text: "A mode identical to standard pressure control ventilation with no unique features", correct: false, tag: null, rationale: "APRV has a distinctly different pressure-time profile and philosophy (prolonged high pressure with brief releases, permitting spontaneous breathing throughout) compared to standard pressure control ventilation." },
      { label: "C", text: "A mode used exclusively for pediatric patients", correct: false, tag: null, rationale: "APRV is used across various patient populations, particularly in certain adult ARDS management strategies, not exclusively in pediatrics." },
      { label: "D", text: "A purely spontaneous mode with no set pressure targets", correct: false, tag: null, rationale: "APRV does have set pressure targets (P-high and P-low) — it's not a purely spontaneous, unsupported mode." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · General",
    stem: "A patient receiving therapeutic aerosolized antibiotics via nebulizer for a resistant pulmonary infection reports increasing shortness of breath and wheeze specifically during each treatment.",
    question: "What is the most appropriate recommendation?",
    options: [
      { label: "A", text: "Recommend evaluation for possible bronchospasm related to the aerosolized medication, and consider pre-treatment with a bronchodilator", correct: true, tag: null, rationale: "Some aerosolized antibiotics are known to cause treatment-related bronchospasm — recognizing this pattern and considering a pre-treatment bronchodilator is a reasonable, evidence-based approach to allow the patient to continue needed antibiotic therapy safely." },
      { label: "B", text: "Recommend immediately and permanently discontinuing the antibiotic therapy", correct: false, tag: null, rationale: "Discontinuing an important antibiotic therapy outright, without first trying evidence-based mitigation strategies like pre-treatment bronchodilators, may not be necessary and could compromise treatment of the resistant infection." },
      { label: "C", text: "Recommend increasing the antibiotic dose to overcome the wheeze", correct: false, tag: null, rationale: "Increasing the dose of a medication causing bronchospasm would likely worsen, not improve, the reaction." },
      { label: "D", text: "Recommend no changes since this is expected and requires no intervention", correct: false, tag: null, rationale: "While treatment-related bronchospasm is a recognized phenomenon with some aerosolized antibiotics, it still warrants active management (like pre-treatment) rather than simply being tolerated without intervention." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A patient's respiratory care plan should generally be reassessed and potentially modified:",
    options: [
      { label: "A", text: "Whenever there is a significant change in the patient's clinical status, in addition to routine scheduled reassessment", correct: true, tag: null, rationale: "Respiratory care plans are dynamic and should be responsive to real clinical changes as they occur, not just reassessed on a fixed schedule regardless of the patient's evolving status." },
      { label: "B", text: "Only at fixed 24-hour intervals regardless of clinical changes", correct: false, tag: null, rationale: "While routine reassessment intervals exist, care plans should also be responsive to significant clinical changes as they happen, not rigidly fixed to a schedule alone." },
      { label: "C", text: "Only when specifically requested by the patient", correct: false, tag: null, rationale: "While patient input matters, reassessment should be driven by clinical indicators and professional judgment, not solely by patient request." },
      { label: "D", text: "Never, once the initial plan is established", correct: false, tag: null, rationale: "This is inappropriate — respiratory care plans need to be dynamic and responsive to the patient's evolving clinical course, not fixed permanently at initiation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "application",
    patient: "Adult · Asthma",
    stem: "A patient with newly diagnosed persistent asthma is being started on maintenance therapy. The care team is deciding on an initial treatment approach.",
    question: "Which evidence-based approach aligns with current asthma management guidelines?",
    options: [
      { label: "A", text: "Initiate inhaled corticosteroid therapy as the foundation of persistent asthma management, with a stepwise approach based on symptom control", correct: true, tag: null, rationale: "Current asthma guidelines (NAEPP/GINA) emphasize inhaled corticosteroids as the cornerstone of persistent asthma management, with therapy stepped up or down based on ongoing symptom control assessment." },
      { label: "B", text: "Use short-acting bronchodilators as monotherapy for persistent asthma, with no anti-inflammatory therapy", correct: false, tag: null, rationale: "SABA-only therapy is not appropriate for PERSISTENT asthma — current guidelines emphasize anti-inflammatory (ICS) therapy as foundational for this severity classification." },
      { label: "C", text: "Use long-acting beta-agonist (LABA) monotherapy without an inhaled corticosteroid", correct: false, tag: null, rationale: "LABA monotherapy without concurrent ICS carries a black-box warning and is not recommended — LABAs should always be paired with an inhaled corticosteroid in asthma management." },
      { label: "D", text: "Recommend no maintenance therapy, treating only acute symptoms as they arise", correct: false, tag: null, rationale: "This reactive-only approach doesn't align with evidence-based management of PERSISTENT asthma, which requires ongoing maintenance anti-inflammatory therapy to reduce underlying airway inflammation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "application",
    patient: "Adult · General",
    stem: "During a code (cardiac arrest) response, the RT is managing the airway with a bag-valve-mask while chest compressions are ongoing.",
    question: "What ventilation approach is most appropriate in this scenario, prior to advanced airway placement?",
    options: [
      { label: "A", text: "Deliver breaths synchronized with compression pauses at the guideline-recommended compression-to-ventilation ratio (e.g., 30:2 for a single rescuer scenario, per current ACLS/BLS guidance)", correct: true, tag: null, rationale: "Prior to advanced airway placement, ventilation should be coordinated with compressions per standard resuscitation ratios to avoid interrupting compressions unnecessarily while still providing adequate ventilation." },
      { label: "B", text: "Deliver continuous breaths regardless of compression timing, with no coordination", correct: false, tag: null, rationale: "Uncoordinated ventilation during compressions (before an advanced airway is placed) isn't standard practice and can interfere with effective compression delivery." },
      { label: "C", text: "Withhold all ventilation until compressions are complete for the entire code", correct: false, tag: null, rationale: "Ventilation is a critical component of resuscitation and shouldn't be withheld entirely — it should be coordinated with compressions per protocol, not omitted." },
      { label: "D", text: "Hyperventilate the patient as rapidly as possible to maximize oxygen delivery", correct: false, tag: null, rationale: "Hyperventilation during resuscitation can actually be harmful, increasing intrathoracic pressure and reducing venous return/cardiac output — guideline-based rates should be followed, not excessive hyperventilation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "The RT is assisting with a diagnostic bronchoscopy and bronchoalveolar lavage. The patient's SpO2 begins trending down during the procedure, from 96% to 89%.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Alert the proceduralist to the desaturation and recommend increasing supplemental oxygen or pausing the procedure as needed", correct: true, tag: null, rationale: "Ongoing desaturation during bronchoscopy requires prompt communication with the proceduralist and appropriate intervention (oxygen escalation or procedure pause) — the RT's monitoring role is specifically to catch and respond to exactly this kind of change." },
      { label: "B", text: "Say nothing and simply continue documenting vital signs", correct: false, tag: null, rationale: "Passive documentation without alerting the team to a clinically significant desaturation trend fails the RT's active monitoring responsibility during the procedure." },
      { label: "C", text: "Immediately terminate the procedure without first attempting oxygen escalation or communicating with the team", correct: false, tag: null, rationale: "While escalation may ultimately be needed, the first step is typically communicating the finding and trying reasonable interventions (like increased oxygen) rather than unilaterally stopping the procedure without team input." },
      { label: "D", text: "Assume this level of desaturation is expected and requires no action during bronchoscopy", correct: false, tag: null, rationale: "While some mild desaturation can occur during bronchoscopy, a drop to 89% is clinically significant and requires active response, not passive acceptance as an expected finding." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "When teaching a patient proper metered-dose inhaler (MDI) technique without a spacer, which instruction is most important for effective medication delivery?",
    options: [
      { label: "A", text: "Coordinate actuation of the inhaler with the beginning of a slow, deep inhalation", correct: true, tag: null, rationale: "Without a spacer, proper hand-breath coordination — actuating the MDI right as slow inhalation begins — is critical for effective medication deposition in the lungs rather than in the mouth/throat, which is the most common technique error patients make." },
      { label: "B", text: "Actuate the inhaler after completing a full inhalation and holding the breath", correct: false, tag: null, rationale: "This is incorrect timing — actuation needs to coordinate with the START of inhalation, not occur afterward, for the medication to be carried effectively into the lungs." },
      { label: "C", text: "Inhale as rapidly and forcefully as possible during actuation", correct: false, tag: null, rationale: "A slow, deep inhalation (not rapid/forceful) is recommended for optimal MDI medication deposition in the lower airways." },
      { label: "D", text: "Hold the inhaler several inches away from a closed mouth without a spacer", correct: false, tag: null, rationale: "This describes an open-mouth technique variant which has specific, different guidance — without further spacer use, standard closed-mouth technique with proper coordination is the most commonly taught approach for reliable delivery." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a rising eosinophil count over the past week, alongside a new medication started 10 days ago and no other clear infectious source identified.",
    question: "This trend should prompt consideration of:",
    options: [
      { label: "A", text: "A possible drug-induced eosinophilic reaction, warranting medication review", correct: true, tag: null, rationale: "A rising eosinophil count temporally associated with a new medication, without another clear cause, raises suspicion for a drug-induced eosinophilic reaction — this should prompt review of recently started medications as a potential cause." },
      { label: "B", text: "A routine, expected finding requiring no further consideration", correct: false, tag: null, rationale: "A new, rising eosinophil trend with a temporal medication association is not something to dismiss as routine — it warrants investigation." },
      { label: "C", text: "Definitive proof of a parasitic infection", correct: false, tag: null, rationale: "While eosinophilia can be associated with parasitic infections, this isn't the only or most likely explanation here — the temporal medication association is a more specific clue in this context." },
      { label: "D", text: "A normal finding unrelated to the new medication", correct: false, tag: null, rationale: "The temporal relationship between the new medication and the rising eosinophil count is clinically relevant and shouldn't be dismissed as unrelated." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A D-dimer test is most useful clinically for:",
    options: [
      { label: "A", text: "Helping to rule OUT venous thromboembolism (PE/DVT) when the result is negative in a low-to-moderate risk patient", correct: true, tag: null, rationale: "D-dimer has high sensitivity but low specificity — a negative result in a low-to-moderate pretest probability patient helps rule out VTE, but a positive result requires further imaging confirmation since many other conditions can also elevate D-dimer." },
      { label: "B", text: "Definitively diagnosing pulmonary embolism on its own", correct: false, tag: null, rationale: "D-dimer alone cannot definitively diagnose PE due to its low specificity — many other conditions elevate D-dimer, so a positive result requires confirmatory imaging like CTPA." },
      { label: "C", text: "Assessing lung volumes", correct: false, tag: null, rationale: "D-dimer is a blood test related to clot breakdown products, entirely unrelated to lung volume assessment." },
      { label: "D", text: "Diagnosing pneumonia", correct: false, tag: null, rationale: "D-dimer isn't used for pneumonia diagnosis, which relies on clinical presentation, imaging, and other infection markers." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "application",
    patient: "Adult · General",
    stem: "On assessment, a patient has clubbing of the fingers noted on inspection, along with a chronic productive cough spanning several years.",
    question: "Digital clubbing in this context is most suggestive of:",
    options: [
      { label: "A", text: "A chronic underlying pulmonary or cardiac condition associated with prolonged hypoxemia, such as bronchiectasis or ILD", correct: true, tag: null, rationale: "Clubbing develops over time in association with chronic hypoxemic conditions, including bronchiectasis, interstitial lung disease, and certain congenital heart defects — combined with a chronic productive cough history, this raises suspicion for a chronic suppurative or fibrotic lung process." },
      { label: "B", text: "A normal anatomical variant with no clinical significance", correct: false, tag: null, rationale: "Clubbing is not a normal variant — it's a recognized clinical sign associated with underlying chronic disease processes and warrants further evaluation." },
      { label: "C", text: "An acute, sudden-onset process", correct: false, tag: null, rationale: "Clubbing develops gradually over time with chronic conditions, not as a sign of an acute, sudden process." },
      { label: "D", text: "A sign specific to asthma only", correct: false, tag: null, rationale: "Clubbing is not a typical feature of asthma — it's more associated with chronic suppurative or fibrotic conditions like bronchiectasis or ILD." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Neonatal · General",
    stem: null,
    question: "In a neonate, central cyanosis (involving the lips and mucous membranes) versus acrocyanosis (blue hands/feet only) is distinguished because:",
    options: [
      { label: "A", text: "Central cyanosis reflects true hypoxemia and requires immediate evaluation, while acrocyanosis is often a normal finding in the first hours after birth related to peripheral circulation", correct: true, tag: null, rationale: "Acrocyanosis is common and often benign in newborns due to normal peripheral vasomotor instability, while central cyanosis (affecting lips/mucous membranes) reflects true hypoxemia and requires prompt evaluation." },
      { label: "B", text: "Both findings are equally benign and require no evaluation", correct: false, tag: null, rationale: "Central cyanosis is NOT benign — unlike acrocyanosis, it reflects true hypoxemia and requires immediate assessment." },
      { label: "C", text: "Both findings always require immediate resuscitation", correct: false, tag: null, rationale: "Acrocyanosis alone typically does not require resuscitation, distinguishing it importantly from central cyanosis, which does warrant prompt evaluation." },
      { label: "D", text: "There is no clinically meaningful distinction between the two", correct: false, tag: null, rationale: "This distinction is clinically important — conflating the two could lead to either unnecessary intervention for benign acrocyanosis or dangerous under-response to true central cyanosis." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Static lung compliance is calculated using:",
    options: [
      { label: "A", text: "Tidal volume divided by (plateau pressure minus PEEP)", correct: true, tag: null, rationale: "Static compliance = Vt / (Pplat - PEEP), reflecting lung and chest wall distensibility under no-flow (static) conditions, which is why plateau pressure (not peak pressure) is used in the calculation." },
      { label: "B", text: "Tidal volume divided by (peak pressure minus PEEP)", correct: false, tag: null, rationale: "This describes dynamic compliance, which uses peak pressure and reflects both resistive and elastic properties, not static compliance specifically, which isolates the elastic (lung tissue) component using plateau pressure." },
      { label: "C", text: "Peak pressure divided by tidal volume", correct: false, tag: null, rationale: "This is not the correct compliance formula — compliance is volume change per unit pressure change, not pressure divided by volume, and static compliance specifically uses plateau pressure, not peak." },
      { label: "D", text: "Respiratory rate divided by tidal volume", correct: false, tag: null, rationale: "This describes the rapid shallow breathing index (RSBI), an entirely different calculation unrelated to compliance." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Adult · General",
    stem: "A ventilated patient's static compliance has decreased from 60 mL/cmH2O to 35 mL/cmH2O over the past 24 hours, with a corresponding rise in plateau pressure at the same set tidal volume.",
    question: "This trend most likely indicates:",
    options: [
      { label: "A", text: "A worsening process affecting lung or chest wall distensibility, such as worsening ARDS, atelectasis, or a new pleural process", correct: true, tag: null, rationale: "A significant drop in static compliance with rising plateau pressure at the same volume reflects the lung/chest wall becoming stiffer — this could indicate worsening ARDS, atelectasis, pneumothorax, or another process reducing distensibility, and warrants clinical investigation." },
      { label: "B", text: "Improving lung function", correct: false, tag: null, rationale: "A DECREASE in compliance indicates the lungs are becoming stiffer/less distensible, the opposite of improvement." },
      { label: "C", text: "A ventilator calibration issue exclusively", correct: false, tag: null, rationale: "While equipment issues are always worth ruling out, this pattern is a recognized clinical trend reflecting real physiological change, not primarily an equipment problem." },
      { label: "D", text: "No clinically significant change", correct: false, tag: null, rationale: "A compliance drop this significant (60 to 35) over 24 hours represents a clinically meaningful change requiring investigation, not something to dismiss." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Thoracentesis is primarily indicated for:",
    options: [
      { label: "A", text: "Diagnostic and/or therapeutic evaluation and drainage of pleural effusion", correct: true, tag: null, rationale: "Thoracentesis involves needle aspiration of pleural fluid, used both to diagnose the cause of an effusion (via fluid analysis) and therapeutically to relieve symptoms from a large effusion." },
      { label: "B", text: "Evaluating lung parenchymal tissue directly", correct: false, tag: null, rationale: "Thoracentesis samples pleural fluid, not lung parenchymal tissue — a lung biopsy would be needed for direct tissue evaluation." },
      { label: "C", text: "Treating pneumothorax exclusively", correct: false, tag: null, rationale: "While a similar needle technique can be used for pneumothorax decompression, thoracentesis specifically refers to pleural fluid drainage/sampling, not primarily pneumothorax treatment." },
      { label: "D", text: "Measuring lung volumes", correct: false, tag: null, rationale: "Lung volumes are measured via pulmonary function testing, not thoracentesis, which is a fluid sampling/drainage procedure." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A DISS (Diameter Index Safety System) connector is designed to:",
    options: [
      { label: "A", text: "Prevent incorrect connections between different medical gas delivery systems at threaded connection points", correct: true, tag: null, rationale: "DISS fittings use gas-specific thread diameters to physically prevent misconnection between different medical gases at threaded connections, serving a similar safety purpose to the pin index system but for larger, threaded fittings rather than small cylinder valves." },
      { label: "B", text: "Measure gas flow rate", correct: false, tag: null, rationale: "DISS is a connection safety system, not a flow measurement device — flow is measured separately via a flowmeter." },
      { label: "C", text: "Filter particulates from medical gas", correct: false, tag: null, rationale: "DISS fittings serve a connection-safety function, not filtration." },
      { label: "D", text: "Regulate gas pressure", correct: false, tag: null, rationale: "Pressure regulation is handled by a separate regulator, not the DISS connector itself, whose purpose is preventing incorrect connections." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on a mechanical ventilator has an activated \"low PEEP/CPAP\" alarm, and the RT notices the exhalation valve appears to be sticking, not fully closing between breaths.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Inspect and clean or replace the exhalation valve, as a sticking valve can cause inconsistent PEEP delivery", correct: true, tag: null, rationale: "A sticking exhalation valve that doesn't fully close can allow PEEP to be lost between breaths, directly explaining the low PEEP alarm — inspecting, cleaning, or replacing the valve addresses the root mechanical cause." },
      { label: "B", text: "Simply increase the set PEEP value to compensate without addressing the valve", correct: false, tag: null, rationale: "Compensating by increasing set PEEP doesn't fix the underlying mechanical problem and could result in unpredictable, inconsistent pressure delivery as the valve issue persists or worsens." },
      { label: "C", text: "Silence the alarm and continue without further action", correct: false, tag: null, rationale: "Silencing an alarm indicating a real mechanical problem without addressing the cause risks continued inconsistent ventilation." },
      { label: "D", text: "Assume this is a patient-related issue rather than an equipment issue", correct: false, tag: null, rationale: "The description specifically identifies a mechanical valve problem (sticking, not fully closing) — this is an equipment issue requiring equipment-focused troubleshooting, not a patient-related cause." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.B — Ensure Infection Prevention",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is about to perform open suctioning on a ventilated patient with no known multidrug-resistant organisms or special isolation requirements.",
    question: "What PPE is minimally appropriate for this standard procedure?",
    options: [
      { label: "A", text: "Gloves and eye/face protection (given splash risk), following standard precautions", correct: true, tag: null, rationale: "Open suctioning carries a real risk of secretion splash, making eye/face protection appropriate under standard precautions, alongside gloves — this doesn't require special contact/droplet/airborne precautions absent a specific known indication." },
      { label: "B", text: "No PPE is needed for a routine procedure like suctioning", correct: false, tag: null, rationale: "Suctioning carries splash risk from respiratory secretions — standard precautions PPE (gloves, eye protection) is appropriate even without a specific known infectious concern." },
      { label: "C", text: "Full airborne precautions PPE (N95, gown, gloves) for every suctioning procedure regardless of indication", correct: false, tag: null, rationale: "Without a specific indication for airborne precautions, this level of PPE is more than what's needed for a routine suctioning procedure under standard precautions alone." },
      { label: "D", text: "A surgical mask only, without eye protection or gloves", correct: false, tag: null, rationale: "This is incomplete — gloves are essential given direct contact with secretions, and eye protection addresses the splash risk of the procedure." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Adult · General",
    stem: "A patient with a new tracheostomy has thick, tenacious secretions that are difficult to suction, despite adequate systemic hydration.",
    question: "What should the RT recommend to help address this specific problem?",
    options: [
      { label: "A", text: "Recommend assessing and optimizing airway humidification, since inadequate humidification of inspired gas is a common cause of thick secretions in a tracheostomy patient", correct: true, tag: null, rationale: "A tracheostomy bypasses the nose's natural humidification function, making external humidification of inspired gas essential — inadequate humidification at the airway level (even with good systemic hydration) is a common, correctable cause of thick, difficult-to-clear secretions." },
      { label: "B", text: "Recommend increasing suction pressure significantly to overcome the thick secretions", correct: false, tag: null, rationale: "Excessive suction pressure risks airway trauma without addressing the underlying humidification problem causing the thick secretions in the first place." },
      { label: "C", text: "Recommend decreasing airway humidification", correct: false, tag: null, rationale: "This would worsen, not improve, the thick secretion problem — the tracheostomy patient needs adequate humidification, not less." },
      { label: "D", text: "Recommend no changes since systemic hydration is already adequate", correct: false, tag: null, rationale: "Systemic hydration and LOCAL airway humidification are different things — adequate systemic hydration doesn't substitute for proper humidification of the air the patient breathes through a bypassed upper airway." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient on SIMV with pressure support shows spontaneous breaths with a tidal volume of only 180 mL, well below the target of 350-400 mL for adequate spontaneous ventilation, despite an adequate pressure support level.",
    question: "What should the RT investigate?",
    options: [
      { label: "A", text: "Possible patient fatigue, sedation level, or an inadequate pressure support setting relative to the patient's current effort and lung mechanics", correct: true, tag: null, rationale: "Persistently low spontaneous tidal volumes despite seemingly adequate pressure support could reflect patient fatigue, over-sedation reducing respiratory drive/effort, or a pressure support level that's actually inadequate for this specific patient's lung mechanics — all worth investigating rather than assuming the setting is automatically sufficient." },
      { label: "B", text: "Assume this is a normal, expected finding requiring no further assessment", correct: false, tag: null, rationale: "A spontaneous tidal volume this low relative to target requires investigation into potential causes, not automatic acceptance as normal." },
      { label: "C", text: "Immediately switch to full controlled ventilation without further assessment", correct: false, tag: null, rationale: "Jumping straight to controlled ventilation skips a reasonable assessment of correctable factors (sedation, pressure support level) that might resolve the issue while preserving spontaneous effort." },
      { label: "D", text: "Assume the ventilator is malfunctioning without checking patient factors first", correct: false, tag: null, rationale: "While equipment should always be checked, patient-related factors (sedation, fatigue, effort) are common and important considerations for this specific finding, not something to skip in favor of assuming equipment failure." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Neurally adjusted ventilatory assist (NAVA) is a mode that:",
    options: [
      { label: "A", text: "Uses the electrical activity of the diaphragm (Edi) to trigger and proportionally support each breath, closely coupling ventilator support to the patient's own neural respiratory drive", correct: true, tag: null, rationale: "NAVA uses a specialized catheter to detect diaphragmatic electrical activity, allowing the ventilator to trigger and deliver support in direct proportion to the patient's own neural effort, which can improve patient-ventilator synchrony compared to pneumatically triggered modes." },
      { label: "B", text: "Relies exclusively on pressure changes in the circuit to trigger breaths, like standard modes", correct: false, tag: null, rationale: "NAVA is specifically distinct because it uses neural (electrical) signals rather than relying solely on pneumatic pressure/flow changes for triggering, which is its key differentiating feature." },
      { label: "C", text: "Is only usable in fully paralyzed, sedated patients", correct: false, tag: null, rationale: "NAVA specifically requires and relies on the patient's own diaphragmatic electrical activity — it wouldn't function as intended in a fully paralyzed patient with no diaphragmatic effort to detect." },
      { label: "D", text: "Delivers a fixed volume regardless of patient effort", correct: false, tag: null, rationale: "NAVA support is proportional to detected neural effort, not a fixed, effort-independent volume." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · Cardiovascular",
    stem: "A patient recently started on a new antiarrhythmic medication develops new-onset dyspnea, dry cough, and bilateral interstitial infiltrates on chest X-ray over several weeks, without fever or other infectious signs.",
    question: "What should the RT recommend?",
    options: [
      { label: "A", text: "Recommend evaluation for possible drug-induced pulmonary toxicity related to the new medication, given the temporal relationship and clinical/imaging pattern", correct: true, tag: null, rationale: "Certain antiarrhythmic medications are well-documented causes of drug-induced pulmonary toxicity, presenting with this exact pattern (subacute dyspnea, dry cough, interstitial infiltrates without infection) — the temporal relationship with the new medication should prompt this specific consideration." },
      { label: "B", text: "Recommend empiric antibiotics as the primary intervention without considering the medication", correct: false, tag: null, rationale: "The absence of fever or other infectious signs, combined with the temporal medication relationship, points away from a primarily infectious process — antibiotics alone would miss the more likely underlying cause here." },
      { label: "C", text: "Recommend no evaluation since this could be coincidental", correct: false, tag: null, rationale: "The specific pattern and temporal relationship with a medication known for this toxicity is too suggestive to dismiss as coincidental without evaluation." },
      { label: "D", text: "Recommend increasing the dose of the antiarrhythmic medication", correct: false, tag: null, rationale: "If the medication is a likely cause of pulmonary toxicity, increasing its dose would worsen, not improve, the situation — this is the wrong direction." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A recommendation to change a patient's oxygen delivery device from a nasal cannula to a simple face mask would most likely be based on:",
    options: [
      { label: "A", text: "The patient requiring a higher FiO2 than a nasal cannula can reliably provide at reasonable flow rates", correct: true, tag: null, rationale: "Nasal cannulas are typically limited to lower FiO2 ranges before patient discomfort and mucosal drying become significant at higher flows — a simple face mask allows delivery of a moderately higher FiO2 range when a patient's needs exceed what cannula therapy can comfortably provide." },
      { label: "B", text: "The patient's request for a more comfortable device with no change in oxygen needs", correct: false, tag: null, rationale: "While comfort matters, device escalation decisions should primarily be driven by the patient's actual oxygenation requirements, not preference alone absent a clinical indication." },
      { label: "C", text: "A decrease in the patient's oxygen requirements", correct: false, tag: null, rationale: "A decreased oxygen requirement would typically prompt de-escalation toward a simpler, lower-flow device, not escalation to a face mask." },
      { label: "D", text: "Standard practice regardless of clinical status", correct: false, tag: null, rationale: "Device selection should be based on the patient's specific clinical oxygenation needs, not applied as a fixed standard regardless of status." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "The ARDSNet trial's key finding that changed clinical practice was that:",
    options: [
      { label: "A", text: "Lower tidal volume ventilation (6 mL/kg predicted body weight) reduced mortality compared to traditional higher tidal volumes in ARDS patients", correct: true, tag: null, rationale: "The landmark ARDSNet trial demonstrated a significant mortality reduction with lower tidal volume (6 mL/kg PBW) ventilation compared to the traditional higher tidal volumes (12 mL/kg) previously used, fundamentally changing standard ARDS ventilator management." },
      { label: "B", text: "Higher tidal volumes improved outcomes in ARDS", correct: false, tag: null, rationale: "This is the opposite of the trial's actual finding — higher tidal volumes were associated with WORSE outcomes compared to the lower tidal volume strategy." },
      { label: "C", text: "Tidal volume has no impact on ARDS outcomes", correct: false, tag: null, rationale: "The trial specifically demonstrated that tidal volume DOES significantly impact outcomes in ARDS, contrary to this statement." },
      { label: "D", text: "PEEP level is the only factor that matters in ARDS management", correct: false, tag: null, rationale: "While PEEP is an important factor studied in various ARDS trials, the ARDSNet trial's landmark finding specifically centered on tidal volume, not a claim that PEEP is the only relevant factor." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "application",
    patient: "Adult · General",
    stem: "During a hospital-wide disaster drill simulating a mass casualty event, the RT is asked to help coordinate ventilator resource allocation given limited equipment availability.",
    question: "What principle should guide this resource allocation process?",
    options: [
      { label: "A", text: "Allocate resources based on established triage protocols aimed at maximizing overall survival benefit across the affected population", correct: true, tag: null, rationale: "Disaster/mass casualty resource allocation follows established triage principles designed to do the greatest good for the greatest number, which may differ from normal individual-patient-focused care — this population-level ethical framework guides these difficult allocation decisions." },
      { label: "B", text: "Allocate resources strictly on a first-come, first-served basis regardless of clinical severity or likely benefit", correct: false, tag: null, rationale: "Standard disaster triage principles are specifically NOT first-come-first-served — they're based on clinical assessment of severity and likely benefit from treatment to maximize overall outcomes." },
      { label: "C", text: "Allocate all resources to the most critically ill patients regardless of prognosis", correct: false, tag: null, rationale: "In mass casualty triage, resources aren't automatically directed to the most critical patients if their prognosis is very poor even with treatment — this differs from usual individual patient care and aims to maximize overall survival benefit." },
      { label: "D", text: "There is no established framework for this kind of decision, and it should be improvised in the moment", correct: false, tag: null, rationale: "Established disaster/mass casualty triage protocols exist precisely to guide these decisions in a structured, ethical way, rather than being improvised without a framework." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "During assistance with an elective intubation, the RT's role typically includes:",
    options: [
      { label: "A", text: "Preoxygenating the patient, preparing/checking equipment, monitoring vital signs throughout, and confirming tube placement afterward", correct: true, tag: null, rationale: "The RT plays a comprehensive supportive role in intubation: ensuring adequate preoxygenation, having appropriately sized/functioning equipment ready, monitoring the patient's status throughout the procedure, and helping confirm correct tube placement (e.g., via capnography and breath sounds) afterward." },
      { label: "B", text: "Performing the intubation independently without physician involvement", correct: false, tag: null, rationale: "Elective intubation is typically performed by a physician or other credentialed provider, with the RT playing a supportive rather than primary-operator role, depending on institutional scope of practice." },
      { label: "C", text: "No specific role beyond being present in the room", correct: false, tag: null, rationale: "The RT has active, specific responsibilities during intubation (preoxygenation, equipment, monitoring, confirmation), not simply passive presence." },
      { label: "D", text: "Only documenting the procedure after it's completed", correct: false, tag: null, rationale: "The RT's role is active and ongoing throughout the procedure, not limited to after-the-fact documentation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "application",
    patient: "Pediatric · Asthma",
    stem: "A family of a child recently diagnosed with asthma asks the RT what triggers they should be watching for at home.",
    question: "What is the most appropriate response?",
    options: [
      { label: "A", text: "Provide education on common asthma triggers (allergens, smoke exposure, respiratory infections, exercise, weather changes) and help the family identify which specific triggers seem to affect their child", correct: true, tag: null, rationale: "Effective asthma education involves both general trigger categories and helping the family identify their child's SPECIFIC triggers through observation, since individual trigger profiles vary — this personalized approach improves the family's ability to actually manage and avoid relevant triggers." },
      { label: "B", text: "Tell the family that triggers are unpredictable and not worth trying to identify", correct: false, tag: null, rationale: "This is inaccurate and unhelpful — identifying and managing individual triggers is a well-established, important part of asthma management education." },
      { label: "C", text: "Provide only a generic list of triggers with no discussion of the child's specific situation", correct: false, tag: null, rationale: "While general trigger categories are useful information, effective education also involves helping the family connect this to their own child's specific patterns and situation." },
      { label: "D", text: "Avoid discussing triggers since medication alone will control the condition", correct: false, tag: null, rationale: "Trigger avoidance is an important complementary strategy alongside medication in asthma management, not something to dismiss in favor of medication alone." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A rising troponin level in a patient with acute dyspnea is most useful for evaluating:",
    options: [
      { label: "A", text: "Possible cardiac injury or strain contributing to the respiratory presentation", correct: true, tag: null, rationale: "Troponin is a marker of cardiac muscle injury — in a patient with acute dyspnea, a rising troponin can point toward a cardiac contributor (such as myocardial infarction or significant cardiac strain from conditions like large PE) to the respiratory symptoms, helping broaden the differential beyond a purely pulmonary cause." },
      { label: "B", text: "Kidney function exclusively", correct: false, tag: null, rationale: "Troponin is not a marker of kidney function — that's assessed via creatinine, BUN, and related studies." },
      { label: "C", text: "Lung volume measurement", correct: false, tag: null, rationale: "Troponin has no relationship to lung volumes, which are assessed via pulmonary function testing." },
      { label: "D", text: "Infection severity exclusively", correct: false, tag: null, rationale: "While severe illness of any cause can sometimes affect troponin, it isn't a marker specifically used to gauge infection severity — inflammatory/infectious markers like WBC or procalcitonin serve that role more directly." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Serum lactate is most useful clinically as a marker of:",
    options: [
      { label: "A", text: "Tissue hypoperfusion and anaerobic metabolism, often used to assess severity in sepsis or shock", correct: true, tag: null, rationale: "Elevated lactate reflects a shift to anaerobic metabolism from inadequate tissue oxygen delivery, making it a key marker for assessing severity and trending response to treatment in sepsis and shock states." },
      { label: "B", text: "Kidney function specifically", correct: false, tag: null, rationale: "Lactate is not a direct marker of kidney function — that's assessed via creatinine and BUN." },
      { label: "C", text: "Lung volume", correct: false, tag: null, rationale: "Lactate has no relationship to lung volume measurement, which is assessed through pulmonary function testing." },
      { label: "D", text: "Liver function exclusively", correct: false, tag: null, rationale: "While severe liver dysfunction can affect lactate clearance, lactate is primarily used clinically as a marker of tissue perfusion/anaerobic metabolism, not as a primary liver function test." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a steadily falling platelet count over 5 days of heparin therapy, from 250,000 to 90,000/mm³.",
    question: "This trend should raise suspicion for:",
    options: [
      { label: "A", text: "Heparin-induced thrombocytopenia (HIT), warranting prompt evaluation and likely discontinuation of heparin", correct: true, tag: null, rationale: "A significant, progressive platelet drop during heparin therapy is the classic presentation of HIT, a serious immune-mediated complication that requires prompt recognition and typically discontinuation of all heparin products given the paradoxical thrombosis risk." },
      { label: "B", text: "A normal, expected effect of heparin therapy requiring no action", correct: false, tag: null, rationale: "This magnitude of platelet decline is not a routine, expected heparin effect — it's specifically concerning for HIT and requires evaluation, not dismissal." },
      { label: "C", text: "Improved coagulation status", correct: false, tag: null, rationale: "A falling platelet count doesn't indicate improved coagulation — in the context of HIT, it's actually associated with a paradoxically INCREASED thrombosis risk despite the low platelet count." },
      { label: "D", text: "A dietary deficiency unrelated to the heparin therapy", correct: false, tag: null, rationale: "The clear temporal relationship with heparin therapy points specifically toward HIT as the most likely explanation, not an unrelated dietary cause." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Pursed-lip breathing, often seen in COPD patients, primarily helps by:",
    options: [
      { label: "A", text: "Creating back-pressure that helps keep airways open longer during exhalation, reducing air trapping", correct: true, tag: null, rationale: "Pursed-lip breathing creates positive back-pressure in the airways during exhalation, helping to splint open airways that would otherwise collapse prematurely in COPD, which reduces air trapping and can improve the sensation of dyspnea." },
      { label: "B", text: "Increasing the respiratory rate significantly", correct: false, tag: null, rationale: "Pursed-lip breathing is typically associated with a SLOWER, more controlled respiratory pattern, not an increased rate." },
      { label: "C", text: "Directly increasing FiO2", correct: false, tag: null, rationale: "Pursed-lip breathing is a breathing technique that doesn't change the inspired oxygen concentration — that's controlled separately by supplemental oxygen delivery." },
      { label: "D", text: "Bypassing the need for bronchodilator therapy", correct: false, tag: null, rationale: "Pursed-lip breathing is a helpful adjunctive technique but doesn't replace the need for appropriate bronchodilator or other pharmacologic therapy in COPD management." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is setting up for overnight pulse oximetry monitoring to help evaluate a patient for possible nocturnal hypoxemia.",
    question: "What is an important consideration for accurate results with this study?",
    options: [
      { label: "A", text: "Ensuring proper probe placement and patient education on avoiding probe displacement during sleep, to prevent artifact from being misread as true desaturation", correct: true, tag: null, rationale: "Movement artifact and probe displacement during sleep are common causes of falsely low or erratic readings — proper setup and patient education help ensure the recorded data accurately reflects true physiological desaturation rather than technical artifact." },
      { label: "B", text: "The specific probe location doesn't matter for overnight studies", correct: false, tag: null, rationale: "Probe placement and secure attachment do matter, particularly for a study spanning many hours of patient movement during sleep, to minimize artifact." },
      { label: "C", text: "No patient education is necessary for this type of study", correct: false, tag: null, rationale: "Patient education about keeping the probe in place and avoiding certain movements can meaningfully improve data quality for an overnight unattended study." },
      { label: "D", text: "The study can only be performed in a sleep lab setting", correct: false, tag: null, rationale: "Overnight pulse oximetry can often be performed at home as an unattended study, unlike full polysomnography, which does typically require a monitored setting." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "application",
    patient: "Adult · General",
    stem: "Overnight pulse oximetry results show an oxygen desaturation index (ODI) of 22 events/hour, with a mean SpO2 of 91% and multiple episodes below 88%.",
    question: "This result is most consistent with:",
    options: [
      { label: "A", text: "Significant nocturnal hypoxemia, warranting further evaluation such as formal polysomnography", correct: true, tag: null, rationale: "An ODI this elevated, combined with a reduced mean SpO2 and repeated significant desaturations, indicates clinically significant nocturnal hypoxemia that warrants further diagnostic workup, such as formal polysomnography, to characterize the underlying cause (e.g., OSA, hypoventilation)." },
      { label: "B", text: "A normal overnight oxygenation pattern", correct: false, tag: null, rationale: "This ODI and desaturation pattern is well outside normal limits and represents a clinically significant finding, not a normal result." },
      { label: "C", text: "A technical artifact requiring no further consideration", correct: false, tag: null, rationale: "While technical issues should always be considered, a pattern this consistent (repeated events, reduced mean SpO2) is more consistent with a real physiological finding requiring further evaluation, not dismissal as artifact." },
      { label: "D", text: "Definitive diagnosis of central sleep apnea specifically", correct: false, tag: null, rationale: "Pulse oximetry alone cannot distinguish between different causes of desaturation (obstructive vs central sleep apnea, hypoventilation, etc.) — that requires more detailed evaluation like polysomnography." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "recall",
    patient: "Pediatric · General",
    stem: null,
    question: "A sweat chloride test is the diagnostic gold standard for confirming:",
    options: [
      { label: "A", text: "Cystic fibrosis", correct: true, tag: null, rationale: "The sweat chloride test remains the gold-standard diagnostic test for confirming cystic fibrosis, measuring the elevated chloride concentration in sweat characteristic of the underlying CFTR gene dysfunction." },
      { label: "B", text: "Asthma", correct: false, tag: null, rationale: "Asthma diagnosis relies on clinical history, spirometry, and related testing, not a sweat chloride test." },
      { label: "C", text: "Bronchopulmonary dysplasia", correct: false, tag: null, rationale: "BPD is diagnosed based on clinical history (prematurity, oxygen requirement duration) and imaging, not a sweat chloride test." },
      { label: "D", text: "Croup", correct: false, tag: null, rationale: "Croup is a clinical diagnosis based on presentation (barky cough, stridor), unrelated to sweat chloride testing." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "An oxygen concentrator produces supplemental oxygen by:",
    options: [
      { label: "A", text: "Filtering room air through a molecular sieve to selectively remove nitrogen, concentrating the remaining oxygen", correct: true, tag: null, rationale: "Oxygen concentrators use a molecular sieve (zeolite) material that selectively adsorbs nitrogen from room air under pressure, leaving a concentrated oxygen output — this is different from a cylinder or liquid system, which store pre-existing oxygen supply." },
      { label: "B", text: "Storing pre-compressed pure oxygen gas, similar to a cylinder", correct: false, tag: null, rationale: "This describes a compressed gas cylinder, not a concentrator, which actively generates concentrated oxygen from ambient air rather than storing a pre-filled supply." },
      { label: "C", text: "Converting liquid oxygen to gas, similar to a liquid system", correct: false, tag: null, rationale: "This describes a liquid oxygen system, not a concentrator, which works via room air filtration rather than liquid-to-gas conversion." },
      { label: "D", text: "Chemically synthesizing new oxygen molecules", correct: false, tag: null, rationale: "A concentrator doesn't synthesize new oxygen — it separates and concentrates the oxygen already present in room air." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's home oxygen concentrator is showing an oxygen purity alarm, with output testing at 78% oxygen concentration (below the acceptable threshold).",
    question: "What is the most appropriate immediate action?",
    options: [
      { label: "A", text: "Provide the patient with a backup oxygen source (e.g., cylinder) and arrange for concentrator servicing or replacement", correct: true, tag: null, rationale: "A concentrator producing oxygen below acceptable purity thresholds cannot be relied upon to meet the patient's prescribed oxygen needs — ensuring an alternative, reliable oxygen source while the device is serviced or replaced protects patient safety in the interim." },
      { label: "B", text: "Continue using the concentrator as-is since it's still producing some oxygen output", correct: false, tag: null, rationale: "Oxygen output below the acceptable purity threshold may not adequately meet the patient's prescribed therapeutic needs — continuing to rely on a malfunctioning device risks under-treatment." },
      { label: "C", text: "Increase the flow rate setting significantly to compensate for lower purity", correct: false, tag: null, rationale: "Increasing flow doesn't correct the underlying purity problem with the device and isn't an appropriate substitute for addressing the malfunction directly." },
      { label: "D", text: "Discontinue all home oxygen therapy for this patient", correct: false, tag: null, rationale: "Discontinuing needed oxygen therapy isn't appropriate — the solution is ensuring a reliable alternative source while the equipment issue is resolved, not withdrawing prescribed therapy." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.C — Perform Quality Control Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Calibration verification of a mechanical ventilator's delivered tidal volume is typically performed using:",
    options: [
      { label: "A", text: "A calibrated test lung or known-volume device connected to the ventilator circuit to compare delivered versus measured volume", correct: true, tag: null, rationale: "Ventilator volume calibration checks typically use a test lung or precision measurement device to verify that the volume the ventilator reports delivering matches what's actually being delivered, catching drift or inaccuracy before patient use." },
      { label: "B", text: "Patient testing exclusively, with no bench verification", correct: false, tag: null, rationale: "Routine calibration verification should be performed on bench equipment (test lung), not solely relying on patient use to identify potential inaccuracies, which would risk patient safety." },
      { label: "C", text: "Visual inspection of the ventilator casing only", correct: false, tag: null, rationale: "Visual inspection alone doesn't verify functional accuracy of volume delivery — an actual measurement comparison against a known standard is needed." },
      { label: "D", text: "Checking the device's power cord condition only", correct: false, tag: null, rationale: "While electrical safety checks matter, they don't address volume delivery calibration accuracy specifically." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A double-lumen endotracheal tube is specifically used for:",
    options: [
      { label: "A", text: "Independent lung ventilation, such as during certain thoracic surgeries where isolating one lung from the other is needed", correct: true, tag: null, rationale: "A double-lumen tube allows each lung to be ventilated independently or one lung to be selectively deflated (e.g., for surgical access), a specialized application distinct from routine single-lumen intubation." },
      { label: "B", text: "Routine, general intubation for standard mechanical ventilation", correct: false, tag: null, rationale: "Standard mechanical ventilation typically uses a single-lumen ET tube — the double-lumen tube is reserved for the specific indication of independent lung isolation/ventilation." },
      { label: "C", text: "Neonatal intubation exclusively", correct: false, tag: null, rationale: "Double-lumen tubes are used in specific adult surgical/independent lung ventilation contexts, not as a neonatal-specific device." },
      { label: "D", text: "Long-term home ventilation", correct: false, tag: null, rationale: "Long-term home ventilation typically involves a tracheostomy, not a specialized double-lumen ET tube, which is used for specific short-term surgical/procedural purposes." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on mechanical ventilation with volume control mode has a sudden, significant drop in exhaled tidal volume along with a new high-pitched whistling sound audible near the ET tube connection.",
    question: "What is the most likely cause?",
    options: [
      { label: "A", text: "A leak at the ET tube cuff or circuit connection point, given the whistling sound and volume loss together", correct: true, tag: null, rationale: "A whistling sound combined with a sudden drop in exhaled volume is a classic combination pointing to an air leak — likely from cuff under-inflation or a loose circuit connection — that should be promptly located and corrected." },
      { label: "B", text: "Improved lung compliance", correct: false, tag: null, rationale: "A sudden volume DROP with an audible leak sound doesn't reflect improved compliance — this points to a mechanical leak problem instead." },
      { label: "C", text: "Increased airway resistance", correct: false, tag: null, rationale: "Increased resistance would more typically show as elevated pressures with maintained or altered flow patterns, not this specific combination of volume loss with an audible whistling leak." },
      { label: "D", text: "A normal, expected ventilator sound requiring no action", correct: false, tag: null, rationale: "A new whistling sound combined with significant volume loss represents a real problem requiring prompt investigation and correction, not something to dismiss as normal." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Volume-targeted pressure control ventilation modes (like PRVC) were developed primarily to combine which two benefits?",
    options: [
      { label: "A", text: "The guaranteed minute ventilation of volume control with the decelerating flow pattern and variable pressure-limiting characteristics of pressure control", correct: true, tag: null, rationale: "These hybrid modes were designed to capture the best of both traditional approaches — ensuring a target volume is met (like volume control) while using a more physiologic decelerating flow pattern that can improve gas distribution and patient comfort (like pressure control)." },
      { label: "B", text: "Lower cost and simpler equipment design", correct: false, tag: null, rationale: "These modes were developed for clinical/physiological reasons related to ventilation delivery characteristics, not primarily for cost or equipment simplicity." },
      { label: "C", text: "Elimination of the need for any patient monitoring", correct: false, tag: null, rationale: "These modes still require careful patient monitoring — they don't eliminate the need for clinical oversight." },
      { label: "D", text: "Exclusive use in pediatric patients only", correct: false, tag: null, rationale: "Volume-targeted pressure control modes are used across a range of patient populations, not exclusively in pediatrics." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Pediatric · General",
    stem: "A child on long-term home mechanical ventilation via tracheostomy is due for a routine tracheostomy tube change, but the family reports the child has had increased secretions and mild fever over the past day.",
    question: "What should the RT recommend?",
    options: [
      { label: "A", text: "Recommend evaluating the child's current clinical stability before proceeding, and consider whether the routine change should be deferred given the acute change in status", correct: true, tag: null, rationale: "A child with new fever and increased secretions may be less stable for a routine, elective procedure — evaluating current status first and potentially deferring the change (unless urgently needed for tube malfunction) is a reasonable, safety-focused approach rather than proceeding automatically as scheduled." },
      { label: "B", text: "Proceed with the routine change exactly as scheduled regardless of the new symptoms", correct: false, tag: null, rationale: "New fever and increased secretions represent a change in clinical status that should prompt reassessment before an elective procedure, not automatic unchanged proceeding." },
      { label: "C", text: "Cancel all future tracheostomy changes indefinitely", correct: false, tag: null, rationale: "This is an overreaction — the child will still need routine tube changes; the current episode simply warrants reassessment of timing, not indefinite cancellation of a necessary routine care component." },
      { label: "D", text: "Ignore the new symptoms since tracheostomy changes are routine", correct: false, tag: null, rationale: "New fever and increased secretions shouldn't be ignored just because the procedure itself is routine — clinical status always warrants consideration before proceeding." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A recommendation to add a mucolytic agent (such as nebulized hypertonic saline or dornase alfa) to a patient's regimen would most likely be based on:",
    options: [
      { label: "A", text: "The presence of thick, difficult-to-clear secretions contributing to airway obstruction or poor clearance", correct: true, tag: null, rationale: "Mucolytic agents are specifically indicated when thick, tenacious secretions are a clinical problem, helping to reduce mucus viscosity and improve clearance — they aren't a routine addition absent this specific indication." },
      { label: "B", text: "A need to bronchodilate the airways", correct: false, tag: null, rationale: "Bronchodilation is the specific role of bronchodilator medications, not mucolytics, which target secretion viscosity rather than airway smooth muscle tone." },
      { label: "C", text: "A need to reduce airway inflammation", correct: false, tag: null, rationale: "Anti-inflammatory medications (like corticosteroids) target inflammation — mucolytics have a different, distinct mechanism focused on secretion characteristics." },
      { label: "D", text: "Universal application to all respiratory patients regardless of secretion status", correct: false, tag: null, rationale: "Mucolytics are indicated based on the specific presence of problematic thick secretions, not applied universally regardless of a patient's actual secretion characteristics." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "application",
    patient: "Adult · General",
    stem: "A hospital is implementing a ventilator-associated pneumonia (VAP) prevention bundle based on current evidence-based guidelines.",
    question: "Which of the following is a core, evidence-based component of a standard VAP prevention bundle?",
    options: [
      { label: "A", text: "Head-of-bed elevation to 30-45 degrees, daily sedation interruption with spontaneous breathing trials, and regular oral care", correct: true, tag: null, rationale: "These are well-established, evidence-based core components of VAP prevention bundles, each targeting a different mechanism of VAP risk — aspiration risk (positioning), prolonged ventilation (sedation/SBT), and oral bacterial burden (oral care)." },
      { label: "B", text: "Keeping the head of bed flat at all times", correct: false, tag: null, rationale: "This is the OPPOSITE of the evidence-based recommendation — flat positioning increases aspiration risk and is specifically discouraged in VAP prevention bundles." },
      { label: "C", text: "Continuous deep sedation without any interruption", correct: false, tag: null, rationale: "Continuous, uninterrupted deep sedation is associated with prolonged ventilation duration and higher VAP risk — daily sedation interruption is the evidence-based practice instead." },
      { label: "D", text: "Avoiding all oral care to prevent airway stimulation", correct: false, tag: null, rationale: "Regular oral care is a core, evidence-based bundle component that reduces bacterial burden — avoiding it would increase, not decrease, VAP risk." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "When preparing a ventilated patient for ground ambulance interfacility transport, which of the following is an important RT responsibility?",
    options: [
      { label: "A", text: "Ensuring adequate portable oxygen supply for the anticipated transport duration plus a safety margin, and confirming all equipment is transport-ready", correct: true, tag: null, rationale: "Running out of oxygen mid-transport is a serious, preventable risk — calculating adequate supply (including a safety margin for unexpected delays) and confirming equipment readiness is a core RT responsibility before any interfacility transport." },
      { label: "B", text: "Providing exactly enough oxygen for the expected transport time with no safety margin", correct: false, tag: null, rationale: "Not including a safety margin risks running out of oxygen if transport takes longer than expected due to traffic, delays, or complications — a margin is standard, prudent practice." },
      { label: "C", text: "Assuming the receiving facility will have all necessary equipment, so minimal preparation is needed", correct: false, tag: null, rationale: "The transport team needs to be self-sufficient for the duration of transport — assuming the destination will handle any gaps risks patient safety during the transport itself." },
      { label: "D", text: "No specific responsibility beyond what the ambulance crew handles", correct: false, tag: null, rationale: "The RT has specific, active responsibilities in preparing the respiratory equipment and oxygen supply for a ventilated patient's transport, not simply deferring to the ambulance crew." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "The RT is assisting with placement of an arterial line for continuous blood pressure monitoring and arterial blood gas sampling access.",
    question: "After the line is placed, what is an important ongoing RT responsibility related to this line?",
    options: [
      { label: "A", text: "Performing an Allen's test verification (if not already done) and monitoring the site and waveform for signs of complications, such as poor perfusion or line malfunction", correct: true, tag: null, rationale: "Ongoing monitoring of arterial line function and the distal circulation (checking for adequate perfusion, appropriate waveform, and signs of complications like thrombosis) is an important safety responsibility once the line is in place and being used for sampling/monitoring." },
      { label: "B", text: "No ongoing monitoring responsibility once the line is placed", correct: false, tag: null, rationale: "Arterial lines require ongoing monitoring for complications — this isn't a \"set and forget\" device." },
      { label: "C", text: "Removing the line immediately after placement", correct: false, tag: null, rationale: "The line is placed specifically for ongoing monitoring/sampling access — immediate removal would defeat its purpose." },
      { label: "D", text: "Only the physician has any responsibility related to the line after placement", correct: false, tag: null, rationale: "The RT, as a frequent user of the line for blood gas sampling, has an active role in monitoring for line-related complications and proper function." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "When teaching a patient about pulmonary rehabilitation, which of the following best describes its core components?",
    options: [
      { label: "A", text: "A structured program combining exercise training, disease education, and psychosocial support to improve functional capacity and quality of life in chronic lung disease", correct: true, tag: null, rationale: "Pulmonary rehabilitation is a comprehensive, evidence-based intervention combining supervised exercise, disease-specific education, and psychosocial support components, shown to improve exercise tolerance, symptoms, and quality of life in patients with chronic respiratory conditions." },
      { label: "B", text: "Medication management exclusively, with no exercise component", correct: false, tag: null, rationale: "Exercise training is actually a core, central component of pulmonary rehabilitation, not something excluded from the program." },
      { label: "C", text: "A one-time educational session with no ongoing program", correct: false, tag: null, rationale: "Pulmonary rehabilitation is a structured, typically multi-week program with ongoing sessions, not a single one-time educational encounter." },
      { label: "D", text: "A program exclusively for post-surgical patients", correct: false, tag: null, rationale: "Pulmonary rehabilitation is indicated for a range of chronic respiratory conditions (like COPD), not exclusively for post-surgical patients." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "application",
    patient: "Adult · General",
    stem: "On chest auscultation, the RT hears fine, high-pitched crackles at the lung bases that do not clear with coughing, in a patient with progressive dyspnea over several months.",
    question: "This finding, combined with the chronic history, is most suggestive of:",
    options: [
      { label: "A", text: "A possible interstitial lung process, such as pulmonary fibrosis", correct: true, tag: null, rationale: "Fine, \"Velcro-like\" crackles that persist despite coughing, especially at the bases with a chronic progressive dyspnea history, are classically associated with interstitial lung disease/fibrosis, distinct from the coarser, cough-clearing crackles more typical of secretions." },
      { label: "B", text: "Simple retained secretions that should clear with coughing", correct: false, tag: null, rationale: "The description specifically notes these crackles do NOT clear with coughing, which distinguishes them from secretion-related crackles and points toward a different, chronic interstitial process." },
      { label: "C", text: "A normal finding in an otherwise healthy patient", correct: false, tag: null, rationale: "Fine crackles with a chronic progressive symptom history are not a normal finding and warrant further evaluation." },
      { label: "D", text: "An acute pneumothorax", correct: false, tag: null, rationale: "Pneumothorax typically presents with absent or diminished breath sounds, not fine crackles, and doesn't fit this chronic progressive presentation." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Capnography (end-tidal CO2 monitoring) provides which of the following pieces of clinical information?",
    options: [
      { label: "A", text: "A breath-by-breath estimate of PaCO2 trends and confirmation of continued ventilation/airway patency", correct: true, tag: null, rationale: "Capnography provides continuous, real-time information about ventilation status, correlating (though not identically) with PaCO2, and serves as an important confirmation that the airway remains patent and the patient is being ventilated — useful for both intubation confirmation and ongoing monitoring." },
      { label: "B", text: "Direct measurement of oxygen saturation", correct: false, tag: null, rationale: "Oxygen saturation is measured via pulse oximetry (SpO2), not capnography, which specifically measures exhaled CO2." },
      { label: "C", text: "Blood pressure trends", correct: false, tag: null, rationale: "Capnography doesn't provide blood pressure information — that requires separate hemodynamic monitoring." },
      { label: "D", text: "Direct measurement of PaCO2 with complete accuracy", correct: false, tag: null, rationale: "While end-tidal CO2 correlates with PaCO2, it's an estimate that can be affected by various factors (V/Q mismatch, etc.) — it's not always perfectly identical to a direct arterial blood gas PaCO2 measurement." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A significantly elevated brain natriuretic peptide (BNP) level in conjunction with acute dyspnea most strongly supports a diagnosis of:",
    options: [
      { label: "A", text: "Acute decompensated heart failure", correct: true, tag: null, rationale: "BNP is released in response to ventricular stretch/wall stress and is elevated in heart failure — a markedly elevated level in the setting of acute dyspnea strongly supports a cardiac, rather than primarily pulmonary, cause of the symptoms." },
      { label: "B", text: "Acute asthma exacerbation", correct: false, tag: null, rationale: "BNP is not typically elevated in a primary asthma exacerbation without a cardiac component — this marker specifically points toward cardiac involvement." },
      { label: "C", text: "Simple viral upper respiratory infection", correct: false, tag: null, rationale: "A significantly elevated BNP would be an unusual and unexplained finding for a simple viral URI, pointing instead toward a cardiac process." },
      { label: "D", text: "Normal physiologic dyspnea from exertion", correct: false, tag: null, rationale: "A markedly elevated BNP is not consistent with simple physiologic exertional dyspnea in an otherwise healthy person — it indicates a pathologic cardiac process." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a steadily climbing serum creatinine over several days while receiving a nephrotoxic antibiotic for a respiratory infection.",
    question: "What should the RT recognize about this situation?",
    options: [
      { label: "A", text: "This trend may reflect drug-induced nephrotoxicity, which is relevant since it could affect dosing of other medications and overall patient stability", correct: true, tag: null, rationale: "Recognizing medication-related organ toxicity trends, even outside the RT's primary domain, is valuable for overall patient safety awareness — this finding is relevant to the broader care team's medication management and the patient's overall trajectory, which can affect respiratory care planning too." },
      { label: "B", text: "This finding is entirely irrelevant to respiratory care and can be ignored by the RT", correct: false, tag: null, rationale: "While kidney function isn't the RT's primary domain, recognizing significant trends that affect overall patient stability and medication dosing is part of holistic patient awareness, especially when it might affect other aspects of care." },
      { label: "C", text: "This is a normal, expected finding requiring no documentation or awareness", correct: false, tag: null, rationale: "A progressively rising creatinine is not a normal, inconsequential finding — it reflects a real clinical trend worth noting even outside one's primary specialty." },
      { label: "D", text: "Only the nephrology team needs to be aware of this finding", correct: false, tag: null, rationale: "While nephrology involvement is important, general clinical awareness across the care team, including the RT, supports better overall patient safety and communication." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Use of accessory muscles of respiration (sternocleidomastoid, scalene muscles) during breathing at rest indicates:",
    options: [
      { label: "A", text: "Increased work of breathing, suggesting the diaphragm alone is not adequately meeting ventilatory demand", correct: true, tag: null, rationale: "Accessory muscle use at rest is a visible sign that the primary respiratory muscle (diaphragm) is not sufficient to meet the patient's current ventilatory demand, indicating increased work of breathing and warranting further assessment." },
      { label: "B", text: "Normal, relaxed breathing", correct: false, tag: null, rationale: "Accessory muscle use at rest is NOT a normal finding — normal, relaxed breathing primarily uses the diaphragm without needing to recruit accessory muscles." },
      { label: "C", text: "A sign specific to cardiac disease only", correct: false, tag: null, rationale: "Accessory muscle use is a general sign of increased work of breathing that can occur with various respiratory conditions, not specific to cardiac disease alone." },
      { label: "D", text: "Decreased work of breathing", correct: false, tag: null, rationale: "This is the opposite of what accessory muscle use indicates — it's a sign of INCREASED, not decreased, respiratory effort." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Transcutaneous CO2 monitoring is particularly useful in which clinical scenario?",
    options: [
      { label: "A", text: "Continuous, noninvasive trending of CO2 in patients where frequent arterial sampling is impractical, such as certain neonatal or long-term ventilated patients", correct: true, tag: null, rationale: "Transcutaneous CO2 monitoring provides continuous, noninvasive trend information, making it valuable in populations like neonates or chronically ventilated patients where frequent arterial punctures are undesirable or impractical, though it should be correlated periodically with actual blood gas values." },
      { label: "B", text: "As a complete replacement for arterial blood gas sampling in all patients", correct: false, tag: null, rationale: "Transcutaneous monitoring provides useful trend data but isn't considered a complete replacement for periodic ABG confirmation, given potential accuracy limitations depending on perfusion and other factors." },
      { label: "C", text: "Measuring blood pressure trends", correct: false, tag: null, rationale: "Transcutaneous CO2 monitoring measures carbon dioxide levels through the skin, not blood pressure, which requires separate hemodynamic monitoring." },
      { label: "D", text: "Diagnosing pneumothorax", correct: false, tag: null, rationale: "This monitoring modality tracks CO2 trends and isn't a diagnostic tool for pneumothorax, which is identified through clinical assessment and imaging." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "analysis",
    patient: "Adult · General",
    stem: "ABG: pH 7.50, PaCO2 42 mmHg, HCO3 32 mEq/L, PaO2 90 mmHg on room air. The patient has a history of significant vomiting over the past several days.",
    question: "This ABG is most consistent with:",
    options: [
      { label: "A", text: "Metabolic alkalosis, likely from loss of gastric acid through vomiting, with a normal PaCO2 (no significant respiratory compensation yet)", correct: true, tag: null, rationale: "Elevated pH with elevated HCO3 and a relatively normal PaCO2 points to a primary metabolic alkalosis — the clinical history of significant vomiting (loss of gastric HCl) is a classic cause, and the near-normal PaCO2 suggests compensation hasn't fully developed yet." },
      { label: "B", text: "Respiratory alkalosis", correct: false, tag: null, rationale: "The PaCO2 here is essentially normal, not low, which argues against a primary respiratory alkalosis — the primary disturbance is metabolic (elevated HCO3), not respiratory." },
      { label: "C", text: "Metabolic acidosis", correct: false, tag: null, rationale: "The elevated pH and elevated HCO3 both point toward alkalosis, not acidosis — this is the opposite pattern from what's described." },
      { label: "D", text: "A normal ABG", correct: false, tag: null, rationale: "A pH of 7.50 with an elevated HCO3 of 32 is clearly outside normal ranges, representing an active acid-base disturbance." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A methacholine challenge test is primarily used to help diagnose:",
    options: [
      { label: "A", text: "Airway hyperresponsiveness, supporting a diagnosis of asthma when baseline spirometry is normal but clinical suspicion remains", correct: true, tag: null, rationale: "A methacholine challenge test provokes bronchoconstriction in hyperresponsive airways, helping confirm asthma in patients with a suggestive history but normal baseline spirometry — a positive test (significant FEV1 drop) supports the diagnosis." },
      { label: "B", text: "COPD exclusively", correct: false, tag: null, rationale: "Methacholine challenge testing is specifically used to assess airway hyperresponsiveness relevant to asthma diagnosis, not as a primary diagnostic tool for COPD." },
      { label: "C", text: "Pulmonary embolism", correct: false, tag: null, rationale: "PE is diagnosed via imaging studies like CTPA, entirely unrelated to methacholine challenge testing." },
      { label: "D", text: "Restrictive lung disease", correct: false, tag: null, rationale: "Methacholine challenge specifically tests for airway hyperreactivity relevant to obstructive conditions like asthma, not restrictive lung disease." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A patient using a CPAP device at home reports the machine seems louder than usual and they're noticing more air blowing out from around the mask edges than before.",
    question: "What should the RT recommend first?",
    options: [
      { label: "A", text: "Assess for mask fit issues or a deteriorated mask cushion/seal as the likely cause of the increased noise and air leak", correct: true, tag: null, rationale: "Increased noise and visible air leak around the mask are commonly caused by a worn-out cushion, improper fit, or a damaged seal — checking and potentially replacing the mask cushion or adjusting fit is a reasonable first troubleshooting step before assuming a deeper device malfunction." },
      { label: "B", text: "Assume the entire CPAP device needs replacement without further troubleshooting", correct: false, tag: null, rationale: "Jumping to full device replacement skips simpler, more common explanations (mask fit/seal issues) that should be checked first." },
      { label: "C", text: "Recommend discontinuing CPAP therapy entirely", correct: false, tag: null, rationale: "Discontinuing needed therapy isn't appropriate for what's likely a correctable equipment issue — the mask/seal should be assessed and addressed first." },
      { label: "D", text: "Ignore the reported changes since CPAP devices don't need adjustment over time", correct: false, tag: null, rationale: "CPAP equipment, especially the mask cushion, does wear over time and can need adjustment or replacement — this shouldn't be dismissed." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A closed-suction (in-line) suction catheter system, compared to an open suction technique, is primarily advantageous because it:",
    options: [
      { label: "A", text: "Allows suctioning without disconnecting the patient from the ventilator circuit, helping maintain oxygenation and PEEP during the procedure", correct: true, tag: null, rationale: "A closed/in-line suction system permits suctioning while the patient remains connected to the ventilator, avoiding the derecruitment and oxygen desaturation risk that can occur when disconnecting for open suctioning, particularly important in patients requiring high PEEP or FiO2." },
      { label: "B", text: "Is less expensive than open suctioning supplies", correct: false, tag: null, rationale: "Closed suction systems are typically more expensive than simple open suction catheters — their advantage is clinical (maintaining ventilation/PEEP), not primarily cost-related." },
      { label: "C", text: "Requires disconnecting the ventilator circuit for better visualization", correct: false, tag: null, rationale: "This is the opposite of the closed system's key advantage — it specifically avoids the need for disconnection, unlike open suctioning." },
      { label: "D", text: "Eliminates all infection risk associated with suctioning", correct: false, tag: null, rationale: "While closed systems may have some infection control benefits, they don't eliminate all risk — proper technique remains important regardless of system type." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.C — Perform Quality Control Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "A capnograph's calibration check using a known CO2 concentration gas shows a reading 8% higher than the expected value, outside the device's stated accuracy tolerance.",
    question: "What is the most appropriate action?",
    options: [
      { label: "A", text: "Take the capnograph out of clinical use and recalibrate or service it before further patient use", correct: true, tag: null, rationale: "A calibration check result outside the stated accuracy tolerance means the device cannot be trusted to provide accurate readings — it should be taken out of service and corrected before being used again for patient monitoring." },
      { label: "B", text: "Continue using the device for patient monitoring since it's only slightly outside tolerance", correct: false, tag: null, rationale: "Even a seemingly small deviation outside stated tolerance means the device's accuracy can't be trusted — it should be addressed before continued clinical use, not dismissed as minor." },
      { label: "C", text: "Manually subtract 8% from all future readings to compensate", correct: false, tag: null, rationale: "Manual compensation introduces additional error risk — the correct approach is servicing/recalibrating the device itself, not applying ad hoc corrections to readings." },
      { label: "D", text: "Assume the calibration gas itself is defective without further investigation", correct: false, tag: null, rationale: "While possible, the standard approach is to first address the device via recalibration/service using the known reference gas, rather than assuming the reference standard is wrong without investigation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Pediatric · General",
    stem: "A 5-year-old child requires intubation. The RT is selecting an appropriately sized uncuffed or cuffed endotracheal tube.",
    question: "Which factor is most important in appropriate pediatric ET tube size selection?",
    options: [
      { label: "A", text: "Using age-based formulas or length-based resuscitation tapes as a starting estimate, while remaining prepared to adjust based on the individual child's anatomy", correct: true, tag: null, rationale: "Pediatric ET tube sizing commonly uses age-based formulas or length-based tools (like a Broselow tape) as an evidence-based starting point, while always being prepared to have a size larger and smaller available given normal anatomical variation between children." },
      { label: "B", text: "Always using the same fixed tube size regardless of the child's age", correct: false, tag: null, rationale: "Pediatric patients vary enormously in size across ages — a fixed tube size regardless of age would be inappropriate and unsafe." },
      { label: "C", text: "Adult-sized tubes are appropriate for all pediatric patients over age 2", correct: false, tag: null, rationale: "This is incorrect and unsafe — pediatric airway sizing must account for the child's actual size, which varies significantly and is far smaller than adult dimensions even well beyond age 2." },
      { label: "D", text: "Tube size selection is not clinically important in pediatric intubation", correct: false, tag: null, rationale: "Appropriate tube size selection is critically important in pediatric intubation — an incorrectly sized tube risks airway trauma, inadequate ventilation, or excessive leak." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on volume control ventilation shows progressively increasing peak AND plateau pressures together over several hours, with the difference between the two (peak minus plateau) remaining stable.",
    question: "This pattern most likely reflects:",
    options: [
      { label: "A", text: "A process affecting lung/chest wall compliance (making the lungs stiffer), such as worsening pulmonary edema, ARDS progression, or increasing abdominal distension", correct: true, tag: null, rationale: "When peak and plateau pressures rise TOGETHER while their difference (reflecting airway resistance) stays stable, this points to a compliance problem — something making the lung or chest wall stiffer — rather than an airway resistance issue, which would show a widening gap between the two pressures instead." },
      { label: "B", text: "A worsening airway resistance problem, such as bronchospasm or secretions", correct: false, tag: null, rationale: "A primarily resistance-related problem would show a WIDENING gap between peak and plateau pressure, not both rising together with a stable difference — this pattern points to compliance, not resistance." },
      { label: "C", text: "Improving lung function", correct: false, tag: null, rationale: "Rising pressures at a constant volume indicate worsening, not improving, respiratory system compliance." },
      { label: "D", text: "A ventilator circuit leak", correct: false, tag: null, rationale: "A leak would typically cause volume loss and potentially altered pressure readings, but wouldn't produce this specific pattern of both peak and plateau rising together with volume maintained." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Permissive hypercapnia, sometimes used as a strategy in lung-protective ventilation, refers to:",
    options: [
      { label: "A", text: "Deliberately allowing PaCO2 to rise above normal levels in order to use lower tidal volumes/pressures and minimize ventilator-induced lung injury", correct: true, tag: null, rationale: "Permissive hypercapnia is a deliberate strategy where a somewhat elevated PaCO2 is tolerated (within reason, and contraindicated in certain conditions like elevated ICP) in order to prioritize lung-protective lower tidal volumes and pressures over normalizing CO2." },
      { label: "B", text: "Aggressively correcting PaCO2 to normal at all costs, even with high tidal volumes", correct: false, tag: null, rationale: "This is the opposite approach — permissive hypercapnia specifically accepts some CO2 elevation rather than pursuing normalization through potentially injurious higher tidal volumes." },
      { label: "C", text: "A strategy used only in patients with normal lung compliance", correct: false, tag: null, rationale: "Permissive hypercapnia is typically used in conditions with reduced compliance (like ARDS), where lung-protective ventilation strategies are especially important, not in patients with normal compliance." },
      { label: "D", text: "An approach with no specific contraindications", correct: false, tag: null, rationale: "Permissive hypercapnia does have important contraindications, such as elevated intracranial pressure, where a rising PaCO2 could worsen cerebral vasodilation and ICP." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on long-term supplemental oxygen therapy for chronic hypoxemia has follow-up testing showing consistent SpO2 above 92% on room air during the day, though nocturnal studies still show some desaturation.",
    question: "What should the RT recommend regarding this patient's oxygen therapy?",
    options: [
      { label: "A", text: "Recommend reassessment of daytime oxygen needs given the improved room air saturation, while continuing to address nocturnal oxygen needs separately based on sleep study findings", correct: true, tag: null, rationale: "Daytime and nocturnal oxygen needs can differ and should be individually reassessed — this patient's improved daytime saturation may allow reduction/discontinuation of daytime oxygen while still requiring nocturnal support based on the separate sleep-related findings." },
      { label: "B", text: "Recommend discontinuing all oxygen therapy entirely, including at night, based on the daytime results alone", correct: false, tag: null, rationale: "The daytime results don't address the separately identified nocturnal desaturation — discontinuing nighttime oxygen based only on daytime data would ignore relevant findings." },
      { label: "C", text: "Recommend no changes to the current 24-hour oxygen prescription despite the new data", correct: false, tag: null, rationale: "New objective data showing improved daytime saturation is clinically relevant and should prompt reassessment, not being ignored in favor of an unchanged prescription." },
      { label: "D", text: "Recommend increasing daytime oxygen flow despite the improved saturation results", correct: false, tag: null, rationale: "Increasing oxygen when saturation is already improved and above target doesn't align with the new data, which suggests daytime needs may actually be decreasing." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A recommendation to add a long-acting muscarinic antagonist (LAMA) to a COPD patient's regimen would typically be based on:",
    options: [
      { label: "A", text: "Ongoing symptoms or exacerbation risk despite current therapy, per stepwise COPD management guidelines", correct: true, tag: null, rationale: "LAMAs are added as part of stepwise COPD management when a patient has persistent symptoms or continued exacerbation risk despite their current regimen, following guideline-based escalation principles." },
      { label: "B", text: "As the very first medication for any newly diagnosed COPD patient regardless of symptom severity", correct: false, tag: null, rationale: "Initial COPD therapy choice depends on symptom burden and exacerbation risk classification — a LAMA isn't automatically the universal first choice for every newly diagnosed patient regardless of severity." },
      { label: "C", text: "Treating acute bronchospasm during a severe exacerbation as the primary rescue therapy", correct: false, tag: null, rationale: "LAMAs are maintenance medications with a longer onset of action, not the primary rescue therapy for acute bronchospasm during a severe exacerbation, which relies on short-acting bronchodilators." },
      { label: "D", text: "A treatment specific to asthma, not COPD", correct: false, tag: null, rationale: "LAMAs are a core maintenance therapy class specifically used in COPD management, not primarily an asthma-specific treatment." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "The PROSEVA trial provided key evidence supporting which specific ARDS management intervention?",
    options: [
      { label: "A", text: "Prone positioning in moderate-to-severe ARDS", correct: true, tag: null, rationale: "The PROSEVA trial demonstrated a significant mortality benefit with early, prolonged prone positioning in patients with moderate-to-severe ARDS, establishing it as a key evidence-based intervention in current management guidelines." },
      { label: "B", text: "High tidal volume ventilation", correct: false, tag: null, rationale: "PROSEVA studied prone positioning, not tidal volume strategy — the ARDSNet trial is the landmark study associated with tidal volume findings." },
      { label: "C", text: "Early tracheostomy timing", correct: false, tag: null, rationale: "PROSEVA's focus was specifically on prone positioning, not tracheostomy timing, which has been studied in separate trials." },
      { label: "D", text: "Corticosteroid dosing in ARDS", correct: false, tag: null, rationale: "PROSEVA specifically evaluated prone positioning, not corticosteroid protocols, which have been studied in other trials." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "application",
    patient: "Adult · General",
    stem: "During an interprofessional rapid response team activation for a deteriorating patient, the RT notices the patient's oxygen saturation continues to fall despite escalating oxygen therapy.",
    question: "What is the most appropriate RT action in this team-based emergency response?",
    options: [
      { label: "A", text: "Clearly communicate the ongoing desaturation trend and current oxygen therapy status to the team, and advocate for further escalation (e.g., NIV or intubation) as clinically indicated", correct: true, tag: null, rationale: "Effective interprofessional emergency response depends on clear, closed-loop communication — the RT's role includes clearly reporting respiratory status trends and advocating for appropriate escalation based on their clinical assessment, contributing their specific expertise to the team's decision-making." },
      { label: "B", text: "Continue current therapy silently without communicating the ongoing trend to the team", correct: false, tag: null, rationale: "Silent, non-communicative behavior during a team emergency response undermines effective care — clear communication of clinical findings is an essential part of the RT's role in this setting." },
      { label: "C", text: "Wait for explicit instruction before taking any independent clinical action within their scope of practice", correct: false, tag: null, rationale: "While team coordination matters, RTs have independent clinical judgment within their scope of practice and should proactively communicate concerning findings rather than waiting passively." },
      { label: "D", text: "Leave the room to attend to other patients without addressing the current emergency", correct: false, tag: null, rationale: "This would be inappropriate abandonment of an active emergency response situation requiring the RT's ongoing involvement." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "During assistance with a chest tube insertion for pneumothorax, the RT's role typically includes:",
    options: [
      { label: "A", text: "Preparing and connecting the pleural drainage system, and monitoring the patient's respiratory status and drainage system function throughout", correct: true, tag: null, rationale: "The RT commonly assists by preparing the pleural drainage/suction system, ensuring proper setup and function, and monitoring the patient's respiratory status and the drainage system (e.g., water seal, air leak, drainage amount) during and after the procedure." },
      { label: "B", text: "Performing the chest tube insertion independently without physician involvement", correct: false, tag: null, rationale: "Chest tube insertion is typically performed by a physician or other credentialed provider, with the RT playing a supportive role in equipment preparation and monitoring, depending on institutional scope of practice." },
      { label: "C", text: "No specific role related to the pleural drainage system", correct: false, tag: null, rationale: "The RT typically has a specific, active role in preparing and monitoring the pleural drainage system, not simply being uninvolved with this equipment." },
      { label: "D", text: "Only documenting vital signs before the procedure begins", correct: false, tag: null, rationale: "The RT's role extends beyond pre-procedure documentation to active assistance with the drainage system and ongoing monitoring throughout and after the procedure." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "application",
    patient: "Adult · General",
    stem: "A patient being discharged after a COPD exacerbation asks the RT what warning signs should prompt them to seek medical attention again.",
    question: "What is the most appropriate education to provide?",
    options: [
      { label: "A", text: "Specific warning signs such as increasing dyspnea beyond their baseline, change in sputum color/amount, fever, or worsening oxygen needs, along with clear instructions on who to contact and when", correct: true, tag: null, rationale: "Providing specific, actionable warning signs (rather than vague guidance) along with clear instructions on when and how to seek help empowers the patient to recognize early exacerbation signs and seek timely care, which can reduce readmission risk." },
      { label: "B", text: "Tell the patient to simply \"come back if you feel worse\" with no specific guidance", correct: false, tag: null, rationale: "Vague guidance like this is less actionable and less likely to result in timely recognition of true warning signs compared to specific, concrete education." },
      { label: "C", text: "Avoid discussing warning signs to prevent causing anxiety", correct: false, tag: null, rationale: "Withholding this important safety information isn't appropriate — clear education about warning signs is a standard, important part of safe discharge planning." },
      { label: "D", text: "Tell the patient warning signs are not relevant since they've already been treated", correct: false, tag: null, rationale: "Recognizing early warning signs of a FUTURE exacerbation remains relevant even after successful treatment of the current episode — COPD is a chronic condition with ongoing exacerbation risk." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A CT pulmonary angiogram (CTPA) report describing a \"filling defect\" in a segmental pulmonary artery is most consistent with:",
    options: [
      { label: "A", text: "Pulmonary embolism at that location", correct: true, tag: null, rationale: "A \"filling defect\" on CTPA describes an area where contrast fails to fully opacify the vessel, characteristic of a clot (embolus) obstructing that segment of the pulmonary artery — this is the classic CTPA finding used to diagnose PE." },
      { label: "B", text: "Normal pulmonary vasculature", correct: false, tag: null, rationale: "A filling defect is specifically an ABNORMAL finding on CTPA, not a normal vascular appearance." },
      { label: "C", text: "Pneumonia", correct: false, tag: null, rationale: "Pneumonia would typically show as parenchymal consolidation/infiltrate on imaging, not a vascular \"filling defect,\" which specifically describes an intraluminal vessel finding." },
      { label: "D", text: "Pleural effusion", correct: false, tag: null, rationale: "Pleural effusion is a distinct finding (fluid in the pleural space) from a vascular filling defect, which specifically indicates an intravascular obstruction." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Tracheal deviation AWAY from the affected side is most classically associated with:",
    options: [
      { label: "A", text: "Tension pneumothorax", correct: true, tag: null, rationale: "Tension pneumothorax causes progressive pressure buildup on the affected side, pushing mediastinal structures — including the trachea — toward the OPPOSITE, unaffected side, a classic and important physical exam finding in this emergency." },
      { label: "B", text: "Simple, uncomplicated pneumothorax", correct: false, tag: null, rationale: "A simple, small pneumothorax without tension physiology typically does NOT cause significant tracheal deviation — this finding is specifically associated with the pressure buildup of a TENSION pneumothorax." },
      { label: "C", text: "Normal lung anatomy", correct: false, tag: null, rationale: "Tracheal deviation is an abnormal finding, not a feature of normal anatomy." },
      { label: "D", text: "Bilateral, symmetric lung disease", correct: false, tag: null, rationale: "Tracheal deviation reflects an asymmetric process pushing the mediastinum to one side — bilateral symmetric disease wouldn't cause this unilateral shift." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A significantly elevated white blood cell count with a left shift (increased band/immature neutrophils) on a CBC most strongly suggests:",
    options: [
      { label: "A", text: "An acute bacterial infection with a robust immune response", correct: true, tag: null, rationale: "A left shift, meaning increased immature neutrophil forms (bands) released from the bone marrow, reflects the body ramping up production in response to an acute infectious/inflammatory process, classically bacterial infection." },
      { label: "B", text: "A chronic, stable condition with no active process", correct: false, tag: null, rationale: "A left shift specifically indicates an ACTIVE, acute process driving increased white cell production, not a chronic stable state." },
      { label: "C", text: "Anemia", correct: false, tag: null, rationale: "This CBC finding relates to white blood cells, not red blood cell count/hemoglobin, which is what defines anemia." },
      { label: "D", text: "A normal, expected finding requiring no clinical correlation", correct: false, tag: null, rationale: "A significant left shift is a notable finding that should be clinically correlated with the patient's presentation, not dismissed as routine." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a chest CT report describing \"honeycombing\" and \"traction bronchiectasis\" in a basal, peripheral distribution.",
    question: "This imaging pattern is most consistent with:",
    options: [
      { label: "A", text: "Usual interstitial pneumonia (UIP) pattern, commonly associated with idiopathic pulmonary fibrosis", correct: true, tag: null, rationale: "Honeycombing and traction bronchiectasis in a basal, peripheral, subpleural distribution is the classic radiographic description of a UIP pattern, strongly associated with idiopathic pulmonary fibrosis." },
      { label: "B", text: "Normal lung parenchyma", correct: false, tag: null, rationale: "Honeycombing and traction bronchiectasis are specific, abnormal fibrotic findings, not features of normal lung tissue." },
      { label: "C", text: "Acute pneumonia", correct: false, tag: null, rationale: "Acute pneumonia typically shows as consolidation/infiltrate on imaging, not the chronic fibrotic pattern of honeycombing and traction bronchiectasis." },
      { label: "D", text: "Pneumothorax", correct: false, tag: null, rationale: "Pneumothorax shows as absence of lung markings with a visible pleural line, an entirely different finding from the fibrotic pattern described here." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "application",
    patient: "Adult · General",
    stem: "A patient reports orthopnea, needing to sleep propped up on 3 pillows, along with occasional episodes of waking up suddenly gasping for air.",
    question: "These symptoms (orthopnea and paroxysmal nocturnal dyspnea) are most classically associated with:",
    options: [
      { label: "A", text: "Left-sided heart failure with pulmonary congestion", correct: true, tag: null, rationale: "Orthopnea (dyspnea when lying flat) and paroxysmal nocturnal dyspnea are classic symptoms of left-sided heart failure, where lying flat redistributes fluid and increases venous return, worsening pulmonary congestion." },
      { label: "B", text: "Simple, uncomplicated asthma", correct: false, tag: null, rationale: "While asthma can have nocturnal symptoms, orthopnea and PND specifically are more classically and strongly associated with cardiac (left heart failure) causes." },
      { label: "C", text: "Normal sleep patterns", correct: false, tag: null, rationale: "These are specific, abnormal symptoms indicating a pathologic process, not normal sleep." },
      { label: "D", text: "Peripheral neuropathy", correct: false, tag: null, rationale: "These symptoms are respiratory/cardiac in nature and unrelated to peripheral neuropathy." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "application",
    patient: "Adult · General",
    stem: "An RT is performing spirometry and notices the patient's flow-volume loop shows a plateau in both inspiratory and expiratory limbs, consistent with a fixed pattern.",
    question: "A fixed obstruction pattern on flow-volume loop, unlike a variable extrathoracic or intrathoracic pattern, is most suggestive of:",
    options: [
      { label: "A", text: "A fixed anatomical narrowing, such as tracheal stenosis, that limits flow consistently regardless of the phase of breathing", correct: true, tag: null, rationale: "A fixed obstruction (e.g., tracheal stenosis, a fixed tumor) limits airflow consistently during both inspiration and expiration, producing the characteristic plateau on both limbs of the flow-volume loop, distinct from variable patterns that change depending on intra/extrathoracic pressure dynamics during different phases of breathing." },
      { label: "B", text: "Normal airway function", correct: false, tag: null, rationale: "A fixed obstruction pattern is an abnormal finding, not a feature of normal spirometry." },
      { label: "C", text: "Simple asthma exacerbation", correct: false, tag: null, rationale: "Asthma typically shows a variable, not fixed, obstructive pattern that can fluctuate — a fixed pattern points more toward a structural, unchanging narrowing." },
      { label: "D", text: "A restrictive lung disease process", correct: false, tag: null, rationale: "Restrictive disease shows a different pattern (reduced volumes with a normal or increased FEV1/FVC ratio), not the fixed flow plateau described here, which is specifically an obstructive pattern finding." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A DLCO (diffusion capacity) test that is reduced out of proportion to lung volume reduction is most suggestive of:",
    options: [
      { label: "A", text: "A primary gas exchange/diffusion problem, such as emphysema or pulmonary vascular disease, rather than a purely restrictive process", correct: true, tag: null, rationale: "When DLCO is disproportionately reduced compared to lung volumes, it points toward a problem with the actual gas exchange surface or pulmonary vasculature (like emphysema or pulmonary vascular disease), rather than a purely restrictive process where DLCO reduction would typically be more proportional to volume loss." },
      { label: "B", text: "Normal lung function", correct: false, tag: null, rationale: "A disproportionately reduced DLCO is an abnormal finding requiring further interpretation, not a normal result." },
      { label: "C", text: "A purely obstructive pattern with normal gas exchange", correct: false, tag: null, rationale: "This describes a specific pattern where diffusion is significantly impaired — this isn't simply an obstructive pattern with intact/normal gas exchange." },
      { label: "D", text: "A technical error requiring no clinical correlation", correct: false, tag: null, rationale: "While technical factors should always be considered, this described pattern (disproportionate DLCO reduction) is a recognized, clinically meaningful finding, not automatically dismissed as error." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "A patient with longstanding COPD reports new, progressive hoarseness over several weeks, along with unintentional weight loss, without a clear infectious cause.",
    question: "What additional evaluation should the RT recommend?",
    options: [
      { label: "A", text: "Recommend further evaluation for a possible malignancy or other structural cause, given the new hoarseness and weight loss beyond the patient's usual COPD symptoms", correct: true, tag: null, rationale: "New hoarseness combined with unintentional weight loss in a patient with a significant smoking-related history (implied by COPD) are red flag symptoms that warrant evaluation for possible malignancy (e.g., lung cancer with recurrent laryngeal nerve involvement) or another structural process, not simply attributed to routine COPD progression." },
      { label: "B", text: "Recommend no further workup since these symptoms are expected with COPD", correct: false, tag: null, rationale: "New hoarseness and unintentional weight loss are NOT typical, expected COPD symptoms — they represent red flags warranting further evaluation beyond the baseline condition." },
      { label: "C", text: "Recommend increasing the patient's current COPD inhaler dose to address the new symptoms", correct: false, tag: null, rationale: "These new symptoms (hoarseness, weight loss) aren't addressed by adjusting COPD inhaler therapy — they require separate diagnostic evaluation for their underlying cause." },
      { label: "D", text: "Recommend reassurance only, with follow-up in 6 months", correct: false, tag: null, rationale: "These red flag symptoms warrant more prompt evaluation, not routine reassurance with a delayed follow-up interval." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A jet nebulizer's aerosol output and particle size are most directly influenced by:",
    options: [
      { label: "A", text: "The flow rate of gas powering the nebulizer and the specific design of the nebulizer device", correct: true, tag: null, rationale: "Jet nebulizer performance (particle size distribution, output rate) is directly influenced by the driving gas flow rate and the specific nebulizer's internal design, both of which affect the aerosol characteristics delivered to the patient." },
      { label: "B", text: "The color of the medication being nebulized", correct: false, tag: null, rationale: "Medication color has no bearing on aerosol physics or nebulizer performance characteristics." },
      { label: "C", text: "The time of day the treatment is given", correct: false, tag: null, rationale: "Time of day doesn't affect the physical aerosol generation process of a jet nebulizer." },
      { label: "D", text: "The patient's insurance coverage", correct: false, tag: null, rationale: "This is an administrative factor entirely unrelated to the physical mechanics of aerosol generation." },
    ],
  },
  {
    domain: "II",
    subdomain: "II.A — Assemble/Troubleshoot Devices",
    level: "application",
    patient: "Adult · General",
    stem: "A vibrating mesh nebulizer is producing significantly less aerosol output than expected, though the device powers on normally.",
    question: "What should the RT check first?",
    options: [
      { label: "A", text: "Whether the mesh aperture plate is clogged or damaged, and whether the medication is properly loaded in the reservoir", correct: true, tag: null, rationale: "Vibrating mesh nebulizers rely on a fine mesh with tiny apertures — clogging or damage to this mesh, or improper medication loading, are common, correctable causes of reduced aerosol output that should be checked before assuming full device failure." },
      { label: "B", text: "Assume the device is completely non-functional and discard it immediately without further troubleshooting", correct: false, tag: null, rationale: "Jumping to discarding the device skips simple troubleshooting steps (checking the mesh, medication loading) that commonly resolve output issues." },
      { label: "C", text: "Increase the medication dose significantly to compensate", correct: false, tag: null, rationale: "Increasing dose doesn't address a likely mechanical/loading issue with the device — the underlying cause should be identified and corrected first." },
      { label: "D", text: "Assume the issue is with the patient's technique, not the device", correct: false, tag: null, rationale: "The device is 'producing less aerosol output' as described — this points to an equipment-related cause to investigate first, not immediately blaming patient technique." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A supraglottic airway device (such as a laryngeal mask airway) differs from an endotracheal tube in that it:",
    options: [
      { label: "A", text: "Sits above the vocal cords rather than passing through them into the trachea, providing a less definitive but faster-to-place airway option", correct: true, tag: null, rationale: "Supraglottic devices like the LMA sit above the glottic opening rather than being inserted through the vocal cords into the trachea, making them faster and often easier to place, though they don't provide the same level of airway protection/seal as a properly placed endotracheal tube." },
      { label: "B", text: "Provides a more definitive, protected airway than an ET tube", correct: false, tag: null, rationale: "This is the opposite — an ET tube, positioned within the trachea with a cuff seal, generally provides more definitive airway protection than a supraglottic device." },
      { label: "C", text: "Is inserted directly into the trachea, similar to an ET tube", correct: false, tag: null, rationale: "Supraglottic devices specifically do NOT enter the trachea — they sit above the vocal cords, which is the key anatomical difference from an ET tube." },
      { label: "D", text: "Is used exclusively for long-term ventilation", correct: false, tag: null, rationale: "Supraglottic devices are typically used for short-term, often emergency or procedural airway management, not long-term ventilation, which typically requires an ET tube or tracheostomy." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on assist-control ventilation shows a respiratory rate significantly higher than the set backup rate, with each breath being patient-triggered, and the patient appears comfortable with no signs of distress.",
    question: "How should the RT interpret this finding?",
    options: [
      { label: "A", text: "The patient is breathing above the set rate on their own initiative, which is expected and generally acceptable behavior in assist-control mode as long as the patient remains comfortable and stable", correct: true, tag: null, rationale: "In assist-control mode, the set rate is a MINIMUM/backup rate — patients can and often do trigger additional breaths above this rate. As long as the patient appears comfortable without distress and vital signs remain stable, this is an expected feature of the mode, not necessarily a problem requiring intervention." },
      { label: "B", text: "This represents a ventilator malfunction requiring immediate replacement", correct: false, tag: null, rationale: "A rate above the set backup rate with patient-triggered breaths is a normal, expected feature of assist-control mode, not a malfunction." },
      { label: "C", text: "The set rate must be immediately increased to match the patient's spontaneous rate", correct: false, tag: null, rationale: "Since the patient appears comfortable and this is expected mode behavior, there's no immediate need to change the set rate simply because the patient is breathing above it." },
      { label: "D", text: "This indicates the patient should be immediately extubated", correct: false, tag: null, rationale: "A patient triggering breaths above the set rate comfortably doesn't automatically indicate readiness for extubation — that requires separate, specific assessment (SBT, RSBI, etc.)." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Automatic tube compensation (ATC), a feature on some ventilators, is designed to:",
    options: [
      { label: "A", text: "Compensate for the resistance imposed by the artificial airway itself, reducing the patient's work of breathing related specifically to the ET tube", correct: true, tag: null, rationale: "ATC calculates and compensates for the resistive work imposed by the endotracheal or tracheostomy tube itself, helping offset that specific component of the patient's work of breathing, which can be significant especially with smaller tube diameters." },
      { label: "B", text: "Automatically adjust the FiO2 based on oxygen saturation", correct: false, tag: null, rationale: "This describes a different feature (closed-loop oxygen titration), not ATC, which specifically addresses airway resistance compensation." },
      { label: "C", text: "Automatically extubate the patient when ready", correct: false, tag: null, rationale: "ATC doesn't perform extubation — that remains a clinical decision requiring separate assessment, not an automated ventilator function." },
      { label: "D", text: "Eliminate the need for any pressure support during weaning", correct: false, tag: null, rationale: "ATC compensates specifically for tube resistance and can be used alongside, not as a complete replacement for, other pressure support strategies during weaning." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · General",
    stem: "A patient with chronic hypoxemic respiratory failure on home oxygen has follow-up ABG results showing a stable PaO2 of 62 mmHg at their current oxygen flow.",
    question: "Given standard long-term oxygen therapy criteria, what does this finding suggest?",
    options: [
      { label: "A", text: "This PaO2 level is generally within the range supporting continued long-term oxygen therapy eligibility per standard criteria (typically PaO2 ≤ 55 mmHg, or ≤ 59 mmHg with certain comorbidities)", correct: false, tag: null, rationale: "A PaO2 of 62 mmHg is actually ABOVE the typical thresholds (≤55 or ≤59 with comorbidities) used to qualify for long-term oxygen therapy — this value would generally not meet standard LTOT criteria on its own." },
      { label: "B", text: "This PaO2 value is above the typical threshold used to qualify for standard long-term oxygen therapy, so continued need should be reassessed with the physician", correct: true, tag: null, rationale: "Standard LTOT qualifying criteria generally require a PaO2 ≤55 mmHg (or ≤59 mmHg with certain comorbidities like cor pulmonale) — a stable PaO2 of 62 mmHg is above this threshold, meaning reassessment of the patient's continued oxygen therapy need and criteria may be warranted with the physician." },
      { label: "C", text: "This finding has no relevance to oxygen therapy decisions", correct: false, tag: null, rationale: "PaO2 values are directly relevant to LTOT eligibility criteria and should inform ongoing oxygen therapy decisions." },
      { label: "D", text: "This value indicates the patient needs significantly MORE oxygen immediately", correct: false, tag: null, rationale: "A PaO2 of 62 mmHg is a reasonably adequate value, not one indicating an urgent need for significantly increased oxygen therapy." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A recommendation to add a leukotriene receptor antagonist (e.g., montelukast) to an asthma patient's regimen would typically be considered:",
    options: [
      { label: "A", text: "As an alternative or add-on controller option, particularly useful in patients with an allergic/exercise-induced component or aspirin-sensitive asthma", correct: true, tag: null, rationale: "Leukotriene receptor antagonists serve as an alternative or add-on maintenance option in asthma management, with particular utility in patients with allergic rhinitis overlap, exercise-induced symptoms, or aspirin-exacerbated respiratory disease." },
      { label: "B", text: "As the definitive first-line rescue medication for acute asthma attacks", correct: false, tag: null, rationale: "Leukotriene receptor antagonists are maintenance/controller medications, not fast-acting rescue therapy for acute attacks, which requires short-acting bronchodilators." },
      { label: "C", text: "As a medication with no role in asthma management", correct: false, tag: null, rationale: "Leukotriene receptor antagonists do have an established, if more limited compared to ICS, role as an alternative/add-on controller option in asthma management." },
      { label: "D", text: "As a treatment specific to COPD, not asthma", correct: false, tag: null, rationale: "Leukotriene receptor antagonists are specifically an asthma management medication, not a primary COPD treatment." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.F — Evidence-Based Practice",
    level: "application",
    patient: "Adult · General",
    stem: "A hospital is updating its sepsis management protocol based on current Surviving Sepsis Campaign guidelines.",
    question: "Which of the following reflects a core, evidence-based recommendation from these guidelines?",
    options: [
      { label: "A", text: "Prompt recognition, early broad-spectrum antibiotics, and appropriate fluid resuscitation, ideally initiated within the first hour of sepsis recognition", correct: true, tag: null, rationale: "The Surviving Sepsis Campaign guidelines emphasize the importance of rapid recognition and early intervention — prompt antibiotics and fluid resuscitation within the so-called \"golden hour\" are core, evidence-based recommendations shown to improve sepsis outcomes." },
      { label: "B", text: "Delaying antibiotic administration until definitive culture results are available", correct: false, tag: null, rationale: "This is the OPPOSITE of the evidence-based recommendation — antibiotics should be started promptly based on clinical suspicion, not delayed for culture confirmation, given the time-sensitive nature of sepsis." },
      { label: "C", text: "Avoiding fluid resuscitation entirely in septic patients", correct: false, tag: null, rationale: "Appropriate fluid resuscitation is a core component of early sepsis management per current guidelines, not something to avoid." },
      { label: "D", text: "Waiting 24 hours before initiating any treatment to observe the patient's natural course", correct: false, tag: null, rationale: "This directly contradicts the evidence-based emphasis on prompt, early intervention in sepsis management, where delays are associated with worse outcomes." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "During an emergency airway management situation with a known or suspected difficult airway, having a structured difficult airway algorithm/protocol readily available primarily helps by:",
    options: [
      { label: "A", text: "Providing a clear, pre-established sequence of escalating interventions, reducing decision paralysis and improving team coordination during a high-stress emergency", correct: true, tag: null, rationale: "Structured difficult airway algorithms provide teams with a clear, practiced sequence of steps to follow, which reduces cognitive load and decision-making delays during the high-stress, time-critical nature of a difficult airway emergency, improving coordination and outcomes." },
      { label: "B", text: "Eliminating the need for any equipment preparation", correct: false, tag: null, rationale: "An algorithm doesn't eliminate the need for having appropriate equipment ready — it guides the sequence of actions, but preparation remains essential." },
      { label: "C", text: "Guaranteeing successful intubation on the first attempt", correct: false, tag: null, rationale: "An algorithm improves structured decision-making but doesn't guarantee first-attempt success — it helps guide the team through escalating options if initial attempts are unsuccessful." },
      { label: "D", text: "Replacing the need for a skilled, experienced airway operator", correct: false, tag: null, rationale: "An algorithm supports but doesn't replace the need for skilled personnel — it's a decision-support tool used alongside clinical expertise, not instead of it." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.H — Assist with Physician Procedures",
    level: "application",
    patient: "Adult · General",
    stem: "The RT is assisting with an elective cardioversion procedure for a patient with atrial fibrillation, under moderate sedation.",
    question: "What is an important RT responsibility during this procedure?",
    options: [
      { label: "A", text: "Ensuring the patient is adequately preoxygenated, monitoring oxygenation and ventilation continuously throughout the sedation, and being prepared to support the airway if needed", correct: true, tag: null, rationale: "As with other moderate sedation procedures, ensuring adequate preoxygenation and continuous respiratory monitoring throughout is a key RT responsibility, given the respiratory depression risk associated with sedation — being prepared to intervene if the patient's airway or ventilation is compromised is essential." },
      { label: "B", text: "Operating the cardioversion defibrillator controls independently", correct: false, tag: null, rationale: "Operating the cardioversion device itself is typically the responsibility of the physician/credentialed provider performing the procedure, not the RT, whose focus is on respiratory monitoring and support." },
      { label: "C", text: "No specific respiratory monitoring responsibility during this cardiac procedure", correct: false, tag: null, rationale: "Despite being a cardiac procedure, the sedation involved carries real respiratory risk, making RT monitoring an important, active responsibility, not something to overlook." },
      { label: "D", text: "Only documenting the cardiac rhythm before and after the procedure", correct: false, tag: null, rationale: "While rhythm documentation may occur, the RT's core responsibility centers on respiratory monitoring and airway readiness given the sedation risk, not primarily cardiac rhythm documentation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "When educating a patient on proper dry powder inhaler (DPI) technique, which instruction is most important?",
    options: [
      { label: "A", text: "Inhale quickly and forcefully to ensure adequate medication dispersal, unlike the slow inhalation technique used with an MDI", correct: true, tag: null, rationale: "Unlike MDIs, which require slow inhalation, DPIs rely on the patient's own inspiratory effort to disperse and aerosolize the powder medication, making a quick, forceful inhalation the correct technique — this is a key, often confusing distinction for patients switching between device types." },
      { label: "B", text: "Inhale slowly and gently, the same technique used for an MDI", correct: false, tag: null, rationale: "This is incorrect for a DPI — slow, gentle inhalation is the MDI technique; DPIs specifically require a quick, forceful inhalation to properly disperse the powder." },
      { label: "C", text: "Always use a spacer device with a DPI", correct: false, tag: null, rationale: "Spacers are used with MDIs, not DPIs — a DPI's design doesn't accommodate or require a spacer device." },
      { label: "D", text: "Exhale fully into the device before inhaling the medication", correct: false, tag: null, rationale: "Exhaling into a DPI risks introducing moisture that can clump the powder medication — patients should exhale away from the device before inhaling the dose." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient on mechanical ventilation shows worsening oxygenation despite increasing FiO2 to 100%, with the PaO2 remaining persistently low.",
    question: "This pattern of failing to improve despite maximal FiO2 is most suggestive of:",
    options: [
      { label: "A", text: "A significant intrapulmonary shunt, where blood bypasses ventilated alveoli entirely, making it unresponsive to increased inspired oxygen concentration", correct: true, tag: null, rationale: "When oxygenation fails to improve despite maximal FiO2, this classically indicates a large shunt (blood passing through unventilated/collapsed alveoli or an anatomical shunt) rather than a simple V/Q mismatch or diffusion problem, both of which typically show at least some improvement with increased FiO2." },
      { label: "B", text: "Simple hypoventilation as the primary problem", correct: false, tag: null, rationale: "Hypoventilation-related hypoxemia typically responds well to increased FiO2 — the failure to improve despite maximal oxygen points away from simple hypoventilation as the primary mechanism." },
      { label: "C", text: "A normal, expected response to ventilator therapy", correct: false, tag: null, rationale: "Failing to improve oxygenation despite maximal FiO2 is a significant, abnormal finding requiring urgent attention, not an expected therapeutic response." },
      { label: "D", text: "Excessive oxygen delivery requiring immediate FiO2 reduction", correct: false, tag: null, rationale: "The problem described is inadequate, not excessive, oxygenation — reducing FiO2 would worsen, not improve, this patient's hypoxemia." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "application",
    patient: "Adult · General",
    stem: "A 6-minute walk test shows the patient desaturated from 96% to 84% with exertion, accompanied by significant dyspnea, though they completed the full distance expected for their age.",
    question: "How should this result be interpreted?",
    options: [
      { label: "A", text: "Significant exercise-induced desaturation, which is a clinically meaningful finding independent of the distance walked, and may support a need for supplemental oxygen with activity", correct: true, tag: null, rationale: "A desaturation this significant (96% to 84%) during exertion is clinically important regardless of whether the expected distance was achieved — it identifies a specific physiologic problem (exercise-induced hypoxemia) that may warrant ambulatory oxygen therapy, independent of the distance-based performance metric." },
      { label: "B", text: "A fully normal test result since the expected distance was completed", correct: false, tag: null, rationale: "Completing the expected distance doesn't offset the clinically significant desaturation that occurred — both distance AND oxygenation during the test are important, separate pieces of information." },
      { label: "C", text: "This desaturation is irrelevant since it only occurred with exertion, not at rest", correct: false, tag: null, rationale: "Exercise-induced desaturation is specifically relevant for functional and oxygen therapy assessment, particularly since many patients' significant activities involve some exertion — this shouldn't be dismissed as irrelevant." },
      { label: "D", text: "The test should be disregarded entirely due to the desaturation", correct: false, tag: null, rationale: "The desaturation is a valid, important finding FROM the test, not a reason to disregard the test results altogether." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Neonatal · General",
    stem: "A premature infant on caffeine therapy for apnea of prematurity is noted to have a heart rate consistently above 200 bpm and appears jittery.",
    question: "What should the RT recommend?",
    options: [
      { label: "A", text: "Recommend reassessing the caffeine dose for possible toxicity, given the tachycardia and jitteriness, which can be signs of excessive caffeine levels", correct: true, tag: null, rationale: "Significant tachycardia and jitteriness in an infant on caffeine therapy can be signs of caffeine toxicity — this should prompt dose reassessment (and possibly a caffeine level check) rather than continuing the current dose unchanged." },
      { label: "B", text: "Recommend increasing the caffeine dose further to improve apnea control", correct: false, tag: null, rationale: "Given signs suggestive of possible toxicity (tachycardia, jitteriness), increasing the dose further would be inappropriate and could worsen these adverse effects." },
      { label: "C", text: "Recommend no changes since these findings are unrelated to caffeine therapy", correct: false, tag: null, rationale: "Tachycardia and jitteriness are recognized potential adverse effects of caffeine therapy and shouldn't be dismissed as unrelated without consideration." },
      { label: "D", text: "Recommend immediately and permanently discontinuing all apnea management", correct: false, tag: null, rationale: "The appropriate step is reassessing the caffeine dose specifically, not abandoning apnea management altogether — the infant still needs appropriate treatment for apnea of prematurity, just potentially at an adjusted dose." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "An elevated anion gap on a metabolic panel is most useful for narrowing the differential diagnosis of:",
    options: [
      { label: "A", text: "Metabolic acidosis, helping distinguish causes associated with unmeasured anions (e.g., lactic acidosis, ketoacidosis, toxic ingestions) from non-gap causes", correct: true, tag: null, rationale: "The anion gap helps categorize metabolic acidosis into high-gap (from accumulation of unmeasured anions like lactate or ketones) versus normal-gap causes, meaningfully narrowing the differential and guiding further workup." },
      { label: "B", text: "Respiratory alkalosis exclusively", correct: false, tag: null, rationale: "The anion gap is specifically a tool for characterizing metabolic acidosis, not respiratory alkalosis, which is assessed through PaCO2 and pH trends instead." },
      { label: "C", text: "Lung volume measurement", correct: false, tag: null, rationale: "The anion gap is a metabolic/chemistry panel calculation, entirely unrelated to lung volume assessment." },
      { label: "D", text: "Oxygenation status directly", correct: false, tag: null, rationale: "The anion gap doesn't directly reflect oxygenation status — that's assessed via ABG PaO2 or pulse oximetry." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.A — Evaluate Data in the Patient Record",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's chart shows a therapeutic INR of 2.5 while on warfarin for a prior pulmonary embolism, with no new bleeding or clotting symptoms.",
    question: "This finding should be interpreted as:",
    options: [
      { label: "A", text: "Appropriate anticoagulation control within the target therapeutic range for this indication", correct: true, tag: null, rationale: "An INR of 2.5 falls within the typical therapeutic target range (2-3) for warfarin anticoagulation following a PE, indicating the medication is appropriately dosed and controlled, not requiring adjustment based on this value alone." },
      { label: "B", text: "Dangerously low anticoagulation requiring an urgent dose increase", correct: false, tag: null, rationale: "An INR of 2.5 is within, not below, the typical therapeutic target range for this indication — it doesn't indicate under-anticoagulation requiring urgent adjustment." },
      { label: "C", text: "Dangerously high anticoagulation requiring immediate reversal", correct: false, tag: null, rationale: "This value is within the normal therapeutic target, not an excessively high, dangerous level requiring reversal." },
      { label: "D", text: "A finding with no relevance to the patient's respiratory history", correct: false, tag: null, rationale: "Given the patient's PE history, their anticoagulation status is directly relevant to their ongoing respiratory/vascular care, not irrelevant." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.B — Perform Clinical Assessment",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "The tripod position (leaning forward, hands on knees) commonly assumed by patients in respiratory distress helps by:",
    options: [
      { label: "A", text: "Optimizing accessory muscle mechanics and improving diaphragmatic efficiency by fixing the shoulder girdle", correct: true, tag: null, rationale: "The tripod position fixes the shoulder girdle in place, allowing accessory muscles (like the pectoralis) to assist respiration more effectively, while also optimizing the length-tension relationship of the diaphragm, together reducing the work of breathing during distress." },
      { label: "B", text: "Directly increasing oxygen saturation through the position alone", correct: false, tag: null, rationale: "The tripod position helps mechanically ease the work of breathing, but doesn't directly increase oxygen saturation on its own — any resulting improvement is secondary to reduced respiratory effort." },
      { label: "C", text: "Being a purely voluntary, non-physiological behavior with no mechanical benefit", correct: false, tag: null, rationale: "This position has a real, recognized mechanical benefit for accessory muscle use and diaphragmatic function — it's not simply arbitrary or without physiological basis." },
      { label: "D", text: "Worsening the work of breathing in most patients", correct: false, tag: null, rationale: "This is the opposite of the tripod position's actual effect — it typically helps EASE, not worsen, the work of breathing in respiratory distress." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.C — Perform Procedures to Gather Clinical Information",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Maximum expiratory pressure (MEP) testing is primarily used to assess:",
    options: [
      { label: "A", text: "Expiratory muscle strength, which is relevant for evaluating cough effectiveness and airway clearance ability", correct: true, tag: null, rationale: "MEP specifically measures the strength of expiratory muscles, which is clinically relevant for assessing a patient's ability to generate an effective cough and clear secretions, complementing MIP, which assesses inspiratory muscle strength." },
      { label: "B", text: "Inspiratory muscle strength exclusively", correct: false, tag: null, rationale: "This describes MIP (maximum inspiratory pressure), not MEP, which specifically assesses expiratory, not inspiratory, muscle strength." },
      { label: "C", text: "Lung diffusion capacity", correct: false, tag: null, rationale: "Diffusion capacity is assessed via DLCO testing, unrelated to MEP, which measures expiratory muscle strength/pressure generation." },
      { label: "D", text: "Airway resistance", correct: false, tag: null, rationale: "MEP measures muscle-generated pressure, not airway resistance, which is assessed through different pulmonary function parameters." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's pulmonary function test shows both a reduced FEV1/FVC ratio AND reduced total lung capacity on plethysmography.",
    question: "This combination of findings suggests:",
    options: [
      { label: "A", text: "A mixed obstructive-restrictive ventilatory defect, which can occur when both processes coexist", correct: true, tag: null, rationale: "A reduced FEV1/FVC ratio typically indicates obstruction, while a reduced TLC indicates restriction — when both are present together, this suggests a mixed defect, where both obstructive and restrictive processes are contributing simultaneously, sometimes seen in combined conditions or advanced disease." },
      { label: "B", text: "A purely obstructive pattern with no restrictive component", correct: false, tag: null, rationale: "A purely obstructive pattern would typically show normal or even elevated TLC (from hyperinflation), not a REDUCED TLC as described here — the reduced TLC points toward an additional restrictive component." },
      { label: "C", text: "A purely restrictive pattern with no obstructive component", correct: false, tag: null, rationale: "A purely restrictive pattern would typically show a preserved or elevated FEV1/FVC ratio, not a REDUCED ratio as described — the reduced ratio points toward an additional obstructive component." },
      { label: "D", text: "Completely normal lung function", correct: false, tag: null, rationale: "Both findings described are abnormal — a reduced ratio and reduced TLC together indicate a real, mixed ventilatory defect, not normal function." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.D — Evaluate Procedure Results",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A reduced DLCO (diffusion capacity) out of proportion to lung volume reduction is most classically associated with:",
    options: [
      { label: "A", text: "A primary gas exchange/diffusion problem, such as emphysema or pulmonary vascular disease, rather than a purely restrictive process", correct: true, tag: null, rationale: "When DLCO is reduced MORE than would be expected from lung volume changes alone, this points toward a specific problem with the gas exchange surface or pulmonary vasculature itself (like emphysema's alveolar destruction or pulmonary vascular disease), rather than simple volume restriction, which would show proportional DLCO reduction." },
      { label: "B", text: "Simple restrictive lung disease with proportionally reduced everything", correct: false, tag: null, rationale: "In simple restrictive disease, DLCO reduction is typically proportional to volume loss — a DISPROPORTIONATE DLCO reduction points toward a distinct gas exchange/vascular problem instead." },
      { label: "C", text: "Normal lung function", correct: false, tag: null, rationale: "A disproportionately reduced DLCO is an abnormal finding requiring further evaluation, not a normal result." },
      { label: "D", text: "Upper airway obstruction exclusively", correct: false, tag: null, rationale: "DLCO reflects gas exchange at the alveolar-capillary level, not upper airway function — this finding doesn't specifically indicate upper airway obstruction." },
    ],
  },
  {
    domain: "I",
    subdomain: "I.E — Recommend Diagnostic Procedures",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Exercise-induced bronchoconstriction (EIB) is most appropriately confirmed diagnostically through:",
    options: [
      { label: "A", text: "Pre- and post-exercise spirometry, looking for a significant FEV1 decline after a standardized exercise challenge", correct: true, tag: null, rationale: "EIB is confirmed by comparing spirometry before and after a standardized exercise challenge — a significant FEV1 drop (typically ≥10-15%) after exercise supports the diagnosis, distinguishing it from other causes of exertional symptoms." },
      { label: "B", text: "A single resting spirometry test with no exercise component", correct: false, tag: null, rationale: "Resting spirometry alone often appears normal in EIB — the diagnostic test specifically requires an exercise challenge component to provoke and detect the bronchoconstriction." },
      { label: "C", text: "Chest X-ray alone", correct: false, tag: null, rationale: "Chest X-ray doesn't assess dynamic airway function and isn't the diagnostic tool for EIB, which requires functional testing (spirometry) around an exercise challenge." },
      { label: "D", text: "Blood culture", correct: false, tag: null, rationale: "Blood culture assesses for bloodstream infection, entirely unrelated to diagnosing exercise-induced bronchoconstriction." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "An intubated patient's ET tube position is typically confirmed on chest X-ray to be appropriately positioned when the tube tip is located:",
    options: [
      { label: "A", text: "Approximately 3-5 cm above the carina", correct: true, tag: null, rationale: "This positioning provides an adequate margin to avoid mainstem intubation (if the tube advances) while keeping the tube well within the trachea (if it retracts slightly), accounting for normal head/neck movement after placement." },
      { label: "B", text: "Directly at the level of the vocal cords", correct: false, tag: null, rationale: "This is too shallow a position and risks accidental extubation with any patient movement — the tube needs to be positioned well below the cords, in the mid-trachea." },
      { label: "C", text: "Directly at the carina itself", correct: false, tag: null, rationale: "Positioning directly at the carina risks the tube slipping into a mainstem bronchus with any patient movement — a margin above the carina is needed." },
      { label: "D", text: "Within the right or left mainstem bronchus", correct: false, tag: null, rationale: "Mainstem bronchus placement is actually a malposition (typically right mainstem) that needs to be corrected, not the target position for a properly placed ET tube." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.A — Maintain a Patent Airway",
    level: "application",
    patient: "Adult · General",
    stem: "A patient with a fresh tracheostomy (placed 2 days ago) has an accidental decannulation, with the tube coming completely out.",
    question: "What is the most appropriate immediate action?",
    options: [
      { label: "A", text: "Attempt to reinsert a same-size or smaller tracheostomy tube promptly, using appropriate technique, while being prepared for alternative airway management if reinsertion is difficult given the immature tract", correct: true, tag: null, rationale: "A fresh (under about 7-10 days old) tracheostomy tract is not yet mature and can be difficult to safely re-cannulate blindly — prompt, careful reinsertion should be attempted, but the team must be prepared to pursue an alternative airway (such as oral intubation) if reinsertion proves difficult, given the risk of creating a false passage in an immature tract." },
      { label: "B", text: "Wait several hours before attempting any airway intervention", correct: false, tag: null, rationale: "This is an emergency requiring prompt action to secure the airway — waiting hours risks significant patient harm from inadequate ventilation." },
      { label: "C", text: "Assume the tract is always easily and safely re-cannulated regardless of how fresh it is", correct: false, tag: null, rationale: "A fresh, immature tracheostomy tract carries real risk of false passage creation during blind reinsertion attempts — this risk should be recognized, not dismissed." },
      { label: "D", text: "Only attempt oral intubation, with no consideration of tracheostomy reinsertion", correct: false, tag: null, rationale: "Prompt tracheostomy tube reinsertion is often the appropriate first attempt, with oral intubation as a backup if that's unsuccessful or difficult — not necessarily the only approach from the start." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · General",
    stem: "A patient on mechanical ventilation shows a sudden increase in peak pressure with an unchanged plateau pressure, along with new visible secretions in the ET tube and coarse breath sounds on auscultation.",
    question: "What is the most appropriate immediate action?",
    options: [
      { label: "A", text: "Perform suctioning to clear the secretions, which are the most likely cause of the increased resistance reflected by the isolated peak pressure rise", correct: true, tag: null, rationale: "A rising peak pressure with unchanged plateau pressure isolates the problem to increased airway resistance, and the combination with visible secretions and coarse breath sounds strongly points to secretions as the cause — suctioning directly addresses this likely etiology." },
      { label: "B", text: "Increase PEEP significantly without addressing the secretions", correct: false, tag: null, rationale: "Increasing PEEP doesn't address a resistance problem from secretions — this wouldn't resolve the underlying cause identified by the clinical findings." },
      { label: "C", text: "Assume this represents a pneumothorax and prepare for needle decompression", correct: false, tag: null, rationale: "A pneumothorax would typically show a RISE in both peak AND plateau pressure together (a compliance problem), not this isolated peak pressure pattern with visible secretions pointing to a resistance cause instead." },
      { label: "D", text: "Take no action since this is an expected, benign finding", correct: false, tag: null, rationale: "This is a correctable problem (secretions) that should be addressed, not dismissed as benign and requiring no action." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "Adaptive support ventilation (ASV) is a closed-loop ventilation mode that primarily:",
    options: [
      { label: "A", text: "Automatically adjusts respiratory rate and tidal volume/pressure based on the patient's mechanics to target a minimal work-of-breathing pattern, guided by pre-set target minute ventilation", correct: true, tag: null, rationale: "ASV uses a closed-loop algorithm that continuously adjusts rate and tidal volume/pressure settings based on measured respiratory system mechanics, aiming to deliver a target minute ventilation using the combination of settings calculated to minimize the patient's work of breathing." },
      { label: "B", text: "Requires manual adjustment of every parameter by the clinician for every breath", correct: false, tag: null, rationale: "This is the opposite of ASV's closed-loop design, which specifically automates rate/volume adjustments rather than requiring manual breath-by-breath clinician input." },
      { label: "C", text: "Is only usable in pediatric patients", correct: false, tag: null, rationale: "ASV is used across various patient populations meeting appropriate clinical criteria, not exclusively in pediatrics." },
      { label: "D", text: "Eliminates the need for any clinician oversight of ventilator settings", correct: false, tag: null, rationale: "While ASV automates certain adjustments, ongoing clinician oversight and appropriate initial parameter setting remain essential — it doesn't eliminate the need for clinical monitoring." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A patient's ventilator graphics show a pressure-volume loop with a visible \"beak\" or flattening at the upper portion, suggesting the tidal volume is approaching the upper inflection point of the curve.",
    question: "What does this finding suggest, and what should be considered?",
    options: [
      { label: "A", text: "The current tidal volume may be causing overdistension of already-recruited alveoli, and reducing tidal volume should be considered to avoid this", correct: true, tag: null, rationale: "A beaking pattern at the upper portion of the pressure-volume loop suggests the lung is reaching a point of overdistension at the current tidal volume — recognizing this pattern and considering a tidal volume reduction helps avoid contributing to ventilator-induced lung injury from overdistension." },
      { label: "B", text: "This indicates the tidal volume should be increased further", correct: false, tag: null, rationale: "Increasing tidal volume further when overdistension is already suggested by the beaking pattern would worsen, not improve, the risk of lung injury." },
      { label: "C", text: "This is a normal finding requiring no consideration of adjustment", correct: false, tag: null, rationale: "This waveform pattern is a recognized sign worth considering for tidal volume adjustment, not something to dismiss as an unremarkable normal finding." },
      { label: "D", text: "This finding is unrelated to lung mechanics", correct: false, tag: null, rationale: "This is specifically a lung mechanics-related finding on the pressure-volume relationship, directly relevant to ventilator management decisions." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on long-term oxygen therapy for COPD has follow-up ABG results showing PaO2 consistently around 62 mmHg on room air at rest, with no other significant findings.",
    question: "Based on standard long-term oxygen therapy criteria, what does this finding suggest?",
    options: [
      { label: "A", text: "This PaO2 level is above the typical qualifying threshold for standard long-term oxygen therapy criteria, warranting reassessment of ongoing need absent other qualifying factors", correct: true, tag: null, rationale: "Standard LTOT qualifying criteria are generally PaO2 ≤55 mmHg, or ≤59 mmHg with certain comorbidities like cor pulmonale or polycythemia — a PaO2 of 62 mmHg is above these thresholds, which should prompt reassessment of whether continued LTOT is still indicated, absent other specific qualifying factors." },
      { label: "B", text: "This finding automatically disqualifies the patient from ever using oxygen again under any circumstance", correct: false, tag: null, rationale: "This is an overstatement — reassessment for continued LTOT eligibility doesn't mean oxygen could never be used again under different circumstances (e.g., with exertion, illness, or if resting PaO2 changes later)." },
      { label: "C", text: "This finding has no bearing on LTOT eligibility assessment", correct: false, tag: null, rationale: "This finding is directly relevant to LTOT eligibility criteria, which are specifically based on PaO2 thresholds like this one." },
      { label: "D", text: "This finding indicates the need to increase, not reassess, the oxygen prescription", correct: false, tag: null, rationale: "A PaO2 this level, above typical qualifying thresholds, doesn't support increasing therapy — if anything, it prompts reassessment of continued need." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "A recommendation to add a leukotriene receptor antagonist (e.g., montelukast) to an asthma regimen would most typically be considered:",
    options: [
      { label: "A", text: "As an alternative or add-on controller option, particularly useful in patients with concurrent allergic rhinitis or aspirin-sensitive asthma", correct: true, tag: null, rationale: "Leukotriene receptor antagonists serve as an alternative or adjunct controller therapy option in asthma management, with particular usefulness in patients who also have allergic rhinitis or aspirin-exacerbated respiratory disease, given the leukotriene pathway's relevance in those conditions." },
      { label: "B", text: "As the universal first-line therapy for all asthma severities", correct: false, tag: null, rationale: "Inhaled corticosteroids remain the primary first-line controller therapy for persistent asthma — leukotriene antagonists are more typically an alternative or add-on option, not the universal first choice." },
      { label: "C", text: "As a rescue medication for acute bronchospasm", correct: false, tag: null, rationale: "Leukotriene receptor antagonists are maintenance/controller medications, not rescue therapy for acute bronchospasm, which requires fast-acting bronchodilators." },
      { label: "D", text: "Only for use in adult patients, never in pediatric asthma", correct: false, tag: null, rationale: "Leukotriene receptor antagonists are used in appropriate pediatric asthma patients as well, not restricted exclusively to adults." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.E — Modify the Respiratory Care Plan",
    level: "application",
    patient: "Adult · ARDS",
    stem: "A patient with ARDS on mechanical ventilation shows persistent hypoxemia (PaO2/FiO2 of 90) despite optimized lung-protective ventilation and proning, and the team is discussing corticosteroid therapy.",
    question: "What reflects a core, evidence-based consideration regarding corticosteroid use in this scenario?",
    options: [
      { label: "A", text: "Corticosteroids may be considered in appropriate ARDS patients per evolving evidence and guidelines, though the specific timing, dose, and patient selection require careful clinical judgment alongside other management strategies", correct: true, tag: null, rationale: "Evidence and guidelines regarding corticosteroid use in ARDS have evolved over time, with some studies showing benefit in certain populations — however, this requires careful patient selection and isn't a universal, one-size-fits-all recommendation independent of clinical judgment and other concurrent management." },
      { label: "B", text: "Corticosteroids are absolutely contraindicated in all ARDS patients under any circumstance", correct: false, tag: null, rationale: "This is an overly absolute statement — corticosteroids are considered in appropriate ARDS patients per evolving evidence, not universally contraindicated in every case." },
      { label: "C", text: "Corticosteroids should replace lung-protective ventilation and proning as the primary management strategy", correct: false, tag: null, rationale: "Corticosteroids, when used, are considered as part of a broader management strategy alongside, not as a replacement for, established lung-protective ventilation and proning strategies." },
      { label: "D", text: "There is no evidence base at all regarding corticosteroid use in ARDS", correct: false, tag: null, rationale: "This is inaccurate — there is a real, evolving evidence base regarding corticosteroid use in ARDS, even though it continues to be an area of clinical nuance and ongoing study." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.G — High-Risk Situations",
    level: "application",
    patient: "Adult · General",
    stem: "During an emergency airway management situation, the anesthesia and RT team recognize signs suggesting a potentially difficult airway (limited mouth opening, short neck) before attempting intubation.",
    question: "What is an important RT responsibility in this scenario?",
    options: [
      { label: "A", text: "Ensure difficult airway equipment (e.g., video laryngoscope, various sized airways, surgical airway equipment) is immediately available, and communicate proactively with the team about the anticipated difficulty", correct: true, tag: null, rationale: "Recognizing a potentially difficult airway in advance allows the team to prepare appropriate specialized equipment and communicate a clear plan before attempting intubation, rather than being caught unprepared mid-procedure if standard technique proves difficult — this proactive preparation is a key safety responsibility." },
      { label: "B", text: "Proceed with standard intubation equipment only, with no special preparation", correct: false, tag: null, rationale: "When difficulty is anticipated in advance, proceeding with only standard equipment and no additional preparation misses an opportunity to improve safety and readiness for a challenging airway." },
      { label: "C", text: "Assume the difficult airway signs are not clinically significant and require no advance preparation", correct: false, tag: null, rationale: "Physical exam findings suggesting a difficult airway are clinically significant predictors that should prompt proactive preparation, not be dismissed as insignificant." },
      { label: "D", text: "Wait until intubation has already failed before considering additional equipment", correct: false, tag: null, rationale: "Waiting until after a failed attempt to prepare additional equipment loses valuable time in a situation where advance preparation was possible — proactive readiness is the safer approach when difficulty is anticipated." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.I — Patient and Family Education",
    level: "recall",
    patient: "Adult · General",
    stem: null,
    question: "When educating a patient on proper dry powder inhaler (DPI) technique, which instruction is most important, given how DPIs differ mechanically from MDIs?",
    options: [
      { label: "A", text: "Inhale forcefully and deeply, since DPIs rely on the patient's own inspiratory effort to aerosolize and deliver the powder medication, unlike MDIs which propel the dose regardless of inhalation force", correct: true, tag: null, rationale: "Unlike MDIs, which release medication via propellant regardless of how the patient breathes, DPIs specifically require a forceful, deep inhalation to create enough airflow to break up and aerosolize the powder for effective lung deposition — this is the key technique difference patients need to understand." },
      { label: "B", text: "Inhale slowly and gently, the same technique used for MDIs", correct: false, tag: null, rationale: "This is actually the OPPOSITE of correct DPI technique — DPIs require forceful inhalation, unlike the slow, steady inhalation technique often taught for MDIs." },
      { label: "C", text: "A spacer is always required for DPI use, just like some MDIs", correct: false, tag: null, rationale: "Spacers are designed for use with MDIs, not DPIs, which have a fundamentally different delivery mechanism relying on the patient's own inspiratory airflow." },
      { label: "D", text: "Technique doesn't matter for DPIs since they work automatically regardless of inhalation", correct: false, tag: null, rationale: "This is inaccurate — DPI effectiveness is highly dependent on proper technique, specifically a forceful inhalation, unlike a propellant-driven MDI." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "analysis",
    patient: "Adult · ARDS",
    stem: "A patient with severe ARDS on mechanical ventilation with FiO2 at 100% and optimized PEEP continues to show minimal improvement in oxygenation despite these maximal conventional settings over several hours.",
    question: "This pattern of failing to improve despite maximal FiO2 is most suggestive of:",
    options: [
      { label: "A", text: "A significant intrapulmonary shunt, where blood is passing through unventilated (collapsed or fluid-filled) alveoli, which increasing FiO2 alone cannot correct", correct: true, tag: null, rationale: "When oxygenation fails to improve significantly even at 100% FiO2, this is a hallmark of true shunt physiology (blood bypassing ventilated alveoli entirely) rather than a simple V/Q mismatch or diffusion problem, since shunted blood never contacts the higher FiO2 gas to begin with — this specifically points toward needing strategies that address lung recruitment (like PEEP optimization, proning) rather than further FiO2 escalation, which is already maximized." },
      { label: "B", text: "A simple diffusion limitation that will resolve with more time on the current settings alone", correct: false, tag: null, rationale: "The described pattern (no improvement despite maximal FiO2) is the classic signature of true shunt, not a diffusion limitation, which would typically show at least some improvement with increased FiO2." },
      { label: "C", text: "Normal expected ARDS physiology requiring no further intervention", correct: false, tag: null, rationale: "This pattern of failure to improve at maximal settings is a significant, actionable finding requiring further intervention (like recruitment strategies), not something to accept as an unremarkable expected course." },
      { label: "D", text: "An indication to further increase FiO2 beyond 100%, which isn't physically possible but reflects the correct direction of the fix", correct: false, tag: null, rationale: "FiO2 is already maximized at 100% — the shunt physiology described specifically means further oxygen concentration increases (which aren't even possible beyond 100%) won't help; the solution lies in addressing the shunt itself through recruitment strategies." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "recall",
    patient: "Neonatal · General",
    stem: null,
    question: "High-frequency oscillatory ventilation (HFOV) achieves gas exchange primarily through mechanisms that differ from conventional ventilation, including:",
    options: [
      { label: "A", text: "Very small tidal volumes (often less than anatomic dead space) delivered at very high rates, using mechanisms like augmented diffusion and pendelluft rather than simple bulk gas movement", correct: true, tag: null, rationale: "HFOV uses tiny tidal volumes delivered extremely rapidly, relying on complex, non-conventional gas transport mechanisms (augmented diffusion, pendelluft, Taylor dispersion) rather than the simple bulk convective gas movement seen in conventional ventilation with larger tidal volumes." },
      { label: "B", text: "The exact same gas exchange mechanisms as conventional ventilation, just at a different rate", correct: false, tag: null, rationale: "HFOV's gas exchange mechanisms are fundamentally different from conventional ventilation's bulk convective flow, given tidal volumes often smaller than anatomic dead space — this isn't simply the same mechanism at a different speed." },
      { label: "C", text: "Large tidal volumes delivered slowly", correct: false, tag: null, rationale: "This describes conventional ventilation, essentially the opposite of HFOV's approach, which uses very small volumes at very high rates." },
      { label: "D", text: "A mechanism unrelated to any pressure oscillation", correct: false, tag: null, rationale: "HFOV is fundamentally based on oscillating pressure around a mean airway pressure — this IS the core mechanism, not something unrelated to pressure oscillation." },
    ],
  },
  {
    domain: "III",
    subdomain: "III.C — Support Oxygenation and Ventilation",
    level: "application",
    patient: "Adult · General",
    stem: "A patient on a ventilator with a set PEEP of 8 cmH2O has an end-expiratory hold performed, revealing a total PEEP of 14 cmH2O.",
    question: "This finding indicates:",
    options: [
      { label: "A", text: "The presence of auto-PEEP (approximately 6 cmH2O beyond the set level), suggesting incomplete exhalation and air trapping", correct: true, tag: null, rationale: "The difference between total PEEP (measured via end-expiratory hold, revealing all pressure present including trapped gas) and set PEEP represents auto-PEEP — here, 14 minus the set 8 equals 6 cmH2O of auto-PEEP, indicating the patient isn't fully exhaling before the next breath, warranting evaluation and likely intervention (e.g., adjusting expiratory time)." },
      { label: "B", text: "A ventilator malfunction requiring immediate replacement", correct: false, tag: null, rationale: "This is a recognized, measurable physiological finding (auto-PEEP) rather than necessarily indicating equipment malfunction — the appropriate response is addressing the ventilation settings contributing to air trapping, not assuming device failure." },
      { label: "C", text: "Normal, expected ventilator function requiring no further assessment", correct: false, tag: null, rationale: "A total PEEP significantly higher than the set PEEP indicates a real, clinically relevant finding (auto-PEEP) that warrants assessment and likely intervention, not dismissal as normal." },
      { label: "D", text: "An error in the end-expiratory hold technique with no clinical meaning", correct: false, tag: null, rationale: "When performed correctly, this technique reliably reveals meaningful auto-PEEP information — this finding shouldn't be dismissed as a technique error without further consideration." },
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

  // ---- Auth state ----
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          setSubscribed(snap.exists() ? !!snap.data().subscribed : false);
        } catch (e) {
          setSubscribed(false);
        }
      } else {
        setSubscribed(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    const nextIndex = qIndex + 1;
    if (!subscribed && nextIndex >= FREE_QUESTION_LIMIT) {
      setScreen("paywall");
    } else if (nextIndex >= SAMPLE_QUESTIONS.length) {
      setScreen("results");
    } else {
      setQIndex(nextIndex);
    }
  }

  function restart() {
    setAnswered({});
    setQIndex(0);
    setSelected(null);
    setRevealed(false);
    setScreen("practice");
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5F0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", color: "#8A8578", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  // If the person arrived via the landing page's "Purchase Now" button,
  // they need an account before we can send them to checkout.
  const cameFromPurchaseNow =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("upgrade") === "1";
  if (cameFromPurchaseNow && !user) {
    return <AuthScreen />;
  }
  if (cameFromPurchaseNow && user && !subscribed) {
    return <AutoCheckoutRedirect />;
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
        <nav style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <button onClick={() => setScreen("home")} className="mono" style={{ background: "none", border: "none", fontSize: 12, letterSpacing: "0.04em", color: screen === "home" ? "#1B2A4A" : "#8A8578", fontWeight: 600 }}>OVERVIEW</button>
          <button onClick={() => setScreen("practice")} className="mono" style={{ background: "none", border: "none", fontSize: 12, letterSpacing: "0.04em", color: screen === "practice" ? "#1B2A4A" : "#8A8578", fontWeight: 600 }}>TMC PRACTICE</button>
          <button onClick={() => setScreen("cse")} className="mono" style={{ background: "none", border: "none", fontSize: 12, letterSpacing: "0.04em", color: screen === "cse" ? "#1B2A4A" : "#8A8578", fontWeight: 600 }}>CSE SIMULATION</button>
          {user ? (
            <>
              <span className="mono" style={{ fontSize: 11, color: "#8A8578", marginLeft: 8 }}>{subscribed ? "PLUS" : "FREE"}</span>
              <button onClick={() => signOut(auth)} title="Log out" style={{ background: "none", border: "none", display: "flex", alignItems: "center", color: "#8A8578" }}>
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <button onClick={() => setScreen("login")} className="mono" style={{ background: "none", border: "1px solid #DCD7C9", borderRadius: 3, padding: "5px 12px", fontSize: 11, letterSpacing: "0.04em", color: "#1B2A4A", fontWeight: 600 }}>LOG IN</button>
          )}
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
      {screen === "paywall" && (!user ? <AuthScreen freeTrialMessage /> : <Paywall answeredCount={qIndex + 1} />)}
      {screen === "login" && <AuthScreen />}
      {screen === "cse" && <CSESimulation />}

      {/* Support chatbot */}
      <SupportChat open={chatOpen} setOpen={setChatOpen} />
    </div>
  );
}

function Paywall({ answeredCount }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "72px 24px" }}>
      <p className="mono" style={{ fontSize: 12, letterSpacing: "0.08em", color: "#E85D3D", fontWeight: 700, marginBottom: 14 }}>FREE TRIAL COMPLETE</p>
      <h1 className="serif" style={{ fontSize: 30, fontWeight: 600, marginBottom: 16 }}>
        You've used your {answeredCount} free practice questions.
      </h1>
      <p style={{ fontSize: 15, color: "#4A4536", lineHeight: 1.65, marginBottom: 32 }}>
        Upgrade to CRT/RRT Board Prep Plus for unlimited AI-generated practice questions,
        full CSE simulations, adaptive weak-area targeting, and both the 2026 and 2027 exam tracks.
      </p>
      <UpgradeButton />
    </main>
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

      <div style={{ marginTop: 48, borderTop: "1px solid #DCD7C9", paddingTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8A8578", marginBottom: 14 }}>
          <Lock size={13} />
          <span style={{ fontSize: 12 }}>Unlimited generated practice, adaptive weak-area targeting, and full CSE simulations are part of CRT/RRT Board Prep Plus.</span>
        </div>
        <UpgradeButton />
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

// ---- Upgrade button: triggers real Stripe Checkout via Netlify Function ----
// ---- Auto-redirects straight to Stripe checkout, used for the landing
// page's "Purchase Now" button so returning/new users skip the practice
// screen entirely and go directly to payment. ----
function AutoCheckoutRedirect() {
  const [error, setError] = useState(null);

  useEffect(() => {
    async function go() {
      try {
        const currentUser = auth.currentUser;
        const res = await fetch("/.netlify/functions/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: currentUser ? currentUser.uid : null,
            email: currentUser ? currentUser.email : null,
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.error || "Something went wrong starting checkout.");
        }
      } catch (e) {
        setError("Could not reach checkout. Please try again.");
      }
    }
    go();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: "'JetBrains Mono', monospace", color: "#8A8578", fontSize: 13, padding: 24, textAlign: "center" }}>
      {!error ? (
        <p>Redirecting you to secure checkout…</p>
      ) : (
        <>
          <p style={{ color: "#E85D3D" }}>{error}</p>
          <button
            onClick={() => (window.location.href = "/")}
            style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Back to CRT/RRT Board Prep
          </button>
        </>
      )}
    </div>
  );
}

function UpgradeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const currentUser = auth.currentUser;
      const res = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: currentUser ? currentUser.uid : null,
          email: currentUser ? currentUser.email : null,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong starting checkout.");
        setLoading(false);
      }
    } catch (e) {
      setError("Could not reach checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={startCheckout}
        disabled={loading}
        style={{
          background: "#E85D3D",
          color: "#F7F5F0",
          border: "none",
          borderRadius: 3,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Redirecting to checkout…" : "Upgrade to Plus — $19/mo"}
      </button>
      {error && (
        <p style={{ color: "#E85D3D", fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}

// ---- Auth screen: sign up / log in with email + password ----
function AuthScreen({ freeTrialMessage }) {
  const [mode, setMode] = useState(freeTrialMessage ? "signup" : "login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Create the user's Firestore profile on first sign-up
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          createdAt: serverTimestamp(),
          subscribed: false,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged in the parent component picks up the new session automatically
    } catch (err) {
      setError(friendlyAuthError(err.code));
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif", color: "#1B2A4A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Lora:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        * { box-sizing: border-box; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .serif { font-family: 'Lora', Georgia, serif; }
      `}</style>
      <div style={{ maxWidth: 380, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <Activity size={22} color="#E85D3D" strokeWidth={2.5} />
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>CRT/RRT Board Prep</span>
        </div>

        <h1 className="serif" style={{ fontSize: 24, fontWeight: 600, textAlign: "center", marginBottom: freeTrialMessage ? 8 : 24 }}>
          {mode === "login" ? "Log in to practice" : "Create your free account"}
        </h1>
        {freeTrialMessage && (
          <p style={{ fontSize: 14, color: "#8A8578", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
            You've used your 15 free practice questions. Create a free account to save your progress and keep going.
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #DCD7C9", borderRadius: 4, padding: "10px 12px", background: "#FFFFFF" }}>
            <Mail size={15} color="#8A8578" />
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #DCD7C9", borderRadius: 4, padding: "10px 12px", background: "#FFFFFF" }}>
            <KeyRound size={15} color="#8A8578" />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ border: "none", outline: "none", flex: 1, fontSize: 14, fontFamily: "inherit" }}
            />
          </div>

          {error && <p style={{ color: "#E85D3D", fontSize: 13, margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ background: "#1B2A4A", color: "#F7F5F0", border: "none", borderRadius: 3, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginTop: 4 }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up free"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "#8A8578", marginTop: 20 }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
            style={{ background: "none", border: "none", color: "#E85D3D", fontWeight: 600, cursor: "pointer", fontSize: 13, textDecoration: "underline", padding: 0 }}
          >
            {mode === "login" ? "Create a free account" : "Log in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered — try logging in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with that email.";
    default:
      return "Something went wrong. Please try again.";
  }
}
