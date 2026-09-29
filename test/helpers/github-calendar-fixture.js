// 造一段和 GitHub「/users/<login>/contributions」返回内容同构的 HTML，给贡献图相关的测试用。
// 标记照着真实页面抄：标题 <h2>、按星期分行的 <td class="ContributionCalendar-day">（带 data-date /
// data-level / id）、每格对应的 <tool-tip for="...">，以及没有 data-date 的图例方块。

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ordinal(day) {
    if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
    return `${day}${{ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th'}`;
}

function levelFor(count) {
    if (count === 0) return 0;
    if (count < 5) return 1;
    if (count < 10) return 2;
    if (count < 20) return 3;
    return 4;
}

function tooltipText(count, date) {
    const [, month, day] = date.split('-').map(Number);
    const when = `${MONTH_NAMES[month - 1]} ${ordinal(day)}`;
    if (count === 0) return `No contributions on ${when}.`;
    return `${count.toLocaleString('en-US')} ${count === 1 ? 'contribution' : 'contributions'} on ${when}.`;
}

function allDates(year) {
    const dates = [];
    for (let time = Date.UTC(year, 0, 1); new Date(time).getUTCFullYear() === year; time += 86400000) {
        dates.push(new Date(time).toISOString().slice(0, 10));
    }
    return dates;
}

// options.counts: { 'YYYY-MM-DD': 贡献数 }，没列出的日子都是 0。
// options.attributeOrder: 'date-id-level'（GitHub 现在的顺序）或 'level-first'（验证解析不依赖属性顺序）。
function buildCalendarHtml(options = {}) {
    const year = options.year ?? 2026;
    const counts = options.counts ?? { [`${year}-01-05`]: 3, [`${year}-03-14`]: 12, [`${year}-09-21`]: 54 };
    const dates = allDates(year);
    const total = options.headerTotal ?? dates.reduce((sum, date) => sum + (counts[date] || 0), 0);

    // 和 GitHub 一样按行（周日、周一…周六）输出，而不是按日期顺序，顺便验证解析后会重新排序。
    const rows = Array.from({ length: 7 }, () => []);
    for (const date of dates) rows[new Date(`${date}T00:00:00Z`).getUTCDay()].push(date);

    const cell = (date, index) => {
        const count = counts[date] || 0;
        const id = `contribution-day-component-${new Date(`${date}T00:00:00Z`).getUTCDay()}-${index + 1}`;
        const level = levelFor(count);
        const attributes = options.attributeOrder === 'level-first'
            ? `data-level="${level}" id="${id}" class="ContributionCalendar-day" data-date="${date}" role="gridcell"`
            : `tabindex="0" data-ix="${index + 1}" aria-selected="false" style="width: 11px" data-date="${date}" id="${id}" data-level="${level}" role="gridcell" data-view-component="true" class="ContributionCalendar-day"`;
        const tooltip = options.omitTooltips
            ? ''
            : `<tool-tip style="pointer-events: none;" id="tooltip-${id}" for="${id}" popover="manual" data-direction="n" data-type="label" data-view-component="true" class="sr-only position-absolute">${tooltipText(count, date)}</tool-tip>`;
        return `<td ${attributes}></td>${tooltip}`;
    };

    const body = rows.map((row, rowIndex) => `<tr style="height: 11px"><td class="ContributionCalendar-label"><span class="sr-only">row ${rowIndex}</span></td>${row.map(cell).join('')}</tr>`).join('\n');
    // 真实页面里图例是 <div>；再混入一个 <td> 形式的，万一 GitHub 把图例换成表格单元格也不该被当成某一天。
    const legend = [0, 1, 2, 3, 4].map((level) => `<div style="width: 10px; height: 10px" id="contribution-graph-legend-level-${level}" data-level="${level}" class="ContributionCalendar-day rounded-1 mr-1"><span class="sr-only">legend ${level}</span></div>`).join('')
        + '<table><tr><td data-level="2" class="ContributionCalendar-day"></td></tr></table>';
    const heading = options.omitHeading
        ? ''
        : `<h2 tabindex="-1" id="js-contribution-activity-description" class="f4 text-normal mb-2">\n      ${total.toLocaleString('en-US')}\n      contributions\n        in ${year}\n    </h2>`;

    return `<div class="js-yearly-contributions">
${heading}
<table data-hydro-click="{&quot;event_type&quot;:&quot;user_profile.click&quot;,&quot;payload&quot;:{&quot;originating_url&quot;:&quot;https://github.com/users/cnYui/contributions?from=${year}-01-01&amp;to=${year}-12-31&quot;}}" role="grid" class="ContributionCalendar-grid js-calendar-graph-table">
<caption class="sr-only">Contribution Graph</caption>
<tbody>
${body}
</tbody>
</table>
<div>Less ${legend} More</div>
</div>`;
}

// 让测试里的 fetch 桩返回一段 HTML，并记录每次调用。
function createFetchStub(handler) {
    const calls = [];
    async function fetchStub(url, init) {
        calls.push({ url, init });
        const result = await handler(url, init, calls.length);
        if (result instanceof Error) throw result;
        return result;
    }
    fetchStub.calls = calls;
    return fetchStub;
}

function okResponse(html) {
    return { ok: true, status: 200, text: async () => html };
}

module.exports = { buildCalendarHtml, createFetchStub, okResponse, allDates };
