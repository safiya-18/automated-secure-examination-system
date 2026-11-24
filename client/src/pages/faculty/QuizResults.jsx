import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Info, 
  Eye, 
  X, 
  Award,
  AlertTriangle,
  Sparkles,
  Layers
} from 'lucide-react';
import FacultySidebar from '../../components/FacultySidebar';
import { quizService, resultsService } from '../../services/api';

export default function QuizResults() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Attempt detail modal
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Load quizzes and submissions
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const quizRes = await quizService.getQuizzes();
        if (quizRes && quizRes.data) {
          setQuizzes(quizRes.data);
          if (quizRes.data.length > 0) {
            setSelectedQuizId(quizRes.data[0]._id);
          }
        }
        const subRes = await resultsService.getQuizSubmissions();
        if (subRes && subRes.data) {
          setSubmissions(subRes.data);
        }
      } catch (err) {
        console.error('Error loading results:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Filter submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesQuiz = !selectedQuizId || sub.quizId === selectedQuizId;
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      !q || 
      sub.studentName.toLowerCase().includes(q) || 
      sub.usn.toLowerCase().includes(q);
    return matchesQuiz && matchesStatus && matchesSearch;
  });

  // Calculate metrics
  const totalCount = filteredSubmissions.length;
  const avgScore = totalCount > 0 
    ? Math.round(filteredSubmissions.reduce((acc, s) => acc + s.percentage, 0) / totalCount)
    : 0;
  const cleanFocusCount = filteredSubmissions.filter((s) => s.focusEvents?.tabSwitches === 0).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-cream)' }}>
      <FacultySidebar />

      <main style={{ flex: 1, padding: '24px 32px 48px 24px', maxWidth: '1360px', overflowY: 'auto' }}>
        
        {/* Top Header */}
        <div style={{ marginBottom: '24px' }}>
          <div className="badge-pill badge-yellow" style={{ marginBottom: '8px' }}>
            ACADEMIC AUDIT & EVALUATION
          </div>
          <h1 className="text-editorial-lg" style={{ fontSize: '2rem', color: 'var(--dark-text)' }}>
            Assessment Submissions & Focus Telemetry
          </h1>
          <p style={{ color: 'var(--muted-text)', fontSize: '0.92rem' }}>
            Review candidate grades, completion time windows, and unverified focus interruption audit logs.
          </p>
        </div>

        {/* Temporary Mock Data Notice Banner (Backend Preparation) */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#FFFBE6',
          border: '2px solid #FFE58F',
          borderRadius: '16px',
          marginBottom: '28px',
          boxShadow: 'var(--shadow-neo-sm)'
        }}>
          <Info size={22} color="#D48806" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem', color: '#595959', lineHeight: 1.5 }}>
            <strong style={{ color: '#D48806' }}>[TEMPORARY_MOCK_DATA] Backend Integration Notice:</strong> The backend submission evaluation endpoints are scheduled for deployment in Phase 6. The records shown below represent structured student telemetry and grading records to validate the complete UI workflow without fake HTTP mocks.
          </div>
        </div>

        {/* Metric Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
          <div className="card-neo" style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)' }}>
              Candidate Submissions
            </div>
            <div className="text-editorial-lg" style={{ fontSize: '2.2rem', marginTop: '4px' }}>
              {totalCount}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '4px' }}>
              Finalized exam attempts recorded
            </div>
          </div>

          <div className="card-neo" style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)' }}>
              Cohort Average Grade
            </div>
            <div className="text-editorial-lg" style={{ fontSize: '2.2rem', color: 'var(--primary-cobalt)', marginTop: '4px' }}>
              {avgScore}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '4px' }}>
              Weighted assessment average
            </div>
          </div>

          <div className="card-neo" style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)' }}>
              Zero-Interruption Rate
            </div>
            <div className="text-editorial-lg" style={{ fontSize: '2.2rem', color: '#0B683B', marginTop: '4px' }}>
              {totalCount > 0 ? `${Math.round((cleanFocusCount / totalCount) * 100)}%` : '100%'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '4px' }}>
              Candidates with uninterrupted fullscreen focus
            </div>
          </div>
        </div>

        {/* Results Data Container */}
        <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '32px' }}>
          
          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px',
            paddingBottom: '20px',
            borderBottom: '2px solid var(--border-subtle)'
          }}>
            {/* Quiz Selector Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>Select Quiz:</label>
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="input-neo"
                style={{ width: 'auto', minWidth: '280px', padding: '8px 14px', fontSize: '0.85rem' }}
              >
                <option value="">All Quizzes ({quizzes.length})</option>
                {quizzes.map((q) => (
                  <option key={q._id} value={q._id}>
                    {q.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter & Search */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-neo"
                style={{ width: 'auto', padding: '8px 14px', fontSize: '0.85rem' }}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted Cleanly</option>
                <option value="auto_submitted">Auto-Submitted (Timeout)</option>
                <option value="in_progress">In Progress</option>
              </select>

              <div style={{ position: 'relative', minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="Search name or USN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-neo"
                  style={{ paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem' }}
                />
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--light-muted)' }} />
              </div>
            </div>
          </div>

          {/* Submissions Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-text)', fontWeight: 600 }}>
              Loading candidate examination records...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              backgroundColor: 'var(--bg-cream)',
              borderRadius: '16px',
              border: '2px dashed var(--border-dark)'
            }}>
              <BarChart3 size={40} style={{ color: 'var(--muted-text)', marginBottom: '10px' }} />
              <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '4px' }}>No Submissions Found</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
                {searchQuery ? `No candidates matching "${searchQuery}"` : 'Candidate submissions will appear here once students complete their exams.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-dark)', backgroundColor: 'var(--bg-cream)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Candidate</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>USN</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Score / Marks</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Duration</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Focus Telemetry</th>
                    <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((sub) => {
                    const tabSwitches = sub.focusEvents?.tabSwitches || 0;
                    return (
                      <tr
                        key={sub._id}
                        style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-cream)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {sub.studentName}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                          <span style={{ fontFamily: 'monospace', backgroundColor: '#F0ECE1', padding: '2px 6px', borderRadius: '4px' }}>
                            {sub.usn}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--dark-text)' }}>
                            {sub.obtainedMarks} / {sub.totalMarksPossible} pts
                          </div>
                          <div style={{ fontSize: '0.75rem', color: sub.percentage >= 75 ? '#0B683B' : 'var(--muted-text)', fontWeight: 700 }}>
                            {sub.percentage}% Score
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge-pill ${
                            sub.status === 'submitted' ? 'badge-mint' : sub.status === 'auto_submitted' ? 'badge-yellow' : 'badge-lavender'
                          }`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                            {sub.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--muted-text)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} />
                            <span>{sub.durationTakenMinutes} mins</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--light-muted)', marginTop: '2px' }}>
                            {new Date(sub.submittedAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {tabSwitches === 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#0B683B', fontWeight: 700 }}>
                              <CheckCircle2 size={14} /> Clean Focus
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              backgroundColor: '#FFF7E6',
                              border: '1.5px solid #FFA940',
                              color: '#D46B08',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}>
                              <ShieldAlert size={13} />
                              {tabSwitches} Focus Interruption{tabSwitches > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            onClick={() => setSelectedSubmission(sub)}
                            className="btn-neo btn-white"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            <Eye size={13} /> Audit Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

      </main>

      {/* ATTEMPT AUDIT DETAIL MODAL */}
      {selectedSubmission && (
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
            maxWidth: '560px',
            width: '100%',
            padding: '36px',
            position: 'relative'
          }}>
            <button
              onClick={() => setSelectedSubmission(null)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div className="badge-pill badge-pink" style={{ marginBottom: '8px' }}>
              ATTEMPT AUDIT TRAIL
            </div>
            <h3 className="text-editorial-md" style={{ fontSize: '1.5rem', marginBottom: '6px' }}>
              {selectedSubmission.studentName}
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted-text)', marginBottom: '20px' }}>
              USN: <strong>{selectedSubmission.usn}</strong> • Assessment: {selectedSubmission.quizTitle}
            </div>

            {/* Score Pill */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: 'var(--bg-cream)',
              borderRadius: '14px',
              border: '2px solid var(--border-dark)',
              marginBottom: '20px'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted-text)' }}>Final Score</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--primary-cobalt)' }}>
                  {selectedSubmission.obtainedMarks} / {selectedSubmission.totalMarksPossible} pts
                </div>
              </div>
              <div className="badge-pill badge-mint" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                {selectedSubmission.percentage}% GRADE
              </div>
            </div>

            {/* Focus Telemetry Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
                Proctor Focus Events (Academic Review Log)
              </div>
              <div style={{
                backgroundColor: '#FAFAFA',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted-text)' }}>Tab Switch Events:</span>
                  <strong>{selectedSubmission.focusEvents?.tabSwitches || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted-text)' }}>Window Blur / Loss of Focus:</span>
                  <strong>{selectedSubmission.focusEvents?.windowBlurs || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted-text)' }}>Fullscreen Window Exits:</span>
                  <strong>{selectedSubmission.focusEvents?.fullscreenExits || 0}</strong>
                </div>
              </div>
            </div>

            {/* Academic Policy Reminder (Security Requirement 6) */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#FFFBE6',
              border: '1.5px solid #FFE58F',
              borderRadius: '10px',
              fontSize: '0.78rem',
              color: '#874D00',
              lineHeight: 1.4,
              marginBottom: '20px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Academic Integrity Policy:</strong> Focus interruption records indicate that the browser window lost active state during the examination (e.g. system notifications or inadvertent clicking). They are provided for faculty review and are not automated evidence of academic dishonesty.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="btn-neo btn-dark"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Close Audit
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

