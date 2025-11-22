import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./InstituteApplication.css";

// ✅ Animation Imports
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
    message: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const playSound = useIOSSound();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    playSound('tap');

    if (!form.instituteName || !form.contactName || !form.email) {
      setError("Please fill out all required fields.");
      playSound('error');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit application");
      }

      playSound('success');
      setSuccess("Application submitted! We will contact you soon.");
      setForm({ instituteName: "", contactName: "", email: "", phone: "", message: "" });
    } catch (error) {
      playSound('error');
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IOSPage>
      {/* ✅ Added Wrapper for Centering */}
      <div className="application-wrapper">
        <div className="application-container">
          <div className="application-header">
            <img className="application-logo" src="https://iili.io/KoAVeZg.md.png" alt="AcadeX Logo" />
            <h1>Apply to use AcadeX</h1>
            <p className="subtitle">
              Submit your institute's application to get access to the Acadex platform.
            </p>
          </div>
          <form className="application-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Institute Name</label>
              <input
                type="text"
                placeholder="e.g., DVVPCOE"
                value={form.instituteName}
                onChange={(e) => setForm({ ...form, instituteName: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Contact Person</label>
              <input
                type="text"
                placeholder="e.g., Sushant Markad"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your-email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label>Phone Number (Optional)</label>
              <input
                type="tel"
                placeholder="e.g., +1234567890"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Message (Optional)</label>
              <textarea
                placeholder="Tell us about your institute..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              ></textarea>
            </div>

            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}

            <motion.button 
                type="submit" 
                className="btn-primary" 
                disabled={loading}
                variants={buttonTap}
                whileTap="tap"
            >
              {loading ? "Submitting..." : "Submit Application"}
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