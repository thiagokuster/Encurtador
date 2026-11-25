const GROUPS: Array<[string, string]> = [
  ["América do Norte", "US CA MX GL PM"],
  ["América Central e Caribe", "BZ CR SV GT HN NI PA CU DO HT JM TT BB BS AG DM GD KN LC VC AW CW SX BQ KY VG VI PR GP MQ BL MF TC MS AI"],
  ["América do Sul", "AR BO BR CL CO EC FK GY PY PE SR UY VE"],
  ["Europa", "AL AD AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA XK GI FO AX SJ"],
  ["África", "DZ AO BJ BW BF BI CM CV CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH"],
  ["Ásia", "AF AM AZ BH BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP KR OM PK PS PH QA SA SG LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO"],
  ["Oceania", "AU NZ FJ PG SB VU NC PF WS TO KI FM MH NR PW TV WF CK NU TK AS GU MP"],
];

const CONTINENT = new Map<string, string>();
for (const [name, codes] of GROUPS) {
  for (const code of codes.split(" ")) CONTINENT.set(code, name);
}

export function continentOf(code: string | null) {
  if (!code) return null;
  return CONTINENT.get(code) || "Não classificada";
}

export function countryName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export function readGeo(headers: Headers) {
  const rawCountry = (headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || headers.get("x-country-code") || "")
    .trim()
    .toUpperCase();
  const country = /^[A-Z]{2}$/.test(rawCountry) && rawCountry !== "XX" && rawCountry !== "T1" ? rawCountry : null;
  if (!country) return { country: null, region: null, city: null };

  const regionHeader = headers.get("x-vercel-ip-country-region") || headers.get("x-region");
  const cityHeader = headers.get("x-vercel-ip-city");
  return {
    country,
    region: cleanGeo(regionHeader),
    city: cleanGeo(cityHeader ? safeDecode(cityHeader) : null),
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanGeo(value: string | null) {
  if (!value) return null;
  const clean = value.replace(/[\u0000-\u001F<>]/g, "").trim();
  if (!clean || clean.length > 80) return null;
  return clean;
}
