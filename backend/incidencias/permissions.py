from rest_framework.permissions import SAFE_METHODS, BasePermission


ROLE_GROUPS = {
    'admin': 'LabDesk administradores',
    'support': 'LabDesk soporte',
    'reporter': 'LabDesk solicitantes',
}


def user_role(user):
    if user.is_superuser or user.groups.filter(name=ROLE_GROUPS['admin']).exists():
        return 'admin'
    if user.groups.filter(name=ROLE_GROUPS['support']).exists():
        return 'support'
    return 'reporter'


class IncidenciaPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        role = user_role(request.user)
        if role == 'admin':
            return True
        if role == 'support':
            return request.method != 'DELETE'
        if obj.creador_id != request.user.pk:
            return False
        return (
            request.method in SAFE_METHODS
            or request.method in {'PUT', 'PATCH'}
            or (request.method == 'POST' and view.action == 'actividades')
        )
