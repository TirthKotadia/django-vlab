"""
Static-file resolution simulator.

Models, step by step, what happens when a browser asks a Django project for
a static file such as /static/css/style.css. It does NOT import Django, so
it is easy to unit test and easy to explain: every function takes plain
dicts/lists and returns plain dicts.
"""

import posixpath

DEFAULT_CONFIG = {
    "static_url": "/static/",
    "staticfiles_dirs": ["static"],       # folders searched (relative to BASE_DIR)
    "static_root": "staticfiles",         # target of collectstatic ("" = not set)
    "debug": True,
    "staticfiles_app": True,              # 'django.contrib.staticfiles' installed
    "collectstatic_run": False,           # has the user run collectstatic?
    "load_static": True,                  # {% load static %} in the template
    "use_static_tag": True,               # {% static '...' %} instead of a raw path
}

# Asset paths that the simulated template references.
DEFAULT_ASSETS = ["css/style.css", "js/app.js", "images/logo.png"]

# Asset metadata for realistic networking & MIME type inspection
ASSET_METADATA = {
    "css/style.css": {
        "type": "stylesheet",
        "mime": "text/css; charset=utf-8",
        "size": "14.2 KB",
        "desc": "Main stylesheet (colors, typography, responsive grid)",
    },
    "css/theme.css": {
        "type": "stylesheet",
        "mime": "text/css; charset=utf-8",
        "size": "6.1 KB",
        "desc": "Secondary / alternate theme stylesheet",
    },
    "js/app.js": {
        "type": "script",
        "mime": "application/javascript; charset=utf-8",
        "size": "8.4 KB",
        "desc": "Interactive JavaScript client logic",
    },
    "images/logo.png": {
        "type": "image",
        "mime": "image/png",
        "size": "42.1 KB",
        "desc": "Somaiya college emblem / institute logo",
    },
    "images/favicon.ico": {
        "type": "image",
        "mime": "image/x-icon",
        "size": "1.2 KB",
        "desc": "Browser tab favicon",
    },
    "assets/css/theme.css": {
        "type": "stylesheet",
        "mime": "text/css; charset=utf-8",
        "size": "6.1 KB",
        "desc": "Theme stylesheet located in assets/ folder",
    },
}


class ConfigError(ValueError):
    """Raised when the user-supplied configuration is invalid."""


# --------------------------------------------------------------------------
# Input validation
# --------------------------------------------------------------------------
def _clean_path(value, field, allow_empty=False):
    if not isinstance(value, str):
        raise ConfigError(f"{field} must be text.")
    value = value.strip()
    if not value:
        if allow_empty:
            return ""
        raise ConfigError(f"{field} cannot be empty.")
    if len(value) > 200:
        raise ConfigError(f"{field} is too long (max 200 characters).")
    if "\\" in value or "\x00" in value:
        raise ConfigError(f"{field} contains invalid characters.")
    return value


def validate_config(raw):
    """Merge `raw` over DEFAULT_CONFIG and return a validated copy."""
    if not isinstance(raw, dict):
        raise ConfigError("Configuration must be an object.")
    cfg = dict(DEFAULT_CONFIG)
    cfg.update({k: v for k, v in raw.items() if k in DEFAULT_CONFIG})

    for key in ("debug", "staticfiles_app", "collectstatic_run",
                "load_static", "use_static_tag"):
        if not isinstance(cfg[key], bool):
            raise ConfigError(f"{key} must be true or false.")

    cfg["static_url"] = _clean_path(cfg["static_url"], "STATIC_URL")
    cfg["static_root"] = _clean_path(cfg["static_root"], "STATIC_ROOT", allow_empty=True)

    dirs = cfg["staticfiles_dirs"]
    if isinstance(dirs, str):                       # comma separated text
        dirs = [d for d in dirs.split(",")]
    if not isinstance(dirs, list) or len(dirs) > 10:
        raise ConfigError("STATICFILES_DIRS must be a list of at most 10 folders.")
    cleaned = []
    for d in dirs:
        d = _clean_path(d, "STATICFILES_DIRS entry", allow_empty=True)
        if d:
            cleaned.append(d.strip("/"))
    cfg["staticfiles_dirs"] = cleaned
    return cfg


def validate_assets(raw):
    if raw is None:
        return list(DEFAULT_ASSETS)
    if not isinstance(raw, list) or not raw:
        raise ConfigError("Provide at least one asset to request.")
    if len(raw) > 10:
        raise ConfigError("At most 10 assets can be requested at once.")
    out = []
    for a in raw:
        a = _clean_path(a, "Asset path").lstrip("/")
        if ".." in a.split("/"):
            raise ConfigError("Asset paths cannot contain '..'.")
        out.append(a)
    return out


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def get_metadata(asset):
    ext = posixpath.splitext(asset)[1].lower()
    if asset in ASSET_METADATA:
        return ASSET_METADATA[asset]
    if ext == ".css":
        return {"type": "stylesheet", "mime": "text/css; charset=utf-8", "size": "10.5 KB", "desc": "Custom CSS stylesheet"}
    if ext == ".js":
        return {"type": "script", "mime": "application/javascript; charset=utf-8", "size": "7.2 KB", "desc": "Custom JavaScript script"}
    if ext in (".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"):
        mime = "image/png" if ext == ".png" else "image/jpeg" if ext in (".jpg", ".jpeg") else "image/x-icon" if ext == ".ico" else "image/svg+xml"
        return {"type": "image", "mime": mime, "size": "34.8 KB", "desc": "Image asset"}
    return {"type": "file", "mime": "application/octet-stream", "size": "5.0 KB", "desc": "Static resource"}


def build_url(cfg, asset):
    """What {% static 'asset' %} renders to, or the raw path if tag isn't used."""
    if not cfg["use_static_tag"]:
        return asset                       # e.g. "css/style.css" (relative, un-prefixed)
    base = cfg["static_url"]
    if not base.endswith("/"):
        base += "/"                        # Django also appends a missing slash
    return base + asset


def _norm_dir(d):
    return posixpath.normpath(d.strip("/")) if d.strip("/") else ""


def find_in_dirs(fs, dirs, asset):
    """Return (dir, full_path) of the first folder containing `asset`, or None."""
    for d in dirs:
        full = posixpath.join(_norm_dir(d), asset)
        if full in fs:
            return d, full
    return None


# --------------------------------------------------------------------------
# Main simulation
# --------------------------------------------------------------------------
def simulate_request(cfg, fs, asset):
    """
    Trace one browser request for `asset` across 5 stages:
    1. Template Tag Resolution
    2. URL Route & Prefix Matching
    3. Server Execution Environment
    4. Storage & Directory Resolution
    5. HTTP Response Delivery
    """
    steps = []
    meta = get_metadata(asset)

    def step(stage_num, stage_name, title, ok, detail, code=""):
        steps.append({
            "stage": stage_num,
            "stage_name": stage_name,
            "title": title,
            "ok": ok,
            "detail": detail,
            "code": code,
        })

    result = {
        "asset": asset,
        "asset_type": meta["type"],
        "mime_type": meta["mime"],
        "size": meta["size"],
        "url": None,
        "status": None,
        "ok": False,
        "steps": steps,
        "hint": "",
        "failed_stage": 0,
        "diagnosis": None,
        "headers": {},
    }

    # =========================================================================
    # STAGE 1: Template Evaluation
    # =========================================================================
    if cfg["use_static_tag"] and not cfg["load_static"]:
        step(
            1, "Template Engine", "Evaluate {% static %} Tag", False,
            "{% static %} tag invoked, but '{% load static %}' is missing from the template. "
            "Django raises TemplateSyntaxError: Invalid block tag on line 3: 'static'.",
            "{% load static %}"
        )
        result.update(
            status=500,
            failed_stage=1,
            hint="Add '{% load static %}' at the very top of your template.",
            diagnosis={
                "error": "TemplateSyntaxError: 'static' is not a registered tag library",
                "cause": "Django template engine cannot parse {% static %} without loading the staticfiles tag library first.",
                "fix": "Add {% load static %} at the top of templates/index.html.",
                "code": "{% load static %}\n<link rel=\"stylesheet\" href=\"{% static '" + asset + "' %}\">"
            },
            headers={
                "Status": "500 Internal Server Error",
                "Content-Type": "text/html; charset=utf-8",
                "X-Frame-Options": "DENY",
            }
        )
        return result

    url = build_url(cfg, asset)
    result["url"] = url

    if cfg["use_static_tag"]:
        step(
            1, "Template Engine", "Render {% static %} Tag", True,
            f"Tag resolved successfully: {{% static '{asset}' %}} rendered as '{url}'.",
            f"{{% static '{asset}' %}} -> {url}"
        )
    else:
        step(
            1, "Template Engine", "Render Raw HTML Path", True,
            f"Raw path '{asset}' written in HTML without {{% static %}}. "
            "Browser will request this URL relative to current page location.",
            f"<link href=\"{asset}\">"
        )

    # =========================================================================
    # STAGE 2: URL Prefix Matching
    # =========================================================================
    prefix = cfg["static_url"] if cfg["static_url"].endswith("/") else cfg["static_url"] + "/"
    if not url.startswith(prefix):
        step(
            2, "URL Routing", "Match STATIC_URL Prefix", False,
            f"Requested URL '{url}' does not start with STATIC_URL prefix '{prefix}'. "
            "Django passes this to URLConf (urls.py), which finds no matching route.",
            f"STATIC_URL = '{prefix}'"
        )
        result.update(
            status=404,
            failed_stage=2,
            hint="Use the {% static '...' %} tag so the URL receives the configured STATIC_URL prefix.",
            diagnosis={
                "error": "HTTP 404: Static URL Route Mismatch",
                "cause": f"The browser requested '{url}', but static routing only handles URLs beginning with '{prefix}'.",
                "fix": f"Replace hardcoded '{asset}' with {{% static '{asset}' %}}.",
                "code": f"<!-- Use tag instead of hardcoded string -->\n{{% static '{asset}' %}}"
            },
            headers={
                "Status": "404 Not Found",
                "Content-Type": "text/html; charset=utf-8",
            }
        )
        return result

    step(
        2, "URL Routing", "Match STATIC_URL Prefix", True,
        f"URL '{url}' matches prefix STATIC_URL = '{prefix}'. Routing static handler for relative path: '{url[len(prefix):]}'.",
        f"Prefix: '{prefix}' (Match OK)"
    )
    rel = url[len(prefix):]                 # path of the file inside static dirs

    # =========================================================================
    # STAGE 3 & 4: Server Mode & Directory Resolution
    # =========================================================================
    dev_serving = cfg["debug"] and cfg["staticfiles_app"]

    if dev_serving:
        step(
            3, "Server Environment", "Select Serving Strategy", True,
            "DEBUG = True and 'django.contrib.staticfiles' installed in INSTALLED_APPS. "
            "Django runserver handles this request dynamically using staticfiles finders.",
            "runserver + FileSystemFinder"
        )

        if not cfg["staticfiles_dirs"]:
            step(
                4, "Storage Finder", "Search STATICFILES_DIRS", False,
                "STATICFILES_DIRS list is empty in settings.py! Django has no directories configured to search.",
                "STATICFILES_DIRS = []"
            )
            result.update(
                status=404,
                failed_stage=4,
                hint="Add your static directory to STATICFILES_DIRS in settings.py.",
                diagnosis={
                    "error": "HTTP 404: STATICFILES_DIRS Is Empty",
                    "cause": "Django FileSystemFinder has no directories configured to look inside.",
                    "fix": "Set STATICFILES_DIRS = [BASE_DIR / 'static'] in settings.py.",
                    "code": "STATICFILES_DIRS = [\n    BASE_DIR / 'static',\n]"
                },
                headers={
                    "Status": "404 Not Found",
                    "Content-Type": "text/html; charset=utf-8",
                }
            )
            return result

        searched = ", ".join(f"BASE_DIR / '{d}'" for d in cfg["staticfiles_dirs"])
        found = find_in_dirs(fs, cfg["staticfiles_dirs"], rel)

        if found:
            step(
                4, "Storage Finder", "Search STATICFILES_DIRS", True,
                f"FileSystemFinder searched [{searched}]. Located file at '{found[1]}'.",
                f"Found: {found[1]}"
            )
            # STAGE 5: HTTP Delivery
            step(
                5, "HTTP Delivery", "Transmit 200 OK Response", True,
                f"File stream served directly with MIME type '{meta['mime']}' and size {meta['size']}.",
                f"HTTP 200 OK | {meta['mime']}"
            )
            result.update(
                status=200,
                ok=True,
                hint="Static file resolved and served successfully in development mode.",
                headers={
                    "Status": "200 OK",
                    "Content-Type": meta["mime"],
                    "Content-Length": meta["size"],
                    "Server": "WSGIServer/0.2 CPython/3.12 (runserver)",
                    "Cache-Control": "no-cache, max-age=0",
                    "X-Content-Type-Options": "nosniff",
                }
            )
            return result

        step(
            4, "Storage Finder", "Search STATICFILES_DIRS", False,
            f"FileSystemFinder searched [{searched}], but relative path '{rel}' was not found in any folder.",
            f"File '{rel}' not found in [{searched}]"
        )
        result.update(
            status=404,
            failed_stage=4,
            hint="Check the folder name in STATICFILES_DIRS and ensure the file exists under that path.",
            diagnosis={
                "error": f"HTTP 404: '{rel}' Not Found on Disk",
                "cause": f"Django searched in [{searched}], but no file matched the relative path '{rel}'.",
                "fix": "Verify that your file exists in the directory specified in STATICFILES_DIRS.",
                "code": f"# Ensure file exists on disk:\n# project/{cfg['staticfiles_dirs'][0] if cfg['staticfiles_dirs'] else 'static'}/{rel}"
            },
            headers={
                "Status": "404 Not Found",
                "Content-Type": "text/html; charset=utf-8",
            }
        )
        return result

    # -------------------------------------------------------------------------
    # Production Mode (DEBUG=False or staticfiles app disabled)
    # -------------------------------------------------------------------------
    reason = []
    if not cfg["debug"]:
        reason.append("DEBUG = False (Production Mode)")
    if not cfg["staticfiles_app"]:
        reason.append("'django.contrib.staticfiles' missing from INSTALLED_APPS")

    step(
        3, "Server Environment", "Select Serving Strategy", True,
        f"{' and '.join(reason)}. Django runserver will NOT serve static files automatically. "
        "A production web server (Nginx/WhiteNoise) is required to serve from STATIC_ROOT.",
        "Production Strategy: Web Server / STATIC_ROOT"
    )

    if not cfg["static_root"]:
        step(
            4, "Storage Finder", "Check STATIC_ROOT Definition", False,
            "STATIC_ROOT is not configured in settings.py. Django cannot run collectstatic without a target directory.",
            "STATIC_ROOT = '' (Undefined)"
        )
        result.update(
            status=404,
            failed_stage=4,
            hint="Configure STATIC_ROOT in settings.py (e.g. BASE_DIR / 'staticfiles').",
            diagnosis={
                "error": "HTTP 404: STATIC_ROOT Not Configured",
                "cause": "In production, Django does not serve files from STATICFILES_DIRS. STATIC_ROOT must be defined.",
                "fix": "Add STATIC_ROOT = BASE_DIR / 'staticfiles' to settings.py.",
                "code": "STATIC_ROOT = BASE_DIR / 'staticfiles'"
            },
            headers={
                "Status": "404 Not Found",
                "Content-Type": "text/html; charset=utf-8",
            }
        )
        return result

    if not cfg["staticfiles_app"]:
        step(
            4, "Storage Finder", "Run collectstatic Command", False,
            "'django.contrib.staticfiles' is missing from INSTALLED_APPS, so collectstatic management command is unavailable.",
            "'django.contrib.staticfiles' missing"
        )
        result.update(
            status=404,
            failed_stage=4,
            hint="Add 'django.contrib.staticfiles' to INSTALLED_APPS in settings.py.",
            diagnosis={
                "error": "HTTP 404: staticfiles App Missing",
                "cause": "The collectstatic command belongs to django.contrib.staticfiles, which is disabled.",
                "fix": "Add 'django.contrib.staticfiles' to INSTALLED_APPS.",
                "code": "INSTALLED_APPS = [\n    'django.contrib.staticfiles',\n    ...\n]"
            },
            headers={
                "Status": "404 Not Found",
                "Content-Type": "text/html; charset=utf-8",
            }
        )
        return result

    if not cfg["collectstatic_run"]:
        step(
            4, "Storage Finder", "Verify collectstatic Execution", False,
            f"'collectstatic' has NOT been run yet! The target directory '{cfg['static_root']}/' is empty.",
            "python manage.py collectstatic (Pending)"
        )
        result.update(
            status=404,
            failed_stage=4,
            hint="Run 'python manage.py collectstatic' to compile static assets into STATIC_ROOT.",
            diagnosis={
                "error": "HTTP 404: collectstatic Not Run",
                "cause": f"In production (DEBUG=False), files must be collected into STATIC_ROOT ('{cfg['static_root']}').",
                "fix": "Run the collectstatic management command before deploying.",
                "code": "# Execute in terminal:\npython manage.py collectstatic --noinput"
            },
            headers={
                "Status": "404 Not Found",
                "Content-Type": "text/html; charset=utf-8",
            }
        )
        return result

    # When collectstatic is run, files in STATICFILES_DIRS get copied to STATIC_ROOT
    if find_in_dirs(fs, cfg["staticfiles_dirs"], rel):
        target_path = f"{_norm_dir(cfg['static_root'])}/{rel}"
        step(
            4, "Storage Finder", "Retrieve from STATIC_ROOT", True,
            f"File verified in STATIC_ROOT: '{target_path}' (collected from STATICFILES_DIRS).",
            f"STATIC_ROOT: {target_path}"
        )
        step(
            5, "HTTP Delivery", "Transmit 200 OK Response", True,
            f"Production server returned '{rel}' with cache headers: public, max-age=31536000.",
            f"HTTP 200 OK (Production) | {meta['mime']}"
        )
        result.update(
            status=200,
            ok=True,
            hint="Served from STATIC_ROOT with production caching headers.",
            headers={
                "Status": "200 OK",
                "Content-Type": meta["mime"],
                "Content-Length": meta["size"],
                "Server": "nginx/1.24.0 (Ubuntu)",
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            }
        )
        return result

    step(
        4, "Storage Finder", "Retrieve from STATIC_ROOT", False,
        f"'{rel}' was not present in any STATICFILES_DIRS directory during collectstatic, so it was never copied to STATIC_ROOT.",
        f"'{rel}' missing from STATICFILES_DIRS"
    )
    result.update(
        status=404,
        failed_stage=4,
        hint="Ensure the file exists in STATICFILES_DIRS, then rerun 'python manage.py collectstatic'.",
        diagnosis={
            "error": "HTTP 404: File Omitted from collectstatic",
            "cause": f"During collectstatic, '{rel}' was not found in any source folder.",
            "fix": "Add the file to STATICFILES_DIRS and rerun collectstatic.",
            "code": "python manage.py collectstatic"
        },
        headers={
            "Status": "404 Not Found",
            "Content-Type": "text/html; charset=utf-8",
        }
    )
    return result


def simulate(raw_cfg, fs, raw_assets=None):
    """Validate input, then trace every requested asset. Returns a summary dict."""
    cfg = validate_config(raw_cfg)
    assets = validate_assets(raw_assets)
    results = [simulate_request(cfg, fs, a) for a in assets]
    ok_count = sum(1 for r in results if r["ok"])

    # Build simulated virtual file system view
    vfs = {}
    for path in sorted(fs):
        folder, _, filename = path.partition("/")
        vfs.setdefault(folder + "/", []).append(filename)

    # Simulated collectstatic output
    collectstatic_output = []
    if cfg["collectstatic_run"]:
        copied_files = []
        for a in assets:
            if find_in_dirs(fs, cfg["staticfiles_dirs"], a):
                copied_files.append(a)
        collectstatic_output.append(f"Searching static files in {cfg['staticfiles_dirs']}...")
        for cf in copied_files:
            collectstatic_output.append(f"Copying '{cf}' -> '{cfg['static_root'] or 'staticfiles'}/{cf}'")
        collectstatic_output.append(f"{len(copied_files)} static files copied to '{cfg['static_root'] or 'staticfiles'}'.")
    else:
        collectstatic_output.append("# collectstatic has not been run. STATIC_ROOT is empty.")

    return {
        "config": cfg,
        "results": results,
        "summary": {
            "total": len(results),
            "ok": ok_count,
            "failed": len(results) - ok_count,
        },
        "vfs": vfs,
        "collectstatic_output": "\n".join(collectstatic_output),
        "generated_settings": render_settings(cfg),
        "generated_template": render_template_snippet(cfg, assets),
    }


# --------------------------------------------------------------------------
# Code generators
# --------------------------------------------------------------------------
def render_settings(cfg):
    dirs = ", ".join(f"BASE_DIR / '{d}'" for d in cfg["staticfiles_dirs"])
    lines = [
        "# settings.py - Static files configuration",
        f"DEBUG = {cfg['debug']}",
        "",
        "INSTALLED_APPS = [",
    ]
    if cfg["staticfiles_app"]:
        lines.append("    'django.contrib.staticfiles',")
    else:
        lines.append("    # WARNING: 'django.contrib.staticfiles' is missing!")
    lines += [
        "    'experiment',",
        "]",
        "",
        f"STATIC_URL = '{cfg['static_url']}'",
        f"STATICFILES_DIRS = [{dirs}]",
    ]
    if cfg["static_root"]:
        lines.append(f"STATIC_ROOT = BASE_DIR / '{cfg['static_root']}'")
    else:
        lines.append("# STATIC_ROOT = BASE_DIR / 'staticfiles'  # (Not configured)")
    return "\n".join(lines)


def render_template_snippet(cfg, assets):
    lines = ["<!-- templates/index.html -->"]
    if cfg["load_static"]:
        lines.append("{% load static %}")
    else:
        lines.append("<!-- MISSING: {% load static %} tag library! -->")

    lines.append("<!DOCTYPE html>\n<html>\n<head>")
    for a in assets:
        if a.endswith(".css"):
            ref = "{% static '" + a + "' %}" if cfg["use_static_tag"] else a
            lines.append(f'  <link rel="stylesheet" href="{ref}">')
        elif a.endswith(".js"):
            ref = "{% static '" + a + "' %}" if cfg["use_static_tag"] else a
            lines.append(f'  <script src="{ref}"></script>')
        else:
            ref = "{% static '" + a + "' %}" if cfg["use_static_tag"] else a
            lines.append(f'  <!-- Image: <img src="{ref}" alt="Logo"> -->')
    lines.append("</head>\n<body>\n  <header>\n    <img src=\"{% static 'images/logo.png' %}\" alt=\"Somaiya Logo\">\n    <h1>Welcome to Django VLab</h1>\n  </header>\n</body>\n</html>")
    return "\n".join(lines)