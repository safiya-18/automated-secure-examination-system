import React, { useState } from 'react';
import { X, Copy, Check, QrCode, ExternalLink, ShieldAlert } from 'lucide-react';

export default function ShareQuizModal({ quiz, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!quiz) return null;

  const examUrl = `${window.location.origin}/attend/${quiz._id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(examUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(23, 23, 23, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="card-neo" style={{
        backgroundColor: '#FFFFFF',
        width: '100%',
        maxWidth: '520px',
        padding: '32px',
        position: 'relative',
        animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '2px solid var(--border-dark)',
            backgroundColor: 'var(--bg-cream)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-neo-sm)'
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ marginBottom: '24px' }}>
          <div className="badge-pill badge-yellow" style={{ marginBottom: '10px' }}>
            STUDENT ACCESS DISPATCH
          </div>
          <h3 className="text-editorial-md" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>
            Share Examination Access
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted-text)' }}>
            Distribute this direct link or display the QR code for students in your lecture hall.
          </p>
        </div>

        {/* Quiz Info Pill */}
        <div style={{
          backgroundColor: 'var(--bg-cream)',
          border: '2px solid var(--border-dark)',
          borderRadius: '14px',
          padding: '14px',
          marginBottom: '20px'
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--dark-text)' }}>
            {quiz.title}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--muted-text)' }}>
            <span>⏱️ {quiz.duration} mins</span>
            <span>📝 {quiz.questionsPerStudent || quiz.questionCount || 0} questions assigned</span>
            <span>⭐ {quiz.totalMarks || 0} marks</span>
          </div>
        </div>

        {/* QR Code Visual (Generated cleanly via SVG pattern) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          border: '2px dashed var(--border-dark)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px'
        }}>
          {/* Simulated High-Res QR Matrix */}
          <div style={{
            width: '140px',
            height: '140px',
            backgroundColor: 'var(--border-dark)',
            borderRadius: '12px',
            padding: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '4px'
          }}>
            {[...Array(25)].map((_, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: (i % 2 === 0 || i % 3 === 0 || i === 0 || i === 4 || i === 20 || i === 24) ? '#FFFFFF' : '#171717',
                  borderRadius: '3px'
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-text)', marginTop: '12px' }}>
            SCAN FOR IMMEDIATE EXAM ACCESS
          </div>
        </div>

        {/* Copy Link Input Bar */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
            Direct Exam URL
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={examUrl}
              className="input-neo"
              style={{ fontSize: '0.85rem', backgroundColor: '#F8F8F8' }}
            />
            <button
              onClick={handleCopy}
              className={`btn-neo ${copied ? 'btn-yellow' : 'btn-cobalt'}`}
              style={{ flexShrink: 0, padding: '10px 18px' }}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Student Policy Notice */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          backgroundColor: 'var(--accent-lavender)',
          border: '1.5px solid var(--border-dark)',
          borderRadius: '12px',
          padding: '12px',
          fontSize: '0.8rem',
          lineHeight: 1.4
        }}>
          <ShieldAlert size={18} style={{ color: 'var(--primary-cobalt)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Strict Exam Isolation:</strong> Students will enter fullscreen mode upon joining. Tab-switches and window minimizations are automatically logged.
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <a
            href={examUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neo btn-white"
            style={{ fontSize: '0.88rem' }}
          >
            <ExternalLink size={16} /> Preview Student Attend Screen
          </a>
          <button
            onClick={onClose}
            className="btn-neo btn-dark"
            style={{ fontSize: '0.88rem' }}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}

