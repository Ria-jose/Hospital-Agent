# Carepath patient intake

Vite/React frontend for Vercel and FastAPI backend for Render. The API reads the doctor roster from the root `doctors.csv` file.

## Deploy the API to Render

1. Push this project to a Git repository and connect it to Render.
2. Create a web service using the included `render.yaml` (or select the repository blueprint).
3. Set `FRONTEND_ORIGINS` to the deployed Vercel origin, such as `https://your-app.vercel.app`, and set `GROQ_API_KEY` to your Groq API key in Render's secret environment settings. The model defaults to `openai/gpt-oss-120b`; you can change it with `GROQ_MODEL`.
4. Deploy. Confirm `https://<render-service>.onrender.com/api/health` returns `{"status":"ok"}`.

## Deploy the frontend to Vercel

1. Import the same repository into Vercel.
2. Set the project root to the repository root and add `VITE_API_URL=https://<render-service>.onrender.com`.
3. Deploy. The included `vercel.json` builds `frontend` and serves its `dist` output.
4. Copy the Vercel origin into Render's `FRONTEND_ORIGINS` setting and redeploy the API if needed.

For local development, start the API from `backend` with `uvicorn main:app --reload --port 8000`, then start the frontend from `frontend` with `npm install` and `npm run dev`. Set `VITE_API_URL=http://localhost:8000` in `frontend/.env.local`.

## Notes

- Triage calls Groq using `GROQ_MODEL` (default `openai/gpt-oss-120b`) when `GROQ_API_KEY` is configured. Emergency and crisis keyword checks run before the model call. Model failures fall back to local keyword routing. The patient's symptom description is sent to Groq for classification; the patient's name and age are not sent.
- Doctor assignments are kept in backend process memory. They reset when the service restarts and are not shared across multiple Render instances. Use a shared database and an operationally reviewed intake workflow before relying on this for live patient scheduling.
- The interface displays emergency guidance, but it is not a diagnostic service. Keep emergency instructions appropriate to the deployment location.
