import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom'; // ✅ Import ReactDOM
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebase';
import './ActivityModals.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function TypingTestModal({ isOpen, onClose, task, onComplete }) {
    const [input, setInput] = useState("");
    const [timeLeft, setTimeLeft] = useState(30);
    const [isActive, setIsActive] = useState(false);
    const [status, setStatus] = useState("idle"); // idle, finished, verifying
    const [resultMsg, setResultMsg] = useState("");
    const inputRef = useRef(null);

    // Timer Logic
    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
        } else if (timeLeft === 0 && isActive) {
            finishTest();
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    if (!isOpen || !task) return null;

    const handleInput = (e) => {
        if (!isActive && status === 'idle') setIsActive(true);
        setInput(e.target.value);
    };

    const finishTest = async () => {
        setIsActive(false);
        setStatus("verifying");

        // Calculate Stats
        const words = input.trim().split(/\s+/).length;
        const wpm = Math.round(words * (60 / 30)); // Scaled to 60s
        
        // Simple Accuracy
        const target = task.content.targetText;
        let hits = 0;
        for (let i = 0; i < Math.min(input.length, target.length); i++) {
            if (input[i] === target[i]) hits++;
        }
        const accuracy = Math.round((hits / target.length) * 100);

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
                    taskType: 'Typing',
                    submission: { wpm, accuracy },
                    context: { targetText: task.content.targetText }
                })
            });

            const data = await res.json();

            if (data.passed) {
                setStatus("success");
                setResultMsg(data.feedback);
                setTimeout(() => onComplete(data.credits), 2500);
            } else {
                setStatus("failed");
                setResultMsg(data.feedback);
            }
        } catch (error) {
            setStatus("error");
            setResultMsg("Network error.");
        }
    };

    // ✅ Use Portal
    return ReactDOM.createPortal(
        <AnimatePresence>
            <div className="activity-modal-overlay">
                <motion.div 
                    className="activity-modal-card"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <div className="modal-header">
                        <h3>⌨️ Speed Test</h3>
                        <div className="timer-badge">
                            Time: {timeLeft}s
                        </div>
                    </div>

                    <div className="typing-target-box">
                        {task.content.targetText}
                    </div>

                    <textarea
                        className="typing-input-area"
                        placeholder="Start typing here to begin..."
                        value={input}
                        onChange={handleInput}
                        disabled={timeLeft === 0}
                        onPaste={(e) => { e.preventDefault(); alert("No cheating! 😉"); }}
                        autoFocus
                    />

                    {/* Result Messages */}
                    {status === 'success' && (
                        <div className="feedback-box feedback-success">
                            <i className="fas fa-trophy"></i> <strong>{resultMsg}</strong>
                        </div>
                    )}
                    {status === 'failed' && (
                        <div className="feedback-box feedback-hint" style={{borderColor: '#ef4444', color:'#ef4444', background:'rgba(239,68,68,0.1)'}}>
                            <i className="fas fa-times-circle"></i> <strong>{resultMsg}</strong>
                        </div>
                    )}

                    <div className="modal-footer">
                        <button className="btn-submit" onClick={onClose}>
                            {status === 'success' ? 'Claim Rewards' : 'Close'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body // 🚀 Renders at the end of Body
    );
}