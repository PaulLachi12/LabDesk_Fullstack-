from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from incidencias.auth_views import (
    CsrfTokenView,
    CurrentUserView,
    LoginView,
    LogoutView,
)
from incidencias.views import IncidenciaViewSet

router = DefaultRouter()
router.register(r'incidencias', IncidenciaViewSet, basename='incidencia')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/csrf/', CsrfTokenView.as_view(), name='csrf-token'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/me/', CurrentUserView.as_view(), name='current-user'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/', include(router.urls)),
]
