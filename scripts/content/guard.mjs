// scripts/content/guard.mjs — 防旁路「硬门槛」清单（工程级单一声明处）
// 校验器据此断言：断掉所有锁后，这些线索不可达、这些结局的所需线索集无法集齐。
// 新增硬核谜题/结局时，只需在此登记，校验器即强制其保持「必须解题才可达」。

// 真结局的 9 条核心线索（跨保险箱+机房+灯塔顶层）——【锁门控】：断锁后必须图不可达
export const CORE_CLUES = [
  'doc_experiment', 'doc_subsidy', 'surv_port', 'transcript_tape', 'doc_ship_manifest',
  'diary_shenyan2', 'doc_keeper_log', 'doc_raw_data', 'doc_weather_log',
];
// 隐藏 / ARG 结局在核心 9 条之上追加的线索
export const HIDDEN_EXTRA = ['clue_buoy', 'clue_undertow'];
export const ARG_EXTRA = ['clue_firstlight', 'clue_blackfin'];

// ---- 线索门控三型（校验器据此区分，避免误判旁路）----
// 1) 锁门控 lock：断锁后页面图不可达（CORE 9 条）。
// 2) 知识门控 knowledge：页面可达，但进入它的搜索词必须先解出前序谜题才得知（如 stillhere/undertow）。
//    这些仍受“高阶结局必需 CORE 9 条”间接守住。
export const KNOWLEDGE_GATED = new Set(['clue_buoy', 'clue_undertow']);
// 3) 动作/校验门控 action：线索不是普通节点，而由「改地址栏 hash」或「在谜题页输入正确答案」发出。
//    host=承载页；credit=发出的线索名。校验器据此确认可满足性并在 Stage2 检查 verify 是否已接线。
export const HASH_GATED = {
  clue_firstlight: { host: 'clue_frequency_note', value: '#firstlight' },
  clue_mem66: { host: 'node_memorial', value: '#sixtysix' },
};
// 需在 Stage2 通过「答案校验」机制发出的线索（solve-credit）。列出即视为「已规划接线」；
// 其中 clue_blackfin 修复了原版 ARG 结局点不亮的 bug（原全站无人记 clue_blackfin）。
export const SOLVER_CREDITED = {
  clue_blackfin: { host: 'clue_elements', answer: 'blackfin' },
};

// 必须保持「需解题」的受保护结局。gate='lock' 需有锁门控缺口；gate='collection' 靠集齐一组线索。
export const PROTECTED_ENDINGS = {
  end_true: { gate: 'lock', extra: [] },
  end_secret: { gate: 'lock', extra: HIDDEN_EXTRA },
  end_signal: { gate: 'lock', extra: [...HIDDEN_EXTRA, ...ARG_EXTRA] },
  end_wall: { gate: 'collection', extra: [], coreFrom: 'victims' }, // 名字墙：14 份遗物/证言全收集
  end_reef: { gate: 'lock', extra: [], coreFrom: 'reef' }, // 深潮：需断锁缺口 + 集齐 6 份硬核卷宗
  end_goldear: { gate: 'collection', extra: [], coreFrom: 'gold' }, // 金耳朵：6 段修复完成（solve-credit）
  end_livewave: { gate: 'collection', extra: [], coreFrom: 'live' }, // 现场直播：真实时钟+双端+源码 ARG 线索
};

// 现场直播结局所需 ARG 机制线索（时间锁/双标签页/源码，均由机制发放）
export const LIVEWAVE_CLUES = ['clue_nightwatch', 'clue_twotabs', 'clue_hidden_recs'];

// 金耳朵结局所需的 6 段修复线索（由小游戏发放，非节点）
export const GOLD_CLUES = ['clue_mg_spectral', 'clue_mg_gate', 'clue_mg_align', 'clue_mg_dial', 'clue_mg_splice', 'clue_mg_eq'];

// 深潮结局所需的 6 份硬核卷宗线索（断锁后必须不可达，由 extra-guarded.json 同时登记）
export const REEF_CLUES = ['hr_polybius', 'hr_freq', 'hr_xor', 'hr_luhn', 'hr_df', 'hr_stego'];

// 名字墙所需的 14 份遗物/证言线索 id（若校验时从 chat 动态取到，则以动态为准）
export const WALL_CLUES = [
  'vic_shoe', 'vic_bunk', 'vic_ticket', 'vic_radio', 'vic_hairclip', 'vic_wage', 'vic_watch',
  'vic_photo', 'vic_song', 'vic_kid_diary', 'vic_bottle', 'vic_medal', 'vic_hairband', 'vic_urn',
];

// 阶段3 追加：硬核谜题新线索。由 gen-hardcore.mjs 写入 extra-guarded.json；此处合并纳入断锁门槛。
import { readJSON, exists } from '../lib/util.mjs';
let EXTRA_FILE = [];
try { if (exists('scripts/content/extra-guarded.json')) EXTRA_FILE = readJSON('scripts/content/extra-guarded.json').guarded || []; } catch (e) {}
export const EXTRA_GUARDED = EXTRA_FILE;
