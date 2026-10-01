"use client";

import { useId } from "react";

export type AudienceValue = { audienceType: "ALL" | "UNIT" | "DEPARTMENT" | "GROUP" | "USER"; audienceId: string | null }[];

/**
 * Seletor de público-alvo (§64) compartilhado por Publicações, Agenda, Documentos e Links.
 * Regra (decisão da Fase 6): OU dentro de cada lista, E entre unidades e departamentos.
 * É só interface: o servidor revalida e filtra com audienceFilter.
 */
export function AudiencePicker({
  value,
  onChange,
  units,
  departments,
  disabled,
  legend = "Público-alvo",
}: {
  value: AudienceValue;
  onChange: (value: AudienceValue) => void;
  units: string[];
  departments: string[];
  disabled?: boolean;
  legend?: string;
}) {
  const name = useId();
  const segmented = !value.some((a) => a.audienceType === "ALL");
  const toggle = (audienceType: "UNIT" | "DEPARTMENT", audienceId: string, on: boolean) => {
    const rest = value.filter((a) => !(a.audienceType === audienceType && a.audienceId === audienceId));
    onChange(on ? [...rest, { audienceType, audienceId }] : rest);
  };

  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
      <legend className="px-1 text-lg font-extrabold text-brand-ink">{legend}</legend>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-800">
        <label className="flex items-center gap-2">
          <input type="radio" name={name} checked={!segmented} onChange={() => onChange([{ audienceType: "ALL", audienceId: null }])} />
          Toda a empresa
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={name} checked={segmented} onChange={() => onChange([])} />
          Unidades e departamentos
        </label>
      </div>
      {segmented ? (
        <div className="grid gap-4 md:grid-cols-2">
          <AudienceList title="Unidades" values={units} type="UNIT" selected={value} onToggle={toggle} />
          <AudienceList title="Departamentos" values={departments} type="DEPARTMENT" selected={value} onToggle={toggle} />
          <p className="text-xs font-semibold text-slate-600 md:col-span-2">
            Dentro de cada lista vale qualquer item marcado. Marcando unidades e departamentos, a pessoa precisa estar nos dois (ex.: só o Almoxarifado da Fazenda
            Progresso).
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}

function AudienceList({
  title,
  values,
  type,
  selected,
  onToggle,
}: {
  title: string;
  values: string[];
  type: "UNIT" | "DEPARTMENT";
  selected: AudienceValue;
  onToggle: (type: "UNIT" | "DEPARTMENT", value: string, on: boolean) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-3">
      <legend className="px-1 text-sm font-bold text-brand-ink">{title}</legend>
      {values.length === 0 ? (
        <p className="text-sm text-slate-600">Nenhum valor cadastrado. Faça a carga de colaboradores primeiro.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {values.map((v) => (
            <li key={v}>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" checked={selected.some((a) => a.audienceType === type && a.audienceId === v)} onChange={(e) => onToggle(type, v, e.target.checked)} />
                {v}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
