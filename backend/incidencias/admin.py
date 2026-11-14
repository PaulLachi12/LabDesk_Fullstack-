from django.contrib import admin
from .models import ActividadIncidencia, Comentario, Incidencia


class ActividadIncidenciaInline(admin.TabularInline):
    model = ActividadIncidencia
    extra = 0
    readonly_fields = ('tipo', 'autor', 'detalle', 'creado_en')


class ComentarioInline(admin.TabularInline):
    model = Comentario
    extra = 0
    readonly_fields = ('autor', 'detalle', 'creado_en')


@admin.register(Incidencia)
class IncidenciaAdmin(admin.ModelAdmin):
    list_display = (
        'titulo', 'categoria', 'prioridad', 'estado',
        'responsable', 'ubicacion', 'fecha_limite', 'creado_en',
    )
    list_filter = ('categoria', 'prioridad', 'estado')
    search_fields = ('titulo', 'descripcion', 'responsable', 'ubicacion')
    inlines = (ActividadIncidenciaInline, ComentarioInline)
