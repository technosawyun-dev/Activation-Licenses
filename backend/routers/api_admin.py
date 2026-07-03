"""
JSON API for the admin dashboard (consumed by the separate Vite+React frontend).
Mirrors the business logic in admin.py exactly — same RBAC rules, same
validation, same audit logging — just JSON in/out instead of
Form()+TemplateResponse/Redirect, and JWT bearer auth instead of session cookies.
"""
import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    AdminUser, Project, Customer, ActivationToken, License,
    Device, AuditLog,
)
from ..crypto import (
    generate_key_pair, derive_public_key,
    encrypt_private_key, decrypt_private_key,
)
from ..auth import hash_password, verify_password
from ..jwt_auth import create_access_token, get_current_user, require_role
from ..config import settings

router = APIRouter(prefix="/api/admin")

ROLES_ADMIN = ("SUPER_OWNER", "ADMIN")
ROLES_SUPER_OWNER_ONLY = ("SUPER_OWNER",)


# ---------- Request bodies ----------

class LoginBody(BaseModel):
    username: str
    password: str


class ProjectCreateBody(BaseModel):
    name: str
    slug: str
    description: str = ""
    deep_link_scheme: str
    type: str = ""
    status: str = "Development"
    version: str = ""
    import_private_key: str = ""


class ProjectUpdateBody(BaseModel):
    name: str
    description: str = ""
    type: str = ""
    status: str = ""
    version: str = ""


class ReimportKeyBody(BaseModel):
    private_key: str


class CustomerBody(BaseModel):
    name: str
    company_name: str = ""
    email: str = ""
    phone: str = ""
    country: str = ""
    notes: str = ""
    status: str = "active"


class TokenCreateBody(BaseModel):
    project_id: int
    customer_id: int
    license_number: str
    license_type: str = "lifetime"
    expires_days: str = ""


class UserCreateBody(BaseModel):
    username: str
    email: str = ""
    password: str
    role: str = "ADMIN"


class RoleUpdateBody(BaseModel):
    role: str


class PasswordResetBody(BaseModel):
    new_password: str


# ---------- Serialization helpers ----------

def _user_dict(u: AdminUser) -> dict:
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "role": u.role, "status": u.status, "created_at": u.created_at,
    }


def _project_dict(p: Project) -> dict:
    return {
        "id": p.id, "name": p.name, "slug": p.slug, "description": p.description,
        "deep_link_scheme": p.deep_link_scheme, "public_key_b64": p.public_key_b64,
        "type": p.type, "status": p.status, "version": p.version,
        "repository_url": p.repository_url, "owner": p.owner, "created_at": p.created_at,
        "token_count": len(p.tokens), "license_count": len(p.licenses),
    }


def _customer_dict(c: Customer) -> dict:
    return {
        "id": c.id, "name": c.name, "company_name": c.company_name, "email": c.email,
        "phone": c.phone, "country": c.country, "notes": c.notes, "status": c.status,
        "created_at": c.created_at,
        "license_count": len([t for t in c.tokens if t.license]),
    }


def _token_dict(t: ActivationToken, include_activation_url: bool = False, include_license: bool = False) -> dict:
    d = {
        "id": t.id, "token": t.token, "project_id": t.project_id, "customer_id": t.customer_id,
        "license_number": t.license_number, "license_type": t.license_type, "status": t.status,
        "expires_at": t.expires_at, "created_at": t.created_at, "used_at": t.used_at,
        "project_name": t.project.name, "customer_name": t.customer.name,
    }
    if include_activation_url:
        d["activation_url"] = f"{settings.BASE_URL}/activate?token={t.token}"
    if include_license:
        d["license"] = _license_dict(t.license) if t.license else None
    return d


def _license_dict(lic: License) -> dict:
    return {
        "id": lic.id, "license_number": lic.license_number, "computer_id": lic.computer_id,
        "activated_at": lic.activated_at, "deactivated_at": lic.deactivated_at,
        "is_active": lic.is_active,
        "customer_name": lic.customer.name, "project_name": lic.project.name,
    }


def _device_dict(dv: Device) -> dict:
    return {
        "id": dv.id, "hostname": dv.hostname, "fingerprint": dv.fingerprint, "os": dv.os,
        "app_version": dv.app_version, "last_seen": dv.last_seen, "status": dv.status,
        "blocked_at": dv.blocked_at, "created_at": dv.created_at,
        "customer_name": dv.customer.name if dv.customer else None,
    }


def _audit_dict(a: AuditLog) -> dict:
    return {
        "id": a.id, "actor_name": a.actor_name, "action": a.action,
        "resource_type": a.resource_type, "resource_id": a.resource_id,
        "resource_name": a.resource_name, "ip_address": a.ip_address,
        "extra_data": a.extra_data, "created_at": a.created_at,
    }


def _log(db: Session, request: Request, user: AdminUser, action: str,
         resource_type: str = None, resource_id: str = None,
         resource_name: str = None, meta: dict = None):
    ip = request.client.host if request.client else "unknown"
    db.add(AuditLog(
        actor_id=user.id,
        actor_name=user.username,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        resource_name=resource_name,
        extra_data=json.dumps(meta) if meta else None,
        ip_address=ip,
    ))


# ---------- Auth ----------

@router.post("/login")
async def login(body: LoginBody, request: Request, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid_credentials")
    if user.status != "active":
        raise HTTPException(status_code=401, detail="account_suspended")
    _log(db, request, user, "login")
    db.commit()
    return {"access_token": create_access_token(user), "user": _user_dict(user)}


@router.post("/logout")
async def logout(request: Request, db: Session = Depends(get_db),
                  user: AdminUser = Depends(get_current_user)):
    _log(db, request, user, "logout")
    db.commit()
    return {"ok": True}


@router.get("/me")
async def me(user: AdminUser = Depends(get_current_user)):
    return _user_dict(user)


# ---------- Dashboard ----------

@router.get("/dashboard")
async def dashboard(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return {
        "total_projects": db.query(Project).count(),
        "total_customers": db.query(Customer).count(),
        "pending_tokens": db.query(ActivationToken).filter(ActivationToken.status == "pending").count(),
        "active_licenses": db.query(License).filter(License.is_active == True).count(),
        "total_devices": db.query(Device).count(),
        "recent_tokens": [_token_dict(t) for t in db.query(ActivationToken).order_by(ActivationToken.created_at.desc()).limit(6).all()],
        "recent_licenses": [_license_dict(l) for l in db.query(License).order_by(License.activated_at.desc()).limit(6).all()],
        "recent_audit": [_audit_dict(a) for a in db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()],
    }


# ---------- Projects ----------

@router.get("/projects")
async def projects_list(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return [_project_dict(p) for p in db.query(Project).order_by(Project.created_at.desc()).all()]


@router.post("/projects")
async def project_create(body: ProjectCreateBody, request: Request, db: Session = Depends(get_db),
                          user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    slug = body.slug.strip().lower().replace(" ", "-")
    if db.query(Project).filter(Project.slug == slug).first():
        raise HTTPException(status_code=409, detail=f'Slug "{slug}" already exists')
    if not settings.ENCRYPTION_KEY:
        raise HTTPException(status_code=500, detail="ENCRYPTION_KEY not set in .env")

    try:
        if body.import_private_key.strip():
            private_b64 = body.import_private_key.strip()
            public_b64 = derive_public_key(private_b64)
        else:
            public_b64, private_b64 = generate_key_pair()
        private_enc = encrypt_private_key(private_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Key error: {str(e)[:60]}")

    project = Project(
        name=body.name.strip(), slug=slug, description=body.description.strip(),
        deep_link_scheme=body.deep_link_scheme.strip(), public_key_b64=public_b64,
        private_key_enc=private_enc, type=body.type.strip() or None,
        status=body.status.strip() or "Development", version=body.version.strip() or None,
    )
    db.add(project)
    db.flush()
    _log(db, request, user, "create_project", "project", project.id, project.name)
    db.commit()
    return _project_dict(project)


@router.get("/projects/{project_id}")
async def project_detail(project_id: int, db: Session = Depends(get_db),
                          user: AdminUser = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    tokens = (
        db.query(ActivationToken).filter(ActivationToken.project_id == project_id)
        .order_by(ActivationToken.created_at.desc()).limit(20).all()
    )
    return {**_project_dict(project), "tokens": [_token_dict(t) for t in tokens]}


@router.patch("/projects/{project_id}")
async def project_update(project_id: int, body: ProjectUpdateBody, request: Request,
                          db: Session = Depends(get_db),
                          user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = body.name.strip()
    project.description = body.description.strip()
    project.type = body.type.strip() or None
    project.status = body.status.strip() or project.status
    project.version = body.version.strip() or None
    _log(db, request, user, "update_project", "project", project_id, project.name)
    db.commit()
    return _project_dict(project)


@router.post("/projects/{project_id}/reimport-key")
async def project_reimport_key(project_id: int, body: ReimportKeyBody, request: Request,
                                db: Session = Depends(get_db),
                                user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        public_b64 = derive_public_key(body.private_key.strip())
        project.public_key_b64 = public_b64
        project.private_key_enc = encrypt_private_key(body.private_key.strip())
        _log(db, request, user, "reimport_key", "project", project_id, project.name)
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Key import failed: {str(e)[:60]}")
    return _project_dict(project)


@router.delete("/projects/{project_id}")
async def project_delete(project_id: int, request: Request, db: Session = Depends(get_db),
                          user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        _log(db, request, user, "delete_project", "project", project_id, project.name)
        db.delete(project)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete: project has existing tokens or licenses")
    return {"ok": True}


# ---------- Customers ----------

@router.get("/customers")
async def customers_list(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return [_customer_dict(c) for c in db.query(Customer).order_by(Customer.created_at.desc()).all()]


@router.post("/customers")
async def customer_create(body: CustomerBody, request: Request, db: Session = Depends(get_db),
                           user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    customer = Customer(
        name=body.name.strip(), company_name=body.company_name.strip() or None,
        email=body.email.strip() or None, phone=body.phone.strip() or None,
        country=body.country.strip() or None, notes=body.notes.strip() or None,
        status="active",
    )
    db.add(customer)
    db.flush()
    _log(db, request, user, "create_customer", "customer", customer.id, customer.name)
    db.commit()
    return _customer_dict(customer)


@router.patch("/customers/{customer_id}")
async def customer_update(customer_id: int, body: CustomerBody, request: Request,
                           db: Session = Depends(get_db),
                           user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.name = body.name.strip()
    customer.company_name = body.company_name.strip() or None
    customer.email = body.email.strip() or None
    customer.phone = body.phone.strip() or None
    customer.country = body.country.strip() or None
    customer.notes = body.notes.strip() or None
    customer.status = body.status.strip()
    _log(db, request, user, "update_customer", "customer", customer_id, customer.name)
    db.commit()
    return _customer_dict(customer)


@router.delete("/customers/{customer_id}")
async def customer_delete(customer_id: int, request: Request, db: Session = Depends(get_db),
                           user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    try:
        _log(db, request, user, "delete_customer", "customer", customer_id, customer.name)
        db.delete(customer)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete: customer has existing tokens or licenses")
    return {"ok": True}


# ---------- Tokens ----------

@router.get("/tokens")
async def tokens_list(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return [_token_dict(t) for t in db.query(ActivationToken).order_by(ActivationToken.created_at.desc()).all()]


@router.post("/tokens")
async def token_create(body: TokenCreateBody, request: Request, db: Session = Depends(get_db),
                        user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    project = db.query(Project).filter(Project.id == body.project_id).first()
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not project or not customer:
        raise HTTPException(status_code=400, detail="Invalid project or customer")

    expires_at = None
    if body.expires_days.strip():
        try:
            expires_at = datetime.utcnow() + timedelta(days=int(body.expires_days))
        except ValueError:
            raise HTTPException(status_code=400, detail="Link expiry must be a whole number of days")

    token_value = secrets.token_urlsafe(32)
    token = ActivationToken(
        token=token_value, project_id=body.project_id, customer_id=body.customer_id,
        license_number=body.license_number.strip(), license_type=body.license_type.strip(),
        expires_at=expires_at,
    )
    db.add(token)
    db.flush()
    _log(db, request, user, "create_token", "token", token.id, body.license_number,
         {"project": project.name, "customer": customer.name})
    db.commit()
    return _token_dict(token, include_activation_url=True)


@router.get("/tokens/{token_id}")
async def token_detail(token_id: int, db: Session = Depends(get_db),
                        user: AdminUser = Depends(get_current_user)):
    token = db.query(ActivationToken).filter(ActivationToken.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    return _token_dict(token, include_activation_url=True, include_license=True)


@router.post("/tokens/{token_id}/revoke")
async def token_revoke(token_id: int, request: Request, db: Session = Depends(get_db),
                        user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    token = db.query(ActivationToken).filter(ActivationToken.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    if token.status != "pending":
        raise HTTPException(status_code=409, detail="Only pending tokens can be revoked")
    token.status = "revoked"
    _log(db, request, user, "revoke_token", "token", token_id, token.license_number)
    db.commit()
    return _token_dict(token, include_activation_url=True)


# ---------- Licenses ----------

@router.get("/licenses")
async def licenses_list(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return [_license_dict(l) for l in db.query(License).order_by(License.activated_at.desc()).all()]


@router.post("/licenses/{license_id}/deactivate")
async def license_deactivate(license_id: int, request: Request, db: Session = Depends(get_db),
                              user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    lic = db.query(License).filter(License.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    if not lic.is_active:
        raise HTTPException(status_code=409, detail="License is already inactive")
    lic.is_active = False
    lic.deactivated_at = datetime.utcnow()
    _log(db, request, user, "deactivate_license", "license", license_id, lic.license_number)
    db.commit()
    return _license_dict(lic)


# ---------- Devices ----------

@router.get("/devices")
async def devices_list(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return [_device_dict(d) for d in db.query(Device).order_by(Device.created_at.desc()).all()]


@router.post("/devices/{device_id}/block")
async def device_block(device_id: int, request: Request, db: Session = Depends(get_db),
                        user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.status == "blocked":
        raise HTTPException(status_code=409, detail="Device is already blocked")
    device.status = "blocked"
    device.blocked_at = datetime.utcnow()
    _log(db, request, user, "block_device", "device", device_id, device.hostname or device.fingerprint)
    db.commit()
    return _device_dict(device)


@router.post("/devices/{device_id}/unblock")
async def device_unblock(device_id: int, request: Request, db: Session = Depends(get_db),
                          user: AdminUser = Depends(require_role(*ROLES_ADMIN))):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    if device.status != "blocked":
        raise HTTPException(status_code=409, detail="Device is not blocked")
    device.status = "online"
    device.blocked_at = None
    _log(db, request, user, "unblock_device", "device", device_id, device.hostname or device.fingerprint)
    db.commit()
    return _device_dict(device)


# ---------- Audit Logs ----------

@router.get("/audit-logs")
async def audit_logs_list(q: str = "", resource: str = "", db: Session = Depends(get_db),
                           user: AdminUser = Depends(get_current_user)):
    query = db.query(AuditLog)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            (AuditLog.actor_name.ilike(like)) |
            (AuditLog.action.ilike(like)) |
            (AuditLog.resource_name.ilike(like))
        )
    if resource.strip():
        query = query.filter(AuditLog.resource_type == resource.strip())
    logs = query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return [_audit_dict(a) for a in logs]


# ---------- Users (SUPER_OWNER only) ----------

@router.get("/users")
async def users_list(db: Session = Depends(get_db), user: AdminUser = Depends(get_current_user)):
    return [_user_dict(u) for u in db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()]


@router.post("/users")
async def user_create(body: UserCreateBody, request: Request, db: Session = Depends(get_db),
                       user: AdminUser = Depends(require_role(*ROLES_SUPER_OWNER_ONLY))):
    if body.role.strip() not in ROLES_ADMIN:
        raise HTTPException(status_code=400, detail="Invalid role")
    if db.query(AdminUser).filter(AdminUser.username == body.username.strip()).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    new_user = AdminUser(
        username=body.username.strip(), email=body.email.strip() or None,
        password_hash=hash_password(body.password), role=body.role.strip(), status="active",
    )
    db.add(new_user)
    db.flush()
    _log(db, request, user, "create_user", "user", new_user.id, new_user.username, {"role": body.role})
    db.commit()
    return _user_dict(new_user)


@router.patch("/users/{user_id}/role")
async def user_update_role(user_id: int, body: RoleUpdateBody, request: Request,
                            db: Session = Depends(get_db),
                            user: AdminUser = Depends(require_role(*ROLES_SUPER_OWNER_ONLY))):
    if body.role.strip() not in ROLES_ADMIN:
        raise HTTPException(status_code=400, detail="Invalid role")
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "SUPER_OWNER" and body.role != "SUPER_OWNER":
        raise HTTPException(status_code=409, detail="SUPER_OWNER cannot be demoted")
    target.role = body.role
    _log(db, request, user, "update_user_role", "user", user_id, target.username, {"new_role": body.role})
    db.commit()
    return _user_dict(target)


@router.post("/users/{user_id}/toggle-status")
async def user_toggle_status(user_id: int, request: Request, db: Session = Depends(get_db),
                              user: AdminUser = Depends(require_role(*ROLES_SUPER_OWNER_ONLY))):
    if user_id == user.id:
        raise HTTPException(status_code=403, detail="Cannot change your own status")
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.status = "suspended" if target.status == "active" else "active"
    _log(db, request, user, "toggle_user_status", "user", user_id, target.username,
         {"new_status": target.status})
    db.commit()
    return _user_dict(target)


@router.post("/users/{user_id}/reset-password")
async def user_reset_password(user_id: int, body: PasswordResetBody, request: Request,
                               db: Session = Depends(get_db),
                               user: AdminUser = Depends(require_role(*ROLES_SUPER_OWNER_ONLY))):
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.password_hash = hash_password(body.new_password)
    _log(db, request, user, "reset_password", "user", user_id, target.username)
    db.commit()
    return {"ok": True}
