(function initUtils(global) {
    function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDateDisplay(dateStr, lang = 'it') {
        if (!dateStr) return '';
        const d = new Date(`${dateStr}T00:00:00`);
        const locale = lang === 'it' ? 'it-IT' : 'en-GB';
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function nightsBetween(checkin, checkout) {
        const d1 = new Date(checkin);
        const d2 = new Date(checkout);
        return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    }

    global.GroupStayUtils = {
        addDays,
        escapeHtml,
        formatDate,
        formatDateDisplay,
        generateId,
        nightsBetween
    };
})(window);
