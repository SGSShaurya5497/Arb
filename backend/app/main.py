from fastapi import FastAPI
from app.core.database import engine
app=FastAPI()

@app.get("/")
def root():
    return {"message": "Arb Backend is running"}

@app.get("/health")
def health():
    connection = engine.connect()
    connection.close()
    return {"status": "healthy"}
