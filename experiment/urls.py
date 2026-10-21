from django.urls import path
from . import views
urlpatterns = [
    path('', views.aim, name='aim'),
    path('theory/', views.theory, name='theory'),
    path('procedure/', views.procedure, name='procedure'),
    path('pretest/', views.pretest, name='pretest'),
    path('simulation/', views.simulation, name='simulation'),
    path('api/simulate/', views.api_simulate, name='api_simulate'),
    path('api/real-check/', views.api_real_check, name='api_real_check'),
    path('posttest/', views.posttest, name='posttest'),
    path('references/', views.references, name='references'),
    path('contributors/', views.contributors, name='contributors'),
    path('feedback/', views.feedback, name='feedback'),
]