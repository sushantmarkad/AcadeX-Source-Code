import React, { useState, useRef, useEffect } from 'react';
import './AiChatbot.css';

const API_URL = "https://acadex-backend-n2wh.onrender.com"; 

export default function AiChatbot({ user, isOpenProp, onClose }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'bot', text: `Hey ${user.firstName}! I am your AcadeX Coach. \n\nI can help you with:\n**1. Study Plans**\n**2. Career Roadmaps**\n**3. Subject Notes**\n\nType "Go" to start a mission!` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Sync open state with Dashboard button
    useEffect(() => {
        if (isOpenProp) setIsOpen(true);
    }, [isOpenProp]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        await processMessage(input, 'chat');
    };

    const handleQuickAction = (type) => {
        const topic = input.trim() || "Current Topic";
        let prompt = "";
        
        if (type === 'notes') prompt = `Generate revision notes for: ${topic}`;
        if (type === 'mcqs') prompt = `Generate 5 MCQs for: ${topic}`;
        
        processMessage(prompt, type);
    };

    const processMessage = async (textToSend, type = 'chat') => {
        // 1. Add User Message
        const userMessage = { sender: 'user', text: textToSend };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // 2. Determine Endpoint
            let endpoint = '/chat';
            let body = { 
                message: textToSend,
                userContext: {
                    firstName: user.firstName,
                    role: user.role,
                    department: user.department,
                    careerGoal: user.careerGoal || "General Engineering"
                }
            };

            if (type === 'notes') {
                endpoint = '/generateNotes';
                body = { topic: textToSend, department: user.department, level: 'Intermediate' };
            }
            if (type === 'mcqs') {
                endpoint = '/generateMCQs';
                body = { topic: textToSend, count: 5, department: user.department };
            }

            // 3. Call Backend
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Server Error");

            // 4. Handle Response (MCQ vs Text)
            let botResponse = data.reply || data.notes;
            
            if (type === 'mcqs' && data.mcqs) {
                // Format MCQs nicely
                botResponse = data.mcqs.map((m, i) => 
                    `**Q${i+1}: ${m.q}**\nA) ${m.options[0]}\nB) ${m.options[1]}\nC) ${m.options[2]}\nD) ${m.options[3]}\n\n*Answer: ${m.options[m.answerIndex]}*\n_(Exp: ${m.explanation})_`
                ).join('\n\n');
            }

            setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: "⚠️ My brain is buffering... Please try again!" }]);
        } finally {
            setLoading(false);
        }
    };

    const toggleChat = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (!newState && onClose) onClose();
    };

    // ✅ SMART MESSAGE RENDERER (Handles **Bold** and Links)
    const renderMessage = (text) => {
        if (!text) return null;
        let cleanText = text.replace(/^"|"$/g, '').replace(/\\n/g, '\n'); // Cleanup formatting

        return cleanText.split('\n').map((line, index) => {
            // 1. Split by Bold Markers (**)
            const parts = line.split(/(\*\*.*?\*\*)/g); 
            
            return (
                <div key={index} style={{ minHeight: '1.4em', marginBottom: '4px', lineHeight: '1.5' }}>
                    {parts.map((part, i) => {
                        // Bold Text
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i} style={{color: '#1e3a8a'}}>{part.slice(2, -2)}</strong>;
                        }
                        
                        // 2. Split by URLs for Links
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const subParts = part.split(urlRegex);
                        
                        return subParts.map((sub, j) => {
                            if (sub.match(urlRegex)) {
                                const cleanUrl = sub.replace(/[).,;]$/, ''); // Trim trailing punctuation
                                return (
                                    <a 
                                        key={j} 
                                        href={cleanUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="ai-link"
                                    >
                                        Link ↗
                                    </a>
                                );
                            }
                            return sub;
                        });
                    })}
                </div>
            );
        });
    };

    return (
        <>
            {/* Floating Button */}
            <div className={`ai-fab ${isOpen ? 'open' : ''}`} onClick={toggleChat}>
                {isOpen ? <i className="fas fa-times"></i> : <i className="fas fa-robot"></i>}
            </div>

            {/* Chat Window */}
            {isOpen && (
                <div className="ai-chat-window">
                    <div className="ai-header">
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <div style={{background:'rgba(255,255,255,0.2)', padding:'6px', borderRadius:'50%'}}>
                                <i className="fas fa-brain"></i>
                            </div>
                            <div>
                                <h3 style={{margin:0, fontSize:'16px'}}>AcadeX Coach</h3>
                                <span style={{fontSize:'10px', opacity:0.9, fontWeight:'400'}}>Powered by AI</span>
                            </div>
                        </div>
                    </div>

                    {/* ✅ QUICK ACTIONS BAR (Restored!) */}
                    <div className="ai-quick-actions">
                        <button onClick={() => handleQuickAction('notes')} disabled={loading} className="quick-btn">
                            📝 Notes
                        </button>
                        <button onClick={() => handleQuickAction('mcqs')} disabled={loading} className="quick-btn">
                            🧠 Quiz
                        </button>
                    </div>
                    
                    {/* Messages Area */}
                    <div className="ai-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message-bubble ${msg.sender}`}>
                                {renderMessage(msg.text)}
                            </div>
                        ))}
                        {loading && (
                            <div className="message-bubble bot">
                                <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="ai-input-area">
                        <input 
                            type="text" 
                            placeholder="Ask for help..." 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            disabled={loading}
                        />
                        <button onClick={handleSend} disabled={loading}>
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}