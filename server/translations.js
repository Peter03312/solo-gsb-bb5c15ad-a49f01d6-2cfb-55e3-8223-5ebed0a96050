'use strict';

// 双语译文与复核
//
// 约定：
//   - 译文是分支片段自身的属性（branch_segments.translation，空串=未翻译；
//     translation_reviewed=1 表示已复核）；
//   - 译文与「当前原文」绑定：原文改动后保留译文供参考，但复核状态清零（待复核）；
//     纯时码调整不影响复核状态；
//   - 空译文不能复核（不变量：reviewed=1 必有非空译文）；
//   - 拆分时两条都保留原译文作参考且待复核；合并时按原顺序拼接已有译文且待复核；
//     恢复原稿或整条重置后清空受影响译文；
//   - 双语 SRT 逐段输出原文和译文，沿用当前时码与连续编号；
//     任何空译文、待复核片段或时间线错误都列出片段并拒绝整份导出。
//
// 译文的录入/复核不推进片段 rev，因此不影响质检报告与豁免（质检仍按原文进行，
// 保持「现有质检行为不变」）。

const { validateTimeline, msToSrt } = require('./srt');

function hasTranslation(seg) {
  return typeof seg.translation === 'string' && seg.translation.trim() !== '';
}

function tc(ms) {
  return msToSrt(ms);
}

/**
 * 双语导出闸门：实时检查当前分支片段。
 * @param segments getBranchSegments() 结果（含 ord/start_ms/end_ms/translation/translation_reviewed）
 * @returns {{can_export:boolean, missing:Array, pending:Array, timeline_issues:Array}}
 */
function bilingualGate(segments) {
  const timeline_issues = validateTimeline(segments);

  const base = (s, message) => ({
    ord: s.ord,
    start_ms: s.start_ms,
    end_ms: s.end_ms,
    timecode: `${tc(s.start_ms)} --> ${tc(s.end_ms)}`,
    source_seqs: (s.source_seqs || []).slice(),
    text_excerpt: String(s.text || '').slice(0, 40),
    message
  });

  const missing = [];
  const pending = [];
  for (const s of segments) {
    if (!hasTranslation(s)) {
      missing.push(base(s, `片段 #${s.ord} 尚未录入译文，无法导出双语字幕`));
    } else if (!s.translation_reviewed) {
      pending.push(base(s, `片段 #${s.ord} 译文待复核，无法导出双语字幕`));
    }
  }

  return {
    can_export: missing.length === 0 && pending.length === 0 && timeline_issues.length === 0,
    missing,
    pending,
    timeline_issues
  };
}

/**
 * 分支译文汇总（供网页与 API 展示阻断原因/完成度）。
 */
function translationSummary(segments) {
  const gate = bilingualGate(segments);
  return {
    total: segments.length,
    translated: segments.filter(hasTranslation).length,
    reviewed: segments.filter((s) => hasTranslation(s) && s.translation_reviewed).length,
    ...gate
  };
}

module.exports = {
  hasTranslation,
  bilingualGate,
  translationSummary
};
