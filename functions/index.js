const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { OpenAI } = require("openai");

admin.initializeApp();
const db = admin.firestore();

// 🔐 Secret definition
const OPENAI_KEY = defineSecret("OPENAI_KEY");

// 🚨 Trigger when report is created
exports.dispatchAuthority = onDocumentCreated(
  {
    document: "reports/{reportId}",
    secrets: [OPENAI_KEY],
    region: "asia-south1"
  },
  async (event) => {
    try {
      const snap = event.data;
      if (!snap) return;

      const report = snap.data();
      const reportId = event.params.reportId;

      console.log("📄 New report:", reportId);

      if (!report.aiPending) {
        console.log("Skipping — aiPending false");
        return;
      }

      // ---- OpenAI Client ----
      const openai = new OpenAI({
        apiKey: OPENAI_KEY.value(),
      });

      // ---- AI CLASSIFICATION ----
      const aiRes = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: `Classify this civic issue into Waste, Fire, Traffic, Environment, Infrastructure.
Return JSON only: {department, urgency}.
Text: ${report.description}`,
          },
        ],
      });

      const parsed = JSON.parse(aiRes.choices[0].message.content);

      console.log("🤖 AI:", parsed);

      // ---- FIND AUTHORITY ----
      const authSnap = await db
        .collection("authorities")
        .where("department", "==", parsed.department)
        .where("active", "==", true)
        .get();

      if (authSnap.empty) {
        console.log("No authority for", parsed.department);
        return;
      }

      let chosen = null;
      let bestDist = Infinity;

      authSnap.forEach((doc) => {
        const a = doc.data();
        const d = distance(
          report.latitude,
          report.longitude,
          a.lat,
          a.lng
        );

        if (d < bestDist) {
          bestDist = d;
          chosen = { id: doc.id, ...a };
        }
      });

      // ---- UPDATE REPORT ----
      await snap.ref.update({
        aiPending: false,
        aiDispatch: parsed,
        notifiedAuthorityId: chosen.id,
        notificationMocked: true,
      });

      console.log(
        "✅ DISPATCHED",
        reportId,
        "→",
        chosen.name,
        chosen.phone
      );
    } catch (err) {
      console.error("🔥 dispatchAuthority ERROR:", err);
    }
  }
);

// ---- GEO HELPERS ----
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const dLat = deg(lat2 - lat1);
  const dLon = deg(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg(lat1)) *
      Math.cos(deg(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deg(v) {
  return (v * Math.PI) / 180;
}
