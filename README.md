# 🌸 NARI
### *Agentic AI-Powered Multimodal Women's Health Intelligence & Personalized Care Platform*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/Orchestration-LangGraph-FF6F00?style=flat-square)](https://langchain-ai.github.io/langgraph/)
[![React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black)](https://vitejs.dev/)
[![SQLite / PostgreSQL](https://img.shields.io/badge/Database-SQLAlchemy%20(SQLite%2FPostgres)-4479A1?style=flat-square&logo=postgresql&logoColor=white)](https://www.sqlalchemy.org/)
[![Multi-LLM](https://img.shields.io/badge/LLM-Gemini%20%7C%20OpenAI%20%7C%20Groq%20%7C%20Mock-blueviolet?style=flat-square)](https://aistudio.google.com/)
[![Safety](https://img.shields.io/badge/Safety-SRAI%20Escalation%20Matrix-E53935?style=flat-square)](https://who.int)

---

## 📌 Overview

**NARI** (GGSIPU2617) is an end-to-end, multimodal healthcare intelligence ecosystem engineered specifically for **women's health across all life stages** (menstrual health, PCOS, endometriosis, fertility, pregnancy, postpartum recovery, perimenopause/menopause, and mental wellbeing).

Unlike conventional single-prompt chatbots, NARI is driven by a stateful **LangGraph Multi-Agent Orchestration Engine**, a normalized **Digital Health Twin (DHT)** data architecture, a guideline-grounded **Clinical Knowledge Retrieval (RAG)** system, and deterministic **Emergency & Risk Escalation Layers** adhering to strict clinical safety boundaries.

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │                NARI MULTI-AGENT GRAPH                   │
                                  └─────────────────────────────────────────────────────────┘
                                                               │
                                                               ▼
                                                  [ 🚨 Emergency Check ]
                                              (Deterministic Red-Flag Filter)
                                                               │ (Safe)
                                                               ▼
                                                     [ 🧭 Agent Router ]
                                              (Contextual Specialist Selection)
                                                               │
                                                               ▼
                                                    [ 📚 Clinical RAG ]
                                            (TF-IDF / WHO & MoHFW Guideline Corpus)
                                                               │
                                                               ▼
                                                  [ 🩺 Specialist Agents ]
                                   (Symptom, Lab, Nutrition, Mental, Medication, Lifestyle, Doc AI)
                                                               │
                                                               ▼
                                                  [ ⚖️ Risk Prediction ]
                                            (Transparent Heuristic Pattern Engine)
                                                               │
                                                               ▼
                                                    [ 📋 Care Plan Agent ]
                                           (Synthesizes Evidence + Next Steps + Badges)
                                                               │
                                                               ▼
                                                   [ 🔄 Follow-up Care ]
                                            (Continuity & Proactive Scheduling)
```

---

## 🌟 Key Pillars & Features

### 1. 🤖 LangGraph Multi-Agent Orchestration (12 Specialized Roles)
A modular multi-agent roster where every conversation turn passes through a 7-stage inspectable pipeline rather than a single black-box prompt:
- **Emergency Escalation Agent**: Always executes first. Scans for red flags, severe symptoms, and crisis keywords with deterministic override (Level L3/L4 triage), providing instant emergency helpline routing and immediate care instructions.
- **Router Agent**: Analyzes intent, clinical context, and user history to dispatch queries to the appropriate specialist.
- **Clinical Knowledge Retrieval (RAG) Agent**: Grounds interactions in evidence sourced from the **World Health Organization (WHO)** and **Ministry of Health & Family Welfare (MoHFW)** evidence registry.
- **Symptom Assessment Agent**: Gathers reproductive context and evaluates symptom duration, severity, and cycle associations.
- **Laboratory Report Interpretation Agent**: Normalizes raw biomarker values, checks reference intervals, and flags abnormal trends.
- **Medical Document Intelligence Agent**: Handles clinical records, prescriptions, consultation notes, and discharge summaries.
- **Nutrition Planning Agent**: Delivers micro/macronutrient recommendations tailored to hormonal profiles and life stages (e.g., iron-rich anemia diets, low-GI PCOS plans).
- **Mental Wellness Support Agent**: Validates perinatal mood, hormonal stress, anxiety, and sleep disturbances with empathetic supportive guidance.
- **Medication & Adherence Agent**: Monitors medication schedules, adherence percentages, and potential side-effect interactions.
- **Lifestyle Coaching Agent**: Offers evidence-backed advice on sleep hygiene, physical activity, and stress management.
- **Appointment Management Agent**: Facilitates clinical consult preparation, question generation, and scheduling triggers.
- **Risk Prediction Agent**: Transparent, inspectable rule-based pattern matching (`rule-based-heuristic-v1`) for PCOS patterns, Endometriosis indicators, Anemia/Lab trends, and Mental Wellbeing shifts.
- **Care Plan Agent**: Formulates a unified, explainable care card containing rationales, evidence citations, and recommended next steps.
- **Follow-up Care Agent**: Automatically queues proactive check-in tasks based on risk severity.

### 2. 🧬 Personalized Digital Health Twin (DHT)
Replaces opaque JSON dumps with a fully normalized, relational clinical schema (SQLAlchemy + SQLite/PostgreSQL):
- **Reproductive Context**: Menstrual cycle length tracking, variability calculations, and flow severity.
- **Longitudinal Biomarkers**: Individual `LabResult` rows with extraction confidence, reference intervals, and verification states (`ai_extracted` | `clinician_confirmed`).
- **Symptom Timelines & Lifestyle Metrics**: Chronological history of symptoms, severity scales (0–10), sleep duration, stress scores, and activity minutes.
- **Wearable Telemetry Readiness**: Standardized data model (`WearableMetric`) ready for Google Health Connect and Apple Health integration.

### 3. 📄 Document AI & Laboratory Report Analyzer
- **Multimodal Ingestion**: Supports PDF, PNG, JPG, and JPEG lab reports.
- **Hybrid Extraction Pipeline**: Combines native `pypdf` extraction with fallback OCR via `pdf2image` and `pytesseract`.
- **Biomarker Normalization**: Extracts and classifies key blood markers (e.g., Hemoglobin, Ferritin, TSH, HbA1c, Vitamin D3, Lipid Profile) with clear `HIGH`, `LOW`, or `NORMAL` flags.

### 4. 🎙️ Multimodal Voice Companion
- **Speech-to-Text (STT)**: High-accuracy, offline-capable voice transcription powered by `faster-whisper`.
- **Text-to-Speech (TTS)**: Low-latency neural synthesis powered by `piper-tts` (with automatic fallback to the browser's native Web Speech API).

### 5. 🛡️ SRAI Safety Framework & Clinical Explainability
- **Strict Clinical Boundaries**: No autonomous medical diagnoses; all outputs are framed as educational, triage-level decision support.
- **Transparent Citations**: UI surfaces explicit risk factor contributions and evidence source identifiers (e.g., `[SRC-W04: WHO PCOS Management Guidance]`).
- **Auditability (`AgentEventLog`)**: Every agent hop, input summary, handoff decision, and escalation level is permanently logged for audit trails.

### 6. 👨‍⚕️ Clinician & Caregiver Decision Support Portal
- **Triage Patient Roster**: Categorizes patients by clinical priority level (`L0: Info` → `L1: Monitor` → `L2: Consult` → `L3: Urgent` → `L4: Stop`).
- **Clinical Decision Cards**: Displays patient history, flagged biomarkers, active care plans, and the immutable agent execution event log.

---

## 📐 System Architecture & Data Flow

```
                                     +-------------------------------+
                                     |   React + Vite Frontend UI    |
                                     | (Dashboard, Assistant, Report,|
                                     |   Health Twin, Clinician)     |
                                     +---------------+---------------+
                                                     | HTTP / REST
                                                     v
                                     +-------------------------------+
                                     |     FastAPI Backend Router    |
                                     |  (/api/v1/chat, /voice, etc.) |
                                     +---------------+---------------+
                                                     |
                         +---------------------------+---------------------------+
                         |                                                       |
                         v                                                       v
        +---------------------------------+                     +---------------------------------+
        |    Document AI / OCR Service    |                     |    LangGraph Multi-Agent Engine |
        |  (pypdf + pdf2image + tesseract)|                     | (7-Stage Sequential State Graph)|
        +----------------+----------------+                     +----------------+----------------+
                         |                                                       |
                         | Normalized Biomarkers                                 | Evidence & Care Plan
                         v                                                       v
+---------------------------------------------------------------------------------------------------------+
|                                    SQLAlchemy ORM Data Storage                                          |
|  [Users] [PatientProfiles] [MenstrualCycles] [Symptoms] [LabResults] [RiskSignals] [CarePlans] [Logs]  |
|                                 (SQLite: nari.db / PostgreSQL)                                       |
+---------------------------------------------------------------------------------------------------------+
```

---

## 📂 Repository Structure

```
NARI/
├── .env.example                     # Environment template configuration
├── README.md                        # Master project documentation
│
├── backend/
│   ├── requirements.txt             # Python dependencies
│   ├── nari.db                      # Local SQLite database (auto-generated)
│   ├── scripts/
│   │   └── download_models.py       # Pre-fetches Piper TTS voice weights
│   └── app/
│       ├── main.py                  # FastAPI entry point, CORS, lifespan & error handlers
│       ├── agents/                  # Multi-Agent Orchestration Subsystem
│       │   ├── state.py             # GraphState TypedDict & AGENT_ROSTER definition
│       │   ├── graph.py             # LangGraph assembly (StateGraph compilation & run_turn)
│       │   ├── nodes.py             # Specialist agent node implementations & prompts
│       │   ├── emergency.py         # Deterministic crisis/emergency rules (always first)
│       │   └── risk_engine.py       # Heuristic pattern matching (PCOS, Endo, Labs, Mental)
│       ├── api/                     # REST API Endpoints
│       │   ├── chat.py              # POST /api/v1/chat -> agent_service.run_turn
│       │   ├── reports.py           # POST /upload, GET /reports, DELETE /reports/{id}
│       │   └── voice.py             # GET /status, POST /converse (STT/TTS round-trip)
│       ├── core/                    # Core Configuration & Security
│       │   ├── config.py            # Pydantic Settings & environment variables
│       │   ├── exceptions.py        # Custom domain exceptions & HTTP mappings
│       │   ├── logging.py           # Structured logging configuration
│       │   └── security.py          # File upload validation & magic-byte checking
│       ├── data/
│       │   └── knowledge_base.py    # WHO & MoHFW clinical knowledge corpus (RAG dataset)
│       ├── database/                # Database Layer
│       │   ├── database.py          # Async session setup, init_db() & evidence seeding
│       │   └── models.py            # Normalized Digital Health Twin SQLAlchemy schemas
│       ├── schemas/                 # Pydantic Request & Response Models
│       │   ├── chat.py              # ChatRequest, ChatResponse, HealthProfile
│       │   ├── report.py            # ReportRead, ReportDetail, BiomarkerResult
│       │   ├── responses.py         # Standard pagination & envelope models
│       │   └── voice.py             # VoiceConverseResponse, VoiceStatusResponse
│       └── services/                # Business Logic & Model Connectors
│           ├── agent_service.py     # Graph orchestrator wrapper with fallback safety
│           ├── conversation_agent.py# Legacy router fallback path
│           ├── dht_service.py       # Builds structured DHT context for graph nodes
│           ├── llm_client.py        # Provider-agnostic LLM caller (Gemini/OpenAI/Groq/Mock)
│           ├── mock_responses.py    # Deterministic offline response generator
│           ├── parser_service.py    # OCR and structured document parser
│           ├── rag_service.py       # TF-IDF retriever with domain & evidence filtering
│           ├── report_service.py    # Report lifecycle and biomarker normalization
│           └── voice_service.py     # Whisper STT & Piper TTS audio processing
│
└── frontend/
    ├── index.html                   # HTML template
    ├── package.json                 # Node dependencies (React 18, Vite, Lucide Icons)
    ├── vite.config.js               # Vite build configuration
    └── src/
        ├── main.jsx                 # React root mount
        ├── App.jsx                  # Main interface (Dashboard, Assistant, Reports, Twin, Portal)
        └── api.js                   # Client-side API fetch client
```

---

## ⚡ Quick Start Guide

You can run the entire platform with **zero external API keys or cloud dependencies**—it runs out-of-the-box using local SQLite and deterministic offline responders!

### 1. Prerequisites
- **Python**: 3.10, 3.11, or 3.12
- **Node.js**: v18.0.0 or higher (`npm`)
- *(Optional for full OCR)*: System OCR binaries
  - **Ubuntu / Debian**: `sudo apt-get install poppler-utils tesseract-ocr`
  - **macOS**: `brew install poppler tesseract`
  - **Windows**: Install Tesseract & Poppler binaries and add to `PATH`.

---

### 2. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Copy environment file and configure keys
cp ../.env.example ../.env

# Launch the FastAPI server
uvicorn app.main:app --reload --app-dir .
```
> 🚀 **Backend runs at:** `http://127.0.0.1:8000`  
> 📖 **Interactive Swagger UI:** `http://127.0.0.1:8000/docs`

### Windows OCR setup

Text-based PDFs work through `pypdf` alone. To read scanned PDFs and phone photos, install Tesseract OCR and Poppler, then either add their executable folders to `PATH` or set the following values in the root `.env` file:

```ini
TESSERACT_CMD="C:\Program Files\Tesseract-OCR\tesseract.exe"
POPPLER_PATH="C:\poppler\Library\bin"
```

Restart the terminal and verify the installation with `tesseract --version` and `pdftoppm -h` before starting Uvicorn. Without a cloud extraction key, NARI now performs local best-effort extraction of individual lab rows; when `GROQ_API_KEY` is configured, it uses the cloud extractor for more complex layouts.

---

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend
cd frontend

# Install npm packages
npm install

# Start the Vite development server
npm run dev
```
> 🌐 **Frontend runs at:** `http://localhost:5173`

---

## ⚙️ Environment Configuration

To enable cloud LLM providers or advanced voice models, copy `.env.example` to `.env` in the repository root and customize:

```ini
# Application
APP_NAME="NARI Backend"
ENVIRONMENT="development"
LOG_LEVEL="INFO"

# LLM Provider: auto | gemini | openai | groq | mock
LLM_PROVIDER="auto"

# 1. Google Gemini (Recommended - Free key: https://aistudio.google.com/apikey)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-1.5-flash"

# 2. OpenAI
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# 3. Groq
GROQ_API_KEY="your-groq-api-key"
GROQ_MODEL="openai/gpt-oss-120b"

# Database (Leave empty for default local SQLite: backend/nari.db)
DATABASE_URL=""

# Voice Pipeline (Optional)
WHISPER_MODEL_SIZE="small.en"
PIPER_VOICE_MODEL="backend/models/piper/en_US-lessac-medium.onnx"
PIPER_VOICE_CONFIG="backend/models/piper/en_US-lessac-medium.onnx.json"
```

---

## 🩺 Interactive 5-Minute Demo Walkthrough

Follow these steps to demonstrate the full capabilities of NARI to evaluators or clinicians:

1. **Dashboard Overview**:
   - Inspect the **"How NARI Thinks"** multi-agent pipeline banner: observe the sequence of `Emergency -> Router -> RAG -> Specialist -> Risk Engine -> Care Plan -> Follow-up`.
2. **Interactive Clinical Assistant**:
   - Query the assistant: *"I've had irregular periods for 3 months with acne and sudden hair thinning."*
   - Observe the response: notice the **Risk Signal Badge** (`PCOS Pattern (L2)`) and **Evidence Citations** (`WHO Guideline`) displayed directly below the response.
3. **Medical Document AI & Lab Reports**:
   - Upload any sample blood test or lab report (PDF/Image).
   - Watch the parser extract patient metadata and format normalized biomarker tables with flagged `HIGH`/`LOW` indicators (e.g., Ferritin or Hemoglobin).
4. **Digital Health Twin (DHT)**:
   - Navigate to the **Digital Health Twin** tab.
   - See the real-time menstrual cycle variability chart, chronological symptom feed, and live synthesized **Care Plan Card** matching the user query from Step 2.
5. **Clinician Decision Support Portal**:
   - Switch to the **Clinician Portal** tab.
   - Review the stratified patient roster, patient risk drill-downs, and the **Immutable Multi-Agent Event Log** auditing every reasoning hop.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/health` | `GET` | Service liveness health check |
| `/api/v1/chat` | `POST` | Executes a multi-agent conversation turn with DHT context & RAG |
| `/api/v1/voice/status` | `GET` | Checks availability of Whisper STT and Piper TTS engines |
| `/api/v1/voice/converse` | `POST` | Full voice-to-voice turn (audio upload -> STT -> multi-agent -> TTS) |
| `/api/v1/reports/upload` | `POST` | Uploads PDF/image report, runs OCR, normalizes `LabResult` records |
| `/api/v1/reports` | `GET` | Lists uploaded reports with pagination support |
| `/api/v1/reports/{id}` | `GET` | Retrieves structured report detail and extracted biomarker JSON |
| `/api/v1/reports/{id}` | `DELETE` | Removes report record and associated temporary files |

---

## 📋 Problem Statement Deliverables & Implementation Matrix

| Deliverable (GGSIPU2617) | Status | Codebase Implementation |
|---|:---:|---|
| **Multi-Agent Orchestration Engine** | ✅ **Complete** | `backend/app/agents/graph.py`, `nodes.py` (12-agent LangGraph) |
| **Multimodal Assistant (Text + Voice)** | ✅ **Complete** | `api/chat.py`, `api/voice.py`, `frontend/src/App.jsx` |
| **Clinical Knowledge Retrieval (RAG)** | ✅ **Complete** | `services/rag_service.py`, `data/knowledge_base.py` (WHO/MoHFW) |
| **Laboratory Report Analyzer & OCR** | ✅ **Complete** | `services/parser_service.py`, `services/report_service.py` |
| **Explainable Risk Prediction** | ✅ **Complete** | `agents/risk_engine.py` (Heuristic L0-L4 rule-based pattern matching) |
| **Personalized Digital Health Twin** | ✅ **Complete** | Normalized schemas in `database/models.py`, visualization in `App.jsx` |
| **Doctor & Caregiver Decision Portal** | ✅ **Complete** | Clinician Portal UI with patient triage & `agent_event_logs` audit trail |
| **Emergency Escalation Safety Layer** | ✅ **Complete** | `agents/emergency.py` (Deterministic red-flag safety override) |
| **Database Portability** | ✅ **Complete** | SQLite zero-config default + PostgreSQL/asyncpg compatibility |

---

## 🔒 Safety & Ethical Clinical Disclaimer

> [!CAUTION]
> **Clinical Disclaimer**: NARI is an intelligent decision-support and health-literacy companion. It is **not** a certified diagnostic medical device and does not provide autonomous clinical diagnoses. In any acute medical emergency or crisis, the platform immediately directs users to professional healthcare providers and national emergency helplines.

---

## 👥 Contributors & Acknowledgements

Developed with ❤️ for **GGSIPU2617** (*Agentic AI-Powered Multimodal Women's Health Intelligence & Personalized Care Platform*).
- Architectural patterns inspired by **LangGraph**, **SRAI Safety Frameworks**, and **WHO / MoHFW Clinical Guidelines**.
- Modular document analysis and voice interfaces leveraging **Vitalis (IBMIE)** and **MAITRI** open modules.
