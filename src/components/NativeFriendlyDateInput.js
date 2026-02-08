import React from 'react';

// Helper: Ensure value is YYYY-MM-DD for the input
const normalizeToYMD = (value) => {
    if (!value) return '';
    const date = new Date(value);
    // Check if date is valid
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

// Helper: Nice display format (e.g., "12 Oct 2025")
const formatForDisplay = (value) => {
    if (!value) return 'Select Date';
    const date = new Date(value);
    if (isNaN(date.getTime())) return 'Select Date';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function NativeFriendlyDateInput({ value, onChange, required = false, min, max, className, style }) {
    const safeValue = normalizeToYMD(value);

    return (
        <div
            className={className}
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'white',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '0 12px',
                height: '48px',
                width: '100%',       /* ✅ Ensure it fills the parent width */
                minWidth: '140px',   /* ✅ Prevent it from getting too small */
                overflow: 'hidden',  /* ✅ Clip content if it gets too wide */
                cursor: 'pointer',
                ...style
            }}
        >
            {/* 1. VISIBLE PART (Design) */}
            <span style={{
                color: safeValue ? '#334155' : '#94a3b8',
                fontWeight: '600',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginRight: '8px'
            }}>
                {formatForDisplay(safeValue)}
            </span>
            
            <i className="fas fa-calendar-alt" style={{ color: '#64748b', flexShrink: 0 }}></i>

            {/* 2. INVISIBLE FUNCTIONAL PART (The Overlay) */}
            {/* This input sits ON TOP of the design. When you tap the box, you are actually tapping this input. */}
            <input
                type="date"
                required={required}
                value={safeValue}
                min={min}
                max={max}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,        /* ✅ Invisible but clickable */
                    zIndex: 10,        /* ✅ Stacks on top */
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    appearance: 'none',        /* ✅ Reset native styling */
                    WebkitAppearance: 'none'   /* ✅ Reset Safari/Chrome styling */
                }}
            />
        </div>
    );
}