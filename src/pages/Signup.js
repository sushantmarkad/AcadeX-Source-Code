import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../firebase";
import AnimatedPage from "../components/AnimatedPage";
import { motion } from "framer-motion";

export default function Signup() {
    const [form, setForm] = useState({
        // All fields are now combined for simplicity
        firstName: "",
        lastName: "",
        rollNo: "",
        subjectName: "",
        qualification: "",
        instituteName: "", // New field for Institute Admin
        email: "",
        password: "",
        role: "student"
    });
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.email || !form.password) {
            setError("❌ Please provide a valid email and password.");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
            const user = userCredential.user;

            let userData = {
                uid: user.uid,
                email: user.email,
                role: form.role,
            };

            if (form.role === 'institute-admin') {
                if (!form.instituteName || !form.firstName || !form.lastName) {
                    setError("❌ Please provide your name and an institute name.");
                    return;
                }
                // Create a new institute and get its ID
                const instituteRef = await addDoc(collection(db, "institutes"), {
                    instituteName: form.instituteName,
                    adminUids: [user.uid] // Set the new user as the admin
                });
                // Link the user to this new institute
                userData.instituteId = instituteRef.id;
                userData.firstName = form.firstName;
                userData.lastName = form.lastName;

            } else if (form.role === 'teacher') {
                // Note: In a real app, a teacher would be added by an admin, not from this public page.
                userData = { ...userData, firstName: form.firstName, lastName: form.lastName, subject: form.subjectName, qualification: form.qualification };

            } else { // Student
                userData = { ...userData, firstName: form.firstName, lastName: form.lastName, rollNo: form.rollNo };
            }

            await setDoc(doc(db, "users", user.uid), userData);
            navigate("/dashboard");

        } catch (error) {
            setError(`❌ Error: ${error.message}`);
            console.error("Signup error:", error);
        }
    };

    return (
        <AnimatedPage>
            <div className="login-container">
                <div className="login-header">
                    <motion.img
                        className="login-logo"
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
                        Create an AcadeX Account
                    </motion.h1>
                </div>
                <motion.form
                    className="login-form"
                    onSubmit={handleSubmit}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <div className="input-group">
                        <label>I am a:</label>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" value="student" name="role" checked={form.role === 'student'} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ marginRight: '5px' }} />
                                Student
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" value="teacher" name="role" checked={form.role === 'teacher'} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ marginRight: '5px' }} />
                                Teacher
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" value="institute-admin" name="role" checked={form.role === 'institute-admin'} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ marginRight: '5px' }} />
                                Institute Admin
                            </label>
                        </div>
                    </div>

                    {(form.role === 'teacher' || form.role === 'institute-admin') && (
                        <>
                            <div className="input-group"><label>First Name</label><input type="text" placeholder="e.g., Jane" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                            <div className="input-group"><label>Last Name</label><input type="text" placeholder="e.g., Doe" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                        </>
                    )}
                    {form.role === 'institute-admin' && (
                        <div className="input-group"><label>Institute Name</label><input type="text" placeholder="e.g., National Institute of Technology" value={form.instituteName} onChange={(e) => setForm({ ...form, instituteName: e.target.value })} /></div>
                    )}
                    {form.role === 'teacher' && (
                        <>
                            <div className="input-group"><label>Subject Name</label><input type="text" placeholder="e.g., Computer Science" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} /></div>
                            <div className="input-group"><label>Qualification</label><input type="text" placeholder="e.g., M.Tech in CS" value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} /></div>
                        </>
                    )}
                    {form.role === 'student' && (
                        <>
                            <div className="input-group"><label>First Name</label><input type="text" placeholder="e.g., Sushant" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                            <div className="input-group"><label>Last Name</label><input type="text" placeholder="e.g., Markad" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                            <div className="input-group"><label>Roll No.</label><input type="text" placeholder="e.g., 21" value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} /></div>
                        </>
                    )}
                    <div className="input-group"><label>Email address</label><input type="email" placeholder="your-email@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                    <div className="input-group"><label>Password</label><input type="password" placeholder="Must be at least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>

                    {error && <p className="error-message">{error}</p>}
                    <motion.button
                        type="submit"
                        className="btn-primary"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        Sign Up
                    </motion.button>
                    <p style={{ marginTop: '15px', textAlign: 'center' }}>Already have an account? <span style={{ color: "#075eec", cursor: "pointer" }} onClick={() => navigate("/")}>Sign In</span></p>
                </motion.form>
            </div>
        </AnimatedPage>
    );
}

