const { createClient } = require('@supabase/supabase-js');
const { CozeAPI, COZE_CN_BASE_URL, COZE_COM_BASE_URL } = require('@coze/api');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE_SCHEMA = process.env.SUPABASE_CONVERSATIONS_SCHEMA || 'public';
const TABLE_NAME = 'conversations';
const STATE_TABLE = process.env.COZE_SYNC_STATE_TABLE || 'coze_sync_state';
const COZE_API_BASE = process.env.COZE_API_BASE || COZE_COM_BASE_URL || COZE_CN_BASE_URL;
const BOT_IDS = (process.env.COZE_SYNC_BOT_IDS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const MAX_CONVERSATION_PAGES = Number(process.env.COZE_SYNC_MAX_PAGES || 2);
const CONVERSATION_PAGE_SIZE = Number(process.env.COZE_SYNC_PAGE_SIZE || 50);
const MESSAGE_PAGE_LIMIT = Number(process.env.COZE_SYNC_MESSAGE_LIMIT || 100);

const queryTable = schema =>
  schema === 'public' ? supabase.from(TABLE_NAME) : supabase.schema(schema).from(TABLE_NAME);

const queryStateTable = schema =>
  schema === 'public' ? supabase.from(STATE_TABLE) : supabase.schema(schema).from(STATE_TABLE);

function getCozeClient() {
  if (!process.env.COZE_API_KEY) {
    throw new Error('COZE_API_KEY is required for sync-coze-conversations');
  }
  return new CozeAPI({
    token: process.env.COZE_API_KEY,
    baseURL: COZE_API_BASE,
  });
}

async function getBotCursor(botId) {
  const { data, error } = await queryStateTable(TABLE_SCHEMA)
    .select('last_message_created_at')
    .eq('bot_id', botId)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.last_message_created_at || 0);
}

async function setBotCursor(botId, ts) {
  const payload = {
    bot_id: botId,
    last_message_created_at: Number(ts || 0),
    updated_at: new Date().toISOString(),
  };
  const { error } = await queryStateTable(TABLE_SCHEMA).upsert(payload, { onConflict: 'bot_id' });
  if (error) throw error;
}

function pickStudentId(meta = {}) {
  return (
    meta.student_id ||
    meta.user_id ||
    meta.real_contact_email ||
    'coze_external_user'
  );
}

async function listAllMessages(client, conversationId) {
  const out = [];
  let hasMore = true;
  let afterId;
  let loopGuard = 0;

  while (hasMore && loopGuard < 20) {
    loopGuard += 1;
    const page = await client.conversations.messages.list(conversationId, {
      order: 'asc',
      limit: MESSAGE_PAGE_LIMIT,
      ...(afterId ? { after_id: afterId } : {}),
    });

    const list = Array.isArray(page?.data) ? page.data : [];
    out.push(...list);

    hasMore = Boolean(page?.has_more);
    afterId = page?.last_id;
    if (!afterId) break;
  }

  return out;
}

function buildRowsFromMessages(botId, messages, conversationMeta) {
  // 按 chat_id 配对「用户问题 -> 助手回答」
  const pendingByChat = new Map();
  const rows = [];

  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string' || !msg.content.trim()) continue;
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;

    const chatId = msg.chat_id || 'unknown_chat';
    const meta = msg.meta_data || conversationMeta || {};

    if (msg.role === 'user') {
      pendingByChat.set(chatId, {
        text: msg.content,
        studentId: pickStudentId(meta),
      });
      continue;
    }

    const pending = pendingByChat.get(chatId);
    if (!pending) continue;

    rows.push({
      student_id: String(pending.studentId),
      agent_id: String(botId),
      user_input: String(pending.text),
      bot_reply: String(msg.content),
      accuracy: null,
    });

    pendingByChat.delete(chatId);
  }

  return rows;
}

async function syncOneBot(client, botId) {
  const lastCursor = await getBotCursor(botId);
  let maxSeen = lastCursor;
  const rowsToInsert = [];

  for (let page = 1; page <= MAX_CONVERSATION_PAGES; page += 1) {
    const convResp = await client.conversations.list({
      bot_id: botId,
      page_num: page,
      page_size: CONVERSATION_PAGE_SIZE,
    });

    const conversations = Array.isArray(convResp?.conversations) ? convResp.conversations : [];

    for (const conversation of conversations) {
      const conversationId = conversation?.id;
      if (!conversationId) continue;

      const messages = await listAllMessages(client, conversationId);
      const newMessages = messages.filter(m => Number(m?.created_at || 0) > lastCursor);

      for (const m of newMessages) {
        maxSeen = Math.max(maxSeen, Number(m?.created_at || 0));
      }

      const rows = buildRowsFromMessages(botId, newMessages, conversation?.meta_data || {});
      rowsToInsert.push(...rows);
    }

    if (!convResp?.has_more) break;
  }

  if (rowsToInsert.length > 0) {
    const { error } = await queryTable(TABLE_SCHEMA).insert(rowsToInsert);
    if (error) throw error;
  }

  await setBotCursor(botId, maxSeen);
  return { inserted: rowsToInsert.length, lastCursor, maxSeen };
}

exports.config = {
  // 每 15 分钟同步一次；可按需改成 */5 * * * *
  schedule: '*/15 * * * *',
};

exports.handler = async () => {
  try {
    if (!BOT_IDS.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          message: 'COZE_SYNC_BOT_IDS is empty. Please set comma-separated bot ids.',
        }),
      };
    }

    const client = getCozeClient();
    const result = [];

    for (const botId of BOT_IDS) {
      const r = await syncOneBot(client, botId);
      result.push({ botId, ...r });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (error) {
    console.error('sync-coze-conversations failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message || String(error) }),
    };
  }
};
