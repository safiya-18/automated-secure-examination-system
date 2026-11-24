import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Play, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Sparkles,
  FileQuestion,
  HelpCircle,
  Clock,
  Shuffle
} from 'lucide-react';
import FacultySidebar from '../../components/FacultySidebar';
import { quizService } from '../../services/api';

export default function QuizEditor() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  const isCreating = !quizId || quizId === 'new';

  // Active sub-tab
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'questions' | 'bulk'

  // Quiz metadata state
  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    duration: 60,
    questionsPerStudent: 0,
    randomizeQuestions: true,
    randomizeOptions: true,
    allowRetake: false,
    startTime: '',
    endTime: '',
    status: 'draft',
    totalMarks: 0,
  });

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(!isCreating);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [errorBanner, setErrorBanner] = useState('');

  // Active question modal / form state for adding/editing
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    text: '',
    type: 'mcq',
    marks: 1,
    options: [
      { id: 'opt_1', text: '' },
      { id: 'opt_2', text: '' },
      { id: 'opt_3', text: '' },
      { id: 'opt_4', text: '' },
    ],
    correctOptionId: 'opt_1',
  });

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkFormat, setBulkFormat] = useState('json'); // 'json' | 'csv'

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Load Quiz & Questions
  useEffect(() => {
    if (isCreating) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const quizRes = await quizService.getQuiz(quizId);
        if (quizRes && quizRes.data) {
          setQuiz(quizRes.data);
        }
        const qRes = await quizService.getQuestions(quizId);
        if (qRes && qRes.questions) {
          setQuestions(qRes.questions);
        }
      } catch (err) {
        setErrorBanner(err.response?.data?.message || 'Failed to load quiz details');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [quizId, isCreating]);

  // Handle Quiz Settings Save
  const handleSaveQuiz = async (e) => {
    if (e) e.preventDefault();
    if (!quiz.title.trim()) {
      setErrorBanner('Quiz title cannot be empty.');
      return;
    }

    setSaving(true);
    setErrorBanner('');

    try {
      if (isCreating) {
        const created = await quizService.createQuiz({
          ...quiz,
          questionsPerStudent: Number(quiz.questionsPerStudent) || 0,
          duration: Number(quiz.duration) || 60,
        });
        showToast('Draft quiz created! Now add assessment questions.');
        navigate(`/faculty/quizzes/${created.data._id}/edit`, { replace: true });
      } else {
        await quizService.updateQuiz(quizId, {
          title: quiz.title,
          description: quiz.description,
          duration: Number(quiz.duration),
          questionsPerStudent: Number(quiz.questionsPerStudent) || 0,
          randomizeQuestions: Boolean(quiz.randomizeQuestions),
          randomizeOptions: Boolean(quiz.randomizeOptions),
          allowRetake: Boolean(quiz.allowRetake),
          startTime: quiz.startTime || null,
          endTime: quiz.endTime || null,
        });
        showToast('Quiz configuration updated successfully.');
      }
    } catch (err) {
      setErrorBanner(err.response?.data?.message || 'Failed to save quiz settings');
    } finally {
      setSaving(false);
    }
  };

  // Publish Quiz
  const handlePublish = async () => {
    if (questions.length === 0) {
      setErrorBanner('Cannot publish a quiz with 0 questions. Please add questions first.');
      return;
    }

    // Check subset invariant if subset mode is configured
    if (quiz.questionsPerStudent > 0) {
      if (quiz.questionsPerStudent > questions.length) {
        setErrorBanner(`Questions per student (${quiz.questionsPerStudent}) cannot exceed total question pool (${questions.length}).`);
        return;
      }
      const firstMark = questions[0].marks;
      const unequal = questions.some((q) => q.marks !== firstMark);
      if (unequal) {
        setErrorBanner('Equal Marks Invariant: When Questions Per Student is enabled, all questions must have the exact same marks to guarantee fair grading.');
        return;
      }
    }

    try {
      setSaving(true);
      await quizService.updateQuizStatus(quiz._id, 'published');
      setQuiz((prev) => ({ ...prev, status: 'published' }));
      showToast('🎉 Quiz published! Students can now access the exam.');
    } catch (err) {
      setErrorBanner(err.response?.data?.message || 'Failed to publish quiz');
    } finally {
      setSaving(false);
    }
  };

  // Open Question Modal
  const openNewQuestion = (type = 'mcq') => {
    setEditingQuestionId(null);
    if (type === 'true_false') {
      setQuestionForm({
        text: '',
        type: 'true_false',
        marks: 1,
        options: [
          { id: 'opt_1', text: 'True' },
          { id: 'opt_2', text: 'False' },
        ],
        correctOptionId: 'opt_1',
      });
    } else {
      setQuestionForm({
        text: '',
        type: 'mcq',
        marks: 1,
        options: [
          { id: 'opt_1', text: '' },
          { id: 'opt_2', text: '' },
          { id: 'opt_3', text: '' },
          { id: 'opt_4', text: '' },
        ],
        correctOptionId: 'opt_1',
      });
    }
    setIsQuestionModalOpen(true);
  };

  const openEditQuestion = (q) => {
    setEditingQuestionId(q._id);
    setQuestionForm({
      text: q.text,
      type: q.type || 'mcq',
      marks: q.marks || 1,
      options: q.options || [],
      correctOptionId: q.correctOptionId || q.options?.[0]?.id || 'opt_1',
    });
    setIsQuestionModalOpen(true);
  };

  // Save Question (Create or Update)
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.text.trim()) {
      alert('Question text is required.');
      return;
    }
    // Validate all options have text
    const emptyOpt = questionForm.options.some((o) => !o.text.trim());
    if (emptyOpt) {
      alert('All options must have non-empty text.');
      return;
    }

    try {
      if (editingQuestionId) {
        await quizService.updateQuestion(quizId, editingQuestionId, questionForm);
        showToast('Question updated successfully.');
      } else {
        await quizService.createQuestion(quizId, questionForm);
        showToast('Question added to quiz bank.');
      }
      setIsQuestionModalOpen(false);
      // Reload questions
      const qRes = await quizService.getQuestions(quizId);
      if (qRes && qRes.questions) setQuestions(qRes.questions);
      // Reload quiz marks
      const updatedQuiz = await quizService.getQuiz(quizId);
      if (updatedQuiz && updatedQuiz.data) setQuiz(updatedQuiz.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save question');
    }
  };

  // Delete Question
  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Delete this question from the bank?')) return;
    try {
      await quizService.deleteQuestion(quizId, qId);
      setQuestions((prev) => prev.filter((q) => q._id !== qId));
      showToast('Question removed.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete question');
    }
  };

  // Bulk Question Import Submit
  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    try {
      let payload = {};
      if (bulkFormat === 'json') {
        const parsed = JSON.parse(bulkText);
        payload = { questions: Array.isArray(parsed) ? parsed : parsed.questions };
      } else {
        // Simple CSV parsing into question format
        const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
        const dataLines = lines[0].toLowerCase().includes('text') ? lines.slice(1) : lines;
        const parsedQuestions = dataLines.map((line) => {
          const parts = line.split(',').map((p) => p.trim());
          return {
            text: parts[0] || 'Untitled Question',
            type: 'mcq',
            options: [
              { id: 'opt_1', text: parts[1] || 'Option A' },
              { id: 'opt_2', text: parts[2] || 'Option B' },
              { id: 'opt_3', text: parts[3] || 'Option C' },
              { id: 'opt_4', text: parts[4] || 'Option D' },
            ],
            correctOptionId: parts[5] || 'opt_1',
            marks: Number(parts[6]) || 1,
          };
        });
        payload = { questions: parsedQuestions };
      }

      const res = await quizService.bulkImportQuestions(quizId, payload);
      showToast(`Imported ${res.insertedCount || 'questions'} successfully!`);
      setBulkText('');
      setActiveTab('questions');
      const qRes = await quizService.getQuestions(quizId);
      if (qRes && qRes.questions) setQuestions(qRes.questions);
    } catch (err) {
      alert('Bulk import error: ' + (err.response?.data?.message || err.message));
    }
  };

  // Total Marks calculate
  const totalCalculatedMarks = questions.reduce((acc, q) => acc + (q.marks || 1), 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-cream)' }}>
      <FacultySidebar />

      <main style={{ flex: 1, padding: '24px 32px 48px 24px', maxWidth: '1360px', overflowY: 'auto' }}>
        
        {/* Toast */}
        {notification && (
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '32px',
            backgroundColor: 'var(--border-dark)',
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: 'var(--radius-pill)',
            border: '2px solid var(--accent-yellow)',
            fontWeight: 700,
            fontSize: '0.9rem',
            boxShadow: 'var(--shadow-neo)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={16} color="var(--accent-yellow)" />
            <span>{notification}</span>
          </div>
        )}

        {/* Top Header Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => navigate('/faculty/quizzes')}
              className="btn-neo btn-white"
              style={{ padding: '8px 14px' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Quizzes</span>
            </button>
            <div>
              <h1 className="text-editorial-lg" style={{ fontSize: '1.8rem', color: 'var(--dark-text)' }}>
                {isCreating ? 'Create Assessment' : (quiz.title || 'Edit Assessment')}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className={`badge-pill ${
                  quiz.status === 'published' ? 'badge-mint' : quiz.status === 'draft' ? 'badge-yellow' : 'badge-lavender'
                }`}>
                  {quiz.status.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-text)', fontWeight: 600 }}>
                  {questions.length} Questions In Bank • {totalCalculatedMarks} Total Marks
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSaveQuiz}
              disabled={saving}
              className="btn-neo btn-white"
              style={{ padding: '10px 20px' }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>

            {!isCreating && quiz.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={saving}
                className="btn-neo btn-yellow"
                style={{ padding: '10px 20px' }}
              >
                <Play size={16} />
                <span>Publish Exam</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            backgroundColor: '#FFEBEB',
            border: '2px solid #FF5252',
            borderRadius: '12px',
            color: '#D32F2F',
            fontSize: '0.88rem',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Sub-Tab Navigation Bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid var(--border-subtle)',
          paddingBottom: '12px'
        }}>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: '2px solid var(--border-dark)',
              cursor: 'pointer',
              backgroundColor: activeTab === 'settings' ? 'var(--primary-cobalt)' : '#FFFFFF',
              color: activeTab === 'settings' ? '#FFFFFF' : 'var(--dark-text)',
              boxShadow: activeTab === 'settings' ? 'var(--shadow-neo-sm)' : 'none'
            }}
          >
            1. Quiz Settings & Quota
          </button>

          <button
            onClick={() => {
              if (isCreating) {
                alert('Please save initial quiz settings first before managing questions.');
                return;
              }
              setActiveTab('questions');
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: '2px solid var(--border-dark)',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.6 : 1,
              backgroundColor: activeTab === 'questions' ? 'var(--primary-cobalt)' : '#FFFFFF',
              color: activeTab === 'questions' ? '#FFFFFF' : 'var(--dark-text)',
              boxShadow: activeTab === 'questions' ? 'var(--shadow-neo-sm)' : 'none'
            }}
          >
            2. Question Bank ({questions.length})
          </button>

          <button
            onClick={() => {
              if (isCreating) {
                alert('Please save initial quiz settings first before importing questions.');
                return;
              }
              setActiveTab('bulk');
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: '2px solid var(--border-dark)',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              opacity: isCreating ? 0.6 : 1,
              backgroundColor: activeTab === 'bulk' ? 'var(--primary-cobalt)' : '#FFFFFF',
              color: activeTab === 'bulk' ? '#FFFFFF' : 'var(--dark-text)',
              boxShadow: activeTab === 'bulk' ? 'var(--shadow-neo-sm)' : 'none'
            }}
          >
            3. Bulk Import (CSV / JSON)
          </button>
        </div>

        {/* TAB 1: QUIZ SETTINGS */}
        {activeTab === 'settings' && (
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '36px', maxWidth: '840px' }}>
            <div className="badge-pill badge-pink" style={{ marginBottom: '10px' }}>ASSESSMENT ARCHITECTURE</div>
            <h2 className="text-editorial-md" style={{ fontSize: '1.5rem', marginBottom: '18px' }}>
              General Configuration & Anti-Cheat Controls
            </h2>

            <form onSubmit={handleSaveQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Quiz Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS301: Advanced Distributed Systems Midterm"
                  value={quiz.title}
                  onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Description & Candidate Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Outline syllabus units covered, permitted scratch tools, and exam conduct..."
                  value={quiz.description || ''}
                  onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    required
                    value={quiz.duration}
                    onChange={(e) => setQuiz({ ...quiz, duration: e.target.value })}
                    className="input-neo"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Questions Per Student
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Assign Full Bank"
                    value={quiz.questionsPerStudent || 0}
                    onChange={(e) => setQuiz({ ...quiz, questionsPerStudent: e.target.value })}
                    className="input-neo"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--muted-text)', marginTop: '4px', display: 'block' }}>
                    Enter 0 to assign entire pool, or set a subset count (e.g. 15 out of 25).
                  </span>
                </div>
              </div>

              {/* Randomization Engine Toggles */}
              <div style={{
                backgroundColor: 'var(--bg-cream)',
                border: '2px solid var(--border-dark)',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  Per-Student Randomization Engine
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={quiz.randomizeQuestions}
                    onChange={(e) => setQuiz({ ...quiz, randomizeQuestions: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)' }}
                  />
                  <span>Cryptographically shuffle question order per student (Fisher-Yates)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={quiz.randomizeOptions}
                    onChange={(e) => setQuiz({ ...quiz, randomizeOptions: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)' }}
                  />
                  <span>Randomize multiple-choice option order independently per question</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={quiz.allowRetake}
                    onChange={(e) => setQuiz({ ...quiz, allowRetake: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)' }}
                  />
                  <span>Allow student re-takes (disabled by default for high-stakes examinations)</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" disabled={saving} className="btn-neo btn-cobalt" style={{ padding: '12px 28px' }}>
                  {saving ? 'Saving...' : isCreating ? 'Create & Proceed to Questions' : 'Save Quiz Settings'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: QUESTION BANK BUILDER */}
        {activeTab === 'questions' && (
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="badge-pill badge-yellow" style={{ marginBottom: '8px' }}>QUESTION REPOSITORY</div>
                <h2 className="text-editorial-md" style={{ fontSize: '1.5rem' }}>
                  Questions in Pool ({questions.length})
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted-text)', marginTop: '2px' }}>
                  Total Evaluated Marks: <strong>{totalCalculatedMarks} pts</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => openNewQuestion('mcq')}
                  className="btn-neo btn-cobalt"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Plus size={16} />
                  <span>+ Add MCQ</span>
                </button>

                <button
                  onClick={() => openNewQuestion('true_false')}
                  className="btn-neo btn-yellow"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  <Plus size={16} />
                  <span>+ Add True / False</span>
                </button>
              </div>
            </div>

            {questions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: 'var(--bg-cream)',
                borderRadius: '16px',
                border: '2px dashed var(--border-dark)'
              }}>
                <FileQuestion size={44} style={{ color: 'var(--muted-text)', marginBottom: '12px' }} />
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', marginBottom: '6px' }}>Question Bank is Empty</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--muted-text)', marginBottom: '16px' }}>
                  Add multiple choice or true/false questions manually, or use the bulk import tab.
                </p>
                <button onClick={() => openNewQuestion('mcq')} className="btn-neo btn-cobalt">
                  <Plus size={16} /> Add First Question
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {questions.map((q, idx) => (
                  <div
                    key={q._id || idx}
                    className="card-neo"
                    style={{ padding: '20px 24px', backgroundColor: 'var(--bg-cream)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="badge-pill badge-yellow" style={{ fontSize: '0.72rem' }}>
                          Q{idx + 1} • {q.type === 'true_false' ? 'TRUE/FALSE' : 'MCQ'}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary-cobalt)' }}>
                          {q.marks} Mark{q.marks > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditQuestion(q)}
                          className="btn-neo btn-white"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q._id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            border: '1.5px solid #FF5252',
                            backgroundColor: '#FFF1F1',
                            color: '#D32F2F',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', lineHeight: 1.4 }}>
                      {q.text}
                    </h4>

                    {/* Options list */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {(q.options || []).map((opt) => {
                        const isCorrect = q.correctOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: isCorrect ? '2px solid #0B683B' : '1px solid var(--border-subtle)',
                              backgroundColor: isCorrect ? '#E8F5E9' : '#FFFFFF',
                              fontSize: '0.85rem',
                              fontWeight: isCorrect ? 700 : 500,
                              color: isCorrect ? '#0B683B' : 'var(--dark-text)'
                            }}
                          >
                            <span style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: isCorrect ? '#0B683B' : 'var(--bg-cream)',
                              color: isCorrect ? '#FFFFFF' : 'var(--dark-text)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              {isCorrect ? '✓' : opt.id.replace('opt_', '')}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BULK QUESTION IMPORT */}
        {activeTab === 'bulk' && (
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '36px', maxWidth: '840px' }}>
            <div className="badge-pill badge-lavender" style={{ marginBottom: '10px' }}>BATCH ACCELERATION</div>
            <h2 className="text-editorial-md" style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
              Import Questions via CSV or JSON
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', marginBottom: '20px' }}>
              Directly upload or paste structured questions to populate the quiz bank in one batch.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setBulkFormat('json')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  border: '1.5px solid var(--border-dark)',
                  backgroundColor: bulkFormat === 'json' ? 'var(--border-dark)' : 'var(--bg-cream)',
                  color: bulkFormat === 'json' ? '#FFFFFF' : 'var(--dark-text)',
                  cursor: 'pointer'
                }}
              >
                JSON Array Format
              </button>

              <button
                type="button"
                onClick={() => setBulkFormat('csv')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  border: '1.5px solid var(--border-dark)',
                  backgroundColor: bulkFormat === 'csv' ? 'var(--border-dark)' : 'var(--bg-cream)',
                  color: bulkFormat === 'csv' ? '#FFFFFF' : 'var(--dark-text)',
                  cursor: 'pointer'
                }}
              >
                CSV Text Format
              </button>

              <button
                type="button"
                onClick={() => {
                  if (bulkFormat === 'json') {
                    setBulkText(JSON.stringify([
                      {
                        text: "Which consensus algorithm uses a randomized election timeout to elect leaders?",
                        type: "mcq",
                        marks: 2,
                        options: [
                          { id: "opt_1", text: "Paxos" },
                          { id: "opt_2", text: "Raft" },
                          { id: "opt_3", text: "Zab" },
                          { id: "opt_4", text: "Chandy-Lamport" }
                        ],
                        correctOptionId: "opt_2"
                      },
                      {
                        text: "True or False: Byzantine nodes can forge cryptographic digital signatures at will.",
                        type: "true_false",
                        marks: 2,
                        options: [
                          { id: "opt_1", text: "True" },
                          { id: "opt_2", text: "False" }
                        ],
                        correctOptionId: "opt_2"
                      }
                    ], null, 2));
                  } else {
                    setBulkText(
`text,optionA,optionB,optionC,optionD,correctOptionId,marks
Which algorithm uses term numbers to detect obsolete leaders?,Paxos,Raft,Two-Phase Commit,Gossip,opt_2,2
What guarantees linearizability in modern distributed datastores?,Eventual replication,Raft state machine,Vector clocks,Async queues,opt_2,2`
                    );
                  }
                }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary-cobalt)', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Insert Sample Template
              </button>
            </div>

            <form onSubmit={handleBulkImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea
                rows={10}
                required
                placeholder={bulkFormat === 'json' ? '[ { "text": "...", "options": [...] } ]' : 'text,optionA,optionB,optionC,optionD,correctOptionId,marks'}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="input-neo"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="submit" className="btn-neo btn-cobalt" style={{ padding: '12px 24px' }}>
                  <Upload size={16} /> Import Question Batch
                </button>
              </div>
            </form>
          </div>
        )}

      </main>

      {/* QUESTION MODAL (CREATE / EDIT) */}
      {isQuestionModalOpen && (
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
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '36px',
            position: 'relative'
          }}>
            <div className="badge-pill badge-yellow" style={{ marginBottom: '8px' }}>
              {editingQuestionId ? 'EDIT QUESTION' : 'NEW QUESTION PROVISION'}
            </div>
            <h3 className="text-editorial-md" style={{ fontSize: '1.5rem', marginBottom: '18px' }}>
              {editingQuestionId ? 'Modify Question' : 'Add Question to Bank'}
            </h3>

            <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Question Statement *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the prompt or problem statement..."
                  value={questionForm.text}
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Question Type
                  </label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      if (newType === 'true_false') {
                        setQuestionForm({
                          ...questionForm,
                          type: 'true_false',
                          options: [
                            { id: 'opt_1', text: 'True' },
                            { id: 'opt_2', text: 'False' },
                          ],
                          correctOptionId: 'opt_1',
                        });
                      } else {
                        setQuestionForm({
                          ...questionForm,
                          type: 'mcq',
                          options: [
                            { id: 'opt_1', text: '' },
                            { id: 'opt_2', text: '' },
                            { id: 'opt_3', text: '' },
                            { id: 'opt_4', text: '' },
                          ],
                          correctOptionId: 'opt_1',
                        });
                      }
                    }}
                    className="input-neo"
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="true_false">True / False</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Marks Awarded *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={questionForm.marks}
                    onChange={(e) => setQuestionForm({ ...questionForm, marks: Number(e.target.value) || 1 })}
                    className="input-neo"
                  />
                </div>
              </div>

              {/* Options Builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Answer Options (Select Correct Answer Radio) *
                  </label>
                  {questionForm.type === 'mcq' && questionForm.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextId = `opt_${questionForm.options.length + 1}`;
                        setQuestionForm({
                          ...questionForm,
                          options: [...questionForm.options, { id: nextId, text: '' }],
                        });
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--primary-cobalt)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {questionForm.options.map((opt, i) => (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="radio"
                        name="correctOption"
                        checked={questionForm.correctOptionId === opt.id}
                        onChange={() => setQuestionForm({ ...questionForm, correctOptionId: opt.id })}
                        style={{ width: '18px', height: '18px', accentColor: '#0B683B', cursor: 'pointer' }}
                        title="Mark as correct answer"
                      />
                      <input
                        type="text"
                        required
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...questionForm.options];
                          updated[i].text = e.target.value;
                          setQuestionForm({ ...questionForm, options: updated });
                        }}
                        className="input-neo"
                        style={{
                          backgroundColor: questionForm.correctOptionId === opt.id ? '#F2FFF6' : '#FFFFFF',
                          borderColor: questionForm.correctOptionId === opt.id ? '#0B683B' : 'var(--border-dark)',
                        }}
                      />
                      {questionForm.type === 'mcq' && questionForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = questionForm.options.filter((_, idx) => idx !== i);
                            setQuestionForm({
                              ...questionForm,
                              options: filtered,
                              correctOptionId: questionForm.correctOptionId === opt.id ? filtered[0].id : questionForm.correctOptionId,
                            });
                          }}
                          style={{ background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="btn-neo btn-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-neo btn-cobalt"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

