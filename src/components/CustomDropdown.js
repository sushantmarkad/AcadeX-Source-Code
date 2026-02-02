import React, { useState, useRef, useEffect } from 'react';

export default function CustomDropdown({ options, value, onChange, placeholder = "Select...", className }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (optionValue) => {
        onChange({ target: { value: optionValue } }); // Mimic native event
        setIsOpen(false);
    };

    // Find label for selected value
    const selectedLabel = options.find(opt => opt.value === value)?.label || value || placeholder;

    return (
        <div className={`custom-dropdown ${className}`} ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            {/* Display Box */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px',
                    color: '#334155'
                }}
            >
                <span>{selectedLabel}</span>
                <i className={`fas fa-chevron-down ${isOpen ? 'fa-rotate-180' : ''}`} style={{ transition: '0.2s', fontSize: '12px', color: '#94a3b8' }}></i>
            </div>

            {/* Dropdown List */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '110%',
                    left: 0,
                    width: '100%',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    zIndex: 50,
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    {options.map((opt) => (
                        <div 
                            key={opt.value} 
                            onClick={() => handleSelect(opt.value)}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: value === opt.value ? '#2563eb' : '#334155',
                                background: value === opt.value ? '#eff6ff' : 'white',
                                borderBottom: '1px solid #f1f5f9'
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}