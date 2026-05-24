import { answer, getJobs, telegram } from "./_shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).json({ ok: true, service: "coco-telegram-bot" });
    return;
  }

  const update = req.body || {};
  const msg = update.message || update.edited_message;
  if (!msg || !msg.chat || !msg.text || (msg.from && msg.from.is_bot)) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const jobs = await getJobs();
    await telegram("sendMessage", {
      chat_id: msg.chat.id,
      text: answer(msg.text, jobs),
      disable_web_page_preview: true,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    await telegram("sendMessage", {
      chat_id: msg.chat.id,
      text: `我有收到，但我现在读不出来 🥺\n原因：${err.message || err}`,
    }).catch(() => null);
    res.status(200).json({ ok: false, error: String(err.message || err) });
  }
}
