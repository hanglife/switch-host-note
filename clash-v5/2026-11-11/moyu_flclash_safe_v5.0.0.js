/*
 * 墨鱼思路适配 · Safe V5.0.0 · 2026-11-11
 * 非墨鱼作者官方脚本。安装位置见本文件末尾的 main() 与随附说明。
 * 默认 stable：本地个性化规则 + 原订阅规则，不新增远程规则下载。
 * 可选 moyu-full：保留 V4 的 21 个远程规则集合；有联网/缓存依赖，非默认。
 * 保留节点、provider、原策略组；不修改 DNS/TUN/端口/模式/IPv6/证书校验。
 * 严格的结构/引用预检不等于 Mihomo 内核校验，更不能证明真实节点可用。
 * 脚本不访问网络/文件，不打印订阅内容或令牌，不用 eval / require。
 */

function moyuSafeV5(input, client) {
  "use strict";
  // ===== 可编辑选项：通常无需修改 =====
  var options = {
    ruleMode: "stable",             // "stable" 推荐；"moyu-full" 启用旧版远程规则
    preferredAiNode: "",
    repairMissingPROXY: true,        // 仅修复规则/策略组中不存在的字面量 PROXY
    hideOriginalGroups: false,      // 默认保留机场原分组的可见性
    enableAdBlock: false,           // 仅 moyu-full 可用；稳定版不增加广告下载
    blockChatGPTQUIC: false,        // 不默认封禁 UDP/QUIC
    directDomains: ["digital-xian.com", "cnwest.com", "seagm.com", "seagm-media.seagmcdn.com"],
    proxyDomains: [],               // 只写域名，不写 URL；走“全部节点”
    extraRules: []                  // 高级：完整 Mihomo 规则；目标必须真实存在
  };
  var revision = "5.0.0";
  var marker = "x-moyu-safe-v5";
  var ownedPrefix = "moyu_safe_v5_";
  var notices = [];
  var stats = { repairedPROXY: 0 };
  function object(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function dict() { return Object.create(null); }
  function fail(code, message) { throw new Error("[MOYU_V5:" + code + "] " + message); }
  function note(message) { if (notices.length < 12) notices.push(message); }
  function emit(message) {
    if (typeof console !== "undefined" && typeof console.log === "function") console.log(message);
  }
  function array(v, where) {
    if (v == null) return [];
    if (!Array.isArray(v)) fail("TYPE", where + " 必须是数组。请检查原订阅或其它覆写。");
    return v;
  }
  function map(v, where) {
    if (v == null) return {};
    if (!object(v)) fail("TYPE", where + " 必须是对象。");
    return v;
  }
  function name(v, where) {
    if (typeof v !== "string" || !v.trim() || /[\r\n\0]/.test(v)) fail("NAME", where + " 名称为空或含非法换行。");
    return v;
  }
  function unique(values) {
    var seen = dict();
    return values.filter(function (v) { if (has(seen, v)) return false; seen[v] = true; return true; });
  }
  function domains(values, where) {
    return array(values, where).map(function (d) {
      if (typeof d !== "string") fail("DOMAIN", where + " 必须仅包含域名字符串。");
      d = d.trim().toLowerCase();
      if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/.test(d)) {
        fail("DOMAIN", where + " 只接受域名，不接受协议、路径、端口、通配符或逗号。");
      }
      return d;
    });
  }
  if (!object(input)) fail("INPUT", "需绑定已有机场订阅；输入不是配置对象。");
  if (options.ruleMode !== "stable" && options.ruleMode !== "moyu-full") fail("OPTION", "ruleMode 只能为 stable / moyu-full。");
  if (input["x-moyu-verge-adapter"]) fail("OLD_V4", "检测到 V4 仍在上游执行。请清除旧脚本/覆写，只保留本订阅的 V5。");
  if (options.enableAdBlock && options.ruleMode !== "moyu-full") note("稳定版未启用远程广告集；enableAdBlock 仅在 moyu-full 生效。");
  // 所有修改发生在副本；任一检查失败，都不会留下半修改的输入。
  var c;
  try { c = JSON.parse(JSON.stringify(input)); }
  catch (e) { fail("JSON", "配置不是可序列化对象；未修改原输入。"); }
  var old = c[marker];
  var reapply = object(old) && old.family === "moyu-safe-v5";
  if (old != null && !reapply) fail("MARKER", "已有未知同名标记；请检查其它覆写。");
  var nodes = array(c.proxies, "proxies");
  var providers = map(c["proxy-providers"], "proxy-providers");
  var ruleProviders = map(c["rule-providers"], "rule-providers");
  var groups = array(c["proxy-groups"], "proxy-groups");
  var originalRules = array(c.rules, "rules");
  var subRules = map(c["sub-rules"], "sub-rules");
  var providerNames = Object.keys(providers);
  // 删除的是带有本脚本标记的自身产物，不靠模糊名称删除机场内容。
  if (reapply) {
    var previousNames = dict();
    array(old.groupNames, "V5.groupNames").forEach(function (n) { previousNames[n] = true; });
    groups = groups.filter(function (g) { return !(object(g) && has(previousNames, g.name)); });
    var previousPrefix = array(old.addedRules, "V5.addedRules");
    if (previousPrefix.some(function (r, i) { return originalRules[i] !== r; })) {
      fail("REAPPLY_CHANGED", "V5 前缀被其它脚本改写。请只保留一个扩展，并从原始订阅重新应用。");
    }
    originalRules = originalRules.slice(previousPrefix.length);
    if (old.appendedFinal) {
      if (originalRules[originalRules.length - 1] !== old.appendedFinal) fail("REAPPLY_CHANGED", "V5 兜底被其它脚本改写；请从原始订阅重新应用。");
      originalRules.pop();
    }
    array(old.ruleProviderNames, "V5.ruleProviderNames").forEach(function (n) { delete ruleProviders[n]; });
    delete c[marker];
    if (old.ruleMode === "moyu-full" && options.ruleMode === "stable") {
      fail("RELOAD_SOURCE", "从完整模式切回稳定模式，请重新应用原始订阅；不要把最终运行配置当作订阅原文。");
    }
  }
  if (!nodes.length && !providerNames.length) {
    emit("[MOYU_V5:SKIP_EMPTY] 没有节点或 provider；跳过增强，未创建占位节点。请先导入有效订阅。");
    return input;
  }
  var builtins = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "PASS-RULE", "COMPATIBLE", "GLOBAL"];
  var all = dict(), nodeByName = dict(), groupByName = dict();
  builtins.forEach(function (n) { all[n] = "builtin"; });
  var nonProxyTypes = ["direct", "reject", "reject-drop", "rejectdrop", "pass", "pass-rule", "passrule", "compatible", "dns"];
  var concrete = [];
  nodes.forEach(function (n, i) {
    if (!object(n)) fail("NODE", "proxies[" + i + "] 不是节点对象。");
    name(n.name, "proxies[" + i + "]");
    if (has(all, n.name)) fail("DUPLICATE", "节点重名/占用保留名：" + n.name);
    if (typeof n.type !== "string" || !n.type) fail("NODE_TYPE", "节点缺少 type：" + n.name);
    all[n.name] = "node"; nodeByName[n.name] = n;
    if (nonProxyTypes.indexOf(n.type.toLowerCase()) < 0) concrete.push(n.name);
  });
  groups.forEach(function (g, i) {
    if (!object(g)) fail("GROUP", "proxy-groups[" + i + "] 不是对象。");
    name(g.name, "proxy-groups[" + i + "]");
    if (has(all, g.name) && g.name !== "GLOBAL") fail("DUPLICATE", "节点/策略组重名：" + g.name);
    if (has(groupByName, g.name)) fail("DUPLICATE", "策略组重名：" + g.name);
    if (typeof g.type !== "string" || !g.type) fail("GROUP_TYPE", "策略组缺少 type：" + g.name);
    all[g.name] = "group"; groupByName[g.name] = g;
    if (options.hideOriginalGroups && g.name !== "GLOBAL") g.hidden = true;
  });
  if (!concrete.length && !providerNames.length) fail("NO_PROXY", "只有直连/拒绝出站，没有可供代理使用的节点。");
  providerNames.forEach(function (n) {
    name(n, "proxy-providers");
    var p = providers[n];
    if (!object(p)) fail("PROVIDER", "proxy-providers." + n + " 不是对象。");
    if (["http", "file", "inline"].indexOf(p.type) < 0) fail("PROVIDER_TYPE", "节点源类型不是 http/file/inline：" + n);
    if (p.type === "http" && (typeof p.url !== "string" || !/^https?:\/\//i.test(p.url))) fail("PROVIDER_URL", "HTTP 节点源缺少有效 URL：" + n);
    if (p.type === "file" && (typeof p.path !== "string" || !p.path)) fail("PROVIDER_PATH", "本地节点源缺少 path：" + n);
    if (p.type === "inline" && !Array.isArray(p.payload)) fail("PROVIDER_PAYLOAD", "inline 节点源缺少 payload 数组：" + n);
    if (typeof p.url === "string" && /^https?:\/\/(?:www\.)?t\.me\/ddgksf2021\.yaml(?:[?#/]|$)/i.test(p.url)) {
      fail("TEMPLATE", "发现墨鱼模板占位节点源；这不是机场订阅，请移除旧 YAML 覆写。");
    }
  });
  // 名称碰撞时分配新名称；从不覆盖机场同名节点/策略组。
  function allocate(base) {
    var n = base, i = 2;
    while (has(all, n) || has(providers, n)) { n = base + " #" + i; i++; }
    all[n] = "group";
    return n;
  }
  var G = {
    manual: allocate("🚀 墨鱼V5·全部节点"), ai: allocate("🤖 墨鱼V5·AI"),
    global: allocate("🌏 墨鱼V5·全球代理"), media: allocate("🎬 墨鱼V5·国际媒体"),
    google: allocate("🌌 墨鱼V5·谷歌服务"), telegram: allocate("📟 墨鱼V5·电报消息"),
    apple: allocate("🍎 墨鱼V5·苹果服务"), microsoft: allocate("🪟 墨鱼V5·微软服务"),
    bilibili: allocate("📺 墨鱼V5·哔哩哔哩"), game: allocate("🎮 墨鱼V5·游戏平台"),
    download: allocate("📥 墨鱼V5·下载分流"), fallback: allocate("🐟 墨鱼V5·兜底分流")
  };
  function selectable(n, first, preferred) {
    var choices = unique(first.concat(concrete));
    if (preferred && concrete.indexOf(preferred) >= 0) {
      choices = [preferred].concat(choices.filter(function (x) { return x !== preferred; }));
    }
    var g = { name: n, type: "select", "empty-fallback": "REJECT" };
    // provider-only 绝不把 REJECT 塞入 proxies；节点源展开后自然取真实节点。
    if (choices.length) g.proxies = choices;
    if (providerNames.length) g.use = providerNames.slice();
    if (preferred && concrete.indexOf(preferred) >= 0) g["default-selected"] = preferred;
    return g;
  }
  var generated = [selectable(G.manual, [], ""), selectable(G.ai, [], options.preferredAiNode)];
  ["global", "media", "google", "telegram", "fallback"].forEach(function (key) {
    generated.push(selectable(G[key], [G.manual, "DIRECT"], ""));
  });
  ["apple", "microsoft", "bilibili", "game", "download"].forEach(function (key) {
    generated.push(selectable(G[key], ["DIRECT", G.manual], ""));
  });
  generated.forEach(function (g) { groupByName[g.name] = g; });
  if (options.preferredAiNode && concrete.indexOf(options.preferredAiNode) < 0) {
    note("旧首选 AI 节点不在静态节点中；未写入失效 default-selected，请在 AI 组选择可用具体节点。");
  }
  function requireTarget(target, where, mayRepair) {
    name(target, where);
    if (has(all, target)) return target;
    if (target === "PROXY" && options.repairMissingPROXY && mayRepair) {
      stats.repairedPROXY++; return G.manual;
    }
    fail("MISSING_TARGET", where + " 引用不存在的目标：" + target + "。未擅自改为 DIRECT；请修复来源配置。");
  }
  function requireProvider(n, where) {
    if (!has(providers, n)) fail("MISSING_PROVIDER", where + " 引用了未定义的节点源：" + n);
  }
  // 筛选表达式属于内核语义（含 regexp2），不能用 JS 正则近似后误报循环。
  // 仍校验所有引用；只把确定存在的关系纳入脚本层循环检查。
  function dynamicSelection(g) { return !!(g.filter || g["exclude-filter"] || g["exclude-type"]); }
  // 检查组引用、节点链式拨号与 provider 下载出口。
  var edges = dict();
  Object.keys(groupByName).forEach(function (n) { edges[n] = []; });
  Object.keys(nodeByName).forEach(function (n) { edges[n] = []; });
  Object.keys(groupByName).forEach(function (n) {
    var g = groupByName[n];
    if (g.proxies != null) {
      g.proxies = unique(array(g.proxies, n + ".proxies").map(function (p) { return requireTarget(p, n + ".proxies", true); }));
      edges[n] = g.proxies.filter(function (p) {
        return all[p] === "group" || !(g["exclude-filter"] || g["exclude-type"]);
      });
    }
    array(g.use, n + ".use").forEach(function (p) { requireProvider(p, n + ".use"); });
    if ((g["include-all"] || g["include-all-proxies"]) && !dynamicSelection(g)) {
      edges[n] = edges[n].concat(Object.keys(nodeByName));
    }
    if (dynamicSelection(g)) note("含筛选表达式的动态节点依赖交由内核验证，脚本不据此臆测循环。");
    if (!array(g.proxies, n + ".proxies").length && !array(g.use, n + ".use").length && !g["include-all"] && !g["include-all-proxies"] && !g["include-all-providers"]) {
      fail("EMPTY_GROUP", "策略组没有候选节点/节点源：" + n);
    }
    if (g["empty-fallback"] != null) {
      var fallback = requireTarget(g["empty-fallback"], n + ".empty-fallback", false);
      if (all[fallback] === "group" || fallback === "GLOBAL") fail("FALLBACK_GROUP", "empty-fallback 只能填节点/内置出站，不能填策略组：" + n);
    }
  });
  Object.keys(nodeByName).forEach(function (n) {
    var p = nodeByName[n];
    if (p["dialer-proxy"]) edges[n].push(requireTarget(p["dialer-proxy"], n + ".dialer-proxy", false));
  });
  providerNames.forEach(function (n) {
    var p = providers[n];
    // 下载出口是启动依赖；不能凭空把缺失 PROXY 指向含自身的组。
    if (p.proxy) requireTarget(p.proxy, "节点源 " + n + ".proxy", false);
    var override = map(p.override, "节点源 " + n + ".override");
    if (override["dialer-proxy"]) {
      var target = requireTarget(override["dialer-proxy"], "节点源 " + n + ".override.dialer-proxy", false);
      Object.keys(groupByName).forEach(function (gn) {
        var g = groupByName[gn];
        if (!dynamicSelection(g) && (array(g.use, gn + ".use").indexOf(n) >= 0 || g["include-all"] || g["include-all-providers"])) edges[gn].push(target);
      });
    }
    if (p.type === "inline") array(p.payload, "节点源 " + n + ".payload").forEach(function (entry, i) {
      if (!object(entry) || !entry.name || !entry.type) fail("INLINE_NODE", "inline 节点条目缺失 name/type：" + n + "[" + i + "]");
      if (entry["dialer-proxy"]) {
        var t = requireTarget(entry["dialer-proxy"], "inline 节点 dialer-proxy", false);
        Object.keys(groupByName).forEach(function (gn) {
          var g = groupByName[gn];
          if (!dynamicSelection(g) && (array(g.use, gn + ".use").indexOf(n) >= 0 || g["include-all"] || g["include-all-providers"])) edges[gn].push(t);
        });
      }
    });
  });
  // 非递归 DFS：大型配置不因递归栈耗尽而崩溃。
  function checkCycles(graph, label) {
    var color = dict();
    Object.keys(graph).forEach(function (root) {
      if (color[root] === 2) return;
      var stack = [{ n: root, i: 0 }]; color[root] = 1;
      while (stack.length) {
        var frame = stack[stack.length - 1];
        var links = graph[frame.n] || [];
        if (frame.i >= links.length) { color[frame.n] = 2; stack.pop(); continue; }
        var next = links[frame.i++];
        if (!has(graph, next)) continue;
        if (color[next] === 1) fail("CYCLE", label + " 存在循环依赖，涉及：" + next);
        if (color[next] !== 2) { color[next] = 1; stack.push({ n: next, i: 0 }); }
      }
    });
  }
  checkCycles(edges, "节点/策略组");
  // 自定义规则优先；已知的共享字节域名沿用旧版，不额外扩展范围。
  var rules = [];
  function add(type, values, target) {
    values.forEach(function (v) { rules.push(type + "," + v + "," + target); });
  }
  var localRules = [
    "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
    "IP-CIDR6,fd7a:115c:a1e0::/48,DIRECT,no-resolve",
    "DOMAIN-SUFFIX,ts.net,DIRECT",
    "PROCESS-NAME,tailscaled.exe,DIRECT",
    "PROCESS-NAME,tailscale.exe,DIRECT",
    "PROCESS-NAME,tailscale-ipn.exe,DIRECT",
    "DOMAIN-SUFFIX,localhost,DIRECT",
    "DOMAIN-SUFFIX,local,DIRECT",
    "DOMAIN-SUFFIX,lan,DIRECT",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,169.254.0.0/16,DIRECT,no-resolve",
    "IP-CIDR6,::1/128,DIRECT,no-resolve",
    "IP-CIDR6,fc00::/7,DIRECT,no-resolve",
    "IP-CIDR6,fe80::/10,DIRECT,no-resolve"
  ];
  rules = rules.concat(localRules);
  add("DOMAIN-SUFFIX", domains(options.directDomains, "directDomains"), "DIRECT");
  var feishuDomains = [
    "feishu.cn", "feishu.net", "feishucdn.com", "feishuimg.com",
    "feishuapp.cn", "getfeishu.cn", "feishupkg.com",
    "feishu-3rd-party-services.com", "baseopendev.com", "larkoffice.com",
    "zjurl.cn", "snssdk.com", "pstatp.com", "byteimg.com",
    "bytedance.net", "bytedance.com", "byted-static.com",
    "bytegoofy.com", "bytehwm.com", "ttwebview.com", "bytegecko.com",
    "bytescm.com", "kundou.cn", "bytetos.com", "ibytedtos.com",
    "zijieapi.com", "byteeffecttos.com", "bytednsdoc.com",
    "bytedanceapi.com", "volcvideo.com", "bytevcloud.com", "feelgood.cn"
  ];
  add("DOMAIN-SUFFIX", feishuDomains, "DIRECT");
  add("PROCESS-NAME", ["Feishu.exe", "feishu.exe", "Lark.exe", "lark.exe"], "DIRECT");
  add("DOMAIN-SUFFIX", domains(options.proxyDomains, "proxyDomains"), G.global);
  array(options.extraRules, "extraRules").forEach(function (r) {
    if (typeof r === "string" && /^\s*(MATCH|FINAL)\s*,/i.test(r)) fail("EXTRA_MATCH", "extraRules 不得提前插入 MATCH/FINAL，以免吞掉后续所有规则。");
    rules.push(r);
  });
  var aiDomains = [
    "chatgpt.com", "openai.com", "oaistatic.com", "oaiusercontent.com", "oaistatsig.com",
    "claude.ai", "claude.com", "anthropic.com", "claudeusercontent.com", "grok.com", "x.ai"
  ];
  var chatgptExactDomains = [
    "challenges.cloudflare.com", "cdn.openaimerge.com",
    "cdn.workos.com", "forwarder.workos.com",
    "frontend-apps-multi-region.workos.com", "setup.workos.com",
    "images.workoscdn.com", "workos.imgix.net"
  ];
  // Gemini / Copilot 只加入明确域名，不把所有 Google/Microsoft 域名划入 AI。
  aiDomains = aiDomains.concat(["gemini.google.com", "aistudio.google.com", "generativelanguage.googleapis.com", "copilot.microsoft.com"]);
  if (options.blockChatGPTQUIC) {
    ["chatgpt.com", "openai.com", "oaistatic.com", "oaiusercontent.com", "oaistatsig.com"].forEach(function (d) {
      rules.push("AND,((NETWORK,UDP),(DST-PORT,443),(DOMAIN-SUFFIX," + d + ")),REJECT");
    });
  }
  add("DOMAIN", chatgptExactDomains, G.ai);
  add("DOMAIN-SUFFIX", aiDomains, G.ai);
  add("PROCESS-NAME", ["Codex.exe", "codex.exe"], G.ai);
  var ownedRuleProviders = [];
  if (options.ruleMode === "moyu-full") {
    var bmBase = "https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Clash/";
    var metaBase = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/";
    var specs = [
    ["openai", metaBase + "geosite/openai.list", "domain", "text", G.ai],
    ["anthropic", metaBase + "geosite/anthropic.list", "domain", "text", G.ai],
    ["gemini", metaBase + "geosite/google-gemini.list", "domain", "text", G.ai],
    ["xai", metaBase + "geosite/xai.list", "domain", "text", G.ai],
    ["biliintl", metaBase + "geosite/biliintl.list", "domain", "text", G.media],
    ["bilibili", bmBase + "BiliBili/BiliBili.yaml", "classical", "yaml", G.bilibili],
    ["bahamut", bmBase + "Bahamut/Bahamut.yaml", "classical", "yaml", G.media],
    ["media", bmBase + "GlobalMedia/GlobalMedia_Classical.yaml", "classical", "yaml", G.media],
    ["github", bmBase + "GitHub/GitHub.yaml", "classical", "yaml", G.global],
    ["telegram_domain", metaBase + "geosite/telegram.list", "domain", "text", G.telegram],
    ["telegram_ip", metaBase + "geoip/telegram.mrs", "ipcidr", "mrs", G.telegram],
    ["twitter", bmBase + "Twitter/Twitter.yaml", "classical", "yaml", G.global],
    ["google", bmBase + "Google/Google.yaml", "classical", "yaml", G.google],
    ["download", bmBase + "Download/Download.yaml", "classical", "yaml", G.download],
    ["apple", bmBase + "Apple/Apple_Classical.yaml", "classical", "yaml", G.apple],
    ["microsoft", bmBase + "Microsoft/Microsoft.yaml", "classical", "yaml", G.microsoft],
    ["game", bmBase + "Game/Game.yaml", "classical", "yaml", G.game],
    ["proxy", bmBase + "ProxyLite/ProxyLite.yaml", "classical", "yaml", G.global],
    ["direct", bmBase + "Direct/Direct.yaml", "classical", "yaml", "DIRECT"],
    ["cn_domain", metaBase + "geosite/cn.mrs", "domain", "mrs", "DIRECT"],
    ["cn_ip", metaBase + "geoip/cn.mrs", "ipcidr", "mrs", "DIRECT"]
  ];
    if (options.enableAdBlock) specs.splice(4, 0, ["ads", metaBase + "geosite/category-ads-all.mrs", "domain", "mrs", "REJECT"]);
    add("DOMAIN-SUFFIX", ["github.com", "githubusercontent.com", "githubassets.com"], G.global);
    specs.forEach(function (spec) {
      var id = ownedPrefix + spec[0];
      if (has(ruleProviders, id)) fail("PROVIDER_COLLISION", "规则集合重名：" + id);
      ruleProviders[id] = { type: "http", behavior: spec[2], format: spec[3], url: spec[1],
        path: "./ruleset/moyu-safe-v5/" + spec[0] + "." + (spec[3] === "text" ? "list" : spec[3]),
        interval: 86400, proxy: G.manual };
      ownedRuleProviders.push(id);
      if (spec[0] === "telegram_domain") add("PROCESS-NAME", ["Telegram.exe", "telegram-desktop"], G.telegram);
      rules.push("RULE-SET," + id + "," + spec[4] + (spec[2] === "classical" || spec[0] === "telegram_ip" ? ",no-resolve" : ""));
    });
    rules.push("MATCH," + G.fallback);
    note("moyu-full 已接管原订阅 rules；新增远程规则集合，网络失败仍可能影响初始化/更新。");
  } else {
    // 稳定版的本地分类是常见域名集合，并非 21 个远程集合的完整离线镜像。
    add("DOMAIN-SUFFIX", ["biliintl.com", "bilibili.tv", "bahamut.com.tw", "gamer.com.tw", "netflix.com", "netflix.net", "nflxvideo.net", "nflximg.net", "nflxso.net", "nflxext.com", "disneyplus.com", "dssott.com", "bamgrid.com", "youtube.com", "youtu.be", "ytimg.com", "googlevideo.com", "spotify.com", "scdn.co"], G.media);
    add("DOMAIN-SUFFIX", ["steamcontent.com", "steamserver.net", "download.windowsupdate.com", "dl.delivery.mp.microsoft.com", "swdownload.apple.com", "updates.cdn-apple.com"], G.download);
    add("DOMAIN-SUFFIX", ["bilibili.com", "biliapi.net", "biliapi.com", "bilivideo.com", "bilivideo.cn", "hdslb.com"], G.bilibili);
    add("DOMAIN-SUFFIX", ["telegram.org", "telegram.me", "t.me", "telegra.ph", "tdesktop.com"], G.telegram);
    add("PROCESS-NAME", ["Telegram.exe", "telegram-desktop"], G.telegram);
    add("DOMAIN-SUFFIX", ["github.com", "githubusercontent.com", "githubassets.com", "twitter.com", "x.com", "t.co", "twimg.com"], G.global);
    add("DOMAIN-SUFFIX", ["google.com", "googleapis.com", "gstatic.com", "googleusercontent.com", "gmail.com"], G.google);
    add("DOMAIN-SUFFIX", ["steampowered.com", "steamcommunity.com", "steamstatic.com", "epicgames.com", "playstation.com", "playstation.net", "sonyentertainmentnetwork.com", "xbox.com", "xboxlive.com", "ubisoft.com", "battle.net", "ea.com", "origin.com", "riotgames.com"], G.game);
    add("DOMAIN-SUFFIX", ["apple.com", "icloud.com", "icloud-content.com", "mzstatic.com", "apple-cloudkit.com"], G.apple);
    add("DOMAIN-SUFFIX", ["microsoft.com", "microsoftonline.com", "live.com", "outlook.com", "office.com", "office.net", "office365.com", "onedrive.com", "windows.com", "windowsupdate.com", "bing.com"], G.microsoft);
  }
  // 从右侧识别目标，避免把 AND/OR 条件内的逗号误当策略组分隔符。
  // 完整语法/正则/CIDR 合法性仍交由 Mihomo；这里不伪装成完整内核解析器。
  function parseRule(rule, where) {
    if (typeof rule !== "string" || !rule.trim()) fail("RULE", where + " 必须是非空规则字符串。");
    var parts = rule.split(",");
    var type = parts[0].trim().toUpperCase();
    var index = parts.length - 1;
    while (index > 0 && /^(no-resolve|src)$/i.test(parts[index].trim())) index--;
    if (index < (type === "MATCH" || type === "FINAL" ? 1 : 2)) fail("RULE", where + " 缺少条件或目标。");
    return { parts: parts, type: type, index: index, target: parts[index].trim() };
  }
  var subEdges = dict();
  Object.keys(subRules).forEach(function (n) { subEdges[n] = []; });
  function inspectRule(rule, where, subName) {
    var parsed = parseRule(rule, where), target = parsed.target;
    if (parsed.type === "SUB-RULE") {
      if (!has(subRules, target)) fail("MISSING_SUBRULE", where + " 引用未定义子规则：" + target);
      if (subName) subEdges[subName].push(target);
    } else {
      var resolved = requireTarget(target, where, true);
      if (resolved !== target) parsed.parts[parsed.index] = resolved;
    }
    if (parsed.type === "FINAL") parsed.parts[0] = "MATCH";
    if (parsed.type === "RULE-SET") {
      var id = parsed.parts[1].trim();
      if (!has(ruleProviders, id)) fail("MISSING_RULESET", where + " 引用未定义规则集：" + id);
    }
    // 逻辑条件中也可以嵌套 RULE-SET。
    if (/^(AND|OR|NOT|SUB-RULE)$/.test(parsed.type)) {
      var expression = /\(\s*RULE-SET\s*,\s*([^,()]+)/ig, hit;
      while ((hit = expression.exec(rule)) !== null) {
        if (!has(ruleProviders, hit[1].trim())) fail("MISSING_RULESET", where + " 内嵌未定义规则集：" + hit[1].trim());
      }
    }
    return parsed.parts.join(",");
  }
  var addedRules = rules.map(function (r, i) { return inspectRule(r, "新增 rules[" + i + "]", ""); });
  var retained = [], appendedFinal = "";
  if (options.ruleMode === "stable") {
    retained = originalRules.map(function (r, i) { return inspectRule(r, "订阅 rules[" + i + "]", ""); });
    var hasMatch = retained.some(function (r) { return /^\s*MATCH\s*,/i.test(r); });
    if (!hasMatch) {
      // 仅缺少兜底时补一个；有 MATCH 时完全保留其原有去向和顺序。
      appendedFinal = "MATCH," + G.fallback;
      retained.push(appendedFinal);
      note("原订阅缺少 MATCH；已补代理兜底。节点型订阅不等于完整国内分流配置。");
    }
  }
  Object.keys(subRules).forEach(function (n) {
    subRules[n] = array(subRules[n], "sub-rules." + n).map(function (r, i) { return inspectRule(r, "sub-rules." + n + "[" + i + "]", n); });
  });
  checkCycles(subEdges, "子规则");
  Object.keys(ruleProviders).forEach(function (n) {
    var p = ruleProviders[n];
    if (!object(p)) fail("RULESET", "rule-providers." + n + " 不是对象。");
    if (p.proxy) p.proxy = requireTarget(p.proxy, "规则源 " + n + ".proxy", true);
  });
  // 只对新前缀去重，不删掉原订阅重复规则或改变其顺序。
  var prefix = unique(addedRules.filter(function (r) { return options.ruleMode !== "stable" || !/^MATCH,/.test(r); }));
  c.rules = options.ruleMode === "stable" ? prefix.concat(retained) : unique(addedRules);
  c["proxy-groups"] = generated.concat(groups);
  if (c["rule-providers"] != null || ownedRuleProviders.length) c["rule-providers"] = ruleProviders;
  if (c["sub-rules"] != null) c["sub-rules"] = subRules;
  if (!c["find-process-mode"]) c["find-process-mode"] = "strict";
  c[marker] = { family: "moyu-safe-v5", revision: revision, ruleMode: options.ruleMode,
    groupNames: generated.map(function (g) { return g.name; }), addedRules: options.ruleMode === "stable" ? prefix : unique(addedRules), appendedFinal: appendedFinal,
    ruleProviderNames: ownedRuleProviders, groups: G };
  emit("[MOYU_V5:OK] " + revision + " / " + client + " / " + options.ruleMode +
    "; static=" + concrete.length + "; providers=" + providerNames.length +
    "; repairedPROXY=" + stats.repairedPROXY + "; rules=" + c.rules.length);
  notices.forEach(function (text) { emit("[MOYU_V5:NOTICE] " + text); });
  return c;
}

// 入口：只绑定到一个机场订阅；不要同时叠加旧脚本。
function main(config) {
  return moyuSafeV5(config, "flclash");
}
// END MOYU_SAFE_V5_0_0_FLCLASH