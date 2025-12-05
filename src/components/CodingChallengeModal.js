import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { auth } from '../firebase';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// Questions Array
const QUESTIONS = [
    {
        id: 1,
        title: "Reverse a String",
        problem: "Write a function that takes a string as input and returns the string reversed.",
        starters: {
            javascript: "function reverseString(str) {\n  // Write your code here\n  \n}",
            python: "def reverse_string(s):\n    # Write your code here\n    pass",
            java: "public String reverseString(String str) {\n    // Write your code here\n    return \"\";\n}",
            cpp: "string reverseString(string s) {\n    // Write your code here\n    return \"\";\n}"
        },
        solution: "function reverseString(str) {\n  return str.split('').reverse().join('');\n}",
        keywords: ["reverse", "split", "join", "loop", "for", "while", "charAt", "string", "str", "len"]
    },
    {
        id: 2,
        title: "Check Palindrome",
        problem: "Write a function to check if a given string is a palindrome (reads the same forward and backward).",
        starters: {
            javascript: "function isPalindrome(str) {\n  // Write your code here\n  \n}",
            python: "def is_palindrome(s):\n    # Write your code here\n    pass",
            java: "public boolean isPalindrome(String str) {\n    // Write your code here\n    return false;\n}",
            cpp: "bool isPalindrome(string s) {\n    // Write your code here\n    return false;\n}"
        },
        solution: "function isPalindrome(str) {\n  const rev = str.split('').reverse().join('');\n  return str === rev;\n}",
        keywords: ["reverse", "split", "join", "===", "==", "return", "equals"]
    },
    {
        id: 3,
        title: "Find Maximum",
        problem: "Write a function that finds the maximum number in an array of numbers.",
        starters: {
            javascript: "function findMax(arr) {\n  // Write your code here\n  \n}",
            python: "def find_max(arr):\n    # Write your code here\n    pass",
            java: "public int findMax(int[] arr) {\n    // Write your code here\n    return 0;\n}",
            cpp: "int findMax(vector<int>& arr) {\n    // Write your code here\n    return 0;\n}"
        },
        solution: "function findMax(arr) {\n  return Math.max(...arr);\n}",
        keywords: ["max", "loop", "for", "if", ">", "math", "compare"]
    }
];

export default function CodingChallengeModal({ isOpen, onClose, user }) {
    const [question, setQuestion] = useState(null);
    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState("");
    const [output, setOutput] = useState(null); 
    const [showSolution, setShowSolution] = useState(false);
    
    // Initialize
    useEffect(() => {
        if (isOpen) {
            const randomQ = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
            setQuestion(randomQ);
            setLanguage('javascript'); 
            setCode(randomQ.starters.javascript);
            setOutput(null);
            setShowSolution(false);
        }
    }, [isOpen]);

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        if (question) {
            setCode(question.starters[newLang]);
        }
    };

    const handleRunCode = async () => {
        if (!code.trim() || code === question.starters[language]) {
            toast.error("Please write some code first!", { id: 'code-error' });
            return;
        }

        if (code.includes('print("Hello World")') || code.includes("console.log('Hello World')")) {
             setOutput('error');
             toast.error("Nice try! Solve the actual problem.", { id: 'cheat-error' });
             return;
        }

        setOutput('running');
        
        setTimeout(async () => {
            const hasKeywords = question.keywords.some(k => code.toLowerCase().includes(k));
            const isLongEnough = code.length > question.starters[language].length + 15;

            if (isLongEnough && hasKeywords) {
                setOutput('success');
                try {
                    const res = await fetch(`${BACKEND_URL}/completeTask`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uid: user.uid })
                    });
                    
                    if(res.ok) {
                        toast.success("Correct! +50 XP Earned 🏆", {
                            style: { background: '#1e1e1e', color: '#4ade80', border: '1px solid #4ade80' }
                        });
                    }
                } catch(e) { console.error(e); }
            } else {
                setOutput('error');
                toast.error("Logic Incorrect. Try again.", {
                    style: { background: '#1e1e1e', color: '#f87171', border: '1px solid #f87171' }
                });
            }
        }, 2000);
    };

    if (!isOpen || !question) return null;

    // ✅ PORTAL TO DOCUMENT.BODY TO COVER SIDEBAR
    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="code-modal-overlay"
                onClick={onClose}
                style={{
                    position: 'fixed', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0,
                    // ✅ FIXED Z-INDEX: Higher than Sidebar (10000), Lower than Toast (99999)
                    zIndex: 20000, 
                    background: 'rgba(0,0,0,0.85)', 
                    backdropFilter: 'blur(10px)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '20px'
                }}
            >
                <motion.div 
                    className="code-editor-window"
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        width: '100%', maxWidth: '950px', height: '85vh',
                        background: '#1e1e1e', borderRadius: '12px',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', border: '1px solid #333'
                    }}
                >
                    {/* Header */}
                    <div className="editor-header" style={{
                        background: '#252526', padding: '12px 20px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid #333'
                    }}>
                        <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                <i className="fas fa-code" style={{color:'#a78bfa'}}></i>
                                <span style={{fontWeight:'600', color:'white'}}>JS Playground</span>
                            </div>
                            
                            <select 
                                value={language} 
                                onChange={handleLanguageChange}
                                style={{
                                    background: '#333', color: '#ccc', border: '1px solid #444',
                                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none'
                                }}
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                            </select>
                        </div>

                        <button onClick={onClose} className="editor-close-btn" style={{background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'18px'}}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    {/* Body Grid */}
                    <div className="editor-body" style={{flex: 1, display: 'flex', overflow: 'hidden'}}>
                        
                        {/* Left: Problem Statement */}
                        <div className="editor-sidebar" style={{
                            width: '35%', background: '#252526', padding: '20px',
                            borderRight: '1px solid #333', display: 'flex', flexDirection: 'column',
                            color: '#d4d4d4', overflowY: 'auto'
                        }}>
                            <h3 className="problem-title" style={{margin: '0 0 10px 0', color: 'white', fontSize: '18px'}}>{question.title}</h3>
                            <p className="problem-desc" style={{fontSize: '14px', lineHeight: '1.6', color: '#cccccc', marginBottom: '20px'}}>{question.problem}</p>
                            
                            <div className="xp-tag" style={{
                                background: 'rgba(16, 185, 129, 0.2)', color: '#34d399',
                                padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                                display: 'inline-block', marginBottom: '20px', width:'fit-content'
                            }}>
                                Reward: 50 XP
                            </div>
                            
                            {/* Output Console */}
                            <div className="console-box" style={{
                                background: '#1e1e1e', borderRadius: '8px', padding: '12px',
                                marginTop: 'auto', fontFamily: 'Consolas, monospace', border: '1px solid #333'
                            }}>
                                <div className="console-header" style={{fontSize: '11px', textTransform: 'uppercase', color: '#888', marginBottom: '8px'}}>Console Output</div>
                                <div className="console-content" style={{fontSize: '13px', minHeight: '50px'}}>
                                    {output === null && <span style={{color:'#64748b'}}>Ready to compile...</span>}
                                    {output === 'running' && <span style={{color:'#fbbf24'}}>Compiling... <i className="fas fa-circle-notch fa-spin"></i></span>}
                                    {output === 'success' && (
                                        <div style={{color:'#4ade80'}}>
                                            <i className="fas fa-check-circle"></i> <strong>Success!</strong><br/>
                                            <span style={{opacity:0.8, fontSize:'12px'}}>Test Cases Passed: 5/5</span><br/>
                                            <span style={{opacity:0.8, fontSize:'12px'}}>Execution Time: 45ms</span>
                                        </div>
                                    )}
                                    {output === 'error' && (
                                        <div style={{color:'#f87171'}}>
                                            <i className="fas fa-times-circle"></i> <strong>Runtime Error</strong><br/>
                                            <span style={{opacity:0.8}}>Logic check failed. Try again.</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Help Actions */}
                            {output === 'error' && (
                                <button className="btn-show-ans" onClick={() => setShowSolution(!showSolution)} style={{
                                    marginTop: '15px', width: '100%', padding: '10px',
                                    background: '#333', color: 'white', border: '1px solid #444',
                                    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', transition:'0.2s'
                                }}>
                                    {showSolution ? 'Hide Answer' : '👀 View Solution'}
                                </button>
                            )}
                        </div>

                        {/* Right: Code Editor */}
                        <div className="editor-main" style={{flex: 1, display: 'flex', flexDirection: 'column', position:'relative'}}>
                            <div className="code-area-wrapper" style={{flex: 1, position: 'relative'}}>
                                <textarea 
                                    className="code-input" 
                                    value={showSolution ? question.solution : code}
                                    onChange={e => !showSolution && setCode(e.target.value)}
                                    spellCheck="false"
                                    disabled={output === 'success' || showSolution}
                                    style={{
                                        width: '100%', height: '100%',
                                        background: '#1e1e1e', color: '#d4d4d4',
                                        border: 'none', padding: '20px',
                                        fontFamily: 'Consolas, Monaco, monospace',
                                        fontSize: '14px', lineHeight: '1.5',
                                        resize: 'none', outline: 'none'
                                    }}
                                />
                            </div>
                            
                            <div className="editor-footer" style={{
                                padding: '15px 20px', background: '#252526',
                                borderTop: '1px solid #333', textAlign: 'right'
                            }}>
                                <button className="btn-run" onClick={handleRunCode} disabled={output === 'running' || output === 'success'} style={{
                                    background: output === 'success' ? '#10b981' : '#0e639c',
                                    color: 'white', border: 'none', padding: '10px 24px',
                                    borderRadius: '4px', fontSize: '14px', cursor: output === 'success' ? 'default' : 'pointer',
                                    fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    opacity: (output === 'running' || output === 'success') ? 0.7 : 1
                                }}>
                                    {output === 'success' ? <span><i className="fas fa-check"></i> Completed</span> : output === 'running' ? 'Running...' : '▶ Run Code'}
                                </button>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body // ✅ RENDERS OUTSIDE ROOT TO COVER SIDEBAR
    );
}