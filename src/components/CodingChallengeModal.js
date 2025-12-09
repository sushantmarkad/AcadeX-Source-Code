import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function CodingChallengeModal({ isOpen, onClose, user, onComplete }) {
    const [challenge, setChallenge] = useState(null);
    const [code, setCode] = useState("");
    const [output, setOutput] = useState("");
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        if(isOpen && user) {
            const fetchChallenge = async () => {
                setLoading(true);
                try {
                    const res = await fetch(`${BACKEND_URL}/startInteractiveTask`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            taskType: 'Coding', 
                            userInterest: user.careerGoal || 'Technology' 
                        })
                    });
                    const data = await res.json();
                    
                    setChallenge(data);
                    setCode(data.starterCode || "// Write your solution here...");
                    setOutput("");
                } catch (e) {
                    toast.error("Failed to load challenge.");
                    onClose();
                } finally {
                    setLoading(false);
                }
            };
            fetchChallenge();
        }
    }, [isOpen, user]);

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
            
            setOutput(data.output || (data.correct ? "✅ Logic Correct" : "❌ Failed Test Cases"));
            
            if(data.correct) {
                toast.success("Correct! +50 XP");
                onComplete(50);
            } else {
                toast("Hint: " + data.hint, { icon: '💡' });
            }
        } catch (e) {
            setOutput("Server Error.");
        } finally {
            setVerifying(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="custom-modal-overlay">
            <div className="custom-modal-box" style={{maxWidth:'900px', height:'90vh', display:'flex', flexDirection:'column', background:'#1e1e1e', color:'white', padding:0, overflow:'hidden'}}>
                
                {/* Header */}
                <div style={{borderBottom:'1px solid #333', padding:'15px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#262626'}}>
                    {loading ? <span>Loading...</span> : (
                        <div>
                            <h3 style={{color:'#4ade80', margin:0, display:'flex', alignItems:'center', gap:'10px'}}>
                                <i className="fas fa-terminal"></i> {challenge?.title}
                            </h3>
                        </div>
                    )}
                    <button onClick={onClose} style={{background:'none', border:'none', color:'white', fontSize:'24px', cursor:'pointer'}}>×</button>
                </div>

                {loading ? (
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>
                        <div className="spinner" style={{borderTopColor:'#4ade80'}}></div>
                    </div>
                ) : (
                    <div style={{display:'flex', flex:1, overflow:'hidden'}}>
                        {/* Left: Problem */}
                        <div style={{width:'35%', borderRight:'1px solid #333', padding:'20px', overflowY:'auto', background:'#1e1e1e'}}>
                            <h4 style={{color:'#9ca3af', marginTop:0}}>Problem Statement</h4>
                            <p style={{lineHeight:'1.6', color:'#d4d4d4'}}>{challenge?.scenario}</p>
                            <div style={{marginTop:'20px', padding:'15px', background:'#333', borderRadius:'8px', fontSize:'13px', color:'#a3a3a3'}}>
                                <strong>Tip:</strong> The AI will check your logic, not just syntax.
                            </div>
                        </div>

                        {/* Right: Code Editor */}
                        <div style={{flex:1, display:'flex', flexDirection:'column', background:'#1e1e1e'}}>
                            <textarea 
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                style={{flex:1, background:'#171717', color:'#e5e5e5', border:'none', padding:'20px', fontFamily:'"Fira Code", monospace', fontSize:'14px', resize:'none', outline:'none', lineHeight:'1.5'}}
                                spellCheck="false"
                            />
                            
                            {/* Output Console */}
                            <div style={{height:'150px', background:'#0a0a0a', borderTop:'1px solid #333', padding:'15px', overflowY:'auto', fontFamily:'monospace', fontSize:'13px'}}>
                                <div style={{color:'#6b7280', marginBottom:'5px', fontWeight:'bold'}}>CONSOLE OUTPUT:</div>
                                <pre style={{margin:0, color: output.includes('❌') ? '#ef4444' : '#4ade80', whiteSpace:'pre-wrap'}}>{output}</pre>
                            </div>

                            {/* Actions */}
                            <div style={{padding:'15px', borderTop:'1px solid #333', background:'#262626', display:'flex', justifyContent:'flex-end'}}>
                                <button 
                                    onClick={runCode} 
                                    disabled={verifying}
                                    className="btn-primary" 
                                    style={{background: verifying ? '#4b5563' : '#2563eb', border:'none', borderRadius:'6px', padding:'10px 25px', fontWeight:'bold', cursor:'pointer'}}
                                >
                                    {verifying ? 'Running...' : 'Run Code'} <i className="fas fa-play" style={{marginLeft:'5px'}}></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}