from .models import Notificacion


def notificar(usuario, titulo, cuerpo):
    return Notificacion.objects.create(usuario=usuario, titulo=titulo[:120], cuerpo=cuerpo)
