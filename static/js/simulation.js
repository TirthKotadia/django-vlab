
document.addEventListener("DOMContentLoaded", function () {
    const staticUrl = document.getElementById("staticUrl");
    const staticDirs = document.getElementById("staticDirs");
    const loadStatic = document.getElementById("loadStatic");
    const assetType = document.getElementById("assetType");
    const assetPath = document.getElementById("assetPath");

    const settingsCode = document.getElementById("settingsCode");
    const templateCode = document.getElementById("templateCode");
    const previewContent = document.getElementById("previewContent");
    const previewAddress = document.getElementById("previewAddress");

    const overallStatus = document.getElementById("overallStatus");
    const testProgress = document.getElementById("testProgress");
    const resultSummary = document.getElementById("resultSummary");
    const requestedAsset = document.getElementById("requestedAsset");
    const httpStatus = document.getElementById("httpStatus");
    const responseType = document.getElementById("responseType");
    const checksPassed = document.getElementById("checksPassed");
    const diagnostics = document.getElementById("diagnostics");

    const assets = {
        css: {
            name: "CSS stylesheet",
            path: "css/style.css",
            tag: '<link rel="stylesheet" href="{% static \'css/style.css\' %}">',
            description: "Stylesheet request"
        },
        image: {
            name: "Image",
            path: "images/logo.png",
            tag: '<img src="{% static \'images/logo.png\' %}" alt="Logo">',
            description: "Image request"
        },
        js: {
            name: "JavaScript",
            path: "js/app.js",
            tag: '<script src="{% static \'js/app.js\' %}"></script>',
            description: "JavaScript request"
        }
    };

    let hasRun = false;

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function getSelectedAsset() {
        return assets[assetType.value] || assets.css;
    }

    function getRequestedPath() {
        const asset = getSelectedAsset();

        if (assetPath.value === "plain") {
            return asset.path.split("/").pop();
        }

        if (assetPath.value === "missing") {
            return "missing/" + asset.path.split("/").pop();
        }

        return asset.path;
    }

    function updateSettingsCode() {
        const lines = [
            "BASE_DIR = Path(__file__).resolve().parent.parent",
            ""
        ];

        if (staticUrl.checked) {
            lines.push("STATIC_URL = '/static/'");
        } else {
            lines.push("# STATIC_URL is not configured");
        }

        if (staticDirs.checked) {
            lines.push("STATICFILES_DIRS = [BASE_DIR / 'static']");
        } else {
            lines.push("# STATICFILES_DIRS is not configured");
        }

        settingsCode.textContent = lines.join("\n");
    }

    function updateTemplateCode() {
        const asset = getSelectedAsset();
        const lines = [];

        if (loadStatic.checked) {
            lines.push("{% load static %}");
        } else {
            lines.push("<!-- Django static tag not loaded -->");
        }

        lines.push("<html>");
        lines.push("<head>");

        if (assetType.value === "css") {
            lines.push("  " + asset.tag);
        } else {
            lines.push("  <!-- Selected asset: " + asset.name + " -->");
        }

        lines.push("</head>");
        lines.push("<body>");

        if (assetType.value !== "css") {
            lines.push("  " + asset.tag);
        }

        lines.push("</body>");
        lines.push("</html>");

        if (assetPath.value === "plain") {
            lines.push("");
            lines.push("Note: A relative path is being tested.");
        } else if (assetPath.value === "missing") {
            lines.push("");
            lines.push("Note: The selected file path does not exist.");
        }

        templateCode.textContent = lines.join("\n");
    }

    function updatePreviewBeforeTest() {
        if (hasRun) return;

        previewAddress.textContent = "127.0.0.1:8000/example/";

        previewContent.innerHTML = `
            <div class="demo-site">
                <h4>My Django Website</h4>
                <p>Welcome to the example page.</p>
                <div class="demo-banner">
                    Ready to test the selected static asset.
                </div>
                <p class="small-note">
                    Change the settings or asset path, then click Run Test.
                </p>
            </div>
        `;

        overallStatus.className = "status-pill";
        overallStatus.textContent = "Not tested";
        testProgress.style.width = "0%";
        resultSummary.textContent =
            "Configure the settings and click Run Test.";
    }

    function showDiagnostics(messages, success) {
        const heading = success
            ? "Configuration check passed"
            : "Things to check";

        diagnostics.innerHTML =
            "<strong>" + heading + "</strong>" +
            '<ul class="result-list">' +
            messages.map(function (message) {
                return "<li>" + escapeHTML(message) + "</li>";
            }).join("") +
            "</ul>";
    }

    function runTest() {
        hasRun = true;

        const asset = getSelectedAsset();
        const requestedPath = getRequestedPath();

        const checks = [
            {
                name: "STATIC_URL is configured",
                passed: staticUrl.checked,
                fix: "Define STATIC_URL = '/static/' in settings.py."
            },
            {
                name: "Static directory is configured",
                passed: staticDirs.checked,
                fix: "Configure STATICFILES_DIRS for the project-level static directory."
            },
            {
                name: "Django static template tag is loaded",
                passed: loadStatic.checked,
                fix: "Add {% load static %} at the top of the template."
            },
            {
                name: "Asset path is correct",
                passed: assetPath.value === "correct",
                fix: "Use the correct path inside the static template tag."
            }
        ];

        const passedCount = checks.filter(function (check) {
            return check.passed;
        }).length;

        const success = passedCount === checks.length;
        const status = success ? "200 OK" : "404 Not Found";

        const failedChecks = checks.filter(function (check) {
            return !check.passed;
        });

        updateSettingsCode();
        updateTemplateCode();

        requestedAsset.textContent = requestedPath;
        httpStatus.textContent = status;
        httpStatus.className = "status-pill " +
            (success ? "success" : "error");

        responseType.textContent = asset.name;
        checksPassed.textContent = passedCount + " / " + checks.length;

        overallStatus.textContent = success ? "Passed" : "Failed";
        overallStatus.className = "status-pill " +
            (success ? "success" : "error");

        testProgress.style.width =
            Math.round((passedCount / checks.length) * 100) + "%";

        testProgress.style.background = success ? "#28754d" : "#a94b40";

        if (success) {
            resultSummary.textContent =
                "All configuration checks passed in this simulation.";
        } else {
            resultSummary.textContent =
                "The simulated request failed. Review the diagnostics below.";
        }

        previewAddress.textContent =
            "127.0.0.1:8000/static/" + requestedPath;

        if (success) {
            previewContent.innerHTML = `
                <div class="demo-site">
                    <h4>My Django Website</h4>
                    <p>The selected asset passed the configuration checks.</p>
                    <div class="demo-banner">
                        ${escapeHTML(asset.name)} request successful
                    </div>
                    <p class="small-note">
                        Simulated response: 200 OK
                    </p>
                </div>
            `;
        } else {
            previewContent.innerHTML = `
                <div class="error-preview">
                    <h4>Static asset could not be loaded</h4>
                    <p>The simulated browser request did not pass all checks.</p>
                    <p><strong>Requested path:</strong></p>
                    <code>${escapeHTML(requestedPath)}</code>
                    <p style="margin-top:10px;">
                        Review the configuration and try again.
                    </p>
                </div>
            `;
        }

        showDiagnostics(
            success
                ? [
                    "STATIC_URL is configured.",
                    "The project static directory is configured.",
                    "The static template tag is loaded.",
                    "The selected path passed the simulation checks."
                ]
                : failedChecks.map(function (check) {
                    return check.fix;
                }),
            success
        );
    }

    function resetLab() {
        staticUrl.checked = true;
        staticDirs.checked = true;
        loadStatic.checked = true;
        assetType.value = "css";
        assetPath.value = "correct";
        hasRun = false;

        updateSettingsCode();
        updateTemplateCode();

        requestedAsset.textContent = "—";
        httpStatus.textContent = "—";
        httpStatus.className = "status-pill";
        responseType.textContent = "—";
        checksPassed.textContent = "0 / 4";

        overallStatus.textContent = "Not tested";
        overallStatus.className = "status-pill";
        testProgress.style.width = "0%";
        testProgress.style.background = "#28754d";

        resultSummary.textContent =
            "Configure the settings and click Run Test.";

        diagnostics.innerHTML =
            '<p class="muted">Test results and suggestions will appear here.</p>';

        updatePreviewBeforeTest();
    }

    [staticUrl, staticDirs, loadStatic, assetType, assetPath].forEach(
        function (control) {
            control.addEventListener("change", function () {
                updateSettingsCode();
                updateTemplateCode();

                hasRun = false;
                updatePreviewBeforeTest();

                requestedAsset.textContent = "—";
                httpStatus.textContent = "—";
                httpStatus.className = "status-pill";
                responseType.textContent = "—";
                checksPassed.textContent = "0 / 4";

                diagnostics.innerHTML =
                    '<p class="muted">Settings changed. Run the test again.</p>';
            });
        }
    );

    document.getElementById("runTest").addEventListener("click", runTest);
    document.getElementById("resetLab").addEventListener("click", resetLab);

    resetLab();
});

document.addEventListener("DOMContentLoaded", () => {
    const type = document.getElementById("assetType");
    const path = document.getElementById("assetPath");
    const runButton = document.getElementById("runTest");
    const resetButton = document.getElementById("resetLab");

    const status = document.getElementById("httpStatus");
    const responseType = document.getElementById("responseType");
    const requestedAsset = document.getElementById("requestedAsset");
    const summary = document.getElementById("resultSummary");
    const diagnostics = document.getElementById("diagnostics");
    const preview = document.getElementById("previewContent");
    const address = document.getElementById("previewAddress");

    if (!runButton || !type || !path) return;

    const defaults = {
        type: type.value,
        path: path.value
    };

    function runSimulation() {
        const selectedType = type.value;
        const selectedPath = path.value.trim();

        if (!selectedPath) {
            status.textContent = "400";
            summary.textContent = "Please enter a file path.";
            diagnostics.textContent =
                "A resource path is required before a request can be made.";
            return;
        }

        const cleanPath = selectedPath.replace(/^\/+/, "");
        const validFiles = {
            css: ["css/style.css", "css/vlab-style.css"],
            js: ["js/script.js", "js/simulation.js"],
            image: ["images/background.jpg", "images/logo.png"]
        };

        const found = (validFiles[selectedType] || [])
            .includes(cleanPath);

        requestedAsset.textContent = cleanPath;
        address.textContent = "/static/" + cleanPath;

        if (found) {
            status.textContent = "200 OK";
            responseType.textContent =
                selectedType === "css" ? "text/css" :
                selectedType === "js" ? "application/javascript" :
                "image/*";

            summary.textContent = "Resource loaded successfully!";
            diagnostics.textContent =
                "The simulated server found the selected resource and returned a successful response.";

            preview.innerHTML = "";

            if (selectedType === "css") {
                preview.textContent =
                    "CSS resource loaded\n\nExample: body { font-family: Arial; }";
            } else if (selectedType === "js") {
                preview.textContent =
                    "JavaScript resource loaded\n\nExample: console.log('Resource loaded');";
            } else {
                preview.textContent =
                    "Image resource loaded\n\nThe simulated response represents an image file.";
            }
        } else {
            status.textContent = "404 Not Found";
            responseType.textContent = "text/html";
            summary.textContent = "Resource not found.";
            diagnostics.textContent =
                "Check the selected file type and path. The path does not match a resource in this simulation.";
            preview.textContent =
                "404 — The requested static resource could not be found.";
        }
    }

    function resetSimulation() {
        type.value = defaults.type;
        path.value = defaults.path;

        [status, responseType, requestedAsset, summary,
         diagnostics, preview, address].forEach(element => {
            if (element) element.textContent = "—";
        });

        summary.textContent = "Run the simulation to view results.";
        preview.textContent = "Your response will appear here.";
        address.textContent = "http://127.0.0.1:8000/";
    }

    runButton.addEventListener("click", runSimulation);

    if (resetButton) {
        resetButton.addEventListener("click", resetSimulation);
    }

    type.addEventListener("change", () => {
        summary.textContent =
            "Resource type changed. Run the simulation to test it.";
    });

    path.addEventListener("input", () => {
        summary.textContent =
            "Path edited. Run the simulation to test the request.";
    });
});
