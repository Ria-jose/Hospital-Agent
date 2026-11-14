import csv
import os
from pathlib import Path
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent.parent
DOCTORS_CSV = Path(os.getenv("DOCTORS_CSV", BASE_DIR / "doctors.csv"))
lock = Lock()
assignments: set[str] = set()

app = FastAPI(title="Hospital Intake API", version="1.0.0")
origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class Intake(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=125)
    symptoms: str = Field(min_length=3, max_length=2000)


def read_doctors() -> list[dict[str, str]]:
    try:
        with DOCTORS_CSV.open(newline="", encoding="utf-8-sig") as source:
            rows = list(csv.DictReader(source))
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Doctor roster is unavailable") from exc
    required = {"doctor_name", "ward", "status", "next_slot", "slot_minutes"}
    if not rows or not required.issubset(rows[0]):
        raise HTTPException(status_code=500, detail="Doctor roster has an invalid format")
    return rows


EMERGENCY_TERMS = (
    "chest pain", "can't breathe", "cannot breathe", "difficulty breathing", "shortness of breath",
    "unconscious", "severe bleeding", "heart attack", "stroke", "seizure", "overdose",
)
CRISIS_TERMS = ("suicide", "kill myself", "self-harm", "self harm", "want to die")
MENTAL_TERMS = ("anxiety", "anxious", "depression", "depressed", "panic attack", "trauma", "stress", "mental health")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


def classify(symptoms: str) -> tuple[Literal["general", "emergency", "mental_health"], str]:
    text = symptoms.casefold()
    if any(term in text for term in CRISIS_TERMS):
        return "mental_health", "A mental health crisis indicator was detected. Please seek immediate support."
    if any(term in text for term in EMERGENCY_TERMS):
        return "emergency", "An urgent symptom indicator was detected."
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        try:
            response = Groq(api_key=api_key, timeout=8.0, max_retries=0).chat.completions.create(
                model=GROQ_MODEL,
                temperature=0,
                max_completion_tokens=20,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You route a patient's symptom description to one hospital service. "
                            "Choose exactly one label: emergency, mental_health, or general. "
                            "Use emergency for potentially life-threatening or urgent physical symptoms; "
                            "mental_health for psychological or emotional support; general for other concerns. "
                            "This is routing only, not a diagnosis. Reply with the label only."
                        ),
                    },
                    {"role": "user", "content": symptoms},
                ],
            )
            label = (response.choices[0].message.content or "").strip().casefold()
            if label in {"general", "emergency", "mental_health"}:
                return label, "Symptoms were routed by the Groq language model."
        except Exception:
            # Keep intake available if the model is down, times out, or rejects a request.
            pass
    if any(term in text for term in MENTAL_TERMS):
        return "mental_health", "Symptoms matched the mental health service using fallback routing."
    return "general", "Symptoms were routed to the general service using fallback routing."


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "service": "Hospital Intake API",
        "status": "ok",
        "health": "/api/health",
        "doctors": "/api/doctors",
    }


@app.get("/api/doctors")
def doctors():
    with lock:
        rows = read_doctors()
        return [{**row, "status": "busy" if row["doctor_name"] in assignments else row["status"]} for row in rows]


@app.post("/api/triage")
def triage(intake: Intake):
    ward, reasoning = classify(intake.symptoms)
    with lock:
        rows = read_doctors()
        doctor = next((row for row in rows if row["ward"] == ward and row["status"] == "active" and row["doctor_name"] not in assignments), None)
        if doctor:
            assignments.add(doctor["doctor_name"])
    return {
        "patient_name": intake.name.strip(),
        "ward": ward,
        "reasoning": reasoning,
        "assigned_doctor": doctor["doctor_name"] if doctor else None,
        "next_slot": doctor["next_slot"] if doctor else None,
        "slot_minutes": int(doctor["slot_minutes"]) if doctor else None,
        "queued": doctor is None,
        "emergency_notice": ward == "emergency",
        "crisis_notice": any(term in intake.symptoms.casefold() for term in CRISIS_TERMS),
    }
