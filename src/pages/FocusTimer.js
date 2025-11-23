import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import './Dashboard.css'; // We'll add timer styles here

export default function FocusTimer({ durationMinutes, taskTitle, onComplete, onCancel }) {
    const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;
        if (secondsLeft === 0) {
            onComplete();
            return;
        }

        const interval = setInterval(() => {
            setSecondsLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [secondsLeft, isPaused, onComplete]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const percentage = (secondsLeft / (durationMinutes * 60)) * 100;

    return (
        <div className="timer-overlay">
            <div className="timer-card">
                <h3 style={{color:'#64748b', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px'}}>Focus Session</h3>
                <h1 style={{fontSize:'24px', margin:'10px 0 30px 0', color:'#1e293b'}}>{taskTitle}</h1>

                <div style={{ width: 200, height: 200, margin: '0 auto 30px auto' }}>
                    <CircularProgressbar 
                        value={percentage} 
                        text={formatTime(secondsLeft)} 
                        styles={buildStyles({
                            textSize: '24px',
                            pathColor: '#3b82f6',
                            textColor: '#1e293b',
                            trailColor: '#f1f5f9',
                            pathTransitionDuration: 0.5,
                        })}
                    />
                </div>

                <div className="timer-controls">
                    <button className="btn-secondary" onClick={() => setIsPaused(!isPaused)}>
                        {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button className="btn-danger-ghost" onClick={onCancel}>
                        Give Up
                    </button>
                    {/* Dev Mode: Instant Finish (Remove in Prod) */}
                    {/* <button onClick={onComplete}>Dev: Finish</button> */}
                </div>
            </div>
        </div>
    );
}