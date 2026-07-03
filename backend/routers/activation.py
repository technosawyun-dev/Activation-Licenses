"""
Public API + redirect page — called by desktop apps and customer browsers.
"""
import json
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ActivationToken, License, Device
from ..crypto import decrypt_private_key, sign_certificate, make_canonical
from ..templates_config import templates
from ..config import settings

router = APIRouter()


class ActivateRequest(BaseModel):
    token: str
    computerId: str
    hostname: str | None = None
    os: str | None = None
    appVersion: str | None = None


class ValidateRequest(BaseModel):
    licenseNumber: str
    computerId: str


@router.get("/activate")
async def activate_redirect(token: str, request: Request, db: Session = Depends(get_db)):
    """
    Customer clicks the link the admin sent.
    We serve a page that does a JS redirect to the deep link scheme.
    """
    record = db.query(ActivationToken).filter(ActivationToken.token == token).first()
    if not record:
        return templates.TemplateResponse(
            request, "activate.html",
            {"error": "Invalid activation link.", "token": None, "app_name": settings.APP_NAME},
        )

    if record.status == "used":
        return templates.TemplateResponse(
            request, "activate.html",
            {"error": "This activation link has already been used.",
             "token": None, "app_name": record.project.name},
        )
    if record.status == "revoked":
        return templates.TemplateResponse(
            request, "activate.html",
            {"error": "This activation link has been revoked.",
             "token": None, "app_name": record.project.name},
        )
    if record.expires_at and record.expires_at < datetime.utcnow():
        record.status = "expired"
        db.commit()
        return templates.TemplateResponse(
            request, "activate.html",
            {"error": "This activation link has expired.",
             "token": None, "app_name": record.project.name},
        )

    scheme = record.project.deep_link_scheme
    app_name = record.project.name
    return templates.TemplateResponse(
        request, "activate.html",
        {
            "error": None,
            "token": token,
            "scheme": scheme,
            "app_name": app_name,
        },
    )


@router.post("/activate")
@router.post("/api/v1/activate")
async def do_activate(body: ActivateRequest, db: Session = Depends(get_db)):
    """
    Called by the desktop app after receiving the deep link.
    Validates the token, signs a certificate, and returns it.
    """
    record = (
        db.query(ActivationToken)
        .filter(ActivationToken.token == body.token)
        .first()
    )

    if not record:
        raise HTTPException(status_code=400, detail="token_invalid")
    if record.status == "used":
        raise HTTPException(status_code=400, detail="token_used")
    if record.status == "revoked":
        raise HTTPException(status_code=400, detail="token_invalid")
    if record.expires_at and record.expires_at < datetime.utcnow():
        record.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="token_expired")

    existing_device = db.query(Device).filter(Device.fingerprint == body.computerId).first()
    if existing_device and existing_device.status == "blocked":
        raise HTTPException(status_code=403, detail="device_blocked")

    # Decrypt project private key and sign the certificate
    private_key = decrypt_private_key(record.project.private_key_enc)
    activation_date = datetime.utcnow().strftime("%Y-%m-%d")
    canonical = make_canonical(
        record.license_number,
        record.customer.name,
        body.computerId,
        activation_date,
        record.license_type,
    )
    signature = sign_certificate(private_key, canonical)

    certificate = {
        "licenseNumber": record.license_number,
        "customerName": record.customer.name,
        "computerId": body.computerId,
        "activationDate": activation_date,
        "licenseType": record.license_type,
        "signature": signature,
    }

    # Mark token as used and record the license
    record.status = "used"
    record.used_at = datetime.utcnow()

    license_row = License(
        token_id=record.id,
        project_id=record.project_id,
        customer_id=record.customer_id,
        license_number=record.license_number,
        computer_id=body.computerId,
        certificate_json=json.dumps(certificate),
    )
    db.add(license_row)
    db.flush()  # assign license_row.id before linking the device

    now = datetime.utcnow()
    if existing_device:
        existing_device.license_id = license_row.id
        existing_device.customer_id = record.customer_id
        existing_device.hostname = body.hostname
        existing_device.os = body.os
        existing_device.app_version = body.appVersion
        existing_device.last_seen = now
        existing_device.status = "online"
    else:
        db.add(
            Device(
                license_id=license_row.id,
                customer_id=record.customer_id,
                hostname=body.hostname,
                fingerprint=body.computerId,
                os=body.os,
                app_version=body.appVersion,
                last_seen=now,
                status="online",
            )
        )
    db.commit()

    return certificate


@router.post("/api/v1/validate")
async def validate_license(body: ValidateRequest, db: Session = Depends(get_db)):
    """
    Best-effort online re-check called periodically by the desktop app.
    The app already trusts its locally-verified signed certificate; this
    only catches licenses deactivated or devices blocked *after* activation.
    """
    license_row = (
        db.query(License)
        .filter(
            License.license_number == body.licenseNumber,
            License.computer_id == body.computerId,
        )
        .first()
    )
    if not license_row or not license_row.is_active:
        return {"valid": False, "reason": "license_inactive"}

    device = db.query(Device).filter(Device.fingerprint == body.computerId).first()
    if device and device.status == "blocked":
        return {"valid": False, "reason": "device_blocked"}

    if device:
        device.last_seen = datetime.utcnow()
        device.status = "online"
        db.commit()

    return {"valid": True, "reason": None}
