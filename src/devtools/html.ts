/** Routecraft DevTools 独立页面；页面数据经只读 JSON 接口加载。 */
export function createDevtoolsHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Routecraft DevTools</title>
    <style>
      :root{color-scheme:dark;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#101217;color:#e8eaf0}
      *{box-sizing:border-box}body{margin:0;min-width:720px}button,input{font:inherit}
      .top{height:72px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #292d37;background:#151820}
      .brand{display:flex;align-items:center;gap:12px}.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#a88bff,#54c8c3);display:grid;place-items:center;color:#101217;font-weight:900}
      h1{font-size:16px;margin:0}.sub{font-size:12px;color:#9299a8;margin-top:4px}.status{font-size:12px;padding:7px 11px;border-radius:999px;background:#20372f;color:#8ce0b2}
      .layout{display:grid;grid-template-columns:minmax(250px,340px) minmax(380px,1fr);height:calc(100vh - 72px)}
      aside{border-right:1px solid #292d37;overflow:auto;padding:18px 14px}.main{overflow:auto;padding:24px}
      .search{width:100%;background:#1a1e27;border:1px solid #343946;color:#e8eaf0;padding:10px 12px;border-radius:9px;outline:none}
      .tree{margin-top:16px}.tree ul{list-style:none;padding-left:15px;margin:5px 0}.tree button{display:flex;gap:8px;align-items:center;width:100%;border:0;background:transparent;color:#d7dbe5;text-align:left;padding:8px;border-radius:7px;cursor:pointer}
      .tree button:hover,.tree button[aria-current=true]{background:#242936}.kind{color:#81899b;font-size:11px;min-width:38px}.route-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .grid{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:12px;margin:18px 0 24px}.card,.panel{border:1px solid #2a2f3a;background:#151820;border-radius:12px;padding:16px}.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8e96a7}.value{font-size:20px;margin-top:8px}
      h2{font-size:15px;margin:0 0 14px}.details{display:grid;grid-template-columns:130px 1fr;gap:10px 14px;font-size:13px}.details .key{color:#9299a8}.details .val{overflow-wrap:anywhere}
      .modules{margin-top:18px;border-top:1px solid #292d37;padding-top:16px}.module{display:grid;grid-template-columns:145px 1fr 52px;gap:12px;padding:9px 0;font-size:12px;border-bottom:1px solid #242832}
      .badge{color:#bbaaff}.badge.eager{color:#74d8be}.diagnostics{margin-top:18px}.diagnostic{padding:12px;border:1px solid #37313a;background:#20191d;border-radius:9px;margin:8px 0;font-size:12px}.diagnostic.error{border-color:#75414a}.diagnostic.warning{border-color:#74623a}
      .muted{color:#9299a8;font-size:12px}.empty{padding:18px;color:#9299a8;text-align:center}.suggestion{color:#b9beca;margin-top:8px}
      @media(max-width:850px){.layout{grid-template-columns:260px minmax(360px,1fr)}.main{padding:16px}.grid{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <header class="top">
      <div class="brand"><div class="mark">R</div><div><h1>Routecraft DevTools</h1><div class="sub">文件路由编译结果与诊断</div></div></div>
      <div id="status" class="status">正在读取路由…</div>
    </header>
    <div class="layout">
      <aside>
        <input id="search" class="search" type="search" placeholder="筛选路径、ID 或文件…" aria-label="筛选路由" />
        <div id="tree" class="tree"></div>
      </aside>
      <main class="main">
        <div class="grid">
          <section class="card"><div class="label">路由数量</div><div id="count" class="value">—</div></section>
          <section class="card"><div class="label">诊断</div><div id="diagnostic-count" class="value">—</div></section>
          <section class="card"><div class="label">类型声明</div><div id="types" class="value" style="font-size:13px;overflow-wrap:anywhere">—</div></section>
        </div>
        <section class="panel"><h2>路由详情</h2><div id="detail" class="muted">从左侧选择路由查看来源和加载方式。</div></section>
        <section class="panel diagnostics"><h2>诊断</h2><div id="diagnostics"></div></section>
      </main>
    </div>
    <script type="module">
      import "virtual:routecraft/devtools-client";
      const state = { snapshot: null, selected: null };
      const byId = (id) => document.getElementById(id);
      const nodeLabel = (route) => route.kind === "index" ? route.path + " · index" : route.path || "(pathless)";
      function allRoutes(routes) { return routes.flatMap((route) => [route, ...allRoutes(route.children)]); }
      function renderTree() {
        const query = byId("search").value.toLowerCase();
        const make = (routes) => {
          const list = document.createElement("ul");
          for (const route of routes) {
            const matched = !query || [route.path, route.id, route.source, ...Object.values(route.modules).map((item) => item.file)].join(" ").toLowerCase().includes(query);
            const children = make(route.children);
            if (!matched && children.childElementCount === 0) continue;
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("aria-current", state.selected === route.id ? "true" : "false");
            const kind = document.createElement("span");
            kind.className = "kind";
            kind.textContent = route.kind;
            const path = document.createElement("span");
            path.className = "route-path";
            path.textContent = nodeLabel(route);
            button.append(kind, path);
            button.addEventListener("click", () => { state.selected = route.id; renderTree(); renderDetail(route); });
            item.append(button);
            if (children.childElementCount) item.append(children);
            list.append(item);
          }
          return list;
        };
        byId("tree").replaceChildren(make(state.snapshot?.routes ?? []));
      }
      function renderDetail(route) {
        const root = byId("detail");
        root.replaceChildren();
        const rows = [["ID", route.id], ["URL", route.path], ["来源目录", route.source], ["节点类型", route.kind], ["Middleware", route.middleware || "未配置"]];
        const grid = document.createElement("div");
        grid.className = "details";
        for (const [key, value] of rows) {
          const label = document.createElement("div"); label.className = "key"; label.textContent = key;
          const text = document.createElement("div"); text.className = "val"; text.textContent = value;
          grid.append(label, text);
        }
        root.append(grid);
        const modules = Object.entries(route.modules);
        if (modules.length) {
          const section = document.createElement("div"); section.className = "modules";
          for (const [name, data] of modules) {
            const row = document.createElement("div"); row.className = "module";
            for (const value of [name, data.file, data.loading]) {
              const cell = document.createElement("div"); cell.textContent = value;
              if (value === data.loading) cell.className = "badge " + data.loading;
              row.append(cell);
            }
            section.append(row);
          }
          root.append(section);
        }
      }
      function renderDiagnostics() {
        const container = byId("diagnostics");
        container.replaceChildren();
        const diagnostics = state.snapshot?.diagnostics ?? [];
        if (!diagnostics.length) {
          const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "没有诊断问题。";
          container.append(empty); return;
        }
        for (const item of diagnostics) {
          const card = document.createElement("div"); card.className = "diagnostic " + item.level;
          const title = document.createElement("strong"); title.textContent = item.code + " · " + item.level;
          const message = document.createElement("div"); message.textContent = item.message;
          card.append(title, message);
          if (item.file) { const file = document.createElement("div"); file.className = "muted"; file.textContent = item.file; card.append(file); }
          if (item.suggestion) { const suggestion = document.createElement("div"); suggestion.className = "suggestion"; suggestion.textContent = item.suggestion; card.append(suggestion); }
          container.append(card);
        }
      }
      async function load() {
        try {
          const response = await fetch("/__routecraft/data", { cache: "no-store" });
          state.snapshot = await response.json();
          byId("status").textContent = state.snapshot.status === "ready" ? "路由已编译" : "存在编译错误";
          byId("status").style.background = state.snapshot.status === "ready" ? "#20372f" : "#45272d";
          byId("status").style.color = state.snapshot.status === "ready" ? "#8ce0b2" : "#ff9aa6";
          byId("count").textContent = String(state.snapshot.routeCount);
          byId("diagnostic-count").textContent = String(state.snapshot.diagnostics.length);
          byId("types").textContent = state.snapshot.typesFile;
          renderTree();
          renderDiagnostics();
          const selected = allRoutes(state.snapshot.routes).find((route) => route.id === state.selected);
          if (selected) renderDetail(selected);
        } catch (error) {
          byId("status").textContent = "无法读取路由数据";
          byId("detail").textContent = String(error);
        }
      }
      byId("search").addEventListener("input", renderTree);
      window.addEventListener("routecraft:update", load);
      load();
    </script>
  </body>
</html>`;
}
