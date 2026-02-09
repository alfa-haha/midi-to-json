const tools = [
  {
    id: "midi-to-json",
    name: { en: "MIDI → JSON", zh: "MIDI → JSON", de: "MIDI → JSON" },
    paths: { en: "/", zh: "/zh/", de: "/de/" },
    proBenefits: {
      en: [
        { strong: "Higher batch limits", detail: "Free: up to 20 files / 100MB. Pro: soft cap warning at 200 files / 1GB." },
        { strong: "Faster batch conversion", detail: "Up to 3 concurrent workers (vs 1 in Free)." },
        { strong: "Pro works site-wide", detail: "Once activated, Pro applies to every tool page." }
      ],
      zh: [
        { strong: "更高批量上限", detail: "Free：最多 20 个文件 / 100MB。Pro：超过 200 个文件 / 1GB 时给出软提示。" },
        { strong: "更快批量转换", detail: "最多 3 个并发 worker（Free 为 1）。" },
        { strong: "全站通用", detail: "激活后，全站所有工具页都能用 Pro。" }
      ],
      de: [
        { strong: "Higher batch limits", detail: "Free: up to 20 files / 100MB. Pro: soft cap warning at 200 files / 1GB." },
        { strong: "Faster batch conversion", detail: "Up to 3 concurrent workers (vs 1 in Free)." },
        { strong: "Pro works site-wide", detail: "Once activated, Pro applies to every tool page." }
      ]
    }
  },
  {
    id: "midi-to-csv",
    name: { en: "MIDI → CSV", zh: "MIDI → CSV", de: "MIDI → CSV" },
    paths: { en: "/midi-to-csv/", zh: "/zh/midi-to-csv/", de: "/de/midi-to-csv/" },
    proBenefits: {
      en: [
        { strong: "Higher batch limits", detail: "Free: up to 20 files / 100MB. Pro: soft cap warning at 200 files / 1GB." },
        { strong: "Faster batch conversion", detail: "Up to 3 concurrent workers (vs 1 in Free)." },
        { strong: "Pro batch helpers", detail: "Retry all failed + download report.json." }
      ],
      zh: [
        { strong: "更高批量上限", detail: "Free：最多 20 个文件 / 100MB。Pro：超过 200 个文件 / 1GB 时给出软提示。" },
        { strong: "更快批量转换", detail: "最多 3 个并发 worker（Free 为 1）。" },
        { strong: "批处理辅助（Pro）", detail: "一键重试失败 + 导出 report.json。" }
      ],
      de: [
        { strong: "Higher batch limits", detail: "Free: up to 20 files / 100MB. Pro: soft cap warning at 200 files / 1GB." },
        { strong: "Faster batch conversion", detail: "Up to 3 concurrent workers (vs 1 in Free)." },
        { strong: "Pro batch helpers", detail: "Retry all failed + download report.json." }
      ]
    }
  },
  {
    id: "midi-inspector",
    name: { en: "MIDI Inspector", zh: "MIDI Inspector", de: "MIDI Inspector" },
    paths: { en: "/midi-inspector/", zh: "/zh/midi-inspector/", de: "/de/midi-inspector/" },
    proBenefits: {
      en: [
        { strong: "Pro-only filters", detail: "Tick range + overlap/dangling/velocity0 flags." },
        { strong: "Pro exports", detail: "Unlock events.json and export filtered results." },
        { strong: "Handle larger files", detail: "Free export cap: 200k notes; Pro removes the cap." }
      ],
      zh: [
        { strong: "筛选（Pro）", detail: "Tick 区间 + overlap/dangling/velocity0 等标记。" },
        { strong: "导出（Pro）", detail: "解锁 events.json，并支持导出“过滤后的结果”。" },
        { strong: "支持更大文件", detail: "Free 导出上限：20 万 notes；Pro 解除上限。" }
      ],
      de: [
        { strong: "Pro-only filters", detail: "Tick range + overlap/dangling/velocity0 flags." },
        { strong: "Pro exports", detail: "Unlock events.json and export filtered results." },
        { strong: "Handle larger files", detail: "Free export cap: 200k notes; Pro removes the cap." }
      ]
    }
  }
];

const globalBenefits = {
  en: [
    { strong: "One purchase, unlock Pro across all MidiEasy tools.", detail: "" },
    { strong: "Local processing.", detail: "No uploads." },
    { strong: "Activate with checkout email.", detail: "No account." },
    { strong: "Up to 2 devices.", detail: "" }
  ],
  zh: [
    { strong: "一次购买，全站所有 MidiEasy 工具解锁 Pro。", detail: "" },
    { strong: "本地处理", detail: "无需上传。" },
    { strong: "用付款邮箱激活", detail: "无需账号。" },
    { strong: "最多 2 台设备", detail: "" }
  ],
  de: [
    { strong: "One purchase, unlock Pro across all MidiEasy tools.", detail: "" },
    { strong: "Local processing.", detail: "No uploads." },
    { strong: "Activate with checkout email.", detail: "No account." },
    { strong: "Up to 2 devices.", detail: "" }
  ]
};

const panelCopy = {
  en: {
    oneLiner: "One purchase unlocks Pro across all MidiEasy tools.",
    toolBenefitsTitle: "On this page",
    globalBenefitsTitle: "Also includes"
  },
  zh: {
    oneLiner: "一次购买，全站所有 MidiEasy 工具解锁 Pro。",
    toolBenefitsTitle: "本页立刻升级",
    globalBenefitsTitle: "同时包含"
  },
  de: {
    oneLiner: "One purchase unlocks Pro across all MidiEasy tools.",
    toolBenefitsTitle: "On this page",
    globalBenefitsTitle: "Also includes"
  }
};

function indexToolsById(items) {
  const map = {};
  for (const t of items) map[t.id] = t;
  return map;
}

module.exports = {
  version: 1,
  tools,
  toolById: indexToolsById(tools),
  globalBenefits,
  panel: panelCopy
};
