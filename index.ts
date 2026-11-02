// Edge Function: notificar-inscricao
// Disparada por Database Webhook (INSERT em public.inscricoes).
// Busca as atividades da inscrição e envia email via Resend.

import { createClient } from "npm:@supabase/supabase-js@2";

// Rótulos das respostas de "O que mais motiva você?" (mesmos códigos do index.html)
const INTERESSES: Record<string, string> = {
  tax_planning: "Tax Planning",
  holding_company: "Holding Company",
  avoid_taxes: "Avoid Taxes",
  business_structures: "Business Structures",
  retirement: "Retirement Solutions",
  income_protection: "Income Protection",
  business_planning: "Business Planning Analysis",
  personal_planning: "Personal Planning Analysis",
  life_insurance: "Life Insurance",
  disability_insurance: "Disability Insurance",
  investment_analysis: "Investment Analysis & Services",
  investment_management: "Investment Management & Trust Services",
  career: "Career Opportunity",
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record; // linha inserida em inscricoes

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("inscricao_atividades")
      .select("atividades ( horario, titulo, palestrante )")
      .eq("inscricao_id", record.id);

    if (error) throw error;

    const lista = (data ?? [])
      .map((r: any) => `• ${r.atividades.horario} — ${r.atividades.titulo} (${r.atividades.palestrante ?? ""})`)
      .join("\n");

    const interesses = (record.interesses ?? [])
      .map((c: string) => `• ${INTERESSES[c] ?? c}`)
      .join("\n") || "(nenhuma opção marcada)";

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Convite Especial <onboarding@resend.dev>", // troque por domínio verificado no Resend
        to: [Deno.env.get("EMAIL_DESTINO")],
        ...(record.email ? { reply_to: record.email } : {}), // "Responder" no seu email vai direto para o inscrito
        subject: `Nova confirmação de presença: ${record.nome}`,
        text:
          `Nova confirmação — Pague Menos Imposto e Proteja Sua Renda\n` +
          `10 de novembro, 6:00 PM — Northwestern Mutual, Boca Raton\n\n` +
          `Nome: ${record.nome}\n` +
          `Telefone: ${record.telefone}\n` +
          `Email: ${record.email ?? "(não informado)"}\n` +
          `Data da inscrição: ${new Date(record.created_at).toLocaleString("pt-BR", { timeZone: "America/New_York" })} (horário da Flórida)\n\n` +
          `Sessões:\n${lista}\n\n` +
          `O que mais motiva:\n${interesses}`,
      }),
    });

    if (!resp.ok) {
      console.error("Resend error:", await resp.text());
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});
