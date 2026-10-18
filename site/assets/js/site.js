(function () {
  const ROOT = document.documentElement.dataset.root || ".";

  const PAGES = [
    { href: "index.html", id: "home", label: "Главная" },
    { href: "equipment/index.html", id: "equipment", label: "Оборудование" },
    { href: "software/index.html", id: "software", label: "Программы" },
    { href: "about/index.html", id: "about", label: "О компании" },
    { href: "news/index.html", id: "news", label: "Новости" },
  ];

  function path(rel) {
    return ROOT.replace(/\/$/, "") + "/" + rel.replace(/^\.\//, "");
  }

  function logoSvg() {
    return `<svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#121218"/>
      <path d="M32 12 L48 48 H38.5 L35.2 39.2 H28.8 L25.5 48 H16 L32 12Z" fill="#3d9eff"/>
      <circle cx="32" cy="44" r="2.5" fill="#2ec4b6"/>
    </svg>`;
  }

  function mountShell() {
    const page = document.body.dataset.page || "home";
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (!header || !footer) return;

    const links = PAGES.map((p) => {
      const active = p.id === page ? " is-active" : "";
      return `<a class="item${active}" href="${path(p.href)}">${p.label}</a>`;
    }).join("");

    header.innerHTML = `
      <div class="draft-bar">Черновик для проверки. На engineering-fpv.ru ещё не выкладывали.</div>
      <div class="wrap nav">
        <a class="brand" href="${path("index.html")}">
          ${logoSvg()}
          <span>Engineering FPV<small>engineering-fpv.ru</small></span>
        </a>
        <button class="nav-toggle" type="button" aria-label="Меню" data-nav-toggle>Меню</button>
        <nav class="nav-links" data-nav-links>${links}</nav>
        <a class="btn btn-primary" href="${path("software/index.html")}">Программы</a>
      </div>`;

    footer.innerHTML = `
      <div class="wrap footer-inner">
        <span>Engineering FPV · Aether</span>
        <div class="footer-links">
          <a href="${path("equipment/index.html")}">Оборудование</a>
          <a href="${path("software/index.html")}">Программы</a>
          <a href="${path("news/index.html")}">Новости</a>
          <a href="${path("about/index.html")}">О компании</a>
        </div>
      </div>`;

    const toggle = header.querySelector("[data-nav-toggle]");
    const nav = header.querySelector("[data-nav-links]");
    if (toggle && nav) {
      toggle.addEventListener("click", () => nav.classList.toggle("is-open"));
    }
  }

  async function loadJson(rel) {
    const res = await fetch(path(rel));
    if (!res.ok) throw new Error("Не удалось загрузить " + rel);
    return res.json();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCatalog(items, options = {}) {
    const target = document.querySelector(options.target || "[data-catalog]");
    if (!target) return;
    if (!items.length) {
      target.innerHTML = `<div class="empty">${escapeHtml(options.empty || "Пока пусто — добавьте записи в data/*.json")}</div>`;
      return;
    }
    target.innerHTML = items
      .map((item) => {
        const tag = item.tag || options.defaultTag || "запись";
        const price = item.price ? `<div class="price">${escapeHtml(item.price)}</div>` : "";
        const status = item.status ? `<span class="badge">${escapeHtml(item.status)}</span>` : "";
        const body = `
          <div class="tag">${escapeHtml(tag)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.summary || "")}</p>
          ${price}${status}`;
        if (item.link) {
          return `<a class="card" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${body}</a>`;
        }
        return `<article class="card">${body}</article>`;
      })
      .join("");
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function renderNewsList(items) {
    const target = document.querySelector("[data-news-list]");
    if (!target) return;
    if (!items.length) {
      target.innerHTML = `<div class="empty">Новостей пока нет. Добавьте записи в data/news.json</div>`;
      return;
    }
    target.innerHTML = items
      .map((item) => {
        const href = path(`news/post.html?id=${encodeURIComponent(item.id)}`);
        return `<a class="news-item" href="${href}">
          <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.summary || "")}</p>
          </div>
        </a>`;
      })
      .join("");
  }

  function renderNewsPost(items) {
    const target = document.querySelector("[data-news-post]");
    if (!target) return;
    const id = new URLSearchParams(location.search).get("id");
    const item = items.find((n) => n.id === id) || items[0];
    if (!item) {
      target.innerHTML = `<div class="empty">Новость не найдена.</div>`;
      return;
    }
    document.title = `${item.title} — Engineering FPV`;
    const paragraphs = (item.body || "")
      .split(/\n\s*\n/)
      .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
      .join("");
    target.innerHTML = `
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
      <h1>${escapeHtml(item.title)}</h1>
      <div class="body">${paragraphs}</div>
      <p style="margin-top:28px"><a class="btn btn-ghost" href="${path("news/index.html")}">Все новости</a></p>`;
  }

  async function boot() {
    mountShell();
    const loaders = [];
    if (document.querySelector("[data-catalog='equipment']")) {
      loaders.push(
        loadJson("data/equipment.json").then((data) =>
          renderCatalog(data.items || [], { target: "[data-catalog='equipment']", defaultTag: "оборудование" })
        )
      );
    }
    if (document.querySelector("[data-catalog='software']")) {
      loaders.push(
        loadJson("data/software.json").then((data) =>
          renderCatalog(data.items || [], { target: "[data-catalog='software']", defaultTag: "программа" })
        )
      );
    }
    if (document.querySelector("[data-news-list]") || document.querySelector("[data-news-post]")) {
      loaders.push(
        loadJson("data/news.json").then((data) => {
          const items = (data.items || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
          if (document.querySelector("[data-news-list]")) renderNewsList(items);
          if (document.querySelector("[data-news-post]")) renderNewsPost(items);
        })
      );
    }
    if (document.querySelector("[data-home-news]")) {
      loaders.push(
        loadJson("data/news.json").then((data) => {
          const items = (data.items || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
          const target = document.querySelector("[data-home-news]");
          if (!items.length) {
            target.innerHTML = `<div class="empty">Скоро появятся новости.</div>`;
            return;
          }
          target.innerHTML = items
            .map((item) => {
              const href = path(`news/post.html?id=${encodeURIComponent(item.id)}`);
              return `<a class="news-item" href="${href}">
                <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.summary || "")}</p>
                </div>
              </a>`;
            })
            .join("");
        })
      );
    }
    await Promise.all(loaders);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
