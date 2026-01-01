import React, { useState } from 'react';
import Papa from 'papaparse';
import { auth, sendPasswordResetEmail } from '../firebase'; 
import toast from 'react-hot-toast'; 
import './Dashboard.css';

// Using the same backend URL as your AddStudent.js
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function BulkAddStudents({ instituteId, instituteName }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const toastId = toast.loading("Reading file...");

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const students = results.data;
                const total = students.length;
                
                if (total === 0) {
                    toast.error("File is empty!", { id: toastId });
                    setLoading(false);
                    return;
                }

                toast.loading(`Processing ${total} students...`, { id: toastId });

                try {
                    // 1. Send data to Backend to create accounts
                    const response = await fetch(`${BACKEND_URL}/bulkCreateStudents`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            students, 
                            instituteId, 
                            instituteName 
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || "Upload failed");
                    }

                    // 2. Send Password Reset Emails to successful uploads
                    let emailCount = 0;
                    for (const email of data.success) {
                        try {
                            await sendPasswordResetEmail(auth, email);
                            emailCount++;
                        } catch (err) {
                            console.error("Email failed for:", email);
                        }
                    }

                    // 3. Update UI
                    setStats({
                        total: total,
                        success: data.success.length,
                        failed: data.errors.length
                    });

                    toast.success(`Done! Created ${data.success.length} students.`, { id: toastId });

                } catch (err) {
                    console.error(err);
                    toast.error("Upload failed: " + err.message, { id: toastId });
                } finally {
                    setLoading(false);
                }
            },
            error: (err) => {
                toast.error("CSV Error: " + err.message, { id: toastId });
                setLoading(false);
            }
        });
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Bulk Upload Students</h2>
            
            <div className="card">
                <h3>Step 1: Prepare your CSV</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>
                    Create an Excel/Sheet with these exact headers:<br/>
                    <code>firstName, lastName, email, rollNo, department, year, semester, collegeId</code>
                </p>
                
                <div style={{ padding: '20px', border: '2px dashed #ccc', borderRadius: '10px', textAlign: 'center' }}>
                    <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="csvUpload"
                        disabled={loading}
                    />
                    <label htmlFor="csvUpload" className="btn-primary" style={{ cursor: 'pointer', display: 'inline-block' }}>
                        {loading ? 'Uploading...' : 'Select CSV File'}
                    </label>
                    <p style={{ marginTop: '10px', fontSize: '0.9rem', color: '#888' }}>
                        {loading ? 'Please wait, this may take a minute...' : 'Supported format: .csv'}
                    </p>
                </div>
            </div>

            {/* Success/Error Report */}
            {stats.total > 0 && (
                <div className="card" style={{ marginTop: '20px' }}>
                    <h3>Upload Results</h3>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <div style={{ color: 'green', fontWeight: 'bold' }}>✅ Success: {stats.success}</div>
                        <div style={{ color: 'red', fontWeight: 'bold' }}>❌ Failed: {stats.failed}</div>
                    </div>
                    {stats.failed > 0 && <p style={{fontSize:'0.8rem', color:'#666', marginTop:'10px'}}>Check console for error details.</p>}
                </div>
            )}
        </div>
    );
}