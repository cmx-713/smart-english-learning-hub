const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 表名：默认 public.conversations。若表在自定义 schema，在 Netlify 环境变量中设置 SUPABASE_CONVERSATIONS_SCHEMA=english_hub
const TABLE_SCHEMA = process.env.SUPABASE_CONVERSATIONS_SCHEMA || 'public';
const TABLE_NAME = 'conversations';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { student_id, agent_id, user_input, bot_reply, accuracy } = body;

    if (!student_id || !agent_id || user_input === undefined || bot_reply === undefined) {
      return { statusCode: 400, body: 'Missing required fields: student_id, agent_id, user_input, bot_reply' };
    }

    const query = TABLE_SCHEMA === 'public'
      ? supabase.from(TABLE_NAME)
      : supabase.schema(TABLE_SCHEMA).from(TABLE_NAME);

    const { error } = await query.insert([{
      student_id,
      agent_id,
      user_input,
      bot_reply,
      accuracy: accuracy ?? null,
    }]);

    if (error) throw error;

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message };
  }
};