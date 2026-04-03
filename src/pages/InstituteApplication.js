import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./InstituteApplication.css"; 
import logo from "../assets/logo.png";
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion, AnimatePresence } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

const API_URL = "https://acadex-backend-n2wh.onrender.com/submitApplication";

export default function InstituteApplication() {
  const [form, setForm] = useState({
    instituteName: "", contactName: "", email: "", phone: "", domain: "ENGINEERING", message: "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const playSound = useIOSSound();

  const handleFileChange = (e) => { if (e.target.files[0]) setFile(e.target.files[0]); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    playSound('tap');

    if (!form.instituteName || !form.contactName || !form.email || !form.phone || !file) {
      playSound('error');
      setError("Please fill all required fields and attach the verification document.");
      setLoading(false); return;
    }

    try {
      const formData = new FormData();
      formData.append("instituteName", form.instituteName);
      formData.append("contactName", form.contactName);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("domain", form.domain); 
      formData.append("message", form.message);
      formData.append("document", file); 

      const response = await fetch(API_URL, { method: "POST", body: formData });
      const data = await response.json();

      if (response.ok) {
        playSound('success');
        setSuccess("Application submitted successfully! Our team will verify your documents shortly.");
        setForm({ instituteName: "", contactName: "", email: "", phone: "", domain: "ENGINEERING", message: "" });
        setFile(null);
        setTimeout(() => navigate('/check-status'), 4000);
      } else {
        playSound('error');
        setError(data.error || "Failed to submit application.");
      }
    } catch (err) {
      playSound('error');
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <IOSPage>
      <div className="inst-app-wrapper">
        <div className="inst-app-container">
          
          {/* LEFT PANEL */}
          <div className="inst-left-panel">
            <img className="inst-panel-logo" src={logo} alt="trackee Logo" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inst-graphic-content">
              <div className="inst-hero-icon"><i className="fas fa-building"></i></div>
              <h2>Partner with<br/>trackee</h2>
              <p>Digitize your campus operations today. Centralize attendance, simplify administrative workflows, and unlock powerful analytics.</p>
            </motion.div>
          </div>

          {/* RIGHT PANEL */}
          <div className="inst-right-panel">
            
            {/* Mobile Header */}
            <div className="inst-mobile-header">
              <img src={logo} alt="trackee Logo" />
              <h1>Partner with <span style={{ color: "var(--theme-color)" }}>trackee</span></h1>
            </div>

            {/* Desktop Header */}
            <div className="inst-desktop-header">
              <img className="inst-desktop-logo" src={logo} alt="trackee Logo" />
              <h1 className="inst-desktop-name">trackee</h1>
            </div>

            <h3 className="inst-form-title">Institute Application</h3>
            <p className="inst-form-subtitle">Fill out the form below to request an administrative account.</p>

            <form onSubmit={handleSubmit}>
              <div className="inst-input-group">
                <label>Institute Name *</label>
                <input type="text" required placeholder="e.g. MIT College of Engineering" value={form.instituteName} onChange={(e) => setForm({ ...form, instituteName: e.target.value })} />
              </div>

              <div className="inst-input-group">
                <label>Institute Domain *</label>
                <div className="inst-select-wrapper">
                  <select value={form.domain} onChange={(e) => setForm({...form, domain: e.target.value})} required>
                    <option value="ENGINEERING">Engineering & Technology</option>
                    <option value="MEDICAL">Medical (MBBS/MD)</option>
                    <option value="PHARMACY">Pharmacy (B.Pharm/M.Pharm)</option>
                    <option value="PHARM_D">Pharm.D (Doctor of Pharmacy)</option>
                    <option value="NURSING">Nursing</option>
                    <option value="AGRICULTURE">Agriculture</option>
                    <option value="ARTS_SCIENCE">Arts, Commerce & Science</option>
                  </select>
                </div>
              </div>

              <div className="inst-input-group">
                <label>Admin/Contact Person Name *</label>
                <input type="text" required placeholder="e.g. Dr. John Doe" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="inst-input-group" style={{ flex: 1 }}>
                  <label>Official Email ID *</label>
                  <input type="email" required placeholder="admin@college.edu" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="inst-input-group" style={{ flex: 1 }}>
                  <label>Contact Number *</label>
                  <input type="tel" required placeholder="+91 9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>

              <div className="inst-input-group">
                <label>Verification Document *</label>
                <input 
                    type="file" 
                    id="file-upload" 
                    accept=".pdf, image/*" 
                    onChange={handleFileChange} 
                    style={{ display: "none" }} 
                />
                <label htmlFor="file-upload" className={`inst-file-upload ${file ? "has-file" : ""}`}>
                  <div className="inst-upload-icon-wrapper">
                    <i className={`fas ${file ? "fa-check" : "fa-cloud-upload-alt"}`}></i>
                  </div>
                  <div className="inst-file-upload-text">
                    <span className="main-text">
                      {file ? file.name : "Click to upload document"}
                    </span>
                    {!file && (
                      <span className="sub-text">
                        Valid College ID or AICTE Letter (PDF or Image)
                      </span>
                    )}
                  </div>
                </label>
              </div>

              <div className="inst-input-group">
                <label>Additional Message (Optional)</label>
                <textarea rows="3" placeholder="Tell us about your institute..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}></textarea>
              </div>

              {error && <p className="inst-error"><i className="fas fa-exclamation-circle"></i> {error}</p>}
              {success && <p className="inst-success"><i className="fas fa-check-circle"></i> {success}</p>}

              <motion.button type="submit" className="inst-btn-primary" disabled={loading} variants={buttonTap} whileTap="tap">
                {loading ? "Uploading & Submitting..." : "Submit Application"}
              </motion.button>

              <div className="inst-footer-links">
                <p>Already applied? <span className="inst-text-link" onClick={() => { playSound('tap'); navigate("/check-status"); }}>Check your status here</span></p>
                <p style={{ marginTop: '8px' }}>Already have an account? <span className="inst-text-link" onClick={() => { playSound('tap'); navigate("/"); }}>Sign In</span></p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </IOSPage>
  );
}