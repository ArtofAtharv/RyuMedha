const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxgrwkzxskdfdsnlxofs.supabase.co';
const GENERATED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Z3J3a3p4c2tkZmRzbmx4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDQyMzAsImV4cCI6MjA4NjgyMDIzMH0.N9uE_pD0f8v1eIPxukGlIQJhTJk';

async function testConnection() {
    console.log('--- Testing with Generated Anon Key ---');
    try {
        const supabase = createClient(SUPABASE_URL, GENERATED_ANON_KEY);
        const { data, error } = await supabase.from('universities').select('id').limit(1);
        if (error) {
            console.error('Anon Fetch Error:', error.message);
            if (error.hint) console.log('Hint:', error.hint);
        } else {
            console.log('Anon Fetch Success:', data);
        }
    } catch (err) {
        console.error('Anon Client Error:', err);
    }
}

testConnection();
