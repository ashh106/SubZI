🚀 AI Video Subtitle Engine

An AI-powered backend system that automatically generates subtitles from video files with support for multilingual transcription, translation, and Hinglish captions.

✨ Features
🎥 Upload video and generate subtitles automatically
🌍 Supports multiple languages (Hindi, English, Hinglish, etc.)
🧠 Auto language detection
🔄 Translation support
📝 Generates:
SRT subtitles
VTT subtitles
Plain text transcript
⚡ Asynchronous processing using BullMQ + Redis
🎯 FFmpeg-based audio extraction
🤖 Whisper-based speech recognition
🧠 How it Works
Video → FFmpeg → Audio → Whisper → Segments → Subtitles (SRT/VTT)
📦 Tech Stack
Backend: Node.js, Express, TypeScript
Queue: BullMQ + Redis
AI Model: Whisper (local)
Media Processing: FFmpeg
Database: MongoDB
🚀 API Endpoints
Upload Video
POST /api/upload

Form-data:

video (file)
sourceLanguage (auto/default)
targetLanguage (en / hi / hinglish)
Check Status
GET /api/upload/:fileId/status
Download Subtitles
GET /api/upload/:fileId/download/srt
GET /api/upload/:fileId/download/vtt
⚙️ Setup Instructions
1. Clone repo
git clone https://github.com/YOUR_USERNAME/ai-video-subtitle-engine.git
cd ai-video-subtitle-engine
2. Install dependencies
npm install
pip install openai-whisper
3. Start services
Start Redis (Docker)
docker run -d --name redis-stack -p 6379:6379 redis:alpine
Start MongoDB (Docker)
docker run -d --name mongodb -p 27017:27017 mongo
4. Run server
npm run dev
🧪 Example Usage
curl.exe -X POST http://localhost:5000/api/upload \
-F "video=@video.mp4" \
-F "sourceLanguage=auto" \
-F "targetLanguage=en"
🎯 Use Cases
🎬 Content creators generating subtitles for reels/videos
🌍 Multilingual video translation
📱 Social media automation tools
🎓 Educational content accessibility
🧠 AI video editing pipelines
⚠️ Future Improvements
🔥 Real-time subtitle preview
🎨 Styled captions (Instagram/YouTube style)
⚡ Faster inference (GPU optimization)
🌐 SaaS deployment
👨‍💻 Author

Built by Ashh

