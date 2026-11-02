/* Static-files simulation page.
   Every result is computed by the server (experiment/simulator.py via /api/simulate/). */
document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // Works on its own: the inline SIM_DEFAULTS block in the template is optional.
    var D = window.SIM_DEFAULTS || {};
    D.config = D.config || {
        static_url: "/static/",
        staticfiles_dirs: ["static"],
        static_root: "staticfiles",
        debug: true,
        staticfiles_app: true,
        collectstatic_run: false,
        load_static: true,
        use_static_tag: true
    };
    D.simulateUrl = D.simulateUrl || "/api/simulate/";

    function $(id) { return document.getElementById(id); }

    var staticUrl = $("staticUrl");
    var staticDirs = $("staticDirs");
    var applyBtn = $("loadStatic");
    var assetType = $("assetType");
    var assetPath = $("assetPath");
    var templateCode = $("templateCode");
    var previewContent = $("previewContent");
    var previewAddress = $("previewAddress");
    var overallStatus = $("overallStatus");
    var testProgress = $("testProgress");
    var progressFill = $("progressFill");
    var resultSummary = $("resultSummary");
    var requestedAsset = $("requestedAsset");
    var httpStatus = $("httpStatus");
    var responseType = $("responseType");
    var checksPassed = $("checksPassed");
    var diagnostics = $("diagnostics");
    var runBtn = $("runTest");
    var resetBtn = $("resetLab");

    var TOTAL_STAGES = 5;
    var DEFAULT_PATHS = { css: "css/style.css", js: "js/app.js", image: "images/logo.png" };

    var applied = null;      // configuration committed with "Apply Configuration"
    var requestId = 0;

    /* ---------------- helpers ---------------- */
    function esc(v) {
        return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function csrf() {
        var m = document.cookie.match("(^|;)\\s*csrftoken=([^;]*)");
        return m ? decodeURIComponent(m[2]) : (window.SIM_CSRF || "");
    }

    // 'BASE_DIR / "static"', "static" or static  ->  static
    function parseDirs(text) {
        return text.split(/[\n,]+/).map(function (part) {
            part = part.trim().replace(/,$/, "");
            if (!part) return "";
            var q = part.match(/["']([^"']*)["']/);
            if (q) return q[1].trim();
            return part.replace(/^BASE_DIR\s*\/\s*/, "").trim();
        }).filter(Boolean);
    }

    function readConfig() {
        var cfg = {};
        Object.keys(D.config).forEach(function (k) { cfg[k] = D.config[k]; });
        cfg.static_url = staticUrl.value;
        cfg.staticfiles_dirs = parseDirs(staticDirs.value);
        return cfg;
    }

    function cleanPath() {
        return assetPath.value.trim().replace(/^\/+/, "");
    }

    /* ---------------- template syntax (live) ---------------- */
    function updateTemplateCode() {
        var p = cleanPath() || DEFAULT_PATHS[assetType.value];
        var tag;
        if (assetType.value === "js") {
            tag = "<script src=\"{% static '" + p + "' %}\"></script>";
        } else if (assetType.value === "image") {
            tag = "<img src=\"{% static '" + p + "' %}\" alt=\"Logo\">";
        } else {
            tag = "<link rel=\"stylesheet\" href=\"{% static '" + p + "' %}\">";
        }
        templateCode.textContent = "{% load static %}\n" + tag;
    }

    /* ---------------- idle / stale state ---------------- */
    function setIdle(message) {
        previewAddress.textContent = "/static/" + (cleanPath() || DEFAULT_PATHS[assetType.value]);
        previewContent.innerHTML =
            "<h3>Resource Preview</h3><p>Choose a resource above, then select " +
            "<strong>Run Simulation</strong> to see the expected browser response.</p>";
        overallStatus.textContent = "Status: Waiting to run the simulation.";
        resultSummary.textContent = message || "Run the simulation to display the request summary.";
        testProgress.textContent = "Checks completed: 0";
        progressFill.style.width = "0";
        requestedAsset.textContent = "Not requested";
        httpStatus.textContent = "Not available";
        responseType.textContent = "Not available";
        checksPassed.textContent = "Not available";
        diagnostics.textContent = "No diagnostics available yet.";
    }

    /* ---------------- render server result ---------------- */
    function stagesPassed(r) {
        return r.steps.filter(function (s) { return s.ok; }).length;
    }

    function renderResult(data) {
        var r = data.results[0];
        var passed = stagesPassed(r);
        var origin = "127.0.0.1:8000";

        previewAddress.textContent = r.url ? origin + (r.url.charAt(0) === "/" ? r.url : "/" + r.url) : origin + "/";

        renderPreview(r);

        overallStatus.textContent = "Status: " + (r.headers.Status || r.status) +
            (r.ok ? " — request succeeded." : " — request failed at stage " + r.failed_stage + " of " + TOTAL_STAGES + ".");
        resultSummary.textContent = r.hint;
        testProgress.textContent = "Checks completed: " + passed + " of " + TOTAL_STAGES;
        progressFill.style.width = Math.round(passed / TOTAL_STAGES * 100) + "%";
        progressFill.style.background = r.ok ? "#28754d" : "#a94b40";

        requestedAsset.textContent = r.url || r.asset;
        httpStatus.textContent = r.headers.Status || String(r.status);
        responseType.textContent = r.mime_type + " (" + r.asset_type + ")";
        checksPassed.textContent = passed + " / " + TOTAL_STAGES + " stages";

        var html = r.steps.map(function (s) {
            return "<span style=\"display:block;margin-bottom:6px\">" +
                (s.ok ? "✔ " : "✘ ") + "<strong>Stage " + s.stage + " · " + esc(s.title) + "</strong><br>" +
                esc(s.detail) + "</span>";
        }).join("");

        if (!r.ok && r.diagnosis) {
            html += "<span style=\"display:block;margin-top:10px\"><strong>" + esc(r.diagnosis.error) + "</strong><br>" +
                "<em>Cause:</em> " + esc(r.diagnosis.cause) + "<br>" +
                "<em>Fix:</em> " + esc(r.diagnosis.fix) + "<br>" +
                "<code style=\"white-space:pre-wrap\">" + esc(r.diagnosis.code) + "</code></span>";
        }
        diagnostics.innerHTML = html;
    }


    /* ---------------- real-life preview ---------------- */
    var LOGO_SVG =
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#0c4b33"/><stop offset="1" stop-color="#44b78b"/></linearGradient></defs>' +
        '<rect width="160" height="160" rx="32" fill="url(#g)"/>' +
        '<circle cx="80" cy="80" r="50" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6"/>' +
        '<text x="80" y="96" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="700" ' +
        'text-anchor="middle" fill="#fff">dj</text></svg>';

    var DEMO_CSS = {
        "css/style.css":
            "body{margin:0;font-family:Arial,sans-serif;background:#f4f7fb;color:#243247}" +
            ".hero{background:#244b78;color:#fff;padding:22px;text-align:center}" +
            ".hero h1{margin:0 0 4px;font-size:24px}.hero p{margin:0;opacity:.85;font-size:13px}" +
            "main{padding:18px;max-width:420px;margin:0 auto}" +
            ".card{background:#fff;border:1px solid #dce3eb;border-radius:8px;padding:14px;margin-bottom:14px}" +
            ".btn{background:#2e8b57;color:#fff;border:0;border-radius:5px;padding:9px 16px;font-weight:700;cursor:pointer}",
        "css/theme.css":
            "body{margin:0;font-family:Georgia,serif;background:#12151c;color:#e6e9ef}" +
            ".hero{background:linear-gradient(135deg,#6d28d9,#db2777);color:#fff;padding:22px;text-align:center}" +
            ".hero h1{margin:0 0 4px;font-size:24px;letter-spacing:1px}.hero p{margin:0;opacity:.9;font-size:13px}" +
            "main{padding:18px;max-width:420px;margin:0 auto}" +
            ".card{background:#1d222c;border:1px solid #333b4a;border-radius:12px;padding:14px;margin-bottom:14px}" +
            ".btn{background:#f59e0b;color:#111;border:0;border-radius:20px;padding:9px 18px;font-weight:700;cursor:pointer}"
    };

    var DEMO_JS =
        "(function(){var n=0;console.log('app.js loaded successfully');" +
        "document.getElementById('btn').onclick=function(){n++;" +
        "document.getElementById('count').textContent=n;" +
        "console.log('Button clicked '+n+' time(s)');};})();";

    function kindOf(path) {
        if (/\.css$/i.test(path)) return "css";
        if (/\.js$/i.test(path)) return "js";
        return "image";
    }

    function demoPage(kind, asset, ok, failText) {
        var head = "<meta charset='utf-8'><style>*{box-sizing:border-box}html,body{margin:0}</style>";
        if (kind === "css") {
            var css = ok ? (DEMO_CSS[asset] || DEMO_CSS["css/style.css"]) : "";
            var banner = ok ? "" :
                "<div style='background:#fff3cd;color:#664d03;padding:6px 10px;font:12px Arial'>" +
                "Stylesheet failed to load (" + failText + ") — page shown without styles</div>";
            return "<!doctype html><html><head>" + head + "<style>" + css + "</style></head><body>" + banner +
                "<div class='hero'><h1>My Django Site</h1><p>Styled by " + esc(asset) + "</p></div>" +
                "<main><div class='card'><h3 style='margin-top:0'>Welcome</h3>" +
                "<p>This page uses the static stylesheet you requested.</p></div>" +
                "<button class='btn'>Click me</button></main></body></html>";
        }
        if (kind === "js") {
            var js = ok ? DEMO_JS : "";
            return "<!doctype html><html><head>" + head +
                "<style>body{font:14px Arial;padding:14px;color:#243247}" +
                "button{background:#244b78;color:#fff;border:0;border-radius:5px;padding:8px 14px;cursor:pointer}" +
                "#console{margin-top:12px;background:#142235;color:#d9f0e4;font:12px Consolas,monospace;padding:8px;border-radius:6px;min-height:70px}" +
                "#console .err{color:#ff8b83}</style></head><body>" +
                "<h3 style='margin-top:0'>Interactive page</h3>" +
                "<button id='btn'>Click me</button> Clicks: <b id='count'>0</b>" +
                "<div id='console'></div>" +
                "<script>(function(){var o=document.getElementById('console');" +
                "function w(t,c){var d=document.createElement('div');d.textContent=t;if(c)d.className=c;o.appendChild(d);}" +
                "console.log=function(){w([].slice.call(arguments).join(' '));};" +
                "console.error=function(){w([].slice.call(arguments).join(' '),'err');};})();<\/script>" +
                (ok ? "" :
                    "<script>console.error('Failed to load resource: " + failText + "');" +
                    "document.getElementById('btn').onclick=function(){" +
                    "try{initApp();}catch(e){console.error('Uncaught '+e.name+': '+e.message);}};<\/script>") +
                "<script>" + js + "<\/script></body></html>";
        }
        // image
        var inner;
        if (ok) {
            var src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(LOGO_SVG);
            if (/\.ico$/i.test(asset)) {
                inner = "<div style='display:inline-flex;align-items:center;gap:8px;border:1px solid #cbd5e1;" +
                    "border-bottom:0;border-radius:8px 8px 0 0;padding:8px 14px;background:#fff;font:13px Arial'>" +
                    "<img src='" + src + "' width='16' height='16' alt=''> My Django Site</div>" +
                    "<p style='font:12px Arial;color:#64748b'>The favicon appears in the browser tab.</p>";
            } else {
                inner = "<img src='" + src + "' width='150' height='150' alt='Logo' style='border-radius:16px'>";
            }
        } else {
            inner = "<div style='display:inline-block;border:2px dashed #c9544a;border-radius:8px;padding:14px;" +
                "font:13px Arial;color:#9f2c25;background:#fff6f5'>" +
                "<img src='data:image/png;base64,AAAA' alt='Logo' width='60' height='60'>" +
                "<div style='margin-top:6px'>Broken image — " + failText + "</div></div>";
        }
        return "<!doctype html><html><head>" + head + "</head><body style='font-family:Arial;text-align:center;padding:24px'>" +
            inner + "</body></html>";
    }

    function renderPreview(r) {
        var asset = r.asset.replace(/^\/+/, "");
        var kind = kindOf(asset);
        var failText = r.status + " " + (r.headers.Status ? String(r.headers.Status).replace(/^\d+\s*/, "") : "Error");
        var html;

        if (r.status === 500) {
            var d = r.diagnosis || {};
            html = "<!doctype html><html><body style='margin:0;font-family:Arial'>" +
                "<div style='background:#2a2a2a;color:#fff;padding:14px 18px'>" +
                "<div style='font-size:12px;opacity:.7'>Server Error (500)</div>" +
                "<div style='font-size:18px;font-weight:700'>" + esc(d.error || "TemplateSyntaxError") + "</div></div>" +
                "<div style='padding:14px 18px;font-size:13px;color:#333'>" + esc(d.cause || r.hint) + "</div></body></html>";
        } else {
            html = demoPage(kind, asset, r.ok, esc(failText));
        }

        var heights = { css: 290, js: 260, image: 230 };
        previewContent.innerHTML = "";
        var frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-scripts");        // runs isolated, cannot touch this page
        frame.setAttribute("title", "Simulated browser output");
        frame.style.cssText = "width:100%;height:" + (r.status === 500 ? 150 : heights[kind]) +
            "px;border:1px solid #dce3eb;border-radius:5px;background:#fff";
        frame.srcdoc = html;
        previewContent.appendChild(frame);

        var cap = document.createElement("p");
        cap.className = "muted";
        cap.style.cssText = "margin:8px 0 0;font-size:13px";
        cap.textContent = r.ok
            ? "Rendered output · " + r.status + " OK · " + r.mime_type + " · " + r.size
            : "Rendered output · " + failText + " · " + r.hint;
        previewContent.appendChild(cap);
    }

    function showProblem(message) {
        overallStatus.textContent = "Status: Could not run the simulation.";
        resultSummary.textContent = message;
        diagnostics.textContent = message;
    }

    /* ---------------- server call ---------------- */
    function simulate(cfg, path) {
        var my = ++requestId;
        runBtn.disabled = true;
        return fetch(D.simulateUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-CSRFToken": csrf() },
            body: JSON.stringify({ config: cfg, assets: [path] })
        }).then(function (resp) {
            return resp.json().then(function (body) { return { ok: resp.ok, body: body }; });
        }).then(function (res) {
            if (my !== requestId) return null;       // superseded by a newer request
            if (!res.ok) throw new Error(res.body.error || "The server rejected the request.");
            return res.body;
        }).then(function (data) {
            runBtn.disabled = false;
            return data;
        }, function (err) {
            runBtn.disabled = false;
            throw err;
        });
    }

    /* ---------------- actions ---------------- */
    function applyConfiguration() {
        var cfg = readConfig();
        if (!cfg.staticfiles_dirs.length) {
            showProblem("STATICFILES_DIRS is empty. Django has no folder to search — add one, for example BASE_DIR / \"static\".");
            return Promise.resolve(false);
        }
        return simulate(cfg, cleanPath() || DEFAULT_PATHS[assetType.value]).then(function (data) {
            if (!data) return false;
            applied = data.config;                   // validated + normalised by the server
            setIdle("Configuration applied: STATIC_URL = '" + applied.static_url +
                    "', searching " + applied.staticfiles_dirs.map(function (d) {
                        return "BASE_DIR / '" + d + "'";
                    }).join(", ") + ". Now run the simulation.");
            diagnostics.textContent = "Configuration saved. Run the simulation to test a request.";
            return true;
        }, function (err) {
            showProblem(err.message);
            return false;
        });
    }

    function runSimulation() {
        var path = cleanPath();
        if (!path) {
            overallStatus.textContent = "Status: 400 Bad Request";
            resultSummary.textContent = "Please enter a resource path.";
            diagnostics.textContent = "A resource path is required before a request can be made.";
            return;
        }
        overallStatus.textContent = "Status: Running simulation…";
        simulate(readConfig(), path).then(function (data) {
            if (data) { applied = data.config; renderResult(data); }
        }, function (err) {
            showProblem(err.message);
        });
    }

    function resetLab() {
        requestId++;                                  // drop any in-flight response
        runBtn.disabled = false;
        staticUrl.value = D.config.static_url;
        staticDirs.value = "BASE_DIR / \"" + D.config.staticfiles_dirs[0] + "\"";
        assetType.value = "css";
        assetPath.value = DEFAULT_PATHS.css;
        applied = null;
        updateTemplateCode();
        setIdle();
    }

    /* ---------------- wiring ---------------- */
    function markStale() {
        updateTemplateCode();
        setIdle("Settings changed. Run the simulation again.");
        diagnostics.textContent = "Settings changed. Run the simulation again.";
    }

    assetType.addEventListener("change", function () {
        assetPath.value = DEFAULT_PATHS[assetType.value];     // sensible path for the chosen type
        markStale();
    });
    assetPath.addEventListener("input", markStale);
    staticUrl.addEventListener("input", markStale);
    staticDirs.addEventListener("input", markStale);

    applyBtn.addEventListener("click", applyConfiguration);
    runBtn.addEventListener("click", runSimulation);
    resetBtn.addEventListener("click", resetLab);

    resetLab();
});