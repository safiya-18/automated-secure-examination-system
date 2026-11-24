import React, { useState } from 'react';
import { X, Sparkles, Check, AlertCircle } from 'lucide-react';
import { quizService } from '../services/api';

export default function CreateQuizModal({ isOpen, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 60,
    questionsPerStudent: 10,
    randomizeQuestions: true,
    randomizeOptions: true,
    allowRetake: false,
    startTime: '',
    endTime: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Quiz title is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        duration: Number(formData.duration),
        questionsPerStudent: Number(formData.questionsPerStudent) || 0,
        randomizeQuestions: Boolean(formData.randomizeQuestions),
        randomizeOptions: Boolean(formData.randomizeOptions),
        allowRetake: Boolean(formData.allowRetake),
      };

      if (formData.startTime) payload.startTime = new Date(formData.startTime).toISOString();
      if (formData.endTime) payload.endTime = new Date(formData.endTime).toISOString();

      const res = await quizService.createQuiz(payload);
      onCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create quiz. Please check parameters.');
    } finally {
      setLoading(false);
    }
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
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '36px',
        position: 'relative'
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

        <div style={{ marginBottom: '24px' }}>
          <div className="badge-pill badge-pink" style={{ marginBottom: '10px' }}>
            NEW ASSESSMENT SETUP
          </div>
          <h3 className="text-editorial-md" style={{ fontSize: '1.6rem', marginBottom: '6px' }}>
            Configure New Examination
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted-text)' }}>
            Quizzes are created in <strong>Draft</strong> status. Add questions before publishing.
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: '#FFEBEB',
            border: '2px solid #FF5252',
            borderRadius: '12px',
            color: '#D32F2F',
            fontSize: '0.88rem',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
              Quiz Title *
            </label>
            <input
              type="text"
              name="title"
              required
              placeholder="e.g. CS402: Distributed Systems Final Exam"
              value={formData.title}
              onChange={handleChange}
              className="input-neo"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
              Description & Syllabus Scope
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Provide instructions and scope for students..."
              value={formData.description}
              onChange={handleChange}
              className="input-neo"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Duration (Minutes) *
              </label>
              <input
                type="number"
                name="duration"
                min="1"
                max="360"
                required
                value={formData.duration}
                onChange={handleChange}
                className="input-neo"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Questions Per Student
              </label>
              <input
                type="number"
                name="questionsPerStudent"
                min="0"
                placeholder="0 = Assign Full Bank"
                value={formData.questionsPerStudent}
                onChange={handleChange}
                className="input-neo"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-text)', marginTop: '4px', display: 'block' }}>
                Enter 0 to assign all questions, or set a subset quota.
              </span>
            </div>
          </div>

          {/* Randomization Toggles */}
          <div style={{
            backgroundColor: 'var(--bg-cream)',
            border: '2px solid var(--border-dark)',
            borderRadius: '14px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="randomizeQuestions"
                checked={formData.randomizeQuestions}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)' }}
              />
              <span>Shuffle question order per student (Fisher-Yates)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="randomizeOptions"
                checked={formData.randomizeOptions}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)' }}
              />
              <span>Randomize multiple-choice option order</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="allowRetake"
                checked={formData.allowRetake}
                onChange={handleChange}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)' }}
              />
              <span>Allow multiple retakes (disabled by default for secure exams)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-neo btn-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-neo btn-cobalt"
            >
              {loading ? 'Creating...' : 'Create Quiz (Draft)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

