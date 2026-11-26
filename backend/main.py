from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.convert import router as convert_router

app = FastAPI(title="TriConvert API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(convert_router, prefix="/api")


@app.get("/")
def home():
    return {"message": "TriConvert 3D model converter API"}


@app.get("/api/health")
def health():
    return {"status": "running"}
