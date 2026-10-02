# WriteAI ✍️

An intelligent, full-stack AI writing assistant that transforms, composes, and refines text with custom tones and tasks.

---

## 📁 Project Architecture

```
WriteAI/
│
├── frontend/                  # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/        # Reusable UI components (Editor, OutputCard, Navbar)
│   │   ├── pages/             # Page views (Home.jsx)
│   │   ├── services/          # API client services (api.js)
│   │   ├── App.jsx            # Main App entry
│   │   ├── main.jsx           # React DOM root
│   │   └── index.css          # Tailwind CSS styles
│   ├── package.json
│   └── vite.config.js
│
├── backend/                   # FastAPI + Python
│   ├── app/
│   │   ├── main.py            # FastAPI entry point & CORS configuration
│   │   ├── api/               # API route definitions
│   │   ├── core/              # Config and environment settings
│   │   ├── models/            # Pydantic schemas (requests & responses)
│   │   └── services/          # AI generation and business logic
│   ├── requirements.txt       # Python dependencies
│   └── .gitignore
│
└── README.md
```

---

## 🚀 Getting Started

### 1. Frontend Setup (React + Vite + Tailwind CSS)

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on [http://localhost:5173](http://localhost:5173).

---

### 2. Backend Setup (FastAPI + Python)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate

# macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Set your Gemini API key in .env or environment variable:
# GEMINI_API_KEY="your-api-key"

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend API will be available at [http://localhost:8000](http://localhost:8000).  
Interactive Swagger API documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).
