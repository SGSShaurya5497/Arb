import requests
import yfinance as yf

def get_nse_price(symbol: str)->float:
    pass

def get_mfapi_price(symbol: str)->float:
    pass

def get_yf_price(symbol: str)->float:
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="1d")
    if data.empty:
        raise ValueError(f"No data found for symbol: {symbol}")
    return float(data['Close'].iloc[-1])


