(function () {
    const STORAGE_KEY = "LAEC_AdminSidebarCollapsed";
    const iconMap = {
        dashboard: "OV",
        register: "RP",
        students: "SD",
        results: "RS",
        "exam-center": "EX",
        "exam-mgt": "EX",
        "past-questions": "QA",
        admins: "AD",
        "ict-access": "IA",
        health: "SH"
    };

    function cleanText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    function titleFromTab(tab) {
        return cleanText(tab.textContent).toUpperCase();
    }

    function getTabId(tab) {
        const id = tab.id || "";
        return id.startsWith("tab-") ? id.slice(4) : "";
    }

    function moveNavToBody(nav) {
        if (nav.parentElement === document.body) return;
        document.body.insertBefore(nav, document.body.firstElementChild);
    }

    function enhanceSidebar() {
        const body = document.body;
        const nav = document.getElementById("mainNav");
        const tabsWrap = nav ? nav.querySelector(".nav-tabs") : null;
        if (!body || !nav || !tabsWrap || tabsWrap.dataset.sidebarEnhanced === "1") return;

        tabsWrap.dataset.sidebarEnhanced = "1";
        moveNavToBody(nav);

        body.classList.add("laec-sidebar-ready");
        if (localStorage.getItem(STORAGE_KEY) === "1") body.classList.add("laec-sidebar-collapsed");

        const brand = document.querySelector("header .brand");
        const sidebarHead = document.createElement("div");
        sidebarHead.className = "laec-sidebar-head";
        const logo = brand ? brand.querySelector("img") : null;
        const title = brand ? cleanText(brand.querySelector("span") ? brand.querySelector("span").textContent : brand.textContent) : "LAEC ADMIN";
        sidebarHead.innerHTML = [
            `<img src="${logo ? logo.getAttribute("src") : "/nicegene_logo.png"}" alt="LAEC">`,
            '<div class="laec-sidebar-title">',
            `<strong>${title || "LAEC ADMIN"}</strong>`,
            "<span>Navigation Console</span>",
            "</div>"
        ].join("");
        nav.insertBefore(sidebarHead, tabsWrap);

        Array.from(tabsWrap.querySelectorAll(":scope > .tab")).forEach(function (tab) {
            const tabId = getTabId(tab);
            tab.dataset.sidebarIcon = iconMap[tabId] || titleFromTab(tab).slice(0, 2) || "LA";
        });

        const currentToggle = window.toggleNav;
        window.toggleNav = function () {
            if (window.matchMedia("(max-width: 900px)").matches) {
                if (typeof currentToggle === "function") return currentToggle();
                nav.classList.toggle("open");
                return;
            }

            body.classList.toggle("laec-sidebar-collapsed");
            localStorage.setItem(STORAGE_KEY, body.classList.contains("laec-sidebar-collapsed") ? "1" : "0");
        };
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", enhanceSidebar);
    } else {
        enhanceSidebar();
    }
})();
