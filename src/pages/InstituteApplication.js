import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./InstituteApplication.css";
import AnimatedPage from "../components/AnimatedPage";
import { motion } from "framer-motion";

// ✅ Pointing to your Render Backend
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!form.instituteName || !form.contactName || !form.email) {
      setError("Please fill out all required fields.");
      setLoading(false);
      return;
    }

    try {
      // ✅ Call Backend API instead of Firestore directly
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit application");
      }

      setSuccess("Application submitted! We will contact you soon.");
      setForm({
        instituteName: "",
        contactName: "",
        email: "",
        phone: "",
        message: "",
      });
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
      <div className="application-container">
        <div className="application-header">
          <motion.img
            className="application-logo"
            src="https://iili.io/KoAVeZg.md.png"
            alt="AcadeX Logo"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Apply to use AcadeX
          </motion.h1>
          <motion.p
            className="subtitle"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Submit your institute's application to get access to the Acadex platform.
          </motion.p>
        </div>
        <motion.form
          className="application-form"
          onSubmit={handleSubmit}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="input-group">
            <label>Institute Name</label>
            <input
              type="text"
              placeholder="e.g., DVVPCOE"
              value={form.instituteName}
              onChange={(e) =>
                setForm({ ...form, instituteName: e.target.value })
              }
              required
            />
          </div>
          <div className="input-group">
            <label>Contact Person</label>
            <input
              type="text"
              placeholder="e.g., Sushant Markad"
              value={form.contactName}
              onChange={(e) =>
                setForm({ ...form, contactName: e.target.value })
              }
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </motion.button>

          <p style={{ marginTop: "15px", textAlign: "center" }}>
            Already applied?{" "}
            <span
              style={{ color: "#075eec", cursor: "pointer" }}
              onClick={() => navigate("/check-status")}
            >
              Check your status here
            </span>
          </p>

          <p style={{ marginTop: "15px", textAlign: "center" }}>
            Already have an account?{" "}
            <span
              style={{ color: "#075eec", cursor: "pointer" }}
              onClick={() => navigate("/")}
            >
              Sign In
            </span>
          </p>
        </motion.form>
      </div>
    </AnimatedPage>
  );
}