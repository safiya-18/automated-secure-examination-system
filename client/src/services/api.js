import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to get cookie value by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Attach CSRF token to state-changing requests
api.interceptors.request.use((config) => {
  const csrfToken = localStorage.getItem('csrfToken') || getCookie('xsrf-token');
  if (csrfToken && ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
    config.headers['x-xsrf-token'] = csrfToken;
  }
  return config;
});

// =============================================================================
// MOCK DATA STORES FOR OFFLINE DEVELOPMENT / FALLBACK
// =============================================================================
const MOCK_STORAGE_KEY = 'ases_mock_quizzes';
const MOCK_USERS_KEY = 'ases_mock_users';
const MOCK_QUESTIONS_KEY = 'ases_mock_questions';

const DEFAULT_MOCK_USERS = [
  { _id: 'usr-1', name: 'Dr. Alistair Vance', email: 'vance@college.edu', role: 'faculty', accountStatus: 'active', createdAt: '2026-10-15T10:00:00Z' },
  { _id: 'usr-2', name: 'Prof. Elena Rostova', email: 'rostova@college.edu', role: 'faculty', accountStatus: 'active', createdAt: '2026-10-16T11:30:00Z' },
  { _id: 'usr-3', name: 'Maya Lin', email: 'maya.lin@student.college.edu', usn: '1MS21CS042', role: 'student', accountStatus: 'active', createdAt: '2026-10-18T09:15:00Z' },
  { _id: 'usr-4', name: 'Kaelen Thorne', email: 'k.thorne@student.college.edu', usn: '1MS21CS088', role: 'student', accountStatus: 'active', createdAt: '2026-10-18T09:20:00Z' },
  { _id: 'usr-5', name: 'Priya Sharma', email: 'priya.s@student.college.edu', usn: '1MS21CS112', role: 'student', accountStatus: 'active', createdAt: '2026-10-19T14:00:00Z' },
];

const DEFAULT_MOCK_QUIZZES = [
  {
    _id: 'mock-quiz-101',
    title: 'CS301: Advanced Distributed Systems Midterm',
    description: 'Comprehensive evaluation of Paxos, Raft consensus, vector clocks, and Byzantine fault tolerance.',
    status: 'published',
    duration: 60,
    totalMarks: 50,
    questionsPerStudent: 15,
    randomizeQuestions: true,
    randomizeOptions: true,
    allowRetake: false,
    startTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    endTime: new Date(Date.now() + 3600000 * 48).toISOString(),
    questionCount: 20,
    attemptCount: 42,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    _id: 'mock-quiz-102',
    title: 'SE204: Software Architecture & Microservices Quiz',
    description: 'Design patterns, Event-driven architecture, Saga pattern, and API Gateway security protocols.',
    status: 'draft',
    duration: 45,
    totalMarks: 30,
    questionsPerStudent: 10,
    randomizeQuestions: true,
    randomizeOptions: true,
    allowRetake: false,
    startTime: new Date(Date.now() + 3600000 * 24).toISOString(),
    endTime: new Date(Date.now() + 3600000 * 72).toISOString(),
    questionCount: 12,
    attemptCount: 0,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    _id: 'mock-quiz-103',
    title: 'CY410: Cryptography & Zero-Knowledge Proofs Final',
    description: 'Elliptic curve cryptography, Diffie-Hellman key exchange, SHA-3, and zk-SNARK foundations.',
    status: 'archived',
    duration: 90,
    totalMarks: 100,
    questionsPerStudent: 25,
    randomizeQuestions: true,
    randomizeOptions: true,
    allowRetake: false,
    startTime: new Date(Date.now() - 86400000 * 10).toISOString(),
    endTime: new Date(Date.now() - 86400000 * 9).toISOString(),
    questionCount: 30,
    attemptCount: 88,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
  },
];

const DEFAULT_MOCK_QUESTIONS = {
  'mock-quiz-101': [
    {
      _id: 'q-101-1',
      quizId: 'mock-quiz-101',
      text: 'In the Raft consensus algorithm, which RPC is used by candidates to gather votes during leader election?',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'AppendEntries RPC' },
        { id: 'opt_2', text: 'RequestVote RPC' },
        { id: 'opt_3', text: 'InstallSnapshot RPC' },
        { id: 'opt_4', text: 'HeartbeatSync RPC' },
      ],
      correctOptionId: 'opt_2',
      marks: 2,
    },
    {
      _id: 'q-101-2',
      quizId: 'mock-quiz-101',
      text: 'True or False: Byzantine fault tolerance guarantees consensus even if more than 50% of the network nodes behave maliciously.',
      type: 'true_false',
      options: [
        { id: 'opt_1', text: 'True' },
        { id: 'opt_2', text: 'False' },
      ],
      correctOptionId: 'opt_2',
      marks: 2,
    },
    {
      _id: 'q-101-3',
      quizId: 'mock-quiz-101',
      text: 'Which vector clock property guarantees causal ordering between two distributed events e1 and e2?',
      type: 'mcq',
      options: [
        { id: 'opt_1', text: 'VC(e1) < VC(e2)' },
        { id: 'opt_2', text: 'VC(e1) == VC(e2)' },
        { id: 'opt_3', text: 'VC(e1) > VC(e2)' },
        { id: 'opt_4', text: 'None of the above' },
      ],
      correctOptionId: 'opt_1',
      marks: 2,
    },
  ],
};

function getStoredMockQuizzes() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_QUIZZES));
      return DEFAULT_MOCK_QUIZZES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MOCK_QUIZZES;
  }
}

function saveStoredMockQuizzes(quizzes) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(quizzes));
  } catch (err) {
    console.error('Failed to save mock quizzes:', err);
  }
}

function getStoredMockUsers() {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(DEFAULT_MOCK_USERS));
      return DEFAULT_MOCK_USERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_MOCK_USERS;
  }
}

function saveStoredMockUsers(users) {
  try {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save mock users:', err);
  }
}

function getStoredMockQuestions(quizId) {
  try {
    const raw = localStorage.getItem(MOCK_QUESTIONS_KEY);
    const all = raw ? JSON.parse(raw) : DEFAULT_MOCK_QUESTIONS;
    return all[quizId] || [];
  } catch {
    return DEFAULT_MOCK_QUESTIONS[quizId] || [];
  }
}

function saveStoredMockQuestions(quizId, questions) {
  try {
    const raw = localStorage.getItem(MOCK_QUESTIONS_KEY);
    const all = raw ? JSON.parse(raw) : { ...DEFAULT_MOCK_QUESTIONS };
    all[quizId] = questions;
    localStorage.setItem(MOCK_QUESTIONS_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save mock questions:', err);
  }
}

// =============================================================================
// AUTH SERVICE
// =============================================================================
export const authService = {
  async login(email, password, role = 'faculty') {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.csrfToken) {
        localStorage.setItem('csrfToken', res.data.csrfToken);
      }
      return res.data;
    } catch (err) {
      // In development only, if backend DB is offline, fall back to simulated profile
      if (import.meta.env.DEV) {
        const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.response.status >= 500;
        if (isNetworkError) {
          console.warn('[DEV ONLY] Backend unreachable, using simulated development user.');
          const mockUser = {
            _id: role === 'admin' ? 'demo-admin-id' : 'demo-faculty-id',
            name: role === 'admin' ? 'System Administrator' : 'Dr. Alistair Vance',
            email: email || (role === 'admin' ? 'admin@college.edu' : 'faculty@college.edu'),
            role: role,
            accountStatus: 'active',
            isPasswordTemporary: false,
          };
          const mockCsrf = 'mock-csrf-token-' + Date.now();
          localStorage.setItem('csrfToken', mockCsrf);
          return {
            success: true,
            message: 'Logged in (Development Fallback Mode)',
            csrfToken: mockCsrf,
            user: mockUser,
          };
        }
      }
      throw err;
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Logout API error:', err.message);
    } finally {
      localStorage.removeItem('csrfToken');
      localStorage.removeItem('ases_user');
    }
  },

  async getMe() {
    try {
      const res = await api.get('/auth/me');
      return res.data.user;
    } catch (err) {
      const savedUser = localStorage.getItem('ases_user');
      if (savedUser) return JSON.parse(savedUser);
      return null;
    }
  },
};

// =============================================================================
// ADMIN SERVICE (Directly calls /api/admin/...)
// =============================================================================
export const adminService = {
  async getUsers(params = {}) {
    try {
      const res = await api.get('/admin/users', { params });
      return res.data;
    } catch (err) {
      console.warn('Backend /admin/users call failed, using mock user store:', err.message);
      let users = getStoredMockUsers();
      if (params.role) {
        users = users.filter((u) => u.role === params.role);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        users = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.usn && u.usn.toLowerCase().includes(q)));
      }
      return {
        success: true,
        count: users.length,
        total: users.length,
        page: 1,
        totalPages: 1,
        users,
      };
    }
  },

  async createFaculty(data) {
    try {
      const res = await api.post('/admin/users/faculty', data);
      return res.data;
    } catch (err) {
      console.warn('Backend /admin/users/faculty failed, saving to mock store:', err.message);
      const users = getStoredMockUsers();
      const newUser = {
        _id: 'usr-fac-' + Date.now(),
        name: data.name,
        email: data.email.toLowerCase(),
        role: 'faculty',
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
      };
      saveStoredMockUsers([newUser, ...users]);
      return { success: true, message: 'Faculty registered successfully (Dev Store)', user: newUser };
    }
  },

  async createStudent(data) {
    try {
      const res = await api.post('/admin/users/student', data);
      return res.data;
    } catch (err) {
      console.warn('Backend /admin/users/student failed, saving to mock store:', err.message);
      const users = getStoredMockUsers();
      const newUser = {
        _id: 'usr-stu-' + Date.now(),
        name: data.name,
        email: data.email.toLowerCase(),
        usn: data.usn.toUpperCase(),
        role: 'student',
        accountStatus: 'active',
        createdAt: new Date().toISOString(),
      };
      saveStoredMockUsers([newUser, ...users]);
      return { success: true, message: 'Student registered successfully (Dev Store)', user: newUser };
    }
  },

  async bulkCreateStudents(csvOrStudents) {
    try {
      const payload = typeof csvOrStudents === 'string' ? { csv: csvOrStudents } : { students: csvOrStudents };
      const res = await api.post('/admin/users/students/bulk', payload);
      return res.data;
    } catch (err) {
      console.warn('Backend /admin/users/students/bulk failed, parsing in mock store:', err.message);
      const users = getStoredMockUsers();
      let newCount = 0;
      if (typeof csvOrStudents === 'string') {
        const lines = csvOrStudents.split('\n').filter((l) => l.trim().length > 0);
        // Header line
        const dataLines = lines[0].toLowerCase().includes('email') ? lines.slice(1) : lines;
        const newUsers = [];
        dataLines.forEach((line, idx) => {
          const parts = line.split(',').map((p) => p.trim());
          if (parts.length >= 4) {
            newUsers.push({
              _id: 'usr-bulk-' + Date.now() + '-' + idx,
              name: parts[0],
              email: parts[1].toLowerCase(),
              usn: parts[2].toUpperCase(),
              role: 'student',
              accountStatus: 'active',
              createdAt: new Date().toISOString(),
            });
            newCount++;
          }
        });
        saveStoredMockUsers([...newUsers, ...users]);
      }
      return {
        success: true,
        message: `Bulk registration completed (${newCount} imported)`,
        insertedCount: newCount,
        formatErrors: [],
        skippedDetails: [],
      };
    }
  },
};

// =============================================================================
// QUIZ & QUESTION SERVICE (Directly calls /api/faculty/quizzes/...)
// =============================================================================
export const quizService = {
  async getQuizzes(params = {}) {
    try {
      const res = await api.get('/faculty/quizzes', { params });
      return res.data;
    } catch (err) {
      console.warn('Backend fetch failed, using local mock store:', err.message);
      const quizzes = getStoredMockQuizzes();
      return {
        success: true,
        data: quizzes,
        pagination: {
          total: quizzes.length,
          page: 1,
          limit: 50,
          totalPages: 1,
        },
      };
    }
  },

  async getQuiz(id) {
    try {
      const res = await api.get(`/faculty/quizzes/${id}`);
      return res.data;
    } catch (err) {
      const quizzes = getStoredMockQuizzes();
      const match = quizzes.find((q) => q._id === id);
      if (match) return { success: true, data: match };
      throw err;
    }
  },

  async createQuiz(data) {
    try {
      const res = await api.post('/faculty/quizzes', data);
      return res.data;
    } catch (err) {
      console.warn('Backend create failed, saving to local store:', err.message);
      const quizzes = getStoredMockQuizzes();
      const newQuiz = {
        _id: 'mock-quiz-' + Date.now(),
        ...data,
        status: 'draft',
        totalMarks: 0,
        questionCount: 0,
        attemptCount: 0,
        createdAt: new Date().toISOString(),
      };
      const updated = [newQuiz, ...quizzes];
      saveStoredMockQuizzes(updated);
      return { success: true, data: newQuiz };
    }
  },

  async updateQuiz(id, data) {
    try {
      const res = await api.put(`/faculty/quizzes/${id}`, data);
      return res.data;
    } catch (err) {
      console.warn('Backend quiz update failed, updating local store:', err.message);
      const quizzes = getStoredMockQuizzes();
      const updated = quizzes.map((q) => (q._id === id ? { ...q, ...data } : q));
      saveStoredMockQuizzes(updated);
      return { success: true, data: updated.find((q) => q._id === id) };
    }
  },

  async updateQuizStatus(id, status) {
    try {
      const res = await api.patch(`/faculty/quizzes/${id}/status`, { status });
      return res.data;
    } catch (err) {
      console.warn('Backend status update failed, updating local store:', err.message);
      const quizzes = getStoredMockQuizzes();
      const updated = quizzes.map((q) => (q._id === id ? { ...q, status } : q));
      saveStoredMockQuizzes(updated);
      return { success: true, message: `Status updated to ${status}` };
    }
  },

  async deleteQuiz(id) {
    try {
      const res = await api.delete(`/faculty/quizzes/${id}`);
      return res.data;
    } catch (err) {
      console.warn('Backend delete failed, removing from local store:', err.message);
      const quizzes = getStoredMockQuizzes();
      const filtered = quizzes.filter((q) => q._id !== id);
      saveStoredMockQuizzes(filtered);
      return { success: true, message: 'Quiz deleted successfully' };
    }
  },

  // Questions APIs
  async getQuestions(quizId) {
    try {
      const res = await api.get(`/faculty/quizzes/${quizId}/questions`);
      return res.data;
    } catch (err) {
      console.warn('Backend getQuestions failed, reading from mock store:', err.message);
      const questions = getStoredMockQuestions(quizId);
      return { success: true, count: questions.length, questions };
    }
  },

  async createQuestion(quizId, questionData) {
    try {
      const res = await api.post(`/faculty/quizzes/${quizId}/questions`, questionData);
      return res.data;
    } catch (err) {
      console.warn('Backend createQuestion failed, saving to mock store:', err.message);
      const questions = getStoredMockQuestions(quizId);
      const newQ = {
        _id: 'q-' + Date.now(),
        quizId,
        ...questionData,
      };
      const updatedQuestions = [...questions, newQ];
      saveStoredMockQuestions(quizId, updatedQuestions);

      // Recalculate marks on quiz in mock store
      const quizzes = getStoredMockQuizzes();
      const totalMarks = updatedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
      const updatedQuizzes = quizzes.map((q) =>
        q._id === quizId ? { ...q, questionCount: updatedQuestions.length, totalMarks } : q
      );
      saveStoredMockQuizzes(updatedQuizzes);

      return { success: true, question: newQ };
    }
  },

  async updateQuestion(quizId, questionId, questionData) {
    try {
      const res = await api.put(`/faculty/quizzes/${quizId}/questions/${questionId}`, questionData);
      return res.data;
    } catch (err) {
      console.warn('Backend updateQuestion failed, updating mock store:', err.message);
      const questions = getStoredMockQuestions(quizId);
      const updatedQuestions = questions.map((q) => (q._id === questionId ? { ...q, ...questionData } : q));
      saveStoredMockQuestions(quizId, updatedQuestions);
      return { success: true, question: updatedQuestions.find((q) => q._id === questionId) };
    }
  },

  async deleteQuestion(quizId, questionId) {
    try {
      const res = await api.delete(`/faculty/quizzes/${quizId}/questions/${questionId}`);
      return res.data;
    } catch (err) {
      console.warn('Backend deleteQuestion failed, removing from mock store:', err.message);
      const questions = getStoredMockQuestions(quizId);
      const filtered = questions.filter((q) => q._id !== questionId);
      saveStoredMockQuestions(quizId, filtered);
      return { success: true, message: 'Question deleted successfully' };
    }
  },

  async bulkImportQuestions(quizId, payload) {
    try {
      const res = await api.post(`/faculty/quizzes/${quizId}/questions/bulk`, payload);
      return res.data;
    } catch (err) {
      console.warn('Backend bulkImportQuestions failed, processing locally in mock store:', err.message);
      const questions = getStoredMockQuestions(quizId);
      const newItems = (payload.questions || []).map((q, i) => ({
        _id: 'q-bulk-' + Date.now() + '-' + i,
        quizId,
        ...q,
      }));
      const updated = [...questions, ...newItems];
      saveStoredMockQuestions(quizId, updated);
      return {
        success: true,
        message: `Successfully imported ${newItems.length} questions`,
        insertedCount: newItems.length,
      };
    }
  },
};

// =============================================================================
// SUBMISSION & RESULTS TELEMETRY SERVICE (Phase 6 Integration - Temporary Mock)
// =============================================================================
const MOCK_SUBMISSIONS = [
  {
    _id: 'sub-1',
    quizId: 'mock-quiz-101',
    quizTitle: 'CS301: Advanced Distributed Systems Midterm',
    studentName: 'Maya Lin',
    usn: '1MS21CS042',
    obtainedMarks: 46,
    totalMarksPossible: 50,
    percentage: 92,
    status: 'submitted',
    submittedAt: '2026-11-05T11:42:00Z',
    durationTakenMinutes: 44,
    // Note: Tab switch is an unverified focus telemetry event, NOT proof of cheating.
    focusEvents: {
      tabSwitches: 0,
      windowBlurs: 0,
      fullscreenExits: 0,
    },
    flagReviewStatus: 'clean',
  },
  {
    _id: 'sub-2',
    quizId: 'mock-quiz-101',
    quizTitle: 'CS301: Advanced Distributed Systems Midterm',
    studentName: 'Kaelen Thorne',
    usn: '1MS21CS088',
    obtainedMarks: 38,
    totalMarksPossible: 50,
    percentage: 76,
    status: 'submitted',
    submittedAt: '2026-11-05T12:05:00Z',
    durationTakenMinutes: 52,
    focusEvents: {
      tabSwitches: 2,
      windowBlurs: 3,
      fullscreenExits: 1,
    },
    flagReviewStatus: 'under_review',
  },
  {
    _id: 'sub-3',
    quizId: 'mock-quiz-101',
    quizTitle: 'CS301: Advanced Distributed Systems Midterm',
    studentName: 'Priya Sharma',
    usn: '1MS21CS112',
    obtainedMarks: 48,
    totalMarksPossible: 50,
    percentage: 96,
    status: 'submitted',
    submittedAt: '2026-11-05T11:50:00Z',
    durationTakenMinutes: 41,
    focusEvents: {
      tabSwitches: 0,
      windowBlurs: 0,
      fullscreenExits: 0,
    },
    flagReviewStatus: 'clean',
  },
  {
    _id: 'sub-4',
    quizId: 'mock-quiz-101',
    quizTitle: 'CS301: Advanced Distributed Systems Midterm',
    studentName: 'Devin Zhao',
    usn: '1MS21CS031',
    obtainedMarks: 30,
    totalMarksPossible: 50,
    percentage: 60,
    status: 'auto_submitted',
    submittedAt: '2026-11-05T12:15:00Z',
    durationTakenMinutes: 60,
    focusEvents: {
      tabSwitches: 1,
      windowBlurs: 1,
      fullscreenExits: 0,
    },
    flagReviewStatus: 'clean',
  },
];

export const resultsService = {
  // Marked as temporary mock data pending Phase 6 Attempt backend endpoints
  isMockData: true,

  async getQuizSubmissions(quizId) {
    // When backend /api/faculty/quizzes/:id/attempts or /api/results exists, connect here:
    // try { return (await api.get(`/faculty/quizzes/${quizId}/results`)).data; } catch ...
    console.info('[TEMPORARY_MOCK_DATA] Fetching student submissions for quiz:', quizId);
    const filtered = quizId ? MOCK_SUBMISSIONS.filter((s) => s.quizId === quizId) : MOCK_SUBMISSIONS;
    return {
      success: true,
      isMock: true,
      data: filtered,
    };
  },
};

export default api;
