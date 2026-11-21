# FastAPI Backend Setup Guide

This service implements the complete specification from `BACKEND_REQUIREMENTS.md` and PRD §4, §5, §9–§12.

## 1. Directory Structure
```
backend/
├── app/
│   ├── main.py                    # FastAPI application & CORS config
│   ├── core/                      # Config (pydantic-settings), JWT & RBAC security
│   ├── db/                        # SQLAlchemy session & SQLite/PostgreSQL setup
│   ├── models/                    # Database entities (Patients, Screenings, EyeImages, AIResults, Reviews, Audit)
│   ├── schemas/                   # Pydantic v2 DTOs (validation & responses)
│   ├── services/                  # Referral Engine (pure logic function)
│   ├── ml/                        # ModelAdapter ABC + MockModelAdapter
│   └── api/v1/                    # Router endpoints (auth, patients, screenings, images, quality, predict, review, sync)
├── tests/                         # Unit tests for Referral Engine
├── requirements.txt               # Dependencies
└── README.md
```

## 2. Installation & Running

### Step 1: Create and activate virtual environment
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### Step 2: Install dependencies
```powershell
pip install -r requirements.txt
```

### Step 3: Run the FastAPI server
```powershell
uvicorn app.main:app --reload --port 8000
```

- **Interactive Swagger API Docs**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
- **OpenAPI Schema**: [http://localhost:8000/api/v1/openapi.json](http://localhost:8000/api/v1/openapi.json)

## 3. Running Unit Tests
```powershell
pytest
```

