import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  Search,
  Square,
  Upload
} from 'lucide-react';
import { CognitiveLevel } from '../../types';
import { COGNITIVE_LEVELS, TreeTopicGroup } from '../../utils/matrixCalculations';
import { stripVietnameseAccents } from '../../utils/yccdCsvParser';

interface TriStateCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  ariaLabel: string;
  className?: string;
}

const TriStateCheckbox: React.FC<TriStateCheckboxProps> = ({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  className = ''
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className={`w-4 h-4 rounded-sm accent-[#006BFF] cursor-pointer shrink-0 ${className}`}
    />
  );
};

const TOPIC_COLORS = [
  'bg-[#154380] border-[#154380]',
  'bg-[#0E7C7B] border-[#0E7C7B]',
  'bg-[#C85A17] border-[#C85A17]',
  'bg-[#6D1D8E] border-[#6D1D8E]',
  'bg-[#B91C1C] border-[#B91C1C]',
  'bg-[#047857] border-[#047857]',
  'bg-[#4338CA] border-[#4338CA]'
];

const LEVEL_BADGE_CLASS: Record<CognitiveLevel, string> = {
  know: 'bg-sky-100 text-sky-800 border-sky-200',
  understand: 'bg-amber-100 text-amber-800 border-amber-200',
  apply: 'bg-emerald-100 text-emerald-800 border-emerald-200'
};

interface YccdTreeSidebarProps {
  subject: string;
  grade: string;
  tree: TreeTopicGroup[];
  selectedKeys: Set<string>;
  expandedTopics: Record<string, boolean>;
  expandedUnits: Record<string, boolean>;
  onToggleTopicExpand: (topicId: string) => void;
  onToggleUnitExpand: (unitKey: string) => void;
  onToggleYccd: (stableKey: string) => void;
  onToggleUnit: (unitKey: string, allItemKeys: string[]) => void;
  onToggleTopic: (topicId: string, allItemKeys: string[]) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onCollapseSidebar: () => void;
  onOpenCsvImport: () => void;
}

export const YccdTreeSidebar: React.FC<YccdTreeSidebarProps> = ({
  subject,
  grade,
  tree,
  selectedKeys,
  expandedTopics,
  expandedUnits,
  onToggleTopicExpand,
  onToggleUnitExpand,
  onToggleYccd,
  onToggleUnit,
  onToggleTopic,
  onSelectAll,
  onClearAll,
  onCollapseSidebar,
  onOpenCsvImport
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTree = useMemo(() => {
    const q = stripVietnameseAccents(searchQuery);
    if (!q) return tree;

    const result: TreeTopicGroup[] = [];
    for (const topic of tree) {
      const topicMatch = stripVietnameseAccents(topic.topic).includes(q);
      const matchedUnits = topic.units
        .map(unit => {
          const unitMatch = stripVietnameseAccents(unit.unit).includes(q);
          if (topicMatch || unitMatch) return unit;

          const itemsByLevel: Record<CognitiveLevel, typeof unit.itemsByLevel.know> = {
            know: [],
            understand: [],
            apply: []
          };
          let anyMatch = false;
          for (const lvl of COGNITIVE_LEVELS) {
            itemsByLevel[lvl] = unit.itemsByLevel[lvl].filter(it => {
              const hay = `${it.sourceLabel} ${it.levelLabel} ${it.yccd} ${it.yccdId}`;
              return stripVietnameseAccents(hay).includes(q);
            });
            if (itemsByLevel[lvl].length > 0) anyMatch = true;
          }
          return anyMatch ? { ...unit, itemsByLevel } : null;
        })
        .filter((u): u is NonNullable<typeof u> => u !== null);

      if (matchedUnits.length > 0) {
        result.push({ ...topic, units: matchedUnits });
      }
    }
    return result;
  }, [tree, searchQuery]);

  const totalItems = useMemo(
    () =>
      tree.reduce(
        (sum, t) =>
          sum +
          t.units.reduce(
            (us, u) =>
              us + u.itemsByLevel.know.length + u.itemsByLevel.understand.length + u.itemsByLevel.apply.length,
            0
          ),
        0
      ),
    [tree]
  );

  const selectedCount = useMemo(() => {
    let count = 0;
    for (const t of tree) {
      for (const u of t.units) {
        for (const lvl of COGNITIVE_LEVELS) {
          for (const it of u.itemsByLevel[lvl]) {
            if (selectedKeys.has(it.stableKey)) count++;
          }
        }
      }
    }
    return count;
  }, [tree, selectedKeys]);

  return (
    <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-xs overflow-hidden flex flex-col max-h-[82vh]">
      {/* Header matching mockup */}
      <div className="bg-[#0D2B52] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
            <span>YÊU CẦU CẦN ĐẠT</span>
            <span className="text-[11px] font-semibold bg-white/15 px-1.5 py-0.5 rounded-sm">
              {selectedCount}/{totalItems}
            </span>
          </div>
          <div className="text-[11px] text-blue-200 truncate">
            {subject} • Khối {grade}
          </div>
        </div>

        <button
          type="button"
          onClick={onCollapseSidebar}
          className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
          title="Thu gọn cây Yêu cầu cần đạt"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
          <span>Thu gọn</span>
        </button>
      </div>

      {/* Search & quick controls */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/70 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm chủ đề, nội dung, YCCĐ, [NB]/[TH]/[VD]..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] px-0.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              disabled={totalItems === 0}
              className="text-[#006BFF] hover:underline font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <CheckSquare className="w-3 h-3" />
              <span>Chọn tất cả</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={onClearAll}
              disabled={selectedCount === 0}
              className="text-slate-600 hover:text-rose-600 hover:underline font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <Square className="w-3 h-3" />
              <span>Bỏ chọn</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenCsvImport}
            className="text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Nhập CSV</span>
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
        {totalItems === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 text-center space-y-2.5">
            <p className="text-xs font-bold text-amber-900">
              Chưa có dữ liệu YCCĐ cho {subject} – Khối {grade}
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Đang chờ nhập tệp CSV danh mục Yêu cầu cần đạt (11 cột chuẩn GDPT 2018) để lập cây ma trận cho môn học này.
            </p>
            <button
              type="button"
              onClick={onOpenCsvImport}
              className="w-full py-2 px-3 bg-[#006BFF] hover:bg-blue-600 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nhập tệp CSV YCCĐ ngay</span>
            </button>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            Không tìm thấy YCCĐ nào khớp với từ khóa "{searchQuery}".
          </div>
        ) : (
          filteredTree.map((topic, tIdx) => {
            const topicItemKeys = topic.units.flatMap(u =>
              COGNITIVE_LEVELS.flatMap(lvl => u.itemsByLevel[lvl].map(it => it.stableKey))
            );
            const topicSelectedCount = topicItemKeys.filter(k => selectedKeys.has(k)).length;
            const topicAllChecked = topicItemKeys.length > 0 && topicSelectedCount === topicItemKeys.length;
            const topicIndeterminate = topicSelectedCount > 0 && topicSelectedCount < topicItemKeys.length;
            const isTopicExpanded = searchQuery.trim() !== '' ? true : expandedTopics[topic.topicId] ?? false;
            const colorClass = TOPIC_COLORS[tIdx % TOPIC_COLORS.length];

            return (
              <div key={topic.topicId} className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                {/* Level 1: Topic Bar */}
                <div className={`${colorClass} text-white px-2.5 py-2 flex items-start gap-2`}>
                  <button
                    type="button"
                    onClick={() => onToggleTopicExpand(topic.topicId)}
                    className="p-0.5 hover:bg-white/20 rounded-sm mt-0.5 cursor-pointer shrink-0"
                    aria-label={isTopicExpanded ? 'Thu gọn chủ đề' : 'Mở chủ đề'}
                  >
                    {isTopicExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <TriStateCheckbox
                    checked={topicAllChecked}
                    indeterminate={topicIndeterminate}
                    onChange={() => onToggleTopic(topic.topicId, topicItemKeys)}
                    ariaLabel={`Chọn ${topic.topic}`}
                    className="mt-0.5 accent-white"
                  />

                  <button
                    type="button"
                    onClick={() => onToggleTopicExpand(topic.topicId)}
                    className="text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="text-xs font-bold leading-snug">{topic.topic}</div>
                    <div className="text-[10px] text-white/80 mt-0.5">
                      Đã chọn {topicSelectedCount}/{topicItemKeys.length} YCCĐ
                    </div>
                  </button>
                </div>

                {/* Level 2: Units */}
                {isTopicExpanded && (
                  <div className="p-2 bg-slate-50/60 space-y-2">
                    {topic.units.map(unit => {
                      const unitItemKeys = COGNITIVE_LEVELS.flatMap(lvl =>
                        unit.itemsByLevel[lvl].map(it => it.stableKey)
                      );
                      const unitSelectedCount = unitItemKeys.filter(k => selectedKeys.has(k)).length;
                      const unitAllChecked = unitItemKeys.length > 0 && unitSelectedCount === unitItemKeys.length;
                      const unitIndeterminate = unitSelectedCount > 0 && unitSelectedCount < unitItemKeys.length;
                      const isUnitExpanded =
                        searchQuery.trim() !== '' ? true : expandedUnits[unit.unitKey] ?? true;

                      const orderedItems = COGNITIVE_LEVELS.flatMap(lvl => unit.itemsByLevel[lvl]);

                      return (
                        <div
                          key={unit.unitKey}
                          className="rounded-lg border border-amber-300/80 bg-[#FFFBEB] overflow-hidden"
                        >
                          <div className="px-2.5 py-2 flex items-start gap-2 bg-amber-100/60 border-b border-amber-200/70">
                            <button
                              type="button"
                              onClick={() => onToggleUnitExpand(unit.unitKey)}
                              className="p-0.5 hover:bg-amber-200/60 rounded-sm mt-0.5 text-amber-900 cursor-pointer shrink-0"
                              aria-label={isUnitExpanded ? 'Thu gọn nội dung' : 'Mở nội dung'}
                            >
                              {isUnitExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <TriStateCheckbox
                              checked={unitAllChecked}
                              indeterminate={unitIndeterminate}
                              onChange={() => onToggleUnit(unit.unitKey, unitItemKeys)}
                              ariaLabel={`Chọn ${unit.unit}`}
                              className="mt-0.5"
                            />

                            <button
                              type="button"
                              onClick={() => onToggleUnitExpand(unit.unitKey)}
                              className="text-left text-xs font-bold text-[#082B52] leading-snug flex-1 cursor-pointer"
                            >
                              {unit.unit}
                            </button>
                          </div>

                          {/* Level 3: YCCĐ Items */}
                          {isUnitExpanded && (
                            <div className="bg-white divide-y divide-slate-100 px-2 py-1">
                              {orderedItems.map(item => {
                                const isChecked = selectedKeys.has(item.stableKey);
                                return (
                                  <label
                                    key={item.stableKey}
                                    className="flex items-start gap-2 py-1.5 px-1 rounded-md hover:bg-blue-50/40 cursor-pointer text-[11px] leading-relaxed"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => onToggleYccd(item.stableKey)}
                                      className="w-3.5 h-3.5 mt-0.5 rounded-sm accent-[#006BFF] shrink-0 cursor-pointer"
                                    />
                                    <div className="flex-1 text-slate-700">
                                      <span
                                        className={`inline-block px-1.5 py-0.2 mr-1.5 rounded-sm border text-[10px] font-bold ${
                                          LEVEL_BADGE_CLASS[item.level]
                                        }`}
                                        title={item.levelLabel}
                                      >
                                        {item.sourceLabel}
                                      </span>
                                      <span className={isChecked ? 'text-slate-900 font-medium' : 'text-slate-600'}>
                                        {item.yccd}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
