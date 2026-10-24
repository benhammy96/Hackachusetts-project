"use client";

import * as React from "react";
import * as Slider from "@radix-ui/react-slider";
import { Bar as RBar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ExternalLink } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Separator, StatusTag } from "./ui/primitives";
import { InfoDot } from "./ui/info";
import { estimate, sensitivity } from "@/lib/economics";
import { fmtMwh, fmtTonnes, fmtUsd, fmtUsdPerKwh } from "@/lib/format";

/**
 * Modelled operating cost and footprint. Every figure here is derived, so the
 * panel states its inputs inline and separates a measured price from a scenario
 * assumption (UI_DESIGN.md section 12).
 */
export function CostEstimate() {
  const { assumptions, scenario, setScenarioOverride, mw, cooling } = useAtlas();
  if (!assumptions || !scenario) return null;

  const band = sensitivity(scenario, assumptions);
  const central = band.central;
  const price = assumptions.electricity_price;
  const carbon = assumptions.grid_carbon;

  const chartData = [
    { name: "Low", usd: band.low.annualElectricityUsd },
    { name: "Central", usd: central.annualElectricityUsd },
    { name: "High", usd: band.high.annualElectricityUsd },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="overline">Modelled operating scenario</h4>
        <StatusTag status="modeled" />
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Metric
          label="Annual electricity"
          value={fmtUsd(central.annualElectricityUsd)}
          sub={`${fmtUsd(band.low.annualElectricityUsd)} – ${fmtUsd(band.high.annualElectricityUsd)}`}
        />
        <Metric label="Facility energy" value={fmtMwh(central.annualFacilityMwh)} sub={`at PUE ${scenario.pue.toFixed(2)}`} />
        <Metric
          label="Location-based CO2e"
          value={fmtTonnes(central.annualTco2e)}
          sub={`${carbon.value} kg/MWh, eGRID`}
        />
        <Metric
          label="Water draw"
          value={
            central.annualWaterLiters > 0
              ? `${central.annualWaterMillionGal.toFixed(0)}M gal`
              : "Negligible on site"
          }
          sub={
            cooling === "evaporative"
              ? `WUE ${scenario.wueLitersPerKwh} L/kWh`
              : "closed-loop / air design"
          }
        />
      </dl>

      <div className="h-[86px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: 0 }} layout="vertical">
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={50}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#657684", fontSize: 10 }}
            />
            <RBar dataKey="usd" radius={[0, 2, 2, 0]} barSize={14} isAnimationActive={false}>
              {chartData.map((d) => (
                <Cell key={d.name} fill={d.name === "Central" ? "#56C9D5" : "#2E4450"} />
              ))}
            </RBar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-subtle">
          Annual electricity spend, USD. Range spans PUE {band.pueRange[0]}–{band.pueRange[1]} and
          price ±20%.
        </p>
      </div>

      <Separator />

      <div className="space-y-2.5">
        <ScenarioSlider
          label="PUE"
          value={scenario.pue}
          min={1.05}
          max={1.8}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(pue) => setScenarioOverride({ pue })}
        />
        <ScenarioSlider
          label="Price"
          value={scenario.priceUsdPerKwh}
          min={0.05}
          max={0.4}
          step={0.005}
          format={(v) => fmtUsdPerKwh(v)}
          onChange={(priceUsdPerKwh) => setScenarioOverride({ priceUsdPerKwh })}
        />
        <ScenarioSlider
          label="Hours/yr"
          value={scenario.hours}
          min={4000}
          max={8760}
          step={120}
          format={(v) => v.toLocaleString("en-US")}
          onChange={(hours) => setScenarioOverride({ hours })}
        />
      </div>

      <div className="rounded-[6px] border border-line bg-raised/50 p-2">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="overline">Assumptions behind these figures</span>
          <InfoDot
            content={
              <>Changing a scenario input changes the derived figures above. It never changes a
              measured value in the evidence table.</>
            }
          />
        </div>
        <ul className="space-y-1 text-[10.5px] leading-snug text-subtle">
          <li>
            <span className="text-muted">IT load</span> {mw} MW, treated as IT load rather than
            total site demand, for {scenario.hours.toLocaleString("en-US")} h/yr.
          </li>
          <li>
            <span className="text-muted">Price</span> {fmtUsdPerKwh(price.value)} —{" "}
            {price.label}
            {price.period ? `, ${price.period}` : ""}.{" "}
            <a
              href={price.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-accent hover:underline"
            >
              {price.source}
              <ExternalLink size={8} aria-hidden />
            </a>
          </li>
          <li>
            <span className="text-muted">Carbon</span> {carbon.label}.{" "}
            <a
              href={carbon.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-accent hover:underline"
            >
              {carbon.source}
              <ExternalLink size={8} aria-hidden />
            </a>
          </li>
          <li className="text-warn/80">{price.caveat}</li>
          <li className="text-warn/80">{carbon.caveat}</li>
          <li>
            Build cost of {fmtUsd(estimate(scenario).constructionUsd)} at{" "}
            {fmtUsd(scenario.constructionUsdPerMw)}/MW is an illustrative placeholder for
            comparing sites, not a project estimate. Land and interconnection are excluded.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[6px] border border-line bg-raised/40 px-2 py-1.5">
      <dt className="overline truncate">{label}</dt>
      <dd className="num mt-0.5 text-[14px] font-semibold text-fg">{value}</dd>
      {sub && <dd className="truncate text-[10px] text-subtle">{sub}</dd>}
    </div>
  );
}

function ScenarioSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[54px] shrink-0 text-[11px] text-muted">{label}</span>
      <Slider.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
        className="relative flex h-4 min-w-0 flex-1 touch-none items-center"
      >
        <Slider.Track className="relative h-[3px] w-full grow rounded-full bg-[#1b2631]">
          <Slider.Range className="absolute h-full rounded-full bg-accent/70" />
        </Slider.Track>
        <Slider.Thumb className="block h-3 w-3 rounded-full border border-accent bg-panel focus-visible:outline-2 focus-visible:outline-accent" />
      </Slider.Root>
      <span className="num w-[60px] shrink-0 text-right text-[11px] text-fg">
        {format(value)}
      </span>
    </div>
  );
}
