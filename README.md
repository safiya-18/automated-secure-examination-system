# Automated Secure Examination System

A secure, web-based examination platform developed using the MERN stack (MongoDB, Express.js, React.js, Node.js). Designed to provide role-based exam administration, randomized objective evaluations, and proctoring event tracking.

---

## Project Structure

```text
quizz/
├── client/          # Frontend application (React + Vite)
├── server/          # Backend REST API (Node.js + Express)
├── .gitignore       # Root Git ignore rules
└── README.md        # Project overview and documentation
```

---

## Prerequisites

* [Node.js](https://nodejs.org/) (v18 or newer recommended, current environment: v24.x)
* [npm](https://www.npmjs.com/) (v9 or newer)
* [Git](https://git-scm.com/)
* [MongoDB](https://www.mongodb.com/) (Atlas URI or local MongoDB Community server)

---

## Getting Started

### 1. Backend Setup

```bash
cd server
npm install
```

Copy the example environment configuration:
```bash
cp .env.example .env
```

Start the backend development server:
```bash
npm run dev
```
The backend API will run on `http://localhost:5000`.

### 2. Frontend Setup

From the root project directory:
```bash
cd client
npm install
npm run dev
```
The frontend application will run on `http://localhost:5173`.

---

## Health Check Endpoint

To verify that the backend is running properly:
```
GET http://localhost:5000/api/health
```
Response:
```json
{
  "success": true,
  "message": "Automated Secure Examination System API is running smoothly",
  "timestamp": "2026-11-04T..."
}
```

