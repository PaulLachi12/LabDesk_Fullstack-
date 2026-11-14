from rest_framework import serializers
from .models import ActividadIncidencia, Incidencia

class IncidenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incidencia
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'creador']

    def validate_titulo(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El título no puede estar vacío.')
        return value

    def validate_descripcion(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('La descripción no puede estar vacía.')
        return value


class ActividadIncidenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActividadIncidencia
        fields = ['id', 'tipo', 'autor', 'detalle', 'creado_en']
        read_only_fields = ['id', 'tipo', 'creado_en']


class ComentarioIncidenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActividadIncidencia
        fields = ['detalle']

    def validate_detalle(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('El comentario no puede estar vacío.')
        return value
