"""Modelos del dominio de usuarios."""
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def get_by_natural_key(self, email):
        return self.get(email__iexact=email)

    def _crear(self, email, password, **extra):
        if not email:
            raise ValueError("El correo electrónico es obligatorio.")
        usuario = self.model(email=self.normalize_email(email).lower(), **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._crear(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("rol", Usuario.Rol.ADMIN)
        extra.setdefault("telefono_verificado", True)
        return self._crear(email, password, **extra)


class Usuario(AbstractUser):
    """Usuario identificado por correo. `nombre` es el nombre visible en la app."""

    class Rol(models.TextChoices):
        USUARIO = "user", "Usuario"
        MODERADOR = "moderator", "Moderador"
        ADMIN = "admin", "Administrador"

    username = None
    email = models.EmailField("correo electrónico", unique=True)
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20, blank=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    foto = models.ImageField(upload_to="perfiles/", null=True, blank=True)
    rol = models.CharField(max_length=10, choices=Rol.choices, default=Rol.USUARIO)
    telefono_verificado = models.BooleanField(default=False)
    codigo_verificacion = models.CharField(max_length=6, blank=True)
    codigo_expira = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombre"]
    objects = UsuarioManager()

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self):
        return self.nombre or self.email

    @property
    def es_admin(self):
        return self.rol == self.Rol.ADMIN or self.is_superuser

    @property
    def puede_moderar(self):
        return self.es_admin or self.rol == self.Rol.MODERADOR
