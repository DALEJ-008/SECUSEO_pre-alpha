from rest_framework.views import exception_handler


def manejador_excepciones_api(exc, context):
    """Normaliza errores de DRF con un mensaje y detalles por campo."""
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict):
        if set(data) == {"detail"}:
            mensaje = str(data["detail"])
            detalle = {"general": data["detail"]}
        else:
            mensaje = "La solicitud contiene errores de validación."
            detalle = data
    else:
        mensaje = str(data)
        detalle = {"general": data}

    response.data = {"mensaje": mensaje, "detalle": detalle}
    return response