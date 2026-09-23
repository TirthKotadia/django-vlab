let step1Done = false;
let step2Done = false;
function doStep1() {
    document.getElementById('line1').innerHTML = "STATIC_URL = '/static/'<br>STATICFILES_DIRS = [BASE_DIR / 'static']";
    document.getElementById('line1').style.color = "#000";
    document.getElementById('line1').style.fontStyle = "normal";
    document.getElementById('line1').style.fontWeight = "600";
    document.getElementById('step1Badge').style.background = "#000";
    document.getElementById('msg1').innerHTML = "Configured";
    document.getElementById('msg1').style.background = "#f8f9fa";
    document.getElementById('msg1').style.color = "#000";
    document.getElementById('msg1').style.border = "1px solid #dee2e6";
    document.getElementById('btnStep1').disabled = true;
    document.getElementById('btnStep1').innerText = "Added";
    step1Done = true;
    updatePreview();
}
function reset1() {
    document.getElementById('line1').innerHTML = "# STATIC_URL not configured";
    document.getElementById('line1').style.color = "#6c757d";
    document.getElementById('line1').style.fontStyle = "italic";
    document.getElementById('line1').style.fontWeight = "400";
    document.getElementById('step1Badge').style.background = "#000";
    document.getElementById('msg1').innerHTML = "Not configured";
    document.getElementById('msg1').style.background = "white";
    document.getElementById('msg1').style.color = "#000";
    document.getElementById('btnStep1').disabled = false;
    document.getElementById('btnStep1').innerText = "Add Configuration";
    step1Done = false;
    updatePreview();
}
function doStep2() {
    document.getElementById('line2a').innerHTML = "{% load static %}";
    document.getElementById('line2a').style.color = "#000";
    document.getElementById('line2a').style.fontStyle = "normal";
    document.getElementById('line2a').style.fontWeight = "600";
    document.getElementById('line2b').innerHTML = '&lt;link rel="stylesheet" href="{% static \'css/style.css\' %}"&gt;';
    document.getElementById('line2b').style.color = "#000";
    document.getElementById('line2b').style.fontStyle = "normal";
    document.getElementById('line2b').style.fontWeight = "600";
    document.getElementById('line2c').innerHTML = '&lt;img src="{% static \'images/logo.png\' %}"&gt;';
    document.getElementById('line2c').style.color = "#000";
    document.getElementById('line2c').style.fontStyle = "normal";
    document.getElementById('line2c').style.fontWeight = "600";
    document.getElementById('step2Badge').style.background = "#000";
    document.getElementById('msg2').innerHTML = "Configured";
    document.getElementById('msg2').style.background = "#f8f9fa";
    document.getElementById('msg2').style.color = "#000";
    document.getElementById('btnStep2').disabled = true;
    document.getElementById('btnStep2').innerText = "Added";
    step2Done = true;
    updatePreview();
}
function reset2() {
    document.getElementById('line2a').innerHTML = "<!-- {% load static %} missing -->";
    document.getElementById('line2a').style.color = "#6c757d";
    document.getElementById('line2a').style.fontStyle = "italic";
    document.getElementById('line2a').style.fontWeight = "400";
    document.getElementById('line2b').innerHTML = '&lt;link rel="stylesheet" href="style.css"&gt;';
    document.getElementById('line2b').style.color = "#6c757d";
    document.getElementById('line2b').style.fontStyle = "italic";
    document.getElementById('line2c').innerHTML = '&lt;img src="logo.png"&gt;';
    document.getElementById('line2c').style.color = "#6c757d";
    document.getElementById('line2c').style.fontStyle = "italic";
    document.getElementById('step2Badge').style.background = "#000";
    document.getElementById('msg2').innerHTML = "Not configured";
    document.getElementById('msg2').style.background = "white";
    document.getElementById('msg2').style.color = "#000";
    document.getElementById('btnStep2').disabled = false;
    document.getElementById('btnStep2').innerText = "Add Template Tags";
    step2Done = false;
    updatePreview();
}
function updatePreview() {
    const preview = document.getElementById('previewContent');
    const urlBar = document.getElementById('previewUrl');
    if (step1Done && step2Done) {
        preview.style.background = "white";
        preview.innerHTML = `
            <div style="border:1px solid #dee2e6; border-radius:6px; padding:12px; width:100%; background:white;">
                <div style="font-weight:600; color:#000; font-size:13px; border-bottom:1px solid #dee2e6; padding-bottom:8px; margin-bottom:8px;">My Django Site</div>
                <div style="background:#000; color:white; padding:6px; border-radius:4px; font-size:12px;">Welcome - Styled Correctly</div>
                <div style="margin-top:8px; font-size:11px; color:#000; border:1px solid #dee2e6; padding:4px; border-radius:4px;">CSS: 200 &nbsp; Image: 200 &nbsp; JS: 200</div>
            </div>
        `;
        urlBar.innerHTML = "http://127.0.0.1:8000/static/css/style.css - 200";
        urlBar.style.color = "#000";
        urlBar.style.background = "white";
    } else if (step1Done || step2Done) {
        preview.style.background = "white";
        preview.innerHTML = `
            <div style="font-weight:600; color:#000; font-size:13px;">Partially Configured</div>
            <div style="font-size:11px; color:#000; margin-top:6px; border:1px solid #dee2e6; padding:6px; border-radius:4px; background:#f8f9fa;">
                ${!step1Done ? 'Step 1 pending' : 'Step 1 done'} | ${!step2Done ? 'Step 2 pending' : 'Step 2 done'}
            </div>
        `;
        urlBar.innerHTML = "http://127.0.0.1:8000/static/... - 404";
        urlBar.style.color = "#000";
    } else {
        preview.style.background = "white";
        preview.innerHTML = `
            <div style="font-weight:600; color:#000; font-size:13px;">Page Without Styling</div>
            <div style="font-size:11px; color:#000; margin-top:6px; border:1px solid #dee2e6; padding:6px; border-radius:4px; background:#f8f9fa; text-align:left; width:100%;">
                <div>Failed to load: style.css (404)</div>
                <div>Failed to load: logo.png (404)</div>
            </div>
            <div style="margin-top:8px; font-size:11px; color:#6c757d;">Unstyled content</div>
        `;
        urlBar.innerHTML = "http://127.0.0.1:8000/ - Preview";
        urlBar.style.color = "#000";
    }
}
function verifyOutput() {
    const result = document.getElementById('verifyResult');
    result.style.display = "block";
    result.style.color = "#000";
    result.style.border = "1px solid #dee2e6";
    result.style.background = "#f8f9fa";
    result.style.padding = "10px";
    result.style.borderRadius = "6px";
    result.style.textAlign = "center";
    result.style.fontSize = "13px";
    if (step1Done && step2Done) {
        result.innerHTML = `<div style="font-weight:600; color:#000;">Static Files Served (200)</div><div style="font-size:11px; color:#000; margin-top:4px;">CSS, JS and Images loaded correctly.</div>`;
    } else {
        let missing = [];
        if (!step1Done) missing.push("Step 1");
        if (!step2Done) missing.push("Step 2");
        result.innerHTML = `<div style="font-weight:600; color:#000;">Not Configured (404)</div><div style="font-size:11px; color:#000; margin-top:4px;">Pending: ${missing.join(', ')}</div>`;
    }
    result.scrollIntoView({behavior: 'smooth', block: 'center'});
}
function resetAll() {
    reset1();
    reset2();
    document.getElementById('verifyResult').style.display = "none";
    document.getElementById('verifyResult').innerHTML = "";
    document.getElementById('finalMsg').innerHTML = "";
}
document.addEventListener('DOMContentLoaded', function() {
    updatePreview();
});
