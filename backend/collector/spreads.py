import numpy as np


def etf_premium_discount(etf_price: float, nav: float) -> float:
    """
    Returns ETF premium/discount in basis points.

    Positive -> Premium
    Negative -> Discount
    """

    if nav <= 0:
        raise ValueError("NAV must be greater than zero.")

    return ((etf_price - nav) / nav) * 10_000


def futures_basis(
    spot: float,
    futures: float,
    days_to_expiry: int
) -> float:
    """
    Returns annualized futures basis in basis points.
    """

    if spot <= 0:
        raise ValueError("Spot price must be greater than zero.")

    if days_to_expiry <= 0:
        raise ValueError("Days to expiry must be greater than zero.")

    raw_basis = (futures - spot) / spot

    return (raw_basis / days_to_expiry) * 365 * 10_000


def z_score(
    current: float,
    window: list[float]
) -> float:
    """
    Returns how statistically extreme the current value is
    compared to its historical window.
    """

    if len(window) == 0:
        return 0.0

    arr = np.array(window)

    mean = arr.mean()
    std = arr.std()

    if std == 0:
        return 0.0

    return (current - mean) / std


def cross_exchange_spread(
    price_nse: float,
    price_bse: float
) -> float:
    """
    Returns NSE-BSE spread in basis points.
    """

    mid = (price_nse + price_bse) / 2

    if mid <= 0:
        raise ValueError("Prices must be greater than zero.")

    return abs(price_nse - price_bse) / mid * 10000
