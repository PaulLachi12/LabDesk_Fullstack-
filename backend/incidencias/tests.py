from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import ActividadIncidencia, Comentario, Incidencia


class IncidenciaApiTests(APITestCase):
    def setUp(self):
        self.support = get_user_model().objects.create_user(
            username='soporte',
            password='clave-segura-123',
        )
        self.support.groups.add(Group.objects.get(name='LabDesk soporte'))
        self.client.force_authenticate(self.support)
        self.incidencia = Incidencia.objects.create(
            titulo='PC no enciende',
            descripcion='No enciende al presionar el botón.',
            categoria='hardware',
            prioridad='alta',
            estado='pendiente',
        )
        self.url = f'/api/incidencias/{self.incidencia.id}/'

    def test_list_keeps_the_existing_array_response(self):
        response = self.client.get('/api/incidencias/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(response.data[0]['titulo'], 'PC no enciende')

    def test_create_saves_the_authenticated_creator_and_due_date(self):
        response = self.client.post(
            '/api/incidencias/',
            {
                'titulo': 'Wi-Fi lento',
                'descripcion': 'La conexión se interrumpe.',
                'categoria': 'red',
                'prioridad': 'media',
                'estado': 'pendiente',
                'responsable': 'Ana',
                'ubicacion': 'Aula 2',
                'fecha_limite': '2026-11-20',
                'creador': 9999,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['responsable'], 'Ana')
        self.assertEqual(response.data['ubicacion'], 'Aula 2')
        self.assertEqual(response.data['fecha_limite'], '2026-11-20')
        self.assertEqual(response.data['creador'], self.support.pk)
        self.assertTrue(
            ActividadIncidencia.objects.filter(
                incidencia_id=response.data['id'],
                tipo='creacion',
                autor='soporte',
            ).exists()
        )

    def test_blank_title_returns_a_field_validation_error(self):
        response = self.client.patch(
            self.url,
            {'titulo': '   '},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('titulo', response.data)

    def test_state_change_uses_authenticated_user_for_history(self):
        response = self.client.patch(
            self.url,
            {'estado': 'resuelto'},
            format='json',
            HTTP_X_ACTOR='Administrador falsificado',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        actividad = ActividadIncidencia.objects.get(incidencia=self.incidencia)
        self.assertEqual(actividad.tipo, 'estado')
        self.assertEqual(actividad.autor, 'soporte')
        self.assertIn('estado', actividad.detalle)

    def test_follow_up_comment_is_returned_in_activity_history(self):
        response = self.client.post(
            f'{self.url}comentarios/',
            {'detalle': 'Se revisó el cableado.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tipo'], 'comentario')
        self.assertEqual(response.data['autor'], 'soporte')
        self.assertTrue(
            Comentario.objects.filter(
                incidencia=self.incidencia,
                autor='soporte',
                detalle='Se revisó el cableado.',
            ).exists()
        )

        history = self.client.get(f'{self.url}actividades/')
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history.data), 1)
        comments = self.client.get(f'{self.url}comentarios/')
        self.assertEqual(comments.status_code, status.HTTP_200_OK)
        self.assertEqual(comments.data[0]['detalle'], 'Se revisó el cableado.')

    def test_follow_up_comment_requires_a_detail(self):
        response = self.client.post(
            f'{self.url}comentarios/',
            {'detalle': ' '},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detalle', response.data)

    def test_anonymous_users_cannot_read_or_change_incidents(self):
        self.client.force_authenticate(user=None)

        listing = self.client.get('/api/incidencias/')
        update = self.client.patch(self.url, {'estado': 'resuelto'}, format='json')
        comment = self.client.post(
            f'{self.url}comentarios/',
            {'detalle': 'Comentario sin sesión.'},
            format='json',
        )

        self.assertEqual(listing.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(update.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(comment.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporter_only_sees_and_edits_owned_incidents(self):
        reporter = get_user_model().objects.create_user(
            username='solicitante',
            password='clave-segura-123',
        )
        own_issue = Incidencia.objects.create(
            titulo='Mi incidencia',
            descripcion='Equipo asignado a mi cuenta.',
            creador=reporter,
        )
        other_issue = Incidencia.objects.create(
            titulo='Incidencia ajena',
            descripcion='Equipo asignado a otra cuenta.',
            creador=self.support,
        )
        self.client.force_authenticate(reporter)

        listing = self.client.get('/api/incidencias/')
        own_update = self.client.patch(
            f'/api/incidencias/{own_issue.pk}/',
            {'estado': 'en_proceso'},
            format='json',
        )
        other_read = self.client.get(f'/api/incidencias/{other_issue.pk}/')
        other_update = self.client.patch(
            f'/api/incidencias/{other_issue.pk}/',
            {'estado': 'resuelto'},
            format='json',
        )
        own_comment = self.client.post(
            f'/api/incidencias/{own_issue.pk}/comentarios/',
            {'detalle': 'Sigo pendiente de la revisión.'},
            format='json',
        )
        other_comment = self.client.post(
            f'/api/incidencias/{other_issue.pk}/comentarios/',
            {'detalle': 'No debería acceder a este registro.'},
            format='json',
        )

        self.assertEqual([item['id'] for item in listing.data], [own_issue.pk])
        self.assertEqual(own_update.status_code, status.HTTP_200_OK)
        self.assertEqual(other_read.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(other_update.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(own_comment.status_code, status.HTTP_201_CREATED)
        self.assertEqual(other_comment.status_code, status.HTTP_404_NOT_FOUND)

    def test_support_can_edit_any_incident_but_cannot_delete(self):
        reporter = get_user_model().objects.create_user(
            username='ana',
            password='clave-segura-123',
        )
        issue = Incidencia.objects.create(
            titulo='Incidencia de Ana',
            descripcion='No es del equipo de soporte.',
            creador=reporter,
        )

        update = self.client.patch(
            f'/api/incidencias/{issue.pk}/',
            {'estado': 'en_proceso'},
            format='json',
        )
        delete = self.client.delete(f'/api/incidencias/{issue.pk}/')

        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_any_incident(self):
        administrator = get_user_model().objects.create_user(
            username='admin',
            password='clave-segura-123',
        )
        administrator.groups.add(Group.objects.get(name='LabDesk administradores'))
        self.client.force_authenticate(administrator)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_session_login_requires_csrf_and_exposes_the_user_role(self):
        account = get_user_model().objects.create_user(
            username='cuenta',
            password='clave-segura-123',
        )
        client = APIClient(enforce_csrf_checks=True)
        client.get('/api/auth/csrf/')

        missing_token = client.post(
            '/api/auth/login/',
            {'username': account.username, 'password': 'clave-segura-123'},
            format='json',
        )
        self.assertEqual(missing_token.status_code, status.HTTP_403_FORBIDDEN)

        csrf = client.cookies['csrftoken'].value
        login = client.post(
            '/api/auth/login/',
            {'username': account.username, 'password': 'clave-segura-123'},
            format='json',
            HTTP_X_CSRFTOKEN=csrf,
        )
        current_user = client.get('/api/auth/me/')

        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertEqual(login.data['role'], 'reporter')
        self.assertEqual(current_user.status_code, status.HTTP_200_OK)
        self.assertEqual(current_user.data['username'], account.username)

        client.get('/api/auth/csrf/')
        logout = client.post(
            '/api/auth/logout/',
            format='json',
            HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value,
        )
        after_logout = client.get('/api/auth/me/')

        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(after_logout.status_code, status.HTTP_204_NO_CONTENT)

    def test_login_rejects_non_object_json(self):
        account = get_user_model().objects.create_user(
            username='cuenta',
            password='clave-segura-123',
        )
        client = APIClient(enforce_csrf_checks=True)
        client.get('/api/auth/csrf/')

        response = client.post(
            '/api/auth/login/',
            [account.username, 'clave-segura-123'],
            format='json',
            HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_reporter_creation_assigns_ownership_from_the_session(self):
        reporter = get_user_model().objects.create_user(
            username='solicitante',
            password='clave-segura-123',
        )
        self.client.force_authenticate(reporter)

        response = self.client.post(
            '/api/incidencias/',
            {
                'titulo': 'Mi reporte',
                'descripcion': 'Descripción de mi incidencia.',
                'creador': self.support.pk,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['creador'], reporter.pk)
