const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { student_id, agent_id, user_input, bot_reply, accuracy } = body;

    const { error } = await supabase
      .from('english_hub.conversations')
      .insert([{ student_id, agent_id, user_input, bot_reply, accuracy }]);

    if (error) throw error;

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err.message };
  }
};