from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/", include("receipts.urls")),
    path("api/", include("posts.urls")),
    path("api/auth/", include("users.urls")),
    path("api/users/", include("users.profile_urls")),
    path("api/households/", include("households.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
