import React, { useState } from 'react';
import ReactDOM from 'react-dom'; // ✅ Import ReactDOM
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import './ActivityModals.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function CodingChallengeModal({ isOpen, onClose, task, onComplete }) {
    const [code, setCode] = useState(task?.content?.starterCode || "");
    const [status, setStatus] = useState("idle"); // idle, verifying, success, hint
    const [feedback, setFeedback] = useState("");

    if (!isOpen || !task) return null;

    const handleSubmit = async () => {
        setStatus("verifying");
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${BACKEND_URL}/submitInteractiveTask`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    uid: auth.currentUser.uid,
                    taskType: 'Coding',
                    submission: { code },
                    context: { problemStatement: task.content.problemStatement }
                })
            });

            const data = await res.json();

            if (data.passed) {
                setStatus("success");
                setFeedback(data.feedback);
                setTimeout(() => onComplete(data.credits), 2000); // Close after 2s
            } else {
                setStatus("hint");
                setFeedback(data.hint || data.feedback || "Incorrect. Try checking your logic.");
            }
        } catch (error) {
            setStatus("error");
            setFeedback("Server error. Please try again.");
        }
    };

    // ✅ Use Portal to force full screen over sidebar
    return ReactDOM.createPortal(
        <AnimatePresence>
            <div className="activity-modal-overlay">
                <motion.div 
                    className="activity-modal-card"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="modal-header">
                        <h3>💻 {task.title}</h3>
                        <button onClick={onClose} className="close-btn">×</button>
                    </div>

                    <div className="code-problem-box">
                        <strong>Task:</strong> {task.content.problemStatement}
                    </div>

                    <textarea
                        className="code-editor-area"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        spellCheck="false"
                    />

                    {/* Smart Feedback Box */}
                    {status === 'success' && (
                        <motion.div className="feedback-box feedback-success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <i className="fas fa-check-circle"></i> 
                            <div><strong>PASSED!</strong> {feedback}</div>
                        </motion.div>
                    )}

                    {status === 'hint' && (
                        <motion.div className="feedback-box feedback-hint" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <i className="fas fa-lightbulb"></i> 
                            <div><strong>AI Hint:</strong> {feedback}</div>
                        </motion.div>
                    )}

                    <div className="modal-footer">
                        <button className="btn-submit" onClick={handleSubmit} disabled={status === 'verifying' || status === 'success'}>
                            {status === 'verifying' ? 'AI Checking...' : 'Run & Verify'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body // 🚀 Renders at the end of Body, covering Sidebar
    );
}