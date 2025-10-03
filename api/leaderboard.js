export default async function handler(req, res) {
  const { start_date, end_date, type, code } = req.query;
  const API_KEY = process.env.RAIN_API_KEY;
  const url = `https://api.rain.gg/v1/affiliates/leaderboard?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}&type=${encodeURIComponent(type)}&code=${encodeURIComponent(code)}`;
  try {
    const response = await fetch(url, {
      headers: { "x-api-key": API_KEY }
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Proxy error", details: e.toString() });
  }
}