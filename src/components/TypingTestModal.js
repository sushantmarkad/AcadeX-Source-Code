import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';

export default function TypingTestModal({ isOpen, onClose, task, onComplete }) {
    const [text, setText] = useState("");
    const [input, setInput] = useState("");
    const [startTime, setStartTime] = useState(null);
    const [wpm, setWpm] = useState(0);
    const [completed, setCompleted] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen && task) {
            // 1. Get text from the task passed down from Dashboard
            // It tries 'content.targetText' (from AI) or falls back to 'content.textToType'
            const textContent = task.content?.targetText || task.content?.textToType || "Technology is best when it brings people together.";
            
            setText(textContent);
            setInput("");
            setStartTime(null);
            setWpm(0);
            setCompleted(false);
            
            // Auto-focus input
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, task]);

    const handleChange = (e) => {
        const val = e.target.value;
        if (!startTime) setStartTime(Date.now());
        setInput(val);

        if (val === text) {
            const timeTaken = (Date.now() - startTime) / 1000 / 60; // in minutes
            const words = text.split(" ").length;
            const speed = Math.round(words / timeTaken);
            setWpm(speed);
            setCompleted(true);
            
            // Calculate XP based on speed
            const xp = speed > 40 ? 30 : 15;
            toast.success(`Speed: ${speed} WPM!`);
            
            // Call the completion handler
            if (onComplete) onComplete(xp);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="custom-modal-overlay">
            <div className="custom-modal-box" style={{ maxWidth: '800px', textAlign: 'center' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>⚡ Speed Typing</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>×</button>
                </div>
                
                {/* Typing Area */}
                {!completed ? (
                    <>
                        <div style={{
                            background: '#f1f5f9', padding: '25px', borderRadius: '12px', 
                            fontSize: '20px', fontFamily: 'monospace', color: '#64748b', 
                            marginBottom: '25px', lineHeight: '1.8', textAlign: 'left', userSelect: 'none'
                        }}>
                            {text.split('').map((char, i) => {
                                let color = '#64748b';
                                let bg = 'transparent';
                                if (i < input.length) {
                                    if (input[i] === char) { color = '#16a34a'; } // Green for correct
                                    else { color = '#dc2626'; bg = '#fecaca'; }   // Red for wrong
                                }
                                return (
                                    <span key={i} style={{ color, backgroundColor: bg, position: 'relative' }}>
                                        {/* Cursor Blinker */}
                                        {i === input.length && <span style={{ position: 'absolute', left: 0, height: '100%', width: '2px', background: '#2563eb', animation: 'blink 1s infinite' }}></span>}
                                        {char}
                                    </span>
                                )
                            })}
                        </div>

                        <input 
                            ref={inputRef}
                            type="text" 
                            value={input} 
                            onChange={handleChange}
                            style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }} // Hidden input captures keys
                            autoFocus
                        />
                        <p style={{ color: '#64748b', fontSize: '14px' }}>Start typing to begin...</p>
                    </>
                ) : (
                    /* Completion Screen */
                    <div style={{ padding: '40px' }}>
                        <div style={{ fontSize: '60px', marginBottom: '10px' }}>🚀</div>
                        <div style={{ fontSize: '48px', fontWeight: '800', color: '#2563eb', marginBottom: '10px' }}>
                            {wpm} <span style={{ fontSize: '16px', color: '#64748b' }}>WPM</span>
                        </div>
                        <p style={{ color: '#16a34a', fontWeight: 'bold', marginBottom: '20px' }}>Test Completed!</p>
                        <button className="btn-primary" onClick={onClose}>Close & Claim XP</button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}