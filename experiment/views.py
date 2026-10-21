from django.shortcuts import render

def aim(request):
    return render(request, 'experiment/aim.html')

def theory(request):
    return render(request, 'experiment/theory.html')

def procedure(request):
    return render(request, 'experiment/procedure.html')

def pretest(request):
    return render(request, 'experiment/pretest.html')

def posttest(request):
    return render(request, 'experiment/posttest.html')

def references(request):
    return render(request, 'experiment/references.html')

def contributors(request):
    return render(request, 'experiment/contributors.html')

def feedback(request):
    return render(request, 'experiment/feedback.html')


# ---------------------------------------------------------------------------
# Simulation (interactive static-file resolver)
# ---------------------------------------------------------------------------
import json
from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import JsonResponse
from django.templatetags.static import static as static_url
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from . import simulator

# The learner's *simulated* project. These files are demo data, NOT read from
# disk. Folder "static/" is the one the default configuration points to;
# "assets/" lets the learner see what happens when STATICFILES_DIRS is wrong.
SIMULATED_FILES = {
    "static/css/style.css",
    "static/js/app.js",
    "static/images/logo.png",
    "static/images/favicon.ico",
    "assets/css/theme.css",
}


@ensure_csrf_cookie
def simulation(request):
    return render(request, 'experiment/simulation.html', {
        'default_config': simulator.DEFAULT_CONFIG,
        'default_assets': simulator.DEFAULT_ASSETS,
        'sim_files': sorted(SIMULATED_FILES),
    })


@require_POST
def api_simulate(request):
    """Run the simulator with the configuration sent by the browser."""
    try:
        body = json.loads(request.body or b'{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Request body is not valid JSON.'}, status=400)
    if not isinstance(body, dict):
        return JsonResponse({'error': 'Request body must be a JSON object.'}, status=400)
    try:
        data = simulator.simulate(body.get('config', {}), SIMULATED_FILES, body.get('assets'))
    except simulator.ConfigError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    return JsonResponse(data)


def api_real_check(request):
    """
    Ask THIS running Django project (real data, not simulated) how it
    resolves a static file, using django.contrib.staticfiles.finders.
    """
    path = (request.GET.get('path') or 'css/vlab-style.css').strip().lstrip('/')
    if not path or '..' in path.split('/') or len(path) > 200:
        return JsonResponse({'error': 'Invalid path.'}, status=400)
    found = finders.find(path)
    return JsonResponse({
        'path': path,
        'url': static_url(path),
        'found': bool(found),
        'location': str(found) if found else None,
        'STATIC_URL': settings.STATIC_URL,
        'STATICFILES_DIRS': [str(d) for d in settings.STATICFILES_DIRS],
        'DEBUG': settings.DEBUG,
    })