# WriteAI ✍️

> **Full-stack AI Handwriting Analysis, Recognition & Synthesis Studio** — upload handwritten pages, transcribe them with TrOCR, extract morphological & CNN style profiles, and render text back into stylized handwritten A4 pages & PDFs.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-TrOCR_%26_ResNet18-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-4.10+-5C3EE8?style=flat-square&logo=opencv&logoColor=white)

---

## ✨ 8-Step Pipeline & Features

WriteAI guides a handwriting sample through an end-to-end computer vision and deep learning workflow:

| Step | Stage | What It Does |
| :---: | :--- | :--- |
| **1** | **Upload** | Multi-image drag-and-drop uploader (`JPG`, `PNG`, `WEBP` up to 10 MB) with instant preview & dimension detection. |
| **2** | **Preprocess** | EXIF orientation correction, format validation, and CV normalization. |
| **3** | **Segment** | Page boundary detection + ink-strength **1D Horizontal Projection Profile** peak detection (`scipy.signal.find_peaks`) to isolate individual handwritten lines without merging adjacent lines. |
| **4** | **OCR (HTR)** | Line-by-line handwriting transcription using **Microsoft TrOCR** (`microsoft/trocr-base-handwritten`) with `original`, `enhanced`, and `denoised` preprocessing modes. |
| **5** | **Style Analysis** | Classical CV measurement of **stroke thickness**, **line height**, **line & horizontal spacing**, **baseline slant angle**, **ink density**, **coverage %**, and **dominant ink color (RGB/Hex)**. |
| **6** | **Style Encoder** | Pretrained **ResNet-18** CNN extracts **512-D L2-normalized** visual texture embeddings via Global Average Pooling. |
| **7** | **Style Profile** | Aggregates median morphological metrics + mean-pooled 512-D CNN embeddings (with per-sample cosine similarity) and persists them as JSON (`default_writer`). |
| **8** | **Generate** | Parametric A4 handwriting renderer (**Pillow**) applying your saved ink color, stroke thickness, line spacing, and natural pressure/baseline micro-variations on `ruled`, `plain`, `blank`, or `grid` paper—exportable as **PNG** or multi-page **PDF**. |

> **Plus AI Text Assistant:** Includes an optional `/api/generate` endpoint powered by **Google Gemini (`gemini-2.5-flash`)** to draft, summarize, paraphrase, or change text tone before rendering (falls back gracefully if no API key is set).

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Axios, ESLint |
| **Backend API** | Python, FastAPI, Uvicorn, Pydantic v2 & `pydantic-settings` |
| **Computer Vision** | OpenCV (`opencv-python`), Pillow (`PIL`), NumPy, SciPy |
| **Deep Learning & AI** | PyTorch, Torchvision (`ResNet-18`), Hugging Face Transformers (`microsoft/trocr-base-handwritten`), Google GenAI (`gemini-2.5-flash`) |
| **Persistence** | Lightweight file-based JSON profiles (`backend/data/profiles/`) & generated PNG/PDF assets |

---

## 📁 Project Structure

```text
WriteAi/
├── frontend/                  # React + Vite + Tailwind CSS v4 studio UI
│   ├── src/
│   │   ├── components/        # Uploader, StepIndicator, SegmentationViewer, OCRResults,
│   │   │                      # StyleAnalysisCard, StyleEncoderCard, StyleProfileCard,
│   │   │                      # GenerationCard, OutputPreview, ContentEditor, etc.
│   │   ├── pages/             # Dashboard.jsx (main 8-step workspace)
│   │   └── services/api.js    # Typed Axios client & error handling
│   ├── package.json
│   └── vite.config.js
│
├── backend/                   # FastAPI + CV/ML services
│   ├── app/
│   │   ├── main.py            # App entry, CORS & health routes
│   │   ├── api/endpoints.py   # REST endpoints for Steps 2–8 & AI writing
│   │   ├── core/config.py     # Environment & CORS settings
│   │   ├── models/schemas.py  # Pydantic request/response models
│   │   └── services/          # preprocessing, segmentation, ocr_service,
│   │                          # style_analysis_service, style_encoder,
│   │                          # profile_service, generation_service, ai_service
│   ├── data/                  # Saved writer profiles, fonts & generated pages
│   ├── test_*.py              # API & pipeline verification scripts
│   └── requirements.txt
│
├── docs/                      # Architecture notes (ocr.md, step6_style_encoder.md)
├── test_assets/               # Sample handwriting pages for testing
└── README.md
```

---

## 🔌 Core API Endpoints

All endpoints are mounted under `/api` (and `/api/v1`):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Backend health check |
| `POST` | `/api/samples/process` | Preprocess & validate uploaded samples |
| `POST` | `/api/samples/segment` | Detect & crop handwritten text lines |
| `POST` | `/api/samples/ocr` | Run TrOCR transcription (`mode`: `original` \| `enhanced` \| `denoised`) |
| `GET` | `/api/samples/ocr/status` | Check TrOCR model & CPU/CUDA device status |
| `POST` | `/api/samples/style` | Extract morphological handwriting metrics & dominant ink color |
| `POST` | `/api/samples/style-encoder` | Extract 512-D ResNet-18 visual embeddings |
| `POST` / `GET` / `DELETE` | `/api/profile` | Build, retrieve, or reset a saved style profile |
| `POST` | `/api/generate/handwriting` | Render handwritten A4 pages (returns base64 PNGs + URLs) |
| `GET` | `/api/generate/page/{session_id}/{page_num}` | Download a single rendered PNG page |
| `GET` | `/api/generate/pdf/{session_id}` | Download compiled multi-page PDF |
| `POST` | `/api/generate` | AI text generation/rewriting (`gemini-2.5-flash`) |

---

## 🚀 Quick Start

### 1. Backend (FastAPI + Python)

```bash
cd backend
python -m venv venv

# Activate virtual environment:
# Windows:
.\venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- **API:** `http://localhost:8000`
- **Interactive Docs (Swagger):** `http://localhost:8000/docs`
- **Optional `.env` in `backend/`:**
  ```env
  GEMINI_API_KEY=your_google_gemini_api_key
  ```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

- **Studio UI:** `http://localhost:5173`
- **Optional `.env` in `frontend/`:** set `VITE_API_URL=http://localhost:8000` (defaults to `http://localhost:8000`).

---

## 📝 Technical Notes

- **CNN Style Encoder:** Uses frozen ImageNet-pretrained **ResNet-18** weights to capture visual stroke texture—it is an empirical style descriptor rather than a fine-tuned biometric writer-ID model.
- **Handwriting Generation:** Uses an experimental **parametric Pillow rendering engine** conditioned on your Step 7 morphological profile (ink color, stroke dilation, line spacing, baseline jitter) rather than a neural glyph synthesizer.
- **First OCR Run:** Downloading `microsoft/trocr-base-handwritten` and running on CPU may take extra time on the first request; CUDA is used automatically if available.
