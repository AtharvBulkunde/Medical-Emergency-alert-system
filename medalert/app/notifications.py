"""Notification adapter deliberately disabled in this starter.

This demo records an alert in the database and dashboard only. It does not send
SMS, phone calls, or ambulance dispatch. Configure a provider server-side only
after consent, delivery callbacks, abuse controls, and end-to-end testing.
"""
def notify_emergency_contacts(*, contacts, user_name: str, alert_id: int,
                              latitude=None, longitude=None) -> dict:
    return {"sent": 0, "provider": "not_configured",
            "message": "No SMS provider configured; contacts have not been notified."}
