require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    const { data: users, error: err1 } = await supabase.auth.admin.listUsers();
    console.log("Users:", users?.users?.map(u => ({ email: u.email, id: u.id })));

    const { data: tasks, error: err2 } = await supabase.from('users_tasks').select('*');
    console.log("Tasks:", tasks);

    // Test task insert bypassing RLS? No anon key doesn't bypass RLS
}
check();
