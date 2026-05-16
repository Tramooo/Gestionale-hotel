(function initDashboardUI() {
    // -------- Live clock in eyebrow --------
    var eyebrow = document.getElementById('eyebrow-text');
    var giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    var mesi   = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

    function updateClock() {
        if (!eyebrow) return;
        var d  = new Date();
        var hh = String(d.getHours()).padStart(2, '0');
        var mm = String(d.getMinutes()).padStart(2, '0');
        eyebrow.textContent = giorni[d.getDay()] + ' ' + d.getDate() + ' ' + mesi[d.getMonth()] + ' · ' + hh + ':' + mm;
    }

    updateClock();
    setInterval(updateClock, 30000);

    // -------- Movements tabs --------
    // Use live queries on click so dynamically rendered rows are always captured.
    var movTabs = document.querySelectorAll('#movements-tabs .dash-tab');

    movTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var which = tab.dataset.tab;
            movTabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
            document.querySelectorAll('#movements-list .movement-row').forEach(function (row) {
                row.hidden = row.dataset.panel !== which;
            });
        });
    });

    // -------- KPI data bridge --------
    // dashboard.js writes to #dash-arrivals-value / #dash-departures-value in the subtitle.
    // Mirror those values to the large KPI figures.
    function mirrorKpiValue(sourceId, targetId) {
        var src = document.getElementById(sourceId);
        var tgt = document.getElementById(targetId);
        if (!src || !tgt) return;
        tgt.textContent = src.textContent;
        new MutationObserver(function () {
            tgt.textContent = src.textContent;
        }).observe(src, { childList: true, characterData: true, subtree: true });
    }

    mirrorKpiValue('dash-arrivals-value',   'dash-arrivals-kpi');
    mirrorKpiValue('dash-departures-value', 'dash-departures-kpi');

    // -------- Occupancy ring --------
    var occValue = document.getElementById('dash-occupancy-value');
    var occArc   = document.getElementById('dash-occ-arc');

    function updateOccRing(text) {
        if (!occArc || !text) return;
        var pct = parseInt(text, 10);
        if (isNaN(pct)) return;
        // circumference = 2π × 18 ≈ 113.097
        var offset = 113.097 - (pct / 100) * 113.097;
        occArc.setAttribute('stroke-dashoffset', offset.toFixed(2));
    }

    if (occValue) {
        updateOccRing(occValue.textContent);
        new MutationObserver(function () {
            updateOccRing(occValue.textContent);
        }).observe(occValue, { childList: true, characterData: true, subtree: true });
    }

    // -------- Room cell micro-interaction --------
    document.querySelectorAll('.room-cell:not(.small)').forEach(function (cell) {
        cell.addEventListener('click', function () {
            cell.animate(
                [{ transform: 'translateY(-1px)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(-1px)' }],
                { duration: 280, easing: 'ease-out' }
            );
        });
    });
})();
