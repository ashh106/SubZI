# 🚀 AI Video Subtitle Studio

An end-to-end AI-powered video subtitle engine! Automatically generate subtitles from your videos using open-source AI, edit them live on a React Timeline, style them with modern presets, and export cleanly burned-in MP4 videos or production-ready SRT files.

## ✨ Core Features
- **🎥 Web-Based Studio Editor**: Complete timeline to edit text, timestamps, and typography interactively.
- **🌍 Multi-Language & Translation**: Supports auto-detect transcription, Hindi, English, Spanish, French, and translated "Hinglish".
- **🧠 Whisper AI Pipeline**: Robust local Python orchestration using `openai-whisper`.
- **⚡ Background Processing**: Fault-tolerant BullMQ + Redis job handling. 
- **📝 Export Anywhere**: Download standard `.srt`, `.vtt`, or natively bake captions directly into a `.mp4` using FFmpeg!

---

## ⚙️ Quick Start Guide (Local Deployment)

### 1. Prerequisites
Before starting, ensure you have the following installed on your machine:
- **Node.js** (v18+)
- **Python** (v3.9+)
- **FFmpeg** (Must be installed and added to your system PATH)
- **Docker** (Required for Redis and MongoDB)

### 2. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/SubZI.git
cd SubZI
```

### 3. Start Database & Queue Services
You must run Redis (for the task queue) and MongoDB (for data storage) via Docker:
```bash
docker run -d --name redis-subzi -p 6379:6379 redis:alpine
docker run -d --name mongo-subzi -p 27017:27017 mongo
```

### 4. Setup the Backend Engine
The backend orchestrates FFmpeg and the AI Whisper python pipeline.
```bash
cd vid-sub-engine/backend

# Install Node dependencies
npm install

# Setup Python virtual environment & dependencies
python -m venv .venv

# Activate (Windows):
.venv\Scripts\activate
# Activate (Mac/Linux):
# source .venv/bin/activate

pip install openai-whisper deep-translator indic_transliteration

# Run the backend (Running on http://localhost:5000)
npm run dev
```

### 5. Setup the Frontend Studio
Open a new terminal window to serve the React application.
```bash
cd vid-sub-engine/frontend
npm install
# Run the frontend (Running on http://localhost:5173)
npm run dev
```

---

## 🎓 Mini Tutorial: Editing Your First Video

Once both your frontend and backend servers are running, follow these steps to see the magic:

1. **Open the App**: Navigate to `http://localhost:5173` in your browser.
2. **Upload**: Click the big **"Upload Video"** box. Select any short MP4 video containing clear speech. 
3. **Configure**: Select your `Source Language` (Auto-detect) and `Target Language` (English). Choose the `Medium` or `Small` Whisper model for faster processing.
4. **Processing**: The live pipeline bar will show you real-time percentage progress as FFmpeg extracts the audio and the Whisper AI parses the speech in the background worker.
5. **Polishing**: Once complete, click **"Open Editor"**. Click on any timeline block to correct typos or split lines using shortcuts! Apply a Style preset (e.g., "Instagram Reels" or "YouTube").
6. **Delivery**: Jump to the **Export** page. Click the **Download MP4** button to command the backend FFmpeg engine to bake your styled fonts directly atop your footage, or snag the raw SRT data for Premiere Pro.

---

## 📦 Architecture Stack
- **Frontend**: React, Vite, TailwindCSS, Zustand (State Management)
- **Backend API**: Node.js, Express, TypeScript (MongoDB)
- **Worker/Queue**: BullMQ, Redis
- **AI Worker**: Python, Whisper, Deep-Translator
- **Media Engine**: FFmpeg 
- **Styling**: Native FFmpeg `subtitles` filter with `force_style` rendering

## 👨‍💻 Built by
Ashh
