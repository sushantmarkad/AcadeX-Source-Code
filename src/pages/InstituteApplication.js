import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./InstituteApplication.css"; // ✅ UPDATED IMPORT
import logo from "../assets/logo.png";
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

const API_URL = "https://acadex-backend-n2wh.onrender.com/submitApplication";

export default function InstituteApplication() {
  const [form, setForm] = useState({
    instituteName: "",
    contactName: "",
    email: "",
    phone: "",
    domain: "ENGINEERING", // ✅ ADDED DEFAULT DOMAIN STATE
    message: "",
  });
  
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const playSound = useIOSSound();

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    playSound('tap');

    // Basic Validation
    if (!form.instituteName || !form.contactName || !form.email || !form.phone || !file) {
      setError("Please fill all required fields and attach the verification document.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("instituteName", form.instituteName);
      formData.append("contactName", form.contactName);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("domain", form.domain); // ✅ SEND DOMAIN TO BACKEND
      formData.append("message", form.message);
      formData.append("document", file); 

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Application submitted successfully! Our team will verify your documents within 24-48 hours. You will receive an email with your admin credentials upon approval.");
        setForm({
          instituteName: "",
          contactName: "",
          email: "",
          phone: "",
          domain: "ENGINEERING",
          message: "",
        });
        setFile(null);
        setTimeout(() => navigate('/check-status'), 4000);
      } else {
        setError(data.error || "Failed to submit application.");
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <IOSPage>
      <div className="inst-app-wrapper">
        <div className="inst-app-container">
          <div className="inst-app-header">
            <img src={logo} alt="Logo" className="inst-app-logo" />
            <h1>Partner with trackee</h1>
            <p>Digitize your campus today. Fill out the form below to request an institute account.</p>
          </div>

          <form onSubmit={handleSubmit} className="inst-app-form">
            <div className="inst-app-input-group">
              <label>Institute Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. MIT College of Engineering"
                value={form.instituteName}
                onChange={(e) => setForm({ ...form, instituteName: e.target.value })}
              />
            </div>

          {/* ✅ NEW DOMAIN SELECTION DROPDOWN */}
            <div className="inst-app-input-group">
                <label>Institute Type / Domain *</label>
                <div className="inst-app-select-wrapper">
                    <select 
                        value={form.domain}
                        onChange={(e) => setForm({...form, domain: e.target.value})}
                        required
                    >
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

            <div className="inst-app-input-group">
              <label>Admin/Contact Person Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. John Doe"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>

            <div className="inst-app-input-group">
              <label>Official Email ID *</label>
              <input
                type="email"
                required
                placeholder="principal@college.edu.in"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="inst-app-input-group">
              <label>Contact Number *</label>
              <input
                type="tel"
                required
                placeholder="+91 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div className="inst-app-input-group">
              <label>Verification Document (PDF/Image) *</label>
              <p style={{ fontSize: "12px", color: "#5f6368", marginTop: "-5px", marginBottom: "10px" }}>
                Upload a valid college ID, AICTE/UGC approval letter, or official letterhead to verify authenticity.
              </p>
              
              <input
                type="file"
                id="file-upload"
                accept=".pdf, image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <label htmlFor="file-upload" className="inst-app-file-upload">
                <i className={`fas ${file ? "fa-check-circle" : "fa-cloud-upload-alt"}`}></i>
                <span>{file ? file.name : "Click to Upload Document"}</span>
              </label>
            </div>

            <div className="inst-app-input-group">
              <label>Additional Message (Optional)</label>
              <textarea
                rows="3"
                placeholder="Tell us about your institute..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              ></textarea>
            </div>

            {error && <p className="inst-app-error">{error}</p>}
            {success && <p className="inst-app-success">{success}</p>}

            <motion.button 
                type="submit" 
                className="inst-app-btn-primary" 
                disabled={loading}
                variants={buttonTap}
                whileTap="tap"
            >
              {loading ? "Uploading & Submitting..." : "Submit Application"}
            </motion.button>

            <p style={{ marginTop: "15px", textAlign: "center" }}>
              Already applied?{" "}
              <span
                style={{ color: "#075eec", cursor: "pointer" }}
                onClick={() => { playSound('tap'); navigate("/check-status"); }}
              >
                Check your status here
              </span>
            </p>

            <p style={{ marginTop: "15px", textAlign: "center" }}>
              Already have an account?{" "}
              <span
                style={{ color: "#075eec", cursor: "pointer" }}
                onClick={() => { playSound('tap'); navigate("/"); }}
              >
                Sign In
              </span>
            </p>
          </form>
        </div>
      </div>
    </IOSPage>
  );
}