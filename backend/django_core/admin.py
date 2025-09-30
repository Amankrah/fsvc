from django.contrib import admin
from django.conf import settings

# Customize admin site
admin.site.site_header = getattr(settings, 'ADMIN_SITE_HEADER', 'Research Data Collection Admin')
admin.site.site_title = getattr(settings, 'ADMIN_SITE_TITLE', 'Data Collection Admin Portal')
admin.site.index_title = getattr(settings, 'ADMIN_INDEX_TITLE', 'Welcome to Research Data Collection Administration')

# Register any additional admin configurations here if needed 