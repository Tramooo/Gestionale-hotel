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
    var movTabs = document.querySelectorAll('#movements-tabs .dash-tab');
    var movRows = document.querySelectorAll('#movements-list .movement-row');

    movTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var which = tab.dataset.tab;
            movTabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
            movRows.forEach(function (row) { row.hidden = (row.dataset.panel !== which); });
        });
    });

    // Update tab counts from real dashboard data when available
    function syncMovementTabCounts() {
        var arrivalRows   = document.querySelectorAll('#movements-list .movement-row[data-panel="arrivi"]').length;
        var departureRows = document.querySelectorAll('#movements-list .movement-row[data-panel="partenze"]').length;
        var counts = document.querySelectorAll('#movements-tabs .dash-tab-count');
        if (counts[0]) counts[0].textContent = arrivalRows;
        if (counts[1]) counts[1].textContent = departureRows;
    }

    syncMovementTabCounts();

    // -------- KPI data bridge --------
    // Copy values from the existing dashboard.js ID targets to the new KPI cards.
    // dashboard.js writes to #dash-arrivals-value / #dash-departures-value etc.
    // The subtitle <strong> elements already have those IDs; mirror them to the KPI figures.
    function mirrorKpiValue(sourceId, targetId) {
        var src = document.getElementById(sourceId);
        var tgt = document.getElementById(targetId);
        if (!src || !tgt) return;
        // initial copy
        tgt.textContent = src.textContent;
        // watch for changes via MutationObserver
        new MutationObserver(function () {
            tgt.textContent = src.textContent;
        }).observe(src, { childList: true, characterData: true, subtree: true });
    }

    // Subtitle strong elements (#dash-arrivals-value, #dash-departures-value) are populated by
    // dashboard.js; mirror those values into the large KPI figures.
    mirrorKpiValue('dash-arrivals-value',   'dash-arrivals-kpi');
    mirrorKpiValue('dash-departures-value', 'dash-departures-kpi');
    // dash-inhouse-value is directly on the KPI figure — no mirror needed.

    // Occupancy ring — update arc when dash-occupancy-value changes
    var occValue = document.getElementById('dash-occupancy-value');
    var occArc   = document.getElementById('dash-occ-arc');

    function updateOccRing(text) {
        if (!occArc || !text) return;
        var pct = parseInt(text, 10);
        if (isNaN(pct)) return;
        // circumference = 2π × 18 ≈ 113.097
        var circumference = 113.097;
        var offset = circumference - (pct / 100) * circumference;
        occArc.setAttribute('stroke-dashoffset', offset.toFixed(2));
    }

    if (occValue) {
        updateOccRing(occValue.textContent);
        new MutationObserver(function () {
            updateOccRing(occValue.textContent);
        }).observe(occValue, { childList: true, characterData: true, subtree: true });
    }

    // Tasks count badge
    function updateTasksCount() {
        var list = document.getElementById('tasks-list');
        var badge = document.getElementById('dash-tasks-count');
        if (!list || !badge) return;
        var open = list.querySelectorAll('.task-item:not(.task-done)').length;
        badge.textContent = open;
    }

    // -------- Tasks panel interactivity --------
    var tasksList = document.getElementById('tasks-list');
    var addBtn    = document.getElementById('tasks-add-btn');
    var addText   = document.getElementById('tasks-add-text');
    var addTime   = document.getElementById('tasks-add-time');
    var addType   = document.getElementById('tasks-add-type');

    // Default time to current hour:minute
    if (addTime) {
        var n = new Date();
        addTime.value = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
    }

    var typeLabels  = { activity: 'Attività', maintenance: 'Camera', appointment: 'Tecnico' };
    var typeClasses = { activity: 'tag-activity', maintenance: 'tag-maintenance', appointment: 'tag-appointment' };

    var checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';

    function toggleTask(item) {
        var isDone = item.classList.toggle('task-done');
        var btn = item.querySelector('.task-check');
        if (isDone) {
            btn.classList.add('task-check-done');
            btn.setAttribute('aria-label', 'Completata');
            btn.innerHTML = checkSvg;
        } else {
            btn.classList.remove('task-check-done');
            btn.setAttribute('aria-label', 'Segna completata');
            btn.innerHTML = '';
        }
        updateTasksCount();
    }

    // Wire existing task checkboxes
    if (tasksList) {
        tasksList.querySelectorAll('.task-check').forEach(function (btn) {
            btn.addEventListener('click', function () { toggleTask(btn.closest('.task-item')); });
        });
    }

    updateTasksCount();

    function addTask() {
        var text = addText && addText.value.trim();
        if (!text || !tasksList) return;
        var time = addTime ? addTime.value : '';
        var type = addType ? addType.value : 'activity';

        var li = document.createElement('li');
        li.className = 'task-item';
        li.dataset.type = type;
        li.innerHTML = [
            '<button class="task-check" aria-label="Segna completata" type="button"></button>',
            '<div class="task-body">',
            '  <span class="task-desc">' + text.replace(/</g, '&lt;') + '</span>',
            '  <div class="task-meta">',
            '    <span class="task-tag ' + typeClasses[type] + '">' + typeLabels[type] + '</span>',
            time ? '    <span class="task-time">' + time + '</span>' : '',
            '  </div>',
            '</div>'
        ].join('');

        li.querySelector('.task-check').addEventListener('click', function () { toggleTask(li); });
        tasksList.insertBefore(li, tasksList.firstChild);
        li.animate(
            [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 200, easing: 'ease-out' }
        );
        if (addText) addText.value = '';
        updateTasksCount();
    }

    if (addBtn)  addBtn.addEventListener('click', addTask);
    if (addText) addText.addEventListener('keydown', function (e) { if (e.key === 'Enter') addTask(); });

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
