import sys
import os
import json
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vlab_project.settings')
django.setup()

from django.test import Client
from django.contrib.staticfiles import finders

def run_tests():
    c = Client()
    routes = [
        '/',
        '/theory/',
        '/procedure/',
        '/pretest/',
        '/simulation/',
        '/posttest/',
        '/references/',
        '/contributors/',
        '/feedback/',
    ]
    print("Testing all 9 page endpoints...")
    for r in routes:
        resp = c.get(r)
        assert resp.status_code == 200, f"Route {r} returned {resp.status_code}"
        print(f"  [OK] {r} -> HTTP 200")

    print("\nTesting /api/simulate/ scenarios...")
    # Scenario 1: Standard dev working
    p1 = {
        'config': {
            'static_url': '/static/',
            'staticfiles_dirs': ['static'],
            'static_root': 'staticfiles',
            'debug': True,
            'staticfiles_app': True,
            'collectstatic_run': False,
            'load_static': True,
            'use_static_tag': True,
        },
        'assets': ['css/style.css', 'js/app.js', 'images/logo.png']
    }
    r1 = c.post('/api/simulate/', data=json.dumps(p1), content_type='application/json')
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1['summary']['ok'] == 3
    print("  [OK] Working Dev Scenario: 3/3 passed")

    # Scenario 2: Missing load static (500)
    p2 = dict(p1)
    p2['config'] = dict(p1['config'], load_static=False)
    r2 = c.post('/api/simulate/', data=json.dumps(p2), content_type='application/json')
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2['results'][0]['status'] == 500
    assert d2['results'][0]['failed_stage'] == 1
    print("  [OK] Missing {% load static %} Scenario: Status 500 caught at Stage 1")

    # Scenario 3: Hardcoded path (no static tag -> 404 at Stage 2)
    p3 = dict(p1)
    p3['config'] = dict(p1['config'], use_static_tag=False)
    r3 = c.post('/api/simulate/', data=json.dumps(p3), content_type='application/json')
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3['results'][0]['status'] == 404
    assert d3['results'][0]['failed_stage'] == 2
    print("  [OK] Hardcoded Path Scenario: Status 404 caught at Stage 2 (Prefix Mismatch)")

    # Scenario 4: Prod without collectstatic
    p4 = dict(p1)
    p4['config'] = dict(p1['config'], debug=False, collectstatic_run=False)
    r4 = c.post('/api/simulate/', data=json.dumps(p4), content_type='application/json')
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4['results'][0]['status'] == 404
    assert d4['results'][0]['failed_stage'] == 4
    print("  [OK] Production without collectstatic: Status 404 caught at Stage 4")

    # Scenario 5: Prod with collectstatic
    p5 = dict(p1)
    p5['config'] = dict(p1['config'], debug=False, collectstatic_run=True, static_root='staticfiles')
    r5 = c.post('/api/simulate/', data=json.dumps(p5), content_type='application/json')
    assert r5.status_code == 200
    d5 = r5.json()
    assert d5['summary']['ok'] == 3
    print("  [OK] Production Ready Scenario: 3/3 passed from STATIC_ROOT")

    print("\nTesting /api/real-check/ endpoint...")
    rc_logo = c.get('/api/real-check/?path=images/logo.png')
    assert rc_logo.status_code == 200
    data_logo = rc_logo.json()
    assert data_logo['found'] == True
    print(f"  [OK] images/logo.png found on disk at: {data_logo['location']}")

    rc_style = c.get('/api/real-check/?path=css/vlab-style.css')
    assert rc_style.status_code == 200
    assert rc_style.json()['found'] == True
    print("  [OK] css/vlab-style.css found on disk")

    print("\nTesting Static Finders for all critical assets...")
    statics = [
        'images/logo.png',
        'images/favicon.ico',
        'css/bootstrap.min.css',
        'css/github-markdown.min.css',
        'css/vlab-style.css',
        'css/interactive.css',
        'css/simulation.css',
        'js/simulation.js',
        'js/quiz.js',
    ]
    for s in statics:
        loc = finders.find(s)
        assert loc is not None, f"Static finder missed: {s}"
        print(f"  [OK] Static asset resolved: {s}")

    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
