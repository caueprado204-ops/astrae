"""
ASTRAE — Série diária de óbitos de um município a partir do SIM (DATASUS).

STATUS: roteiro preparado, AINDA NÃO EXECUTADO pela equipe. Revise a saída antes de usar.

O SIM não tem API: os dados são arquivos DBC por UF e ano. Este roteiro usa o PySUS
(https://pysus.readthedocs.io/en/latest/databases/SIM.html), que baixa esses arquivos e os converte,
e gera SOMENTE contagens diárias agregadas — nenhum registro individual é salvo.

Uso:
    pip install pysus pandas
    python scripts/datasus/sim_daily_municipio.py --uf SP --municipio 350950 --anos 2015-2023 --saida data/sim_campinas.csv

--municipio usa o código de 6 dígitos (o SIM registra o município de residência sem o dígito verificador;
Campinas = 3509502 no IBGE → 350950 no SIM).
"""
import argparse, json, sys
from datetime import datetime, timezone

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uf", required=True)
    ap.add_argument("--municipio", required=True, help="código de 6 dígitos (residência)")
    ap.add_argument("--anos", required=True, help="ex.: 2015-2023")
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()

    import pandas as pd
    from pysus.ftp.databases.sim import SIM  # interface documentada no PySUS

    y0, y1 = (int(x) for x in a.anos.split("-"))
    sim = SIM().load()
    files = sim.get_files("CID10", uf=a.uf, year=list(range(y0, y1 + 1)))
    frames = []
    for f in files:
        df = f.download().to_dataframe()
        # nomes de colunas variam entre versões; detecta os campos necessários
        col = lambda *names: next((n for n in names if n in df.columns), None)
        c_date, c_mun, c_cause = col("DTOBITO", "DATAOBITO"), col("CODMUNRES"), col("CAUSABAS")
        if not (c_date and c_mun and c_cause):
            sys.exit(f"Colunas esperadas não encontradas em {f}: {list(df.columns)[:30]}")
        d = df[df[c_mun].astype(str).str[:6] == a.municipio][[c_date, c_cause]].copy()
        d["date"] = pd.to_datetime(d[c_date].astype(str).str.zfill(8), format="%d%m%Y", errors="coerce")
        d["cause"] = d[c_cause].astype(str).str.upper()
        frames.append(d[["date", "cause"]])
    if not frames:
        sys.exit("Nenhum arquivo encontrado para os parâmetros informados.")
    d = pd.concat(frames)
    invalid = int(d["date"].isna().sum())
    d = d.dropna(subset=["date"])
    out = pd.DataFrame({
        "obitos_total": d.groupby("date").size(),
        "obitos_circulatorio_I00_I99": d[d["cause"].str.startswith("I")].groupby("date").size(),
        "obitos_respiratorio_J00_J99": d[d["cause"].str.startswith("J")].groupby("date").size(),
    })
    full = pd.date_range(f"{y0}-01-01", f"{y1}-12-31", freq="D")
    out = out.reindex(full).fillna(0).astype(int)  # dia sem registro = 0 óbitos
    out.index.name = "data"
    meta = {
        "source": "DATASUS — Sistema de Informações sobre Mortalidade (SIM)", "kind": "OBSERVED",
        "access": "PySUS SIM().get_files('CID10', uf, year)", "municipio_residencia": a.municipio, "uf": a.uf,
        "periodo": a.anos, "gerado_em": datetime.now(timezone.utc).isoformat(), "datas_invalidas_descartadas": invalid,
        "nota": "Contagens por data do óbito e município de residência. Anos recentes podem ser preliminares.",
    }
    with open(a.saida, "w", encoding="utf-8") as fh:
        for k, v in meta.items():
            fh.write(f"# {k}: {v}\n")
        out.to_csv(fh)
    json.dump(meta, open(a.saida + ".meta.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"OK: {len(out)} dias, {int(out['obitos_total'].sum())} óbitos → {a.saida}")

if __name__ == "__main__":
    main()
