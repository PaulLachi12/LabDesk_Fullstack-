import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


ROLE_GROUP_NAMES = (
    'LabDesk administradores',
    'LabDesk soporte',
    'LabDesk solicitantes',
)


def create_role_groups(apps, schema_editor):
    group_model = apps.get_model('auth', 'Group')
    database = schema_editor.connection.alias
    for name in ROLE_GROUP_NAMES:
        group_model.objects.using(database).get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [
        ('incidencias', '0002_incidencia_aula_equipo_incidencia_fecha_limite_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='incidencia',
            name='creador',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='incidencias_creadas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(create_role_groups, migrations.RunPython.noop),
    ]
