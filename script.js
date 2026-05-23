const width = 1280;
const height = 680;
const margin = { top: 34, right: 46, bottom: 64, left: 72 };

const svg = d3.select("#chart").attr("viewBox", [0, 0, width, height]);
const tooltip = d3.select("#tooltip");
const playBtn = d3.select("#playBtn");
const slider = d3.select("#yearSlider");
const yearWatermark = d3.select("#yearWatermark");
const yearLabelTop = d3.select("#yearLabelTop");
const regionSelect = d3.select("#regionSelect");
const searchInput = d3.select("#searchInput");
const legend = d3.select("#legend");

const fmtMoney = d3.format("$,.0f");
const fmtPop = d3.format(",.0f");
const fmtLife = d3.format(".1f");

const premiumColors = new Map([
  ["Sub-Saharan Africa", "#2563eb"],
  ["South Asia", "#f97316"],
  ["Middle East & North Africa", "#10b981"],
  ["America", "#ef4444"],
  ["Europe & Central Asia", "#8b5cf6"],
  ["East Asia & Pacific", "#a16207"],
]);

const defs = svg.append("defs");
const filter = defs
  .append("filter")
  .attr("id", "softShadow")
  .attr("x", "-40%")
  .attr("y", "-40%")
  .attr("width", "180%")
  .attr("height", "180%");
filter
  .append("feDropShadow")
  .attr("dx", 0)
  .attr("dy", 10)
  .attr("stdDeviation", 9)
  .attr("flood-color", "#0f172a")
  .attr("flood-opacity", 0.18);

function gradientId(region) {
  return "grad-" + region.replace(/[^a-z0-9]/gi, "-");
}
function parseSeries(series) {
  return series.map(([year, value]) => [new Date(Date.UTC(year, 0, 1)), value]);
}
const bisectDate = d3.bisector(([date]) => date).left;
function valueAt(values, date) {
  const i = bisectDate(values, date, 0, values.length - 1);
  const a = values[i];
  if (i > 0) {
    const b = values[i - 1];
    const t = (date - a[0]) / (b[0] - a[0]);
    return a[1] * (1 - t) + b[1] * t;
  }
  return a[1];
}

Promise.all([d3.json("nations.json")]).then(([raw]) => {
  const data = raw.map(
    ({ name, region, income, population, lifeExpectancy }) => ({
      name,
      region,
      income: parseSeries(income),
      population: parseSeries(population),
      lifeExpectancy: parseSeries(lifeExpectancy),
    }),
  );

  const regions = [...new Set(data.map((d) => d.region))];
  d3.select("#countryCount").text(data.length);
  regionSelect
    .selectAll("option.region")
    .data(regions)
    .join("option")
    .attr("class", "region")
    .attr("value", (d) => d)
    .text((d) => d);

  regions.forEach((region) => {
    const base = premiumColors.get(region) || "#64748b";
    const grad = defs
      .append("radialGradient")
      .attr("id", gradientId(region))
      .attr("cx", "32%")
      .attr("cy", "28%")
      .attr("r", "70%");
    grad
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#ffffff")
      .attr("stop-opacity", 0.95);
    grad
      .append("stop")
      .attr("offset", "18%")
      .attr("stop-color", d3.color(base).brighter(1.15));
    grad.append("stop").attr("offset", "62%").attr("stop-color", base);
    grad
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d3.color(base).darker(0.9));
  });

  legend
    .selectAll(".legend-item")
    .data(regions)
    .join("button")
    .attr("class", "legend-item")
    .html(
      (d) =>
        `<span class="legend-dot" style="background:${premiumColors.get(d)}"></span>${d}`,
    )
    .on("click", (_, d) => {
      regionSelect.property(
        "value",
        regionSelect.property("value") === d ? "All" : d,
      );
      update();
    });

  const interval = d3.utcMonth;
  const start = d3.min(data, (d) =>
    d3.min(
      [d.income[0], d.population[0], d.lifeExpectancy[0]],
      ([date]) => date,
    ),
  );
  const end = d3.min(data, (d) =>
    d3.max(
      [d.income.at(-1), d.population.at(-1), d.lifeExpectancy.at(-1)],
      ([date]) => date,
    ),
  );
  const dates = interval.range(start, end);
  slider.attr("max", dates.length - 1);
  d3.select("#startYear").text(start.getUTCFullYear());
  d3.select("#endYear").text(end.getUTCFullYear());

  const x = d3
    .scaleLog()
    .domain([200, 100000])
    .range([margin.left, width - margin.right]);
  const y = d3
    .scaleLinear()
    .domain([14, 86])
    .range([height - margin.bottom, margin.top]);
  const radius = d3
    .scaleSqrt()
    .domain([0, 5e8])
    .range([2, width / 23]);

  svg
    .append("g")
    .attr("class", "grid")
    .call((g) =>
      g
        .selectAll("line.x")
        .data(x.ticks())
        .join("line")
        .attr("x1", (d) => x(d))
        .attr("x2", (d) => x(d))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom),
    )
    .call((g) =>
      g
        .selectAll("line.y")
        .data(y.ticks())
        .join("line")
        .attr("y1", (d) => y(d))
        .attr("y2", (d) => y(d))
        .attr("x1", margin.left)
        .attr("x2", width - margin.right),
    );

  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(10, ","))
    .call((g) => g.select(".domain").remove());
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .call((g) => g.select(".domain").remove());
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", width - margin.right)
    .attr("y", height - 18)
    .attr("text-anchor", "end")
    .text("Income per person, log scale →");
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left)
    .attr("y", 18)
    .text("↑ Life expectancy, years");

  const bubbleLayer = svg.append("g");
  const labelLayer = svg.append("g");
  let dateIndex = 0;
  let playing = false;
  let timer = null;

  function dataAt(date) {
    return data
      .map((d) => ({
        name: d.name,
        region: d.region,
        income: valueAt(d.income, date),
        population: valueAt(d.population, date),
        lifeExpectancy: valueAt(d.lifeExpectancy, date),
      }))
      .filter(
        (d) =>
          Number.isFinite(d.income) &&
          Number.isFinite(d.population) &&
          Number.isFinite(d.lifeExpectancy),
      );
  }

  function activeData() {
    const region = regionSelect.property("value");
    const query = searchInput.property("value").trim().toLowerCase();
    return dataAt(dates[dateIndex]).filter(
      (d) =>
        (region === "All" || d.region === region) &&
        (!query || d.name.toLowerCase().includes(query)),
    );
  }

  function update() {
    const currentYear = dates[dateIndex].getUTCFullYear();
    yearWatermark.text(currentYear);
    yearLabelTop.text(currentYear);
    slider.property("value", dateIndex);
    const visible = activeData().sort((a, b) =>
      d3.descending(a.population, b.population),
    );

    bubbleLayer
      .selectAll("circle")
      .data(visible, (d) => d.name)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "bubble")
            .attr("cx", (d) => x(d.income))
            .attr("cy", (d) => y(d.lifeExpectancy))
            .attr("r", 0)
            .attr("fill", (d) => `url(#${gradientId(d.region)})`)
            .attr("stroke", "rgba(255,255,255,.92)")
            .attr("stroke-width", 1.8)
            .attr("filter", "url(#softShadow)")
            .on("mousemove", (event, d) => showTip(event, d))
            .on("mouseleave", hideTip)
            .transition()
            .duration(500)
            .ease(d3.easeCubicOut)
            .attr("r", (d) => radius(d.population)),
        (update) =>
          update
            .transition()
            .duration(85)
            .ease(d3.easeLinear)
            .attr("cx", (d) => x(d.income))
            .attr("cy", (d) => y(d.lifeExpectancy))
            .attr("r", (d) => radius(d.population)),
        (exit) => exit.transition().duration(250).attr("r", 0).remove(),
      );

    const topLabels = visible.slice(-8).concat(visible.slice(0, 3));
    labelLayer
      .selectAll("text")
      .data(topLabels, (d) => d.name)
      .join(
        (enter) =>
          enter
            .append("text")
            .attr("class", "country-label")
            .attr("opacity", 0)
            .text((d) => d.name),
        (update) => update,
        (exit) => exit.transition().duration(150).attr("opacity", 0).remove(),
      )
      .transition()
      .duration(90)
      .attr("opacity", 0.88)
      .attr("x", (d) => x(d.income) + radius(d.population) + 6)
      .attr("y", (d) => y(d.lifeExpectancy) + 4);
  }

  function showTip(event, d) {
    tooltip
      .style("opacity", 1)
      .attr("aria-hidden", "false")
      .style("left", `${event.clientX}px`)
      .style("top", `${event.clientY}px`).html(`
      <strong>${d.name}</strong>
      <div><span>Region</span><b>${d.region}</b></div>
      <div><span>Income</span><b>${fmtMoney(d.income)}</b></div>
      <div><span>Life exp.</span><b>${fmtLife(d.lifeExpectancy)} yrs</b></div>
      <div><span>Population</span><b>${fmtPop(d.population)}</b></div>
    `);
  }
  function hideTip() {
    tooltip.style("opacity", 0).attr("aria-hidden", "true");
  }

  function play() {
    playing = true;
    playBtn.text("Ⅱ Pause");

    timer = d3.interval(() => {
      // Skip multiple frames each tick
      dateIndex = (dateIndex + 4) % dates.length;

      update();
    }, 16); // ~60fps smooth animation
  }
  function pause() {
    playing = false;
    playBtn.text("▶ Play");
    if (timer) timer.stop();
  }

  playBtn.on("click", () => (playing ? pause() : play()));
  slider.on("input", function () {
    pause();
    dateIndex = +this.value;
    update();
  });
  regionSelect.on("change", update);
  searchInput.on("input", update);
  update();
});
