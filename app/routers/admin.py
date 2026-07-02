"""
Admin web dashboard — all pages and form-POST actions.
All routes require an authenticated session.
"""
import json
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import (
    AdminUser, Project, Customer, ActivationToken, License,
    Device, AuditLog,
)
from ..crypto import (
    generate_key_pair, derive_public_key,
    encrypt_private_key, decrypt_private_key,
)
from ..auth import hash_password, verify_password, require_login, login_redirect
from ..templates_config import templates
from ..config import settings

router = APIRouter(prefix="/admin")


# Two roles only: SUPER_OWNER (full control, incl. managing admin accounts)
# and ADMIN (full CRUD on everything except admin-account management).
# GET/list routes are intentionally unrestricted (any logged-in user can read);
# only mutating routes are gated.
ROLES_ADMIN = {"SUPER_OWNER", "ADMIN"}
ROLES_SUPER_OWNER_ONLY = {"SUPER_OWNER"}


# Auth helpers

def _ctx(request: Request, db: Session, **extra):
    user = require_login(request, db)
    return {"user": user, "app_name": settings.APP_NAME, **extra}


def _guard(request: Request, db: Session, roles: set[str] | None = None):
    """Returns (user, None) if allowed, or (None, redirect) otherwise.
    `roles`, when given, restricts the action to those AdminUser.role values —
    the caller is always logged in but may lack permission for this action."""
    user = require_login(request, db)
    if not user:
        return None, login_redirect()
    if roles is not None and user.role not in roles:
        return None, RedirectResponse("/admin/dashboard?error=Permission+denied", status_code=302)
    return user, None


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


# Login / Logout

@router.get("/login")
async def login_page(request: Request, error: str = "", db: Session = Depends(get_db)):
    if request.session.get("user_id"):
        return RedirectResponse("/admin/dashboard", status_code=302)
    return templates.TemplateResponse(
        request, "login.html",
        {"error": error, "app_name": settings.APP_NAME},
    )


@router.post("/login")
async def login_post(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        return RedirectResponse("/admin/login?error=Invalid+username+or+password", status_code=302)
    if user.status == "suspended":
        return RedirectResponse("/admin/login?error=Your+account+has+been+suspended", status_code=302)
    request.session["user_id"] = user.id
    request.session["username"] = user.username
    _log(db, request, user, "login")
    db.commit()
    return RedirectResponse("/admin/dashboard", status_code=302)


@router.get("/logout")
async def logout(request: Request, db: Session = Depends(get_db)):
    user_id = request.session.get("user_id")
    if user_id:
        user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
        if user:
            _log(db, request, user, "logout")
            db.commit()
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=302)


# Dashboard

@router.get("/dashboard")
async def dashboard(request: Request, db: Session = Depends(get_db)):
    user, redir = _guard(request, db)
    if redir:
        return redir

    total_projects = db.query(Project).count()
    total_customers = db.query(Customer).count()
    pending_tokens = db.query(ActivationToken).filter(ActivationToken.status == "pending").count()
    active_licenses = db.query(License).filter(License.is_active == True).count()
    total_devices = db.query(Device).count()

    recent_tokens = (
        db.query(ActivationToken)
        .order_by(ActivationToken.created_at.desc())
        .limit(6).all()
    )
    recent_licenses = (
        db.query(License)
        .order_by(License.activated_at.desc())
        .limit(6).all()
    )
    recent_audit = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(8).all()
    )

    return templates.TemplateResponse(
        request, "dashboard.html",
        {
            **_ctx(request, db),
            "active_page": "dashboard",
            "total_projects": total_projects,
            "total_customers": total_customers,
            "pending_tokens": pending_tokens,
            "active_licenses": active_licenses,
            "total_devices": total_devices,
            "recent_tokens": recent_tokens,
            "recent_licenses": recent_licenses,
            "recent_audit": recent_audit,
        },
    )


# Projects

@router.get("/projects")
async def projects_list(
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return templates.TemplateResponse(
        request, "projects.html",
        {**_ctx(request, db), "active_page": "projects",
         "projects": projects, "success": success, "error": error},
    )


@router.post("/projects/create")
async def project_create(
    request: Request,
    name: str = Form(...),
    slug: str = Form(...),
    description: str = Form(""),
    deep_link_scheme: str = Form(...),
    type: str = Form(""),
    status: str = Form("Development"),
    version: str = Form(""),
    import_private_key: str = Form(""),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir

    slug = slug.strip().lower().replace(" ", "-")
    if db.query(Project).filter(Project.slug == slug).first():
        return RedirectResponse(f"/admin/projects?error=Slug+%22{slug}%22+already+exists", status_code=302)

    if not settings.ENCRYPTION_KEY:
        return RedirectResponse("/admin/projects?error=ENCRYPTION_KEY+not+set+in+.env", status_code=302)

    try:
        if import_private_key.strip():
            private_b64 = import_private_key.strip()
            public_b64 = derive_public_key(private_b64)
        else:
            public_b64, private_b64 = generate_key_pair()
        private_enc = encrypt_private_key(private_b64)
    except Exception as e:
        return RedirectResponse(f"/admin/projects?error=Key+error:+{str(e)[:60]}", status_code=302)

    project = Project(
        name=name.strip(),
        slug=slug,
        description=description.strip(),
        deep_link_scheme=deep_link_scheme.strip(),
        public_key_b64=public_b64,
        private_key_enc=private_enc,
        type=type.strip() or None,
        status=status.strip() or "Development",
        version=version.strip() or None,
    )
    db.add(project)
    db.flush()
    _log(db, request, user, "create_project", "project", project.id, project.name)
    db.commit()
    return RedirectResponse(f"/admin/projects/{project.id}?success=Project+created", status_code=302)


@router.get("/projects/{project_id}")
async def project_detail(
    project_id: int,
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return RedirectResponse("/admin/projects?error=Project+not+found", status_code=302)
    tokens = (
        db.query(ActivationToken)
        .filter(ActivationToken.project_id == project_id)
        .order_by(ActivationToken.created_at.desc())
        .limit(20).all()
    )
    return templates.TemplateResponse(
        request, "project_detail.html",
        {**_ctx(request, db), "active_page": "projects",
         "project": project, "tokens": tokens,
         "success": success, "error": error},
    )


@router.post("/projects/{project_id}/update")
async def project_update(
    project_id: int,
    request: Request,
    name: str = Form(...),
    description: str = Form(""),
    type: str = Form(""),
    status: str = Form(""),
    version: str = Form(""),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return RedirectResponse("/admin/projects?error=Project+not+found", status_code=302)
    project.name = name.strip()
    project.description = description.strip()
    project.type = type.strip() or None
    project.status = status.strip() or project.status
    project.version = version.strip() or None
    _log(db, request, user, "update_project", "project", project_id, project.name)
    db.commit()
    return RedirectResponse(f"/admin/projects/{project_id}?success=Project+updated", status_code=302)


@router.post("/projects/{project_id}/reimport-key")
async def project_reimport_key(
    project_id: int,
    request: Request,
    private_key: str = Form(...),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return RedirectResponse("/admin/projects?error=Project+not+found", status_code=302)
    try:
        public_b64 = derive_public_key(private_key.strip())
        project.public_key_b64 = public_b64
        project.private_key_enc = encrypt_private_key(private_key.strip())
        _log(db, request, user, "reimport_key", "project", project_id, project.name)
        db.commit()
    except Exception as e:
        return RedirectResponse(
            f"/admin/projects/{project_id}?error=Key+import+failed:+{str(e)[:60]}", status_code=302
        )
    return RedirectResponse(f"/admin/projects/{project_id}?success=Key+pair+updated", status_code=302)


@router.post("/projects/{project_id}/delete")
async def project_delete(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        try:
            _log(db, request, user, "delete_project", "project", project_id, project.name)
            db.delete(project)
            db.commit()
        except IntegrityError:
            db.rollback()
            return RedirectResponse(
                f"/admin/projects/{project_id}?error=Cannot+delete:+project+has+existing+tokens+or+licenses",
                status_code=302,
            )
    return RedirectResponse("/admin/projects?success=Project+deleted", status_code=302)


# Customers

@router.get("/customers")
async def customers_list(
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    customers = db.query(Customer).order_by(Customer.created_at.desc()).all()
    return templates.TemplateResponse(
        request, "customers.html",
        {**_ctx(request, db), "active_page": "customers",
         "customers": customers, "success": success, "error": error},
    )


@router.post("/customers/create")
async def customer_create(
    request: Request,
    name: str = Form(...),
    company_name: str = Form(""),
    email: str = Form(""),
    phone: str = Form(""),
    country: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    customer = Customer(
        name=name.strip(),
        company_name=company_name.strip() or None,
        email=email.strip() or None,
        phone=phone.strip() or None,
        country=country.strip() or None,
        notes=notes.strip() or None,
        status="active",
    )
    db.add(customer)
    db.flush()
    _log(db, request, user, "create_customer", "customer", customer.id, customer.name)
    db.commit()
    return RedirectResponse("/admin/customers?success=Customer+added", status_code=302)


@router.post("/customers/{customer_id}/update")
async def customer_update(
    customer_id: int,
    request: Request,
    name: str = Form(...),
    company_name: str = Form(""),
    email: str = Form(""),
    phone: str = Form(""),
    country: str = Form(""),
    notes: str = Form(""),
    status: str = Form("active"),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return RedirectResponse("/admin/customers?error=Customer+not+found", status_code=302)
    customer.name = name.strip()
    customer.company_name = company_name.strip() or None
    customer.email = email.strip() or None
    customer.phone = phone.strip() or None
    customer.country = country.strip() or None
    customer.notes = notes.strip() or None
    customer.status = status.strip()
    _log(db, request, user, "update_customer", "customer", customer_id, customer.name)
    db.commit()
    return RedirectResponse(f"/admin/customers?success=Customer+updated", status_code=302)


@router.post("/customers/{customer_id}/delete")
async def customer_delete(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if customer:
        try:
            _log(db, request, user, "delete_customer", "customer", customer_id, customer.name)
            db.delete(customer)
            db.commit()
        except IntegrityError:
            db.rollback()
            return RedirectResponse(
                "/admin/customers?error=Cannot+delete:+customer+has+existing+tokens+or+licenses",
                status_code=302,
            )
    return RedirectResponse("/admin/customers?success=Customer+deleted", status_code=302)


# Tokens

@router.get("/tokens")
async def tokens_list(
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    tokens = db.query(ActivationToken).order_by(ActivationToken.created_at.desc()).all()
    projects = db.query(Project).order_by(Project.name).all()
    customers = db.query(Customer).order_by(Customer.name).all()
    return templates.TemplateResponse(
        request, "tokens.html",
        {**_ctx(request, db), "active_page": "tokens",
         "tokens": tokens, "projects": projects, "customers": customers,
         "success": success, "error": error,
         "base_url": settings.BASE_URL},
    )


@router.post("/tokens/create")
async def token_create(
    request: Request,
    project_id: int = Form(...),
    customer_id: int = Form(...),
    license_number: str = Form(...),
    license_type: str = Form("lifetime"),
    expires_days: str = Form(""),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir

    project = db.query(Project).filter(Project.id == project_id).first()
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not project or not customer:
        return RedirectResponse("/admin/tokens?error=Invalid+project+or+customer", status_code=302)

    expires_at = None
    if expires_days.strip():
        try:
            expires_at = datetime.utcnow() + timedelta(days=int(expires_days))
        except ValueError:
            return RedirectResponse(
                "/admin/tokens?error=Link+expiry+must+be+a+whole+number+of+days", status_code=302
            )

    token_value = secrets.token_urlsafe(32)
    token = ActivationToken(
        token=token_value,
        project_id=project_id,
        customer_id=customer_id,
        license_number=license_number.strip(),
        license_type=license_type.strip(),
        expires_at=expires_at,
    )
    db.add(token)
    db.flush()
    _log(db, request, user, "create_token", "token", token.id, license_number,
         {"project": project.name, "customer": customer.name})
    db.commit()
    return RedirectResponse(f"/admin/tokens/{token.id}", status_code=302)


@router.get("/tokens/{token_id}")
async def token_detail(
    token_id: int,
    request: Request,
    success: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    token = db.query(ActivationToken).filter(ActivationToken.id == token_id).first()
    if not token:
        return RedirectResponse("/admin/tokens?error=Token+not+found", status_code=302)
    activation_url = f"{settings.BASE_URL}/activate?token={token.token}"
    return templates.TemplateResponse(
        request, "token_detail.html",
        {**_ctx(request, db), "active_page": "tokens",
         "token": token, "activation_url": activation_url, "success": success},
    )


@router.post("/tokens/{token_id}/revoke")
async def token_revoke(
    token_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    token = db.query(ActivationToken).filter(ActivationToken.id == token_id).first()
    if not token:
        return RedirectResponse("/admin/tokens?error=Token+not+found", status_code=302)
    if token.status != "pending":
        return RedirectResponse(
            f"/admin/tokens/{token_id}?error=Only+pending+tokens+can+be+revoked", status_code=302
        )
    token.status = "revoked"
    _log(db, request, user, "revoke_token", "token", token_id, token.license_number)
    db.commit()
    return RedirectResponse(f"/admin/tokens/{token_id}?success=Token+revoked", status_code=302)


# Licenses

@router.get("/licenses")
async def licenses_list(
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    licenses = db.query(License).order_by(License.activated_at.desc()).all()
    return templates.TemplateResponse(
        request, "licenses.html",
        {**_ctx(request, db), "active_page": "licenses",
         "licenses": licenses, "success": success, "error": error},
    )


@router.post("/licenses/{license_id}/deactivate")
async def license_deactivate(
    license_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    lic = db.query(License).filter(License.id == license_id).first()
    if not lic:
        return RedirectResponse("/admin/licenses?error=License+not+found", status_code=302)
    if not lic.is_active:
        return RedirectResponse("/admin/licenses?error=License+is+already+inactive", status_code=302)
    lic.is_active = False
    lic.deactivated_at = datetime.utcnow()
    _log(db, request, user, "deactivate_license", "license", license_id, lic.license_number)
    db.commit()
    return RedirectResponse("/admin/licenses?success=License+deactivated", status_code=302)


# Devices

@router.get("/devices")
async def devices_list(
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    devices = db.query(Device).order_by(Device.created_at.desc()).all()
    return templates.TemplateResponse(
        request, "devices.html",
        {**_ctx(request, db), "active_page": "devices",
         "devices": devices, "success": success, "error": error},
    )


@router.post("/devices/{device_id}/block")
async def device_block(
    device_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return RedirectResponse("/admin/devices?error=Device+not+found", status_code=302)
    if device.status == "blocked":
        return RedirectResponse("/admin/devices?error=Device+is+already+blocked", status_code=302)
    device.status = "blocked"
    device.blocked_at = datetime.utcnow()
    _log(db, request, user, "block_device", "device", device_id, device.hostname or device.fingerprint)
    db.commit()
    return RedirectResponse("/admin/devices?success=Device+blocked", status_code=302)


@router.post("/devices/{device_id}/unblock")
async def device_unblock(
    device_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_ADMIN)
    if redir:
        return redir
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return RedirectResponse("/admin/devices?error=Device+not+found", status_code=302)
    if device.status != "blocked":
        return RedirectResponse("/admin/devices?error=Device+is+not+blocked", status_code=302)
    device.status = "online"
    device.blocked_at = None
    _log(db, request, user, "unblock_device", "device", device_id, device.hostname or device.fingerprint)
    db.commit()
    return RedirectResponse("/admin/devices?success=Device+unblocked", status_code=302)


# Audit Logs

@router.get("/audit-logs")
async def audit_logs_list(
    request: Request,
    q: str = "",
    resource: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
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
    return templates.TemplateResponse(
        request, "audit_logs.html",
        {**_ctx(request, db), "active_page": "audit_logs",
         "logs": logs, "q": q, "resource": resource},
    )


# Users

@router.get("/users")
async def users_list(
    request: Request,
    success: str = "",
    error: str = "",
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db)
    if redir:
        return redir
    users = db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()
    return templates.TemplateResponse(
        request, "users.html",
        {**_ctx(request, db), "active_page": "users",
         "users": users, "success": success, "error": error},
    )


@router.post("/users/create")
async def user_create(
    request: Request,
    username: str = Form(...),
    email: str = Form(""),
    password: str = Form(...),
    role: str = Form("ADMIN"),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_SUPER_OWNER_ONLY)
    if redir:
        return redir
    if role.strip() not in ROLES_ADMIN:
        return RedirectResponse("/admin/users?error=Invalid+role", status_code=302)
    if db.query(AdminUser).filter(AdminUser.username == username.strip()).first():
        return RedirectResponse("/admin/users?error=Username+already+exists", status_code=302)
    new_user = AdminUser(
        username=username.strip(),
        email=email.strip() or None,
        password_hash=hash_password(password),
        role=role.strip(),
        status="active",
    )
    db.add(new_user)
    db.flush()
    _log(db, request, user, "create_user", "user", new_user.id, new_user.username, {"role": role})
    db.commit()
    return RedirectResponse("/admin/users?success=User+created", status_code=302)


@router.post("/users/{user_id}/update-role")
async def user_update_role(
    user_id: int,
    request: Request,
    role: str = Form(...),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_SUPER_OWNER_ONLY)
    if redir:
        return redir
    if role.strip() not in ROLES_ADMIN:
        return RedirectResponse("/admin/users?error=Invalid+role", status_code=302)
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not target:
        return RedirectResponse("/admin/users?error=User+not+found", status_code=302)
    if target.role == "SUPER_OWNER" and role != "SUPER_OWNER":
        return RedirectResponse("/admin/users?error=SUPER_OWNER+cannot+be+demoted", status_code=302)
    target.role = role
    _log(db, request, user, "update_user_role", "user", user_id, target.username, {"new_role": role})
    db.commit()
    return RedirectResponse("/admin/users?success=Role+updated", status_code=302)


@router.post("/users/{user_id}/toggle-status")
async def user_toggle_status(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_SUPER_OWNER_ONLY)
    if redir:
        return redir
    if user_id == user.id:
        return RedirectResponse("/admin/users?error=Cannot+change+your+own+status", status_code=302)
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if target:
        target.status = "suspended" if target.status == "active" else "active"
        _log(db, request, user, "toggle_user_status", "user", user_id, target.username,
             {"new_status": target.status})
        db.commit()
    return RedirectResponse("/admin/users?success=User+status+updated", status_code=302)


@router.post("/users/{user_id}/reset-password")
async def user_reset_password(
    user_id: int,
    request: Request,
    new_password: str = Form(...),
    db: Session = Depends(get_db),
):
    user, redir = _guard(request, db, ROLES_SUPER_OWNER_ONLY)
    if redir:
        return redir
    target = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if target:
        target.password_hash = hash_password(new_password)
        _log(db, request, user, "reset_password", "user", user_id, target.username)
        db.commit()
    return RedirectResponse("/admin/users?success=Password+reset", status_code=302)
