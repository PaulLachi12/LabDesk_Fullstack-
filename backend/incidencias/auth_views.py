from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import user_role


def account_data(user):
    return {
        'username': user.get_username(),
        'name': user.get_full_name().strip() or user.get_username(),
        'role': user_role(user),
    }


class CsrfTokenView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({'detail': 'Cookie CSRF preparada.'})


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        if not isinstance(request.data, dict):
            return Response(
                {'detail': 'Indica tu usuario y contraseña.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = request.data.get('username', '')
        password = request.data.get('password', '')
        if not isinstance(username, str) or not isinstance(password, str):
            return Response(
                {'detail': 'Indica tu usuario y contraseña.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(
            request=request._request,
            username=username.strip(),
            password=password,
        )
        if user is None:
            return Response(
                {'detail': 'Usuario o contraseña incorrectos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request._request, user)
        return Response(account_data(user))


class CurrentUserView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(account_data(request.user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request._request)
        return Response(status=status.HTTP_204_NO_CONTENT)
