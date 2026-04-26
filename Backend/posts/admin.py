from django.contrib import admin

from .models import Post, PostRequest

admin.site.register(Post)
admin.site.register(PostRequest)
