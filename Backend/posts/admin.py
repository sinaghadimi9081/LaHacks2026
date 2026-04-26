from django.contrib import admin

from .models import Post, PostRequest, PostRequestMessage

admin.site.register(Post)
admin.site.register(PostRequest)
admin.site.register(PostRequestMessage)
