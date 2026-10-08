from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('experiment.urls')),
]
# NOTE: In DEBUG=True, runserver + django.contrib.staticfiles already serves
# files from STATICFILES_DIRS. Do NOT add static(STATIC_URL, document_root=STATIC_ROOT)
# here — that helper is for MEDIA_URL in development.
