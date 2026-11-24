import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  UserPlus, 
  FileSpreadsheet, 
  Search, 
  X, 
  Check, 
  AlertCircle, 
  LogOut,
  Sparkles,
  GraduationCap,
  Upload,
  RefreshCw
} from 'lucide-react';
import { adminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AdminManagement() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  // Modals state
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Form states
  const [facultyForm, setFacultyForm] = useState({ name: '', email: '', password: '' });
  const [studentForm, setStudentForm] = useState({ name: '', email: '', usn: '', password: '' });
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await adminService.getUsers(params);
      if (res && res.users) {
        setUsers(res.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Add Faculty handler
  const handleAddFaculty = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSubmitting(true);
    try {
      await adminService.createFaculty(facultyForm);
      showToast(`Faculty "${facultyForm.name}" registered successfully!`);
      setIsFacultyModalOpen(false);
      setFacultyForm({ name: '', email: '', password: '' });
      loadUsers();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to create faculty');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Add Student handler
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSubmitting(true);
    try {
      await adminService.createStudent(studentForm);
      showToast(`Student "${studentForm.name}" registered successfully!`);
      setIsStudentModalOpen(false);
      setStudentForm({ name: '', email: '', usn: '', password: '' });
      loadUsers();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to create student');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Bulk Student handler
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkCsvText.trim()) {
      setModalError('Please paste CSV text or select a valid CSV file.');
      return;
    }
    setModalError('');
    setModalSubmitting(true);
    try {
      const res = await adminService.bulkCreateStudents(bulkCsvText);
      showToast(`Bulk upload completed! Imported ${res.insertedCount || 'records'}.`);
      setIsBulkModalOpen(false);
      setBulkCsvText('');
      loadUsers();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Bulk upload failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Filter in memory for instantaneous search response
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.usn?.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const facultyCount = users.filter((u) => u.role === 'faculty').length;
  const studentCount = users.filter((u) => u.role === 'student').length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-cream)', padding: '24px 32px' }}>
      
      {/* Toast Notification */}
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

      {/* Top Navbar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        backgroundColor: '#FFFFFF',
        padding: '18px 28px',
        borderRadius: '20px',
        border: '2px solid var(--border-dark)',
        boxShadow: 'var(--shadow-neo)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--border-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.3rem' }}>
              ASES Administration
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', fontWeight: 600 }}>
              Campus Academic User Registry & Access Control
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="badge-pill badge-yellow">
            ADMINISTRATOR: {user?.name || 'Super Admin'}
          </span>
          <button
            onClick={handleLogout}
            className="btn-neo btn-white"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <div className="card-neo" style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            Total Registered Users
          </div>
          <div className="text-editorial-lg" style={{ fontSize: '2.2rem', marginTop: '4px' }}>
            {users.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '6px' }}>
            Active campus roster across all departments
          </div>
        </div>

        <div className="card-neo" style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            Faculty Members
          </div>
          <div className="text-editorial-lg" style={{ fontSize: '2.2rem', color: 'var(--primary-cobalt)', marginTop: '4px' }}>
            {facultyCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '6px' }}>
            Authorized exam creators & graders
          </div>
        </div>

        <div className="card-neo" style={{ padding: '20px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-text)' }}>
            Registered Students
          </div>
          <div className="text-editorial-lg" style={{ fontSize: '2.2rem', color: '#0B683B', marginTop: '4px' }}>
            {studentCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '6px' }}>
            Unique USN credentials provisioned
          </div>
        </div>
      </div>

      {/* Main Single Page Content */}
      <div className="card-neo" style={{ backgroundColor: '#FFFFFF', padding: '32px' }}>
        
        {/* Controls Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Role Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: '', label: `All Users (${users.length})` },
              { id: 'faculty', label: `Faculty (${facultyCount})` },
              { id: 'student', label: `Students (${studentCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: '2px solid var(--border-dark)',
                  cursor: 'pointer',
                  backgroundColor: roleFilter === tab.id ? 'var(--border-dark)' : 'var(--bg-cream)',
                  color: roleFilter === tab.id ? '#FFFFFF' : 'var(--dark-text)',
                  boxShadow: roleFilter === tab.id ? 'var(--shadow-neo-sm)' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar & Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search by name, email, USN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-neo"
                style={{ paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--light-muted)' }} />
            </div>

            <button
              onClick={() => { setModalError(''); setIsFacultyModalOpen(true); }}
              className="btn-neo btn-cobalt"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <UserPlus size={16} />
              <span>Add Faculty</span>
            </button>

            <button
              onClick={() => { setModalError(''); setIsStudentModalOpen(true); }}
              className="btn-neo btn-yellow"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <GraduationCap size={16} />
              <span>Register Student</span>
            </button>

            <button
              onClick={() => { setModalError(''); setIsBulkModalOpen(true); }}
              className="btn-neo btn-white"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <FileSpreadsheet size={16} />
              <span>Bulk Students (CSV)</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-text)', fontWeight: 600 }}>
            Loading academic user roster...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: 'var(--bg-cream)',
            borderRadius: '16px',
            border: '2px dashed var(--border-dark)'
          }}>
            <Users size={40} style={{ color: 'var(--muted-text)', marginBottom: '10px' }} />
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '4px' }}>No Users Found</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
              {searchQuery ? `No records matching "${searchQuery}"` : 'Register faculty or students to populate the database.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-dark)', backgroundColor: 'var(--bg-cream)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>User Name</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Email Address</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>USN</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase' }}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr
                    key={u._id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-cream)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: '0.9rem' }}>
                      {u.name}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge-pill ${
                        u.role === 'admin' ? 'badge-cobalt' : u.role === 'faculty' ? 'badge-lavender' : 'badge-mint'
                      }`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.88rem', color: 'var(--muted-text)' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.88rem', fontWeight: 600 }}>
                      {u.usn ? (
                        <span style={{ fontFamily: 'monospace', backgroundColor: '#F0ECE1', padding: '2px 6px', borderRadius: '4px' }}>
                          {u.usn}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--light-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#0B683B' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0B683B' }}></span>
                        {u.accountStatus || 'active'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: 'var(--muted-text)' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* MODAL 1: ADD FACULTY */}
      {isFacultyModalOpen && (
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
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', maxWidth: '480px', width: '100%', padding: '32px', position: 'relative' }}>
            <button
              onClick={() => setIsFacultyModalOpen(false)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <div className="badge-pill badge-lavender" style={{ marginBottom: '8px' }}>FACULTY PROVISIONING</div>
            <h3 className="text-editorial-md" style={{ marginBottom: '16px' }}>Add Faculty Member</h3>

            {modalError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FFEBEB', border: '1.5px solid #FF5252', borderRadius: '10px', color: '#D32F2F', fontSize: '0.85rem', marginBottom: '16px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Alistair Vance"
                  value={facultyForm.name}
                  onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Institutional Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vance@college.edu"
                  value={facultyForm.email}
                  onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Temporary Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={facultyForm.password}
                  onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsFacultyModalOpen(false)} className="btn-neo btn-white">Cancel</button>
                <button type="submit" disabled={modalSubmitting} className="btn-neo btn-cobalt">
                  {modalSubmitting ? 'Registering...' : 'Register Faculty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER STUDENT */}
      {isStudentModalOpen && (
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
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', maxWidth: '480px', width: '100%', padding: '32px', position: 'relative' }}>
            <button
              onClick={() => setIsStudentModalOpen(false)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <div className="badge-pill badge-mint" style={{ marginBottom: '8px' }}>STUDENT PROVISIONING</div>
            <h3 className="text-editorial-md" style={{ marginBottom: '16px' }}>Register Individual Student</h3>

            {modalError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FFEBEB', border: '1.5px solid #FF5252', borderRadius: '10px', color: '#D32F2F', fontSize: '0.85rem', marginBottom: '16px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>University Roll / USN *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1MS21CS042"
                  value={studentForm.usn}
                  onChange={(e) => setStudentForm({ ...studentForm, usn: e.target.value.toUpperCase() })}
                  className="input-neo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maya.lin@student.college.edu"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={studentForm.password}
                  onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                  className="input-neo"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsStudentModalOpen(false)} className="btn-neo btn-white">Cancel</button>
                <button type="submit" disabled={modalSubmitting} className="btn-neo btn-yellow">
                  {modalSubmitting ? 'Registering...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BULK STUDENT REGISTRATION (CSV) */}
      {isBulkModalOpen && (
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
          <div className="card-neo" style={{ backgroundColor: '#FFFFFF', maxWidth: '580px', width: '100%', padding: '32px', position: 'relative' }}>
            <button
              onClick={() => setIsBulkModalOpen(false)}
              style={{ position: 'absolute', top: '18px', right: '18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <div className="badge-pill badge-pink" style={{ marginBottom: '8px' }}>BATCH CSV IMPORT</div>
            <h3 className="text-editorial-md" style={{ marginBottom: '8px' }}>Bulk Student Registration</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-text)', marginBottom: '16px' }}>
              Paste comma-separated student rows below. Format: <code>name,email,usn,password</code>
            </p>

            {modalError && (
              <div style={{ padding: '10px 14px', backgroundColor: '#FFEBEB', border: '1.5px solid #FF5252', borderRadius: '10px', color: '#D32F2F', fontSize: '0.85rem', marginBottom: '16px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleBulkUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>CSV Data</label>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkCsvText(
`name,email,usn,password
Aarav Gupta,aarav.g@student.college.edu,1MS22CS001,PassWord123!
Zara Khan,zara.k@student.college.edu,1MS22CS002,PassWord123!
Rohan Mehta,rohan.m@student.college.edu,1MS22CS003,PassWord123!`
                      );
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-cobalt)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Paste Sample Template
                  </button>
                </div>
                <textarea
                  rows={7}
                  placeholder={`name,email,usn,password\nJohn Doe,john@student.edu,1MS21CS001,PassWord123!`}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  className="input-neo"
                  style={{ fontFamily: 'monospace', fontSize: '0.82rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsBulkModalOpen(false)} className="btn-neo btn-white">Cancel</button>
                <button type="submit" disabled={modalSubmitting || !bulkCsvText.trim()} className="btn-neo btn-cobalt">
                  {modalSubmitting ? 'Importing Batch...' : 'Import Student Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

