from django.db import models
from django.conf import settings

class Incidencia(models.Model):
    CATEGORIAS = [
        ('hardware', 'Hardware'),
        ('software', 'Software'),
        ('red', 'Red / Internet'),
    ]
    PRIORIDADES = [
        ('baja', 'Baja'),
        ('media', 'Media'),
        ('alta', 'Alta'),
    ]
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('en_proceso', 'En proceso'),
        ('resuelto', 'Resuelto'),
    ]

    titulo = models.CharField(max_length=120)
    descripcion = models.TextField()
    categoria = models.CharField(
        max_length=20, choices=CATEGORIAS, default='hardware'
    )
    prioridad = models.CharField(
        max_length=10, choices=PRIORIDADES, default='media'
    )
    estado = models.CharField(
        max_length=20, choices=ESTADOS, default='pendiente'
    )
    responsable = models.CharField(max_length=80, blank=True)
    aula_equipo = models.CharField(max_length=100, blank=True)
    fecha_limite = models.DateField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    creador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='incidencias_creadas',
    )

    def __str__(self):
        return self.titulo


class ActividadIncidencia(models.Model):
    TIPOS = [
        ('comentario', 'Comentario'),
        ('creacion', 'Creación'),
        ('actualizacion', 'Actualización'),
        ('estado', 'Cambio de estado'),
    ]

    incidencia = models.ForeignKey(
        Incidencia,
        on_delete=models.CASCADE,
        related_name='actividades',
    )
    tipo = models.CharField(max_length=20, choices=TIPOS)
    autor = models.CharField(max_length=80, default='Sistema')
    detalle = models.TextField()
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creado_en', '-id']

    def __str__(self):
        return f'{self.get_tipo_display()}: {self.incidencia}'
