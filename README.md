# VLab Experiment — Serving Static Files in Django

A Virtual Labs style experiment (Aim / Theory / Procedure / Pretest / Simulation /
Posttest / References / Contributors / Feedback) that teaches how Django serves
static files (CSS, JS, images).

Reference layout: https://cn-iiith.vlabs.ac.in/exp/csma-cd/index.html

## Quick start

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
# open http://127.0.0.1:8000/
```

## How static files work here

- `settings.py`: `STATIC_URL = '/static/'`, `STATICFILES_DIRS = [BASE_DIR / 'static']`,
  `STATIC_ROOT = BASE_DIR / 'staticfiles'` (+ `django.contrib.staticfiles` in INSTALLED_APPS).
- Templates: every template using statics starts with `{% load static %}` then
  `{% static 'css/style.css' %}` → renders `/static/css/style.css`.
- Dev: `runserver` with `DEBUG=True` auto-serves from `STATICFILES_DIRS` — do NOT add
  `static(STATIC_URL, document_root=STATIC_ROOT)` to `urls.py` (that helper is for MEDIA).
- Prod: `python manage.py collectstatic` collects into `STATIC_ROOT`, served by Nginx/WhiteNoise.

## Verify (expect HTTP 200, no 404s)

1. Open DevTools → Network, load `/`, `/simulation/`.
2. Check `/static/css/bootstrap.min.css`, `/static/js/simulation.js`,
   `/static/images/logo.png` all return 200.
3. Simulation → Step 1 + Step 2 → Verify Output → "Static Files Served (200)".
