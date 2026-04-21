import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { TemperatureMethod, VitalRecord } from '../data/vitals';
import './styles/TemperatureChart.scss';

type TemperatureChartProps = {
  records: VitalRecord[];
};

type HoverState = {
  x: number;
  y: number;
  record: VitalRecord;
};

const margin = { top: 42, right: 82, bottom: 92, left: 76 };
const minTemp = 35;
const maxTemp = 42;
const minPulse = 40;
const maxPulse = 180;

const methodMeta: Record<TemperatureMethod, { label: string; className: string; symbol: d3.SymbolType }> = {
  oral: { label: '口腔', className: 'oral', symbol: d3.symbolCircle },
  axillary: { label: '腋下', className: 'axillary', symbol: d3.symbolSquare },
  rectal: { label: '直肠', className: 'rectal', symbol: d3.symbolTriangle },
};

const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
});

function recordLabel(record: VitalRecord) {
  return `${dayFormatter.format(record.datetime)} ${record.time}:00`.replace(':00:00', ':00');
}

export function TemperatureChart({ records }: TemperatureChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1120);
  const [hover, setHover] = useState<HoverState | null>(null);

  const height = width < 760 ? 560 : 650;

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => a.datetime.getTime() - b.datetime.getTime()),
    [records],
  );

  useEffect(() => {
    if (!wrapRef.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(760, Math.floor(entry.contentRect.width)));
    });

    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || sortedRecords.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img');

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xScale = d3
      .scalePoint<Date>()
      .domain(sortedRecords.map((item) => item.datetime))
      .range([0, innerWidth])
      .padding(0.35);

    const tempScale = d3.scaleLinear().domain([minTemp, maxTemp]).range([innerHeight, 0]);
    const pulseScale = d3.scaleLinear().domain([minPulse, maxPulse]).range([innerHeight, 0]);

    const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const tempTicks = d3.range(minTemp, maxTemp + 0.1, 0.5);
    const dailyGroups = d3.groups(sortedRecords, (item) => item.dayLabel);

    chart
      .selectAll('.temp-zone')
      .data([
        { className: 'zone-cool', y0: 35, y1: 36, label: '偏低' },
        { className: 'zone-normal', y0: 36, y1: 37.3, label: '正常' },
        { className: 'zone-low-fever', y0: 37.3, y1: 38, label: '低热' },
        { className: 'zone-high-fever', y0: 38, y1: 42, label: '高热' },
      ])
      .join('g')
      .attr('class', 'temp-zone')
      .each(function renderZone(zone) {
        const node = d3.select(this);
        node
          .append('rect')
          .attr('class', zone.className)
          .attr('x', 0)
          .attr('y', tempScale(zone.y1))
          .attr('width', innerWidth)
          .attr('height', tempScale(zone.y0) - tempScale(zone.y1));
        node
          .append('text')
          .attr('x', 10)
          .attr('y', tempScale((zone.y0 + zone.y1) / 2) + 4)
          .text(zone.label);
      });

    chart
      .selectAll('.temp-grid-line')
      .data(tempTicks)
      .join('line')
      .attr('class', (tick) => (Number.isInteger(tick) ? 'grid-line strong' : 'grid-line'))
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (tick) => tempScale(tick))
      .attr('y2', (tick) => tempScale(tick));

    chart
      .selectAll('.time-grid-line')
      .data(sortedRecords)
      .join('line')
      .attr('class', (_, index) => (index % 6 === 0 ? 'time-line day-start' : 'time-line'))
      .attr('x1', (item) => xScale(item.datetime) ?? 0)
      .attr('x2', (item) => xScale(item.datetime) ?? 0)
      .attr('y1', 0)
      .attr('y2', innerHeight);

    chart
      .append('line')
      .attr('class', 'reference-line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', tempScale(37))
      .attr('y2', tempScale(37));

    chart
      .append('text')
      .attr('class', 'reference-label')
      .attr('x', innerWidth - 58)
      .attr('y', tempScale(37) - 8)
      .text('37°C');

    const tempLine = d3
      .line<VitalRecord>()
      .defined((item) => item.temperature !== null)
      .x((item) => xScale(item.datetime) ?? 0)
      .y((item) => tempScale(item.temperature ?? minTemp))
      .curve(d3.curveMonotoneX);

    const pulseLine = d3
      .line<VitalRecord>()
      .defined((item) => item.pulse !== null)
      .x((item) => xScale(item.datetime) ?? 0)
      .y((item) => pulseScale(item.pulse ?? minPulse))
      .curve(d3.curveMonotoneX);

    chart
      .selectAll('.bp-bar')
      .data(sortedRecords.filter((item) => item.systolic !== null && item.diastolic !== null))
      .join('rect')
      .attr('class', 'bp-bar')
      .attr('x', (item) => (xScale(item.datetime) ?? 0) - 4)
      .attr('y', (item) => pulseScale(item.systolic ?? minPulse))
      .attr('width', 8)
      .attr('height', (item) => pulseScale(item.diastolic ?? minPulse) - pulseScale(item.systolic ?? minPulse))
      .attr('rx', 2);

    chart.append('path').datum(sortedRecords).attr('class', 'vital-line temp-line').attr('d', tempLine);
    chart.append('path').datum(sortedRecords).attr('class', 'vital-line pulse-line').attr('d', pulseLine);

    chart
      .selectAll('.temp-point')
      .data(sortedRecords.filter((item) => item.temperature !== null))
      .join('path')
      .attr('class', (item) => `chart-point temp-point ${methodMeta[item.temperatureMethod].className}`)
      .attr('d', (item) => d3.symbol().type(methodMeta[item.temperatureMethod].symbol).size(72)())
      .attr('transform', (item) => `translate(${xScale(item.datetime) ?? 0},${tempScale(item.temperature ?? minTemp)})`);

    chart
      .selectAll('.pulse-point')
      .data(sortedRecords.filter((item) => item.pulse !== null))
      .join('circle')
      .attr('class', 'chart-point pulse-point')
      .attr('cx', (item) => xScale(item.datetime) ?? 0)
      .attr('cy', (item) => pulseScale(item.pulse ?? minPulse))
      .attr('r', 3.5);

    const eventRows = sortedRecords.filter((item) => item.event);

    chart
      .selectAll('.event-marker')
      .data(eventRows)
      .join('g')
      .attr('class', 'event-marker')
      .attr('transform', (item) => `translate(${xScale(item.datetime) ?? 0},${tempScale(41.5)})`)
      .each(function renderEvent(item) {
        const node = d3.select(this);
        node.append('path').attr('d', 'M0,-10 L8,7 L-8,7 Z');
        node.append('text').attr('y', -16).text(item.event ?? '');
      });

    const yAxis = d3
      .axisLeft(tempScale)
      .tickValues(d3.range(minTemp, maxTemp + 1, 1))
      .tickFormat((tick) => `${tick}°`);

    const pulseAxis = d3.axisRight(pulseScale).tickValues(d3.range(40, 181, 20));

    chart.append('g').attr('class', 'axis y-axis').call(yAxis);
    chart.append('g').attr('class', 'axis pulse-axis').attr('transform', `translate(${innerWidth},0)`).call(pulseAxis);

    chart.append('text').attr('class', 'axis-title temp-title').attr('x', -54).attr('y', -18).text('体温 °C');
    chart
      .append('text')
      .attr('class', 'axis-title pulse-title')
      .attr('x', innerWidth - 18)
      .attr('y', -18)
      .text('脉搏/血压');

    const bottomAxis = chart.append('g').attr('class', 'bottom-table').attr('transform', `translate(0,${innerHeight})`);

    bottomAxis
      .selectAll('.time-label')
      .data(sortedRecords)
      .join('text')
      .attr('class', 'time-label')
      .attr('x', (item) => xScale(item.datetime) ?? 0)
      .attr('y', 32)
      .text((item) => item.timeLabel);

    bottomAxis
      .selectAll('.day-label')
      .data(dailyGroups)
      .join('text')
      .attr('class', 'day-label')
      .attr('x', ([, items]) => d3.mean(items, (item) => xScale(item.datetime) ?? 0) ?? 0)
      .attr('y', 64)
      .text(([day]) => day);

    bottomAxis.append('text').attr('class', 'row-label').attr('x', -58).attr('y', 32).text('时间');
    bottomAxis.append('text').attr('class', 'row-label').attr('x', -58).attr('y', 64).text('日期');

    chart
      .selectAll('.hover-target')
      .data(sortedRecords)
      .join('rect')
      .attr('class', 'hover-target')
      .attr('x', (item) => (xScale(item.datetime) ?? 0) - Math.max(7, innerWidth / sortedRecords.length / 2))
      .attr('y', 0)
      .attr('width', Math.max(14, innerWidth / sortedRecords.length))
      .attr('height', innerHeight)
      .on('mouseenter focus', (event, item) => {
        const pointer = d3.pointer(event, svgRef.current);
        setHover({ x: pointer[0], y: pointer[1], record: item });
      })
      .on('mousemove', (event, item) => {
        const pointer = d3.pointer(event, svgRef.current);
        setHover({ x: pointer[0], y: pointer[1], record: item });
      })
      .on('mouseleave blur', () => setHover(null));
  }, [height, sortedRecords, width]);

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg ref={svgRef} className="temperature-svg" aria-label="10天住院患者体温、脉搏、血压趋势图" />
      {hover ? (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(hover.x + 18, width - 236),
            top: Math.max(hover.y - 28, 14),
          }}
        >
          <strong>{recordLabel(hover.record)}</strong>
          <span>
            体温：{hover.record.temperature ?? '-'} °C（{methodMeta[hover.record.temperatureMethod].label}）
          </span>
          <span>脉搏：{hover.record.pulse ?? '-'} 次/分</span>
          <span>
            血压：{hover.record.systolic ?? '-'}/{hover.record.diastolic ?? '-'} mmHg
          </span>
          {hover.record.event ? <em>{hover.record.event}</em> : null}
        </div>
      ) : null}
    </div>
  );
}
