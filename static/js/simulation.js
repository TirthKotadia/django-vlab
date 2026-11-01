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

        if (r.ok) {
            var what = r.asset_type === "stylesheet" ? "The stylesheet was downloaded and applied."
                     : r.asset_type === "script" ? "The script was downloaded and executed."
                     : r.asset_type === "image" ? "The image was downloaded and displayed."
                     : "The file was delivered.";
            previewContent.innerHTML =
                "<h3>" + r.status + " OK</h3>" +
                "<p>" + esc(what) + "</p>" +
                "<p><strong>" + esc(r.asset) + "</strong><br>" +
                esc(r.mime_type) + " · " + esc(r.size) + "</p>";
        } else {
            previewContent.innerHTML =
                "<h3>" + r.status + " — static asset could not be loaded</h3>" +
                "<p>" + esc(r.hint) + "</p>" +
                "<p><strong>Requested URL:</strong><br><code>" + esc(r.url || r.asset) + "</code></p>";
        }

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