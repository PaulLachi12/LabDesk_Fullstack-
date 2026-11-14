from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ActividadIncidencia, Comentario, Incidencia
from .permissions import IncidenciaPermission, user_role
from .serializers import (
    ActividadIncidenciaSerializer,
    ComentarioIncidenciaSerializer,
    IncidenciaSerializer,
)

class IncidenciaViewSet(viewsets.ModelViewSet):
    serializer_class = IncidenciaSerializer
    permission_classes = [IncidenciaPermission]

    def get_queryset(self):
        queryset = Incidencia.objects.select_related('creador').order_by('-creado_en')
        if user_role(self.request.user) in {'admin', 'support'}:
            return queryset
        return queryset.filter(creador=self.request.user)

    def actor_name(self):
        return (
            self.request.user.get_full_name().strip()
            or self.request.user.get_username()
        )[:80]

    @action(detail=True, methods=['get'], url_path='actividades')
    def actividades(self, request, pk=None):
        incidencia = self.get_object()
        actividades = list(incidencia.actividades.all())
        comentarios = list(incidencia.comentarios.all())
        historial = sorted(
            [*actividades, *comentarios],
            key=lambda item: (item.creado_en, item.pk),
            reverse=True,
        )
        data = []

        for item in historial:
            if isinstance(item, ActividadIncidencia):
                serializer = ActividadIncidenciaSerializer(item)
            else:
                serializer = ComentarioIncidenciaSerializer(item)
            data.append(serializer.data)

        return Response(data)

    @action(detail=True, methods=['get', 'post'], url_path='comentarios')
    def comentarios(self, request, pk=None):
        incidencia = self.get_object()
        if request.method == 'GET':
            comentarios = incidencia.comentarios.all()
            serializer = ComentarioIncidenciaSerializer(comentarios, many=True)
            return Response(serializer.data)

        serializer = ComentarioIncidenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comentario = serializer.save(
            incidencia=incidencia,
            autor=self.actor_name(),
        )
        return Response(
            ComentarioIncidenciaSerializer(comentario).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        incidencia = serializer.save(creador=self.request.user)
        ActividadIncidencia.objects.create(
            incidencia=incidencia,
            tipo='creacion',
            autor=self.actor_name(),
            detalle='Incidencia registrada.',
        )

    def perform_update(self, serializer):
        incidencia = serializer.instance
        campos = {
            'titulo': ('título', incidencia.titulo),
            'descripcion': ('descripción', incidencia.descripcion),
            'categoria': ('categoría', incidencia.categoria),
            'prioridad': ('prioridad', incidencia.prioridad),
            'estado': ('estado', incidencia.estado),
            'responsable': ('responsable', incidencia.responsable),
            'ubicacion': ('ubicación', incidencia.ubicacion),
            'fecha_limite': ('fecha límite', incidencia.fecha_limite),
        }
        cambios = [
            etiqueta
            for campo, (etiqueta, anterior) in campos.items()
            if campo in serializer.validated_data
            and serializer.validated_data[campo] != anterior
        ]
        serializer.save()

        if cambios:
            ActividadIncidencia.objects.create(
                incidencia=incidencia,
                tipo='estado' if cambios == ['estado'] else 'actualizacion',
                autor=self.actor_name(),
                detalle='Se actualizó: ' + ', '.join(cambios) + '.',
            )
