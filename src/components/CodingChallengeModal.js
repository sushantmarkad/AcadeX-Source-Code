import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import toast, { Toaster } from 'react-hot-toast';

// ✅ CONFIRM YOUR BACKEND URL
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function CodingChallengeModal({ isOpen, onClose, user, onComplete }) {
    const [challenge, setChallenge] = useState(null);
    const [code, setCode] = useState("");
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [difficulty, setDifficulty] = useState(null); 

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setChallenge(null);
            setDifficulty(null);
            setCode("");
            setOutput("");
        }
    }, [isOpen]);

    const fetchChallenge = async (selectedLevel) => {
        setLoading(true);
        setDifficulty(selectedLevel);
        try {
            const res = await fetch(`${BACKEND_URL}/startInteractiveTask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    taskType: 'Coding', 
                    userInterest: user.careerGoal || 'Technology',
                    difficulty: selectedLevel
                })
            });
            const data = await res.json();
            
            setChallenge(data);
            setCode(data.starterCode || "// Write your solution here...");
            setOutput("");
        } catch (e) {
            toast.error("Failed to load challenge.");
            setDifficulty(null);
        } finally {
            setLoading(false);
        }
    };

    const runCode = async () => {
        setVerifying(true);
        try {
            const res = await fetch(`${BACKEND_URL}/verifyCode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    code, 
                    language: 'javascript', 
                    problemStatement: challenge.scenario 
                })
            });
            const data = await res.json();
            
            let resultOutput = data.output || "";

            if(data.correct) {
                resultOutput = resultOutput || "✅ Logic Correct";
                toast.success("Correct! +50 XP", { duration: 4000 });
                onComplete(50);
            } else {
                resultOutput = resultOutput || "❌ Failed Test Cases";
                if (data.hint) {
                    resultOutput += `\n\n💡 Hint: ${data.hint}`;
                }
            }
            setOutput(resultOutput);

        } catch (e) {
            setOutput("Server Error.");
        } finally {
            setVerifying(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="cc-modal-overlay">
            <style>{`
                /* Modern Variables */
                :root {
                    --cc-bg: #0f172a;
                    --cc-bg-card: #1e293b;
                    --cc-border: #334155;
                    --cc-accent: #3b82f6;
                    --cc-text: #f1f5f9;
                    --cc-text-muted: #94a3b8;
                }

                /* 1. OVERLAY */
                .cc-modal-overlay {
                    position: fixed; 
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(12px);
                    display: flex; 
                    align-items: center; 
                    justify-content: center;
                    z-index: 9999999 !important;
                    padding: 20px;
                    animation: fadeIn 0.3s ease-out;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* 2. MODAL BOX */
                .cc-modal-box {
                    width: 100%; 
                    max-width: 1200px; 
                    height: 90vh;
                    background: var(--cc-bg); 
                    border: 1px solid var(--cc-border);
                    border-radius: 20px; 
                    overflow: hidden;
                    display: flex; 
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                    position: relative;
                }

                /* 3. HEADER */
                .cc-header {
                    padding: 15px 25px; 
                    background: rgba(30, 41, 59, 0.9); 
                    border-bottom: 1px solid var(--cc-border);
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center;
                    flex-shrink: 0;
                }
                .cc-title { 
                    font-size: 1.25rem; font-weight: 700; color: #4ade80; 
                    display: flex; align-items: center; gap: 12px; 
                    letter-spacing: 0.5px;
                }
                .cc-btn-icon { 
                    background: #334155; color: white; border: none; 
                    width: 40px; height: 40px; border-radius: 10px; 
                    cursor: pointer; transition: 0.2s; 
                    display: flex; align-items: center; justify-content: center; 
                }
                .cc-btn-icon:hover { background: #475569; transform: scale(1.05); }
                .cc-close { 
                    background: transparent; border: none; color: #94a3b8; 
                    font-size: 32px; cursor: pointer; line-height: 1; 
                    transition: color 0.2s; 
                }
                .cc-close:hover { color: white; }

                /* 4. SELECTION SCREEN - UPDATED FOR SCROLLING */
                .cc-select-screen { 
                    height: 100%; 
                    display: flex; flex-direction: column; 
                    align-items: center; 
                    /* ✅ CHANGED to flex-start + padding to prevent top cut-off */
                    justify-content: flex-start; 
                    gap: 40px; text-align: center; 
                    padding: 40px 20px;
                    background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
                    /* ✅ ENSURES SCROLLBAR APPEARS */
                    overflow-y: auto; 
                }
                
                .cc-level-grid { 
                    display: flex; gap: 25px; flex-wrap: wrap; 
                    justify-content: center; width: 100%; max-width: 900px; 
                    padding-bottom: 40px; /* Extra space at bottom for scrolling */
                }
                
                .cc-level-card {
                    flex: 1; min-width: 240px; max-width: 280px;
                    background: rgba(30, 41, 59, 0.6); 
                    border: 2px solid transparent;
                    border-radius: 20px; 
                    padding: 40px 25px;
                    cursor: pointer; 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex; flex-direction: column; align-items: center; gap: 15px;
                }
                
                .cc-card-easy { border-color: rgba(34, 197, 94, 0.3); }
                .cc-card-easy:hover { border-color: #22c55e; box-shadow: 0 0 30px rgba(34, 197, 94, 0.2); transform: translateY(-8px); background: rgba(34, 197, 94, 0.05); }
                
                .cc-card-medium { border-color: rgba(234, 179, 8, 0.3); }
                .cc-card-medium:hover { border-color: #eab308; box-shadow: 0 0 30px rgba(234, 179, 8, 0.2); transform: translateY(-8px); background: rgba(234, 179, 8, 0.05); }
                
                .cc-card-hard { border-color: rgba(239, 68, 68, 0.3); }
                .cc-card-hard:hover { border-color: #ef4444; box-shadow: 0 0 30px rgba(239, 68, 68, 0.2); transform: translateY(-8px); background: rgba(239, 68, 68, 0.05); }

                .cc-level-icon { font-size: 48px; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); }
                .cc-level-title { font-size: 1.5rem; font-weight: 800; color: white; letter-spacing: 1px; }
                .cc-level-desc { font-size: 0.95rem; color: #94a3b8; line-height: 1.5; font-weight: 500; }

                /* 5. EDITOR LAYOUT */
                .cc-layout { display: flex; flex: 1; overflow: hidden; height: 100%; }
                .cc-panel-left {
                    width: 380px; background: #1e293b; border-right: 1px solid var(--cc-border);
                    display: flex; flex-direction: column; overflow-y: auto; padding: 30px; flex-shrink: 0;
                }
                .cc-panel-right { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #0f172a; }
                
                .cc-editor {
                    flex: 1; width: 100%; background: transparent; color: #e2e8f0;
                    border: none; padding: 30px; font-family: 'Fira Code', monospace;
                    font-size: 15px; line-height: 1.6; resize: none; outline: none;
                }

                .cc-console {
                    height: 220px; background: #020617; border-top: 1px solid var(--cc-border);
                    padding: 20px 30px; overflow-y: auto; font-family: monospace; font-size: 14px; flex-shrink: 0;
                }

                .cc-spinner { width: 50px; height: 50px; border: 4px solid #334155; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                
                .cc-footer { 
                    padding: 15px 30px; background: #1e293b; 
                    border-top: 1px solid var(--cc-border); display: flex; 
                    justify-content: flex-end; flex-shrink: 0;
                }
                .cc-btn-run {
                    background: #3b82f6; color: white; border: none; border-radius: 10px;
                    padding: 12px 35px; font-weight: 700; font-size: 15px; cursor: pointer; 
                    display: flex; align-items: center; gap: 10px;
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
                    transition: all 0.2s;
                }
                .cc-btn-run:hover { background: #2563eb; transform: translateY(-2px); }
                .cc-btn-run:disabled { background: #64748b; cursor: not-allowed; opacity: 0.7; transform: none; box-shadow: none; }

                /* 6. MOBILE RESPONSIVENESS */
                @media (max-width: 768px) {
                    .cc-modal-overlay { padding: 0; }
                    .cc-modal-box { width: 100%; height: 100%; max-width: none; border-radius: 0; border: none; }
                    .cc-header { padding: 12px 15px; }
                    .cc-title { font-size: 1rem; }
                    .cc-layout { flex-direction: column; }
                    .cc-panel-left { width: 100%; height: auto; max-height: 30vh; border-right: none; border-bottom: 1px solid var(--cc-border); padding: 15px; }
                    .cc-panel-right { flex: 1; height: auto; min-height: 0; }
                    .cc-editor { font-size: 14px; padding: 15px; }
                    .cc-console { height: 100px; padding: 10px 15px; }
                    
                    /* Grid Fix for Mobile */
                    .cc-level-grid { flex-direction: column; width: 100%; padding-bottom: 60px; }
                    .cc-level-card { width: 100%; max-width: 100%; min-height: auto; flex-direction: row; text-align: left; padding: 20px; align-items: center; gap: 20px; }
                    .cc-level-icon { margin: 0; font-size: 32px; }
                    .cc-level-title { font-size: 1.2rem; }
                    .cc-level-desc { font-size: 0.85rem; }
                    
                    .cc-footer { padding: 10px 15px; }
                    .cc-btn-run { width: 100%; justify-content: center; padding: 12px; }
                }
            `}</style>

            <Toaster position="bottom-left" toastOptions={{ style: { background: '#333', color: '#fff', border: '1px solid #4ade80' } }} />

            <div className="cc-modal-box">
                {/* Header */}
                <div className="cc-header">
                    <div className="cc-title">
                        <i className="fas fa-code"></i> 
                        {challenge ? challenge.title : "AI Coding Challenge"}
                    </div>
                    <div style={{display:'flex', gap:'12px'}}>
                        {challenge && !loading && (
                            <button className="cc-btn-icon" onClick={() => fetchChallenge(difficulty)} title="Regenerate Question"><i className="fas fa-sync-alt"></i></button>
                        )}
                        <button className="cc-close" onClick={onClose}>×</button>
                    </div>
                </div>

                {/* VIEW 1: SELECT DIFFICULTY */}
                {!difficulty && !loading && (
                    <div className="cc-select-screen">
                        <div>
                            <h2 style={{color:'white', margin:'0 0 10px 0', fontSize:'2.5rem', fontWeight:'800'}}>Choose Difficulty</h2>
                            <p style={{color:'var(--cc-text-muted)', fontSize:'1.1rem', margin:0}}>Select a level to generate your custom AI challenge.</p>
                        </div>
                        
                        <div className="cc-level-grid">
                            <div className="cc-level-card cc-card-easy" onClick={() => fetchChallenge('Easy')}>
                                <div className="cc-level-icon">🌱</div>
                                <div><div className="cc-level-title" style={{color:'#4ade80'}}>Easy</div><div className="cc-level-desc">Basic logic & algorithms.</div></div>
                            </div>
                            <div className="cc-level-card cc-card-medium" onClick={() => fetchChallenge('Medium')}>
                                <div className="cc-level-icon">⚡</div>
                                <div><div className="cc-level-title" style={{color:'#facc15'}}>Medium</div><div className="cc-level-desc">Data structures & problem solving.</div></div>
                            </div>
                            <div className="cc-level-card cc-card-hard" onClick={() => fetchChallenge('Hard')}>
                                <div className="cc-level-icon">🔥</div>
                                <div><div className="cc-level-title" style={{color:'#f87171'}}>Hard</div><div className="cc-level-desc">Optimization & edge cases.</div></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW 2: LOADING */}
                {loading && (
                    <div className="cc-select-screen">
                        <div className="cc-spinner"></div>
                        <h3 style={{color:'white', margin:0, fontSize:'1.5rem'}}>Generating Challenge...</h3>
                    </div>
                )}

                {/* VIEW 3: CHALLENGE INTERFACE */}
                {challenge && !loading && (
                    <div className="cc-layout">
                        <div className="cc-panel-left">
                            <div style={{marginBottom:'25px'}}>
                                <span style={{fontSize:'11px', padding:'6px 14px', borderRadius:'20px', fontWeight:'800', textTransform:'uppercase', letterSpacing:'1px', background: difficulty==='Hard'?'rgba(239, 68, 68, 0.15)':difficulty==='Medium'?'rgba(234, 179, 8, 0.15)':'rgba(34, 197, 94, 0.15)', color: difficulty==='Hard'?'#f87171':difficulty==='Medium'?'#facc15':'#4ade80', border: `1px solid ${difficulty==='Hard'?'rgba(239, 68, 68, 0.3)':difficulty==='Medium'?'rgba(234, 179, 8, 0.3)':'rgba(34, 197, 94, 0.3)'}`}}>{difficulty} Level</span>
                            </div>
                            <h4 style={{color:'#f8fafc', marginTop:0, marginBottom:'15px', fontSize:'1.2rem', fontWeight:'700'}}>Problem Statement</h4>
                            <p style={{lineHeight:'1.7', color:'#cbd5e1', fontSize:'15px', whiteSpace:'pre-wrap'}}>{challenge?.scenario}</p>
                        </div>

                        <div className="cc-panel-right">
                            <textarea value={code} onChange={(e) => setCode(e.target.value)} className="cc-editor" spellCheck="false" placeholder="// Write your javascript solution here..." />
                            <div className="cc-console">
                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px'}}>
                                    <div style={{color:'#94a3b8', fontWeight:'700', fontSize:'11px', textTransform:'uppercase', letterSpacing:'1px'}}>Console Output</div>
                                </div>
                                <pre style={{margin:0, color: output.includes('❌') ? '#f87171' : output.includes('✅') ? '#4ade80' : '#e2e8f0', whiteSpace:'pre-wrap', fontFamily:'inherit'}}>{output || <span style={{color:'#475569', fontStyle:'italic'}}> Waiting for execution...</span>}</pre>
                            </div>
                            <div className="cc-footer">
                                <button onClick={runCode} disabled={verifying} className="cc-btn-run">{verifying ? <><i className="fas fa-circle-notch fa-spin"></i> Running...</> : <><i className="fas fa-play"></i> Run Code</>}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}