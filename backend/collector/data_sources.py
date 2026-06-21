import requests
import yfinance as yf
import numpy as np

# ---------------------------------------------------------------------------
# NSE price fetcher
# ---------------------------------------------------------------------------
# NSE (National Stock Exchange of India) does not have an official public API.
# However, their website serves live data through an internal JSON endpoint.
# The endpoint requires specific HTTP headers — particularly:
#   - User-Agent: NSE's server blocks requests that look like bots
#   - Referer: NSE checks that requests appear to come from their own site
#
# This is the standard approach used in the Indian fintech community.
# If NSE changes their endpoint, only this function needs to update.
# ---------------------------------------------------------------------------
_NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
    "Connection": "keep-alive",
}

_NSE_QUOTE_URL = "https://www.nseindia.com/api/quote-equity?symbol={symbol}"


def get_nse_price(symbol: str) -> float:
    """
    Fetches the last traded price (LTP) for an NSE-listed equity or ETF.

    Args:
        symbol: NSE symbol WITHOUT the exchange suffix, e.g. "NIFTYBEES"
                (not "NIFTYBEES.NS" — that's the Yahoo Finance format)

    Returns:
        Last traded price as a float.

    Raises:
        ValueError: if the response has no price data
        requests.HTTPError: if NSE returns a non-200 status

    Note:
        NSE's website requires session cookies for some endpoints.
        If this raises a 401/403 error, add a session cookie init step.
    """
    url = _NSE_QUOTE_URL.format(symbol=symbol)

    # Use a session so cookies are automatically maintained across requests.
    # NSE sometimes issues a cookie on the first request that must be sent back.
    with requests.Session() as session:
        session.headers.update(_NSE_HEADERS)

        # Initial visit to set cookies (NSE requires this handshake)
        session.get("https://www.nseindia.com", timeout=10)

        response = session.get(url, timeout=10)
        response.raise_for_status()

    data = response.json()

    # NSE response structure:
    # { "priceInfo": { "lastPrice": 123.45, ... }, ... }
    try:
        last_price = data["priceInfo"]["lastPrice"]
        return float(last_price)
    except (KeyError, TypeError) as exc:
        raise ValueError(
            f"Unexpected NSE response structure for symbol '{symbol}': {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# MFAPI NAV fetcher
# ---------------------------------------------------------------------------
def get_mfapi_nav(scheme_code: str) -> float:
    """
    Fetches the latest NAV for a mutual fund / ETF from MFAPI.in.

    Args:
        scheme_code: MFAPI numeric scheme code, e.g. "118825" for NIFTYBEES

    Returns:
        Latest NAV as a float.

    Note:
        MFAPI NAV data is end-of-day, not real-time. The "latest" NAV
        reflects the previous business day's closing NAV. This is by design —
        official Indian mutual fund NAVs are declared once per day by AMFI.
        The premium/discount spread between live ETF price and day-old NAV
        is still a valid and widely-used arbitrage signal.
    """
    url = f"https://api.mfapi.in/mf/{scheme_code}"

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    data = response.json()

    if "data" not in data or not data["data"]:
        raise ValueError(f"No NAV data found for scheme code: {scheme_code}")

    latest_nav = data["data"][0]["nav"]
    return float(latest_nav)


# ---------------------------------------------------------------------------
# Yahoo Finance price fetcher
# ---------------------------------------------------------------------------
def get_yf_price(symbol: str) -> float:
    """
    Fetches the most recent closing price via Yahoo Finance.

    Args:
        symbol: Yahoo Finance ticker, e.g. "NIFTYBEES.NS"
                The ".NS" suffix tells Yahoo this is an NSE-listed security.

    Returns:
        Most recent closing price as a float.

    Note:
        yfinance uses period="1d" which fetches today's OHLCV bar.
        During market hours this reflects the current day's open/intraday price.
        After market close it reflects the final closing price.
        For real-time prices, get_nse_price() is more accurate during trading.
    """
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="1d")
    if data.empty:
        raise ValueError(f"No price data found for Yahoo Finance symbol: {symbol}")
    return float(data['Close'].iloc[-1])
