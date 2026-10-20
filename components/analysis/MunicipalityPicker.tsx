"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
interface Mun { id: string; name: string; uf: string }

/** Seleção UF → município pela API de Localidades do IBGE (código de 7 dígitos). */
export function MunicipalityPicker({ value, onChange, label = "Município" }: { value: { id: string; name: string; uf: string }; onChange: (m: Mun) => void; label?: string }) {
  const [uf, setUf] = useState(value.uf || "SP");
  const list = useApi<Mun[]>(`/api/ibge/municipios?uf=${uf}`);
  useEffect(() => { if (value.uf && value.uf !== uf) setUf(value.uf); }, [value.uf]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-[84px_1fr] gap-2">
      <label className="block"><span className="label">UF</span>
        <select className="input mt-1" value={uf} onChange={(e) => setUf(e.target.value)}>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
      </label>
      <label className="block"><span className="label">{label}</span>
        <select className="input mt-1" value={value.uf === uf ? value.id : ""} disabled={!list.data}
          onChange={(e) => { const m = list.data?.find((x) => x.id === e.target.value); if (m) onChange({ ...m, uf }); }}>
          {value.uf !== uf && <option value="">{list.state === "loading" ? "Carregando…" : "Escolha o município"}</option>}
          {list.state === "error" && <option value={value.id}>{value.name} (lista do IBGE indisponível)</option>}
          {list.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
    </div>
  );
}
