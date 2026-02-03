# AI Coding Agent Instructions - Crime Detection System

## System Architecture

**Three-Tier Stack:**
- **Frontend** (Next.js 16 + React 19): Dashboard at `http://localhost:3000`, uses Client Components with Tailwind CSS
- **Backend** (Express.js): API server on port 5000, handles Firebase Firestore integration, Cloudinary image uploads, and Socket.IO real-time events
- **AI Server** (Python Flask): Pose detection on port 8000, uses YOLOv8n-pose model for crime activity analysis

**Data Flow:**
1. Frontend captures image → sends to Backend `/api/detect/image`
2. Backend receives multipart form data (image + location) → forwards to AI Server via axios with FormData
3. AI Server analyzes pose keypoints → returns JSON with crime type, confidence, threat level
4. Backend normalizes response → emits Socket.IO event to all connected clients
5. Frontend updates real-time dashboard with incident data → saves to Firestore

## Critical Patterns & Conventions

### Backend (Node.js/Express)
- **File structure:** Routes in `src/routes/`, controllers in `src/controllers/`, Firebase config in `src/config/`
- **Error handling:** Always wrap async routes in try-catch; return 400/500 with JSON error objects
- **Firebase initialization:** Use singleton pattern in [firebase.js](src/config/firebase.js) with `!admin.apps.length` check to prevent re-initialization
- **File uploads:** Use `multer` with memory storage for intermediate processing; never persist temp files without cleanup
- **API request forwarding:** When proxying to AI Server, use `FormData` with explicit headers (`formData.getHeaders()`) and 30s timeout
- **Response normalization:** Always validate external API responses with default values (e.g., `type = "UNKNOWN"` if missing)

### Frontend (Next.js/React)
- **App Router structure:** Pages in `src/app/` subdirectories; use `page.js` as entry points
- **Sidebar routing:** Admin and Operator have separate sidebars ([AdminSidebar.js](src/components/AdminSidebar.js), [OperatorSidebar.js](src/components/OperatorSidebar.js)) - maintain both when adding new admin/operator routes
- **Real-time updates:** Use `socket.io-client` to listen for server events; connect on component mount
- **Firestore queries:** Import `db` from [lib/firebase.js](src/lib/firebase.js) as named export; use async queries in event handlers
- **Styling:** Tailwind CSS only; post-CSS config in [postcss.config.mjs](postcss.config.mjs)

### AI Server (Python/Flask)
- **Model loading:** YOLOv8n-pose loaded once at startup in `PoseCrimeDetector.__init__()` to avoid repeated initialization
- **Pose keypoints:** Access via `results.keypoints.xy.cpu().numpy()` - 17 keypoints per person; order: [nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles]
- **Crime signal detection:** [pose_detector.py](pose_detector.py) analyzes individual poses (_analyze_person) then inter-person interactions (_analyze_interactions)
- **Confidence normalization:** [image_detector.py](image_detector.py) enforces 0.0-1.0 range - raw scores > 1 divide by 100, values < 0 clamp to 0
- **Response format:** Always return JSON with `type`, `confidence`, `threat_level`, `persons_detected`, `activities`, `signals` keys

## Developer Workflows

### Running the System
```bash
# Backend (terminal from CrimeDetectionSystem root)
cd backend && npm install && npm run dev    # Starts on :5000

# Frontend (new terminal)
cd frontend && npm install && npm run dev   # Starts on :3000

# AI Server (new terminal)
cd ai-server && pip install -r requirements.txt && python image_detector.py  # Starts on :8000
```

### Debugging Integration Issues
1. **AI Server → Backend communication failure:** Check CORS in [image_detector.py](image_detector.py) (line 32: `app.run(host="0.0.0.0", port=8000)`); verify FormData headers in backend detect route
2. **Frontend not updating:** Verify Socket.IO namespace and event listeners in [server.js](src/server.js); check CORS origin whitelist (`"http://localhost:3000"`)
3. **Firebase auth errors:** Ensure `firebase-admin.json` exists in backend root (git-ignored); frontend config is hardcoded in [firebase.js](src/lib/firebase.js)

### Testing Detection
- **Local image upload:** Use `/api/detect/image` endpoint with multipart form (image + location fields)
- **Sample crime signals:** pose_detector detects punches, kicks, stabbings, crowd involvement (see `_analyze_person`, `_analyze_interactions` in [pose_detector.py](pose_detector.py))

## External Dependencies & Integration Points

- **Firebase:** Firestore for incident storage, Auth for user login; credentials hardcoded in frontend config (no env vars currently)
- **Cloudinary:** Used for media uploads (config in [backend/src/config/cloudinary.js](src/config/cloudinary.js))
- **YOLOv8n-pose:** 1-person pose model; no detection confidence filters applied (uses default 0.4)
- **Multer:** Handles multipart form data in detect routes
- **Socket.IO:** Real-time pub/sub for dashboard; set as app property in [server.js](src/server.js) for controller access

## Known Constraints & Workarounds

1. **Pose model limitation:** YOLOv8n (nano) model - fast but lower accuracy; test with multi-person scenarios in crowded scenes
2. **Threat scoring:** Currently linear (15 pts per signal); consider dynamic weighting if accuracy drops
3. **No authentication on AI server:** `/detect-image` endpoint is public; add auth token check if deploying to untrusted network
4. **Frontend metadata:** Still says "Create Next App" - update in [layout.js](src/app/layout.js) line 14
5. **API response timing:** 30s timeout on AI calls may be too short for high-res images; increase if needed in detect.routes.js line 33

## Code Review Checklist (for new PRs)

- [ ] Backend routes: error handling, Firebase null checks, response normalization
- [ ] Frontend: Socket.IO cleanup on unmount, Firestore query error handling
- [ ] AI Server: model initialization safety, numpy array bounds checks, JSON serialization of numpy types
- [ ] Cross-component: updated both Admin & Operator sidebars for new authenticated routes
