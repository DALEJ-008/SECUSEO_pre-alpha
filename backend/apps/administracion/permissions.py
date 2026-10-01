"""Permisos del dominio de administración."""
from rest_framework.permissions import BasePermission


class EsModerador(BasePermission):
    """Administradores y moderadores (gestión de reportes)."""

    message = "No tienes permisos para esta acción."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.puede_moderar)


class EsAdministrador(BasePermission):
    """Solo administradores (usuarios y comunicados)."""

    message = "No tienes permisos para esta acción."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.es_admin)
