import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Share2, 
  Clock, 
  FileQuestion, 
  Award, 
  Users, 
  CheckCircle2, 
  Archive, 
  Trash2, 
  ExternalLink,
  Sparkles,
  Layers,
  Calendar,
  AlertTriangle,
  Play,
  Edit3
} from 'lucide-react';
import FacultySidebar from '../../components/FacultySidebar';
import ShareQuizModal from '../../components/ShareQuizModal';
import CreateQuizModal from '../../components/CreateQuizModal';
import { quizService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function FacultyWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuizForShare, setSelectedQuizForShare] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Fetch quizzes
  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const res = await quizService.getQuizzes();
      if (res && res.data) {
        setQuizzes(res.data);
      }
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const showNotification = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleStatusChange = async (quizId, newStatus) => {
    try {
      await quizService.updateQuizStatus(quizId, newStatus);
      showNotification(`Quiz status transitioned to ${newStatus.toUpperCase()}`);
      loadQuizzes();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to transition status to ${newStatus}`);
    }
  };

  const handleDelete = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await quizService.deleteQuiz(quizId);
      showNotification('Quiz deleted successfully');
      loadQuizzes();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete quiz');
    }
  };

  const handleQuizCreated = (newQuiz) => {
    showNotification('Quiz created in Draft status! Add questions to publish.');
    loadQuizzes();
  };

  // Filter & Search
  const filteredQuizzes = quizzes.filter((q) => {
    const matchesFilter = filter === 'all' || q.status === filter;
    const matchesSearch = 
      q.title.toLowerCase().includes(search.toLowerCase()) || 
      (q.description && q.description.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Calculate Metrics
  const totalQuizzes = quizzes.length;
  const activeQuizzes = quizzes.filter((q) => q.status === 'published').length;
  const draftQuizzes = quizzes.filter((q) => q.status === 'draft').length;
  const archivedQuizzes = quizzes.filter((q) => q.status === 'archived').length;
  const totalAttempts = quizzes.reduce((sum, q) => sum + (q.attemptCount || 0), 0);

  // Formatted date string
  const todayStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-cream)' }}>
      {/* Dark Sidebar matching Reference 2 */}
      <FacultySidebar />

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        padding: '24px 32px 48px 24px',
        maxWidth: '1360px',
        overflowY: 'auto'
      }}>

        {/* Action Toast */}
        {actionMessage && (
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
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Top Header Bar matching Reference 2 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px'
        }}>
          <div>
            <h1 className="text-editorial-lg" style={{ color: 'var(--dark-text)', fontSize: '2rem' }}>
              Welcome back, {user?.name ? user.name.split(' ')[0] : 'Professor'}!
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-text)', fontSize: '0.88rem', fontWeight: 600, marginTop: '4px' }}>
              <Calendar size={15} />
              <span>{todayStr}</span>
              <span>•</span>
              <span className="badge-pill badge-mint" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                EXAM ENGINE READY
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => navigate('/faculty/quizzes/new')}
              className="btn-neo btn-cobalt"
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              <Plus size={18} />
              <span>+ Create Full Assessment</span>
            </button>
          </div>
        </div>

        {/* Coral/Dusty Pink Hero Banner matching Reference 2 "Good Job!" */}
        <div style={{
          backgroundColor: '#F9D5DA',
          border: '2px solid var(--border-dark)',
          borderRadius: '24px',
          padding: '28px 36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          boxShadow: 'var(--shadow-neo)'
        }}>
          <div style={{ maxWidth: '640px' }}>
            <div className="badge-pill badge-yellow" style={{ marginBottom: '10px' }}>
              AUTOMATED SECURE SYSTEM
            </div>
            <h2 className="text-editorial-md" style={{ fontSize: '1.7rem', color: 'var(--dark-text)', marginBottom: '8px' }}>
              Zero-Leakage Assessment Engine
            </h2>
            <p style={{ color: '#4A3B3E', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Each student receives an independent Fisher-Yates shuffled question permutation. Answer keys are strictly quarantined on the server until official grading conclusion.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-neo btn-yellow"
              style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}
            >
              <Plus size={18} />
              <span>Quick Create</span>
            </button>
          </div>
        </div>

        {/* 3 Metrics Summary Cards matching Reference 2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Metric 1 */}
          <div className="card-neo card-neo-hover" style={{ padding: '24px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  Total Quizzes
                </div>
                <div className="text-editorial-lg" style={{ fontSize: '2.4rem', color: 'var(--dark-text)', marginTop: '4px' }}>
                  {totalQuizzes}
                </div>
              </div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--primary-cobalt-light)',
                border: '1.5px solid var(--border-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-cobalt)'
              }}>
                <Layers size={22} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', fontSize: '0.78rem', color: 'var(--muted-text)' }}>
              <span><strong>{draftQuizzes}</strong> Drafts</span>
              <span>•</span>
              <span><strong>{archivedQuizzes}</strong> Archived</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="card-neo card-neo-hover" style={{ padding: '24px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  Active Exams
                </div>
                <div className="text-editorial-lg" style={{ fontSize: '2.4rem', color: 'var(--primary-cobalt)', marginTop: '4px' }}>
                  {activeQuizzes}
                </div>
              </div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--accent-mint)',
                border: '1.5px solid var(--border-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0B683B'
              }}>
                <CheckCircle2 size={22} />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: '#0B683B', fontWeight: 700 }}>
              ● Live & Accepting Student Submissions
            </div>
          </div>

          {/* Metric 3 */}
          <div className="card-neo card-neo-hover" style={{ padding: '24px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)', letterSpacing: '0.04em' }}>
                  Student Attempts
                </div>
                <div className="text-editorial-lg" style={{ fontSize: '2.4rem', color: 'var(--dark-text)', marginTop: '4px' }}>
                  {totalAttempts}
                </div>
              </div>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'var(--accent-yellow)',
                border: '1.5px solid var(--border-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--dark-text)'
              }}>
                <Users size={22} />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--muted-text)' }}>
              Proctored & Cryptographically Logged
            </div>
          </div>
        </div>

        {/* Quizzes List Section */}
        <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '32px' }}>
          
          {/* Filter Bar & Search */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '28px',
            paddingBottom: '20px',
            borderBottom: '2px solid var(--border-subtle)'
          }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'all', label: `All Quizzes (${totalQuizzes})` },
                { id: 'published', label: `Published (${activeQuizzes})` },
                { id: 'draft', label: `Drafts (${draftQuizzes})` },
                { id: 'archived', label: `Archived (${archivedQuizzes})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    border: '2px solid var(--border-dark)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: filter === tab.id ? 'var(--border-dark)' : 'var(--bg-cream)',
                    color: filter === tab.id ? '#FFFFFF' : 'var(--dark-text)',
                    boxShadow: filter === tab.id ? 'var(--shadow-neo-sm)' : 'none'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <input
                type="text"
                placeholder="Search quiz title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-neo"
                style={{ paddingLeft: '38px', paddingRight: '14px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.88rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--light-muted)' }} />
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-text)', fontWeight: 600 }}>
              Loading examination catalogue...
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '64px 20px',
              backgroundColor: 'var(--bg-cream)',
              borderRadius: '16px',
              border: '2px dashed var(--border-dark)'
            }}>
              <FileQuestion size={44} style={{ color: 'var(--muted-text)', marginBottom: '12px' }} />
              <h3 className="text-editorial-md" style={{ fontSize: '1.2rem', marginBottom: '6px' }}>
                No Assessments Found
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted-text)', marginBottom: '18px' }}>
                {search ? `No quizzes matching "${search}"` : 'Get started by creating your first secure examination.'}
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="btn-neo btn-cobalt"
              >
                <Plus size={16} /> Create New Quiz
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredQuizzes.map((quiz) => {
                const isPublished = quiz.status === 'published';
                const isDraft = quiz.status === 'draft';
                const isArchived = quiz.status === 'archived';

                return (
                  <div
                    key={quiz._id}
                    className="card-neo card-neo-hover"
                    style={{
                      padding: '24px',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}
                  >
                    {/* Top Row: Title, Status, and Metrics */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ maxWidth: '700px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span className={`badge-pill ${
                            isPublished ? 'badge-mint' : isDraft ? 'badge-yellow' : 'badge-lavender'
                          }`}>
                            {quiz.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted-text)', fontWeight: 600 }}>
                            Created {new Date(quiz.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: 'var(--dark-text)',
                          letterSpacing: '-0.01em'
                        }}>
                          {quiz.title}
                        </h3>
                        {quiz.description && (
                          <p style={{ fontSize: '0.88rem', color: 'var(--muted-text)', marginTop: '4px', lineHeight: 1.4 }}>
                            {quiz.description}
                          </p>
                        )}
                      </div>

                      {/* Right Quick Actions (Reference 3 button style) */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate(`/faculty/quizzes/${quiz._id}/edit`)}
                          className="btn-neo btn-yellow"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Edit3 size={15} />
                          <span>Edit & Questions</span>
                        </button>
                        <button
                          onClick={() => setSelectedQuizForShare(quiz)}
                          className="btn-neo btn-cobalt"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Share2 size={15} />
                          <span>Share Link & QR</span>
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Parameter Badges */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-cream)',
                      borderRadius: '12px',
                      border: '1.5px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--dark-text)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={15} style={{ color: 'var(--primary-cobalt)' }} />
                        <span>Duration: {quiz.duration} mins</span>
                      </div>
                      <span>•</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileQuestion size={15} style={{ color: 'var(--primary-cobalt)' }} />
                        <span>
                          Subset: {quiz.questionsPerStudent > 0 ? `${quiz.questionsPerStudent} / ${quiz.questionCount || 0} Pool` : `Full Bank (${quiz.questionCount || 0})`}
                        </span>
                      </div>
                      <span>•</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Award size={15} style={{ color: 'var(--primary-cobalt)' }} />
                        <span>Total Marks: {quiz.totalMarks || 0} pts</span>
                      </div>
                      <span>•</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={15} style={{ color: 'var(--primary-cobalt)' }} />
                        <span>Submissions: {quiz.attemptCount || 0}</span>
                      </div>
                    </div>

                    {/* Bottom Row: Lifecycle Transition & Management Actions */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      paddingTop: '8px'
                    }}>
                      {/* Left: Status transitions */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isDraft && (
                          <button
                            onClick={() => handleStatusChange(quiz._id, 'published')}
                            className="btn-neo btn-yellow"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            <Play size={14} />
                            <span>Publish Exam</span>
                          </button>
                        )}

                        {isPublished && (
                          <button
                            onClick={() => handleStatusChange(quiz._id, 'archived')}
                            className="btn-neo btn-white"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                          >
                            <Archive size={14} />
                            <span>Archive Exam</span>
                          </button>
                        )}

                        {isArchived && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--light-muted)', fontStyle: 'italic' }}>
                            Archived exams are locked from further attempts or edits.
                          </span>
                        )}
                      </div>

                      {/* Right: Questions & Delete */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a
                          href={`/attend/${quiz._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-neo btn-white"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          <ExternalLink size={14} /> Student View
                        </a>

                        {(isDraft || quiz.attemptCount === 0) && (
                          <button
                            onClick={() => handleDelete(quiz._id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-pill)',
                              border: '1.5px solid #FF5252',
                              backgroundColor: '#FFF1F1',
                              color: '#D32F2F',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* Share Link & QR Modal */}
      {selectedQuizForShare && (
        <ShareQuizModal
          quiz={selectedQuizForShare}
          onClose={() => setSelectedQuizForShare(null)}
        />
      )}

      {/* Create Quiz Modal */}
      <CreateQuizModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleQuizCreated}
      />
    </div>
  );
}

