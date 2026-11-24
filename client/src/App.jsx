import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import FacultyWorkspace from './pages/faculty/FacultyWorkspace';
import QuizEditor from './pages/faculty/QuizEditor';
import QuizResults from './pages/faculty/QuizResults';
import AdminManagement from './pages/admin/AdminManagement';
import StudentAttend from './pages/student/StudentAttend';

// Role-Based Route Guard
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: '1.2rem',
        color: 'var(--dark-text)'
      }}>
        Initializing ASES Security Cluster...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If admin lands on faculty route or vice-versa, redirect sensibly
    return <Navigate to={user.role === 'admin' ? '/admin' : '/faculty'} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication */}
          <Route path="/login" element={<Login />} />

          {/* Student Attend Flow (Standalone, Zero Nav, Distraction Free) */}
          <Route path="/attend" element={<StudentAttend />} />
          <Route path="/attend/:quizId" element={<StudentAttend />} />

          {/* Admin Management (Single-Page, Role: Admin Only) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminManagement />
              </ProtectedRoute>
            }
          />

          {/* Faculty Workspace & Management (Role: Faculty, Admin) */}
          <Route
            path="/faculty"
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <FacultyWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/quizzes"
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <FacultyWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/quizzes/new"
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <QuizEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/quizzes/:quizId/edit"
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <QuizEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/results"
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <QuizResults />
              </ProtectedRoute>
            }
          />

          {/* Fallback Aliases */}
          <Route path="/faculty/questions" element={<Navigate to="/faculty/quizzes" replace />} />
          <Route path="/faculty/settings" element={<Navigate to="/faculty" replace />} />

          {/* Default Fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
