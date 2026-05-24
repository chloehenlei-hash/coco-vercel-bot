import { env, supabase } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).json({ ok: true, actions: ["addJob", "updateJob"] });
    return;
  }

  try {
    const body = req.body || {};
    if (body.token !== env("ADMIN_TOKEN")) throw new Error("Wrong admin token");

    if (body.action === "addJob") {
      const row = normalize(body.job || {});
      if (!row.brand) throw new Error("Missing job.brand");
      const data = await supabase(tableName(), { method: "POST", body: JSON.stringify(row) });
      res.status(200).json({ ok: true, action: "addJob", data });
      return;
    }

    if (body.action === "updateJob") {
      const brand = String(body.match?.brand || "").trim();
      if (!brand) throw new Error("Missing match.brand");
      const updates = normalize(body.updates || {});
      const data = await supabase(`${tableName()}?brand=ilike.*${encodeURIComponent(brand)}*`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      res.status(200).json({ ok: true, action: "updateJob", data });
      return;
    }

    throw new Error("Unknown action");
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err.message || err) });
  }
}

function tableName() {
  return process.env.SUPABASE_TABLE || "jobs";
}

function normalize(input) {
  const out = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    out[key] = value;
  });
  out.last_updated = new Date().toISOString().slice(0, 10);
  return out;
}
