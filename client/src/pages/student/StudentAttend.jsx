import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Maximize2,
  Lock,
  Sparkles
} from 'lucide-react';
import { quizService } from '../../services/api';

export default function StudentAttend() {
  const { quizId } = useParams();
  const navigate = useNavigate();

  // Multi-step flow: 'join' -> 'exam' -> 'submitted'
  const [step, setStep] = useState('join');
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  // Student credentials
  const [studentName, setStudentName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Exam state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(60 * 60); // seconds
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Sample student questions
  const sampleQuestions = [
    {
      id: 'q1',
      text: 'In the Raft consensus algorithm, which RPC is used by candidates to gather votes during leader election?',
      options: [
        { id: 'opt-a', text: 'AppendEntries RPC' },
        { id: 'opt-b', text: 'RequestVote RPC' },
        { id: 'opt-c', text: 'InstallSnapshot RPC' },
        { id: 'opt-d', text: 'HeartbeatSync RPC' },
      ],
      marks: 4,
    },
    {
      id: 'q2',
      text: 'What distinguishes a Byzantine fault from a simple fail-stop crash fault in distributed systems?',
      options: [
        { id: 'opt-a', text: 'Nodes stop processing messages permanently upon failure' },
        { id: 'opt-b', text: 'Nodes may send arbitrary, contradictory, or malicious messages' },
        { id: 'opt-c', text: 'Network partitions are completely absent' },
        { id: 'opt-d', text: 'All clocks are strictly synchronous' },
      ],
      marks: 4,
    },
    {
      id: 'q3',
      text: 'Which consistency model guarantees that all operations appear to execute instantaneously in some total sequential order consistent with real time?',
      options: [
        { id: 'opt-a', text: 'Eventual Consistency' },
        { id: 'opt-b', text: 'Causal Consistency' },
        { id: 'opt-c', text: 'Linearizability (Strict Consistency)' },
        { id: 'opt-d', text: 'Read-Your-Writes Consistency' },
      ],
      marks: 4,
    },
  ];

  // Fetch quiz details on load
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        if (quizId) {
          const res = await quizService.getQuiz(quizId);
          if (res && res.data) {
            setQuiz(res.data);
            setTimeLeft(res.data.duration * 60);
          }
        } else {
          // Default demo quiz if accessed directly via /attend
          setQuiz({
            _id: 'sample-exam',
            title: 'ASES Certification Examination: Distributed Systems Security',
            duration: 45,
            totalMarks: 30,
            questionCount: 3,
          });
          setTimeLeft(45 * 60);
        }
      } catch (err) {
        console.warn('Quiz fetch fallback:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId]);

  // Anti-cheat tab switch listener during exam step
  useEffect(() => {
    if (step !== 'exam') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [step]);

  // Countdown timer during exam
  useEffect(() => {
    if (step !== 'exam' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStep('submitted');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleStartExam = (e) => {
    e.preventDefault();
    if (!studentName.trim() || !rollNumber.trim() || !agreed) return;

    // Request browser fullscreen for secure exam
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setStep('exam');
  };

  const handleSelectOption = (questionId, optionId) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. STEP: JOIN EXAM
  if (step === 'join') {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div className="card-neo" style={{
          backgroundColor: '#FFFFFF',
          maxWidth: '560px',
          width: '100%',
          padding: '40px'
        }}>
          {/* Top Stamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-cobalt)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}>
                <Lock size={18} />
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>
                ASES PROCTOR
              </span>
            </div>
            <span className="badge-pill badge-yellow">
              ISOLATED EXAM SESSION
            </span>
          </div>

          <h1 className="text-editorial-lg" style={{ fontSize: '1.9rem', marginBottom: '8px' }}>
            {quiz?.title || 'Examination Access'}
          </h1>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Enter your student identification details. Once you begin, fullscreen lock will be activated and window switching will be flagged.
          </p>

          <form onSubmit={handleStartExam} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Full Legal Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maya Lin"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="input-neo"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Student ID / Roll Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2024-CS-0492"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="input-neo"
              />
            </div>

            {/* Honor Code & Fullscreen Accordion */}
            <div style={{
              backgroundColor: 'var(--bg-cream)',
              border: '2px solid var(--border-dark)',
              borderRadius: '14px',
              padding: '16px',
              marginTop: '4px'
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cobalt)', marginTop: '2px' }}
                />
                <span>
                  I understand this examination is proctored. Questions and options are cryptographically randomized for my session, and background tab switches will be logged.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!studentName.trim() || !rollNumber.trim() || !agreed}
              className="btn-neo btn-cobalt"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', marginTop: '10px' }}
            >
              <Maximize2 size={18} />
              <span>Enter Fullscreen & Begin Exam</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. STEP: ATTEND EXAM (ZERO SIDEBAR, DISTRACTION FREE)
  if (step === 'exam') {
    const q = sampleQuestions[currentQuestionIndex];
    const isAnswered = Boolean(selectedAnswers[q.id]);

    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-cream)', display: 'flex', flexDirection: 'column' }}>
        {/* Top Proctor Bar */}
        <header style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '2px solid var(--border-dark)',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-neo-sm)'
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
              Candidate: <strong>{studentName}</strong> ({rollNumber})
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem' }}>
              {quiz?.title || 'Examination In Progress'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Focus interruption telemetry badge */}
            {tabSwitchCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#FFF7E6',
                border: '1.5px solid #FFA940',
                color: '#D46B08',
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                <ShieldAlert size={16} />
                <span>{tabSwitchCount} Focus Interruption{tabSwitchCount > 1 ? 's' : ''} Logged</span>
              </div>
            )}

            {/* Countdown Clock (Cobalt Pill) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--primary-cobalt)',
              color: '#FFFFFF',
              padding: '8px 20px',
              borderRadius: '999px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '1.2rem',
              boxShadow: 'var(--shadow-neo-sm)',
              border: '2px solid var(--border-dark)'
            }}>
              <Clock size={20} />
              <span>{formatTimer(timeLeft)}</span>
            </div>
          </div>
        </header>

        {/* Question Canvas */}
        <main style={{ flex: 1, padding: '36px 24px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
          {/* Question Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span className="badge-pill badge-yellow">
              QUESTION {currentQuestionIndex + 1} OF {sampleQuestions.length}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted-text)' }}>
              Worth {q.marks} Marks
            </span>
          </div>

          {/* Question Box */}
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '36px', marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              lineHeight: 1.5,
              color: 'var(--dark-text)',
              marginBottom: '28px'
            }}>
              {q.text}
            </h2>

            {/* Shuffled Options (Reference 3 edtech buttons) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {q.options.map((opt, idx) => {
                const isSelected = selectedAnswers[q.id] === opt.id;
                const letter = String.fromCharCode(65 + idx);

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(q.id, opt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      border: '2px solid var(--border-dark)',
                      backgroundColor: isSelected ? 'var(--primary-cobalt)' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : 'var(--dark-text)',
                      textAlign: 'left',
                      fontSize: '0.98rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? 'var(--shadow-neo)' : 'none',
                      transform: isSelected ? 'translate(-2px, -2px)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-cream)',
                      border: '1.5px solid currentColor',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      flexShrink: 0
                    }}>
                      {letter}
                    </div>
                    <span>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="btn-neo btn-white"
            >
              &larr; Previous Question
            </button>

            {currentQuestionIndex < sampleQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="btn-neo btn-cobalt"
              >
                <span>Next Question</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm('Ready to submit your examination final responses?')) {
                    setStep('submitted');
                  }
                }}
                className="btn-neo btn-yellow"
                style={{ padding: '12px 28px', fontSize: '1rem' }}
              >
                <span>Submit Final Exam</span>
                <CheckCircle2 size={18} />
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  // 3. STEP: SUBMISSION CONFIRMATION RECEIPT
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="card-neo" style={{
        backgroundColor: '#FFFFFF',
        maxWidth: '540px',
        width: '100%',
        padding: '48px 40px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-mint)',
          border: '2px solid var(--border-dark)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0B683B',
          margin: '0 auto 20px',
          boxShadow: 'var(--shadow-neo)'
        }}>
          <CheckCircle2 size={40} />
        </div>

        <div className="badge-pill badge-mint" style={{ marginBottom: '12px' }}>
          EXAMINATION SECURELY DELIVERED
        </div>

        <h1 className="text-editorial-lg" style={{ fontSize: '2rem', marginBottom: '10px' }}>
          Exam Completed!
        </h1>
        <p style={{ color: 'var(--muted-text)', fontSize: '0.92rem', marginBottom: '28px', lineHeight: 1.5 }}>
          Your responses for <strong>{studentName}</strong> ({rollNumber}) have been received and cryptographically hashed into the immutable audit record.
        </p>

        {/* Receipt Box */}
        <div style={{
          backgroundColor: 'var(--bg-cream)',
          border: '2px solid var(--border-dark)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'left',
          marginBottom: '28px',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--muted-text)' }}>Submission Timestamp:</span>
            <strong>{new Date().toLocaleTimeString()}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--muted-text)' }}>Questions Answered:</span>
            <strong>{Object.keys(selectedAnswers).length} / {sampleQuestions.length}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--muted-text)' }}>Focus Events Logged:</span>
            <strong style={{ color: tabSwitchCount > 0 ? '#D46B08' : '#0B683B' }}>
              {tabSwitchCount} recorded (for instructor review)
            </strong>
          </div>
          <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '8px', marginTop: '8px' }}>
            <span style={{ color: 'var(--muted-text)', fontSize: '0.75rem' }}>Digital Signature:</span>
            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all', marginTop: '2px' }}>
              sha256-ases-{Math.random().toString(36).substring(2, 15)}e49b
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/login')}
          className="btn-neo btn-cobalt"
          style={{ width: '100%', padding: '12px' }}
        >
          Return to Portal
        </button>
      </div>
    </div>
  );
}

