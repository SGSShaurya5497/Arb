import requests
import yfinance as yf
import numpy as np

def get_nse_price(symbol: str)->float:
    pass

def get_mfapi_nav(scheme_code: str) -> float:
    url = f"https://api.mfapi.in/mf/{scheme_code}"

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    data = response.json()

    if "data" not in data or not data["data"]:
        raise ValueError(f"No NAV data found for {scheme_code}")

    latest_nav = data["data"][0]["nav"]

    return float(latest_nav)

def get_yf_price(symbol: str)->float:
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="1d")
    if data.empty:
        raise ValueError(f"No data found for symbol: {symbol}")
    return float(data['Close'].iloc[-1])


