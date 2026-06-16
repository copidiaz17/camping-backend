import nodemailer from "nodemailer";
import QRCode from "qrcode";

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null; // email no configurado
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const TIPO_LABEL = { quincho: "Quincho", pase_pileta: "Pase pileta", pase_dia: "Pase día", acampe: "Acampe" };

// Envía el QR de la reserva por email. NUNCA lanza: si falla, solo loguea (no rompe el pago).
export async function enviarQRReserva({ email, nombre, reserva, zona, qrToken }) {
  const t = getTransporter();
  if (!t) { console.log("[mail] SMTP no configurado — se omite el envío del QR"); return false; }
  if (!email) { console.log("[mail] la reserva no tiene email — se omite"); return false; }

  try {
    const qrPng = await QRCode.toBuffer(qrToken, { width: 320, margin: 1, color: { dark: "#0b3d2c", light: "#ffffff" } });
    const color = zona?.color || "#0b3d2c";
    const fecha = new Date(reserva.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e7e4da;border-radius:14px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#072a1e,#0e5a43);color:#fff;padding:22px 24px">
        <div style="font-size:13px;letter-spacing:1px;opacity:.8">🏕️ CAMPING LAS CASUARINAS</div>
        <div style="font-size:21px;font-weight:bold;margin-top:4px">¡Tu reserva está confirmada!</div>
      </div>
      <div style="padding:24px;text-align:center">
        <p style="color:#384d44;font-size:15px;margin:0 0 16px">Hola ${nombre || ""}, mostrá este código QR en la entrada del camping 👇</p>
        <img src="cid:qrcamping" alt="QR" width="240" height="240" style="border:1px solid #e2e6e3;border-radius:12px"/>
        <div style="background:#f6f4ec;border-radius:12px;padding:14px 18px;margin-top:18px;text-align:left;font-size:14px;color:#384d44">
          <div><b>${reserva.numero}</b></div>
          <div>${TIPO_LABEL[reserva.tipo] || reserva.tipo} · ${reserva.cantidad_personas} persona(s)</div>
          <div>📅 ${fecha}</div>
          <div style="margin-top:6px">
            <span style="display:inline-block;background:${color};color:#fff;font-size:12px;font-weight:bold;padding:3px 12px;border-radius:20px">
              Pulsera ${zona?.nombre || ""}
            </span>
          </div>
        </div>
        <p style="color:#8a948f;font-size:12px;margin-top:18px">Al llegar, mostrá el QR por la ventanilla: el guardia lo escanea y entrás sin filas. ¿Invitás gente? Reenviales este mismo correo.</p>
      </div>
      <div style="background:#072a1e;color:rgba(255,255,255,.6);padding:14px 24px;font-size:11px;text-align:center">
        Parque Aguirre · Ciudad de Santiago del Estero · Municipalidad de la Capital
      </div>
    </div>`;

    await t.sendMail({
      from: process.env.MAIL_FROM || `Camping Las Casuarinas <${process.env.SMTP_USER}>`,
      to: email,
      subject: `🎫 Tu QR — Reserva ${reserva.numero} · Camping Las Casuarinas`,
      html,
      attachments: [{ filename: "qr.png", content: qrPng, cid: "qrcamping" }],
    });
    console.log("[mail] QR enviado a", email);
    return true;
  } catch (e) {
    console.error("[mail] error enviando el QR:", e.message);
    return false;
  }
}
