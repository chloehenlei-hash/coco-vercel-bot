import { getJobs } from "./_shared.js";

export default async function handler(req, res) {
  try {
    const jobs = await getJobs();
    res.status(200).json({ ok: true, rows: jobs.length, first: jobs[0]?.brand || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
