type Settings = Record<string, string | undefined>;
type TelegramResult = {
  http: number; ok: boolean;
  result?: { username?: string; type?: string; id?: number; message_id?: number; chat?: { id: number; type: string } };
};

export async function verifiedOwnerTelegram(env: Settings) {
  const chat = env.TELEGRAM_OWNER_CHAT_ID ?? "";
  const token = env.TELEGRAM_BOT_TOKEN ?? "";
  if (!/^\d+$/.test(chat) || chat !== env.TELEGRAM_OWNER_USER_ID || !/^\d+:[\w-]+$/.test(token)) {
    throw new Error("Telegram requires the verified private owner chat and bot credentials.");
  }
  async function request(method: "getMe" | "getChat" | "sendMessage", args: object = {}): Promise<TelegramResult> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args), redirect: "error", signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json();
      return { http: response.status, ok: response.ok && body.ok === true, result: body.result };
    } catch {
      return { http: 0, ok: false };
    }
  }
  const [bot, recipient] = await Promise.all([request("getMe"), request("getChat", { chat_id: chat })]);
  if (!bot.ok || bot.result?.username?.toLowerCase() !== "leadsflowwbot"
    || !recipient.ok || recipient.result?.type !== "private" || String(recipient.result.id) !== chat) {
    throw new Error("The LeadFlow bot or private owner chat failed verification.");
  }
  return async (text: string) => {
    const result = await request("sendMessage", { chat_id: chat, text, link_preview_options: { is_disabled: true } });
    const messageId = result.result?.message_id;
    return {
      http: result.http,
      messageId: result.ok && messageId && result.result?.chat?.type === "private"
        && String(result.result.chat.id) === chat ? messageId : undefined,
    };
  };
}
