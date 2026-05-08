// config.js
const SUPABASE_URL = 'https://nhsrvtintqtwwongurrl.supabase.co'; // GANTI INI
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3J2dGludHF0d3dvbmd1cnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzM1MzQsImV4cCI6MjA5MzQwOTUzNH0._vADwO4JvlYfO6iJON1Rqd5_YlfnJeXfZ8hPMTMsZU0'; // GANTI INI

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
