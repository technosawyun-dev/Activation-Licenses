from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey
)
from sqlalchemy.orm import relationship
from .database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="ADMIN")
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    deep_link_scheme = Column(String(100), nullable=False)
    public_key_b64 = Column(Text, nullable=False)
    private_key_enc = Column(Text, nullable=False)
    type = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True, default="Development")
    version = Column(String(50), nullable=True)
    repository_url = Column(String(500), nullable=True)
    owner = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tokens = relationship("ActivationToken", back_populates="project")
    licenses = relationship("License", back_populates="project")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    email = Column(String(255))
    phone = Column(String(50))
    country = Column(String(100), nullable=True)
    notes = Column(Text)
    status = Column(String(20), nullable=False, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    tokens = relationship("ActivationToken", back_populates="customer")
    devices = relationship("Device", back_populates="customer")


class ActivationToken(Base):
    __tablename__ = "activation_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(128), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    license_number = Column(String(100), nullable=False)
    license_type = Column(String(50), default="lifetime")
    status = Column(String(20), default="pending", nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="tokens")
    customer = relationship("Customer", back_populates="tokens")
    license = relationship("License", back_populates="token", uselist=False)


class License(Base):
    __tablename__ = "licenses"

    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(Integer, ForeignKey("activation_tokens.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    license_number = Column(String(100), nullable=False)
    computer_id = Column(String(100), nullable=False)
    activated_at = Column(DateTime, default=datetime.utcnow)
    deactivated_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    certificate_json = Column(Text)

    token = relationship("ActivationToken", back_populates="license")
    project = relationship("Project", back_populates="licenses")
    customer = relationship("Customer")
    device = relationship("Device", back_populates="license", uselist=False)


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    hostname = Column(String(255), nullable=True)
    fingerprint = Column(String(255), nullable=False, unique=True, index=True)
    os = Column(String(100), nullable=True)
    app_version = Column(String(50), nullable=True)
    last_seen = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="online")
    blocked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    license = relationship("License", back_populates="device")
    customer = relationship("Customer", back_populates="devices")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, nullable=True)
    actor_name = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    resource_name = Column(String(255), nullable=True)
    extra_data = Column("metadata", Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
